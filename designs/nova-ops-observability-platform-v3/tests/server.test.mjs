import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createStaticServer, safeAssetPath } from "../serve.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "nova-ops-server-"));
  mkdirSync(join(root, "_next"));
  writeFileSync(join(root, "index.html"), "<h1>NOVA</h1>");
  writeFileSync(join(root, "_next", "app.js"), "globalThis.nova = true");
  return root;
}

test("static server blocks traversal and resolves app fallbacks", () => {
  const root = fixture();
  assert.equal(safeAssetPath("/../../../secret", root), null);
  assert.equal(safeAssetPath("/mission", root), join(root, "index.html"));
  assert.equal(
    safeAssetPath("/_next/app.js", root),
    join(root, "_next", "app.js"),
  );
});

test("static server responds after the caller output stream is absent", async () => {
  const root = fixture();
  const server = createStaticServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /NOVA/);

  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
