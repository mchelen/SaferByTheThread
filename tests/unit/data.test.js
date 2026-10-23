'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../../assets/catalog.js');

const root = path.join(__dirname, '..', '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const gloss = JSON.parse(fs.readFileSync(path.join(root, 'glossary.json'), 'utf8'));

test('tools/check.js passes on the committed data', () => {
  const out = execFileSync('node', [path.join(root, 'tools/check.js')], { encoding: 'utf8' });
  assert.doesNotMatch(out, /PROBLEM/);
});

test('every glossary term id is unique and every criterion term exists', () => {
  const ids = gloss.sections.flatMap(s => s.terms.map(t => t.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const c of data.criteria) if (c.term) assert.ok(ids.includes(c.term), `criterion ${c.id} → ${c.term}`);
});

test('the default rules keep the same set of listings as the published site', () => {
  const c = S.build(data);
  const on = Object.fromEntries(c.criteria.map(x => [x.id, !!x.default]));
  const ok = c.items.filter(i => S.evaluate(i, c.criteria, on, false).ok);
  // 64 of 122 met the defaults on 2026-10-18; 72 since 2026-10-20, when guessed materials ("probably plastic") became "not stated"; 79 of 137 after the 2026-10-20 daily research run; 88 of 152 after the 2026-10-21 run; 96 of 167 after the 2026-10-22 run; 104 of 182 after the 2026-10-23 run. Update both numbers when listings change.
  assert.equal(c.items.length, 182);
  assert.equal(ok.length, 104);
});

test('every checklist chip links at least one glossary term where the term list covers it', () => {
  const known = Object.fromEntries(gloss.sections.flatMap(s => s.terms.map(t => [t.id, 1])));
  let chips = 0, linked = 0;
  for (const e of data.entries)
    for (const chip of e.uses) { chips++; if (S.termRuns(chip, known).some(r => r[1])) linked++; }
  assert.ok(linked / chips > 0.85, `${linked} of ${chips} "made with" chips link a term`);
});

test('index.html declares a title, viewport and the two scripts', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<title>Saved by the Thread<\/title>/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /assets\/catalog\.js/);
  assert.match(html, /assets\/app\.js/);
  assert.match(html, /<!--INLINE-DATA-->/, 'bundle.js needs the inline-data marker');
});
