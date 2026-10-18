# Usability review of the shop redesign

Reviewed 2026-10-18 against the `claude/ecommerce-redesign-lwetyu` branch, in Chromium at 1360 px and 390 px widths, from the point of view of a parent who lands on the site for the first time, and of a returning visitor who already knows the material rules. Screenshots are in `docs/screenshots/`.

Severity: **high** = likely to stop or mislead a first-time visitor; **medium** = slows people down or hides something useful; **low** = polish.

## What works

- The shop shape (search, department tabs, sidebar facets, grid, product page) is familiar, so nobody has to learn the site before using it.
- Product pages put the quote from the store, the price and the store link together, and the materials checklist keeps the four-row shape visitors of the old page know.
- The one-direction switches are unchanged, and the "N more items are hidden by your material rules" bar makes the hiding visible instead of silent.
- Everything is addressable: a filtered view, a product, a brand and a glossary term each have a URL that can be shared.

## Findings

### 1. "Material rules" are the site's main idea, but they sit last in the sidebar (high)

The sidebar order is Product type, Price, Brand, Made with, Standards, Age, Sold from, Material rules. On a phone the rules are below seven other panels in the drawer. A first-time visitor sees "hidden by your material rules" in the grid before they have seen a rule, and has to scroll to find out what the phrase means.

Recommendation: move Material rules to the top of the sidebar, show how many switches are on in its heading ("Material rules · 7 on"), and make the "Change rules" link in the hidden-items bar open that panel in place. Add one sentence under the heading for first-timers: "Each switch hides what it names. Start from these or change them."

### 2. "Meets your rules" assumes the visitor set the rules (medium)

Every card says "Meets your rules · 2 details not stated". On a first visit the visitor has set nothing, so "your rules" reads oddly, and the line repeats on all 64 cards without adding much.

Recommendation: on cards, show only the exception: "Misses: …" on hidden items, and a quieter "2 details not stated" on the rest. Use "Meets the rules you have on" on the product page, where there is room, and keep the full wording in the rule table.

### 3. Facet counts drop to 0 when items are hidden by rules (medium)

Counts in the sidebar only count items that pass the rules. A visitor who ticks Brand and sees "Jellycat 0" dimmed will think Jellycat is not in the catalog, when it is hidden by a rule. The same happens for whole product types (Rain boots shows 2 of 9).

Recommendation: count visible items but show the hidden ones too, e.g. "2 (+7 hidden)", or a single tooltip "7 more hidden by your rules" on the panel. At minimum, the dimmed options need a hint that they are hidden, not absent.

### 4. Search only runs on Enter and offers no suggestions (medium)

Typing in the search box does nothing until Enter or the button. There is no hint of what can be searched (brand, product, material, product type) beyond the placeholder, and a zero-result search shows only "Nothing matches these filters".

Recommendation: search as the visitor types (debounced), show a short suggestion list of matching brands and product types under the box, and on zero results say what was searched and offer the nearest brand or type.

### 5. Product page buries the checklist (medium)

On the product page the top-right column has the store quote, "Where to buy", age and product type; the materials checklist is a full screen down. For this site the checklist is the reason to open the page.

Recommendation: put a compact "Made with" summary (the first row of the checklist, as chips) above "Where to buy", and a "See the full checklist" jump link. Keep the full checklist and rule table below.

### 6. Rule table wording is inconsistent and read-only (low)

The "This item" column mixes "Meets", "Has it", "Stated", "Not met" and "Not stated"; "Your setting" says "Switch on/off" but cannot be toggled there.

Recommendation: use the switch's own label with a plain result ("Plastic in small parts: not stated"), and make the "Your setting" cell a working switch so the visitor can change a rule where it is explained.

### 7. Phone cards lose the material tags and the "Ships from abroad" tag (medium)

Below 560 px the tags are hidden to fit two columns, so a phone visitor cannot see that the Home of Wool mat ships from the UK until the product page.

Recommendation: keep the "Ships from abroad" tag at all widths (one short line) and drop only the material tags.

### 8. Department tabs overflow with no scroll hint on phones (low)

The department bar scrolls sideways but shows no edge fade or arrow, so "Footwear" is off-screen and invisible.

Recommendation: fade the right edge when there is more to scroll, or wrap the tabs on phones (they fit in two lines).

### 9. Age facet is mostly empty (low)

Only 10 listings have an age rating, so the Age panel shows "No age rating recorded 54" and a few small bands. It takes space from more useful panels.

Recommendation: collapse Age by default, and add age ratings to the data as research continues (the product pages usually state one).

### 10. Every word in a checklist chip is underlined separately (low)

"Organic latex" becomes two dotted links ("Organic", "latex"), so a chip can carry three or four underlines and reads as noise, and a tap on a phone can land on the wrong term.

Recommendation: underline the whole chip once and open the first term, with the other terms listed inside the popover ("Also: organic").

### 11. Keyboard and screen-reader gaps (medium)

- The "Filters" button on phones opens a drawer that has no `role="dialog"` and does not trap focus; Tab leaves the drawer while the page behind is covered.
- The sidebar re-renders on every change; focus is restored by id, but the live region only announces the count, not that the list changed.
- The pill colour for "Misses" (clay on white) and the muted "not stated" text are close to the 4.5:1 contrast limit in light mode.
- The "?" glossary links next to switches have an `aria-label` but a 17 px hit area.

Recommendation: add `role="dialog"` and `aria-modal` with a focus trap to the drawer, announce "64 products, list updated", darken the clay and muted colours slightly, and enlarge the "?" hit area to 24 px.

### 12. Small things

- No favicon or web manifest; the tab shows a blank icon.
- The Brands and Glossary pages always open at the top; returning from a glossary term to the shop loses the scroll position (the shop restores it only when coming back from a product page).
- A long grid has no "Back to top".
- "Sold from" (facet) and "Ships from abroad" (tag) and "US shop" (product page) name the same fact three ways. Pick "Ships from".
- The hero takes the first screen on desktop; the grid starts below the fold. Fine for a first visit, less so for a return visit. Consider hiding the hero once the visitor has used a filter or a search (already done) and also after the first visit.

## Performance notes

- First load fetches `data.json` (148 KB) and `glossary.json` (56 KB). GitHub Pages serves them gzipped (about 40 KB together), which is fine, and the glossary could be fetched after the first render.
- Three Google font families are loaded; the CSS link blocks rendering until it arrives. Preloading the two files that matter (Young Serif and Atkinson Hyperlegible regular) or self-hosting them would remove a visible flash on slow connections.
- Photos are lazy-loaded and capped at 640 px; adding `decoding="async"` and `fetchpriority="high"` on the first row would help the largest-contentful-paint time.
- The whole sidebar and grid re-render on each change. With 122 listings this takes a few milliseconds and is not worth optimising.

## Suggested order of work

1. Findings 1, 2, 3 (rules first, quieter cards, honest counts).
2. Findings 4, 5, 7 (instant search, checklist summary, phone tags).
3. Finding 11 (dialog semantics and contrast).
4. The rest as polish.
