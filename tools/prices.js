#!/usr/bin/env node
/* Checks the store pages in data.json for their current prices.

   Usage: node tools/prices.js [--limit N] [--concurrency 4] [--write] [--report FILE]

   For every product URL it fetches the page and looks for a price in JSON-LD
   (Product / offers), Open Graph meta tags, itemprop="price" markup and, for
   Shopify-style URLs, the store's /products/<handle>.js(on) endpoint. It prints
   one line per product and a summary, writes a Markdown report with --report,
   and with --write updates the dollar amount in data.json (only when the
   recorded price text holds exactly one dollar amount and the found price is
   in USD) and stamps every product whose price was found with price_checked.

   Exit code is always 0; blocked or broken pages are reported, not fatal.
   Node 22, no dependencies. The extraction functions are exported for tests. */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('../assets/catalog.js');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const TIMEOUT_MS = 20000;
const HOST_DELAY_MS = 1500; // pause between two requests to the same host

// ---------- extraction (pure functions) ----------

function decodeEntities(s) {
  return String(s).replace(/&(#x([0-9a-f]+)|#(\d+)|amp|quot|apos|lt|gt|nbsp);/gi, function (m, _, hex, dec) {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (dec) return String.fromCodePoint(parseInt(dec, 10));
    return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[m.slice(1, -1).toLowerCase()];
  });
}

// "1,234.56" -> 1234.56; "29,95" -> 29.95; "USD 12" -> 12; junk -> null
function parseAmount(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).trim().replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (/,\d{1,2}$/.test(s) && !/\./.test(s)) s = s.replace(',', '.'); // European decimal comma
  s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function normCurrency(c) {
  if (!c) return null;
  const s = String(c).trim().toUpperCase();
  if (s === '$' || s === 'US$') return 'USD';
  return /^[A-Z]{3}$/.test(s) ? s : null;
}

// Attribute string of one tag -> {name: value}
function attrs(tag) {
  const out = {};
  const rx = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  const body = tag.replace(/^<[a-zA-Z][^\s/>]*/, '').replace(/\/?>$/, '');
  while ((m = rx.exec(body))) out[m[1].toLowerCase()] = decodeEntities(m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] != null ? m[4] : '');
  return out;
}

// All <script type="application/ld+json"> blocks, parsed; bad JSON is skipped.
function jsonLdBlocks(html) {
  const out = [];
  const rx = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = rx.exec(html))) {
    const text = m[1].replace(/^\s*<!--/, '').replace(/-->\s*$/, '').trim();
    try { out.push(JSON.parse(text)); } catch (e) { /* ignore broken block */ }
  }
  return out;
}

// Walks any JSON-LD shape (arrays, @graph, nested) and yields every object.
function* walkObjects(node, depth) {
  depth = depth || 0;
  if (depth > 12 || node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const x of node) yield* walkObjects(x, depth + 1); return; }
  yield node;
  for (const k of Object.keys(node)) if (node[k] && typeof node[k] === 'object') yield* walkObjects(node[k], depth + 1);
}

