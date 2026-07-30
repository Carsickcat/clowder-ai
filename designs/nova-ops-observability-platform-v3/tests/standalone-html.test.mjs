import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildStandalone } from "../scripts/build-standalone.mjs";

const prototypeRoot = path.resolve(import.meta.dirname, "..");
const checkedArtifactPath = path.join(
  prototypeRoot,
  "NOVA-Ops-Intelligence-Standalone.html",
);

async function createFixtureDist(
  t,
  {
    scriptReference = "/assets/app.js",
    styleReference = "/assets/app.css",
    javascript = "document.body.dataset.ready = 'true';",
    css = "body { color: white; }",
    htmlEol = "",
  } = {},
) {
  const distDir = await mkdtemp(
    path.join(os.tmpdir(), "nova-standalone-dist-"),
  );
  t.after(() => rm(distDir, { recursive: true, force: true }));
  await mkdir(path.join(distDir, "assets"), { recursive: true });
  await Promise.all([
    writeFile(
      path.join(distDir, "index.html"),
      [
        "<!doctype html><html>",
        `<head><link rel="stylesheet" href="${styleReference}"></head>`,
        `<body><div id="root"></div><script type="module" src="${scriptReference}"></script></body>`,
        "</html>",
      ].join(htmlEol),
      "utf8",
    ),
    writeFile(path.join(distDir, "assets", "app.js"), javascript, "utf8"),
    writeFile(path.join(distDir, "assets", "app.css"), css, "utf8"),
  ]);
  return distDir;
}

test("standalone build inlines the reviewed NOVA runtime into one offline HTML file", async (t) => {
  const outputPath = path.join(
    os.tmpdir(),
    `nova-ops-intelligence-standalone-${process.pid}.html`,
  );
  t.after(() => rm(outputPath, { force: true }));

  await buildStandalone({ outputPath });
  const [html, checkedArtifact] = await Promise.all([
    readFile(outputPath, "utf8"),
    readFile(checkedArtifactPath, "utf8"),
  ]);

  assert.equal(
    html,
    checkedArtifact,
    "checked-in artifact must be byte-identical to a rebuild from static-dist",
  );
  assert.match(html, /<title>NOVA Ops · AI 可观测平台<\/title>/);
  assert.match(html, /<style>[\s\S]+<\/style>/);
  assert.match(html, /<script>[\s\S]+<\/script>/);
  assert.match(html, /NOVA · 变更巡检/);
  assert.match(html, /所有数据均为演示，不会触发真实生产动作/);
  const documentShell = html
    .replace(/<style>[\s\S]*?<\/style>/gi, "")
    .replace(/<script>[\s\S]*?<\/script>/gi, "");
  assert.doesNotMatch(documentShell, /<link[^>]+rel=["']stylesheet/i);
  assert.doesNotMatch(documentShell, /<script[^>]+src=/i);
  assert.doesNotMatch(documentShell, /(?:src|href)=["']\/assets\//i);
  assert.doesNotMatch(documentShell, /<script[^>]+type=["']module/i);
  assert.doesNotMatch(documentShell, /<\/script>/i);
  assert.ok(
    Buffer.byteLength(html, "utf8") > 250_000,
    "standalone artifact should contain the complete reviewed application",
  );
});

test("standalone build normalizes CRLF inputs to deterministic LF output", async (t) => {
  const distDir = await createFixtureDist(t, {
    css: "body {\r\n  color: white;\r\n}",
    htmlEol: "\r\n",
    javascript: "document.body.dataset.ready = 'true';\r\n",
  });
  const outputPath = path.join(distDir, "standalone.html");

  await buildStandalone({ distDir, outputPath });
  const html = await readFile(outputPath, "utf8");

  assert.doesNotMatch(html, /\r/);
  assert.match(html, /<!doctype html><html>\n<head>/);
});

test("standalone build escapes mixed-case raw-text terminators", async (t) => {
  const distDir = await createFixtureDist(t, {
    javascript: `document.body.dataset.payload = "</ScRiPt><p>unsafe</p>";`,
    css: `/* </StYlE><script>unsafe</script> */ body { color: white; }`,
  });
  const outputPath = path.join(distDir, "standalone.html");

  await buildStandalone({ distDir, outputPath });
  const html = await readFile(outputPath, "utf8");

  assert.match(html, /<\\\/script>/);
  assert.match(html, /<\\\/style>/);
  assert.doesNotMatch(html, /<\/ScRiPt>/);
  assert.doesNotMatch(html, /<\/StYlE>/);
});

test("standalone build rejects external and escaping asset references", async (t) => {
  const externalDist = await createFixtureDist(t, {
    scriptReference: "https://example.com/app.js",
  });
  await assert.rejects(
    () =>
      buildStandalone({
        distDir: externalDist,
        outputPath: path.join(externalDist, "standalone.html"),
      }),
    /External asset cannot be inlined/,
  );

  const traversalDist = await createFixtureDist(t, {
    scriptReference: "/%2e%2e%2f%2e%2e%2fsecret.js",
  });
  await assert.rejects(
    () =>
      buildStandalone({
        distDir: traversalDist,
        outputPath: path.join(traversalDist, "standalone.html"),
      }),
    /Asset escapes the static build directory/,
  );

  const malformedDist = await createFixtureDist(t, {
    scriptReference: "/assets/%E0%A4%A.js",
  });
  await assert.rejects(() =>
    buildStandalone({
      distDir: malformedDist,
      outputPath: path.join(malformedDist, "standalone.html"),
    }),
  );
});
