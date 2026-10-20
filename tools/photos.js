#!/usr/bin/env node
/* Saves every product photo a seller's page shows, as a local cache: img/<key>.jpg, at most 640 px on the long side.
   Usage: node tools/photos.js [--only id,id] [--limit N] [--max 10] [--refresh] [--browser] [--write] [--report FILE]
   Each listing's first product page is read (the next one when it is blocked): Shopify's /products/<handle>.json
   image list, then JSON-LD Product images, WooCommerce gallery images and og:image. Logos and icons, images under
   300 px and near-duplicates of a photo already kept are skipped. The listing's existing photo stays first.
   With --write, data.json gets `photos: [{key, src}]` (and `img`/`img_src` when the listing had no photo). Listings that
   already have `photos` are skipped unless --refresh. Exit code is always 0; blocked pages are reported. */
'use strict';
const fs = require('fs');
const path = require('path');
// sharp is loaded on first use, so the pure functions below can be tested without installing it.
let sharpLib = null;
function sharp(x) { if (!sharpLib) sharpLib = require('sharp'); return sharpLib(x); }
const P = require('./prices.js');

const ROOT = path.join(__dirname, '..');
const IMG = path.join(ROOT, 'img');
const MIN_SIDE = 300;
const SKIP = /logo|icon|favicon|sprite|badge|payment|placeholder|banner|avatar|\.svg(\?|$)|\.gif(\?|$)/i;

// ---------- finding image URLs (pure) ----------

function abs(u, base) { try { return new URL(P.decodeEntities(String(u).trim()), base).href; } catch (e) { return null; } }

// Same picture at another size on a CDN: strip size suffixes and query strings so the URLs compare equal.
function imageId(u) {
  try {
    const x = new URL(u);
    return (x.host.replace(/^www\./, '') + x.pathname)
      .replace(/_(\d+x\d*|\d*x\d+|small|medium|large|grande|master|compact|pico|icon|thumb)(?=\.\w+$)/i, '')
      .replace(/-\d{2,4}x\d{2,4}(?=\.\w+$)/, '')
      .replace(/\.(jpe?g|png|webp|avif)$/i, '').toLowerCase();
  } catch (e) { return u; }
}

function jsonLdImages(html, base) {
  const out = [];
  const add = (v) => {
    if (!v) return;
    if (Array.isArray(v)) return v.forEach(add);
    if (typeof v === 'object') return add(v.contentUrl || v.url);
    const u = abs(v, base); if (u) out.push(u);
  };
  for (const block of P.jsonLdBlocks(html)) for (const node of P.walkObjects(block)) {
    if (P.hasType(node, 'Product') || P.hasType(node, 'ProductGroup')) add(node.image);
  }
  return out;
}

function htmlImages(html, base) {
  const out = [];
  let m;
  const push = (u) => { const x = abs(u, base); if (x) out.push(x); };
  // Full-size images that galleries put in data attributes (WooCommerce data-large_image, data-zoom-image, data-full ...).
  const rx1 = /\sdata-[\w-]*(?:large|zoom|full|original|hires|photoswipe)[\w-]*\s*=\s*["']([^"'\s]+\.(?:jpe?g|png|webp)(?:\?[^"'\s]*)?)["']/gi;
  while ((m = rx1.exec(html))) push(m[1]);
  // Lightbox links straight to an image file.
  const rx2 = /<a\b[^>]*\shref\s*=\s*["']([^"'\s]+\.(?:jpe?g|png|webp)(?:\?[^"'\s]*)?)["']/gi;
  while ((m = rx2.exec(html))) push(m[1]);
  const rx3 = /<meta\b[^>]*(?:property|name)\s*=\s*["']og:image(?::secure_url)?["'][^>]*>/gi;
  while ((m = rx3.exec(html))) { const c = m[0].match(/content\s*=\s*["']([^"']+)["']/i); if (c) push(c[1]); }
  return out;
}

// Other files named like the main photo ("play-mat.jpg", "play-mat-5.jpg"): the rest of the same product's gallery.
function siblingImages(html, base, main) {
  if (!main) return [];
  const stem = (imageId(main).split('/').pop() || '').replace(/[-_]\d+$/, '');
  if (stem.length < 8) return [];
  const out = [];
  const rx = /(?:https?:)?\/\/[^"'\s,()]+?\.(?:jpe?g|png|webp)|\/[^"'\s,()]+?\.(?:jpe?g|png|webp)/gi;
  let m;
  while ((m = rx.exec(html))) {
    const u = abs(m[0], base);
    if (u && (imageId(u).split('/').pop() || '').startsWith(stem)) out.push(u);
  }
  return out;
}

function shopifyImages(json) {
  const p = json && (json.product || json);
  return ((p && p.images) || []).map((i) => (typeof i === 'string' ? i : i && i.src)).filter(Boolean).map((u) => (u.startsWith('//') ? 'https:' + u : u));
}

// Candidate URLs in page order, duplicates and obvious non-photos removed.
function candidates(lists) {
  const seen = new Set(), out = [];
  for (const u of [].concat.apply([], lists)) {
    if (!u || SKIP.test(u) || !/^https?:/.test(u)) continue;
    const id = imageId(u);
    if (seen.has(id)) continue;
    seen.add(id); out.push(u);
  }
  return out;
}

// 64-bit difference hash of a picture, for spotting the same photo at another size or crop.
async function dhash(buf) {
  const px = await sharp(buf).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let h = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) h = (h << 1n) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1n : 0n);
  return h;
}
function hamming(a, b) { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; }

