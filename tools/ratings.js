/* Reads a product's star rating and review count from its store page.

   Used by tools/prices.js, which already fetches every product page. The
   page's own markup is read first, in this order: schema.org AggregateRating
   in JSON-LD (Product or ProductGroup), the Judge.me review widget, Shopify's
   standard reviews metafield as themes print it, Okendo's product data, and
   Loox's rating badge. When none of those is in the page but a review app
   that loads its numbers in the browser is (Yotpo, Junip), the app's public
   widget endpoint is asked, with the store's public key from the page. Last
   comes schema.org microdata (itemprop="ratingValue"), which some themes
   round to whole stars. A rating with no reviews counts as none.

   Node 22, no dependencies. The parsing functions are pure and exported for
   tests; fetchRating takes the fetch helper so tests need no network. */
'use strict';

function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return isFinite(n) ? n : null;
}

// {value, count, via} rounded the way the site shows it, or null when either part is missing or out of range.
function make(value, count, via, best) {
  let v = num(value);
  const c = num(count);
  const b = num(best);
  if (v == null || c == null || c < 1) return null;
  if (b && b > 0 && b !== 5) v = v * 5 / b; // a 10-point or 100-point scale, shown out of 5
  if (v <= 0 || v > 5) return null;
  return { value: Math.round(v * 100) / 100, count: Math.round(c), via };
}

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

