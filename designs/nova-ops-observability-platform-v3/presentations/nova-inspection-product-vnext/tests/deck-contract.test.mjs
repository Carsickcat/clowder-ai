import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const deckPath = resolve(here, "..", "NOVA-Inspection-Product-Next.html");

async function readDeck() {
  return readFile(deckPath, "utf8");
}

test("deck contains exactly ten numbered slides", async () => {
  const html = await readDeck();
  const slides =
    html.match(
      /<section\b(?=[^>]*\bclass="[^"]*\bslide\b[^"]*")(?=[^>]*\bdata-slide="\d+")[^>]*>/gs,
    ) ?? [];
  assert.equal(slides.length, 10);
  for (let index = 1; index <= 10; index += 1) {
    assert.match(html, new RegExp(`data-slide="${index}"`));
  }
});

test("deck captures the agreed product model and audit boundaries", async () => {
  const html = await readDeck();
  for (const phrase of [
    "PlaybookRevision",
    "InspectionCase",
    "ServiceDependencySnapshot",
    "ComparabilityContract",
    "ABANDONED_BEFORE_EXECUTION",
    "BLOCKED_WITH_PARTIAL_EVIDENCE",
    "omissions",
    "Claw",
  ]) {
    assert.ok(
      html.includes(phrase),
      `missing required product phrase: ${phrase}`,
    );
  }
});

test("deck is a standalone offline file", async () => {
  const html = await readDeck();
  assert.doesNotMatch(
    html,
    /<(?:script|link|img)[^>]+(?:src|href)=["']https?:\/\//i,
  );
  assert.doesNotMatch(html, /@import\s+url\(/i);
  assert.match(html, /<style>/);
  assert.match(html, /<script>/);
});

test("deck supports keyboard, touch, print, and narrow-screen reading", async () => {
  const html = await readDeck();
  assert.match(html, /keydown/);
  assert.match(html, /touchstart/);
  assert.match(html, /touchend/);
  assert.match(html, /requestFullscreen/);
  assert.match(html, /@media\s+print/);
  assert.match(html, /@media\s*\(max-width:\s*720px\)/);
  assert.match(html, /aria-live="polite"/);
});
