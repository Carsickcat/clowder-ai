import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const deckDirectory = path.resolve(scriptDirectory, "..");
const deckPath = path.join(deckDirectory, "NOVA-Inspection-Product-Next.html");
const assetPaths = [
  "assets/hifi-plan-75d991e.png",
  "assets/hifi-canary-risk-75d991e.png",
  "assets/hifi-report-75d991e.png",
];

const escapeRegularExpression = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let deck = await readFile(deckPath, "utf8");

for (const assetPath of assetPaths) {
  const data = await readFile(path.join(deckDirectory, assetPath));
  const dataUrl = `data:image/png;base64,${data.toString("base64")}`;
  const plainSource = `src="${assetPath}"`;
  const embeddedPattern = new RegExp(
    `(data-asset="${escapeRegularExpression(assetPath)}"\\s+src=")[^"]*(")`,
    "g",
  );

  if (deck.includes(plainSource)) {
    deck = deck.replaceAll(
      plainSource,
      `data-asset="${assetPath}" src="${dataUrl}"`,
    );
  } else if (deck.includes(`data-asset="${assetPath}"`)) {
    deck = deck.replace(embeddedPattern, `$1${dataUrl}$2`);
  } else {
    throw new Error(`No image binding found for ${assetPath}`);
  }
}

await writeFile(deckPath, deck, "utf8");
console.log(
  `Embedded ${assetPaths.length} PNG assets into ${path.basename(deckPath)}`,
);
