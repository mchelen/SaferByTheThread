/* Saved by the Thread: turns data.json (schema 4) into a flat product catalog with the facets the shop filters on.
   Runs in the browser (window.SBTT) and in Node (module.exports) so tools/check can test the same rules. */
(function (root) {
  'use strict';

  // Approximate conversions for prices quoted in other currencies; such prices are shown with "about".
  var RATES = { GBP: 1.34, EUR: 1.16, NZD: 0.58, CAD: 0.72 };

  var PRICE_BANDS = [
    { id: 'u25', label: 'Under $25', min: 0, max: 25 },
    { id: '25-50', label: '$25 to $50', min: 25, max: 50 },
    { id: '50-100', label: '$50 to $100', min: 50, max: 100 },
    { id: '100-250', label: '$100 to $250', min: 100, max: 250 },
    { id: '250-500', label: '$250 to $500', min: 250, max: 500 },
    { id: '500+', label: '$500 and up', min: 500, max: Infinity }
  ];

  // Age range facet. A listing covers the months from its maker's age rating (or, without one, the usual ages for
  // its product type) and matches every band that range overlaps.
  var AGE_BANDS = [
    { id: '0-6m', label: 'Birth to 6 months', min: 0, max: 6 },
    { id: '6-12m', label: '6 to 12 months', min: 6, max: 12 },
    { id: '12-24m', label: '12 to 24 months', min: 12, max: 24 },
    { id: '2-3y', label: '2 to 3 years', min: 24, max: 36 },
    { id: '3-5y', label: '3 to 5 years', min: 36, max: 60 },
    { id: '5y+', label: '5 years and up', min: 60, max: Infinity }
  ];
  function ageBands(min, max) { return AGE_BANDS.filter(function (b) { return min < b.max && max > b.min; }).map(function (b) { return b.id; }); }
  function ageSpan(m) { return m === 0 ? 'birth' : m < 24 ? m + ' months' : (m % 12 ? (m / 12).toFixed(1).replace(/\.0$/, '') : m / 12) + ' years'; }
  function ageText(min, max) {
    if (max == null || max >= 72) return min === 0 ? 'From birth' : ageSpan(min).replace(/^./, function (c) { return c.toUpperCase(); }) + ' and up';
    if (min === 0) return 'Birth to ' + ageSpan(max);
    if (min < 24 && max <= 24) return min + ' to ' + max + ' months';
    return ageSpan(min) + ' to ' + ageSpan(max);
  }

  // "Made with" facet, read from the Made with and Flagged parts rows. Leather and latex come from `contains`.
  var MATERIALS = [
    { id: 'wool', label: 'Wool or felt', rx: /wool|merino|felt|mohair|melton/i },
    { id: 'cotton', label: 'Cotton', rx: /cotton|terry/i },
    { id: 'linen', label: 'Linen or hemp', rx: /linen|hemp|flax(?!seed)/i },
    { id: 'silk', label: 'Silk', rx: /silk/i },
    { id: 'wood', label: 'Wood', rx: /wood|maple|beech|birch|pine|walnut|cherry|oak\b|poplar|\bash\b|hardwood|bamboo|plywood/i },
    { id: 'latex', label: 'Natural rubber or latex', contains: 'latex' },
    { id: 'leather', label: 'Leather, suede or sheepskin', contains: 'leather' },
    { id: 'plant-fill', label: 'Coir, kapok or buckwheat', rx: /coir|kapok|buckwheat/i },
    { id: 'silicone', label: 'Silicone', rx: /silicone/i },
    { id: 'metal', label: 'Metal', rx: /stainless|steel|metal|\bbell\b|brass|alumin/i },
    { id: 'synthetic', label: 'Plastic or synthetics', rx: /plastic|polyester|polypropylene|polyethylene|polycarbonate|pvc|vinyl|\btpu\b|\btpr\b|\beva\b|nylon|acrylic|polyurethane|synthetic|\bpla\b|(?<!latex )foam(?! loop)|micro-fleece|spandex|elastane/i }
  ];

  // Chip text -> glossary term id. Checked in order; a chip can link several terms, never overlapping.
  var TERM_KEYS = [
    ['superwash', 'superwash|shrink-proofing|machine washable|wool treatments?|treatment on the (?:merino|wool)|treatment of the wool'],
    ['gots', 'gots'], ['gols', 'gols'], ['oeko-tex', 'oeko-tex'],
    ['flammability', 'flame retardants?|fire barrier'],
    ['natural-rubber', 'natural (?:vulcanised )?rubber(?: latex)?|rubber additives'],
    ['latex-foam', '(?:natural |organic )?(?:dunlop |talalay )?latex(?! product)(?: core| insert)?|dunlop|talalay'],
    ['plasticisers', 'phthalates?|plastici[sz]ers?'], ['pvc', 'pvc|vinyl'],
    ['bpa', 'bpa|bps'], ['tpr', 'tpr'], ['eva', '(?:algae-based )?eva'],
    ['synthetic-rubber', 'synthetic rubber|rubber type(?: in outsole)?(?: \\(natural or synthetic\\))?|outsole compound'],
    ['polyurethane', 'polyurethane(?: film| foam)?|tpu|synthetic foam|(?<!pla )foam'],
    ['polyester', 'polyester(?: binder)?|synthetic (?:batting|fill)|micro-fleece'],
    ['platinum', 'platinum(?:-cured)?'], ['lfgb', 'lfgb'], ['arrete', 'arrêté'],
    ['migration', '(?:published )?test report|finished-product testing|tested to us rules'],
    ['silicone', 'silicone'],
    ['chrome', 'chrome(?:-free)?(?: tanning)?|tanning(?: method)?'],
    ['leather', 'leather|calfskin|suede|sheepskin'],
    ['merino', 'merino(?: lambswool)?'], ['felt', 'felt(?:ed wool)?|wool melton|melton'],
    ['wool', '(?:lambs)?wool|mohair'], ['organic', 'organic'], ['cotton', 'cotton'], ['linen', 'linen'],
    ['silk', 'silk'], ['kapok', 'kapok'], ['coir', 'coir'], ['buckwheat', 'buckwheat(?: hulls)?'],
    ['food-grade', 'food[- ]grade'], ['non-toxic', 'non-toxic'],
    ['dyes', '(?:azo-free )?dyes?|pigments?|colou?rant|colouring|printing inks?|ink binder'],
    ['linseed', 'linseed(?: oil)?|flaxseed(?: oil)?'], ['beeswax', 'beeswax'],
    ['water-based', 'water-based paint|paint'],
    ['hardwood', '(?:solid )?hardwood|plywood|particle board|fiberboard|veneer|layered wood|engineered wood|wood frame|wood type|maple|pine|beech|walnut|cherry|oak|birch|poplar|ash|solid wood'],
    ['plastic', 'plastics?|polypropylene|polycarbonate|polyethylene|pe beans|pla|nylon|viscose|petrochemicals?|synthetics'],
    ['hidden', '(?:seam |hem |tufting )?thread(?: fibre)?|zippers?|glues?|adhesive(?: resin)?|elastic(?:ized)?|closures?|lining|hook-and-loop|velcro'],
    ['toy-safety', 'age rating']
  ];

  function parsePrice(text) {
    var t = String(text || '').replace(/plus \$[\d,.]+ shipping/ig, '');
    var foreign = /£|€|NZ\$|CAD ?\$/.test(t);
    var num = function (s) { return parseFloat(s.replace(/,/g, '')); };
    if (foreign) {
      var about = t.match(/about \$([\d,.]+)/);
      if (about) return { usd: num(about[1]), approx: true };
      var m = t.match(/(£|€|NZ\$|CAD ?\$)\s?([\d,.]+)/);
      if (!m) return null;
      var cur = m[1] === '£' ? 'GBP' : m[1] === '€' ? 'EUR' : m[1] === 'NZ$' ? 'NZD' : 'CAD';
      return { usd: Math.round(num(m[2]) * RATES[cur] * 100) / 100, approx: true };
    }
    var all = (t.match(/\$[\d,]+(?:\.\d+)?/g) || []).map(function (s) { return num(s.slice(1)); });
    if (!all.length) return null;
    return { usd: Math.min.apply(null, all), approx: /about/i.test(t) };
  }

  // US shipping for one store listing, from its `shipping` statement or its price text: 0 when free (or the
  // price is over the free-shipping threshold), a dollar amount when a flat rate is stated, null when unknown.
  function shipCost(p) {
    var num = function (x) { return parseFloat(x.replace(/,/g, '')); };
    var plus = String(p.price || '').match(/plus \$(\d{1,3}(?:,\d{3})*(?:\.\d+)?) shipping/i);
    if (plus) return num(plus[1]);
    var t = p.shipping || (/free (?:us )?shipping/i.test(p.price || '') ? 'Free shipping' : '');
    if (/^free shipping$/i.test(t)) return 0;
    var m = t.match(/^\$(\d{1,3}(?:,\d{3})*(?:\.\d+)?) shipping$/i);
    if (m) return num(m[1]);
    m = t.match(/free shipping on orders over \$(\d{1,3}(?:,\d{3})*(?:\.\d+)?)(?:, \$(\d{1,3}(?:,\d{3})*(?:\.\d+)?) below)?/i);
    if (!m || p.usd == null) return null;
    if (p.usd >= num(m[1])) return 0;
    // The rate under the threshold, unless it repeats the item price or the threshold (a misread store page).
    var below = m[2] ? num(m[2]) : null;
    return below != null && below < num(m[1]) && below !== p.usd ? below : null;
  }
  function shipLine(p) {
    if (p.shipCost === 0) return 'Free shipping';
    if (p.shipCost != null) return '+ ' + money(p.shipCost) + ' shipping';
    var over = (p.shipping || '').match(/free shipping on orders over (\$\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i);
    if (over) return 'Free shipping over ' + over[1];
    return /checkout/i.test(p.shipping || '') ? 'Shipping at checkout' : 'Shipping not recorded';
  }

  function money(n) {
    return '$' + (n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2).replace(/\.00$/, ''));
  }

  function fold(s) { return String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  function slug(s) { return fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  // Status of an entry under a set of switches. Mirrors the rules described in README.md.
  function evaluate(item, criteria, on, strict) {
    var miss = [], unst = [];
    criteria.forEach(function (c) {
      var f = item.facts[c.id];
      if (c.kind === 'contains') { if (on[c.id] && item.contains.indexOf(c.id) >= 0) miss.push(c); return; }
      if (!on[c.id] || f === undefined) return;
      if (f === 'no' || (c.kind === 'require' && f !== 'yes')) miss.push(c);
      else if (f === 'unknown') { if (strict) miss.push(c); else unst.push(c); }
    });
    return { miss: miss, unst: unst, ok: miss.length === 0 };
  }

  function build(data) {
    var items = [], cats = {}, groups = [], brands = {};
    var n = 0;
    // Aisles are the menu: each lists the product types it shows, and a type can sit in more than one aisle.
    data.types.forEach(function (t) {
      cats[t.id] = { id: t.id, title: t.title, short: t.short || t.title, intro: t.intro || '', outro: t.outro || '', ages: t.ages || null,
                     room: t.room || '', contact: t.contact || '', was: t.was || [], aisles: [], group: '' };
    });
    data.aisles.forEach(function (a) {
      a.types.forEach(function (id) { if (cats[id]) { cats[id].aisles.push(a.id); if (!cats[id].group) cats[id].group = a.id; } });
      groups.push({ id: a.id, title: a.title, blurb: a.blurb || '', source: a.source || '', was: a.was || [], cats: a.types.filter(function (id) { return cats[id]; }) });
    });
    // Listings in the order of their types in the aisles, so "Featured" groups like products together.
    var order = []; groups.forEach(function (g) { g.cats.forEach(function (id) { if (order.indexOf(id) < 0) order.push(id); }); });
    data.types.forEach(function (t) { if (order.indexOf(t.id) < 0) order.push(t.id); });
    order.forEach(function (tid) {
      var c = cats[tid];
      data.entries.filter(function (e) { return e.type === tid; }).forEach(function (e) {
          var prods = e.products.map(function (p) {
            var pr = parsePrice(p.price);
            var o = Object.assign({}, p, { usd: pr ? pr.usd : null, approx: pr ? pr.approx : false });
            o.shipCost = shipCost(o); o.total = o.usd != null && o.shipCost != null ? Math.round((o.usd + o.shipCost) * 100) / 100 : null;
            o.shipLine = shipLine(o);
            return o;
          });
          // Store listings cheapest first, by price with shipping where known, as a price comparison reads.
          var byCost = prods.slice().sort(function (a, b) { var x = a.total != null ? a.total : a.usd, y = b.total != null ? b.total : b.usd; return (x == null) - (y == null) || x - y; });
          var totals = prods.filter(function (p) { return p.total != null; }).map(function (p) { return p.total; });
          var prices = prods.filter(function (p) { return p.usd != null; }).map(function (p) { return p.usd; });
          var chips = e.uses.concat(e.outside || []).join(' | ');
          var mats = MATERIALS.filter(function (m) {
            return m.contains ? (e.contains || []).indexOf(m.contains) >= 0 : m.rx.test(chips);
          }).map(function (m) { return m.id; });
          var tAges = c.ages || { min_months: 0, max_months: 72 };
          var aMin = e.age ? e.age.min_months : tAges.min_months;
          var aMax = e.age ? (e.age.max_months != null ? e.age.max_months : Math.max(tAges.max_months, aMin + 12)) : tAges.max_months;
          var ships = {};
          prods.forEach(function (p) { ships[p.ships_from === 'US' ? 'us' : p.ships_from ? 'abroad' : 'unknown'] = 1; });
          // Shipping as the store or the recorded price text states it; "free" when any store ships free with no minimum.
          // Star rating: the store page with the most reviews, when any shows one.
          var rated = prods.filter(function (p) { return p.rating && p.rating.count > 0; }).sort(function (a, b) { return b.rating.count - a.rating.count; })[0];
          var shipTexts = prods.map(function (p) { return p.shipping || (/free (?:us )?shipping/i.test(p.price) ? 'Free shipping' : ''); });
          var freeShip = shipTexts.some(function (t) { return /^free shipping$/i.test(t); });
          var item = {
            id: e.id, n: n++, brand: e.brand, brandId: slug(e.brand), line: e.line, cat: c.id, group: c.group, aisles: c.aisles,
            uses: e.uses, free: e.free, unconfirmed: e.unconfirmed, outside: e.outside || [],
            facts: e.facts, contains: e.contains || [], standards: e.standards || [], age: e.age || null, ageMin: aMin, ageMax: aMax, ageBands: ageBands(aMin, aMax), ageStated: !!e.age,
            ageLabel: e.age ? e.age.text : ageText(aMin, aMax),
            quote: e.quote || '', evidence: e.evidence || '', note: e.note || '',
            img: e.img ? 'img/' + e.img + '.jpg' : '', photos: (e.photos && e.photos.length ? e.photos.map(function (p) { return p.key; }) : e.img ? [e.img] : []).map(function (k) { return 'img/' + k + '.jpg'; }),
            products: prods,
            min: prices.length ? Math.min.apply(null, prices) : null,
            max: prices.length ? Math.max.apply(null, prices) : null,
            approx: prods.some(function (p) { return p.approx; }),
            materials: mats, ships: Object.keys(ships), shipping: shipTexts, freeShip: freeShip,
            total: totals.length ? Math.min.apply(null, totals) : null, byCost: byCost, shipLine: byCost[0] ? byCost[0].shipLine : '',
            // Shipping facet: what the card shows, the cheapest listing's shipping.
            deliv: !byCost[0] || byCost[0].shipCost == null ? 'unknown' : byCost[0].shipCost === 0 ? 'free' : 'paid',
            rating: rated ? { value: rated.rating.value, count: rated.rating.count, store: rated.store, url: rated.url } : null,
            unstatedCount: e.unconfirmed.length,
            q: fold([e.brand, e.line, c.title].concat(c.aisles.map(function (id) { return groups.filter(function (g) { return g.id === id; })[0].title; }), e.uses, e.products.map(function (p) { return p.name + ' ' + p.store; })).join(' '))
          };
          items.push(item);
          (brands[item.brandId] = brands[item.brandId] || { id: item.brandId, name: e.brand, items: [] }).items.push(item);
        });
    });
    return { items: items, cats: cats, groups: groups, brands: brands, criteria: data.criteria, critGroups: data.criteria_groups || [], standards: data.standards || [], ask: data.ask, updated: data.updated };
  }

  // How a material criterion reads as a filter option: what you get when it is ticked.
  function filterLabel(c) {
    var l = c.label.charAt(0).toLowerCase() + c.label.slice(1);
    if (c.kind === 'require') return c.label.charAt(0).toUpperCase() + c.label.slice(1);
    if (c.id === 'wood') return 'Solid wood, no ' + l;
    return 'No ' + l;
  }

  // Short "from $X" style price for cards and buy boxes.
  function priceFrom(item) {
    if (item.min == null) return 'See store for price';
    var a = item.approx ? 'About ' : '';
    if (item.min === item.max) return a + money(item.min);
    return (item.approx ? 'From about ' : 'From ') + money(item.min);
  }

  function priceLabel(item) {
    if (item.min == null) return 'See store for price';
    var a = item.approx ? 'about ' : '';
    return item.min === item.max ? a + money(item.min) : a + money(item.min) + ' to ' + money(item.max);
  }

  // Splits chip text into [text, termId|null] runs using TERM_KEYS.
  var compiled = null;
  function termRuns(text, known) {
    if (!compiled) compiled = TERM_KEYS.map(function (k) { return [k[0], new RegExp('(?<![a-zà-ÿ])(?:' + k[1] + ')(?![a-zà-ÿ])', 'gi')]; });
    var spans = [];
    compiled.forEach(function (k) {
      if (known && !known[k[0]]) return;
      var rx = k[1], m; rx.lastIndex = 0;
      while ((m = rx.exec(text))) {
        var a = m.index, b = a + m[0].length;
        if (b === a) { rx.lastIndex++; continue; }
        if (!spans.some(function (s) { return a < s[1] && s[0] < b; })) spans.push([a, b, k[0]]);
      }
    });
    spans.sort(function (x, y) { return x[0] - y[0]; });
    var out = [], pos = 0;
    spans.forEach(function (s) { if (s[0] > pos) out.push([text.slice(pos, s[0]), null]); out.push([text.slice(s[0], s[1]), s[2]]); pos = s[1]; });
    if (pos < text.length) out.push([text.slice(pos), null]);
    return out;
  }

  var api = { build: build, evaluate: evaluate, parsePrice: parsePrice, priceLabel: priceLabel, priceFrom: priceFrom, shipCost: shipCost, filterLabel: filterLabel, money: money, termRuns: termRuns, fold: fold, slug: slug,
              PRICE_BANDS: PRICE_BANDS, AGE_BANDS: AGE_BANDS, MATERIALS: MATERIALS, ageText: ageText };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SBTT = api;
})(this);
