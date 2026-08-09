import assert from "node:assert/strict";
import { access, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildStandalone } from "../scripts/build.mjs";

const artifactPath = path.resolve(
  import.meta.dirname,
  "../index.html",
);
const legacyArtifactPath = path.resolve(
  import.meta.dirname,
  "../AI-Inspection-Copilot-Offline-Demo.html",
);

test("standalone build produces one deterministic offline artifact", async (t) => {
  const outputPath = path.join(
    os.tmpdir(),
    `ai-inspection-copilot-${process.pid}.html`,
  );
  t.after(() => rm(outputPath, { force: true }));

  await buildStandalone({ outputPath });
  const [generated, checked] = await Promise.all([
    readFile(outputPath, "utf8"),
    readFile(artifactPath, "utf8"),
  ]);

  assert.equal(generated, checked);
  assert.match(generated, /<title>AI 巡检 Copilot · 离线验收 Demo<\/title>/);
  assert.match(generated, /<style>[\s\S]+<\/style>/);
  assert.match(generated, /<script>[\s\S]+<\/script>/);
  assert.match(generated, /订单服务升级验收/);
  assert.match(generated, /支付配置变更巡检/);
  assert.match(generated, /所有数据均为 mock/);

  const shell = generated
    .replace(/<style>[\s\S]*?<\/style>/gi, "")
    .replace(/<script>[\s\S]*?<\/script>/gi, "");
  assert.doesNotMatch(shell, /<link[^>]+stylesheet/i);
  assert.doesNotMatch(shell, /<script[^>]+src=/i);
  assert.doesNotMatch(shell, /https?:\/\//i);
  assert.doesNotMatch(shell, /type=["']module["']/i);
  await assert.rejects(access(legacyArtifactPath), /ENOENT/);
});
