# Catalog growth plan: more products, product-type navigation, automated discovery

Written 2026-10-20 as a proposal. Nothing here is built yet: the navigation and the data schema stay as they are until M picks a path. Each part ends with a recommendation, and the last section lists what only M can decide.

Starting point (from `data.json` today): 4 departments, 23 product types, 122 listings, 155 products, 12 material filters, 9 standards. Departments are a fixed two-level tree (`groups` → `categories` → `entries`), and every listing sits in exactly one product type. 112 of the 122 listings have no `age` recorded.

---

## 1. Casting a wider net: which product categories to add

### What makes a category worth adding

A category earns a place when the same product type is sold both in materials and processes that buyers ask about and in alternatives that state something different, so the materials checklist actually separates products. Signals used below:

- **Mouth contact or food contact** (teethers, cups, plates, bottles): migration of substances from plastic, silicone, rubber, glazes and coatings is the main question.
- **Long skin contact or sleep** (sleepwear, sheets, sleep sacks): fibres, dyes, finishes, flame-resistance treatments.
- **Foam and padding** (nursing pillows, changing pads, car seats, high-chair cushions): polyurethane foam and the flame retardants historically added to meet flammability rules.
- **Coatings and treatments** (rainwear, stain-resistant fabric, mattress protectors): water- and stain-repellent finishes, which may use PFAS; several US states now restrict intentionally added PFAS in children's products or textiles.
- **Composite wood and finishes** (cribs, furniture, Montessori climbers): plywood and MDF glues (formaldehyde emissions are covered by TSCA Title VI / CARB Phase 2), paints and oil finishes.
- **Paints, glazes and metals** (painted toys, ceramic dishes, stainless cups, jewelry): lead and cadmium, nickel in snaps.

Each of these maps onto the checklist the site already uses (made with / stated free of / not stated / outside the criteria). Some need a new filter (see 1.3).

### 1.1 Candidate categories, grouped and prioritised

**Tier 1: add first.** Close to what the site already covers, strong material questions, squarely in the 12 to 24 month range, and the existing criteria mostly apply.

| Area | Product types | Why materials matter | Filters that apply today / new ones needed |
|---|---|---|---|
| Eating and drinking | Sippy, straw and open cups; plates, bowls and suction plates; spoons and forks; bibs; snack and lunch containers; high chairs | Mouth and food contact. Plastic vs stainless vs glass vs silicone vs wood; "bamboo" dishes are often bamboo fibre bound with melamine resin; bibs often have a PU or PVC coated layer; stainless cups can have solder or paint at the base | `main`, `silicone` testing, `wood` finish, `color`; new: **melamine or resin binder**, **lead tested / stated** |
| Teething and soothing | Teethers, pacifiers, teething rings, clip-on pacifier straps | Mouth contact all day. Natural rubber vs silicone vs plastic; painted or oiled wood; plastic clips on straps | `rubber`, `silicone`, `wood`, `parts`, `latex` |
| Sleep textiles | Crib sheets, sleep sacks and swaddles, blankets, pillows (toddler), mattress protectors | Long skin contact. Organic cotton or wool vs polyester; waterproof layers (PU, vinyl, wool puddle pads); stain or water repellent finishes | `main`, `wool`, `organic`; new: **water or stain repellent finish** |
| Sleepwear and everyday clothes | Pajamas, bodysuits, leggings, socks, hats | US rules require children's sleepwear (sizes 9 months to 14) to be flame resistant or tight-fitting; tight-fitting cotton is the untreated route, loose pajamas often polyester or treated. Dyes, prints (plastisol), snaps (nickel) | `main`, `organic`, `color`; new: **flame retardant treatment**, **print type** |
| Nursery foam and padding | Changing pads and covers, nursing pillows, floor cushions, play couch / foam play sets | Polyurethane foam, flame retardants, vinyl or PU covers; alternatives use wool, latex, cotton batting, coir | `main`, `latex`; new: **flame retardant treatment** |
| Nursery furniture | Cribs and bassinets, dressers, kids' tables and chairs, step stools, Montessori climbers (Pikler triangle) | Solid wood vs plywood/MDF, glue type, paint and finish; GREENGUARD Gold is commonly named | `wood` finish; new: **composite wood / formaldehyde**, standard **GREENGUARD Gold** |

