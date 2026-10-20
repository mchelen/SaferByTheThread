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

if (data.schema !== 4) problems.push('data.json schema must be 4');
const critIds = new Set(data.criteria.map(c => c.id));
const stdIds = new Set((data.standards || []).map(s => s.id));
const termIds = new Set(gloss.sections.flatMap(s => s.terms.map(t => t.id)));
for (const c of data.criteria) {
  if (!['avoid', 'require', 'contains'].includes(c.kind)) problems.push(`criterion ${c.id}: bad kind ${c.kind}`);
  if (c.term && !termIds.has(c.term)) warn.push(`criterion ${c.id}: glossary term ${c.term} not found`);
}
for (const s of data.standards || []) if (s.term && !termIds.has(s.term)) warn.push(`standard ${s.id}: glossary term ${s.term} not found`);
const cgIds = new Set((data.criteria_groups || []).map(g => g.id));
for (const c of data.criteria) if (c.group && !cgIds.has(c.group)) problems.push(`criterion ${c.id}: unknown group ${c.group}`);
const typeIds = new Set();
for (const t of data.types) {
  if (typeIds.has(t.id)) problems.push(`type ${t.id}: duplicate id`);
  typeIds.add(t.id);
  if (!t.title) problems.push(`type ${t.id}: missing title`);
  if (!t.ages || typeof t.ages.min_months !== 'number' || typeof t.ages.max_months !== 'number' || t.ages.min_months >= t.ages.max_months) problems.push(`type ${t.id}: ages needs min_months < max_months`);
}
const inAisle = new Set();
for (const a of data.aisles) {
  if (!a.id || !a.title) problems.push('aisle without id or title');
  for (const t of a.types) { if (!typeIds.has(t)) problems.push(`aisle ${a.id}: unknown type ${t}`); inAisle.add(t); }
}

