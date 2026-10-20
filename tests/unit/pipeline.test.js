'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../../tools/ingest.js');
const D = require('../../tools/discover.js');

const root = path.join(__dirname, '..', '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));

test('quotes match the saved page ignoring case, spacing and curly quotes', () => {
  const text = I.norm('Made from 100%  “Organic” Cotton ®\n and natural rubber.');
  assert.ok(I.found('made from 100% "organic" cotton and natural rubber', text));
  assert.ok(!I.found('made from polyester', text));
  assert.ok(!I.found('', text), 'an empty quote never counts');
});

test('words that take a side are allowed only as the maker’s quoted words', () => {
  assert.equal(I.toneProblem('Child-safe paint'), 'safe');
  assert.equal(I.toneProblem('Paint described as “non-toxic”'), null);
  assert.equal(I.toneProblem('Organic cotton'), null);
});

test('a draft keeps only the claims its quotes back up', () => {
  const id = 'zz-test-draft';
  const snap = path.join(root, 'research', 'snapshots', id + '.txt');
  fs.mkdirSync(path.dirname(snap), { recursive: true });
  fs.writeFileSync(snap, 'This cup is made of 18/8 stainless steel with a food-grade silicone sleeve. BPA free. Tested to CPSIA.');
  try {
    const draft = {
      entry: { id, type: data.types[0].id, brand: 'Test', line: 'Cup', uses: ['18/8 stainless steel', 'Silicone sleeve', 'Bamboo lid'], free: ['BPA'], unconfirmed: [], outside: [],
        facts: { main: 'no', parts: 'yes' }, standards: ['us-toy'], age: { min_months: 6, text: '6 months and up' },
        products: [{ name: 'Cup', url: 'https://example.com/cup', store: 'Test', price: '$20' }] },
      evidence: { uses: { '18/8 stainless steel': 'made of 18/8 stainless steel', 'Silicone sleeve': 'food-grade silicone sleeve', 'Bamboo lid': 'bamboo lid' },
        free: { BPA: 'BPA free' }, facts: { main: 'silicone sleeve' }, standards: { 'us-toy': 'Tested to CPSIA' } }
    };
    const ctx = { types: new Set(data.types.map(t => t.id)), crit: new Set(data.criteria.map(c => c.id)), std: new Set(data.standards.map(s => s.id)), ids: new Set() };
    const r = I.checkDraft(draft, ctx);
    assert.deepEqual(r.problems, []);
    assert.deepEqual(r.entry.uses, ['18/8 stainless steel', 'Silicone sleeve'], 'the lid line has no quote on the page');
    assert.equal(r.entry.facts.main, 'no');
    assert.equal(r.entry.facts.parts, 'unknown', 'a yes without a quote becomes unknown');
    assert.deepEqual(r.entry.standards, ['us-toy']);
    assert.equal(r.entry.age, undefined, 'an age rating needs its quote');
    assert.equal(r.entry.products[0].ships_from, null);
    const bad = I.checkDraft({ entry: Object.assign({}, draft.entry, { uses: ['Child-safe steel'] }), evidence: { uses: { 'Child-safe steel': 'stainless steel' } } }, ctx);
    assert.ok(bad.problems.some(p => /safe/.test(p)));
  } finally { fs.unlinkSync(snap); }
});

test('discovery picks the product type whose pattern matches the title best', () => {
  const types = data.types;
  assert.equal(D.guessType(types, 'Natural Rubber Ball Set'), 'balls');
  assert.equal(D.guessType(types, 'Organic Crib Mattress Protector'), 'protectors');
  assert.equal(D.guessType(types, 'Organic Crib Mattress'), 'mattresses');
  assert.equal(D.guessType(types, 'Gift card'), null);
  for (const t of types) if (t.match) new RegExp(t.match, 'i');
  assert.equal(D.normUrl('https://www.Example.com/products/cup/'), 'example.com/products/cup');
});
