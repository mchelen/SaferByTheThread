'use strict';
/* Visual regression tests (tests/visual/). Screenshots are compared against the PNGs committed in
   tests/visual/screenshots/. Run them through `npm run test:visual`, which uses the pinned Playwright
   Docker image so a local run renders exactly like CI; see tests/visual/README.md. */
const { defineConfig } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: 'tests/visual',
  outputDir: 'test-results/visual',
  snapshotPathTemplate: '{testDir}/screenshots/{arg}-{projectName}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'visual-report', open: 'never' }], ['json', { outputFile: 'test-results/visual.json' }]],
  expect: {
    toHaveScreenshot: {
      // Same renderer every run (the Docker image), so the allowance only absorbs anti-aliasing noise.
      maxDiffPixelRatio: 0.001,
      threshold: 0.2,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: {
    command: `node tools/serve.js ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