**Tier 2: next.** Real material questions, but harder to research (bigger products, more parts, fewer natural alternatives).

| Area | Product types | Why materials matter |
|---|---|---|
| On the go | Car seats, strollers and stroller liners, baby carriers and wraps, diaper bags | Car seats must meet the federal vehicle flammability standard (FMVSS 302); some makers state they meet it without added flame retardants (for example with wool fabrics). Carriers: cotton or linen vs polyester mesh; stroller liners and foot muffs |
| Bath and changing | Hooded towels and washcloths, bath seats and tubs, cloth diapers and covers, changing mats | Cotton terry vs microfibre; cloth diaper covers are often PUL (polyurethane laminated polyester) vs wool covers; squeeze bath toys trap water |
| Play, extended | Art supplies (crayons: beeswax vs paraffin; finger paint; play dough), musical instruments, puzzles, ride-on and outdoor toys, sand toys, play tents and teepees, costumes | Pigments, binders, paints; play tents are often treated for flammability |
| Room | Rugs and play rugs, curtains, room storage baskets | Wool vs synthetic, latex or PVC backing, stain-resistant treatments |
| Older toddler / preschool | Backpacks, lunch bags, water bottles, rain jackets and splash suits | PVC, PU, PFAS repellents; stainless bottles with painted exteriors |

**Tier 3: decide before starting.** These change what kind of facts the site records.

| Area | Why it is different |
|---|---|
| Personal care (soap, shampoo, lotion, diaper cream, sunscreen, toothpaste) | The facts are an ingredient list (INCI names), not materials. Would need its own checklist shape and glossary terms (fragrance, preservatives, UV filters). Large and fast-moving market |
| Disposable diapers and wipes | Bleaching method (TCF / ECF), fragrance, lotions, plastic backsheet. Mostly plastic by design, so nearly everything misses M's default filters |
| Feeding equipment (bottles, nipples, breast pumps, formula pitchers) | Clear material story (glass, stainless, silicone, PP, natural rubber nipples) but outside the 12 to 24 month focus for bottles |
| School-age kids (5+) | Same concerns, much wider catalog; dilutes the baby and toddler focus |

### 1.2 How wide to go within a type

The site records every product researched, including ones that miss M's defaults. For types where nearly everything on the market is plastic (car seats, strollers, bibs), an unbounded catalog would bury the alternatives. Proposed rule of thumb per product type: every product found that states its materials in a way the checklist can use, plus the 3 to 5 best-selling conventional products as reference points (as the current "x_" listings already do, for example Oball, Jellycat, Hunter boots). M decides the number (see section 4).

### 1.3 New filters and standards the new types need

Filters keep the same one-direction behaviour (on = hide what misses) and appear as ordinary checkboxes. Suggested additions, with suggested defaults left to M:

| New filter (what it hides when on) | Kind | Applies to |
|---|---|---|
| Added flame retardant treatment | avoid | sleepwear, foam, car seats, play tents, mattresses (already partly covered by notes) |
| Water, stain or wrinkle resistant finish | avoid | sheets, protectors, clothing, rainwear, rugs |
| Composite wood (plywood, MDF, particleboard) or unnamed glue | avoid | furniture, cribs, climbers, toys |
| Melamine or resin-bound "bamboo" | avoid | dishes and utensils |
| No stated lead or heavy-metal testing | require | painted toys, ceramics, stainless cups |

New standards for the Standards facet: GREENGUARD Gold, MADE SAFE, CertiPUR-US (synthetic foam, worth showing because it names what a foam is), JPMA, ASTM F963 / CPSIA children's product certificate (partly covered by `us-toy`), Global Recycled Standard, bluesign.

Each needs a glossary entry with sources, as the current 47 terms have.

**Recommendation for question 1:** add the Tier 1 areas in this order: eating and drinking, teething and soothing, sleep textiles, sleepwear and clothes, nursery foam and padding, nursery furniture. Add the five filters above as each area needs them. Leave Tier 3 out until M decides on personal care.

---

## 2. Navigation: from departments to product types

### 2.1 What the current structure gets wrong as the catalog grows

