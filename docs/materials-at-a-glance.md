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
