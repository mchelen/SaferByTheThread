// Unit tests for the rating reader in tools/ratings.js and how prices.js records it. No network.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../tools/ratings.js');
const P = require('../../tools/prices.js');

test('JSON-LD AggregateRating on the page product, with reviewCount or ratingCount', () => {
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Mattress",
    "aggregateRating":{"@type":"AggregateRating","ratingValue":"4.74","ratingCount":"27"}}</script>`;
  assert.deepEqual(R.ratingFromHtml(html), { value: 4.74, count: 27, via: 'json-ld' });
  const graph = `<script type="application/ld+json">{"@graph":[{"@type":"WebPage"},{"@type":"ProductGroup","aggregateRating":{"ratingValue":4.9,"reviewCount":1020}}]}</script>`;
  assert.deepEqual(R.ratingFromHtml(graph), { value: 4.9, count: 1020, via: 'json-ld' });
});

test('no reviews, or a rating nested in a related product, is not a rating', () => {
  assert.equal(R.ratingFromHtml(`<script type="application/ld+json">{"@type":"Product","aggregateRating":{"reviewCount":0,"ratingValue":0}}</script>`), null);
  assert.equal(R.ratingFromHtml(`<script type="application/ld+json">{"@type":"Product","isRelatedTo":[{"@type":"Product","aggregateRating":{"ratingValue":5,"reviewCount":9}}]}</script>`), null);
  assert.equal(R.ratingFromHtml(''), null);
});

test('a 10-point scale is shown out of 5', () => {
  assert.deepEqual(R.make('9', '20', 'json-ld', '10'), { value: 4.5, count: 20, via: 'json-ld' });
});

test('Judge.me: the product review widget, not preview badges of related products', () => {
  const html = `<div class='jdgm-widget jdgm-preview-badge' data-id='2'><div class='jdgm-prev-badge' data-average-rating='4.91' data-number-of-reviews='117'></div></div>
    <div class='jdgm-rev-widg' data-updated-at='2026-10-18T00:11:42Z' data-average-rating='4.83' data-number-of-reviews='902' data-number-of-questions='0'>`;
  assert.deepEqual(R.ratingFromHtml(html), { value: 4.83, count: 902, via: 'judge.me' });
});

test('Shopify reviews metafield, Okendo product data and Loox badge', () => {
  assert.deepEqual(R.ratingFromHtml('MetafieldReviews = {"rating":{"scale_min":"1.0","scale_max":"5.0","value":"4.7"},"rating_count":106};'),
    { value: 4.7, count: 106, via: 'shopify' });
  assert.deepEqual(R.ratingFromHtml('okendoProduct = {"attributeRatings":[],"reviewAverageValue":"4.8","reviewCount":31};'),
    { value: 4.8, count: 31, via: 'okendo' });
  assert.deepEqual(R.ratingFromHtml('<div class="loox-rating" data-id="1" data-rating="4.9" data-raters="59"></div>'),
    { value: 4.9, count: 59, via: 'loox' });
});

test('Yotpo and Junip: the public widget endpoint from keys in the page', async () => {
  const html = `<script src="//staticw2.yotpo.com/short/x.js"></script><script src="//staticw2.yotpo.com/fPjdkSgRDnAoAL4BVf7ZKFzW2dCd809mWzgTNn36/widget.js"></script>
    <div class="yotpo yotpo-main-widget" data-product-id="6686521622661" data-name="The Play Gym"></div>`;
  const reqs = R.widgetRequests(html);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].url, 'https://api-cdn.yotpo.com/v1/widget/fPjdkSgRDnAoAL4BVf7ZKFzW2dCd809mWzgTNn36/products/6686521622661/reviews.json?per_page=1&page=1');
  const got = await R.fetchRating(html, async function () { return { ok: true, text: '{"response":{"bottomline":{"total_review":2699,"average_score":4.9529457}}}' }; });
  assert.deepEqual(got, { value: 4.95, count: 2699, via: 'yotpo' });

  const junip = '<span class="junip-product-review" data-product-id="7509239496843"></span><div data-store-key="1tv5eNguBq6g6Q3xHrpUCCP8"></div>';
  const jr = R.widgetRequests(junip)[0];
  assert.equal(jr.via, 'junip');
  assert.deepEqual(jr.headers, { 'junip-store-key': '1tv5eNguBq6g6Q3xHrpUCCP8' });
  assert.equal(R.parseWidget('junip', '{"products":[{"rating_average":null,"rating_count":0}]}'), null);
  assert.deepEqual(R.parseWidget('junip', '{"products":[{"rating_average":4.6,"rating_count":12}]}'), { value: 4.6, count: 12, via: 'junip' });
});

test('microdata is the last resort, after a review app that answers', async () => {
  const html = '<span itemprop="ratingValue">\n 5\n</span> stars based on <span itemprop="ratingCount">\n 2727\n</span> reviews';
  assert.deepEqual(await R.fetchRating(html, async function () { throw new Error('no network'); }), { value: 5, count: 2727, via: 'microdata' });
});

test('applyRating records, keeps and drops the rating', () => {
  const p = {};
  assert.equal(P.applyRating(p, { value: 4.8, count: 10, via: 'json-ld' }, true, '2026-10-20'), 'new');
  assert.deepEqual(p.rating, { value: 4.8, count: 10, via: 'json-ld', checked: '2026-10-20' });
  assert.equal(P.applyRating(p, { value: 4.8, count: 10, via: 'json-ld' }, true, '2026-10-27'), 'same');
  assert.equal(p.rating.checked, '2026-10-27');
  assert.equal(P.applyRating(p, null, false, '2026-11-03'), null, 'a page that could not be read keeps the rating');
  assert.ok(p.rating);
  assert.equal(P.applyRating(p, null, true, '2026-11-03'), 'dropped');
  assert.equal(p.rating, undefined);
});
