import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactName = 'index.html';
const styleFiles = ['tokens.css', 'layout.css', 'components.css', 'responsive.css'];
const applicationFiles = [
  '../lib/domain.mjs',
  '../lib/scenarios.mjs',
  '../lib/compiler.mjs',
  '../lib/playbooks.mjs',
  '../lib/saved-inspections.mjs',
  '../lib/selectors.mjs',
  '../lib/reducer.mjs',
  'view-utils.mjs',
  'report-share.mjs',
  'render-intake.mjs',
  'render-plan.mjs',
  'render-playbook.mjs',
  'render-saved-inspections.mjs',
  'render-report.mjs',
  'storage.mjs',
  'render.mjs',
  'app.mjs',
];

function escapeInlineBoundary(source, tagName) {
  return source.replace(new RegExp(`</${tagName}`, 'gi'), `<\\/${tagName}`);
}

function stripModuleSyntax(source) {
  return source
    .replace(/import\s+[\s\S]*?\s+from\s+["'][^"']+["'];?\s*/g, '')
    .replace(/\bexport\s+(?=(?:const|let|class|function)\b)/g, '')
    .trim();
}

async function bundleApplication() {
  const sources = await Promise.all(
    applicationFiles.map((relativePath) => readFile(join(rootDirectory, 'src', relativePath), 'utf8')),
  );
  const body = sources.map(stripModuleSyntax).join('\n\n');
  return `(() => {\n"use strict";\n${body}\n})();`;
}

async function readStyles() {
  const sources = await Promise.all(
    styleFiles.map((fileName) => readFile(join(rootDirectory, 'src', fileName), 'utf8')),
  );
  return sources.join('\n');
}

export async function buildStandalone(options = {}) {
  const outputFile = typeof options === 'string' ? options : (options.outputPath ?? join(rootDirectory, artifactName));
  const [template, styles, application] = await Promise.all([
    readFile(join(rootDirectory, 'src', 'index.html'), 'utf8'),
    readStyles(),
    bundleApplication(),
  ]);
  const externalStylePattern = /\s*<link rel="stylesheet" href="\.\/(?:tokens|layout|components|responsive)\.css" \/>/g;
  const html = template
    .replace(externalStylePattern, '')
    .replace('</head>', `    <style>\n${escapeInlineBoundary(styles, 'style')}\n    </style>\n  </head>`)
    .replace(
      '<script type="module" src="./app.mjs"></script>',
      () => `<script>\n${escapeInlineBoundary(application, 'script')}\n    </script>`,
    )
    .replace(/\r\n/g, '\n');

  await writeFile(outputFile, html, 'utf8');
  return outputFile;
}

const invokedDirectly = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  const outputFile = await buildStandalone();
  process.stdout.write(`Built ${outputFile}\n`);
}