- A listing lives in one product type, inside one department. Several current types belong in two places: bath toys (play and bath), play mats (play and nursery), pads/toppers/pillows/sheets (one type that is really four), ice cube trays (kitchen, not really a baby product).
- Departments are the only top-level way in. With Tier 1 added there would be about 50 product types; a four-department menu either grows long drop-downs or forces arbitrary homes.
- Age is a filter but is empty for 112 of 122 listings, so it can't carry navigation yet.
- Product type is stored implicitly by where the entry sits in the JSON tree, so moving a type means moving data.

### 2.2 Three options

**Option A: product type first, with "aisles" as a menu only (recommended).**
Every listing gets a `type` field naming one product type from a separate `taxonomy.json`. Each type lists one or more aisles it appears under (a type can be in two aisles). Aisles are only a menu and a landing page; filtering, URLs and counts all work on types. Secondary facets: age band, room, activity, material, standards, price, brand, ships from.

```
Aisles (menu)          Product types (one per listing)
Play                -> stacking, blocks, push-pull, cars, balls, dolls, soft-animals, rattles, books, silks, pretend, bath-toys, play-mats
Sleep               -> crib-mattresses, floor-beds, toddler-beds, mattress-protectors, toppers, pillows, crib-sheets, sleep-sacks
Eat and drink       -> freezer-trays, pop-molds, ice-trays, cups, plates-bowls, utensils, bibs, high-chairs
Teething            -> teethers, pacifiers
Wear                -> shoes, rain-boots, pajamas, bodysuits, socks
Bath and changing   -> bath-toys, towels, changing-pads, cloth-diapers
Nursery             -> play-mats, cribs, dressers, nursing-pillows, rugs
On the go           -> car-seats, strollers, carriers
```

Today's 23 types map to this with three changes: `pads` splits into protectors, toppers, pillows and sheets; `bath` and `mats` appear in two aisles; ice cube trays stay under Eat and drink but could be tagged "kitchen" in the room facet.

Pros: matches how shop sites work (type is what people search for), `/c/<type>` URLs already exist and keep working, adding a type is one line in `taxonomy.json`, and aisles can be rearranged without touching listings. Cons: needs a data migration (flatten entries, add `type`) and the menu code changes from groups to aisles.

**Option B: tags on every listing, no tree.**
Each listing carries tags in several dimensions (type, room, activity, age, material) and the home page offers several "shop by" entry points (Shop by type / room / age / material). There is no menu hierarchy, only facet pages.

Pros: maximum flexibility, any cut of the catalog is a URL. Cons: weaker browsing for a first-time visitor (no obvious "where do I start"), tag sprawl without a curated list, and it still needs a curated type list to stay usable, at which point it becomes Option A.

**Option C: activities instead of departments (Sleep, Eat, Play, Wear, Bathe, Go out).**
Rename and widen the departments into activities and keep the two-level tree.

Pros: smallest change, easy to explain. Cons: keeps the one-home-per-type problem (teethers: Eat or Play? play mats: Play or Sleep?), and a fifth or sixth area still lengthens the menu.

### 2.3 Facets that become useful with more types

| Facet | Values | Data needed |
|---|---|---|
| Age | 0 to 6 months, 6 to 12, 12 to 24, 2 to 3 years, 3+ | `age.min_months` for every listing (backfill from store pages; the discovery job in section 3 can fill it) |
| Room | Nursery, kitchen, bath, outdoors, car | derived from type in `taxonomy.json`, overridable per listing |
| Activity | Sleep, eat, play, wear, bathe, go out | derived from aisle |
| Contact | Mouth, skin, sleep surface, handled | derived from type; lets visitors filter by how close the item gets |

**Recommendation for question 2:** Option A. Product type becomes an explicit field, a `taxonomy.json` defines types and the aisles each appears in, departments become aisles in the menu, and `/d/<department>` links redirect to the matching aisle. Age, room and contact become facets, with an age backfill as part of the change.

---

## 3. Automating discovery and analysis

### 3.1 Shape of the pipeline

Four stages, each a script in `tools/` that writes files in the repo, so every step is visible in a pull request and can be re-run by hand. All of it fits GitHub Actions and the static site; nothing needs a server.

