# Changelog

All notable changes to the site are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- 15 new listings from the 2026-10-20 daily research run, the first in teethers, pacifiers, cups, plates, utensils, bibs, sleep sacks and stroller footmuffs (which makes the Strollers & gear department appear).
- `tools/photos.js --browser` reads store pages that refuse scripts in headless Chromium; the daily job uses it, which fills in photos for the White Lotus, Shepherd's Dream, Jan & Jul and Lékué listings (93 listings now have several photos; only 2 have none).
- Store ratings: cards, quick view and product pages show the star rating and review count from the store page (the store with the most reviews when a product is at several; each option and store in the buy box shows its own), and Compare has a Rating row. The weekly price check reads them (`tools/ratings.js`: JSON-LD, Judge.me, Shopify reviews, Okendo, Loox, Yotpo, Junip) into each product's `rating`; 62 store pages carry one so far.
- Every photo each store shows for a product, saved as the site's own copy (`tools/photos.js`, 564 photos for 99 listings, 87 with more than one), with thumbnails on the product page and in quick view.
- Visual regression tests (`npm run test:visual`): screenshots of 13 key views at desktop and phone width, compared on every pull request; a mismatch fails the check and posts the before, after and difference images on the PR. Update them with `npm run test:visual:update` or the `update-screenshots` label. See `tests/visual/README.md`.
- Automated catalog growth (`docs/automation.md`): a daily GitHub Actions job finds new products on 81 watched maker and shop sites, adds checked listing drafts, saves store photos and publishes; a daily Claude research session reads the queued product pages and writes drafts whose every claim is checked word for word against the saved page text.
- 29 new product types (cups, plates, teethers, cribs, sleep sacks, pajamas, towels, strollers and more) ready for listings; types and departments with no listings stay hidden until they have one.
- Material filters for melamine or resin-bound bamboo and for water, stain or wrinkle resistant treatments (both on by default), and a "lead or heavy-metal testing stated" filter (off by default).
- Age range filter (birth to 5 years and up) on every listing page, using the maker's age rating or, where none is recorded, the usual ages for the product type; the product page says which.
- Product pages show every saved store photo with thumbnails, when a listing records more than one (`photos`).
- An "Added flame retardant chemicals" material filter, on by default, filled in where listings already record it.
- Shop-style site: search box, department tabs, filter sidebar (product type, price, brand, made with, standards, age, sold from, material rules), sort options, a product page per listing with the full materials checklist, store links and glossary popovers, and Brands, Glossary and About pages. (#1)
- `standards`, `age` and `ships_from` fields in `data.json`, read from the existing listing text. (#1)
- `tools/check.js` to validate the data and `tools/bundle.js` to write a single-file copy of the site. (#1)
- GitHub Pages deployment from `main`, with a preview of every open pull request at `pr/<number>/`.
- Unit tests for the catalog rules (`npm test`) and browser smoke tests (`npm run test:e2e`), run in CI on every pull request.
- Pull request template, this changelog and contributing notes.
- A usability review of the redesign in `docs/usability-review.md`.
- Three home page structures for first-time visitors, with a recommendation, in `docs/home-page-options.md`.
- A proposal for growing the catalog, moving navigation to product types and automating product discovery, in `docs/catalog-growth-plan.md`.
- A weekly price check (`tools/prices.js`, `.github/workflows/price-check.yml`) that opens a pull request when store prices change.
- The price check reads the price of the size or option a listing names (or a `variant` hint on the product) instead of the cheapest one, and reports pages where no option can be told apart under "Needs a look".
- The price check records each store's shipping statement (free, free over a threshold, flat rate, or calculated at checkout) in a `shipping` field, shown on the product page.
- Patterns from Google Shopping: a shipping line under the price on every card, a "Shipping to the US" filter, quick filter chips above the results, a "Price + shipping: low to high" sort, and store prices sorted lowest first (with the total where a flat shipping rate is stated) on product pages sold by several stores.
- Shop patterns borrowed from Amazon and Shopify stores (`docs/ecommerce-patterns.md`): share a Saved or Compare list by link, with "Save all to my list" on the shared page; a Share button on product pages; "Compare with similar items" on product pages; a buy bar at the bottom of phone product pages once the buy box scrolls away; a confirmation with a link when saving; recently viewed products on the home page; the Filter & sort bar stays at the top on phones.

### Fixed
- Changing a filter no longer makes the page jump: the window and the filter rail keep their scroll position, facets left on "Show all" stay expanded, and a shorter list keeps enough room to hold the spot (the empty moment while the list was rebuilt let the browser snap to the top).
- Product pages and the quick view no longer grow wider than a phone screen when a listing has many store photos; the thumbnail strip scrolls inside its column instead.
- MarnieAndMister Organic Cotton Quilted Mat: the store names a cotton filling, so its main materials count as stated; a guessed "polyester binder in the batting" is removed.
- The material line on cards and product pages names the filter in full ("Not stated: any plastic or synthetics in the main materials", "Has synthetic dyes, paints or coatings") instead of its short label, which read as if a cotton mat's materials were not stated.
- A blank strip at the top of every page, and department tiles whose labels sat at different heights.

### Changed
- "Not stated" lines on cards, quick view, the compare table and product pages name the parts no page describes ("Not stated: thread · zipper · wool treatment"), from a new `unstated` field that ties each unconfirmed part to its material filter (170 parts tagged).
- Fourteen listings recorded a guess as fact ("probably plastic", "likely synthetic", "often polyester"); each guessed part is now listed as not stated, so 72 products meet the default filters instead of 64. General context about dyes moved to the silks and pretend play intros. `npm run check` now rejects guessing words in the checklist.
- Type photo tiles with no listing photo yet show the type's initial on the plate instead of an empty circle.
- Picture navigation on the remaining pages: the shop lists every product type as a photo tile under its title, search results show the types that have matches, a product page ends with "More in <category>" type tiles, and empty Saved, Compare and not-found pages show the category tiles instead of a lone button.
- Product-type pages show the other types in their category as photo tiles under the title, with the current one marked; the brands directory shows a product photo next to each brand; type suggestions in the search box carry the type's photo.
- Home page navigates by pictures: category tiles, age chips and a row of round product-type photo tiles under each category, in place of text lists of product types; the explanatory sections (what every listing tells you, your material filters) moved off the home page, which keeps one line of copy under the title. The featured rail no longer squeezes its first cards on phones and tablets.
- Departments come from the item list instead of the first research topics (`docs/taxonomy.md`): Toys, Beds & bedding, Feeding and Clothing & shoes, with Bath & diapering, Furniture & decor and Strollers & gear appearing once they have listings. The menu and department pages show product types as photo tiles with short names; old aisle links (`/a/play`, `/a/sleep`, `/a/eat`, `/a/wear`) redirect.
- Cards, quick view and the comparison table name which material filter a product misses or can't be judged on ("Not stated: Small parts +1") instead of counting details; the product page leads with the same lines, hides empty checklist rows and explanatory subtitles, and groups the "By filter" table like the filter sidebar with switched-off filters marked. Options in `docs/materials-at-a-glance.md`.
- Store buttons are the main action: a large amber "Buy at <store>" button right under the price on product pages and in quick view, a "Buy at store" button on every product card and in the Compare table, and the same button in the phone buy bar.
- Navigation is by product type: departments became aisles in the menu (Play, Sleep, Eat and drink, Wear), each listing names its `type`, and a type can appear in more than one aisle. The home page leads with product types. `data.json` moved to schema 4 (flat `entries`, `types`, `aisles`); `/d/<department>` and `/c/pads` links redirect. "Pads, toppers, pillows and sheets" split into three types.
- The filter rail is grouped into What it is, What it's made of, and Price and delivery, and the material filters into named sets (plastic and synthetics, treatments and finishes, tested or certified, materials to leave out).
- The "independent guide" banner moved from the top of every page to the home page; cards say "N options" instead of "N stores" when the options come from one store.
- Storefront rewrite along the lines of the usual shop template: a department menu with drop-downs, a home page with department tiles and featured products, listing pages per department, product type, brand and search with a left filter rail (material filters as ordinary checkboxes next to type, price, brand and the rest, with counts and removable chips), a product page with a sticky buy box, shipping line, "Buy at <store>" links and one Materials section (the checklist plus how the product reads against each filter, with no switches: filters are changed on listing pages), quick view, Save and Compare lists, clean URLs (`/c/balls`, `/p/<id>`) via `404.html`, and a phone layout with a full-screen filter drawer that applies on "Show N results". Browser tests rewritten for the new pages; `npm run serve` now uses `tools/serve.js`.
- Usability pass: material rules first in the sidebar with a count of switches on; cards show only what an item misses or how many details aren't stated; facet counts show how many items a rule hides; search as you type with brand, type, material and glossary suggestions; a Made with summary and working rule switches on the product page; one dotted underline per checklist chip; the phone filter drawer is a dialog with focus kept inside; "Ships from" naming throughout; back-to-top button, favicon, scroll position kept on Back; the glossary loads after the first paint.
- Site renamed "Saved by the Thread" with the tagline "Reading the fine print so you don't have to." (#1)

### Removed
- The Python single-page build (`build.py`, `template.html`); the site now renders from `data.json` in the browser. (#1)

## [0.1.0] - 2026-10-17

### Added
- First published version: "Safer by the Thread", a single page with 122 listings (155 products) in 23 product types, the material-rule switches, a brand index and a 47-term glossary.
