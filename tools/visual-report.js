#!/usr/bin/env node
/* After a failed visual run, gathers each mismatched screenshot (committed, new, and the difference
   highlighted in red) into an output folder and writes a Markdown table for the pull request comment.
   Usage: node tools/visual-report.js <out-dir> <base-url-of-out-dir> <run-url>
   Writes <out-dir>/comment.md; prints the number of mismatches. Used by .github/workflows/ci.yml. */
'use strict';
const fs = require('fs');
const path = require('path');

const [outDir, baseUrl, runUrl] = process.argv.slice(2);
const results = path.join(__dirname, '..', 'test-results', 'visual');
fs.mkdirSync(outDir, { recursive: true });

const rows = [];
for (const dir of fs.existsSync(results) ? fs.readdirSync(results).sort() : []) {
  const full = path.join(results, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  for (const f of fs.readdirSync(full).filter((f) => f.endsWith('-actual.png')).sort()) {
    const name = f.replace(/-actual\.png$/, '');
    const project = /-(desktop|phone)(-retry\d+)?$/.exec(dir);
    const label = `${name} (${project ? project[1] : dir})`;
    const id = `${name}-${project ? project[1] : dir}`;
    const cell = (kind) => {
      const src = path.join(full, `${name}-${kind}.png`);
      if (!fs.existsSync(src)) return kind === 'expected' ? '_none committed yet_' : '';
      fs.copyFileSync(src, path.join(outDir, `${id}-${kind}.png`));
      return `<a href="${baseUrl}/${id}-${kind}.png"><img src="${baseUrl}/${id}-${kind}.png" width="260"></a>`;
    };
    rows.push(`| **${label}** | ${cell('expected')} | ${cell('actual')} | ${cell('diff')} |`);
  }
}

const body = rows.length === 0 ? [
  '<!-- visual-regression -->',
  '### Visual check failed before any screenshot differed',
  '',
  'A page did not load or raised a script error. See the [CI run](' + runUrl + ') for the message.',
].join('\n') : [
  '<!-- visual-regression -->',
  `### Visual check: ${rows.length} screenshot${rows.length === 1 ? '' : 's'} changed`,
  '',
  'Red in the last column marks the pixels that differ. Click an image for full size; the full report with a side-by-side slider is the `visual-report` artifact on the [CI run](' + runUrl + ').',
  '',
  '| View | Committed | This PR | Difference |',
  '| --- | --- | --- | --- |',
  ...rows,
  '',
  '**If the change is intended**, update the screenshots: run `npm run test:visual:update` and commit `tests/visual/screenshots/`, or add the label `update-screenshots` to this pull request and CI will commit them. If it is not intended, fix the code; this check stays red until the pictures match.',
].join('\n');
fs.writeFileSync(path.join(outDir, 'comment.md'), body + '\n');
console.log(rows.length);
