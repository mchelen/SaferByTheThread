'use strict';
/* Visual regression: each test opens a key view and compares a screenshot with the committed one in
   tests/visual/screenshots/<name>-<desktop|phone>.png. Both widths run every test unless it says
   otherwise. data.json and glossary.json are served from tests/visual/fixtures/, so new or changed
   listings never move these pictures; only changes to the page code and styles do. */
const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');

const fixture = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f));

test.beforeEach(async ({ page }) => {
  // The site loads Inter from Google Fonts. Serve a saved copy (fixtures/fonts/, SIL Open Font License)
  // so every run draws the same letters whatever the network does, and block anything else off-site.
  await page.route((url) => url.hostname !== '127.0.0.1', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: fixture('fonts/inter.css') });
    if (url.hostname === 'fonts.gstatic.com') return route.fulfill({ contentType: 'font/woff2', body: fixture('fonts/' + path.basename(url.pathname)) });
    return route.abort();
  });
  await page.route(/\/(data|glossary)\.json(\?.*)?$/, (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    route.fulfill({ status: 200, contentType: 'application/json', body: fixture(name) });
  });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
});

// Loads every lazy image and waits for fonts, so a screenshot never catches a half-painted page.
async function settle(page) {
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })));
    // Decoded at full quality, not the quick first pass Chromium paints large images with.
    await Promise.all([...document.images].map((img) => img.decode().catch(() => null)));
  });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(150);
}

async function open(page, url, ready) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector(ready);
  await settle(page);
}

const isPhone = (testInfo) => testInfo.project.name === 'phone';

test.afterEach(async ({ page }) => {
  expect(page.errors, 'no script errors on the page').toEqual([]);
});

test('home page', async ({ page }) => {
  await open(page, '/', '.tiles a');
  await expect(page).toHaveScreenshot('home.png', { fullPage: true });
});

test('home page, aisle menu open', async ({ page }, testInfo) => {
  await open(page, '/', '.tiles a');
  if (isPhone(testInfo)) {
    await page.click('#menu-open');
    await expect(page.locator('#menu')).toBeVisible();
  } else {
    await page.hover('#cats .cat-item[data-dept] .cat-a');
    await page.waitForSelector('#cats .cat-item.open .mega a');
  }
  await settle(page);
  await expect(page).toHaveScreenshot('menu-open.png');
});

test('listing page with filters', async ({ page }) => {
  await open(page, '/c/balls', '.card');
  await expect(page).toHaveScreenshot('listing-balls.png', { fullPage: true });
});

test('shop, first screen of results', async ({ page }) => {
  await open(page, '/shop', '.card');
  await expect(page).toHaveScreenshot('shop.png');
});

test('shop, filters applied', async ({ page }) => {
  await open(page, '/shop?cat=mats&sort=price-asc', '.card');
  await expect(page).toHaveScreenshot('shop-filtered.png');
});

test('phone filter drawer', async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo), 'the drawer only exists at phone width');
  await open(page, '/shop', '.card');
  await page.click('[data-drawer-open]');
  await expect(page.locator('#rail')).toBeVisible();
  await page.click('[data-tnode="s-treat"]');
  await page.uncheck('#f-crit-color');
  await expect(page).toHaveScreenshot('filter-drawer.png');
});

test('product page with buy box', async ({ page }) => {
  await open(page, '/p/obasan-organic-crib-mattress', '.pdp');
  await expect(page).toHaveScreenshot('product-top.png');
  await expect(page).toHaveScreenshot('product.png', { fullPage: true });
});

test('product page, phone buy bar', async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo), 'the buy bar only shows at phone width');
  await open(page, '/p/home-of-wool-organic-baby-play-mat', '.similar .cmp');
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#materials').offsetTop));
  await page.waitForSelector('#buybar:not([hidden])');
  await settle(page);
  await expect(page).toHaveScreenshot('product-buybar.png');
});

test('glossary popover on a product page', async ({ page }) => {
  await open(page, '/p/obasan-organic-crib-mattress', '.pdp');
  const term = page.locator('.check .term-link').first();
  await term.scrollIntoViewIfNeeded();
  await term.click();
  await expect(page.locator('#gpop')).toBeVisible();
  await expect(page).toHaveScreenshot('glossary-popover.png');
});

test('quick view', async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo), 'quick view is hidden at phone width');
  await open(page, '/c/balls', '.card');
  await page.locator('.card').first().hover();
  await page.locator('.card .qv-btn').first().click();
  await page.waitForSelector('#qv:not([hidden])');
  await settle(page);
  await expect(page).toHaveScreenshot('quick-view.png');
});

test('search suggestions and results', async ({ page }) => {
  await open(page, '/', '.tiles a');
  await page.fill('#q', 'merino');
  await page.waitForSelector('#sugg a');
  await expect(page).toHaveScreenshot('search-suggestions.png');
  await page.press('#q', 'Enter');
  await page.waitForSelector('h1:has-text("merino")');
  await settle(page);
  await expect(page).toHaveScreenshot('search-results.png');
});

test('compare page', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sbtt-compare', JSON.stringify(['home-of-wool-organic-baby-play-mat', 'kodo-kids-natural-wool-balls-6'])));
  await open(page, '/compare', '.cmp');
  await expect(page).toHaveScreenshot('compare.png', { fullPage: true });
});

test('glossary page', async ({ page }) => {
  await open(page, '/glossary/superwash', '#t-superwash.hl');
  await expect(page).toHaveScreenshot('glossary.png');
});
