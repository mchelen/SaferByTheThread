# Materials at a glance

Written 2026-10-20 for the request "explore better ways to show info about a product's materials, both on the search results and in product details … easy to understand at a glance, optimizing for only displaying relevant information."

## What the pages did before

- **Cards** showed the material facets ("Wool or felt · Cotton") and a grey line "2 details not stated", and a photo badge "Doesn't match a filter" when set-aside products were shown. The count said that something was unstated but not what.
- **Product page** said the same thing three times: a status badge plus "Made with" chips in the buy box, a four-row checklist (each row with an explanatory subtitle, and empty rows such as "Flagged parts: None"), and a "By filter" table with a paragraph about where filters are changed. Filters that were switched off looked the same as ones that were on.

## Options for cards

1. **Name what matters, in one line (chosen).** Keep the material facets, then one coloured line with a mark: ✕ "Doesn't match: Dyes and paints" when the card misses a filter, else ? "Not stated: Small parts +1" when a filter can't be judged, else ✓ "Every detail stated". The line names the filter instead of counting, and the photo badge goes because the line says the same thing.
2. **One mark per filter group.** Three or four small icons (plastic, treatments, tested) each ✓, ? or ✕. Very compact, but the icons need a legend to be read, which goes against the "no explanatory text" rule.
3. **Mini checklist.** Made with and stated free of chips on every card. Complete but long; cards stop being scannable and the grid gets uneven.

## Options for the product page

1. **Lead with the answer, drop the empty and the repeated (chosen).** The buy box says in one or two lines how the product reads against the visitor's filters ("Meets your 8 material filters", "Not stated: Small parts, Wool treatment"), then the Made with chips. The Materials section keeps every fact but only shows rows that have something in them (Made with, then Flagged parts, Stated free of, Not stated), without subtitles or intro text, and the "By filter" table is grouped like the filter sidebar (since 2026-10-22: Made with, Leave out, Tests & certifications, see `docs/filter-grouping.md`), with filters the visitor has off dimmed and tagged "Off".
2. **Collapse stated-free-of and not-stated behind a tap.** Shorter page, but "not stated" is often the most useful thing to know before buying, and hiding it adds a click for every visitor.
3. **One merged table per filter, with the chips placed under the filter they explain.** Clearest in theory, but the listings don't record which chip belongs to which filter, so it would need a data change for all 122 listings first.

## Glossary popovers

Unchanged: every chip and every "?" on the product page still opens the in-place definition. Card lines name filters by their short label and are not links, because the whole card is the link to the product.

## Recommendation

Cards option 1 and product page option 1, built in the same pull request. Quick view and the "Your material filters" row of the comparison table use the same line as the cards, so the three places read alike.

## Material icons (2026-10-26)

M asked for visual ways to show materials with icons. The options page (https://claude.ai/artifact/AD8T5RKjjv5CzQURbkpjWr) compared labelled material chips (A), one mark per part (B) and icon badges on the photo (C); M chose A, kept compact like C, with filter details on cards shown only on hover or tap of the related chip.

- **Chips.** One per material the maker names (the eleven materials of the Materials filter, matched part by part with the same patterns; `usesMats` and `outMats` in `assets/catalog.js`), then **Synthetic** when a part is plastic or synthetic, **Flagged** for other flagged parts (paint, plywood, hook-and-loop), and **N not stated** for the parts no page states. A material named only inside a flagged part (the natural rubber in a synthetic rubber sole) gets no green chip of its own. A material chip turns to the flagged colour when it has a flagged part (plywood under Wood) or a filter miss nested under it (superwash under Wool).
- **Details.** A chip's details list the filter misses first (`✕ Has plastic or synthetics in the main materials`), then the flagged parts, the named parts or the parts not stated. Plastic filters' misses go on the Synthetic chip, nested filters' on their material's chip, the rest (dyes, flame retardants, finishes) on the Flagged chip. Cards no longer carry a filter line; the product page buy box keeps its filter lines above the chips.
- **Product page.** The Materials checklist has a row per named material (icon, name linking to `/m/<material>`, the parts made of it; a part naming several materials sits under each), then Also named (parts with no material word, such as beeswax polish), Plastic or synthetics, Flagged parts, Stated free of and Not stated.
- **Not done.** B's proportion bar and C's photo badges; the Quick view and Compare rows still use the text line.
