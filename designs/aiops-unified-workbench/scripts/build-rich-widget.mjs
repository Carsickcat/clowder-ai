import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_ARTIFACT = new URL('../NOVA-Ops-AI-Workbench-Standalone.html', import.meta.url);

export function buildHtmlWidgetBlock(
  html,
  { id = `nova-ops-v2-${Date.now()}`, title = 'NOVA Ops · 场景驱动 AI 运维工作台 V2', height = 1200 } = {},
) {
  if (!html.includes('<!doctype html>') || !html.includes('data-scenario-id')) {
    throw new Error('Expected the built NOVA Ops standalone document.');
  }
  if (/(?:[A-Z]:\\|file:\/\/|https?:\/\/(?:localhost|127\.0\.0\.1))/i.test(html)) {
    throw new Error('Remote widget delivery cannot contain local filesystem or localhost URLs.');
  }
  if (/<(?:script|link)[^>]+(?:src|href)=["']https?:/i.test(html)) {
    throw new Error('Remote widget delivery must not depend on external scripts or styles.');
  }

  return {
    id,
    kind: 'html_widget',
    v: 1,
    title,
    height,
    html,
  };
}

async function main() {
  const artifactUrl = process.argv[2] ? pathToFileURL(path.resolve(process.argv[2])) : DEFAULT_ARTIFACT;
  const html = await readFile(artifactUrl, 'utf8');
  process.stdout.write(JSON.stringify(buildHtmlWidgetBlock(html)));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  await main();
}

export const standalonePath = fileURLToPath(DEFAULT_ARTIFACT);
