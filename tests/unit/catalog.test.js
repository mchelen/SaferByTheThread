'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../assets/catalog.js');

test('parsePrice reads plain, range and prefixed dollar prices', () => {
  assert.deepEqual(S.parsePrice('$425'), { usd: 425, approx: false });
  assert.deepEqual(S.parsePrice('$29.95 to $37.10'), { usd: 29.95, approx: false });
  assert.deepEqual(S.parsePrice('from $653'), { usd: 653, approx: false });
  assert.deepEqual(S.parsePrice('$1,295 to $1,995'), { usd: 1295, approx: false });
  assert.deepEqual(S.parsePrice('$17.95 (sale; regular $30.00)'), { usd: 17.95, approx: false });
  assert.deepEqual(S.parsePrice('about $35'), { usd: 35, approx: true });
});

test('parsePrice ignores shipping and converts other currencies', () => {
  assert.deepEqual(S.parsePrice('about $98 plus $33 shipping from Australia'), { usd: 98, approx: true });
  assert.deepEqual(S.parsePrice('from £207.50 (about $270), free US shipping'), { usd: 270, approx: true });
  assert.equal(S.parsePrice('£30').approx, true);
  assert.ok(S.parsePrice('£30').usd > 30, 'pounds convert to more dollars');
  assert.ok(S.parsePrice('about NZ$45').usd < 45, 'NZ dollars convert to fewer US dollars');
  assert.ok(S.parsePrice('CAD $53.99').usd < 53.99);
  assert.equal(S.parsePrice('price on request'), null);
  assert.equal(S.parsePrice(''), null);
});

test('money formats cents only under $100', () => {
  assert.equal(S.money(9.99), '$9.99');
  assert.equal(S.money(35), '$35');
  assert.equal(S.money(1295), '$1,295');
});

const criteria = [
  { id: 'main', short: 'Main materials', kind: 'avoid', default: true },
  { id: 'silicone', short: 'Silicone testing', kind: 'require', default: true },
  { id: 'latex', short: 'Latex', kind: 'contains', default: false }
];
const on = (o) => Object.assign({ main: true, silicone: true, latex: false }, o);

test('evaluate: avoid switches miss on "no", flag "unknown" as not stated', () => {
  const item = { facts: { main: 'no' }, contains: [] };
  assert.equal(S.evaluate(item, criteria, on(), false).ok, false);
  assert.equal(S.evaluate(item, criteria, on({ main: false }), false).ok, true, 'switch off: no miss');
  const unk = { facts: { main: 'unknown' }, contains: [] };
  const r = S.evaluate(unk, criteria, on(), false);
  assert.equal(r.ok, true);
  assert.deepEqual(r.unst.map(c => c.id), ['main']);
  assert.equal(S.evaluate(unk, criteria, on(), true).ok, false, 'strict counts unstated as a miss');
});

test('evaluate: require switches miss unless "yes"; facts that do not apply are skipped', () => {
  assert.equal(S.evaluate({ facts: { silicone: 'unknown' }, contains: [] }, criteria, on(), false).ok, false);
  assert.equal(S.evaluate({ facts: { silicone: 'yes' }, contains: [] }, criteria, on(), false).ok, true);
  assert.equal(S.evaluate({ facts: {}, contains: [] }, criteria, on(), false).ok, true, 'a wooden toy has no silicone fact');
});

test('evaluate: contains switches hide latex only when on', () => {
  const ball = { facts: { main: 'yes' }, contains: ['latex'] };
  assert.equal(S.evaluate(ball, criteria, on(), false).ok, true);
  assert.equal(S.evaluate(ball, criteria, on({ latex: true }), false).ok, false);
});

function sample() {
  return {
    schema: 4, updated: '2026-10-18', ask: [], criteria, standards: [{ id: 'gots', label: 'GOTS', term: 'gots' }],
    aisles: [{ id: 'play', title: 'Play', blurb: '', was: ['toys'], types: ['balls', 'mats'] }, { id: 'nursery', title: 'Nursery', types: ['rugs', 'mats'] }],
    types: [{ id: 'balls', title: 'Balls', ages: { min_months: 0, max_months: 60 } }, { id: 'mats', title: 'Play mats', ages: { min_months: 0, max_months: 24 } }, { id: 'rugs', title: 'Rugs', ages: { min_months: 0, max_months: 72 } }],
    entries: [
      { id: 'b-mat', type: 'mats', brand: 'Home of Wool', line: 'Play mat', uses: ['Organic wool batting', 'Organic cotton casing'], free: [], unconfirmed: [], outside: ['Polyester thread'],
        facts: { main: 'yes' }, contains: [], img: 'mat', photos: [{ key: 'mat', src: 'https://example.com/1.jpg' }, { key: 'mat-2', src: 'https://example.com/2.jpg' }],
        products: [{ name: 'Mat', url: 'https://example.com', store: 'Home of Wool', price: 'from £207.50 (about $270)', ships_from: 'UK' },
                   { name: 'Mat large', url: 'https://example.com', store: 'Home of Wool', price: 'price on request', ships_from: null }] },
      { id: 'a-ball', type: 'balls', brand: 'Hevea', line: 'Star ball', uses: ['Natural rubber', '“Natural” colour'], free: [], unconfirmed: ['Colourant'], outside: [],
        facts: { main: 'yes' }, contains: ['latex'], standards: ['gots'], age: { min_months: 18, text: 'Rated 18 months and up' },
        products: [{ name: 'Star ball', url: 'https://example.com', store: 'Shop', price: '$24.99', ships_from: 'US' }] }
    ]
  };
}

