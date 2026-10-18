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

### Changed
- Usability pass: material rules first in the sidebar with a count of switches on; cards show only what an item misses or how many details aren't stated; facet counts show how many items a rule hides; search as you type with brand, type, material and glossary suggestions; a Made with summary and working rule switches on the product page; one dotted underline per checklist chip; the phone filter drawer is a dialog with focus kept inside; "Ships from" naming throughout; back-to-top button, favicon, scroll position kept on Back; the glossary loads after the first paint.
- Site renamed "Saved by the Thread" with the tagline "Reading the fine print so you don't have to." (#1)

### Removed
- The Python single-page build (`build.py`, `template.html`); the site now renders from `data.json` in the browser. (#1)

## [0.1.0] - 2026-10-17

### Added
- First published version: "Safer by the Thread", a single page with 122 listings (155 products) in 23 product types, the material-rule switches, a brand index and a 47-term glossary.
