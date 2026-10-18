// Unit tests for the price extraction in tools/prices.js. No network.
// Run: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../tools/prices.js');

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
  assert.match(md, /Checked 4 products: 2 prices found, 1 changed, 0 need a look, 1 not found, 1 errors\./);
  assert.match(md, /\| b \| \[Rattle\]\(https:\/\/x\.test\/p\) \| X \| \$10 \(\$10\) \| \$12 \| — \| meta \| \$12 \|/);
  assert.match(md, /\| c \| .* \| error: HTTP 403 \(\.js HTTP 404\) \|/);
  assert.match(md, /\| d \| .* \| not found \|/);
});

const WENDY = { product: { id: 1, variants: [
  { id: 11, title: 'Puddle 16x32', price: '54.00', available: true },
  { id: 12, title: 'Crib 27x52', price: '129.00', available: true },
  { id: 13, title: 'Twin 38x80', price: '229.00', available: true } ] } };
const ZION = { variants: [
  { id: 1, title: 'Soft Sole / 1', price: 5900, available: true }, { id: 2, title: 'Soft Sole / 2', price: 5900, available: true },
  { id: 3, title: 'Hard Sole / 3', price: 6500, available: true }, { id: 4, title: 'Hard Sole / 4', price: 6500, available: false } ] };
const BOOTS = { variants: [
  { id: 1, title: 'Green / UK 3/EU 20/USA 4', price: 4100, available: true }, { id: 2, title: 'Green / UK 4/EU 21/USA 5', price: 4100, available: true } ] };

test('shopifyVariants lists every priced variant with its title', () => {
  const v = P.shopifyVariants(WENDY);
  assert.deepEqual(v.map(x => [x.title, x.amount, x.source]), [['Puddle 16x32', 54, 'shopify.json'], ['Crib 27x52', 129, 'shopify.json'], ['Twin 38x80', 229, 'shopify.json']]);
  assert.equal(P.shopifyVariants(ZION)[0].amount, 59);
  assert.deepEqual(P.shopifyVariants({}), []);
  const opts = P.shopifyVariants({ variants: [{ id: 9, option1: 'Red', option2: 'L', price: 1000 }] });
  assert.equal(opts[0].title, 'Red / L');
});

test('nameTokens folds, joins dimensions and drops filler words', () => {
  assert.deepEqual(P.nameTokens('Crib pad, 28 x 52 in'), ['crib', 'pad', '28x52']);
  assert.deepEqual(P.nameTokens('Zion Moccasin Baby Shoe, Soft Sole (sizes 3-5)'), ['zion', 'moccasin', 'baby', 'shoe', 'soft', 'sole', '3-5']);
  assert.deepEqual(P.nameTokens('Green / UK 3/EU 20/USA 4'), ['green', 'uk', '3', 'eu', '20', 'usa', '4']);
});

test('pickVariant: one price needs no choosing', () => {
  const r = P.pickVariant(P.shopifyVariants(BOOTS), { name: 'Rain Boots (USA 6-7)', url: 'https://x.test/products/boots', price: '£41.00' });
  assert.equal(r.how, 'one price');
  assert.equal(r.variant.amount, 41);
});

test('pickVariant: words shared with the product name choose the size', () => {
  const vs = P.shopifyVariants(WENDY);
  const crib = P.pickVariant(vs, { name: 'Crib pad, 28 x 52 in', url: 'https://x.test/products/pad', price: '$129' });
  assert.deepEqual([crib.how, crib.variant.title], ['name', 'Crib 27x52']);
  const puddle = P.pickVariant(vs, { name: 'Puddle pad, 16 x 32 in', url: 'https://x.test/products/pad', price: '$54' });
  assert.deepEqual([puddle.how, puddle.variant.title], ['name', 'Puddle 16x32']);
  const soft = P.pickVariant(P.shopifyVariants(ZION), { name: 'Zion Moccasin Baby Shoe, Soft Sole (sizes 3-5)', url: 'https://x.test/products/zion', price: '$59.00' });
  assert.deepEqual([soft.how, soft.variant.amount], ['name', 59]);
  const hard = P.pickVariant(P.shopifyVariants(ZION), { name: 'Zion Moccasin Baby Shoe, Hard Sole (sizes 3-5)', url: 'https://x.test/products/zion', price: '$65.00' });
  assert.deepEqual([hard.how, hard.variant.amount], ['name', 65]);
});

test('pickVariant: a ?variant= id or a variant hint wins over the name', () => {
  const vs = P.shopifyVariants(WENDY);
  const byUrl = P.pickVariant(vs, { name: 'Crib pad', url: 'https://x.test/products/pad?variant=13', price: '$229' });
  assert.deepEqual([byUrl.how, byUrl.variant.title], ['url', 'Twin 38x80']);
  const byHint = P.pickVariant(vs, { name: 'Wool pad', variant: '16 x 32', url: 'https://x.test/products/pad', price: '$54' });
  assert.deepEqual([byHint.how, byHint.variant.title], ['hint', 'Puddle 16x32']);
  const miss = P.pickVariant(vs, { name: 'Wool pad', variant: 'Queen', url: 'https://x.test/products/pad', price: '$54' });
  assert.equal(miss.variant, null);
  assert.equal(miss.how, 'hint matches nothing');
});