test('build orders listings by aisle and type, and derives materials, prices, ages and shipping facets', () => {
  const c = S.build(sample());
  assert.equal(c.items.length, 2);
  const ball = c.items[0], mat = c.items[1];
  assert.equal(ball.id, 'a-ball', 'types in aisle order, not file order');
  assert.deepEqual(ball.materials, ['latex']);
  assert.deepEqual(ball.ageBands, ['12-24m', '2-3y', '3-5y'], 'maker rating from 18 months, open-ended up to the type range (5 years)');
  assert.equal(ball.ageLabel, 'Rated 18 months and up');
  assert.deepEqual(ball.ships, ['us']);
  assert.equal(S.priceLabel(ball), '$24.99');
  assert.deepEqual(mat.materials, ['wool', 'cotton', 'synthetic'], 'flagged parts count towards made-with');
  assert.deepEqual(mat.ageBands, ['0-6m', '6-12m', '12-24m'], 'no maker rating: the usual ages for the type');
  assert.equal(mat.ageStated, false);
  assert.equal(mat.ageLabel, 'Birth to 2 years');
  assert.deepEqual(mat.aisles, ['play'], 'an aisle with no listings of its own types is hidden');
  assert.equal(mat.group, 'play');
  assert.deepEqual(mat.photos, ['img/mat.jpg', 'img/mat-2.jpg']);
  assert.deepEqual(mat.ships.sort(), ['abroad', 'unknown']);
  assert.equal(mat.min, 270);
  assert.equal(S.priceLabel(mat), 'about $270');
  assert.equal(c.brands['home-of-wool'].items.length, 1);
  assert.deepEqual(c.groups.map(g => g.cats), [['balls', 'mats']], 'empty types and borrowed-only aisles are hidden');
  const d = sample();
  d.entries.push(Object.assign({}, d.entries[0], { id: 'c-rug', type: 'rugs', line: 'Rug', photos: undefined, img: undefined }));
  const c2 = S.build(d);
  assert.deepEqual(c2.groups.map(g => g.cats), [['balls', 'mats'], ['rugs', 'mats']]);
  assert.deepEqual(c2.items.find(i => i.id === 'b-mat').aisles, ['play', 'nursery'], 'a type can sit in two aisles');
  assert.ok(ball.q.includes('hevea') && ball.q.includes('balls') && ball.q.includes('natural rubber') && ball.q.includes('play'), 'search text covers brand, type, aisle and materials');
});

test('ageText words month and year ranges', () => {
  assert.equal(S.ageText(0, 24), 'Birth to 2 years');
  assert.equal(S.ageText(6, 18), '6 to 18 months');
  assert.equal(S.ageText(18, 60), '18 months to 5 years');
  assert.equal(S.ageText(12, 72), '12 months and up');
  assert.equal(S.ageText(0, 72), 'From birth');
});

test('priceLabel says when there is no price', () => {
  const c = S.build(sample());
  c.items[0].min = null;
  assert.equal(S.priceLabel(c.items[0]), 'See store for price');
});

test('termRuns links glossary terms without overlapping and respects the known set', () => {
  const runs = S.termRuns('GOTS organic cotton cover', { gots: 1, organic: 1, cotton: 1 });
  assert.deepEqual(runs, [['GOTS', 'gots'], [' ', null], ['organic', 'organic'], [' ', null], ['cotton', 'cotton'], [' cover', null]]);
  assert.deepEqual(S.termRuns('Superwash merino', { superwash: 1 }), [['Superwash', 'superwash'], [' merino', null]]);
  assert.deepEqual(S.termRuns('No terms here', {}), [['No terms here', null]]);
});

test('fold and slug normalise accents and punctuation', () => {
  assert.equal(S.fold('Lékué Béaba'), 'lekue beaba');
  assert.equal(S.slug("Sarah’s Silks"), 'sarah-s-silks');
});

test('shipping cost reads free, flat, free-over-a-minimum and checkout statements', () => {
  assert.equal(S.shipCost({ price: '$40', usd: 40, shipping: 'Free shipping' }), 0);
  assert.equal(S.shipCost({ price: '$40', usd: 40, shipping: '$9.95 shipping' }), 9.95);
  assert.equal(S.shipCost({ price: '$60', usd: 60, shipping: 'Free shipping on orders over $50' }), 0);
  assert.equal(S.shipCost({ price: '$40', usd: 40, shipping: 'Free shipping on orders over $50' }), null);
  assert.equal(S.shipCost({ price: '$40', usd: 40, shipping: 'Free shipping on orders over $129.99, $25 below' }), 25);
  assert.equal(S.shipCost({ price: '$84', usd: 84, shipping: 'Free shipping on orders over $150, $84 below' }), null, 'a rate equal to the price is a misread');
  assert.equal(S.shipCost({ price: '$40', usd: 40, shipping: 'Shipping calculated at checkout' }), null);
  assert.equal(S.shipCost({ price: '$39.50, free US shipping', usd: 39.5 }), 0);
  assert.equal(S.shipCost({ price: '$30 plus $8 shipping', usd: 30 }), 8);
});

test('each part carries the materials it names, for the material chips', () => {
  const C = S.build(require('../../data.json'));
  const tejo = C.items.find(i => i.id === 'wildling-tejo-toddler');
  assert.deepEqual(tejo.usesMats, [['cotton'], ['wool']]);
  assert.ok(tejo.outMats.every(ms => ms.includes('synthetic')), 'the membrane and the synthetic rubber sole are synthetic parts');
  const mat = C.items.find(i => i.id === 'home-of-wool-organic-baby-play-mat');
  assert.deepEqual(mat.usesMats[3].slice().sort(), ['cotton', 'linen', 'wool'], 'a part naming three materials counts under each');
});