const ids = new Set();
const SYNTH = S.MATERIALS.filter(m => m.id === 'synthetic')[0].rx;
const COMPOSITE = /plywood|\bmdf\b|fib(?:er|re) ?board|particle ?board|veneer|layered (?:birch|wood|poplar)/i;
const REMARK = /\bLFGB\b|certif|regulatory|\bclaim\b|not published|\btested?\b|\btesting\b|not padded|flagged/i;
// A Made with line names a material; a part named only by its construction or job ("fleece lining", "padding", "frame") is not stated.
const MATERIAL = /wool|merino|mohair|alpaca|cashmere|lambswool|felt|melton|cotton|terry|muslin|flannel|linen|hemp|flax|jute|ramie|silk|wood|maple|beech|birch|pine|walnut|cherry|oak|poplar|\bash\b|hardwood|bamboo|rubber|latex|leather|calfskin|suede|sheepskin|shearling|hide|nubuck|coir|kapok|buckwheat|\bdown\b|feather|silicone|stainless|steel|metal|brass|alumin|iron|zinc|glass|ceramic|stoneware|porcelain|enamel|paper|cardboard|cork|beeswax|\bwax|\boil\b|lacquer|shellac|varnish|dyes?\b|pigment|paint|ink|tencel|lyocell|modal|viscose|rayon|clay|stone|marble|sand|salt|water|seed|husk|straw|rattan|wicker|seagrass|sisal|lanolin|wheat|rice|soy|corn|sugarcane|plant/i;
const GUESS = /\b(?:probably|likely|often|usually|typically|presumably|possibly|may be|might be|looks like|seems|appears to)\b/i;
let entries = 0, products = 0, missingImg = 0;
for (const e of data.entries) {
  entries++;
  const where = `${e.type}/${e.id}`;
  if (!typeIds.has(e.type)) problems.push(`${where}: unknown type`);
  else if (!inAisle.has(e.type)) problems.push(`${where}: type ${e.type} is in no aisle`);
  if (ids.has(e.id)) problems.push(`${where}: duplicate id`);
  ids.add(e.id);
  for (const k of ['brand', 'line', 'uses', 'free', 'unconfirmed', 'facts', 'products']) if (e[k] == null) problems.push(`${where}: missing ${k}`);
  for (const [k, v] of Object.entries(e.facts || {})) {
    if (!critIds.has(k)) problems.push(`${where}: unknown criterion ${k}`);
    if (!['yes', 'no', 'unknown'].includes(v)) problems.push(`${where}: fact ${k} = ${v}`);
  }
  // Listings report what pages say; a guess about a part ("probably plastic", "often polyester") belongs in the
  // product type's intro, and the part itself under unconfirmed.
  for (const k of ['uses', 'free', 'unconfirmed', 'outside']) for (const t of e[k] || []) {
    const m = t.match(GUESS); if (m) problems.push(`${where}: ${k} "${t}" guesses ("${m[0]}"); record what the page says and list the part as not stated`);
  }
  // Made with lists only what no default filter flags; synthetics and composite wood are flagged parts.
  for (const t of e.uses || []) {
    if (!MATERIAL.test(t)) problems.push(`${where}: uses "${t}" names no material; a part whose material the page does not name goes under unconfirmed`);
    if (SYNTH.test(t) || COMPOSITE.test(t)) problems.push(`${where}: uses "${t}" is synthetic or composite wood; list it under outside`);
    if ((e.outside || []).includes(t)) problems.push(`${where}: "${t}" is under both uses and outside`);
  }
  // Flagged parts name a material or part; a remark about a test, a claim or a page goes under unconfirmed (tagged in
  // unstated) when it is something no page states, or in note otherwise.
  for (const t of e.outside || []) {
    const m = t.match(REMARK); if (m) problems.push(`${where}: outside "${t}" is a remark ("${m[0]}"), not a part; list what is not stated under unconfirmed, or put it in note`);
  }
  for (const [k, parts] of Object.entries(e.unstated || {})) {
    if (!e.facts || e.facts[k] !== 'unknown') problems.push(`${where}: unstated.${k} needs facts.${k} = "unknown"`);
    for (const t of parts) if (!(e.unconfirmed || []).includes(t)) problems.push(`${where}: unstated.${k} "${t}" is not in unconfirmed`);
  }
  for (const x of e.contains || []) if (!['latex', 'leather'].includes(x)) problems.push(`${where}: unknown contains ${x}`);
  for (const x of e.standards || []) if (!stdIds.has(x)) problems.push(`${where}: unknown standard ${x}`);
  if (e.age && typeof e.age.min_months !== 'number') problems.push(`${where}: age.min_months must be a number`);
  if (e.age && e.age.max_months != null && !(e.age.max_months > e.age.min_months)) problems.push(`${where}: age.max_months must be above min_months`);
  if (!e.products.length) problems.push(`${where}: no products`);
  for (const p of e.products) {
    products++;
    for (const k of ['name', 'url', 'store', 'price']) if (!p[k]) problems.push(`${where}: product missing ${k}`);
    if (!('ships_from' in p)) warn.push(`${where}: product "${p.name}" has no ships_from`);
    if (!S.parsePrice(p.price)) warn.push(`${where}: price "${p.price}" not parsed (sorts last)`);
    if (p.price_checked != null && !/^\d{4}-\d{2}-\d{2}$/.test(p.price_checked)) problems.push(`${where}: price_checked "${p.price_checked}" is not YYYY-MM-DD`);
    if (p.variant != null && (typeof p.variant !== 'string' || !p.variant.trim())) problems.push(`${where}: variant must be a non-empty string`);
    if (p.shipping != null && (typeof p.shipping !== 'string' || !p.shipping.trim())) problems.push(`${where}: shipping must be a non-empty string`);
    if (p.rating != null) {
      const r = p.rating;
      if (typeof r.value !== 'number' || r.value <= 0 || r.value > 5) problems.push(`${where}: rating.value must be a number above 0 and at most 5`);
      if (!Number.isInteger(r.count) || r.count < 1) problems.push(`${where}: rating.count must be a whole number of reviews, 1 or more`);
      if (typeof r.via !== 'string' || !r.via) problems.push(`${where}: rating.via must name where the rating was read`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.checked || '')) problems.push(`${where}: rating.checked must be YYYY-MM-DD`);
    }
  }
  if (e.img) {
    if (!fs.existsSync(path.join(root, 'img', e.img + '.jpg'))) { problems.push(`${where}: img/${e.img}.jpg missing`); }
  } else missingImg++;
  for (const ph of e.photos || []) {
    if (!ph.key || !fs.existsSync(path.join(root, 'img', ph.key + '.jpg'))) problems.push(`${where}: photo img/${ph.key}.jpg missing`);
  }
  if (e.photos && e.photos.length && e.img !== e.photos[0].key) problems.push(`${where}: img must be the first of photos`);
}

// The catalog builder must run cleanly over the data.
const cat = S.build(data);
const nOk = cat.items.filter(i => S.evaluate(i, cat.criteria, Object.fromEntries(cat.criteria.map(c => [c.id, !!c.default])), false).ok).length;

for (const w of warn) console.log('warning:', w);
for (const p of problems) console.log('PROBLEM:', p);
console.log(`${entries} listings, ${products} products, ${Object.keys(cat.brands).length} brands, ${termIds.size} glossary terms; ${nOk} meet the default rules; ${missingImg} without a photo`);
process.exit(problems.length ? 1 : 0);
