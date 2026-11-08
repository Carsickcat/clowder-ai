import { apiFetch } from '@/utils/api-client';
export class AtelierError extends Error {
  constructor(
    public code: string,
    public status: number,
    public partIds: string[] = [],
  ) {
    super(code);
  }
}
export async function atelierRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await apiFetch(
    `/api/${path}`,
    body === undefined
      ? {}
      : {
          method: 'POST',
          ...(body instanceof FormData
            ? { body }
            : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
        },
    body === undefined ? { afterCurrentGet: true } : undefined,
  );
  const data = await response.json();
  if (!response.ok) throw new AtelierError(data.error ?? `http_${response.status}`, response.status, data.partIds);
  return data;
}
