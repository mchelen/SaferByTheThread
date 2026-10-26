'use strict';
/* Browser smoke tests. Needs the playwright package and a Chromium (npx playwright install chromium).
   Serves the repository root on a free port with tools/serve.js, which hands clean URLs to 404.html
   exactly as GitHub Pages does, so no other server is needed. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { serve } = require('../../tools/serve.js');

let server, base, browser;

before(async () => {
  server = await new Promise(r => serve(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); server.close(); });

async function open(url, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // The 404 status of the hand-off page is expected; anything else logged as an error is not.
  page.on('console', m => { if (m.type() === 'error' && !/404 \(Not Found\)/.test(m.text())) errors.push(m.text()); });
  await page.goto(base + url, { waitUntil: 'networkidle' });
  page.errors = errors;
  return page;
}
const count = (page) => page.evaluate(() => document.querySelectorAll('.card').length);

test('home page renders product types, aisles, featured products and the menu', async () => {
  const page = await open('/');
  await page.waitForSelector('.tiles a');
  assert.equal(await page.locator('.tiles a').count(), 7);
  assert.ok((await page.locator('.ttile').count()) >= 20, 'every product type has a picture tile under its category');
  assert.ok((await page.locator('.age-chip').count()) >= 4, 'age chips');
  assert.ok((await count(page)) >= 4, 'featured rail shows products');
  assert.ok((await page.locator('#cats .cat-item[data-dept]').count()) >= 4);
  await page.hover('#cats .cat-item[data-dept] .cat-a');
  await page.waitForSelector('#cats .cat-item.open .mega a');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('a type tile and an age chip on the home page open the matching listing', async () => {
  const page = await open('/');
  await page.click('main .ttile[href$="/c/balls"]');
  await page.waitForSelector('.card');
  assert.match(await page.textContent('h1'), /Balls/);
  assert.ok((await page.locator('.sibling-types .ttile').count()) >= 10, 'a type page shows its sibling types as tiles');
  assert.equal(await page.getAttribute('.sibling-types .ttile.on', 'href'), '/c/balls');
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.click('.age-chip[href*="age=0-6m"]');
  await page.waitForSelector('.card');
  assert.match(page.url(), /age=0-6m/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('the shop, search results, product pages and empty lists offer picture navigation', async () => {
  const page = await open('/shop');
  await page.waitForSelector('.card');
  assert.ok((await page.locator('.sibling-types .ttile').count()) >= 20, 'the shop lists every type as a tile');
  await page.goto(base + '/search?q=wool', { waitUntil: 'networkidle' });
  await page.waitForSelector('.card');
  const hit = await page.locator('.sibling-types .ttile').count();
  assert.ok(hit >= 2 && hit < 20, 'search results show only the types with matches');
  await page.goto(base + '/p/home-of-wool-organic-baby-play-mat', { waitUntil: 'networkidle' });
  await page.waitForSelector('.row-sec .ttile.on');
  assert.match(await page.textContent('.row-sec h2'), /More in/);
  await page.goto(base + '/saved', { waitUntil: 'networkidle' });
  await page.waitForSelector('.empty-tiles .tile');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('clean URLs: a nested path loads through 404.html and keeps its path', async () => {
  const page = await open('/c/balls');
  await page.waitForSelector('.card');
  assert.equal(new URL(page.url()).pathname, '/c/balls');
  assert.match(await page.textContent('h1'), /Balls/);
  assert.match(await page.textContent('.toolbar .count'), /4 products · 4 set aside/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('the shop lists the products that meet the default material filters and sets the rest aside', async () => {
  const page = await open('/shop');
  await page.waitForSelector('.card');
  assert.equal(await count(page), 24, 'first page of results');
  assert.match(await page.textContent('.toolbar .count'), /123 products · 89 set aside/);
  await page.click('[data-more]');
  assert.equal(await count(page), 48, '"Show more" adds a page');
  await page.click('.hidden-note button[data-toggle-all]');
  assert.match(await page.textContent('.toolbar .count'), /212 products/);
  assert.match(page.url(), /all=1/);
  assert.ok((await page.locator('.card .fit.is-miss').count()) >= 1, 'set-aside products say which filter they miss once shown');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('material filters sit in the rail like any other facet and change the results and the URL', async () => {
  const page = await open('/c/balls');
  await page.waitForSelector('.card');
  assert.equal(await page.locator('#rail input[data-crit]').count(), 15);
  await page.click('[data-tnode="s-treat"]');
  await page.check('#f-crit-color');
  assert.ok((await count(page)) > 4, 'allowing synthetic dyes brings painted balls in');
  assert.match(page.url(), /m=/);
  await page.uncheck('#f-crit-color');
  assert.equal(await count(page), 4);
  assert.doesNotMatch(page.url(), /m=/, 'the default set leaves the URL clean');
  await page.close();
});

test('facets, chips and sort work together', async () => {
  const page = await open('/shop');
  await page.waitForSelector('.card');
  await page.check('#rail input[data-facet="cat"][value="mats"]');
  assert.match(page.url(), /cat=mats/);
  assert.equal(await page.locator('.chips .chip-x[data-clear="cat"]').count(), 1);
  assert.ok((await page.locator('.chips .chip-x[data-clear="crit"]').count()) >= 3, 'the chips row lists the material filters that are on');
  await page.selectOption('#sort', 'price-asc');
  const prices = (await page.locator('.card .price').allTextContents()).map(t => parseFloat(t.replace(/[^\d.]/g, '')));
  assert.ok(prices.length >= 2);
  assert.deepEqual(prices, prices.slice().sort((a, b) => a - b));
  await page.click('.chips .chip-x[data-clear="cat"]');
  assert.doesNotMatch(page.url(), /cat=/);
  await page.goBack();
  await page.waitForTimeout(200);
  assert.match(page.url(), /cat=mats/, 'the back button restores the earlier filter');
  await page.close();
});

test('search suggests as you type and the results page lists matches', async () => {
  const page = await open('/');
  await page.waitForSelector('.card');
  await page.fill('#q', 'merino');
  await page.waitForSelector('#sugg a');
  assert.ok((await page.locator('#sugg a').count()) >= 2);
  await page.press('#q', 'Enter');
  await page.waitForSelector('h1:has-text("merino")');
  assert.equal(new URL(page.url()).pathname, '/search');
  assert.ok((await count(page)) >= 1);
  await page.close();
});

test('the material line names the parts no page describes', async () => {
  const page = await open('/p/toki-kids-organic-cotton-mat-40x40');
  await page.waitForSelector('.buybox .fit');
  const lines = (await page.locator('.buybox .fit').allTextContents()).join(' | ');
  assert.match(lines, /Not stated: lining under the cover · side zippers/, 'names the parts no page describes');
  assert.doesNotMatch(lines, /Not stated: Main materials/);
  await page.close();
});

test('product page shows the buy box, checklist, filter table and a glossary popover', async () => {
  const page = await open('/p/obasan-organic-crib-mattress');
  await page.waitForSelector('.pdp');
  assert.match(await page.textContent('.buybox h1'), /Organic Crib Mattress/);
  assert.ok((await page.locator('.offer .btn-buy').count()) >= 1);
  assert.match(await page.textContent('.offer .btn-buy'), /Buy at/);
  assert.ok(await page.evaluate(() => document.querySelector('.buybox .offers').compareDocumentPosition(document.querySelector('.buybox .made')) & Node.DOCUMENT_POSITION_FOLLOWING), 'store buttons come before the materials summary');
  assert.ok((await page.locator('.check .row').count()) >= 3);
  await page.click('.check .term-link');
  const pop = page.locator('#gpop');
  assert.equal(await pop.isVisible(), true);
  assert.match(await pop.textContent(), /Full entry/);
  await page.keyboard.press('Escape');
  assert.equal(await pop.isVisible(), false);
  assert.ok((await page.locator('#materials .ftable tbody tr').count()) >= 3, 'the materials section reads the product against each filter');
  assert.equal(await page.locator('#materials input').count(), 0, 'no filter switches on the product page');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('save and compare keep lists across pages', async () => {
  const page = await open('/c/balls');
  await page.waitForSelector('.card');
  await page.click('.card .save-btn');
  assert.equal(await page.textContent('#saved-n'), '1');
  await page.click('.card .qv-btn');
  await page.waitForSelector('#qv:not([hidden])');
  await page.click('#qv [data-compare]');
  assert.equal(await page.textContent('#compare-n'), '1');
  await page.keyboard.press('Escape');
  await page.goto(base + '/saved', { waitUntil: 'networkidle' });
  await page.waitForSelector('.card');
  assert.equal(await count(page), 1);
  await page.goto(base + '/compare', { waitUntil: 'networkidle' });
  await page.waitForSelector('.cmp');
  assert.ok((await page.locator('.cmp th').count()) >= 2);
  await page.close();
});

test('brands and glossary pages render, and old hash links still land', async () => {
  const page = await open('/brands');
  await page.waitForSelector('.brand-list');
  assert.ok((await page.locator('.brand-list li').count()) > 90);
  await page.goto(base + '/glossary/superwash', { waitUntil: 'networkidle' });
  await page.waitForSelector('#t-superwash.hl');
  await page.goto(base + '/#/p/obasan-organic-crib-mattress', { waitUntil: 'networkidle' });
  await page.waitForSelector('.pdp');
  assert.equal(new URL(page.url()).pathname, '/p/obasan-organic-crib-mattress');
  await page.close();
});

test('phone width: a filtered list page and a narrow phone do not scroll sideways', async () => {
  // Active filters add a dot to "Filter & sort", which with the sort menu made the toolbar wider than a phone.
  let page = await open('/c/mattresses?mat=cotton,wool&m=none', { width: 390, height: 800 });
  await page.waitForSelector('.toolbar');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'toolbar fits with active filters');
  await page.close();
  // Long unbroken brand names in two-column cards at 320 px.
  page = await open('/c/books', { width: 320, height: 700 });
  await page.waitForSelector('.card');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320, 'cards fit at 320 px');
  await page.close();
});

test('phone width: nothing overflows, and the filter drawer applies on "Show results"', async () => {
  const page = await open('/shop', { width: 390, height: 800 });
  await page.waitForSelector('.card');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'no sideways scroll');
  assert.equal(await page.locator('#rail').isVisible(), false);
  await page.click('[data-drawer-open]');
  assert.equal(await page.locator('#rail').isVisible(), true);
  await page.click('[data-tnode="s-treat"]');
  await page.check('#f-crit-color');
  assert.match(await page.textContent('.drawer-foot [data-drawer-apply]'), /Show 128 results/);
  assert.match(await page.textContent('.toolbar .count'), /123 products/, 'results wait for Apply');
  await page.click('.drawer-foot [data-drawer-apply]');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#rail').isVisible(), false);
  assert.match(await page.textContent('.toolbar .count'), /128 products/);
  await page.click('#menu-open');
  assert.equal(await page.locator('#menu').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('a shared saved list opens from its link and can be saved into this browser', async () => {
  const ids = 'home-of-wool-organic-baby-play-mat,kodo-kids-natural-wool-balls-6';
  const page = await open('/saved?ids=' + ids);
  await page.waitForSelector('.shared-note');
  assert.equal(await page.locator('.card').count(), 2);
  assert.equal(await page.evaluate(() => localStorage.getItem('sbtt-saved')), null, 'opening the link saves nothing');
  await page.click('[data-take]');
  await page.waitForSelector('.page-h [data-share]');
  assert.equal(new URL(page.url()).search, '');
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('sbtt-saved'))), ids.split(','));
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('product page compares the item with similar ones and keeps a buy bar in reach on phones', async () => {
  const page = await open('/p/home-of-wool-organic-baby-play-mat', { width: 390, height: 800 });
  await page.waitForSelector('.similar .cmp');
  assert.equal(await page.locator('.similar thead th.here').count(), 1);
  assert.ok((await page.locator('.similar thead th').count()) >= 3, 'at least one similar item');
  assert.ok(await page.locator('#buybar').isHidden(), 'hidden while the buy box is on screen');
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#materials').offsetTop));
  await page.waitForSelector('#buybar:not([hidden])');
  assert.match(await page.textContent('#buybar'), /Buy at Home of Wool/);
  await page.goto(base + '/shop', { waitUntil: 'networkidle' });
  assert.ok(await page.locator('#buybar').isHidden(), 'gone on other pages');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('a product with many photos keeps the page and the quick view inside a phone screen', async () => {
  const page = await open('/p/beaba-universal-warm-sleeping-bag', { width: 390, height: 800 });
  await page.waitForSelector('.gallery .thumbs');
  assert.ok((await page.locator('.gallery .thumb').count()) >= 8, 'many thumbnails');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'no sideways scroll on the product page');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + '/search?q=beaba', { waitUntil: 'networkidle' });
  await page.hover('.card');
  await page.click('.card .qv-btn');
  await page.waitForSelector('.qv .thumbs');
  const qv = await page.evaluate(() => {
    const d = document.querySelector('.qv'), cols = document.querySelectorAll('.qv-in > *');
    return { scroll: d.scrollWidth, client: d.clientWidth, text: cols[cols.length - 1].getBoundingClientRect().width };
  });
  assert.ok(qv.scroll <= qv.client + 1, 'quick view does not scroll sideways');
  assert.ok(qv.text >= 380, 'the thumbnail strip does not squeeze the text column: ' + qv.text);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('changing a filter keeps the page, the rail and the open facets where they were', async () => {
  const page = await open('/shop', { width: 1280, height: 800 });
  await page.waitForSelector('.card');
  await page.evaluate(() => { document.querySelector('.fgroup[data-group="brand"]').open = true; });
  const more = page.locator('.fgroup[data-group="brand"] .more-opts');
  if (await more.count()) await more.evaluate(b => b.click());
  await page.evaluate(() => { window.scrollTo(0, 600); document.querySelector('#rail').scrollTop = 300; });
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => ({ y: window.scrollY, rail: document.querySelector('#rail').scrollTop }));
  assert.equal(before.y, 600); assert.equal(before.rail, 300);
  await page.evaluate(() => document.querySelector('#rail input[type=checkbox][value="balls"]').click());
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ y: window.scrollY, rail: document.querySelector('#rail').scrollTop, cards: document.querySelectorAll('.card').length,
    expanded: !document.querySelector('.fgroup[data-group="brand"] .more-opts-wrap') || !document.querySelector('.fgroup[data-group="brand"] .more-opts-wrap').hidden }));
  assert.ok(after.cards < 24, 'the list narrowed');
  assert.equal(after.y, 600, 'the page did not move');
  assert.equal(after.rail, 300, 'the filter rail did not move');
  assert.ok(after.expanded, 'the expanded brand list stayed expanded');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(100);
  const deep = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => document.querySelector('#rail input[type=checkbox][value="balls"]').click());
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.scrollY), deep, 'widening the list again does not move the page either');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('cards show shipping, and the quick filter, shipping facet and price + shipping sort work', async () => {
  const page = await open('/shop');
  await page.waitForSelector('.card .ship');
  assert.equal(await page.locator('.card').count(), await page.locator('.card .ship').count());
  assert.equal(await page.locator('.card').count(), await page.locator('.card a.card-buy[target="_blank"]').count(), 'every card links to its store');
  await page.click('.quick [data-quick="deliv"][data-val="free"]');
  await page.waitForSelector('.quick [data-quick="deliv"][aria-pressed="true"]');
  assert.match(new URL(page.url()).search, /deliv=free/);
  const lines = await page.locator('.card .ship').allTextContents();
  assert.ok(lines.length > 0 && lines.every(t => t === 'Free shipping'), 'only free-shipping products: ' + lines.join(', '));
  assert.equal(await page.locator('#f-deliv-free').isChecked(), true, 'the rail checkbox follows the chip');
  await page.selectOption('#sort', 'total');
  assert.match(new URL(page.url()).search, /sort=total/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('old department and product type links land on the new aisle and type pages', async () => {
  const page = await open('/d/toys?price=u25');
  await page.waitForSelector('.card');
  assert.equal(new URL(page.url()).pathname, '/a/toys');
  assert.match(page.url(), /price=u25/, 'filters survive the redirect');
  await page.goto(base + '/a/sleep', { waitUntil: 'networkidle' });
  await page.waitForSelector('.card');
  assert.equal(new URL(page.url()).pathname, '/a/beds', 'the research-era aisles redirect to departments');
  assert.ok(await page.locator('.type-tiles .ttile-img img').count() >= 4, 'department pages show product types as photo tiles');
  await page.goto(base + '/c/pads', { waitUntil: 'networkidle' });
  await page.waitForSelector('h1');
  assert.equal(new URL(page.url()).pathname, '/c/protectors');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('the rail is grouped into sections and the age range filter narrows the list', async () => {
  const page = await open('/shop');
  await page.waitForSelector('.card');
  assert.deepEqual(await page.locator('#rail .rail-sec-h').allTextContents(), ['What it is', 'What it’s made of', 'Price and delivery']);
  assert.deepEqual(await page.locator('#rail .rail-sec:nth-of-type(2) .fgroup > summary').evaluateAll(s => s.map(x => x.firstChild.textContent)), ['Materials', 'Tests & certifications']);
  const before = await page.textContent('.toolbar .count');
  await page.check('#f-age-3-5y');
  assert.match(page.url(), /age=3-5y/);
  assert.notEqual(await page.textContent('.toolbar .count'), before);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('the Materials tree: checked is included, unchecked is left out, parents follow their children', async () => {
  const page = await open('/shop');
  await page.waitForSelector('.card');
  assert.equal(await page.locator('#f-crit-silicone').isVisible(), false, 'the silicone kind sits closed under Silicone');
  await page.click('[data-tnode="m-silicone"]');
  assert.equal(await page.locator('#tk-m-silicone #f-crit-silicone').isVisible(), true);
  assert.equal(await page.locator('#f-mat-wood').evaluate(x => x.indeterminate), true, 'wood is part-checked while plywood is left out');
  assert.equal(await page.locator('#f-matg-fibres').evaluate(x => x.indeterminate), true, 'natural fibres is part-checked while superwash wool is left out');
  await page.click('#f-matg-fibres');
  assert.equal(await page.locator('#f-mat-wool').evaluate(x => x.checked && !x.indeterminate), true, 'checking a part-checked family allows every kind under it');
  const total = async () => parseInt(await page.textContent('#res-count b'), 10);
  const allowed = await total();
  await page.click('#f-matg-fibres');
  assert.match(decodeURIComponent(page.url()), /mat=wood,latex,leather,plant-fill,silicone,metal/, 'the link lists what is included');
  assert.equal(await page.locator('.chips .chip-x[data-clear="matgroup"]').count(), 1, 'a whole family left out is one chip');
  assert.ok((await total()) < allowed, 'leaving out natural fibres hides products with any of them');
  await page.click('[data-tnode="g-fibres"]');
  await page.check('#f-mat-silk');
  assert.equal(await page.locator('#f-matg-fibres').evaluate(x => x.indeterminate), true, 'part of a family reads as part-checked');
  await page.click('.chips .chip-x[data-clear="mat"][data-val="wool"]');
  assert.match(decodeURIComponent(page.url()), /mat=wool/, 'removing the "No wool" chip includes wool again');
  assert.equal(await page.locator('.chips .chip-x[data-clear="mat"][data-val="wool"]').count(), 0);
  await page.click('[data-only="wood"]');
  assert.match(decodeURIComponent(page.url()), /mat=wood(&|$)/);
  assert.match(await page.locator('.chips .chip-x[data-clear="mat-all"]').textContent(), /Only wood/);
  await page.click('[data-tnode="m-wood"]');
  await page.click('#f-mat-wood');
  assert.equal(await page.locator('#tk-m-wood #f-crit-wood').isChecked(), true, 'checking part-checked wood allows plywood');
  await page.click('#f-mat-wood');
  assert.equal(await page.locator('#tk-m-wood #f-crit-wood').isChecked(), false, 'leaving out wood shows its kinds unchecked');
  await page.check('#tk-m-wood #f-crit-wood');
  assert.equal(await page.locator('#f-mat-wood').isChecked(), true, 'checking a kind includes its material again');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('materials are a way in: home tiles, a material page with its kinds, the menu and the index', async () => {
  const page = await open('/');
  await page.waitForSelector('.mat-row .ttile');
  assert.ok((await page.locator('.mat-row .ttile').count()) >= 8, 'a picture tile per material');
  const pics = await page.locator('.mat-row .ttile img').evaluateAll(l => l.map(i => i.getAttribute('src')));
  assert.equal(new Set(pics).size, pics.length, 'no photo shown twice in the row');
  await page.click('.mat-row .ttile[href$="/m/wood"]');
  await page.waitForSelector('.card');
  assert.equal(await page.textContent('h1'), 'Wood');
  assert.equal(await page.getAttribute('.kind[data-kind="crit:wood"]', 'aria-pressed'), 'true', 'solid wood starts ticked, as its filter does');
  const solid = await count(page);
  await page.click('.kind[data-kind="*"]');
  assert.equal(await page.getAttribute('.kind[data-kind="*"]', 'aria-pressed'), 'true');
  assert.match(page.url(), /\/m\/wood\?m=/);
  assert.ok((await count(page)) >= solid, 'all wood shows at least as many');
  await page.click('.kind[data-kind="std:fsc"]');
  assert.match(page.url(), /std=fsc/);
  const types = await page.locator('.sibling-types .ttile').evaluateAll(l => l.map(a => a.getAttribute('href')));
  assert.ok(types.length > 1 && types.every(h => /^\/m\/wood\?cat=/.test(h)), 'type tiles stay on the material page');
  await page.goto(base + '/m/fibres', { waitUntil: 'networkidle' });
  await page.waitForSelector('.card');
  assert.ok((await page.locator('.kinds a.kind').count()) >= 4, 'a family opens into its members');
  await page.goto(base + '/m', { waitUntil: 'networkidle' });
  await page.waitForSelector('.mat-tiles .tile');
  assert.ok((await page.locator('.mat-tiles .tile').count()) >= 8);
  await page.hover('#cats .cat-item[data-dept="materials"] .cat-a');
  await page.waitForSelector('#cats .cat-item.open .mega a[href$="/m/wood"]');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('the header Filters button opens every filter from any page, at desktop and phone width', async () => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await open('/about', viewport);
    await page.waitForSelector('.prose');
    await page.click('#nav-filters');
    await page.waitForSelector('body.drawer-on #rail');
    assert.equal(new URL(page.url()).pathname, '/shop');
    assert.equal(await page.locator('#rail .fgroup[data-group="mat"]').isVisible(), true, 'material filters are in it');
    await page.check('#f-age-3-5y');
    assert.doesNotMatch(page.url(), /age=/, 'changes wait for Show results');
    await page.click('[data-drawer-apply]');
    assert.match(page.url(), /age=3-5y/);
    assert.equal(await page.textContent('#filters-n'), '1');
    await page.click('#nav-filters');
    await page.waitForSelector('body.drawer-on #rail');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.body.classList.contains('drawer-on')), false);
    assert.deepEqual(page.errors, []);
    await page.close();
  }
});