```
discover  ->  triage  ->  extract  ->  review & merge
(weekly)      (rules + small model)    (model, quote-checked)   (PR, human check)
writes        updates                  writes draft listings     data.json changes
research/     research/candidates.json research/drafts/<id>.json  only after review
candidates.json
```

**Stage 1: discover (no model, cheap).** Weekly job, like the price check. Sources, in order of signal:

1. **Brand watchlist.** Every brand already in `data.json` plus brands M adds. Many are Shopify stores, where `/products.json` lists every product with title, type, tags, description and variants; others publish a `sitemap.xml`. New handles since the last run become candidates. This is the cheapest and most reliable source.
2. **Certification lists.** MADE SAFE certified products, GREENGUARD (UL SPOT) product search, GOTS and OEKO-TEX label checks (these list companies or label numbers, so they verify claims more than they discover products), FSC.
3. **Web search queries per product type.** Templates like "organic cotton crib sheet", "natural rubber teether", "wool changing pad", "melamine-free bamboo plate", run through a search API (Brave Search API or Google Programmable Search; both have small free tiers). Returns pages, which triage reads.
4. **Recalls.** CPSC recalls (saferproducts.gov has a public API). Not a discovery source for new listings but a fact to record on existing ones, worded factually ("Recalled by CPSC on <date>: <reason as stated>").
5. **Community threads** M points to (as with the r/Mommit silicone post). Hand-added URLs only; no crawling of forums.

Output: `research/candidates.json`, each `{url, brand, title, source, first_seen, status}`, de-duplicated against every product URL in `data.json` and against a `research/rejected.json` list so nothing is looked at twice.

**Stage 2: triage (rules, then a small model).** Rules drop what is out of scope: wrong type (adult products), no US availability, duplicates, out-of-stock. A small model (Claude Haiku) reads the page title and first part of the text and answers three structured questions: which product type from `taxonomy.json`, which age range, and whether the page states any materials at all. Candidates that state materials go forward; a weekly cap (for example 30) keeps review manageable. The rest stay in the queue with a reason.

**Stage 3: extract (larger model, quote-checked).** For each triaged candidate, fetch the product page plus the brand's materials or FAQ page and any certificate PDF linked from it, strip them to text, and ask the model to fill the listing schema: `uses`, `free`, `unconfirmed`, `outside`, `facts`, `contains`, `standards`, `age`, `products`, `quote`. Every checklist line must come with the verbatim sentence it is based on and the URL it came from. A deterministic check then:

- drops any line whose quote is not found word for word in the fetched text and moves it to `unconfirmed` ("not stated");
- derives `facts` from the checked lines where it can, rather than trusting the model's own judgement;
- rejects banned tone words ("safe", "toxic", "avoid", "best", "top pick") in any text the site would show (this check should also go into `tools/check.js` for hand-written listings);
- saves the fetched text with its date and a hash under `research/snapshots/<id>/` so a reviewer can see exactly what the page said, and later runs can detect a change.

Output: one draft file per listing in `research/drafts/`, plus the photo URL (not yet downloaded; see the photo decision below).

**Stage 4: review and merge.** The job opens one pull request per week, "Product discovery: <date>", that moves approved drafts into `data.json`. Its body is a review table: product, type, each checklist line with its quote and link, and anything the checks dropped. The PR preview shows the new listings on the real site. A person reads the quotes and either merges, edits the draft, or moves it to `rejected.json` with a reason.

**Maintenance, reusing the same pieces.** The existing price check already fetches every product page weekly. It can also hash the materials text it finds and, when a page's wording changes, queue that listing for re-extraction, so a changed fabric or a dropped certification shows up as a diff in a PR rather than going unnoticed.

### 3.2 Where it runs

| Option | How | Cost | Notes |
|---|---|---|---|
| **GitHub Actions + Anthropic API key** | Scripts above run in a scheduled workflow; model calls use an `ANTHROPIC_API_KEY` repository secret | pay per token (estimate below) | Deterministic and reviewable; M adds the secret and sets a monthly spend limit in the Anthropic Console |
| **Scheduled Claude session (routine)** | A weekly Claude Code session in this project runs the same scripts and does triage and extraction itself, then opens the PR | uses M's Claude plan, no API key | Same quality as the hand research threads; less predictable run to run; no secret in the repo |
| Hybrid | Stage 1 and the checks in Actions (no model needed); stages 2 and 3 in the weekly routine | lowest API spend | Two moving parts |

