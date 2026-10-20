# Product taxonomy

How the site's departments and product types are chosen. The structure lives in `data.json` (`aisles` are the departments, `types` the product types); the menu, department pages and home page all read it from there.

## How it was derived

1. **Classify every listing by what the product is**, not by the research topic it came from. Each of the 122 listings has one product type (25 types today). A product type is the thing a shopper would type into a search box: "floor bed", "rain boots", "ice pop mold".
2. **Add the product types the catalog is growing into** (the Tier 1 and 2 categories approved in `docs/catalog-growth-plan.md`): 29 more, 54 in all. Each has a `match` pattern so discovery can sort new products into it.
3. **Group types into departments the way large baby and kids retailers do** (Target's Baby and Kids sections and Amazon's Baby store were the reference, from their usual department menus): Toys, Nursery/Bedding, Feeding, Clothing & Shoes, Bath & Diapering, Furniture, Gear. A department is a noun for a kind of product, never a verb or a need ("Feeding", not "Eat and drink").
4. **Size check.** A department should hold several types and be visible only when it has listings of its own. Departments whose only listings come from types they borrow from another department stay hidden.
5. **A type may sit in two departments** where shops put it in both (teethers in Toys and Feeding; bath toys in Toys and Bath & diapering; play mats in Toys and Furniture & decor). Its first department is its home in breadcrumbs.

## Top level

| Department | Listings now | Product types (short labels) |
|---|---|---|
| Toys | 52 | Stuffed animals, Dolls, Rattles, Teethers, Stacking & sorting, Blocks, Push & pull, Cars & trucks, Pounding benches, Balls, Pretend play, Play silks, Soft books, Puzzles, Instruments, Art supplies, Bath toys, Play mats, Climbers |
| Beds & bedding | 33 | Cribs & bassinets, Toddler beds, Floor beds, Mattresses, Mattress protectors, Sheets, Pillows, Blankets, Sleep sacks |
| Feeding | 19 | Baby food trays, Ice pop molds, Ice cube trays, Cups, Plates & bowls, Spoons & forks, Bibs, Snack containers, High chairs, Teethers, Pacifiers, Nursing pillows |
| Clothing & shoes | 18 | Shoes & slippers, Rain boots, Rain jackets, Pajamas, Bodysuits, Tops & bottoms, Socks & hats |
| Bath & diapering | hidden until listed | Towels, Bath toys, Changing pads, Cloth diapers |
| Furniture & decor | hidden until listed | Tables & chairs, Rugs, Climbers, High chairs, Play mats |
| Strollers & gear | hidden until listed | Strollers, Car seats, Carriers |

Types with no listings are hidden too; they appear on their own once the daily research adds a listing.

The previous four aisles (Play, Sleep, Eat and drink, Wear) mirrored the four research topics the catalog started from. Their links redirect: `/a/play` → `/a/toys`, `/a/sleep` → `/a/beds`, `/a/eat` → `/a/feeding`, `/a/wear` → `/a/clothing`.

## Presentation

Departments and types are shown as photo tiles with short names (`short` on each type), in the menu and on department pages, with no explanatory text. The photo is the first listing of that type that meets the default filters.

## Changing it

Add or move a type in `aisles[].types`; add a department to `aisles` with `was` listing any old ids it replaces. `node tools/check.js` checks that every type sits in a department.
