#!/usr/bin/env node
/* Checks the listing drafts in research/drafts/ against the saved page text and adds the ones that pass to data.json.
   Usage: node tools/ingest.js [--dry-run] [--report FILE]
   A draft is research/drafts/<listing-id>.json: {entry, evidence, candidate?, replace?} where `entry` is a listing as
   README.md describes it and `evidence` holds the words each claim rests on, copied from the page:
     evidence.uses / .free / .outside   {"<checklist line>": "<quote>"}
     evidence.facts                     {"<criterion id>": "<quote>"}   for every fact that is "yes" or "no"
     evidence.standards                 {"<standard id>": "<quote>"}
     evidence.contains                  {"latex"|"leather": "<quote>"}
     evidence.age                       "<quote>"
   Every quote must appear in research/snapshots/<listing-id>.txt (tools/snapshot.js), ignoring case, spacing and
   curly quotes. A claim whose quote is missing or not found is not kept: a checklist line is dropped, a "yes" or "no"
   fact becomes "unknown", a standard or age rating is left out. Words that take a side ("safe", "toxic", "best",
   "avoid", ...) may only appear inside quotation marks, as the maker's own words. A draft that passes is appended to
   `entries` (or replaces the listing with the same id when `replace` is true) with `read` set to today, its draft
   file is removed and its candidate in research/candidates.json is marked listed. A draft that fails stays where it
   is and the report says why. Exit code 0; 1 only when data.json could not be read or written. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRAFTS = path.join(ROOT, 'research', 'drafts');
const SNAP = path.join(ROOT, 'research', 'snapshots');
const TONE = /\b(safe|safer|safest|unsafe|toxic|non-toxic|nontoxic|toxins?|dangerous|harmful|healthy|healthier|best|top pick|avoid|recommend\w*|must-have|clean|chemical-free|pure)\b/i;

function norm(s) {
  return String(s || '').normalize('NFKC').toLowerCase()
    .replace(/[‘’‚‛′]/g, "'").replace(/[“”„‟″]/g, '"').replace(/[‐‑‒–—―]/g, '-')
    .replace(/[®™©]/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}
function found(quote, text) { const q = norm(quote); return q.length >= 3 && text.indexOf(q) >= 0; }
// Tone words are allowed only inside quotation marks, where they are the maker's words.
function toneProblem(s) { const outside = String(s || '').replace(/“[^”]*”|"[^"]*"/g, ' '); const m = outside.match(TONE); return m ? m[0] : null; }

function checkDraft(d, ctx) {
  const problems = [], dropped = [];
  const e = d && d.entry;
  if (!e || !e.id) return { problems: ['no entry or id'], dropped };
  const ev = d.evidence || {};
  const snapFile = path.join(SNAP, e.id + '.txt');
  if (!fs.existsSync(snapFile)) return { problems: ['no snapshot research/snapshots/' + e.id + '.txt'], dropped };
  const text = norm(fs.readFileSync(snapFile, 'utf8'));
  if (!ctx.types.has(e.type)) problems.push('unknown type ' + e.type);
  if (ctx.ids.has(e.id) && !d.replace) problems.push('id already in data.json (set "replace": true to re-read a listing)');
  for (const k of ['brand', 'line']) if (!e[k]) problems.push('missing ' + k);
  for (const k of ['uses', 'free', 'unconfirmed', 'outside']) if (!Array.isArray(e[k])) e[k] = [];
  // Checklist lines need their quote; dropped lines are reported.
  for (const k of ['uses', 'free', 'outside']) {
    const q = ev[k] || {};
    e[k] = e[k].filter((line) => { const ok = found(q[line], text); if (!ok) dropped.push(k + ': ' + line); return ok; });
  }
  // Conventional listings may name only synthetics (under outside) or only what is absent: one backed line is enough.
  if (!e.uses.length && !e.outside.length && !e.free.length) problems.push('no "made with", "flagged" or "stated free of" line is backed by a quote from the page');
  e.facts = e.facts || {};
  for (const [c, v] of Object.entries(e.facts)) {
    if (!ctx.crit.has(c)) { problems.push('unknown criterion ' + c); continue; }
    if (!['yes', 'no', 'unknown'].includes(v)) { problems.push('fact ' + c + ' = ' + v); continue; }
    if (v !== 'unknown' && !found((ev.facts || {})[c], text)) { e.facts[c] = 'unknown'; dropped.push('fact ' + c + ': ' + v + ' → unknown'); }
  }
  e.standards = (e.standards || []).filter((s) => { const ok = ctx.std.has(s) && found((ev.standards || {})[s], text); if (!ok) dropped.push('standard ' + s); return ok; });
  e.contains = (e.contains || []).filter((c) => {
    const ok = ['latex', 'leather'].includes(c) && (found((ev.contains || {})[c], text) || e.uses.some((u) => (c === 'latex' ? /rubber|latex/i : /leather|suede|sheepskin/i).test(u)));
    if (!ok) dropped.push('contains ' + c); return ok;
  });
  if (e.age && !(typeof e.age.min_months === 'number' && e.age.text && found(ev.age, text))) { delete e.age; dropped.push('age rating'); }
  if (e.quote && !found(e.quote, text)) { delete e.quote; dropped.push('quote'); }
  for (const k of ['uses', 'free', 'unconfirmed', 'outside']) for (const line of e[k]) { const w = toneProblem(line); if (w) problems.push(`"${w}" outside quotation marks in ${k}: ${line}`); }
  if (e.note && toneProblem(e.note)) problems.push(`"${toneProblem(e.note)}" outside quotation marks in note`);
  if (!Array.isArray(e.products) || !e.products.length) problems.push('no products');
  for (const p of e.products || []) {
    for (const k of ['name', 'url', 'store', 'price']) if (!p[k]) problems.push('product missing ' + k);
    if (p.url && !/^https?:\/\//.test(p.url)) problems.push('product url must be http(s)');
    if (!('ships_from' in p)) p.ships_from = null;
  }
  return { problems, dropped, entry: e };
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const reportFile = args.includes('--report') ? args[args.indexOf('--report') + 1] : null;
  const file = path.join(ROOT, 'data.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const candFile = path.join(ROOT, 'research', 'candidates.json');
  const cands = fs.existsSync(candFile) ? JSON.parse(fs.readFileSync(candFile, 'utf8')) : { candidates: [] };
  const ctx = {
    types: new Set(data.types.map((t) => t.id)), crit: new Set(data.criteria.map((c) => c.id)),
    std: new Set((data.standards || []).map((s) => s.id)), ids: new Set(data.entries.map((e) => e.id))
  };
  const today = new Date().toISOString().slice(0, 10);
  const files = fs.existsSync(DRAFTS) ? fs.readdirSync(DRAFTS).filter((f) => f.endsWith('.json')).sort() : [];
  const added = [], failed = [];
  for (const f of files) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(DRAFTS, f), 'utf8')); } catch (err) { failed.push({ f, problems: ['not valid JSON: ' + err.message], dropped: [] }); continue; }
    const r = checkDraft(d, ctx);
    if (r.problems.length) { failed.push(Object.assign({ f }, r)); continue; }
    const e = r.entry;
    e.read = today;
    const at = data.entries.findIndex((x) => x.id === e.id);
    if (at >= 0) { const old = data.entries[at]; for (const k of ['img', 'img_src', 'photos']) if (old[k] && !e[k]) e[k] = old[k]; data.entries[at] = e; }
    else data.entries.push(e);
    ctx.ids.add(e.id);
    const urls = new Set([d.candidate].concat(e.products.map((p) => p.url)).filter(Boolean));
    cands.candidates.forEach((c) => { if (urls.has(c.url)) { c.status = 'listed'; c.listing = e.id; } });
    added.push({ f, id: e.id, type: e.type, dropped: r.dropped, replaced: at >= 0 });
    if (!dry) fs.unlinkSync(path.join(DRAFTS, f));
  }
  if (!dry && added.length) {
    data.updated = today;
    fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
    if (fs.existsSync(candFile)) fs.writeFileSync(candFile, JSON.stringify(cands, null, 1) + '\n');
  }
  const lines = ['# Listing drafts', '', `${files.length} drafts read; ${added.length} added to data.json${dry ? ' (dry run, nothing written)' : ''}; ${failed.length} left in research/drafts with problems.`, ''];
  if (added.length) {
    lines.push('## Added', '');
    added.forEach((a) => lines.push(`- **${a.id}** (${a.type})${a.replaced ? ', replacing the earlier listing' : ''}${a.dropped.length ? '. Not kept, no matching quote on the page: ' + a.dropped.join('; ') : ''}`));
    lines.push('');
  }
  if (failed.length) {
    lines.push('## Problems', '');
    failed.forEach((x) => lines.push(`- **${x.f}**: ${x.problems.join('; ')}`));
    lines.push('');
  }
  const report = lines.join('\n');
  if (reportFile) fs.writeFileSync(reportFile, report);
  console.log(report);
}

module.exports = { norm, found, toneProblem, checkDraft };
if (require.main === module) { try { main(); } catch (e) { console.error(e && e.stack || e); process.exit(1); } }
