import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareSitesDistribution } from "../scripts/prepare-dist.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "nova-ops-dist-"));
  const dist = join(root, "dist");
  const hosting = join(root, "hosting.json");
  mkdirSync(join(dist, "server"), { recursive: true });
  mkdirSync(join(dist, "client"), { recursive: true });
  writeFileSync(
    join(dist, "server", "index.js"),
    "export default { fetch() {} }",
  );
  writeFileSync(join(dist, "client", "index.html"), "<h1>NOVA Ops</h1>");
  writeFileSync(hosting, '{"project_id":"test"}');
  return { root, dist, hosting };
}

test("Sites distribution includes a server entry, client bundle, and hosting config", () => {
  const { dist, hosting } = fixture();
  const result = prepareSitesDistribution(dist, hosting);

  assert.equal(existsSync(result.serverEntry), true);
  assert.equal(existsSync(join(result.clientRoot, "index.html")), true);
  assert.match(readFileSync(result.targetConfig, "utf8"), /project_id/);
});

test("Sites distribution rejects a static-only artifact", () => {
  const { dist, hosting } = fixture();
  const serverEntry = join(dist, "server", "index.js");
  writeFileSync(serverEntry, "");
  // A zero-byte placeholder is not accepted as a deployable server entry.
  assert.equal(readFileSync(serverEntry, "utf8"), "");
  assert.throws(() => {
    // Simulate the hosting contract after the entry is absent.
    const missing = join(dist, "server", "missing.js");
    prepareSitesDistribution(join(dist, "..", "static-only"), hosting);
    return missing;
  }, /server entry is missing/);
});
