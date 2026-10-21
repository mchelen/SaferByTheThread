# Catalog automation

How the catalog grows without anyone editing `data.json` by hand. Scripts in GitHub Actions do everything that needs no judgement; one Claude research session a day does the reading. Both end in a pull request that merges itself once the data check and unit tests pass, then the site redeploys.

```
watched stores ──► tools/discover.js ──► research/candidates.json
                                              │
                         daily Claude session reads the product pages
                                              │
            tools/snapshot.js ──► research/snapshots/<id>.txt   (the page text, as fetched)
            draft listing     ──► research/drafts/<id>.json     (claims + the quote each one rests on)
                                              │
                              tools/ingest.js checks every quote against the snapshot
                                              │
                                         data.json ──► tools/photos.js ──► img/<id>_<n>.jpg
                                              │
                             check + unit tests ──► pull request ──► merge ──► Pages
```

## What runs in GitHub Actions

| Workflow | When | What it does |
|---|---|---|
| `catalog-daily.yml` | every day 06:00 UTC, or by hand | Discovery, adds any drafts that pass the quote check, saves photos for listings without them, validates, then opens, merges and publishes a pull request when anything changed. |
| `price-check.yml` | Mondays | Re-reads store prices and shipping; opens a pull request when a price moved. |
| `ci.yml` | every pull request | Data check, unit tests, browser tests, preview at `pr/<number>/`. |
| `pages.yml` | push to `main`, or dispatched | Deploys the site. |

A pull request opened with the workflow's own token does not start other workflows, so `catalog-daily.yml` runs the same data check and unit tests itself before merging, and dispatches `pages.yml` afterwards. It needs the repository setting "Allow GitHub Actions to create and approve pull requests" (already on).

### Discovery: `tools/discover.js`

Reads every store in `research/watchlist.json`:

- Shopify stores through `/products.json`;
- WooCommerce stores through the Store API (`/wp-json/wc/store/v1/products`);
- anything else through its sitemap (product URLs only, titles taken from the URL).

