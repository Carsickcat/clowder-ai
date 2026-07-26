import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("./out", import.meta.url)));
const port = Number(process.env.PORT || 5290);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

export function safeAssetPath(urlPath, publicRoot = root) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const segments = clean.replaceAll("\\", "/").split("/");
  if (segments.includes("..")) {
    return null;
  }
  const candidate = resolve(publicRoot, `.${normalize(clean)}`);
  if (
    candidate !== publicRoot &&
    !candidate.startsWith(`${publicRoot}${sep}`)
  ) {
    return null;
  }

  if (existsSync(candidate) && extname(candidate)) {
    return candidate;
  }

  const indexCandidate = join(candidate, "index.html");
  if (existsSync(indexCandidate)) {
    return indexCandidate;
  }

  return join(publicRoot, "index.html");
}

export function createStaticServer(publicRoot = root) {
  return createServer((request, response) => {
    try {
      const assetPath = safeAssetPath(request.url || "/", publicRoot);
      if (!assetPath || !existsSync(assetPath)) {
        response.writeHead(404, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "cache-control": assetPath.endsWith(".html")
          ? "no-store"
          : "public, max-age=31536000, immutable",
        "content-type":
          contentTypes[extname(assetPath)] || "application/octet-stream",
      });
      createReadStream(assetPath).pipe(response);
    } catch {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end("Server error");
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createStaticServer();
  server.listen(port, "127.0.0.1");
}
