# What the big shops do, and what this site borrows

Reviewed 2026-10-20 against the live site (after the storefront rewrite, #8, and the price and shipping pass, #7), comparing it with Amazon product and list pages and with Shopify storefronts built on the standard themes (Dawn and the paid themes that follow its layout). Checked in Chromium at 1360 px and 390 px.

The site has no cart, accounts or reviews: it links out to the stores that sell each product, and keeps Saved and Compare lists in the browser. So the question was which shop patterns still make sense for a static guide, and which need a backend.

## Already in place

Most of the shop furniture from the big sites is already here after #8, so this pass does not redo it:

| Pattern | Seen on | On this site |
| --- | --- | --- |
| Department menu with drop-downs, breadcrumbs | Amazon, every Shopify theme | Yes |
| Search with suggestions as you type (products, brands, types) | Amazon, Shopify predictive search | Yes, plus materials and glossary terms |
| Left filter rail with counts and removable chips; full-screen filter drawer on phones that applies on "Show N results" | Amazon, Shopify filters | Yes |
| Quick view from the grid | Shopify themes | Yes |
| Sticky buy box beside the photo | Amazon, Shopify | Yes, on desktop |
| Badges on cards (free shipping, more than one store) | Amazon, Shopify | Yes |
| Wish list / favourites | Amazon lists, Shopify wishlist apps | Saved list |
| Side-by-side compare with a floating tray | Many Shopify themes, Best Buy | Compare, up to four |
| Recently viewed | Amazon "browsing history", Shopify themes | On product pages |
| Back to top, scroll position kept on Back | Common | Yes |

## Added in this pass

1. **Share a list by link.** Amazon lists and baby registries are made to be sent to someone else, and gift-shopping is what this project is for. The Saved page now has "Share this list", which makes a link (`/saved?ids=…`) that shows the same products on any device. Opening a shared link changes nothing in the visitor's own list; a "Save all to my list" button copies the products in if they want them. Compare works the same way (`/compare?ids=…`, "Use as my compare list"). No account or server is needed, because the list travels in the link.
2. **Share button on product pages.** Shopify themes put a Share button by the buy buttons. On phones it opens the phone's share sheet; on a computer it copies the link and says so.
3. **"Compare with similar items" on product pages.** Amazon puts a small comparison table under the product with the item and three similar ones. Here the table shows the product and up to three others of the same type (those that meet your filters first), with price, shipping, your material filters, made with, not stated, and ships from. "Open in Compare" opens the full table without replacing your own compare list.
4. **Buy bar on phones.** On Amazon's and most Shopify themes' phone product pages the price and buy button stay in reach once the buy box has scrolled away. On a phone, once the store link is above the screen, a bar at the bottom shows the product name, price and "Buy at <store>". It disappears when the buy box is back on screen, and sits above the compare tray when both are showing.
5. **Confirmation when saving.** Amazon and Shopify confirm an "add" in place with a link to the list. Saving now shows a short note, "Saved to your list. View saved (N)", instead of only filling the heart.
6. **"Pick up where you left off" on the home page.** Amazon's home page starts returning visitors with what they last looked at. The home page now shows recently viewed products under the departments, with a link to the Saved list.
7. **Filter & sort bar stays at the top on phones.** Shopify themes keep the filter and sort bar pinned under the header on phone listing pages, so filters are one tap away mid-scroll. The results toolbar is now sticky on phones.
8. **Two fixes found on the way:** a blank 20 px strip at the very top of every page (the icon sprite was taking space), and department tiles on the home page whose labels sat at different heights depending on the photo's shape.

## Not taken, and why

- **Ratings and reviews, Q&A, "bestseller" and "Amazon's choice" badges, "frequently bought together".** These need real customers and a server, and a ranking badge would be a recommendation, which this guide doesn't make.
- **Cart, checkout, accounts, price alerts by email.** Nothing is sold here, and alerts would need accounts and a mail service. The weekly price check already keeps prices current.
- **Several photos per product with thumbnails and zoom on hover.** Done since: #27 saved every store photo, and the 2026-10-26 pass made the gallery swipe (snap scrolling, arrows, counter, thumbnails on every width, a swipeable enlarged view). Hover zoom is still left out: most store photos are around 800 px, so the enlarged view already shows all there is.
- **Variant swatches (size, colour) on cards.** Listings with several sizes link to the store's own options; the price check reads the named one. Swatches would need per-variant data that isn't collected.
- **Urgency cues** ("only 3 left", countdowns). Not true for a guide, and against its factual tone.
- **Infinite scroll.** The grid uses "Show more", which keeps the footer reachable and Back working, and with 122 listings there is little to load.

## Google Shopping

Added 2026-10-20 at M's request. Google Shopping is a price-comparison site rather than a shop: it lists the same product from many stores, so its pages put price, shipping and the store side by side, and its filters lead with price and delivery. Patterns it uses, per [Google's own shopping posts](https://blog.google/products/shopping/save-money-price-insights-price-alerts/) and the live site:

| Pattern on Google Shopping | Here |
| --- | --- |
| Shipping under the price on every result ("Free delivery", "+$5.99 delivery") | **Added.** Each card has a shipping line under the price, from the cheapest store listing: "Free shipping", "+ $9.95 shipping", "Free shipping over $50", "Shipping at checkout" or "Shipping not recorded". Free-over-a-minimum counts as free when the price is over the minimum. This replaces the "Free shipping" photo badge. |
| A row of one-tap refinement chips above the results (free delivery, price ranges, top brands or features) | **Added.** "Free shipping", "Ships from the US", the first three price bands and the three most common materials in the current list, shown only when they would leave something. They are the same filters as the rail, so a chip and its checkbox stay in step. |
| Free-delivery filter | **Added** as a "Shipping to the US" group in the filter rail (free, cost stated, or free over a minimum / at checkout / not recorded). |
| Sort by total price | **Added** "Price + shipping: low to high". Where a store's shipping isn't known, the item price is used. |
| "Compare prices" on a product: every store's offer, cheapest first, with item price and delivery | **Added.** When a listing is sold by more than one store the product page heads the offers "Prices at N stores, lowest first" and sorts them by price with shipping where known; a stated flat rate shows the total ("about $X with shipping"). One store's sizes or options keep the order the research recorded. The card badge now says "2 stores" only for different stores, and "3 options" for one store's options. |
| Price insights (low, typical or high for the last three months) and price-drop alerts | **Not yet.** The weekly price check overwrites the price; keeping a short history in `data.json` would let product pages say when the price last changed and the range seen. Alerts need accounts and email. |
| Ratings, "deals" and sponsored placement | Not taken, as above. |

Also from M's feedback the same day: the black banner at the top of every page ("An independent guide: nothing is sold here…") moved to a line under the home page's buttons. The same statement stays in the footer and on the About page.

## Possible next steps

- A printable or plain-text version of a shared list, for sending by email or message.
- Save more than one photo per listing so the product page can have a gallery.

Screenshots: `docs/screenshots/v3-*.png`.
