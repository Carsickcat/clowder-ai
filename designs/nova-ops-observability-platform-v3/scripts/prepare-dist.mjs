import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export function prepareStaticDistribution(source, target) {
  const sourceRoot = resolve(source);
  const targetRoot = resolve(target);

  if (!existsSync(sourceRoot)) {
    throw new Error(`Static export is missing: ${sourceRoot}`);
  }
  if (
    targetRoot === sourceRoot ||
    sourceRoot.startsWith(`${targetRoot}${sep}`)
  ) {
    throw new Error("Distribution target must not contain the source export");
  }

  rmSync(targetRoot, { recursive: true, force: true });
  cpSync(sourceRoot, targetRoot, { recursive: true });
  return targetRoot;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  prepareStaticDistribution(
    resolve(projectRoot, "out"),
    resolve(projectRoot, "dist"),
  );
}
