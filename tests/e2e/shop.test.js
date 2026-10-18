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

test('home page renders departments, featured products and the department menu', async () => {
  const page = await open('/');
  await page.waitForSelector('.tiles a');
  assert.equal(await page.locator('.tiles a').count(), 4);
  assert.ok((await count(page)) >= 4, 'featured rail shows products');
  assert.ok((await page.locator('#cats .cat-item[data-dept]').count()) >= 4);
  await page.hover('#cats .cat-item[data-dept] .cat-a');
  await page.waitForSelector('#cats .cat-item.open .mega a');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('clean URLs: a nested path loads through 404.html and keeps its path', async () => {
  const page = await open('/c/balls');
  await page.waitForSelector('.card');
  assert.equal(new URL(page.url()).pathname, '/c/balls');
  assert.match(await page.textContent('h1'), /Balls/);
  assert.match(await page.textContent('.toolbar .count'), /2 products · 6 set aside/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('the shop lists the products that meet the default material filters and sets the rest aside', async () => {
  const page = await open('/shop');
  await page.waitForSelector('.card');
  assert.equal(await count(page), 24, 'first page of results');
  assert.match(await page.textContent('.toolbar .count'), /64 products · 58 set aside/);
  await page.click('[data-more]');
  assert.equal(await count(page), 48, '"Show more" adds a page');
  await page.click('.hidden-note button[data-toggle-all]');
  assert.match(await page.textContent('.toolbar .count'), /122 products/);
  assert.match(page.url(), /all=1/);
  assert.ok((await page.locator('.card .badge.miss').count()) >= 1, 'set-aside products carry a badge once shown');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('material filters sit in the rail like any other facet and change the results and the URL', async () => {
  const page = await open('/c/balls');
  await page.waitForSelector('.card');
  assert.equal(await page.locator('#rail .fgroup[data-group="crit"] input[data-crit]').count(), 13);
  await page.uncheck('#f-crit-color');
  assert.ok((await count(page)) > 2, 'turning off the dyes filter brings painted balls in');
  assert.match(page.url(), /m=/);
  await page.check('#f-crit-color');
  assert.equal(await count(page), 2);
  assert.doesNotMatch(page.url(), /m=/, 'the default set leaves the URL clean');
  await page.close();
});

test('facets, chips and sort work together', async () => {
  const page = await open('/shop');
  await page.waitForSelector('.card');
  await page.check('#rail input[data-facet="cat"][value="mats"]');
  assert.match(page.url(), /cat=mats/);
  assert.equal(await page.locator('.chips .chip-x').count(), 1);
  await page.selectOption('#sort', 'price-asc');
  const prices = (await page.locator('.card .price').allTextContents()).map(t => parseFloat(t.replace(/[^\d.]/g, '')));
  assert.ok(prices.length >= 2);
  assert.deepEqual(prices, prices.slice().sort((a, b) => a - b));
  await page.click('.chips .chip-x');
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

test('product page shows the buy box, checklist, filter table and a glossary popover', async () => {
  const page = await open('/p/obasan-organic-crib-mattress');
  await page.waitForSelector('.pdp');
  assert.match(await page.textContent('.buybox h1'), /Organic Crib Mattress/);
  assert.ok((await page.locator('.offer .btn').count()) >= 1);
  assert.match(await page.textContent('.offer .btn'), /Buy at/);
  assert.ok((await page.locator('.check .row').count()) >= 3);
  await page.click('.check .term-link');
  const pop = page.locator('#gpop');
  assert.equal(await pop.isVisible(), true);
  assert.match(await pop.textContent(), /Full entry/);
  await page.keyboard.press('Escape');
  assert.equal(await pop.isVisible(), false);
  await page.evaluate(() => document.querySelectorAll('.acc').forEach(d => { d.open = true; }));
  assert.equal(await page.locator('.ftable input[data-crit]').count(), 13, 'the same material filters, editable from the product page');
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

test('phone width: nothing overflows, and the filter drawer applies on "Show results"', async () => {
  const page = await open('/shop', { width: 390, height: 800 });
  await page.waitForSelector('.card');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'no sideways scroll');
  assert.equal(await page.locator('#rail').isVisible(), false);
  await page.click('[data-drawer-open]');
  assert.equal(await page.locator('#rail').isVisible(), true);
  await page.uncheck('#f-crit-color');
  assert.match(await page.textContent('.drawer-foot [data-drawer-apply]'), /Show 71 results/);
  assert.match(await page.textContent('.toolbar .count'), /64 products/, 'results wait for Apply');
  await page.click('.drawer-foot [data-drawer-apply]');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#rail').isVisible(), false);
  assert.match(await page.textContent('.toolbar .count'), /71 products/);
  await page.click('#menu-open');
  assert.equal(await page.locator('#menu').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.deepEqual(page.errors, []);
  await page.close();
});