Rough model cost for the API option at current list prices (Claude Haiku 5.5 at $0.10 / $0.50 per million input / output tokens for triage; Claude Opus 5.5 at $4 / $20 for extraction; the Batch API halves both):

- Triage: 300 candidates a week × about 3,000 tokens in, 200 out ≈ $0.12 a week.
- Extraction: 30 listings a week × about 20,000 tokens in (two or three pages of text), 3,000 out ≈ $4.20 a week, about $2 with batching.
- Total: roughly $10 to $20 a month at 30 new listings a week. Search API free tiers cover the query volume; GitHub Actions minutes for a public repository are free.

### 3.3 Risks, stated plainly

| Risk | What could go wrong | Mitigation |
|---|---|---|
| Wrong material facts | The model states something the page does not say, or reads a "may contain" as "contains" | Verbatim-quote check drops unsupported lines to "not stated"; facts derived by code; a person reviews every PR before it merges |
| Stale facts | Makers change materials or pages | Snapshot hash and change detection in the weekly price job; `checked` date on each listing |
| Blocked or fragile fetching | Amazon and Etsy already return 403 to the price check; some stores use bot protection | Prefer brand sites and Shopify JSON; record "page not reachable" rather than guess; respect `robots.txt` and pause between requests to one store |
| Instructions hidden in pages | A product page contains text aimed at the model | The extraction model has no tools and no write access; output is schema-validated and quote-checked; nothing it writes reaches `main` without review |
| Tone drift | Generated text slips into "safe", "non-toxic", "best" | Banned-word check in the pipeline and in `tools/check.js` |
| Review load | 30 drafts a week is a lot to read | Weekly cap; the review table puts quotes next to each line so a check is a skim, not research |
| Photo rights | The site copies store photos today; automation multiplies that | Decision for M: keep copying, link to the store image instead, or ask brands |
| Catalog bloat | Hundreds of near-identical plastic items | The per-type reference cap in 1.2; triage only advances pages that state materials |
| Spend | A loop or a big crawl runs up API cost | Hard caps per run in the scripts and a monthly limit on the API key |

### 3.4 How much stays human

Recommended: discovery and triage fully automatic; extraction automatic but quote-checked; **every new or changed listing reviewed by a person before it reaches `main`**. That means discovery PRs are an exception to the standing "merge when checks pass" rule: they would be opened as draft PRs with a `needs-review` label and only merged after a person has looked. Price-check PRs stay as they are.

**Recommendation for question 3:** build stage 1 (brand watchlist and search queries) and stage 3's quote check first, run them by hand for one product type (cups and plates) to measure accuracy against hand research, then schedule the weekly job. Run the model steps as a weekly Claude session (routine) to start, which needs no API key, and move to Actions with an API key only if the volume grows.

---

## 4. Decisions only M can make

1. **Which categories, in what order.** The proposed Tier 1 order is eating and drinking, teething, sleep textiles, sleepwear and clothes, nursery foam, nursery furniture. Is personal care (soap, lotion, sunscreen) in scope at all?
2. **Age ceiling.** The site is for babies and kids generally; propose 0 to 5 years so the catalog stays focused.
3. **Conventional reference products.** How many best-selling conventional items per product type to list for comparison (proposed 3 to 5), versus every product found.
4. **New filters and their defaults.** Flame retardant treatment, water or stain resistant finish, composite wood, melamine, lead testing: which to add, and which are pre-ticked.
5. **Navigation.** Option A (product types with aisles, recommended), B (tags only) or C (activities).
6. **Review level for automated listings.** Hold every discovery PR for a person (recommended, an exception to the merge-when-green rule), or publish automatically with a visible "not yet checked by a person" mark.
7. **Where the model runs.** A weekly Claude session on M's plan (recommended to start), or GitHub Actions with an Anthropic API key and a monthly spend limit M sets.
8. **Photos.** Keep copying store photos, link to them instead, or ask brands.
