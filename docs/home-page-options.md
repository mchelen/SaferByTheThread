# Home page: structure options for first-time visitors

Written 2026-10-20 against `main` after PR #10, looking at the home page at 1280 px and 390 px from the point of view of someone who has never seen the site and wants to find, say, a wooden toy for a one-year-old.

## What the home page does today

Top to bottom: hero (tagline, product count, "Shop all products" and "How the guide works"), **Shop by department** (4 photo tiles), recently viewed, **Shop by product type** (23 pills in one flat cloud), **Featured products** (8 cards), **What every listing tells you** (the four checklist rows), **Brands** (18 links), then a band about **material filters** and the **glossary**.

What gets in a newcomer's way:

1. **Two navigation sections say the same thing.** Departments and the flat type cloud both list the catalog; the cloud repeats the department contents without grouping, and on a phone it is a wall of 23 pills that pushes everything else down (about 1,000 px).
2. **The site's distinguishing idea comes last.** The material filters, which decide what a visitor sees on every listing page ("64 of 122 show by default"), are explained only in the band at the very bottom, after brands. A visitor who clicks a department first meets "N set aside by your filters" before learning what the filters are.
3. **There is no entry by material.** People arrive with a material question ("wooden", "no plastic", "organic cotton", "wool"); the only way in is search or the filter rail on a listing page.
4. **No sense of "how to use this" in one glance.** "What every listing tells you" explains the product checklist, not the steps of using the site (pick, check, buy at the store).
5. **The phone page is about 4,400 px long** and the next step after the hero is a scroll through everything.

## Option 1: Start with what you need (aisles with their product types)

The hero is followed directly by one **"Shop by need"** block: one card per aisle (today: Toys, Beds and bedding, Ice trays and freezer molds, Footwear), each with a photo, the count, and its product types listed as links inside the card. The flat type cloud goes away.

- Good at: the most common intent (I need a kind of thing), one tap from home to a listing page, and no duplicate navigation. It is how most shops lay out a home page.
- Fits the product-type plan: the card is "aisle with its types", which is exactly the shape of Option A in `docs/catalog-growth-plan.md` (aisles as a menu, types as the unit). When `taxonomy.json` lands, the block reads aisles from it instead of departments; nothing else on the home page changes. A type in two aisles simply appears in both cards.
- Weak at: visitors who come with a material question rather than a product type.

## Option 2: Start with a material (filter-first entry)

A row of **"Start from a material"** tiles near the top: Wood, Wool or felt, Cotton, Natural rubber or latex, Silk, plus standards such as GOTS-certified, each opening the full shop with that filter ticked (`/shop?mat=wood`, `/shop?std=gots`) and showing the count. A sentence under the row says which material filters are on by default and how many products they set aside.

- Good at: the site's real difference from a store, and the question many visitors arrive with. Uses filters exactly as they work on listing pages, so nothing new to learn and nothing reads as a rule or a recommendation.
- Weak at: as the main entry, it skips product type, so "Wood" lands on a mixed list of blocks, beds and stackers; a second step is always needed. Better as a secondary row than as the backbone.

Wording stays factual: tiles name the material and count; no "safe" or "best" labels.

## Option 3: How it works first (three-step strip)

A short strip directly under the hero: **1. Pick what you need** → **2. Check what it's made of** (the four checklist rows, condensed) → **3. Buy from the store** (prices include shipping where the store states it). The material-filter explanation becomes part of step 2 with a "See the filters" link, instead of a band at the bottom.

- Good at: orientation in one glance, and it explains "set aside by your filters" before the visitor meets it.
- Weak at: on its own it doesn't help anyone navigate; it must sit next to Option 1 or 2.

## Recommendation: Option 1 as the backbone, with Option 3's strip and Option 2 as a secondary row

Order on the page:

1. Hero, shorter: tagline, one-line description, primary button "Shop all products", and a compact line showing which filters are on ("7 material filters on · 64 of 122 shown · change") so the filter state is visible from the first screen.
2. Three-step strip (Option 3), replacing "What every listing tells you" and the bottom filters band.
3. **Shop by need** (Option 1): aisle cards with their product types inside. Replaces both the department tiles and the type cloud.
4. Recently viewed (only when there is history).
5. **Start from a material** (Option 2): one row of material and standard tiles with counts.
6. Featured products.
7. Brands and glossary, side by side as a closing pair.

Net effect: one navigation block instead of two, the filters explained before they are met, a material entry that did not exist, and a shorter phone page. The aisle card is the only part that depends on the navigation decision, and it is written to read from aisles so the product-type plan drops in without a redo.

## Not proposed

- An age picker ("12 to 24 months") as a home page entry: 112 of 122 listings have no age yet (see the catalog plan's age backfill). Worth adding once ages are filled in.
- A quiz or guided wizard: more steps than the shop needs at 122 products.
- Ratings, "most popular" or "parents' picks": the site takes no position, and there is no data for popularity.
