import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const rootDirectory = path.resolve(import.meta.dirname, "..");

test("offline Chrome evidence process closes without orphaned stdio handles", async () => {
  const script = `
    import { launchOfflineChrome } from "./tests/cdp-client.mjs";
    const browser = await launchOfflineChrome();
    process.stdout.write("launched\\n");
    await browser.session.send("Page.captureScreenshot", { format: "png" });
    process.stdout.write("captured\\n");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    process.stdout.write("closing\\n");
    await browser.close();
    process.stdout.write("closed\\n");
  `;

  const { stdout } = await execFileAsync(
    process.execPath,
    ["--input-type=module", "--eval", script],
    {
      cwd: rootDirectory,
      timeout: 8_000,
      windowsHide: true,
    },
  );

  assert.match(stdout, /closed/);
});
