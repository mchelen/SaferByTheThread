# Material filter grouping

Chosen 2026-10-26 (M: "consolidate filter in and filter out"), replacing the Made with / Leave out / Tests layout of 2026-10-22.

## The model

One **Materials** tree, opened from the Materials chip in the row above the results (and in the full Filters panel). **A checked row is included, an unchecked row is left out.** A product shows when it has none of the materials or kinds left out and at least one of the materials kept (a listing with no material recorded can't be judged and shows).

- Families open into their members: Natural fibres (wool, cotton, linen, silk), Plastic and synthetics (in the main materials, in small parts, in lids, stands or extras, melamine or resin-bound bamboo), Added treatments (synthetic dyes, paints or coatings; flame retardants; water, stain or wrinkle resistant finishes).
- A material opens into the kinds of it a visitor can leave out: Wood > Plywood, MDF or veneer; Wool > Superwash or shrink-proofed wool; Natural rubber > Plasticisers or synthetic rubber; Silicone > Not stated as tested to LFGB or the French Arrêté; Leather > Tanning not stated as vegetable or chrome-free.
- Parent state follows its children: checked when it and every child are, part-checked (dash) when only some are, unchecked when left out, which also shows its children unchecked. Unchecking a parent leaves out everything under it; checking a part-checked parent allows all its kinds; checking a child includes its material again.
- **Only** beside a material or family keeps just that one and leaves every other material out.
- "Parts whose material isn't stated" is the last row: checked (the default) means a part no page describes doesn't count against a product.
- **Tests & certifications** stays a small second group: lead testing, certified organic, OEKO-TEX, FSC, Fair Rubber, US toy rules.

M's defaults are the default tick state, so the default results don't change.

## URL and state

`mat=` in a link lists the materials included (`/shop?mat=wood` is wood only; no parameter means all). In `assets/app.js` the state keeps the materials left out (`st.mat`); `m=` lists the criteria that are on (a criterion that is on leaves out its kind), and `strict=1` is "Parts whose material isn't stated" unchecked.

Chips read "No plywood, MDF or veneer", "No plastic in small parts", "No natural fibres", "Only wood or wool", "Silicone tested to LFGB or the French Arrêté", "Every part's material stated". The product page By-filter table has the same two groups, Materials and Tests & certifications.

## Data

`criteria_groups[]` are the families of kinds; `criteria[].under` nests a kind under a material and `sub` names the kind; `standards[].filter` marks a standard a test filter already covers. See the README Data section.
