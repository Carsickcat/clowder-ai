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
import { prepareStaticDistribution } from "../scripts/prepare-dist.mjs";

test("Sites distribution mirrors the validated static export", () => {
  const root = mkdtempSync(join(tmpdir(), "nova-ops-dist-"));
  const source = join(root, "out");
  const target = join(root, "dist");
  mkdirSync(join(source, "_next"), { recursive: true });
  mkdirSync(target);
  writeFileSync(join(source, "index.html"), "<h1>NOVA Ops</h1>");
  writeFileSync(join(source, "_next", "app.js"), "globalThis.nova = true");
  writeFileSync(join(target, "stale.txt"), "stale");

  prepareStaticDistribution(source, target);

  assert.match(readFileSync(join(target, "index.html"), "utf8"), /NOVA Ops/);
  assert.equal(existsSync(join(target, "_next", "app.js")), true);
  assert.equal(existsSync(join(target, "stale.txt")), false);
});