test('pickVariant: the recorded price settles it when names do not; otherwise ambiguous', () => {
  const vs = P.shopifyVariants(WENDY);
  const byPrice = P.pickVariant(vs, { name: 'Wool mattress pad', url: 'https://x.test/products/pad', price: '$129' });
  assert.deepEqual([byPrice.how, byPrice.variant.title], ['price', 'Crib 27x52']);
  const amb = P.pickVariant(vs, { name: 'Wool mattress pad', url: 'https://x.test/products/pad', price: '$99' });
  assert.deepEqual([amb.variant, amb.how, amb.count], [null, 'ambiguous', 3]);
  assert.equal(P.pickVariant([], {}), null);
});

test('jsonLdOffers lists offers with names, ProductGroup variants and aggregate low/high', () => {
  const group = `<script type="application/ld+json">{"@type":"ProductGroup","name":"Pad","hasVariant":[
    {"@type":"Product","name":"Crib 27x52","offers":{"@type":"Offer","price":"129.00","priceCurrency":"USD"}},
    {"@type":"Product","name":"Puddle 16x32","offers":{"@type":"Offer","price":"54.00","priceCurrency":"USD"}}]}</script>`;
  assert.deepEqual(P.jsonLdOffers(group).map(o => [o.title, o.amount, o.currency]), [['Crib 27x52', 129, 'USD'], ['Puddle 16x32', 54, 'USD']]);
  assert.deepEqual(P.jsonLdOffers(JSON_LD_OFFER_LIST).map(o => o.amount), [44.5, 30]);
  assert.deepEqual(P.jsonLdOffers(JSON_LD_GRAPH).map(o => o.amount), [653, 899]);
  assert.deepEqual(P.jsonLdOffers(JSON_LD_PAGE).map(o => [o.title, o.amount]), [['', 29.95]]);
  assert.deepEqual(P.jsonLdOffers('<html></html>'), []);
  assert.equal(P.distinctAmounts(P.jsonLdOffers(JSON_LD_GRAPH)), 2);
});

