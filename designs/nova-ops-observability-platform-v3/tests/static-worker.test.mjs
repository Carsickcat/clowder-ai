import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildStaticWorker } from "../scripts/build-static-worker.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "nova-static-worker-"));
  const staticRoot = join(root, "static");
  const outputRoot = join(root, "dist");
  const hostingConfig = join(root, "hosting.json");

  mkdirSync(join(staticRoot, "assets"), { recursive: true });
  writeFileSync(
    join(staticRoot, "index.html"),
    '<main id="root">NOVA Ops</main><script src="/assets/app.js"></script>',
  );
  writeFileSync(join(staticRoot, "assets", "app.js"), "window.NOVA = true;");
  writeFileSync(hostingConfig, '{"project_id":"test-project"}');

  return { staticRoot, outputRoot, hostingConfig };
}

test("static worker serves the app shell and immutable assets", async () => {
  const { staticRoot, outputRoot, hostingConfig } = fixture();
  const result = buildStaticWorker({
    staticRoot,
    outputRoot,
    hostingConfig,
  });

  const worker = await import(`${result.workerUrl}?test=${Date.now()}`);
  const rootResponse = await worker.default.fetch(
    new Request("https://nova.example/"),
  );
  const assetResponse = await worker.default.fetch(
    new Request("https://nova.example/assets/app.js"),
  );

  assert.equal(rootResponse.status, 200);
  assert.match(await rootResponse.text(), /NOVA Ops/);
  assert.equal(
    rootResponse.headers.get("content-type"),
    "text/html; charset=utf-8",
  );
  assert.equal(assetResponse.status, 200);
  assert.match(await assetResponse.text(), /window\.NOVA/);
  assert.match(assetResponse.headers.get("cache-control"), /immutable/);
});

test("static worker keeps SPA navigation inside the application shell", async () => {
  const { staticRoot, outputRoot, hostingConfig } = fixture();
  const result = buildStaticWorker({
    staticRoot,
    outputRoot,
    hostingConfig,
  });

  const worker = await import(`${result.workerUrl}?test=${Date.now()}`);
  const response = await worker.default.fetch(
    new Request("https://nova.example/change-guard"),
  );

  assert.equal(response.status, 200);
  assert.match(await response.text(), /NOVA Ops/);
  assert.match(readFileSync(result.hostingTarget, "utf8"), /test-project/);
});
