// Unit tests for the price extraction in tools/prices.js. No network.
// Run: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../tools/prices.js');

const JSON_LD_PAGE = `<!doctype html><html><head><title>Rattle</title>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Wooden rattle",
 "offers":{"@type":"Offer","price":"29.95","priceCurrency":"USD","availability":"https://schema.org/InStock"}}
</script></head><body><span itemprop="price" content="99.00">$99.00</span></body></html>`;

const JSON_LD_GRAPH = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"WebPage","name":"x"},
 {"@type":"Product","name":"Bed","offers":{"@type":"AggregateOffer","lowPrice":"653","highPrice":"899.00","priceCurrency":"USD","offerCount":3}}
]}</script></head></html>`;

const JSON_LD_OFFER_LIST = `<script type="application/ld+json">[{"@type":"Product","offers":[
 {"@type":"Offer","price":"44.50","priceCurrency":"GBP"},
 {"@type":"Offer","price":"30.00","priceCurrency":"GBP"},
 {"@type":"Offer","price":"0","priceCurrency":"GBP"}]}]</script>`;

const META_PAGE = `<html><head>
<meta content="42.00" property="og:price:amount">
<meta property="og:price:currency" content="USD" />
<meta property="product:price:amount" content="39.50">
<meta property="product:price:currency" content="USD">
</head><body></body></html>`;

const ITEMPROP_PAGE = `<html><body><div itemscope itemtype="http://schema.org/Product">
<meta itemprop="priceCurrency" content="EUR">
<span class="price" itemprop="price">&euro;48,90</span>
<span itemprop="price" content="1,234.56">1.234,56</span>
</div></body></html>`;

const SHOPIFY_JS = {
  id: 1, title: 'Silks', handle: 'silks',
  variants: [
    { id: 11, title: 'Blue', price: 3950, available: true },
    { id: 12, title: 'Red', price: 1995, available: false },
    { id: 13, title: 'Green', price: 4200, available: true }
  ]
};

const SHOPIFY_JSON = { product: { id: 1, variants: [{ id: 1, price: '24.00' }, { id: 2, price: '27.50' }] } };

const SHOPIFY_PAGE = `<html><head><script>window.Shopify = window.Shopify || {};
Shopify.currency = {"active":"CAD","rate":"1.0"};</script></head><body>no structured price</body></html>`;

test('parseAmount handles separators and junk', () => {
  assert.equal(P.parseAmount('29.95'), 29.95);
  assert.equal(P.parseAmount('1,234.56'), 1234.56);
  assert.equal(P.parseAmount('29,95'), 29.95);
  assert.equal(P.parseAmount('USD 12'), 12);
  assert.equal(P.parseAmount(425), 425);
  assert.equal(P.parseAmount(''), null);
  assert.equal(P.parseAmount('free'), null);
});

test('JSON-LD Product offer price wins over itemprop', () => {
  assert.deepEqual(P.extractPrice(JSON_LD_PAGE), { amount: 29.95, currency: 'USD', source: 'json-ld' });
});

test('JSON-LD @graph with AggregateOffer uses lowPrice', () => {
  assert.deepEqual(P.findJsonLdPrice(JSON_LD_GRAPH), { amount: 653, currency: 'USD', source: 'json-ld' });
});

test('JSON-LD array of offers takes the lowest positive price', () => {
  assert.deepEqual(P.findJsonLdPrice(JSON_LD_OFFER_LIST), { amount: 30, currency: 'GBP', source: 'json-ld' });
});

test('meta tags: product:price:amount preferred, attribute order ignored', () => {
  assert.deepEqual(P.findMetaPrice(META_PAGE), { amount: 39.5, currency: 'USD', source: 'meta' });
  assert.deepEqual(P.extractPrice(META_PAGE), { amount: 39.5, currency: 'USD', source: 'meta' });
  const ogOnly = '<meta property="og:price:amount" content="42"><meta property="og:price:currency" content="eur">';
  assert.deepEqual(P.findMetaPrice(ogOnly), { amount: 42, currency: 'EUR', source: 'meta' });
});

test('itemprop price: text content and content attribute, lowest wins', () => {
  assert.deepEqual(P.findItempropPrice(ITEMPROP_PAGE), { amount: 48.9, currency: 'EUR', source: 'itemprop' });
});

test('extractPrice returns null without structured data', () => {
  assert.equal(P.extractPrice('<html><body><p>$12.00</p></body></html>'), null);
  assert.equal(P.extractPrice(''), null);
  assert.equal(P.extractPrice('<script type="application/ld+json">{not json</script>'), null);
});

test('Shopify .js: cents, lowest available variant', () => {
  assert.deepEqual(P.parseShopifyProduct(SHOPIFY_JS), { amount: 39.5, currency: null, source: 'shopify.js' });
});

test('Shopify .js: falls back to all variants when none is available', () => {
  const none = { variants: [{ price: 1000, available: false }, { price: 500, available: false }] };
  assert.equal(P.parseShopifyProduct(none).amount, 5);
  assert.equal(P.parseShopifyProduct({ variants: [] }), null);
  assert.equal(P.parseShopifyProduct({}), null);
});

test('Shopify .json: decimal strings under product', () => {
  assert.deepEqual(P.parseShopifyProduct(SHOPIFY_JSON), { amount: 24, currency: null, source: 'shopify.json' });
});

test('Shopify currency is read from the theme script', () => {
  assert.equal(P.findShopifyCurrency(SHOPIFY_PAGE), 'CAD');
  assert.equal(P.findShopifyCurrency('<html></html>'), null);
});

test('shopifyHandle finds /products/<handle>', () => {
  assert.deepEqual(P.shopifyHandle('https://shop.example.com/collections/toys/products/wooden-rattle?variant=1#x'),
    { origin: 'https://shop.example.com', handle: 'wooden-rattle' });
  assert.deepEqual(P.shopifyHandle('https://shop.example.com/products/silks/'), { origin: 'https://shop.example.com', handle: 'silks' });
  assert.equal(P.shopifyHandle('https://www.example.com/item/123'), null);
  assert.equal(P.shopifyHandle('not a url'), null);
});

test('significance: more than 2% and more than $1', () => {
  assert.equal(P.isSignificant(100, 102), false);   // exactly 2%
  assert.equal(P.isSignificant(100, 102.5), true);
  assert.equal(P.isSignificant(10, 10.9), false);   // 9% but under $1
  assert.equal(P.isSignificant(10, 11.5), true);
  assert.equal(P.isSignificant(425, 425), false);
});

test('compare: same, changed, not found, error, other currency', () => {
  assert.equal(P.compare('$425', { amount: 425, currency: 'USD' }, null).status, 'same');
  assert.equal(P.compare('$425', { amount: 399, currency: 'USD' }, null).status, 'changed');
  assert.equal(P.compare('from $653', { amount: 653, currency: 'USD' }, null).status, 'same');
  assert.equal(P.compare('$29.95 to $37.10', { amount: 29.95, currency: 'USD' }, null).status, 'same');
  assert.equal(P.compare('$425', null, null).status, 'not found');
  const err = P.compare('$425', null, 'HTTP 403');
  assert.equal(err.status, 'error');
  assert.equal(err.detail, 'HTTP 403');
  assert.equal(P.compare('£30', { amount: 30, currency: 'GBP' }, null).status, 'other currency');
  assert.equal(P.compare('$425', { amount: 30, currency: 'GBP' }, null).status, 'other currency');
  const noRec = P.compare('price on request', { amount: 80, currency: 'USD' }, null);
  assert.equal(noRec.status, 'changed');
  assert.equal(noRec.recordedUsd, null);
});

test('compare: a match with any recorded dollar amount counts as same', () => {
  assert.equal(P.compare('$185; $140.99 on sale at Babylist', { amount: 185, currency: 'USD' }, null).status, 'same');
  assert.equal(P.compare('$185; $140.99 on sale at Babylist', { amount: 141, currency: 'USD' }, null).status, 'same');
  assert.equal(P.compare('$185; $140.99 on sale at Babylist', { amount: 160, currency: 'USD' }, null).status, 'changed');
  assert.equal(P.compare('$16.95 plus $5.83 shipping', { amount: 5.83, currency: 'USD' }, null).status, 'changed');
  assert.deepEqual(P.dollarAmounts('$24 to $27.50'), [24, 27.5]);
});

test('movedAway spots redirects to another page', () => {
  assert.equal(P.movedAway('https://a.test/products/x', 'https://a.test/'), true);
  assert.equal(P.movedAway('https://a.test/products/x', 'https://a.test/products/x'), false);
  assert.equal(P.movedAway('https://a.test/products/x', 'https://a.test/products/x/'), false);
  assert.equal(P.movedAway('https://a.test/collections/c/products/x', 'https://a.test/products/x?variant=1'), false);
  assert.equal(P.movedAway('http://a.test/p', 'https://www.a.test/p'), false);
  assert.equal(P.movedAway('https://a.test/p', ''), false);
  assert.equal(P.isHomePage('https://a.test/'), true);
  assert.equal(P.isHomePage('https://a.test'), true);
  assert.equal(P.isHomePage('https://a.test/products/x'), false);
});

test('compare assumes USD for a dollar text when the page names no currency', () => {
  const r = P.compare('$39.50, free US shipping', { amount: 39.5, currency: null }, null);
  assert.equal(r.status, 'same');
  assert.equal(r.assumed, true);
  assert.equal(P.compare('£30', { amount: 30, currency: null }, null).status, 'other currency');
});

test('replaceAmount changes only a single dollar amount and keeps the words', () => {
  assert.equal(P.replaceAmount('$425', 399), '$399');
  assert.equal(P.replaceAmount('$39.50, free US shipping', 42), '$42, free US shipping');
  assert.equal(P.replaceAmount('from $653', 679.99), 'from $679.99');
  assert.equal(P.replaceAmount('$17.95 (sale; regular $30.00)', 20), null);
  assert.equal(P.replaceAmount('$29.95 to $37.10', 31), null);
  assert.equal(P.replaceAmount('from £207.50 (about $270), free US shipping', 280), null);
  assert.equal(P.replaceAmount('price on request', 80), null);
});

test('report has a summary line and tables', () => {
  const product = { name: 'Rattle', url: 'https://x.test/p', store: 'X', price: '$10' };
  const rows = [
    { entry: 'a', product, status: 'same', detail: '', notes: [], found: { amount: 10, currency: 'USD', source: 'json-ld' }, recordedUsd: 10 },
    { entry: 'b', product, status: 'changed', detail: '', notes: [], found: { amount: 12, currency: 'USD', source: 'meta' }, recordedUsd: 10, newText: '$12' },
    { entry: 'c', product, status: 'error', detail: 'HTTP 403', notes: ['.js HTTP 404'], found: null, recordedUsd: 10 },
    { entry: 'd', product, status: 'not found', detail: '', notes: [], found: null, recordedUsd: 10 }
  ];
  const md = P.buildReport(rows, '2026-10-19');
  assert.match(md, /^# Price check: 2026-10-19/);
  assert.match(md, /Checked 4 products: 2 prices found, 1 changed, 1 not found, 1 errors\./);
  assert.match(md, /\| b \| \[Rattle\]\(https:\/\/x\.test\/p\) \| X \| \$10 \(\$10\) \| \$12 \| meta \| \$12 \|/);
  assert.match(md, /\| c \| .* \| error: HTTP 403 \(\.js HTTP 404\) \|/);
  assert.match(md, /\| d \| .* \| not found \|/);
});
