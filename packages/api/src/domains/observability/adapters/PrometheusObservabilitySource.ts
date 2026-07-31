import {
  createQueryDigest,
  type ObservabilityCheckRequest,
  type ObservabilityCollectRequest,
  type ObservabilityObservation,
  type ObservabilitySnapshot,
  type ObservabilitySource,
  ObservabilitySourceError,
} from '../ports/ObservabilitySource.js';

interface ResponseHeaders {
  get(name: string): string | null;
}

interface ResponseBodyReader {
  cancel(): Promise<void>;
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
}

interface ResponseBody {
  getReader(): ResponseBodyReader;
}

interface FetchResponse {
  readonly body?: ResponseBody | null;
  readonly headers: ResponseHeaders;
  readonly ok: boolean;
  readonly redirected?: boolean;
  readonly status: number;
  text?(): Promise<string>;
}

interface FetchInit {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: 'POST';
  readonly redirect: 'error';
  readonly signal: AbortSignal;
}

export type ObservabilityFetch = (url: string, init: FetchInit) => Promise<FetchResponse>;

export interface PrometheusObservabilitySourceOptions {
  readonly authorization?: string;
  readonly baseUrl: string;
  readonly clock?: () => Date;
  readonly fetchImpl?: ObservabilityFetch;
  readonly maxResponseBytes?: number;
  readonly sourceId: string;
  readonly timeoutMs?: number;
}

const DEFAULT_MAX_RESPONSE_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 5_000;

function safeError(
  code: ConstructorParameters<typeof ObservabilitySourceError>[0],
  message: string,
): ObservabilitySourceError {
  return new ObservabilitySourceError(code, message);
}

function fixedQueryEndpoint(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw safeError('invalid_configuration', 'Prometheus source configuration is invalid');
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw safeError('invalid_configuration', 'Prometheus source configuration is invalid');
  }
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/`;
  return new URL('api/v1/query', parsed).toString();
}

async function readBoundedText(response: FetchResponse, maxResponseBytes: number): Promise<string> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null && Number.isFinite(Number(declaredLength)) && Number(declaredLength) > maxResponseBytes) {
    throw safeError('response_too_large', 'Prometheus response exceeded the configured byte budget');
  }

  if (!response.body) {
    const text = await response.text?.();
    const body = text ?? '';
    if (Buffer.byteLength(body, 'utf8') > maxResponseBytes) {
      throw safeError('response_too_large', 'Prometheus response exceeded the configured byte budget');
    }
    return body;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    if (!chunk.value) continue;
    totalBytes += chunk.value.byteLength;
    if (totalBytes > maxResponseBytes) {
      await reader.cancel();
      throw safeError('response_too_large', 'Prometheus response exceeded the configured byte budget');
    }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parsePrometheusObservation(check: ObservabilityCheckRequest, payload: unknown): ObservabilityObservation {
  if (typeof payload !== 'object' || payload === null || (payload as { status?: unknown }).status !== 'success') {
    throw safeError('malformed_response', 'Prometheus returned a malformed response');
  }

  const data = (payload as { data?: unknown }).data;
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as { resultType?: unknown }).resultType !== 'vector' ||
    !Array.isArray((data as { result?: unknown }).result)
  ) {
    throw safeError('malformed_response', 'Prometheus returned a malformed response');
  }

  const result = (data as { result: unknown[] }).result;
  const queryDigest = createQueryDigest(check.query);
  if (result.length === 0) {
    return {
      baselineValue: null,
      checkId: check.id,
      observedAt: null,
      partial: false,
      queryDigest,
      status: 'missing',
      value: null,
    };
  }
  if (result.length !== 1) {
    return {
      baselineValue: null,
      checkId: check.id,
      observedAt: null,
      partial: true,
      queryDigest,
      status: 'error',
      value: null,
    };
  }

  const sample =
    typeof result[0] === 'object' && result[0] !== null ? (result[0] as { value?: unknown }).value : undefined;
  if (!Array.isArray(sample) || sample.length !== 2) {
    throw safeError('malformed_response', 'Prometheus returned a malformed response');
  }

  const timestampSeconds = Number(sample[0]);
  const value = Number(sample[1]);
  if (!Number.isFinite(timestampSeconds) || !Number.isFinite(value)) {
    throw safeError('malformed_response', 'Prometheus returned a malformed response');
  }
  const observedAt = new Date(timestampSeconds * 1_000);
  if (!Number.isFinite(observedAt.getTime())) {
    throw safeError('malformed_response', 'Prometheus returned a malformed response');
  }

  return {
    baselineValue: null,
    checkId: check.id,
    observedAt: observedAt.toISOString(),
    partial: false,
    queryDigest,
    status: 'ok',
    value,
  };
}

export class PrometheusObservabilitySource implements ObservabilitySource {
  readonly sourceId: string;
  private readonly authorization: string | undefined;
  private readonly clock: () => Date;
  private readonly endpoint: string;
  private readonly fetchImpl: ObservabilityFetch;
  private readonly maxResponseBytes: number;
  private readonly timeoutMs: number;

  constructor(options: PrometheusObservabilitySourceOptions) {
    this.sourceId = options.sourceId;
    this.endpoint = fixedQueryEndpoint(options.baseUrl);
    this.authorization = options.authorization;
    this.clock = options.clock ?? (() => new Date());
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as ObservabilityFetch);
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (
      !Number.isSafeInteger(this.maxResponseBytes) ||
      this.maxResponseBytes <= 0 ||
      !Number.isSafeInteger(this.timeoutMs) ||
      this.timeoutMs <= 0
    ) {
      throw safeError('invalid_configuration', 'Prometheus source limits are invalid');
    }
  }

  async collect(request: ObservabilityCollectRequest): Promise<ObservabilitySnapshot> {
    const collectedAt = this.clock();
    if (!Number.isFinite(collectedAt.getTime())) {
      throw safeError('invalid_configuration', 'Prometheus source clock is invalid');
    }

    const observations: ObservabilityObservation[] = [];
    for (const check of request.checks) {
      observations.push(await this.collectCheck(check, collectedAt));
    }
    return {
      collectedAt: collectedAt.toISOString(),
      observations,
      sourceId: this.sourceId,
      window: request.window,
    };
  }

  private async collectCheck(check: ObservabilityCheckRequest, queryTime: Date): Promise<ObservabilityObservation> {
    const abortController = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        abortController.abort();
        reject(safeError('timeout', 'Prometheus request timed out'));
      }, this.timeoutMs);
    });
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    };
    if (this.authorization) headers.authorization = this.authorization;

    const operation = async (): Promise<ObservabilityObservation> => {
      const response = await this.fetchImpl(this.endpoint, {
        body: new URLSearchParams({
          query: check.query,
          time: String(queryTime.getTime() / 1_000),
        }).toString(),
        headers,
        method: 'POST',
        redirect: 'error',
        signal: abortController.signal,
      });
      if (response.redirected) {
        throw safeError('redirect_error', 'Prometheus redirects are not allowed');
      }
      if (!response.ok) {
        throw safeError('http_error', 'Prometheus request returned a non-success status');
      }

      const body = await readBoundedText(response, this.maxResponseBytes);
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        throw safeError('malformed_response', 'Prometheus returned a malformed response');
      }
      return parsePrometheusObservation(check, payload);
    };

    try {
      return await Promise.race([operation(), deadline]);
    } catch (error) {
      if (error instanceof ObservabilitySourceError) throw error;
      if (abortController.signal.aborted) {
        throw safeError('timeout', 'Prometheus request timed out');
      }
      throw safeError('transport_error', 'Prometheus request failed');
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