// ---------- fetching ----------

async function fetchBuffer(url, wait) {
  await wait(url);
  const res = await fetch(url, { headers: { 'user-agent': P.USER_AGENT, accept: 'image/avif,image/webp,image/*,*/*;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

async function pageImages(url, wait) {
  await wait(url);
  const r = await P.fetchText(url);
  if (!r.ok) return { error: 'HTTP ' + r.status };
  const lists = [];
  const sh = P.shopifyHandle(url);
  if (sh) {
    const u = sh.origin + '/products/' + encodeURIComponent(sh.handle) + '.json';
    try { await wait(u); const j = await P.fetchText(u, 'application/json'); if (j.ok) lists.push(shopifyImages(JSON.parse(j.text))); } catch (e) { /* page images below */ }
  }
  const ld = jsonLdImages(r.text, r.url), page = htmlImages(r.text, r.url);
  lists.push(ld, page, siblingImages(r.text, r.url, (lists[0] && lists[0][0]) || ld[0] || page[0]));
  return { urls: candidates(lists) };
}

// Stores that refuse scripts (HTTP 403, Etsy, some WooCommerce hosts) usually serve a real browser. With --browser the
// page and its images are read again through headless Chromium (Playwright), and the same image rules apply.
let browserCtx = null;
async function browser() {
  if (!browserCtx) {
    const { chromium } = require('playwright');
    const b = await chromium.launch();
    browserCtx = await b.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' });
    browserCtx.closeAll = () => b.close();
  }
  return browserCtx;
}
async function browserPageImages(url, wait, name) {
  await wait(url);
  const ctx = await browser();
  const page = await ctx.newPage();
  try {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!r || !r.ok()) return { error: 'HTTP ' + (r ? r.status() : 'no response') + ' in a browser' };
    await page.waitForTimeout(2500);
    const html = await page.content(), base = page.url();
    const ld = jsonLdImages(html, base), found = htmlImages(html, base);
    // Large pictures the page shows, outside the header, menus, footer and other-product carousels.
    // Only when the page names no product images itself, and only pictures whose alt text or file name shares a word
    // with the product's name, so other products on the page stay out.
    const words = String(name || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
    const shown = ld.length || found.length || !words.length ? [] : await page.evaluate((words) => Array.from(document.images).filter((i) => i.naturalWidth >= 300 &&
      !i.closest('header, nav, footer, [class*="menu"], [class*="nav"], [class*="footer"], [class*="related"], [class*="recommend"], [class*="upsell"], [class*="cross-sell"], [class*="recent"], [class*="similar"], [class*="also"]') &&
      words.some((w) => ((i.alt || '') + ' ' + (i.currentSrc || i.src)).toLowerCase().indexOf(w) >= 0))
      .map((i) => i.currentSrc || i.src), words);
    return { urls: candidates([ld, found, shown, siblingImages(html, base, ld[0] || found[0])]) };
  } finally { await page.close(); }
}
async function browserBuffer(url, wait) {
  await wait(url);
  const res = await (await browser()).request.get(url, { timeout: 20000 });
  if (!res.ok()) throw new Error('HTTP ' + res.status());
  return Buffer.from(await res.body());
}

async function photosFor(e, opts, wait) {
  const res = { id: e.id, page: null, kept: [], skipped: 0, error: null };
  let urls = null;
  for (const p of e.products) {
    try {
      const got = await pageImages(p.url, wait);
      if (got.urls && got.urls.length) { urls = got.urls; res.page = p.url; break; }
      res.error = got.error || 'no photos found on the page';
    } catch (err) { res.error = P.errorLabel(err); }
  }
  let viaBrowser = false;
  if (!urls && opts.browser) {
    for (const p of e.products) {
      try {
        const got = await browserPageImages(p.url, wait, p.name || e.line);
        if (got.urls && got.urls.length) { urls = got.urls; res.page = p.url; viaBrowser = true; break; }
        res.error = got.error || 'no photos found on the page, also in a browser';
      } catch (err) { res.error = P.errorLabel(err) + ' in a browser'; }
    }
  }
  if (!urls) return res;
  res.error = null;
  const hashes = [];
  const keep = [];
  if (e.img && fs.existsSync(path.join(IMG, e.img + '.jpg'))) {
    hashes.push(await dhash(fs.readFileSync(path.join(IMG, e.img + '.jpg'))));
    keep.push({ key: e.img, src: e.img_src || '' });
  }
  const stem = e.img || e.id;
  for (const u of urls.slice(0, opts.max * 4)) {   // a bounded number of tries per listing
    if (keep.length >= opts.max) break;
    if (e.img_src && imageId(u) === imageId(e.img_src)) continue;
    try {
      const buf = viaBrowser ? await browserBuffer(u, wait) : await fetchBuffer(u, wait);
      const meta = await sharp(buf).metadata();
      if (!meta.width || Math.max(meta.width, meta.height) < MIN_SIDE) { res.skipped++; continue; }
      const h = await dhash(buf);
      if (hashes.some((x) => hamming(x, h) <= 10)) { res.skipped++; continue; }
      hashes.push(h);
      const key = keep.length ? stem + '_' + (keep.length + 1) : stem;
      const jpg = await sharp(buf).rotate().flatten({ background: '#ffffff' }).resize(640, 640, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      keep.push({ key, src: u, jpg });
    } catch (err) { res.skipped++; }
  }
  res.kept = keep;
  return res;
}

function parseArgs(argv) {
  const o = { only: [], limit: 0, max: 10, refresh: false, browser: false, write: false, report: null, concurrency: 4 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') o.only = argv[++i].split(',').filter(Boolean);
    else if (a === '--limit') o.limit = parseInt(argv[++i], 10) || 0;
    else if (a === '--max') o.max = parseInt(argv[++i], 10) || 10;
    else if (a === '--concurrency') o.concurrency = parseInt(argv[++i], 10) || 4;
    else if (a === '--refresh') o.refresh = true;
    else if (a === '--browser') o.browser = true;
    else if (a === '--write') o.write = true;
    else if (a === '--report') o.report = argv[++i];
  }
  return o;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const file = path.join(ROOT, 'data.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let todo = data.entries.filter((e) => opts.refresh || !e.photos);
  if (opts.only.length) todo = data.entries.filter((e) => opts.only.includes(e.id));
  if (opts.limit) todo = todo.slice(0, opts.limit);
  const wait = P.hostWaiter(1500);
  const results = [];
  const queue = todo.slice();
  await Promise.all(Array.from({ length: opts.concurrency }, async () => {
    while (queue.length) {
      const e = queue.shift();
      const r = await photosFor(e, opts, wait);
      results.push(r);
      console.log((r.error ? 'FAILED ' : 'ok     ') + e.id + ' · ' + (r.error || r.kept.length + ' photos'));
      if (opts.write && !r.error && r.kept.length) {
        for (const k of r.kept) if (k.jpg) fs.writeFileSync(path.join(IMG, k.key + '.jpg'), k.jpg);
        e.photos = r.kept.map((k) => ({ key: k.key, src: k.src }));
        if (!e.img) { e.img = e.photos[0].key; e.img_src = e.photos[0].src; }
        fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');   // saved as it goes, so a stopped run resumes
      }
    }
  }));
  if (opts.write) fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
  const ok = results.filter((r) => !r.error), failed = results.filter((r) => r.error);
  const added = ok.reduce((n, r) => n + r.kept.filter((k) => k.jpg).length, 0);
  const report = ['# Photo check', '', `${results.length} listings read; ${added} new photos ${opts.write ? "saved" : "found (not saved without --write)"} for ${ok.filter((r) => r.kept.some((k) => k.jpg)).length} listings; ${failed.length} pages could not be read.`, '']
    .concat(failed.length ? ['## Not read', '', '| Listing | Why |', '|---|---|'].concat(failed.map((r) => `| ${r.id} | ${r.error} |`), ['']) : []).join('\n');
  if (opts.report) fs.writeFileSync(opts.report, report);
  console.log(report.split('\n')[2]);
  if (browserCtx) await browserCtx.closeAll();
}

module.exports = { imageId, jsonLdImages, htmlImages, siblingImages, shopifyImages, candidates, hamming };
if (require.main === module) main().catch((e) => { console.error('photo check failed:', e && e.stack || e); process.exit(0); });