function hasType(node, type) {
  const t = node && node['@type'];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

// Product or ProductGroup nodes at the top of each block (or in its @graph), not
// the related products some themes nest further down.
function topProducts(block) {
  const list = Array.isArray(block) ? block : block && Array.isArray(block['@graph']) ? block['@graph'] : [block];
  return list.filter(function (n) { return n && typeof n === 'object' && (hasType(n, 'Product') || hasType(n, 'ProductGroup')); });
}

function fromJsonLd(html) {
  for (const block of jsonLdBlocks(html)) {
    for (const node of topProducts(block)) {
      const a = node.aggregateRating;
      if (!a || typeof a !== 'object') continue;
      const r = make(a.ratingValue, a.reviewCount != null ? a.reviewCount : a.ratingCount, 'json-ld', a.bestRating);
      if (r) return r;
    }
  }
  return null;
}

function attr(tag, name) {
  const m = new RegExp('\\b' + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')", 'i').exec(tag);
  return m ? (m[1] != null ? m[1] : m[2]) : null;
}

// Judge.me prints the product's own review widget with its average and count;
// the preview badges elsewhere on the page can belong to related products.
function fromJudgeMe(html) {
  const m = /<div\b[^>]*class=['"][^'"]*\bjdgm-rev-widg\b[^'"]*['"][^>]*>/i.exec(html);
  if (!m) return null;
  return make(attr(m[0], 'data-average-rating'), attr(m[0], 'data-number-of-reviews'), 'judge.me');
}

// Shopify's standard reviews.rating / reviews.rating_count metafields, as themes
// and the Klaviyo snippet print them: {"rating":{"scale_min":"1.0","scale_max":"5.0","value":"4.7"},"rating_count":106}
function fromShopifyMetafield(html) {
  const m = /"rating"\s*:\s*\{[^{}]*"scale_max"\s*:\s*"?([\d.]+)"?[^{}]*"value"\s*:\s*"?([\d.]+)"?[^{}]*\}\s*,\s*"rating_count"\s*:\s*"?(\d+)/.exec(html);
  return m ? make(m[2], m[3], 'shopify', m[1]) : null;
}

function fromOkendo(html) {
  const m = /okendoProduct\s*=\s*\{[^;]*?"reviewAverageValue"\s*:\s*"?([\d.]+)"?[^;]*?"reviewCount"\s*:\s*(\d+)/.exec(html) ||
            /"reviewCount"\s*:\s*(\d+)[^;{}]*"reviewAverageValue"\s*:\s*"?([\d.]+)/.exec(html);
  if (!m) return null;
  return /okendoProduct/.test(m[0]) ? make(m[1], m[2], 'okendo') : make(m[2], m[1], 'okendo');
}

function fromLoox(html) {
  const m = /<div\b[^>]*class=['"][^'"]*\bloox-rating\b[^'"]*['"][^>]*>/i.exec(html);
  if (!m) return null;
  return make(attr(m[0], 'data-rating'), attr(m[0], 'data-raters'), 'loox');
}

function fromMicrodata(html) {
  const v = /itemprop=["']ratingValue["'][^>]*?(?:content=["']([\d.]+)["'][^>]*>|>\s*([\d.]+)\s*<)/i.exec(html);
  const c = /itemprop=["'](?:reviewCount|ratingCount)["'][^>]*?(?:content=["']([\d,]+)["'][^>]*>|>\s*([\d,]+)\s*<)/i.exec(html);
  if (!v || !c) return null;
  return make(v[1] || v[2], c[1] || c[2], 'microdata');
}

// The rating in the page itself, or null.
function ratingFromHtml(html) {
  if (!html) return null;
  return fromJsonLd(html) || fromJudgeMe(html) || fromShopifyMetafield(html) || fromOkendo(html) || fromLoox(html);
}

// Review apps that load their numbers in the browser: the public endpoint to ask, from keys in the page.
function widgetRequests(html) {
  const out = [];
  if (!html) return out;
  const yk = /(?:staticw2\.yotpo\.com|cdn-widgetsrepository\.yotpo\.com\/v1\/loader)\/([A-Za-z0-9]{30,})/.exec(html);
  const yp = /<div\b[^>]*class=["'][^"']*\byotpo-main-widget\b[^>]*>/i.exec(html) || /<div\b[^>]*data-yotpo-product-id=["'][^"']+["'][^>]*>/i.exec(html);
  if (yk && yp) {
    const pid = attr(yp[0], 'data-product-id') || attr(yp[0], 'data-yotpo-product-id');
    if (pid) out.push({ via: 'yotpo', url: 'https://api-cdn.yotpo.com/v1/widget/' + yk[1] + '/products/' + encodeURIComponent(pid) + '/reviews.json?per_page=1&page=1' });
  }
  const jk = /data-store-key=["']([A-Za-z0-9]{12,})["']/.exec(html);
  const jp = /<[a-z]+\b[^>]*class=["'][^"']*junip-product-review[^>]*>/i.exec(html);
  if (jk && jp) {
    const pid = attr(jp[0], 'data-product-id');
    if (pid) out.push({ via: 'junip', url: 'https://api.juniphq.com/v1/products?filter%5Bremote_ids%5D=' + encodeURIComponent(pid), headers: { 'junip-store-key': jk[1] } });
  }
  return out;
}

function parseWidget(via, text) {
  let j;
  try { j = JSON.parse(text); } catch (e) { return null; }
  if (via === 'yotpo') {
    const b = j && j.response && j.response.bottomline;
    return b ? make(b.average_score, b.total_review, 'yotpo') : null;
  }
  if (via === 'junip') {
    const p = j && Array.isArray(j.products) ? j.products[0] : null;
    return p ? make(p.rating_average, p.rating_count, 'junip') : null;
  }
  return null;
}

// The page's rating, else a review app's, else microdata. get(url, headers) -> {ok, text}.
async function fetchRating(html, get) {
  const own = ratingFromHtml(html);
  if (own) return own;
  for (const req of widgetRequests(html)) {
    try {
      const r = await get(req.url, req.headers);
      if (r && r.ok) {
        const got = parseWidget(req.via, r.text);
        if (got) return got;
      }
    } catch (e) { /* a review app that does not answer just means no rating */ }
  }
  return fromMicrodata(html);
}

const VIA_LABEL = { 'json-ld': 'page data', 'judge.me': 'Judge.me', shopify: 'Shopify reviews', okendo: 'Okendo', loox: 'Loox', yotpo: 'Yotpo', junip: 'Junip', microdata: 'page markup' };

module.exports = { ratingFromHtml, widgetRequests, parseWidget, fetchRating, fromJsonLd, fromJudgeMe, fromShopifyMetafield, fromOkendo, fromLoox, fromMicrodata, make, VIA_LABEL };
