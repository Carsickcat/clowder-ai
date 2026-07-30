import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.NODE_ENV = "production";

const prototypeRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const [{ build }, { buildStaticWorker }] = await Promise.all([
  import("vite"),
  import("./build-static-worker.mjs"),
]);

await build({
  configFile: path.join(prototypeRoot, "vite.static.config.mjs"),
});
buildStaticWorker({
  staticRoot: path.join(prototypeRoot, "static-dist"),
  outputRoot: path.join(prototypeRoot, "dist"),
  hostingConfig: path.join(prototypeRoot, ".openai", "hosting.json"),
});
