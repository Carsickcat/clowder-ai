import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export function prepareSitesDistribution(distRoot, hostingConfigPath) {
  const root = resolve(distRoot);
  const serverEntry = resolve(root, "server", "index.js");
  const clientRoot = resolve(root, "client");
  const sourceConfig = resolve(hostingConfigPath);

  if (!existsSync(serverEntry)) {
    throw new Error(`Sites server entry is missing: ${serverEntry}`);
  }
  if (!existsSync(clientRoot)) {
    throw new Error(`Sites client bundle is missing: ${clientRoot}`);
  }
  if (!existsSync(sourceConfig)) {
    throw new Error(`Sites hosting config is missing: ${sourceConfig}`);
  }

  const targetConfig = resolve(root, ".openai", "hosting.json");
  mkdirSync(dirname(targetConfig), { recursive: true });
  copyFileSync(sourceConfig, targetConfig);
  return { serverEntry, clientRoot, targetConfig };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  prepareSitesDistribution(
    resolve(projectRoot, "dist"),
    resolve(projectRoot, ".openai", "hosting.json"),
  );
}
