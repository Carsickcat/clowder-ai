import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const prototypeRoot = path.resolve(path.dirname(scriptPath), "..");
const defaultDistDir = path.join(prototypeRoot, "static-dist");
const defaultOutputPath = path.join(
  prototypeRoot,
  "NOVA-Ops-Intelligence-Standalone.html",
);

function findSingleAsset(html, tagName, attributeName) {
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? [];
  const candidates = tags.flatMap((tag) => {
    const match = tag.match(
      new RegExp(`\\b${attributeName}=["']([^"']+)["']`, "i"),
    );
    return match ? [{ tag, reference: match[1] }] : [];
  });

  if (candidates.length !== 1) {
    throw new Error(
      `Expected exactly one ${tagName} ${attributeName}, found ${candidates.length}`,
    );
  }
  return candidates[0];
}

function resolveDistAsset(distDir, reference) {
  const url = new URL(reference, "https://standalone.invalid/");
  if (url.origin !== "https://standalone.invalid") {
    throw new Error(`External asset cannot be inlined: ${reference}`);
  }

  const assetPath = path.resolve(
    distDir,
    `.${decodeURIComponent(url.pathname)}`,
  );
  const relative = path.relative(distDir, assetPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Asset escapes the static build directory: ${reference}`);
  }
  return assetPath;
}

export async function buildStandalone({
  distDir = defaultDistDir,
  outputPath = defaultOutputPath,
} = {}) {
  const sourceHtml = await readFile(path.join(distDir, "index.html"), "utf8");
  const scriptAsset = findSingleAsset(sourceHtml, "script", "src");
  const styleAsset = findSingleAsset(sourceHtml, "link", "href");
  const scriptStart = sourceHtml.indexOf(scriptAsset.tag);
  const scriptEnd = sourceHtml.indexOf("</script>", scriptStart);
  if (scriptEnd < 0) {
    throw new Error("The static build script element is not closed");
  }
  const scriptElement = sourceHtml.slice(
    scriptStart,
    scriptEnd + "</script>".length,
  );
  const [javascript, css] = await Promise.all([
    readFile(resolveDistAsset(distDir, scriptAsset.reference), "utf8"),
    readFile(resolveDistAsset(distDir, styleAsset.reference), "utf8"),
  ]);

  const withoutAssets = sourceHtml
    .replace(scriptElement, "")
    .replace(styleAsset.tag, "")
    .replace(/^[\t ]+$/gm, "");
  const withStyles = withoutAssets.replace(
    "</head>",
    () =>
      `    <!-- Portable offline demo: fixed mock data, no backend or localhost required. -->\n    <style>\n${css.replace(/<\/style/gi, "<\\/style")}\n    </style>\n  </head>`,
  );
  const standalone = withStyles.replace(
    "</body>",
    () =>
      `    <script>\n${javascript.replace(/<\/script/gi, "<\\/script")}\n    </script>\n  </body>`,
  );

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, standalone, "utf8");
  return outputPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const outputPath = await buildStandalone();
  process.stdout.write(`${outputPath}\n`);
}
