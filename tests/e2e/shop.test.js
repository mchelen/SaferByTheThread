'use strict';
/* Browser smoke tests. Needs the playwright package and a Chromium (npx playwright install chromium).
   Serves the repository root on a free port with Node's http module, so no other server is needed. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); server.close(); });

async function open(url, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + url, { waitUntil: 'networkidle' });
  page.errors = errors;
  return page;
}

test('home renders the grid with the default rules applied', async () => {
  const page = await open('#/');
  await page.waitForSelector('.card');
  assert.equal(await page.locator('.card').count(), 64);
  assert.match(await page.textContent('.missbar'), /58 more items/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('facets, rules and sort change the grid and the URL', async () => {
  const page = await open('#/?cat=balls');
  await page.waitForSelector('.card');
  assert.equal(await page.locator('.card').count(), 2);
  await page.click('#toggle-misses');
  assert.equal(await page.locator('.card').count(), 8);
  assert.equal((await page.locator('.card.is-miss').count()), 6);
  await page.uncheck('#r-color');
  assert.ok((await page.locator('.card.is-miss').count()) < 6, 'turning off the dyes rule un-hides painted balls');
  await page.selectOption('#sort', 'price-asc');
  // Sorting applies within the items that meet the rules; items that miss stay after them.
  const prices = (await page.locator('.card:not(.is-miss) .price').allTextContents()).map(t => parseFloat(t.replace(/[^\d.]/g, '')));
  assert.deepEqual(prices, prices.slice().sort((a, b) => a - b));
  assert.ok(prices.length >= 2);
  assert.match(page.url(), /cat=balls/);
  assert.match(page.url(), /sort=price-asc/);
  await page.close();
});

test('search box finds brands and materials', async () => {
  const page = await open('#/');
  await page.waitForSelector('.card');
  await page.fill('#q', 'merino wool');
  await page.press('#q', 'Enter');
  await page.waitForSelector('.res-head h2:has-text("merino wool")');
  assert.ok((await page.locator('.card').count()) >= 1);
  await page.close();
});

test('product page shows the checklist, store links and a glossary popover', async () => {
  const page = await open('#/p/obasan-organic-crib-mattress');
  await page.waitForSelector('.pdp');
  assert.match(await page.textContent('h1'), /Organic Crib Mattress/);
  assert.ok((await page.locator('.btn-buy').count()) >= 1);
  assert.ok((await page.locator('.check .row').count()) >= 3);
  await page.click('.check .term-link');
  const pop = page.locator('#gpop');
  assert.equal(await pop.isVisible(), true);
  assert.match(await pop.textContent(), /Full entry and sources/);
  await page.keyboard.press('Escape');
  assert.equal(await pop.isVisible(), false);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('brands and glossary pages render', async () => {
  const page = await open('#/brands');
  await page.waitForSelector('.brand-list');
  assert.ok((await page.locator('.brand-list li').count()) > 90);
  await page.goto(base + '#/glossary/superwash');
  await page.waitForSelector('#t-superwash.hl');
  await page.close();
});

test('phone width: the filter drawer opens and closes', async () => {
  const page = await open('#/?cat=mats', { width: 390, height: 800 });
  await page.waitForSelector('.card');
  await page.click('#side-open');
  assert.equal(await page.locator('#side').isVisible(), true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#side').isVisible(), false);
  assert.deepEqual(page.errors, []);
  await page.close();
});