test('compare reports an ambiguous page as "check" and the report lists it', () => {
  const amb = { count: 3, min: 54, max: 229, currency: 'USD', how: 'ambiguous', titles: ['Puddle 16x32 $54', 'Crib 27x52 $129', 'Twin 38x80 $229'] };
  const c = P.compare('$99', null, null, amb);
  assert.equal(c.status, 'check');
  assert.match(c.detail, /3 prices on the page, \$54 to \$229/);
  const product = { name: 'Wool pad', url: 'https://x.test/p', store: 'X', price: '$99' };
  const rows = [
    Object.assign({ entry: 'pad', product, found: null, ambiguous: amb, notes: [] }, c),
    { entry: 'crib', product, status: 'changed', detail: '', notes: [], found: { amount: 119, currency: 'USD', source: 'shopify.js', variant: 'Crib 27x52', how: 'name' }, recordedUsd: 129, newText: '$119' }
  ];
  const md = P.buildReport(rows, '2026-10-19');
  assert.match(md, /Checked 2 products: 1 prices found, 1 changed, 1 need a look, 0 not found, 0 errors\./);
  assert.match(md, /## Needs a look/);
  assert.match(md, /\| pad \| .* \| \$99 \| Puddle 16x32 \$54; Crib 27x52 \$129; Twin 38x80 \$229 \|/);
  assert.match(md, /\| crib \| .* \| \$119 \| Crib 27x52 \(by name\) \| shopify\.js \| \$119 \|/);
});

test('pickVariant: a recorded range matching the page spread is the whole page', () => {
  const vs = [{ id: 1, title: 'Raw', amount: 1295, currency: 'USD', source: 'json-ld' }, { id: 2, title: 'Oiled', amount: 1295, currency: 'USD', source: 'json-ld' },
    { id: 3, title: 'Walnut', amount: 1995, currency: 'USD', source: 'json-ld' }];
  const r = P.pickVariant(vs, { name: 'Caravan Divan', url: 'https://x.test/divan', price: '$1,295 to $1,995' });
  assert.equal(r.how, 'range');
  assert.equal(r.variant.amount, 1295);
  assert.equal(r.variant.rangeMax, 1995);
  assert.equal(r.variant.title, '2 prices, $1295 to $1995');
  assert.equal(P.compare('$1,295 to $1,995', { amount: 1295, currency: 'USD', rangeMax: 1995 }, null).status, 'same');
  assert.equal(P.compare('$1,295 to $1,995', { amount: 1295, currency: 'USD', rangeMax: 2200 }, null).status, 'changed', 'the top of the range moved');
  const moved = P.pickVariant(vs, { name: 'Caravan Divan', url: 'https://x.test/divan', price: '$1,100 to $1,995' });
  assert.equal(moved.how, 'ambiguous', 'a range whose bottom moved needs a look');
});

test('recordedAmounts reads euro and pound texts for the price rule', () => {
  assert.deepEqual(P.recordedAmounts('€49.90'), [49.9]);
  assert.deepEqual(P.recordedAmounts('from £207.50 (about $270), free US shipping'), [207.5]);
  assert.deepEqual(P.recordedAmounts('$24 to $27.50'), [24, 27.5]);
  const vs = [{ id: 1, title: 'A', amount: 49.9, currency: 'EUR', source: 'json-ld' }, { id: 2, title: 'B', amount: 51.9, currency: 'EUR', source: 'json-ld' }];
  const r = P.pickVariant(vs, { name: 'Leather slippers, Bee', url: 'https://x.test/p', price: '€49.90' });
  assert.deepEqual([r.how, r.variant.title], ['price', 'A']);
});

test('findShipping reads the page\'s own words, most specific first', () => {
  const page = (body) => '<html><head><script>var x="Shipping, taxes, and discount codes calculated at checkout"</script></head><body>' + body + '</body></html>';
  assert.deepEqual(P.findShipping(page('<p>Earn Star Coins » Free Shipping on orders $99+</p><div>Shipping, taxes, and discount codes calculated at checkout.</div>')),
    { kind: 'free over', threshold: 99, text: 'Free shipping on orders over $99', source: 'page' });
  assert.equal(P.findShipping(page('<p>Free shipping &amp; returns for Babylist orders $45+</p>')).threshold, 45);
  assert.deepEqual(P.findShipping(page('<li>📦 Free shipping</li><li>60-day return policy</li>')), { kind: 'free', text: 'Free shipping', source: 'page' });
  assert.deepEqual(P.findShipping(page('<p>Orders over $75 ship free. $8.95 flat rate shipping otherwise.</p>')),
    { kind: 'free over', threshold: 75, text: 'Free shipping on orders over $75, $8.95 below', source: 'page' });
  assert.deepEqual(P.findShipping(page('<p>$6.50 shipping on every order</p>')), { kind: 'flat', amount: 6.5, text: '$6.50 shipping', source: 'page' });
  assert.equal(P.findShipping(page('<p>Subtotal $ 0.00 Shipping, taxes, and discount codes calculated at checkout.</p>')).kind, 'at checkout', 'a $0 subtotal is not a flat rate');
  assert.deepEqual(P.findShipping(page('<p>Sale price $54.00 / Shipping calculated at checkout.</p>')), { kind: 'at checkout', text: 'Shipping calculated at checkout', source: 'page' });
  assert.equal(P.findShipping(page('<p>Shipping Protection available</p><p>Free shipping protection</p>')), null);
  assert.equal(P.findShipping(page('<p>Nothing about delivery here</p>')), null);
  assert.equal(P.findShipping(''), null);
});

test('findShipping prefers JSON-LD shippingDetails for the US', () => {
  const ld = `<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"20","priceCurrency":"USD",
    "shippingDetails":[{"@type":"OfferShippingDetails","shippingRate":{"@type":"MonetaryAmount","value":"0","currency":"USD"},"shippingDestination":{"@type":"DefinedRegion","addressCountry":"US"}},
    {"@type":"OfferShippingDetails","shippingRate":{"@type":"MonetaryAmount","value":"25","currency":"USD"},"shippingDestination":{"@type":"DefinedRegion","addressCountry":"CA"}}]}}</script><p>Shipping calculated at checkout</p>`;
  assert.deepEqual(P.findShipping(ld), { kind: 'free', text: 'Free shipping', source: 'json-ld' });
  const paid = `<script type="application/ld+json">{"@type":"OfferShippingDetails","shippingRate":{"value":"7.95","currency":"USD"},"shippingDestination":{"addressCountry":"US"}}</script>`;
  assert.deepEqual(P.findShipping(paid), { kind: 'flat', text: '$7.95 shipping', amount: 7.95, currency: 'USD', source: 'json-ld' });
});

test('visibleText drops scripts and tags', () => {
  assert.equal(P.visibleText('<p>Free <b>shipping</b></p><script>var a = "shipping";</script>').trim(), 'Free shipping');
});

test('report lists new shipping statements', () => {
  const product = { name: 'Rattle', url: 'https://x.test/p', store: 'X', price: '$10' };
  const rows = [
    { entry: 'a', product, status: 'same', detail: '', notes: [], found: { amount: 10, currency: 'USD', source: 'json-ld' }, recordedUsd: 10, shipping: { kind: 'free', text: 'Free shipping' }, newShipping: 'Free shipping' },
    { entry: 'b', product: Object.assign({ shipping: 'Free shipping' }, product), status: 'same', detail: '', notes: [], found: { amount: 10, currency: 'USD', source: 'json-ld' }, recordedUsd: 10, shipping: { kind: 'free', text: 'Free shipping' } }
  ];
  const md = P.buildReport(rows, '2026-10-19');
  assert.match(md, /## Shipping\n\n2 of 2 pages state a shipping policy; 1 new or changed:/);
  assert.match(md, /\| a \| .* \| X \| — \| Free shipping \|/);
});
