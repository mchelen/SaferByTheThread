#!/usr/bin/env node
/* Runs the visual regression tests in the pinned Playwright Docker image, the same renderer CI uses,
   so screenshots taken here match CI pixel for pixel. Extra arguments go to `playwright test`.
     node tools/visual.js                      compare against tests/visual/screenshots/
     node tools/visual.js --update-snapshots   rewrite the screenshots after an intended change
     node tools/visual.js --refresh-fixtures   copy data.json and glossary.json into the fixtures first
   Inside CI (VISUAL_NATIVE=1, already in that image) it runs Playwright directly. */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const IMAGE = 'mcr.microsoft.com/playwright:v' + require('@playwright/test/package.json').version + '-noble';
const root = path.join(__dirname, '..');
let args = process.argv.slice(2);

if (args.includes('--refresh-fixtures')) {
  args = args.filter((a) => a !== '--refresh-fixtures');
  for (const f of ['data.json', 'glossary.json']) fs.copyFileSync(path.join(root, f), path.join(root, 'tests/visual/fixtures', f));
  console.log('Copied data.json and glossary.json into tests/visual/fixtures/.');
}

const run = (cmd, a, opts) => spawnSync(cmd, a, Object.assign({ stdio: 'inherit', cwd: root }, opts)).status;

if (process.env.VISUAL_NATIVE) process.exit(run('npx', ['playwright', 'test', ...args]) ?? 1);

if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  console.error('Docker is not running, and the visual tests need it so screenshots match CI.\n' +
    'Start it (for example `sudo dockerd > /tmp/dockerd.log 2>&1 &`) and run this again, or let CI update\n' +
    'the screenshots: add the label "update-screenshots" to the pull request (see tests/visual/README.md).');
  process.exit(1);
}
const uid = typeof process.getuid === 'function' ? `${process.getuid()}:${process.getgid()}` : null;
process.exit(run('docker', ['run', '--rm', '--ipc=host', '-v', `${root}:/work`, '-w', '/work',
  ...(uid ? ['-u', uid, '-e', 'HOME=/tmp'] : []), '-e', 'VISUAL_NATIVE=1', IMAGE,
  'npx', 'playwright', 'test', ...args]) ?? 1);