function hasType(node, type) {
  const t = node['@type'];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

// Lowest price in an offers value (Offer, AggregateOffer or array of them).
function offersPrice(offers) {
  let best = null;
  for (const o of walkObjects(offers)) {
    const cands = [];
    if (hasType(o, 'AggregateOffer') || o.lowPrice != null) cands.push(o.lowPrice);
    if (o.price != null) cands.push(o.price);
    if (o.priceSpecification && typeof o.priceSpecification === 'object') {
      for (const ps of walkObjects(o.priceSpecification)) if (ps.price != null) cands.push([ps.price, ps.priceCurrency]);
    }
    for (const c of cands) {
      const amount = parseAmount(Array.isArray(c) ? c[0] : c);
      const currency = normCurrency(Array.isArray(c) ? c[1] || o.priceCurrency : o.priceCurrency);
      if (amount == null || amount <= 0) continue;
      if (!best || amount < best.amount) best = { amount, currency };
    }
  }
  return best;
}

function findJsonLdPrice(html) {
  for (const block of jsonLdBlocks(html)) {
    for (const node of walkObjects(block)) {
      if (!(hasType(node, 'Product') || hasType(node, 'ProductGroup') || (node.offers && !node['@type']))) continue;
      const p = node.offers ? offersPrice(node.offers) : null;
      if (p) return Object.assign(p, { source: 'json-ld' });
    }
  }
  return null;
}

function metaTags(html) {
  const out = [];
  const rx = /<meta\b[^>]*>/gi;
  let m;
  while ((m = rx.exec(html))) out.push(attrs(m[0]));
  return out;
}

function findMetaPrice(html) {
  const tags = metaTags(html);
  const get = function (names) {
    for (const name of names) {
      for (const t of tags) {
        const key = (t.property || t.name || t.itemprop || '').toLowerCase();
        if (key === name && t.content != null && t.content !== '') return t.content;
      }
    }
    return null;
  };
  const amount = parseAmount(get(['product:price:amount', 'og:price:amount']));
  if (amount == null || amount <= 0) return null;
  return { amount, currency: normCurrency(get(['product:price:currency', 'og:price:currency'])), source: 'meta' };
}

function findItempropPrice(html) {
  const rx = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\bitemprop\s*=\s*["']?price["']?[^>]*>/gi;
  let m, best = null;
  while ((m = rx.exec(html))) {
    const a = attrs(m[0]);
    let raw = a.content;
    if (raw == null || raw === '') {
      const rest = html.slice(m.index + m[0].length);
      const close = rest.search(new RegExp('</' + m[1] + '\\s*>', 'i'));
      raw = rest.slice(0, close < 0 ? 200 : Math.min(close, 200)).replace(/<[^>]*>/g, '');
      raw = decodeEntities(raw);
    }
    const amount = parseAmount(raw);
    if (amount == null || amount <= 0) continue;
    if (!best || amount < best.amount) best = amount;
  }
  if (best == null) return null;
  const cur = html.match(/\bitemprop\s*=\s*["']?priceCurrency["']?[^>]*\bcontent\s*=\s*["']?([A-Za-z]{3})/i)
    || html.match(/\bcontent\s*=\s*["']?([A-Za-z]{3})["']?[^>]*\bitemprop\s*=\s*["']?priceCurrency/i);
  return { amount: best, currency: normCurrency(cur && cur[1]), source: 'itemprop' };
}

// Price from an HTML document, in order of trust.
function extractPrice(html) {
  if (!html) return null;
  return findJsonLdPrice(html) || findMetaPrice(html) || findItempropPrice(html) || null;
}

// The store currency a Shopify theme usually prints: Shopify.currency = {"active":"USD",...}
function findShopifyCurrency(html) {
  if (!html) return null;
  const m = html.match(/Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Za-z]{3})"/)
    || html.match(/"shop_currency"\s*:\s*"([A-Za-z]{3})"/)
    || html.match(/<meta\b[^>]*property\s*=\s*["']og:price:currency["'][^>]*content\s*=\s*["']([A-Za-z]{3})["']/i);
  return normCurrency(m && m[1]);
}

// Lowest variant price in a Shopify /products/<handle>.js response (cents) or
// .json response ({product: {variants: [{price: "29.95"}]}}). Prefers variants
// that are available when any are.
function parseShopifyProduct(obj) {
  const product = obj && obj.product ? obj.product : obj;
  if (!product || !Array.isArray(product.variants) || !product.variants.length) return null;
  const cents = !(obj && obj.product); // .js gives integer cents, .json gives decimal strings
  const toAmount = function (v) {
    const n = parseAmount(v.price);
    if (n == null) return null;
    return cents ? n / 100 : n;
  };
  const pick = function (list) {
    let best = null;
    for (const v of list) { const n = toAmount(v); if (n != null && n > 0 && (best == null || n < best)) best = n; }
    return best;
  };
  const avail = product.variants.filter(function (v) { return v.available !== false; });
  const amount = pick(avail.length ? avail : product.variants) ?? pick(product.variants);
  if (amount == null) return null;
  return { amount, currency: null, source: cents ? 'shopify.js' : 'shopify.json' };
}

// "https://shop.example.com/collections/x/products/my-toy?variant=1" -> {origin, handle}
function shopifyHandle(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/products\/([^/?#]+?)(?:\.js|\.json)?\/?$/);
    return m ? { origin: u.origin, handle: decodeURIComponent(m[1]) } : null;
  } catch (e) { return null; }
}

// ---------- comparison and rewriting ----------

const DOLLAR_RX = /\$[\d,]+(?:\.\d+)?/g;
const FOREIGN_RX = /£|€|NZ\$|CAD ?\$/;

function formatAmount(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// Significant when the found USD amount differs by more than 2% and more than $1.
function isSignificant(recordedUsd, foundUsd) {
  const diff = Math.abs(foundUsd - recordedUsd);
  return diff > 1 && diff > recordedUsd * 0.02;
}

// Status of one product given the recorded text and the extracted price.
//   found: {amount, currency} | null; fetchError: string | null
function compare(priceText, found, fetchError) {
  const parsed = S.parsePrice(priceText);
  const recordedUsd = parsed ? parsed.usd : null;
  if (!found) return { status: fetchError ? 'error' : 'not found', detail: fetchError || '', recordedUsd };
  let currency = found.currency;
  let assumed = false;
  // A page that names no currency is taken as USD when the recorded text is in plain dollars.
  if (!currency && recordedUsd != null && !FOREIGN_RX.test(priceText || '')) { currency = 'USD'; assumed = true; }
  if (currency !== 'USD') return { status: 'other currency', detail: '', recordedUsd, currency };
  if (recordedUsd == null) return { status: 'changed', detail: 'no recorded amount', recordedUsd, currency, assumed };
  // Same when the page agrees with any dollar amount in the text ("$185; $140.99 on sale at Babylist").
  const amounts = FOREIGN_RX.test(priceText || '') ? [recordedUsd] : dollarAmounts(priceText);
  const changed = amounts.every(function (a) { return isSignificant(a, found.amount); });
  return { status: changed ? 'changed' : 'same', detail: '', recordedUsd, currency, assumed };
}

// Every dollar amount in a recorded price text, shipping surcharges excluded.
function dollarAmounts(priceText) {
  const t = String(priceText || '').replace(/plus \$[\d,.]+ shipping/ig, '');
  return (t.match(DOLLAR_RX) || []).map(function (s) { return parseFloat(s.slice(1).replace(/,/g, '')); });
}

// Replaces the single dollar amount in a recorded price text; null when the text
// has none or more than one, or names a foreign currency.
function replaceAmount(priceText, foundUsd) {
  if (FOREIGN_RX.test(priceText)) return null;
  const all = priceText.match(DOLLAR_RX) || [];
  if (all.length !== 1) return null;
  return priceText.replace(DOLLAR_RX, '$' + formatAmount(foundUsd));
}

// ---------- fetching ----------

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

const RETRY_DELAY_MS = 6000; // one retry after a 429 or 5xx

async function fetchOnce(url, accept) {
  const res = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text, url: res.url };
}

async function fetchText(url, accept) {
  const r = await fetchOnce(url, accept);
  if (r.status === 429 || r.status >= 500) { await sleep(RETRY_DELAY_MS); return fetchOnce(url, accept); }
  return r;
}

function errorLabel(e) {
  if (!e) return 'error';
  if (e.name === 'TimeoutError' || e.name === 'AbortError') return 'timeout';
  const cause = e.cause && (e.cause.code || e.cause.message);
  return cause ? String(cause) : (e.message || String(e));
}

// One product: page first, then the Shopify endpoints when the page gave nothing.
async function checkProduct(product, wait) {
  const result = { found: null, fetchError: null, http: null, notes: [] };
  let html = '';
  try {
    await wait(product.url);
    const r = await fetchText(product.url);
    result.http = r.status;
    const moved = movedAway(product.url, r.url);
    if (moved) result.notes.push('redirected to ' + r.url);
    if (r.ok) {
      html = r.text;
      // A home page may carry structured data for some featured product; never take that.
      result.found = moved && isHomePage(r.url) ? null : extractPrice(html);
      if (result.found && !result.found.currency) result.found.currency = findShopifyCurrency(html);
    } else result.fetchError = 'HTTP ' + r.status;
  } catch (e) { result.fetchError = errorLabel(e); }

  if (!result.found) {
    const sh = shopifyHandle(product.url);
    if (sh) {
      for (const ext of ['.js', '.json']) {
        const u = sh.origin + '/products/' + encodeURIComponent(sh.handle) + ext;
        try {
          await wait(u);
          const r = await fetchText(u, 'application/json,*/*;q=0.5');
          if (!r.ok) { result.notes.push(ext + ' HTTP ' + r.status); continue; }
          const p = parseShopifyProduct(JSON.parse(r.text));
          if (p) { p.currency = findShopifyCurrency(html); result.found = p; result.fetchError = null; break; }
          result.notes.push(ext + ' no variants');
        } catch (e) { result.notes.push(ext + ' ' + errorLabel(e)); }
      }
    }
  }
  return result;
}

// True when the store sent us somewhere else (home page, collection), which
// usually means the product page is gone.
function movedAway(requested, final) {
  if (!final || final === requested) return false;
  try {
    const a = new URL(requested), b = new URL(final);
    const strip = function (p) { return p.replace(/\/+$/, '').toLowerCase(); };
    if (strip(a.pathname) === strip(b.pathname)) return false;
    const sa = shopifyHandle(requested), sb = shopifyHandle(final);
    if (sa && sb && sa.handle === sb.handle) return false;
    return true;
  } catch (e) { return false; }
}

function isHomePage(url) {
  try { return /^\/?$/.test(new URL(url).pathname); } catch (e) { return false; }
}

// Serialises requests per host with a pause between them.
function hostWaiter(delayMs) {
  const last = new Map();
  const chains = new Map();
  return function (url) {
    let host;
    try { host = new URL(url).host; } catch (e) { host = url; }
    const prev = chains.get(host) || Promise.resolve();
    const next = prev.then(async function () {
      const t = last.get(host);
      if (t != null) { const gap = delayMs - (Date.now() - t); if (gap > 0) await sleep(gap); }
      last.set(host, Date.now());
    });
    chains.set(host, next.catch(function () {}));
    return next;
  };
}

// Interleaves products across hosts so the pool rarely blocks on one store.
function interleaveByHost(items) {
  const groups = new Map();
  for (const it of items) {
    let host; try { host = new URL(it.product.url).host; } catch (e) { host = it.product.url; }
    if (!groups.has(host)) groups.set(host, []);
    groups.get(host).push(it);
  }
  const out = [];
  const lists = Array.from(groups.values());
  while (out.length < items.length) for (const l of lists) if (l.length) out.push(l.shift());
  return out;
}

async function runPool(items, concurrency, fn) {
  let i = 0;
  const workers = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push((async function () {
      while (i < items.length) { const it = items[i++]; await fn(it); }
    })());
  }
  await Promise.all(workers);
}

// ---------- report ----------

function cell(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' '); }
function money(n, cur) {
  if (n == null) return '—';
  const amount = formatAmount(Math.round(n * 100) / 100);
  if (!cur || cur === '???') return amount + ' (currency unknown)';
  return (cur === 'USD' ? '$' : cur + ' ') + amount;
}

function buildReport(rows, date) {
  const count = function (st) { return rows.filter(function (r) { return r.status === st; }).length; };
  const changed = rows.filter(function (r) { return r.status === 'changed'; });
  const other = rows.filter(function (r) { return r.status === 'other currency'; });
  const bad = rows.filter(function (r) { return r.status === 'not found' || r.status === 'error'; });
  const found = rows.length - bad.length;
  const lines = [];
  lines.push('# Price check: ' + date, '');
  lines.push('Checked ' + rows.length + ' products: ' + found + ' prices found, ' + count('changed') + ' changed, '
    + count('not found') + ' not found, ' + count('error') + ' errors.', '');
  lines.push('## Changes', '');
  if (!changed.length) lines.push('No price changed by more than 2% and $1.', '');
  else {
    lines.push('| Listing | Product | Store | Recorded | Found | Source | New text |', '|---|---|---|---|---|---|---|');
    for (const r of changed) lines.push('| ' + [r.entry, '[' + cell(r.product.name) + '](' + r.product.url + ')', r.product.store,
      cell(r.product.price) + (r.recordedUsd != null ? ' (' + money(r.recordedUsd, 'USD') + ')' : ''),
      money(r.found.amount, 'USD') + (r.assumed ? ' (currency assumed)' : ''), r.found.source, r.newText ? cell(r.newText) : '(left alone)'].map(cell).join(' | ') + ' |');
    lines.push('');
  }
  if (other.length) {
    lines.push('## Prices in other currencies', '', '| Listing | Product | Store | Recorded | Found | Source |', '|---|---|---|---|---|---|');
    for (const r of other) lines.push('| ' + [r.entry, '[' + cell(r.product.name) + '](' + r.product.url + ')', r.product.store, cell(r.product.price),
      money(r.found.amount, r.found.currency), r.found.source].map(cell).join(' | ') + ' |');
    lines.push('');
  }
  lines.push('## Not found or errored', '');
  if (!bad.length) lines.push('Every page gave a price.', '');
  else {
    lines.push('| Listing | Product | Store | Status |', '|---|---|---|---|');
    for (const r of bad) lines.push('| ' + [r.entry, '[' + cell(r.product.name) + '](' + r.product.url + ')', r.product.store,
      r.status + (r.detail ? ': ' + r.detail : '') + (r.notes.length ? ' (' + r.notes.join('; ') + ')' : '')].map(cell).join(' | ') + ' |');
    lines.push('');
  }
  return lines.join('\n');
}

// ---------- main ----------

function parseArgs(argv) {
  const opts = { limit: 0, concurrency: 4, write: false, report: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') opts.limit = parseInt(argv[++i], 10) || 0;
    else if (a === '--concurrency') opts.concurrency = Math.max(1, parseInt(argv[++i], 10) || 4);
    else if (a === '--write') opts.write = true;
    else if (a === '--report') opts.report = argv[++i] || '';
    else if (a === '--help' || a === '-h') { console.log('Usage: node tools/prices.js [--limit N] [--concurrency 4] [--write] [--report FILE]'); process.exit(0); }
    else { console.error('unknown argument ' + a); process.exit(2); }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = path.join(__dirname, '..');
  const file = path.join(root, 'data.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);

  let items = [];
  for (const g of data.groups) for (const c of g.categories) for (const e of c.entries) for (const p of e.products) items.push({ entry: e.id, product: p });
  if (opts.limit) items = items.slice(0, opts.limit);
  const order = interleaveByHost(items);
  const wait = hostWaiter(HOST_DELAY_MS);

  const rows = [];
  await runPool(order, opts.concurrency, async function (it) {
    const r = await checkProduct(it.product, wait);
    const c = compare(it.product.price, r.found, r.fetchError);
    const row = Object.assign({ entry: it.entry, product: it.product, found: r.found, notes: r.notes, http: r.http, newText: null }, c);
    rows.push(row);
    const tag = row.status.toUpperCase().padEnd(14);
    const what = r.found ? money(r.found.amount, row.currency || r.found.currency) + ' via ' + r.found.source : (row.detail || '');
    console.log(tag + ' ' + it.entry + ' · ' + it.product.store + ' · "' + it.product.price + '" -> ' + what);
  });
  rows.sort(function (a, b) { return items.findIndex(function (i) { return i.product === a.product; }) - items.findIndex(function (i) { return i.product === b.product; }); });

  let textChanges = 0;
  for (const r of rows) {
    const got = r.status === 'same' || r.status === 'changed' || r.status === 'other currency';
    if (!got) continue;
    if (r.status === 'changed' && r.currency === 'USD') {
      const t = replaceAmount(r.product.price, r.found.amount);
      if (t && t !== r.product.price) { r.newText = t; textChanges++; }
    }
    if (opts.write) {
      if (r.newText) r.product.price = r.newText;
      r.product.price_checked = today;
    }
  }
  if (opts.write) {
    if (textChanges) data.updated = today;
    fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
  }

  const report = buildReport(rows, today);
  if (opts.report) fs.writeFileSync(opts.report, report);
  console.log('');
  console.log(report.split('\n')[2]);
  if (opts.write) console.log((textChanges ? textChanges + ' price text(s) updated' : 'no price text updated') + '; price_checked stamped on products whose price was found; data.json written');
  if (opts.report) console.log('report written to ' + opts.report);
}

module.exports = {
  decodeEntities, parseAmount, normCurrency, attrs, jsonLdBlocks, findJsonLdPrice, findMetaPrice, findItempropPrice,
  extractPrice, findShopifyCurrency, parseShopifyProduct, shopifyHandle, isSignificant, compare, replaceAmount, dollarAmounts, movedAway, isHomePage,
  formatAmount, buildReport, interleaveByHost, hostWaiter
};

if (require.main === module) {
  main().catch(function (e) { console.error('price check failed:', e && e.stack || e); process.exit(0); });
}
