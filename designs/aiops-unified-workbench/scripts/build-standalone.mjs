import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const scriptPath = fileURLToPath(import.meta.url);
const prototypeRoot = path.resolve(path.dirname(scriptPath), '..');
const defaultOutputPath = path.join(prototypeRoot, 'NOVA-Ops-AI-Workbench-Standalone.html');
const styleFiles = [
  'tokens.css',
  'layout.css',
  'components-shell.css',
  'components-event.css',
  'components-lens.css',
  'components-ai.css',
];

export async function buildStandalone({ outputPath = defaultOutputPath } = {}) {
  const [sourceHtml, bundled, ...styles] = await Promise.all([
    readFile(path.join(prototypeRoot, 'index.html'), 'utf8'),
    build({
      bundle: true,
      entryPoints: [path.join(prototypeRoot, 'app.mjs')],
      format: 'iife',
      legalComments: 'none',
      minify: false,
      platform: 'browser',
      sourcemap: false,
      write: false,
    }),
    ...styleFiles.map((file) => readFile(path.join(prototypeRoot, 'styles', file), 'utf8')),
  ]);

  const css = styles.join('\n');
  const javascript = bundled.outputFiles[0].text.replaceAll('</script', '<\\/script');
  const withoutLinks = sourceHtml.replace(/\s*<link rel="stylesheet" href="\.\/styles\/[^"]+" \/>\r?\n?/g, '');
  const withStyles = withoutLinks.replace(
    '</head>',
    `    <!-- Portable single-file build: no network or localhost dependency. -->\n    <style>\n${css}\n    </style>\n  </head>`,
  );
  const standalone = withStyles.replace(
    '<script type="module" src="./app.mjs"></script>',
    `<script>\n${javascript}\n    </script>`,
  );

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, standalone, 'utf8');
  return outputPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await buildStandalone();
}
