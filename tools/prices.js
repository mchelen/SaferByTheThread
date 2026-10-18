#!/usr/bin/env node
/* Checks the store pages in data.json for their current prices.

   Usage: node tools/prices.js [--limit N] [--only id,id] [--concurrency 4] [--write] [--report FILE]

   For every product URL it fetches the page and looks for a price in JSON-LD
   (Product / offers), Open Graph meta tags, itemprop="price" markup and, for
   Shopify-style URLs, the store's /products/<handle>.js(on) endpoint. When a
   page sells several sizes or options at different prices, pickVariant works
   out which one the recorded product means (a ?variant= id in the URL, the
   product's `variant` hint, words shared with the product name, or the variant
   priced as recorded); when it cannot, the product is reported as "needs a
   look" and nothing is rewritten. It prints one line per product and a
   summary, writes a Markdown report with --report, and with --write updates
   the dollar amount in data.json (only when the recorded price text holds
   exactly one dollar amount and the found price is in USD) and stamps every
   product whose price was found with price_checked.

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

// Every priced offer in the page's JSON-LD with the name the store gives it:
// the offer's name or SKU, the item it offers, or the variant Product's own
// name inside a ProductGroup. An AggregateOffer contributes its low and high.
function jsonLdOffers(html) {
  const out = [];
  const seen = new Set();
  const done = new Set(); // offer objects already read (a variant Product is also walked on its own)
  const add = function (amount, currency, title) {
    amount = parseAmount(amount);
    if (amount == null || amount <= 0) return;
    const key = amount + '|' + (currency || '') + '|' + (title || '');
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ amount, currency: normCurrency(currency), title: String(title || '').trim() });
  };
  const fromOffers = function (offers, fallbackTitle) {
    for (const o of walkObjects(offers)) {
      if (done.has(o)) continue;
      done.add(o);
      const title = o.name || o.sku || (o.itemOffered && o.itemOffered.name) || fallbackTitle || '';
      if (hasType(o, 'AggregateOffer') || o.lowPrice != null) {
        add(o.lowPrice, o.priceCurrency, title);
        if (o.highPrice != null) add(o.highPrice, o.priceCurrency, title);
      }
      if (o.price != null) add(o.price, o.priceCurrency, title);
      if (o.priceSpecification && typeof o.priceSpecification === 'object') {
        for (const ps of walkObjects(o.priceSpecification)) if (ps.price != null) add(ps.price, ps.priceCurrency || o.priceCurrency, title);
      }
    }
  };
  for (const block of jsonLdBlocks(html)) {
    for (const node of walkObjects(block)) {
      if (hasType(node, 'ProductGroup') && Array.isArray(node.hasVariant)) {
        for (const v of node.hasVariant) if (v && v.offers) fromOffers(v.offers, [v.name, v.size, v.color].filter(Boolean).join(' '));
      }
      if (!(hasType(node, 'Product') || hasType(node, 'ProductGroup') || (node.offers && !node['@type']))) continue;
      if (node.offers) fromOffers(node.offers, [node.size, node.color].filter(Boolean).join(' '));
    }
    if (out.length) break; // the first block that prices the product is the product's
  }
  return out;
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
  const variants = shopifyVariants(obj);
  if (!variants.length) return null;
  const pick = function (list) {
    let best = null;
    for (const v of list) if (best == null || v.amount < best) best = v.amount;
    return best;
  };
  const avail = variants.filter(function (v) { return v.available !== false; });
  return { amount: pick(avail.length ? avail : variants), currency: null, source: variants[0].source };
}

// Every priced variant in a Shopify product response: {id, title, amount, available, source}.
function shopifyVariants(obj) {
  const product = obj && obj.product ? obj.product : obj;
  if (!product || !Array.isArray(product.variants)) return [];
  const cents = !(obj && obj.product); // .js gives integer cents, .json gives decimal strings
  const out = [];
  for (const v of product.variants) {
    const n = parseAmount(v.price);
    if (n == null || n <= 0) continue;
    const title = v.title || [v.option1, v.option2, v.option3].filter(Boolean).join(' / ');
    out.push({ id: v.id, title: String(title || ''), amount: cents ? n / 100 : n, available: v.available !== false, source: cents ? 'shopify.js' : 'shopify.json' });
  }
  return out;
}

// ---------- which variant is the recorded product? ----------

const STOP_WORDS = new Set(['in', 'inch', 'inches', 'cm', 'and', 'or', 'the', 'of', 'with', 'for', 'size', 'sizes', 'mths', 'months', 'month', 'a']);

// Words worth matching between a variant title and a product name: folded,
// dimensions joined ("28 x 52" -> "28x52"), ranges kept ("3-5"), stop words out.
function nameTokens(s) {
  const t = S.fold(String(s || '')).replace(/(\d)\s*[x×]\s*(\d)/g, '$1x$2');
  return t.split(/[^a-z0-9.\-]+/).map(function (w) { return w.replace(/^[.\-]+|[.\-]+$/g, ''); })
    .filter(function (w) { return w && !STOP_WORDS.has(w); });
}

function distinctAmounts(list) {
  const seen = new Set();
  list.forEach(function (v) { seen.add(Math.round(v.amount * 100)); });
  return seen.size;
}

// Picks, from the priced variants a page offers, the one the recorded product
// means. In order: all variants cost the same; a ?variant=<id> in the product
// URL; the product's `variant` hint found in a title; the variants whose titles
// share the most words with the product name ("Crib", "Soft Sole", "16x32");
// the variants priced as the recorded text says. A rule only decides when every
// variant it picks has the same price. Returns {variant, how} with variant null
// when nothing decides ('ambiguous').
function pickVariant(variants, product) {
  const priced = (variants || []).filter(function (v) { return v.amount != null && v.amount > 0; });
  if (!priced.length) return null;
  const settle = function (hits, how) { return hits.length && distinctAmounts(hits) === 1 ? { variant: hits[0], how } : null; };
  if (distinctAmounts(priced) === 1) return { variant: priced[0], how: 'one price' };
  const url = String((product && product.url) || '');
  const idm = /[?&]variant=(\d+)/.exec(url);
  if (idm) {
    const r = settle(priced.filter(function (v) { return String(v.id) === idm[1]; }), 'url');
    if (r) return r;
  }
  if (product && product.variant) {
    const want = S.fold(product.variant).replace(/(\d)\s*[x×]\s*(\d)/g, '$1x$2');
    const hits = priced.filter(function (v) { return S.fold(v.title).replace(/(\d)\s*[x×]\s*(\d)/g, '$1x$2').indexOf(want) >= 0; });
    const r = settle(hits, 'hint');
    if (r) return r;
    return { variant: null, how: hits.length ? 'hint matches several prices' : 'hint matches nothing', count: distinctAmounts(priced) };
  }
  const words = new Set(nameTokens(product && product.name));
  let best = 0, hits = [];
  for (const v of priced) {
    const score = nameTokens(v.title).filter(function (w) { return words.has(w); }).length;
    if (score > best) { best = score; hits = [v]; } else if (score && score === best) hits.push(v);
  }
  let r = best > 0 ? settle(hits, 'name') : null;
  if (r) return r;
  const text = String((product && product.price) || '');
  const recorded = FOREIGN_RX.test(text) ? [] : dollarAmounts(text);
  const same = priced.filter(function (v) { return recorded.some(function (a) { return !isSignificant(a, v.amount); }); });
  r = settle(same, 'price');
  if (r) return r;
  return { variant: null, how: 'ambiguous', count: distinctAmounts(priced) };
}

function priceSpread(variants) {
  const amounts = variants.map(function (v) { return v.amount; });
  return { min: Math.min.apply(null, amounts), max: Math.max.apply(null, amounts) };
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
function compare(priceText, found, fetchError, ambiguous) {
  const parsed = S.parsePrice(priceText);
  const recordedUsd = parsed ? parsed.usd : null;
  if (!found && ambiguous) return { status: 'check', detail: ambiguous.count + ' prices on the page, ' + money(ambiguous.min, ambiguous.currency) + ' to ' + money(ambiguous.max, ambiguous.currency), recordedUsd };
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

// One product: the page first; the Shopify endpoint when the page gave nothing
// or more than one price, since it names every variant.
async function checkProduct(product, wait) {
  const result = { found: null, fetchError: null, http: null, notes: [], ambiguous: null };
  let html = '', offers = [], fallback = null, gone = false;
  try {
    await wait(product.url);
    const r = await fetchText(product.url);
    result.http = r.status;
    const moved = movedAway(product.url, r.url);
    if (moved) result.notes.push('redirected to ' + r.url);
    // A home page may carry structured data for some featured product; never take that.
    gone = moved && isHomePage(r.url);
    if (r.ok) {
      html = r.text;
      if (!gone) { offers = jsonLdOffers(html); fallback = findMetaPrice(html) || findItempropPrice(html); }
    } else result.fetchError = 'HTTP ' + r.status;
  } catch (e) { result.fetchError = errorLabel(e); }
  const pageCurrency = findShopifyCurrency(html);

  let variants = [];
  const sh = shopifyHandle(product.url);
  if (sh && (!offers.length || distinctAmounts(offers) > 1)) {
    for (const ext of ['.js', '.json']) {
      const u = sh.origin + '/products/' + encodeURIComponent(sh.handle) + ext;
      try {
        await wait(u);
        const r = await fetchText(u, 'application/json,*/*;q=0.5');
        if (!r.ok) { result.notes.push(ext + ' HTTP ' + r.status); continue; }
        variants = shopifyVariants(JSON.parse(r.text));
        if (variants.length) break;
        result.notes.push(ext + ' no variants');
      } catch (e) { result.notes.push(ext + ' ' + errorLabel(e)); }
    }
  }

  const cands = variants.length ? variants : offers.map(function (o) { return Object.assign({ source: 'json-ld' }, o); });
  if (cands.length) {
    const pick = pickVariant(cands, product);
    if (pick && pick.variant) {
      const v = pick.variant;
      result.found = { amount: v.amount, currency: v.currency || pageCurrency, source: v.source, variant: pick.how === 'one price' ? '' : v.title, how: pick.how };
      result.fetchError = null;
    } else {
      result.ambiguous = Object.assign(priceSpread(cands), { count: pick.count, how: pick.how, currency: cands[0].currency || pageCurrency,
        titles: cands.map(function (v) { return (v.title || '?') + ' ' + money(v.amount, v.currency || pageCurrency); }) });
      result.fetchError = null;
    }
  } else if (fallback) {
    result.found = fallback;
    if (!result.found.currency) result.found.currency = pageCurrency;
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

const HOW_LABEL = { name: 'by name', hint: 'by hint', url: 'by URL', price: 'by recorded price' };
function variantCell(found) {
  if (!found || !found.variant) return '—';
  return found.variant + (HOW_LABEL[found.how] ? ' (' + HOW_LABEL[found.how] + ')' : '');
}

function buildReport(rows, date) {
  const count = function (st) { return rows.filter(function (r) { return r.status === st; }).length; };
  const changed = rows.filter(function (r) { return r.status === 'changed'; });
  const other = rows.filter(function (r) { return r.status === 'other currency'; });
  const check = rows.filter(function (r) { return r.status === 'check'; });
  const bad = rows.filter(function (r) { return r.status === 'not found' || r.status === 'error'; });
  const found = rows.length - bad.length - check.length;
  const lines = [];
  lines.push('# Price check: ' + date, '');
  lines.push('Checked ' + rows.length + ' products: ' + found + ' prices found, ' + count('changed') + ' changed, '
    + count('check') + ' need a look, ' + count('not found') + ' not found, ' + count('error') + ' errors.', '');
  lines.push('## Changes', '');
  if (!changed.length) lines.push('No price changed by more than 2% and $1.', '');
  else {
    lines.push('The Variant column names the size or option the price was read from, and how it was chosen (by the product name, a `variant` hint, a `?variant=` id, or the recorded price).', '');
    lines.push('| Listing | Product | Store | Recorded | Found | Variant | Source | New text |', '|---|---|---|---|---|---|---|---|');
    for (const r of changed) lines.push('| ' + [r.entry, '[' + cell(r.product.name) + '](' + r.product.url + ')', r.product.store,
      cell(r.product.price) + (r.recordedUsd != null ? ' (' + money(r.recordedUsd, 'USD') + ')' : ''),
      money(r.found.amount, 'USD') + (r.assumed ? ' (currency assumed)' : ''), variantCell(r.found), r.found.source, r.newText ? cell(r.newText) : '(left alone)'].map(cell).join(' | ') + ' |');
    lines.push('');
  }
  if (check.length) {
    lines.push('## Needs a look', '',
      'These pages sell several sizes or options at different prices and nothing says which one the listing means. Nothing was changed for them. To settle one, add `"variant": "<words from the option name>"` to the product in `data.json`, or a `?variant=<id>` to its URL, and the next run will read that price.', '',
      '| Listing | Product | Store | Recorded | Prices on the page |', '|---|---|---|---|---|');
    for (const r of check) {
      const titles = r.ambiguous.titles.slice(0, 8).join('; ') + (r.ambiguous.titles.length > 8 ? '; … ' + (r.ambiguous.titles.length - 8) + ' more' : '');
      lines.push('| ' + [r.entry, '[' + cell(r.product.name) + '](' + r.product.url + ')', r.product.store, cell(r.product.price), titles].map(cell).join(' | ') + ' |');
    }
    lines.push('');
  }
  if (other.length) {
    lines.push('## Prices in other currencies', '', '| Listing | Product | Store | Recorded | Found | Source |', '|---|---|---|---|---|---|');
    for (const r of other) lines.push('| ' + [r.entry, '[' + cell(r.product.name) + '](' + r.product.url + ')', r.product.store, cell(r.product.price),
      money(r.found.amount, r.found.currency) + (r.found.variant ? ' (' + cell(r.found.variant) + ')' : ''), r.found.source].map(cell).join(' | ') + ' |');
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
  const opts = { limit: 0, only: [], concurrency: 4, write: false, report: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') opts.limit = parseInt(argv[++i], 10) || 0;
    else if (a === '--only') opts.only = String(argv[++i] || '').split(',').filter(Boolean);
    else if (a === '--concurrency') opts.concurrency = Math.max(1, parseInt(argv[++i], 10) || 4);
    else if (a === '--write') opts.write = true;
    else if (a === '--report') opts.report = argv[++i] || '';
    else if (a === '--help' || a === '-h') { console.log('Usage: node tools/prices.js [--limit N] [--only id,id] [--concurrency 4] [--write] [--report FILE]'); process.exit(0); }
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
  if (opts.only.length) items = items.filter(function (it) { return opts.only.indexOf(it.entry) >= 0; });
  if (opts.limit) items = items.slice(0, opts.limit);
  const order = interleaveByHost(items);
  const wait = hostWaiter(HOST_DELAY_MS);

  const rows = [];
  await runPool(order, opts.concurrency, async function (it) {
    const r = await checkProduct(it.product, wait);
    const c = compare(it.product.price, r.found, r.fetchError, r.ambiguous);
    const row = Object.assign({ entry: it.entry, product: it.product, found: r.found, ambiguous: r.ambiguous, notes: r.notes, http: r.http, newText: null }, c);
    rows.push(row);
    const tag = row.status.toUpperCase().padEnd(14);
    const what = r.found ? money(r.found.amount, row.currency || r.found.currency) + ' via ' + r.found.source + (r.found.variant ? ' [' + r.found.variant + ', ' + r.found.how + ']' : '') : (row.detail || '');
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
  formatAmount, buildReport, interleaveByHost, hostWaiter, jsonLdOffers, shopifyVariants, pickVariant, nameTokens, distinctAmounts
};

if (require.main === module) {
  main().catch(function (e) { console.error('price check failed:', e && e.stack || e); process.exit(0); });
}
