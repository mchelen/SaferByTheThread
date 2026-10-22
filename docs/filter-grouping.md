# Material filter grouping

Chosen 2026-10-22 (option B from the options doc, with nesting added at M's request).

## Problems with the old layout

- "No natural rubber or latex" and "No leather, suede or sheepskin" reversed the Made with options for the same materials (removed in #39).
- "Tested or certified" and "Standards named" covered the same ground with different behaviour.
- "Plastic or synthetics" was a Made with choice right under filters that leave plastic out.
- Ten labels started with "No", and every filter carried a help line.
- A test such as silicone LFGB only matters for silicone, but sat apart from it.

## Layout

The "What it's made of" section of the rail has three filter groups, each made of ordinary checkboxes. A row with children has a small button that opens them.

**Made with** (any of the ticked materials)

- Natural fibres: Wool or felt (Only untreated wool), Cotton, Linen or hemp, Silk
- Wood: Only solid wood, FSC certified
- Natural rubber or latex: Only without plasticisers or synthetic rubber, Fair Rubber certified
- Leather, suede or sheepskin: Only vegetable or chrome-free tanned
- Coir, kapok or buckwheat
- Silicone: Only tested to LFGB or the French Arrêté
- Metal

Ticking a family ticks all its members; part of a family shows as part-ticked. The filters under a material keep M's defaults and apply to every product made with that material, whether or not the material itself is ticked.

**Leave out**

- Plastic and synthetics: In the main materials, In small parts, In lids, stands or extras, Melamine or resin-bound bamboo
- Chemical treatments: Synthetic dyes, paints or coatings; Added flame retardants; Water, stain or wrinkle resistant finishes
- Parts whose material isn't stated

**Tests & certifications**: Lead or heavy-metal testing stated, Certified organic fibres or latex, OEKO-TEX, US toy and child-product rules. Standards that a test filter already covers (GOTS, GOLS and unnamed organic under Certified organic; LFGB and the Arrêté under the silicone test) are not offered separately.

Chips read "Made with: wool or felt" (one "Made with: natural fibres" chip for a whole family), "Leave out: plastic in small parts", "Silicone: only tested to LFGB or the French Arrêté". The product page By-filter table uses the same three headings.

## Data

`criteria_groups[].set: "leave"`, `criteria[].under` and `sub`, `standards[].under`, `sub` and `filter`; see the README Data section.
