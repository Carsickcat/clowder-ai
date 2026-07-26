import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function collectFiles(root, current = root, files = []) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const absolute = resolve(current, entry.name);
    if (entry.isDirectory()) {
      collectFiles(root, absolute, files);
      continue;
    }
    const pathname = `/${relative(root, absolute).split(sep).join("/")}`;
    files.push({
      pathname,
      body: readFileSync(absolute).toString("base64"),
      contentType:
        contentTypes[extname(entry.name).toLowerCase()] ??
        "application/octet-stream",
    });
  }
  return files;
}

function workerSource(files) {
  const manifest = Object.fromEntries(
    files.map(({ pathname, body, contentType }) => [
      pathname,
      { body, contentType },
    ]),
  );

  return `const files = ${JSON.stringify(manifest)};

function decode(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    const url = new URL(request.url);
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    if (pathname === "/") pathname = "/index.html";
    let asset = files[pathname];
    if (!asset && !pathname.split("/").at(-1)?.includes(".")) {
      asset = files["/index.html"];
    }
    if (!asset) return new Response("Not Found", { status: 404 });

    const headers = new Headers({
      "Content-Type": asset.contentType,
      "X-Content-Type-Options": "nosniff",
    });
    if (pathname.startsWith("/assets/")) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    }

    return new Response(
      request.method === "HEAD" ? null : decode(asset.body),
      { status: 200, headers },
    );
  },
};
`;
}

export function buildStaticWorker({ staticRoot, outputRoot, hostingConfig }) {
  const sourceRoot = resolve(staticRoot);
  const targetRoot = resolve(outputRoot);
  const sourceConfig = resolve(hostingConfig);
  const indexPath = resolve(sourceRoot, "index.html");

  if (!existsSync(indexPath)) {
    throw new Error(`Static app shell is missing: ${indexPath}`);
  }
  if (!existsSync(sourceConfig)) {
    throw new Error(`Sites hosting config is missing: ${sourceConfig}`);
  }

  const workerPath = resolve(targetRoot, "index.js");
  const hostingTarget = resolve(targetRoot, ".openai", "hosting.json");
  mkdirSync(dirname(workerPath), { recursive: true });
  mkdirSync(dirname(hostingTarget), { recursive: true });

  writeFileSync(workerPath, workerSource(collectFiles(sourceRoot)));
  copyFileSync(sourceConfig, hostingTarget);

  return {
    workerPath,
    workerUrl: pathToFileURL(workerPath).href,
    hostingTarget,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildStaticWorker({
    staticRoot: resolve(projectRoot, "static-dist"),
    outputRoot: resolve(projectRoot, "dist"),
    hostingConfig: resolve(projectRoot, ".openai", "hosting.json"),
  });
}
