#!/usr/bin/env node
/* Saves the readable text of a product's pages, so material claims can be quoted from it and checked word for word.
   Usage: node tools/snapshot.js <listing-id> <url> [<url> ...]
   Writes research/snapshots/<listing-id>.txt: for each URL a header (URL, date fetched) and the page's visible text,
   plus the product description from JSON-LD and, on Shopify stores, from /products/<handle>.json (often the only
   place the description is in the HTML the server sends). Prints the path and the size. Exit code 1 when no page
   could be read. */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./prices.js');

const DIR = path.join(__dirname, '..', 'research', 'snapshots');

function descriptions(html) {
  const out = [];
  for (const block of P.jsonLdBlocks(html)) for (const node of P.walkObjects(block)) {
    if ((P.hasType(node, 'Product') || P.hasType(node, 'ProductGroup')) && typeof node.description === 'string') out.push(P.visibleText(node.description).trim());
  }
  return out;
}

// One page as text: visible text first, then descriptions the visible text may lack.
async function pageText(url) {
  const r = await P.fetchText(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const parts = [P.visibleText(r.text).trim()];
  descriptions(r.text).forEach((d) => { if (d && parts[0].indexOf(d.slice(0, 80)) < 0) parts.push(d); });
  const sh = P.shopifyHandle(url);
  if (sh) {
    try {
      const j = await P.fetchText(sh.origin + '/products/' + encodeURIComponent(sh.handle) + '.json', 'application/json');
      if (j.ok) {
        const p = JSON.parse(j.text).product || {};
        const body = P.visibleText(p.body_html || '').trim();
        if (body && parts.join(' ').indexOf(body.slice(0, 80)) < 0) parts.push(body);
        const opts = (p.variants || []).map((v) => v.title).filter((t) => t && t !== 'Default Title');
        if (opts.length) parts.push('Options: ' + opts.join(' | '));
      }
    } catch (e) { /* the page text is enough */ }
  }
  return { url: r.url || url, text: parts.join('\n\n') };
}

async function snapshot(id, urls) {
  const today = new Date().toISOString().slice(0, 10);
  const blocks = [];
  for (const u of urls) {
    try {
      const p = await pageText(u);
      blocks.push('=== URL: ' + u + (p.url !== u ? ' (served from ' + p.url + ')' : '') + '\n=== Fetched: ' + today + '\n\n' + p.text);
    } catch (e) {
      blocks.push('=== URL: ' + u + '\n=== Fetched: ' + today + '\n=== Not read: ' + P.errorLabel(e));
    }
  }
  return blocks.join('\n\n');
}

async function main() {
  const [id, ...urls] = process.argv.slice(2);
  if (!id || !urls.length || !/^[a-z0-9-]+$/.test(id)) { console.error('usage: node tools/snapshot.js <listing-id> <url> [<url> ...]'); process.exit(2); }
  const text = await snapshot(id, urls);
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, id + '.txt');
  fs.writeFileSync(file, text + '\n');
  const read = (text.match(/^=== URL:/gm) || []).length - (text.match(/^=== Not read:/gm) || []).length;
  console.log(path.relative(process.cwd(), file) + ': ' + read + ' of ' + urls.length + ' pages, ' + text.length + ' characters');
  process.exit(read ? 0 : 1);
}

module.exports = { snapshot, descriptions };
if (require.main === module) main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
