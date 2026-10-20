#!/usr/bin/env node
/* Writes a single-file copy of the site with data.json, glossary.json, the CSS and the scripts inlined,
   for publishing somewhere that serves one HTML file (such as the Claude artifact link).
   Usage: node tools/bundle.js [OUT_DIR]   (default: ./dist; photos are copied to OUT_DIR/img/) */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist'));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const safe = s => s.replace(/<\//g, '<\\/');

let html = read('index.html');
html = html.replace('<link rel="stylesheet" href="assets/styles.css">', '<style>\n' + read('assets/styles.css') + '\n</style>');
html = html.replace('<!--INLINE-DATA-->',
  '<script type="application/json" id="sbtt-data">' + safe(JSON.stringify(JSON.parse(read('data.json')))) + '</script>\n' +
  '<script type="application/json" id="sbtt-glossary">' + safe(JSON.stringify(JSON.parse(read('glossary.json')))) + '</script>');
html = html.replace('<script src="assets/catalog.js"></script>', '<script>\n' + safe(read('assets/catalog.js')) + '\n</script>');
html = html.replace('<script src="assets/app.js"></script>', '<script>\n' + safe(read('assets/app.js')) + '\n</script>');

fs.mkdirSync(path.join(out, 'img'), { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
const used = new Set();
const data = JSON.parse(read('data.json'));
for (const e of data.entries) { if (e.img) used.add(e.img); for (const p of e.photos || []) used.add(p.key); }
const files = {};
for (const k of used) {
  const src = path.join(root, 'img', k + '.jpg');
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, path.join(out, 'img', k + '.jpg'));
  files['img/' + k + '.jpg'] = 'img/' + k + '.jpg';
}
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(files, null, 0));
console.log(`wrote ${path.join(out, 'index.html')} (${Math.round(html.length / 1024)} KB) and ${Object.keys(files).length} photos`);
