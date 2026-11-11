'use strict';
/* tools/prerender.js writes a real page per address so search engines get a 200, a title, a description,
   a share preview and structured data instead of the 404 hand-off. Runs it on a copy of the site. */
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { build } = require('../../tools/prerender.js');

const root = path.join(__dirname, '..', '..');
const SITE = 'https://example.github.io/Repo/';
let dir, written, data;
const read = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const lds = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-'));
  for (const f of ['index.html', 'data.json', 'glossary.json']) fs.copyFileSync(path.join(root, f), path.join(dir, f));
  data = JSON.parse(read('data.json'));
  written = build(dir, SITE);
});

test('every listing, product type, department, brand, material and glossary term gets a page', () => {
  for (const e of data.entries) assert.ok(fs.existsSync(path.join(dir, 'p', e.id + '.html')), e.id);
  for (const p of ['/', '/shop', '/brands', '/about', '/m', '/glossary', '/a/toys', '/m/wood', '/glossary/plastic']) assert.ok(written.includes(p), p);
  assert.ok(fs.existsSync(path.join(dir, 'm', 'index.html')) && fs.existsSync(path.join(dir, 'glossary', 'index.html')));
});

test('a product page has its own title, description, canonical address, share preview and structured data', () => {
  const e = data.entries[0];
  const h = read('p/' + e.id + '.html');
  assert.match(h, new RegExp('<title>' + (e.brand + ' ' + e.line).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;') + ' · Saved by the Thread</title>'));
  assert.equal((h.match(/<link rel="canonical"/g) || []).length, 1);
  assert.match(h, new RegExp('<link rel="canonical" href="' + SITE + 'p/' + e.id + '">'));
  assert.match(h, /<meta property="og:image" content="https:\/\/example\.github\.io\/Repo\/img\/[^"]+\.jpg">/);
  const desc = h.match(/<meta name="description" content="([^"]*)">/)[1];
  assert.ok(desc.length <= 170 && desc.length > 40, desc);
  const types = lds(h).map((o) => o['@type']);
  assert.deepEqual(types, ['Product', 'BreadcrumbList']);
  assert.equal(lds(h)[0].brand.name, e.brand);
  // The page's text is in the file, not only drawn by the script.
  assert.match(h, /<main id="main" tabindex="-1">[\s\S]*<h1>[\s\S]*Made with/);
});

test('files in folders load the site with absolute addresses, and shell links carry the base path', () => {
  const h = read('p/' + data.entries[0].id + '.html');
  assert.match(h, /<script src="\/Repo\/assets\/app\.js">/);
  assert.match(h, /<link rel="stylesheet" href="\/Repo\/assets\/styles\.css">/);
  assert.match(h, /<a href="\/Repo\/about" data-link>/);
  assert.doesNotMatch(h, /(href|src)="(assets|data\.json)/);
  assert.doesNotMatch(h, /\/Repo\/Repo\//);
});

test('listing pages carry an ItemList of their products', () => {
  const list = lds(read('c/' + data.entries[0].type + '.html')).find((o) => o['@type'] === 'ItemList');
  assert.ok(list.itemListElement.length >= 1);
  assert.match(list.itemListElement[0].url, /^https:\/\/example\.github\.io\/Repo\/p\//);
});

test('sitemap lists every page once; robots.txt points at it', () => {
  const xml = read('sitemap.xml');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, written.length);
  assert.equal(new Set(locs).size, locs.length);
  assert.ok(locs.includes(SITE) && locs.includes(SITE + 'p/' + data.entries[0].id));
  assert.match(read('robots.txt'), /Sitemap: https:\/\/example\.github\.io\/Repo\/sitemap\.xml/);
});

test('running it again gives the same files', () => {
  const before = read('index.html');
  build(dir, SITE);
  assert.equal(read('index.html'), before);
});
