const DEFAULT_TIMEOUT_MS = 15_000;

function normalizeBaseUrl(baseUrl) {
  return `${baseUrl.replace(/\/+$/, '')}/`;
}

function extractSameOriginScriptUrls(html, baseUrl) {
  const base = new URL(normalizeBaseUrl(baseUrl));
  const urls = new Set();
  const scriptPattern = /<script\b[^>]*\bsrc=["']([^"']+\.js(?:\?[^"']*)?)["']/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const url = new URL(match[1], base);
    if (url.origin === base.origin) urls.add(url.href);
  }
  return [...urls];
}

async function checkedFetch(fetchImpl, url, timeoutMs) {
  const response = await fetchImpl(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`${new URL(url).pathname} returned HTTP ${response.status}`);
  }
  return response;
}

function assertJavaScriptMediaType(response, url) {
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0].trim();
  if (!/^(?:application|text)\/(?:x-)?(?:java|ecma)script$/i.test(mediaType ?? '')) {
    throw new Error(`${new URL(url).pathname} did not return a JavaScript media type`);
  }
}

function assertHtmlMediaType(response, url) {
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0].trim();
  if (mediaType?.toLowerCase() !== 'text/html') {
    throw new Error(`${new URL(url).pathname} did not return an HTML media type`);
  }
}

export async function probeF010PublicRuntime({
  baseUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is unavailable');
  const rootUrl = normalizeBaseUrl(baseUrl);
  const rootResponse = await checkedFetch(fetchImpl, rootUrl, timeoutMs);
  assertHtmlMediaType(rootResponse, rootUrl);
  const html = await rootResponse.text();
  const scriptUrls = extractSameOriginScriptUrls(html, rootUrl);
  if (scriptUrls.length === 0) {
    throw new Error('HTML contained no same-origin JavaScript assets');
  }

  await Promise.all(
    scriptUrls.map(async (url) => {
      const response = await checkedFetch(fetchImpl, url, timeoutMs);
      assertJavaScriptMediaType(response, url);
    }),
  );

  const catsResponse = await checkedFetch(fetchImpl, new URL('api/cats', rootUrl).href, timeoutMs);
  const catsPayload = await catsResponse.json();
  const catCount = Array.isArray(catsPayload?.cats) ? catsPayload.cats.length : 0;
  if (catCount === 0) throw new Error('/api/cats returned no available members');

  return { scriptCount: scriptUrls.length, catCount };
}
