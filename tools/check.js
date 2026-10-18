#!/usr/bin/env node
/* Validates data.json and glossary.json and prints a short summary.
   Usage: node tools/check.js    (exit code 1 on any problem) */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('../assets/catalog.js');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const gloss = JSON.parse(fs.readFileSync(path.join(root, 'glossary.json'), 'utf8'));
const problems = [];
const warn = [];

if (data.schema !== 3) problems.push('data.json schema must be 3');
const critIds = new Set(data.criteria.map(c => c.id));
const stdIds = new Set((data.standards || []).map(s => s.id));
const termIds = new Set(gloss.sections.flatMap(s => s.terms.map(t => t.id)));
for (const c of data.criteria) {
  if (!['avoid', 'require', 'contains'].includes(c.kind)) problems.push(`criterion ${c.id}: bad kind ${c.kind}`);
  if (c.term && !termIds.has(c.term)) warn.push(`criterion ${c.id}: glossary term ${c.term} not found`);
}
for (const s of data.standards || []) if (s.term && !termIds.has(s.term)) warn.push(`standard ${s.id}: glossary term ${s.term} not found`);

const ids = new Set();
let entries = 0, products = 0, missingImg = 0;
for (const g of data.groups) for (const c of g.categories) for (const e of c.entries) {
  entries++;
  const where = `${c.id}/${e.id}`;
  if (ids.has(e.id)) problems.push(`${where}: duplicate id`);
  ids.add(e.id);
  for (const k of ['brand', 'line', 'uses', 'free', 'unconfirmed', 'facts', 'products']) if (e[k] == null) problems.push(`${where}: missing ${k}`);
  for (const [k, v] of Object.entries(e.facts || {})) {
    if (!critIds.has(k)) problems.push(`${where}: unknown criterion ${k}`);
    if (!['yes', 'no', 'unknown'].includes(v)) problems.push(`${where}: fact ${k} = ${v}`);
  }
  for (const x of e.contains || []) if (!['latex', 'leather'].includes(x)) problems.push(`${where}: unknown contains ${x}`);
  for (const x of e.standards || []) if (!stdIds.has(x)) problems.push(`${where}: unknown standard ${x}`);
  if (e.age && typeof e.age.min_months !== 'number') problems.push(`${where}: age.min_months must be a number`);
  if (!e.products.length) problems.push(`${where}: no products`);
  for (const p of e.products) {
    products++;
    for (const k of ['name', 'url', 'store', 'price']) if (!p[k]) problems.push(`${where}: product missing ${k}`);
    if (!('ships_from' in p)) warn.push(`${where}: product "${p.name}" has no ships_from`);
    if (!S.parsePrice(p.price)) warn.push(`${where}: price "${p.price}" not parsed (sorts last)`);
    if (p.price_checked != null && !/^\d{4}-\d{2}-\d{2}$/.test(p.price_checked)) problems.push(`${where}: price_checked "${p.price_checked}" is not YYYY-MM-DD`);
    if (p.variant != null && (typeof p.variant !== 'string' || !p.variant.trim())) problems.push(`${where}: variant must be a non-empty string`);
  }
  if (e.img) {
    if (!fs.existsSync(path.join(root, 'img', e.img + '.jpg'))) { problems.push(`${where}: img/${e.img}.jpg missing`); }
  } else missingImg++;
}

// The catalog builder must run cleanly over the data.
const cat = S.build(data);
const nOk = cat.items.filter(i => S.evaluate(i, cat.criteria, Object.fromEntries(cat.criteria.map(c => [c.id, !!c.default])), false).ok).length;

for (const w of warn) console.log('warning:', w);
for (const p of problems) console.log('PROBLEM:', p);
console.log(`${entries} listings, ${products} products, ${Object.keys(cat.brands).length} brands, ${termIds.size} glossary terms; ${nOk} meet the default rules; ${missingImg} without a photo`);
process.exit(problems.length ? 1 : 0);
