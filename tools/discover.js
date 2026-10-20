#!/usr/bin/env node
/* Finds products the catalog doesn't list yet on the stores in research/watchlist.json and queues them in
   research/candidates.json for the daily research session to read.
   Usage: node tools/discover.js [--only <brand>] [--write] [--report FILE]
   Shopify stores are read from /products.json, WooCommerce stores from the Store API, anything else from its
   sitemap. A product is queued only when its title or the store's product type matches a product type's `match`
   pattern in data.json, so adult clothing, gift cards and the like stay out. Product URLs already in data.json, already
   queued, or in research/rejected.json are skipped. Exit code is always 0; unreachable stores are reported. */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./prices.js');

const ROOT = path.join(__dirname, '..');
const R = (f) => path.join(ROOT, 'research', f);
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const PAGE_LIMIT = 4;     // pages of 250 Shopify products, or 100 WooCommerce products, per store
const SKIP = /gift ?card|e-?gift|bundle builder|sample|swatch|replacement part|spare|warranty|shipping protection|mystery/i;

function normUrl(u) {
  try { const x = new URL(u); return (x.host.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase(); } catch (e) { return String(u).toLowerCase(); }
}

// The product type whose `match` pattern matches the title best: the longest match wins ("car seat" over "car"), and
// the store's product type and tags are only consulted when the title matches nothing.
function guessType(types, title, extra) {
  for (const text of [String(title || ''), String(extra || '')]) {
    let best = null, len = 0;
    for (const t of types) {
      if (!t.match) continue;
      const m = text.match(new RegExp(t.match, 'i'));
      if (m && m[0].length > len) { best = t.id; len = m[0].length; }
    }
    if (best) return best;
  }
  return null;
}

async function getJson(url, wait) {
  await wait(url);
  const r = await P.fetchText(url, 'application/json');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return JSON.parse(r.text);
}

async function shopify(store, wait) {
  const out = [];
  for (let page = 1; page <= PAGE_LIMIT; page++) {
    const j = await getJson(store.replace(/\/$/, '') + '/products.json?limit=250&page=' + page, wait);
    const list = j.products || [];
    for (const p of list) {
      out.push({ url: store.replace(/\/$/, '') + '/products/' + p.handle, title: p.title, extra: [p.product_type, (p.tags || []).join(' ')].join(' | '), available: (p.variants || []).some((v) => v.available !== false) });
    }
    if (list.length < 250) break;
  }
  return out;
}

async function woo(store, wait) {
  const out = [];
  for (let page = 1; page <= PAGE_LIMIT; page++) {
    const list = await getJson(store.replace(/\/$/, '') + '/wp-json/wc/store/v1/products?per_page=100&page=' + page, wait);
    for (const p of list) out.push({ url: p.permalink, title: P.decodeEntities(p.name || ''), extra: (p.categories || []).map((c) => c.name).join(' '), available: p.is_in_stock !== false });
    if (list.length < 100) break;
  }
  return out;
}

async function sitemap(store, wait) {
  const seen = new Set(), out = [];
  const queue = [store.replace(/\/$/, '') + '/sitemap.xml'];
  while (queue.length && seen.size < 12) {
    const u = queue.shift();
    if (seen.has(u)) continue;
    seen.add(u);
    await wait(u);
    const r = await P.fetchText(u, 'application/xml,text/xml');
    if (!r.ok) continue;
    const locs = Array.from(r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => P.decodeEntities(m[1]));
    if (/<sitemapindex/i.test(r.text)) locs.filter((l) => /product/i.test(l)).forEach((l) => queue.push(l));
    else locs.filter((l) => /\/products?\//i.test(l)).forEach((l) => out.push({ url: l, title: decodeURIComponent(l.replace(/\/+$/, '').split('/').pop()).replace(/[-_]+/g, ' '), extra: '', available: true }));
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const opt = { write: args.includes('--write'), only: args.includes('--only') ? args[args.indexOf('--only') + 1] : null, report: args.includes('--report') ? args[args.indexOf('--report') + 1] : null };
  const data = readJson(path.join(ROOT, 'data.json'), null);
  const watch = readJson(R('watchlist.json'), { stores: [] });
  const queue = readJson(R('candidates.json'), { candidates: [] });
  const rejected = readJson(R('rejected.json'), { rejected: [] });
  const known = new Set();
  data.entries.forEach((e) => e.products.forEach((p) => known.add(normUrl(p.url))));
  queue.candidates.forEach((c) => known.add(normUrl(c.url)));
  rejected.rejected.forEach((c) => known.add(normUrl(c.url)));
  const today = new Date().toISOString().slice(0, 10);
  const wait = P.hostWaiter(1500);
  const rows = [];
  let added = 0;
  const stores = watch.stores.filter((s) => !opt.only || s.brand === opt.only);
  await Promise.all(stores.map(async (s) => {
    const row = { brand: s.brand, store: s.store, found: 0, added: 0, error: null };
    try {
      const list = s.platform === 'shopify' ? await shopify(s.store, wait) : s.platform === 'woocommerce' ? await woo(s.store, wait) : await sitemap(s.store, wait);
      row.found = list.length;
      for (const p of list) {
        if (!p.url || SKIP.test(p.title) || known.has(normUrl(p.url))) continue;
        const type = guessType(data.types, p.title, p.extra);
        if (!type) continue;
        known.add(normUrl(p.url));
        queue.candidates.push({ url: p.url, brand: s.brand, title: p.title, type, source: 'watchlist', first_seen: today, status: p.available ? 'new' : 'unavailable' });
        row.added++; added++;
      }
    } catch (e) { row.error = P.errorLabel(e); }
    rows.push(row);
    console.log((row.error ? 'FAILED ' : 'ok     ') + s.brand + ' · ' + (row.error || row.found + ' products, ' + row.added + ' new in scope'));
  }));
  if (opt.write) fs.writeFileSync(R('candidates.json'), JSON.stringify(queue, null, 1) + '\n');
  const waiting = queue.candidates.filter((c) => c.status === 'new').length;
  const report = ['# Product discovery', '', `${stores.length} stores read; ${added} new products queued; ${waiting} waiting to be read.`, '',
    '| Store | Products | New in scope | Problem |', '|---|---|---|---|']
    .concat(rows.sort((a, b) => a.brand.localeCompare(b.brand)).map((r) => `| ${r.brand} | ${r.found} | ${r.added} | ${r.error || ''} |`)).join('\n') + '\n';
  if (opt.report) fs.writeFileSync(opt.report, report);
  console.log(report.split('\n')[2]);
}

module.exports = { guessType, normUrl };
if (require.main === module) main().catch((e) => { console.error('discovery failed:', e && e.stack || e); process.exit(0); });
