# Changelog

All notable changes to the site are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Shop-style site: search box, department tabs, filter sidebar (product type, price, brand, made with, standards, age, sold from, material rules), sort options, a product page per listing with the full materials checklist, store links and glossary popovers, and Brands, Glossary and About pages. (#1)
- `standards`, `age` and `ships_from` fields in `data.json`, read from the existing listing text. (#1)
- `tools/check.js` to validate the data and `tools/bundle.js` to write a single-file copy of the site. (#1)
- GitHub Pages deployment from `main`, with a preview of every open pull request at `pr/<number>/`.
- Unit tests for the catalog rules (`npm test`) and browser smoke tests (`npm run test:e2e`), run in CI on every pull request.
- Pull request template, this changelog and contributing notes.
- A usability review of the redesign in `docs/usability-review.md`.
- A weekly price check (`tools/prices.js`, `.github/workflows/price-check.yml`) that opens a pull request when store prices change.
- The price check reads the price of the size or option a listing names (or a `variant` hint on the product) instead of the cheapest one, and reports pages where no option can be told apart under "Needs a look".
- The price check records each store's shipping statement (free, free over a threshold, flat rate, or calculated at checkout) in a `shipping` field, shown on the product page.
- Shop patterns borrowed from Amazon and Shopify stores (`docs/ecommerce-patterns.md`): share a Saved or Compare list by link, with "Save all to my list" on the shared page; a Share button on product pages; "Compare with similar items" on product pages; a buy bar at the bottom of phone product pages once the buy box scrolls away; a confirmation with a link when saving; recently viewed products on the home page; the Filter & sort bar stays at the top on phones.

### Fixed
- A blank strip at the top of every page, and department tiles whose labels sat at different heights.

### Changed
- Storefront rewrite along the lines of the usual shop template: a department menu with drop-downs, a home page with department tiles and featured products, listing pages per department, product type, brand and search with a left filter rail (material filters as ordinary checkboxes next to type, price, brand and the rest, with counts and removable chips), a product page with a sticky buy box, shipping line, "Buy at <store>" links and one Materials section (the checklist plus how the product reads against each filter, with no switches: filters are changed on listing pages), quick view, Save and Compare lists, clean URLs (`/c/balls`, `/p/<id>`) via `404.html`, and a phone layout with a full-screen filter drawer that applies on "Show N results". Browser tests rewritten for the new pages; `npm run serve` now uses `tools/serve.js`.
- Usability pass: material rules first in the sidebar with a count of switches on; cards show only what an item misses or how many details aren't stated; facet counts show how many items a rule hides; search as you type with brand, type, material and glossary suggestions; a Made with summary and working rule switches on the product page; one dotted underline per checklist chip; the phone filter drawer is a dialog with focus kept inside; "Ships from" naming throughout; back-to-top button, favicon, scroll position kept on Back; the glossary loads after the first paint.
- Site renamed "Saved by the Thread" with the tagline "Reading the fine print so you don't have to." (#1)

### Removed
- The Python single-page build (`build.py`, `template.html`); the site now renders from `data.json` in the browser. (#1)

## [0.1.0] - 2026-10-17

### Added
- First published version: "Safer by the Thread", a single page with 122 listings (155 products) in 23 product types, the material-rule switches, a brand index and a 47-term glossary.