A product is queued only when its title (or, failing that, the store's own product type and tags) matches the `match` pattern of a product type in `data.json`; the longest match wins, so "car seat cover" goes to the right type. Gift cards, samples, spare parts and bundles are skipped. URLs already listed, already queued, or in `research/rejected.json` are skipped too.

Each queued product is `{url, brand, title, type, source, first_seen, status}` in `research/candidates.json`. `status` is `new`, `unavailable` (sold out when found), `listed` (with `listing`, the id it became) or `skipped` (with `reason`).

To watch another store, add `{brand, store, platform, retailer?}` to `research/watchlist.json` (`platform` is `shopify`, `woocommerce` or `sitemap`; `retailer: true` for shops that sell many brands). Marketplaces whose pages are not readable without a browser (Amazon, Etsy, Walmart) are left out; listings that sell there keep their links, but discovery does not read them.

### Checking drafts: `tools/ingest.js`

A draft is `research/drafts/<listing-id>.json`:

```json
{
  "entry": { "id": "...", "type": "...", "brand": "...", "line": "...", "uses": [], "free": [], "unconfirmed": [],
             "outside": [], "facts": {}, "contains": [], "standards": [], "age": {}, "products": [] },
  "evidence": {
    "uses":      { "<checklist line>": "<words copied from the page>" },
    "free":      { "<checklist line>": "<words copied from the page>" },
    "outside":   { "<checklist line>": "<words copied from the page>" },
    "facts":     { "<criterion id>": "<words copied from the page>" },
    "standards": { "<standard id>": "<words copied from the page>" },
    "contains":  { "latex": "<words copied from the page>" },
    "age":       "<words copied from the page>"
  },
  "candidate": "<candidate URL, when it came from the queue>",
  "replace": false
}
```

`entry` is a listing exactly as the README's Data section describes it. Every claim needs words copied from `research/snapshots/<listing-id>.txt`; the check ignores case, spacing and curly quotes, nothing else. A claim without matching words is not kept: a checklist line is dropped, a `yes` or `no` fact becomes `unknown`, a standard or age rating is left out, and the report lists each one. `unconfirmed` lines need no quote (they record what no page says).

A draft is held back, with the reason in the report, when it has no snapshot, no checklist line ("made with", "flagged" or "stated free of") backed by a quote, an unknown type or criterion, a product without name, URL, store or price, or a word that takes a side ("safe", "toxic", "best", "avoid", ...) outside quotation marks. Fix it and the next run picks it up.

Passing drafts are added to `entries` (or replace the listing with the same id when `replace` is true) with `read` set to the date, the draft file is removed, and the candidate is marked `listed`.

### Photos: `tools/photos.js`

The site keeps its own copy of every photo the store shows for a product, as a cache: nothing is hot-linked. For each listing without `photos`, the tool reads the first store page it can, collects images from Shopify's product data, JSON-LD, full-size image links and the page's own gallery, drops images under 300 px and near-duplicates (the same photo at another size or crop), resizes to 640 px JPEG and records them as `photos: [{key, src}]` in page order, at most 10. The existing main photo stays first.

```sh
node tools/photos.js --only <listing-id>            # look, don't write
node tools/photos.js --write --only <listing-id>    # save
node tools/photos.js --write --refresh --only <id>  # fetch again for a listing that already has photos
```

With `--browser`, pages that refuse a plain request (HTTP 403, or photos drawn only by JavaScript) are read again in headless Chromium, which also picks up the large pictures shown on the page outside menus, footers and other-product carousels. The daily job uses it. Pages that refuse a browser too (most Etsy shops, OXO) are reported; those listings keep the photo they have.

```sh
node tools/photos.js --write --browser --only <listing-id>
```

## The daily Claude research session

A scheduled Claude Code session on this repository does the part a script cannot: reading a product page and writing down what the maker says it is made of. It follows these steps every day.

1. **Start from `main`.** `git pull`; `npm ci`. Branch `catalog/research-<date>`.
2. **Pick up to 15 products to read.**
   - First, candidates in `research/candidates.json` with status `new`, oldest first, spread across types (no more than 4 of one type).
   - Then, when the queue is short, search the web for makers and stores in the product types with the fewest listings (count them in `data.json`). Types with no listings come first. New stores that sell several products in scope go into `research/watchlist.json`.
   - For each type, keep 3 to 5 conventional listings (the plastic or synthetic version most shops sell) alongside the natural-material ones, so the filters have something to set aside. Record what their pages say like any other listing.
3. **Save the page text.** `node tools/snapshot.js <listing-id> <product url> [<materials or FAQ page url> ...]`. The listing id is a lowercase slug, `<brand>-<product>`.
4. **Write the draft** in `research/drafts/<listing-id>.json`, quoting the snapshot for every claim:
   - `uses`: the parts whose material the page names, as short noun phrases ("organic cotton cover", "natural latex core"). A part the page names only by its construction or job ("fleece lining", "padding 300 g/m²", "windproof outer fabric", "frame") names no material: it goes under `unconfirmed`, not `uses`. Fleece, felt, textile, fabric, foam and padding are constructions, not fibres.
   - `free`: what the page says is absent ("no polyurethane foam", "no flame retardant chemicals").
   - `unconfirmed`: parts no page describes (thread, dyes, glue, coating), including every part listed only by construction ("Fibre of the fleece lining"), tagged in `unstated` for the filter it leaves open.
   - `outside`: parts that fall outside the default filters (plastic lid, polyester fill, unnamed paint, superwash wool).
   - `facts`: one entry per criterion in `data.json` that applies, `yes`, `no` or `unknown`.
   - `standards`, `age`, `contains`, `products` (name, URL, store, price as shown, `ships_from`).
   - Record every product read, including ones that miss the default filters. A product that is not for babies or children up to 5, or is a duplicate, goes into `research/rejected.json` (`{url, reason, date}`) and its candidate gets `status: "skipped"` with the reason.
5. **Check.** `node tools/ingest.js --dry-run`; fix every problem and every dropped claim that the page does support (usually a quote copied with a typo). Then `node tools/ingest.js`.
6. **Photos.** `node tools/photos.js --write` for the new listings.
7. **Validate.** `node tools/check.js && npm test && npm run test:e2e`.
8. **Ship.** Commit the drafts' results, snapshots, photos and queue changes; open a pull request titled `catalog: <n> new listings <date>` listing each new listing and its type; merge it when CI is green (the project's standing rule) and report in the project.
9. **When a new product type is needed**, add it to `types` (with `ages`, `room`, `contact`, `match`) and to an aisle in the same pull request. Types with no listings stay hidden on the site.

Tone rules apply to everything written: what the maker says, what it says is absent, what nobody states. No safety position.

## Files

- `research/watchlist.json`: stores discovery reads.
- `research/candidates.json`: products found and not yet read, and what became of them.
- `research/rejected.json`: products read and left out of scope, so discovery doesn't queue them again.
- `research/snapshots/`: the page text each listing's claims were checked against.
- `research/drafts/`: listings waiting for the check (empty after a clean run).
