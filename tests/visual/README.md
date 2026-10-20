# Visual regression tests

`pages.spec.js` opens the key views of the site and compares each one, pixel for pixel, with the
PNG committed in `screenshots/` (`<view>-desktop.png` at 1280×900, `<view>-phone.png` at 390×844).
CI runs them on every pull request as the **Visual regression** check; a mismatch fails the check.

| View | Desktop | Phone |
| --- | --- | --- |
| Home page (whole page) | ✓ | ✓ |
| Aisle menu open (mega menu / phone menu) | ✓ | ✓ |
| Listing page with the filter rail, `/c/balls` (whole page) | ✓ | ✓ |
| Shop, first screen of results | ✓ | ✓ |
| Shop with a filter and a sort applied | ✓ | ✓ |
| Filter drawer, with a material filter switched off | | ✓ |
| Product page: first screen with the buy box, and the whole page | ✓ | ✓ |
| Product page buy bar after scrolling | | ✓ |
| Glossary popover on a product page | ✓ | ✓ |
| Quick view | ✓ | |
| Search suggestions while typing, and the search results page | ✓ | ✓ |
| Compare page with two products | ✓ | ✓ |
| Glossary page with a highlighted term | ✓ | ✓ |

Each test also fails on any script error on the page.

## Data is frozen

The tests serve `fixtures/data.json` and `fixtures/glossary.json` instead of the live files, so adding
or editing listings (by hand, by the price check or by automated discovery) never changes a screenshot.
Only changes to `index.html`, `404.html`, `assets/` and the photos in `img/` do.
When a change to the page code needs new data fields to show, refresh the fixtures in the same PR:
`npm run test:visual:update -- --refresh-fixtures`.

The page's Inter font, which the site loads from Google Fonts, is served from `fixtures/fonts/`
(Inter is under the SIL Open Font License), and every other off-site request is blocked, so the
network never changes a picture. If the site changes its fonts, save the new ones there.

## Running

```sh
npm ci
npm run test:visual            # compare
npm run test:visual:update     # rewrite the screenshots that changed
npx playwright show-report visual-report   # side-by-side report of the last run
```

Both commands run Playwright inside the pinned Docker image `mcr.microsoft.com/playwright:v<version>-noble`
(version from `@playwright/test` in package.json), the same image CI uses, so local screenshots match
CI exactly. Docker has to be running; in a cloud session start it with `sudo dockerd > /tmp/dockerd.log 2>&1 &`.
Pass Playwright options after `--`, for example `npm run test:visual -- -g "product page" --project=phone`.

## When a pull request fails the check

The check posts one comment on the pull request with a table for each changed view: the committed
screenshot, the new one and the difference (changed pixels in red). The images live on the
`visual-diffs` branch, which only holds these pictures and can be deleted at any time. The CI run
also has a `visual-report` artifact with Playwright's HTML report (slider and side-by-side views).

- **Not intended:** fix the code and push; the comment updates on the next run.
- **Intended** (a redesign, a new section, a moved button): update the screenshots in the same PR,
  either way:
  1. run `npm run test:visual:update`, look at the changed PNGs, commit `tests/visual/screenshots/`; or
  2. add the label `update-screenshots` to the PR. The **Update screenshots** workflow retakes them,
     commits the changed ones to the PR branch, removes the label and re-runs CI.

  Either way the PR's Files changed tab shows every changed screenshot before and after, so the
  change can be checked there before merging. Say in the PR description which views changed and why.

When another PR that changed the screenshots merges first, merge `main` into your branch; if the
check then fails only on views your PR did not touch, update the screenshots again.

## Adding a view

Add a test to `pages.spec.js` that opens the page, waits for it with `open()` and calls
`expect(page).toHaveScreenshot('<name>.png')`, then run `npm run test:visual:update` and commit the
new PNGs. Use `test.skip(isPhone(testInfo), …)` for a view that exists at one width only.
