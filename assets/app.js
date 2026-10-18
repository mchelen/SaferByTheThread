/* Saved by the Thread: shop-style front end. Hash routes:
   #/            catalog (query: q, dept, cat, brand, mat, std, age, ship, price, sort, misses)
   #/p/<id>      product page          #/brands     brand index
   #/glossary    glossary (#/glossary/<term> opens at a term)   #/about   how the guide works */
(function () {
  'use strict';
  var S = window.SBTT;
  var main = document.getElementById('main');
  var C, TERMS = {}, GLOSS = null, RULES = {}, STRICT = false;
  var RULES_KEY = 'sbtt-filters-2';
  var FACETS = ['dept', 'cat', 'brand', 'mat', 'std', 'age', 'ship', 'price'];
  var openPanels = { cat: true, price: true, brand: true, mat: true, rules: true };
  var shopScroll = 0, lastRoute = '';

  // ---------- helpers ----------
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function linked(text) {
    return S.termRuns(text, TERMS).map(function (r) {
      return r[1] ? '<a class="term-link" href="#/glossary/' + r[1] + '" data-term="' + r[1] + '">' + esc(r[0]) + '</a>' : esc(r[0]);
    }).join('');
  }
  function termLink(id, label) {
    return TERMS[id] ? '<a class="term-link" href="#/glossary/' + id + '" data-term="' + id + '">' + esc(label) + '</a>' : esc(label);
  }
  function catTitle(id) { return C.cats[id] ? C.cats[id].title : id; }
  function groupOf(id) { return C.groups.filter(function (g) { return g.id === id; })[0]; }

  // ---------- material rules (switches) ----------
  function loadRules() {
    C.criteria.forEach(function (c) { RULES[c.id] = !!c['default']; });
    STRICT = false;
    try {
      var s = JSON.parse(localStorage.getItem(RULES_KEY) || 'null');
      if (s) { Object.keys(s.c || {}).forEach(function (k) { if (k in RULES) RULES[k] = !!s.c[k]; }); STRICT = !!s.strict; }
    } catch (e) {}
  }
  function saveRules() { try { localStorage.setItem(RULES_KEY, JSON.stringify({ c: RULES, strict: STRICT })); } catch (e) {} }
  function rulesAreDefault() { return !STRICT && C.criteria.every(function (c) { return RULES[c.id] === !!c['default']; }); }
  function status(item) { return S.evaluate(item, C.criteria, RULES, STRICT); }

  // ---------- routing and query state ----------
  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var qi = h.indexOf('?'), path = qi >= 0 ? h.slice(0, qi) : h, qs = qi >= 0 ? h.slice(qi + 1) : '';
    var q = {};
    qs.split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); });
    return { parts: path.split('/').filter(Boolean), q: q };
  }
  function readState(q) {
    var st = { q: q.q || '', sort: q.sort || 'featured', misses: q.misses === '1' };
    FACETS.forEach(function (f) { st[f] = q[f] ? q[f].split(',').filter(Boolean) : []; });
    return st;
  }
  function stateHash(st) {
    var parts = [];
    if (st.q) parts.push('q=' + encodeURIComponent(st.q));
    FACETS.forEach(function (f) { if (st[f].length) parts.push(f + '=' + st[f].map(encodeURIComponent).join(',')); });
    if (st.sort && st.sort !== 'featured') parts.push('sort=' + st.sort);
    if (st.misses) parts.push('misses=1');
    return '#/' + (parts.length ? '?' + parts.join('&') : '');
  }
  var STATE = readState({});
  function setState(st, push) {
    STATE = st;
    var h = stateHash(st);
    if (push) location.hash = h;
    else { try { history.replaceState(null, '', h); } catch (e) { location.hash = h; } renderShop(true); }
  }

  // ---------- filtering ----------
  function facetValues(item, f) {
    switch (f) {
      case 'dept': return [item.group];
      case 'cat': return [item.cat];
      case 'brand': return [item.brandId];
      case 'mat': return item.materials;
      case 'std': return item.standards;
      case 'age': return [item.ageBand];
      case 'ship': return item.ships;
      case 'price':
        return S.PRICE_BANDS.filter(function (b) {
          return item.min != null && item.min < b.max && (item.max == null ? item.min : item.max) >= b.min;
        }).map(function (b) { return b.id; }).concat(item.min == null ? ['none'] : []);
    }
    return [];
  }
  function matchesFacet(item, f, st) {
    if (!st[f].length) return true;
    var v = facetValues(item, f);
    if (f === 'mat' || f === 'std') return st[f].every(function (x) { return v.indexOf(x) >= 0; }); // must have all chosen
    return st[f].some(function (x) { return v.indexOf(x) >= 0; });
  }
  function matchesQuery(item, q) {
    if (!q) return true;
    var words = S.fold(q).split(/\s+/).filter(Boolean);
    return words.every(function (w) { return item.q.indexOf(w) >= 0; });
  }
  function filtered(st, except) {
    return C.items.filter(function (it) {
      if (!matchesQuery(it, st.q)) return false;
      return FACETS.every(function (f) { return f === except || matchesFacet(it, f, st); });
    });
  }
  function sortItems(list, how) {
    var by = {
      featured: function (a, b) { return a.n - b.n; },
      'price-asc': function (a, b) { return (a.min == null) - (b.min == null) || a.min - b.min || a.n - b.n; },
      'price-desc': function (a, b) { return (a.min == null) - (b.min == null) || b.min - a.min || a.n - b.n; },
      brand: function (a, b) { return S.fold(a.brand).localeCompare(S.fold(b.brand)) || a.n - b.n; },
      name: function (a, b) { return S.fold(a.line).localeCompare(S.fold(b.line)) || a.n - b.n; },
      stated: function (a, b) { return a.unstatedCount - b.unstatedCount || a.n - b.n; }
    }[how] || function (a, b) { return a.n - b.n; };
    return list.slice().sort(by);
  }
  var SORTS = [['featured', 'Featured'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'],
               ['brand', 'Brand: A to Z'], ['name', 'Product name: A to Z'], ['stated', 'Fewest details not stated']];

  // ---------- pieces ----------
  function photo(item, cls) {
    var alt = esc(item.brand + ' ' + item.line);
    if (!item.img) return '<div class="ph ' + (cls || '') + ' empty"><span>No store photo saved</span></div>';
    return '<div class="ph ' + (cls || '') + '"><img src="' + esc(item.img) + '" alt="' + alt + '" loading="lazy" width="640" height="480" onerror="this.parentNode.classList.add(\'empty\');this.outerHTML=\'<span>No store photo saved</span>\'"></div>';
  }
  function statusLine(item, r) {
    if (!r.ok) return '<p class="pill miss">Misses: ' + esc(r.miss.map(function (c) { return c.short + (c.kind !== 'contains' && item.facts[c.id] === 'unknown' ? ' (not stated)' : ''); }).join(', ')) + '</p>';
    return '<p class="pill ok">Meets your rules' + (r.unst.length ? '<span> · ' + plural(r.unst.length, 'detail') + ' not stated</span>' : '') + '</p>';
  }
  function card(item) {
    var r = status(item);
    var mats = item.materials.slice(0, 3).map(function (m) { return S.MATERIALS.filter(function (x) { return x.id === m; })[0].label; });
    var abroad = item.ships.indexOf('abroad') >= 0 && item.ships.indexOf('us') < 0;
    return '<article class="card' + (r.ok ? '' : ' is-miss') + '">' +
      '<a class="card-link" href="#/p/' + esc(item.id) + '">' + photo(item) +
      (item.products.length > 1 ? '<span class="badge">' + item.products.length + ' products</span>' : '') +
      '<div class="card-body"><p class="brand">' + esc(item.brand) + '</p><h3>' + esc(item.line) + '</h3>' +
      '<p class="price">' + esc(S.priceLabel(item)) + '</p>' +
      '<p class="tags">' + mats.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + (abroad ? '<span class="tag-ship">Ships from abroad</span>' : '') + '</p>' +
      statusLine(item, r) + '</div></a></article>';
  }

  // ---------- shop ----------
  function optionList(f, opts, counts, st, name) {
    return opts.map(function (o) {
      var n = counts[o.id] || 0, on = st[f].indexOf(o.id) >= 0;
      if (!n && !on && o.hideEmpty) return '';
      return '<label class="opt' + (n || on ? '' : ' dim') + '"><input type="checkbox" data-facet="' + f + '" value="' + esc(o.id) + '" id="f-' + f + '-' + esc(o.id) + '"' + (on ? ' checked' : '') + '>' +
        '<span>' + (o.html || esc(o.label)) + '</span><span class="n">' + n + '</span></label>';
    }).join('');
  }
  function countsFor(f, st) {
    var counts = {};
    filtered(st, f).forEach(function (it) {
      if (!st.misses && !status(it).ok) return;
      facetValues(it, f).forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    });
    return counts;
  }
  function panel(id, title, body, extra) {
    return '<details class="panel" data-panel="' + id + '"' + (openPanels[id] ? ' open' : '') + '><summary>' + title + (extra || '') + '</summary><div class="panel-body">' + body + '</div></details>';
  }
  function sidebar(st) {
    var h = '';
    // Product type, grouped by department
    var cc = countsFor('cat', st);
    h += panel('cat', 'Product type', C.groups.map(function (g) {
      return '<p class="opt-group">' + esc(g.title) + '</p>' + optionList('cat', g.cats.map(function (id) { return { id: id, label: C.cats[id].title }; }), cc, st);
    }).join(''), st.cat.length ? '<span class="cnt">' + st.cat.length + '</span>' : '');
    // Price
    h += panel('price', 'Price', optionList('price', S.PRICE_BANDS.concat([{ id: 'none', label: 'Price not listed', hideEmpty: true }]), countsFor('price', st), st) +
      '<p class="hint">Prices in other currencies are converted roughly to US dollars.</p>', st.price.length ? '<span class="cnt">' + st.price.length + '</span>' : '');
    // Brand
    var bc = countsFor('brand', st);
    var brands = Object.keys(C.brands).map(function (k) { return C.brands[k]; }).sort(function (a, b) { return S.fold(a.name).localeCompare(S.fold(b.name)); });
    h += panel('brand', 'Brand', '<input type="search" class="brand-find" id="brand-find" placeholder="Find a brand" aria-label="Find a brand">' +
      '<div class="brand-opts" id="brand-opts">' + optionList('brand', brands.map(function (b) { return { id: b.id, label: b.name }; }), bc, st) + '</div>',
      st.brand.length ? '<span class="cnt">' + st.brand.length + '</span>' : '');
    // Made with
    h += panel('mat', 'Made with', optionList('mat', S.MATERIALS, countsFor('mat', st), st) +
      '<p class="hint">From each product\'s Made with and Flagged parts lists. Ticking several shows products that have all of them.</p>', st.mat.length ? '<span class="cnt">' + st.mat.length + '</span>' : '');
    // Standards
    h += panel('std', 'Standards the maker names', optionList('std', C.standards.map(function (s) { return { id: s.id, label: s.label }; }), countsFor('std', st), st) +
      '<p class="hint">Listed when a maker or store names the standard. The product page says what the claim covers.</p>', st.std.length ? '<span class="cnt">' + st.std.length + '</span>' : '');
    // Age
    h += panel('age', 'Age rating', optionList('age', S.AGE_BANDS.concat([{ id: 'none', label: 'No age rating recorded' }]), countsFor('age', st), st) +
      '<p class="hint">The age a maker or store states. Most product pages give none.</p>', st.age.length ? '<span class="cnt">' + st.age.length + '</span>' : '');
    // Shipping
    h += panel('ship', 'Sold from', optionList('ship', [{ id: 'us', label: 'A US shop' }, { id: 'abroad', label: 'A shop outside the US' }, { id: 'unknown', label: 'Not recorded' }], countsFor('ship', st), st),
      st.ship.length ? '<span class="cnt">' + st.ship.length + '</span>' : '');
    // Material rules
    var kinds = [['avoid contains', 'Hide items that have'], ['require', 'Hide items unless the maker states']];
    var rules = '<p class="hint lead">Every switch that is on hides the items that don\'t meet it. The defaults are the preferences this guide started from.</p>' +
      kinds.map(function (k) {
        return '<fieldset><legend>' + k[1] + '</legend>' + C.criteria.filter(function (c) { return k[0].split(' ').indexOf(c.kind) >= 0; }).map(function (c) {
          var label = c.label.charAt(0).toUpperCase() + c.label.slice(1);
          return '<label class="switch"><input type="checkbox" data-rule="' + c.id + '" id="r-' + c.id + '"' + (RULES[c.id] ? ' checked' : '') + '><span class="track" aria-hidden="true"></span>' +
            '<span class="sw-text"><b>' + esc(label) + '</b>' + (TERMS[c.term] ? ' <a class="q" href="#/glossary/' + c.term + '" data-term="' + c.term + '" aria-label="What this means: ' + esc(c.short) + '">?</a>' : '') +
            '<small>' + esc(c.help) + '</small></span></label>';
        }).join('') + '</fieldset>';
      }).join('') +
      '<fieldset><legend>Details that aren\'t stated</legend><label class="switch"><input type="checkbox" id="r-strict"' + (STRICT ? ' checked' : '') + '><span class="track" aria-hidden="true"></span>' +
      '<span class="sw-text"><b>Count unstated details as misses</b><small>When on, an item is hidden if a detail one of your switches covers isn\'t stated on its page.</small></span></label></fieldset>' +
      '<button type="button" class="btn-ghost" id="rules-reset"' + (rulesAreDefault() ? ' disabled' : '') + '>Reset rules to defaults</button>';
    h += panel('rules', 'Material rules', rules, rulesAreDefault() ? '' : '<span class="cnt">changed</span>');
    return h;
  }
  function activeChips(st) {
    var chips = [];
    function add(f, v, label) { chips.push('<button type="button" class="chip-x" data-clear="' + f + '" data-val="' + esc(v) + '">' + esc(label) + ' <span aria-hidden="true">×</span><span class="sr"> remove</span></button>'); }
    if (st.q) add('q', '', '“' + st.q + '”');
    st.dept.forEach(function (v) { var g = groupOf(v); add('dept', v, g ? g.title : v); });
    st.cat.forEach(function (v) { add('cat', v, catTitle(v)); });
    st.brand.forEach(function (v) { add('brand', v, C.brands[v] ? C.brands[v].name : v); });
    st.mat.forEach(function (v) { var m = S.MATERIALS.filter(function (x) { return x.id === v; })[0]; add('mat', v, m ? m.label : v); });
    st.std.forEach(function (v) { var s = C.standards.filter(function (x) { return x.id === v; })[0]; add('std', v, s ? s.label : v); });
    st.age.forEach(function (v) { var a = S.AGE_BANDS.filter(function (x) { return x.id === v; })[0]; add('age', v, a ? a.label : 'No age rating'); });
    st.ship.forEach(function (v) { add('ship', v, { us: 'US shop', abroad: 'Shop outside the US', unknown: 'Shop location not recorded' }[v]); });
    st.price.forEach(function (v) { var b = S.PRICE_BANDS.filter(function (x) { return x.id === v; })[0]; add('price', v, b ? b.label : 'Price not listed'); });
    if (chips.length > 1) chips.push('<button type="button" class="chip-clear" id="clear-all">Clear all</button>');
    return chips.join('');
  }
  function hero() {
    var tiles = C.groups.map(function (g) {
      var items = C.items.filter(function (i) { return i.group === g.id; });
      var pic = items.filter(function (i) { return i.img; })[0];
      return '<a class="dept" href="#/?dept=' + g.id + '">' + (pic ? '<img src="' + esc(pic.img) + '" alt="" loading="lazy">' : '') +
        '<span class="dept-t">' + esc(g.title) + '</span><span class="dept-n">' + plural(items.length, 'product') + '</span></a>';
    }).join('');
    return '<section class="hero"><div class="hero-copy"><p class="eyebrow">For parents and guardians of babies and toddlers</p>' +
      '<h1>Saved by the Thread</h1><p class="tagline">Reading the fine print so you don’t have to.</p>' +
      '<p class="lede">Every product lists what its maker says it is made of, what the maker says is absent, and what no page states. Material rules hide what you don\'t want; the defaults are one family\'s preferences, and you can change them.</p></div>' +
      '<div class="depts-grid">' + tiles + '</div></section>';
  }
  function renderShop(keepSidebarFocus) {
    var st = STATE;
    var focusId = keepSidebarFocus && document.activeElement && document.activeElement.id;
    var brandFind = $('#brand-find') ? $('#brand-find').value : '';
    var all = sortItems(filtered(st), st.sort);
    var ok = all.filter(function (i) { return status(i).ok; }), miss = all.filter(function (i) { return !status(i).ok; });
    var shown = st.misses ? ok.concat(miss) : ok;
    var anyFilter = st.q || FACETS.some(function (f) { return st[f].length; });
    var title = st.q ? 'Results for “' + esc(st.q) + '”' :
      st.cat.length === 1 && FACETS.every(function (f) { return f === 'cat' || !st[f].length; }) ? esc(catTitle(st.cat[0])) :
      st.dept.length === 1 && FACETS.every(function (f) { return f === 'dept' || !st[f].length; }) ? esc(groupOf(st.dept[0]).title) :
      st.brand.length === 1 && FACETS.every(function (f) { return f === 'brand' || !st[f].length; }) ? esc(C.brands[st.brand[0]].name) : 'All products';
    var intro = '';
    if (st.cat.length === 1 && C.cats[st.cat[0]].intro) intro = '<p class="cat-intro">' + esc(C.cats[st.cat[0]].intro) + '</p>';
    else if (st.dept.length === 1 && !st.cat.length) {
      var g = groupOf(st.dept[0]);
      intro = '<p class="cat-intro">' + esc(g.blurb) + (g.source ? ' <a href="' + esc(g.source) + '" target="_blank" rel="noopener">Read the post</a>.' : '') + '</p>';
    }
    var missBar = miss.length ? '<div class="missbar"><p>' + (st.misses
        ? plural(miss.length, 'item that misses', 'items that miss') + ' your material rules ' + (miss.length === 1 ? 'is' : 'are') + ' shown after the rest, marked “Misses”.'
        : '<b>' + plural(miss.length, 'more item is', 'more items are') + '</b> hidden by your material rules.') + '</p>' +
      '<button type="button" class="btn-ghost" id="toggle-misses">' + (st.misses ? 'Hide them' : 'Show them') + '</button>' +
      '<button type="button" class="btn-link" id="open-rules">Change rules</button></div>' : '';
    main.innerHTML = (anyFilter ? '' : hero()) +
      '<div class="shop" id="shop">' +
      '<aside class="side" id="side" aria-label="Filters"><div class="side-h"><h2>Filters</h2><button type="button" class="btn-ghost side-close" id="side-close">Done</button></div>' + sidebar(st) + '</aside>' +
      '<section class="results" aria-labelledby="res-h">' +
      '<div class="res-head"><div><h2 id="res-h">' + title + '</h2>' + intro + '</div>' +
      '<div class="res-tools"><p class="res-count" aria-live="polite">' + plural(shown.length, 'product') + '</p>' +
      '<button type="button" class="btn-ghost filt-btn" id="side-open">Filters' + (anyFilter ? ' <span class="cnt">on</span>' : '') + '</button>' +
      '<label class="sort">Sort by <select id="sort">' + SORTS.map(function (s) { return '<option value="' + s[0] + '"' + (st.sort === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></label></div></div>' +
      '<div class="active">' + activeChips(st) + '</div>' + missBar +
      (shown.length ? '<div class="grid">' + shown.map(card).join('') + '</div>' :
        '<div class="empty-state"><p>Nothing matches these filters' + (miss.length && !st.misses ? ' and your material rules' : '') + '.</p>' +
        (anyFilter ? '<button type="button" class="btn-ghost" id="clear-all-2">Clear filters</button>' : '') + '</div>') +
      '</section></div>';
    $('#q').value = st.q;
    if (brandFind) { $('#brand-find').value = brandFind; filterBrandList(brandFind); }
    if (focusId && document.getElementById(focusId)) document.getElementById(focusId).focus();
    if (document.body.classList.contains('side-on') && !focusId) $('#side-close').focus();
    setNav('shop');
    document.title = (title === 'All products' ? '' : title.replace(/&[^;]+;/g, '') + ' · ') + 'Saved by the Thread';
  }
  function filterBrandList(v) {
    var f = S.fold(v);
    $$('#brand-opts .opt').forEach(function (l) { l.hidden = f && S.fold(l.textContent).indexOf(f) < 0; });
  }

  // ---------- product page ----------
  var ROWS = [['uses', 'r-uses', '✓', 'Made with'], ['free', 'r-free', '⊘', 'Stated free of'], ['unconfirmed', 'r-unk', '?', 'Not stated'], ['outside', 'r-out', '✕', 'Flagged parts']];
  function checklist(item) {
    return '<dl class="check">' + ROWS.filter(function (r) { return item[r[0]] && item[r[0]].length; }).map(function (r) {
      return '<div class="row ' + r[1] + '"><span class="ic" aria-hidden="true">' + r[2] + '</span><dt>' + r[3] + '</dt><dd>' +
        item[r[0]].map(function (x) { return '<span class="chip">' + linked(x) + '</span>'; }).join('') + '</dd></div>';
    }).join('') + '</dl>';
  }
  function ruleTable(item) {
    var rows = C.criteria.map(function (c) {
      var v;
      if (c.kind === 'contains') v = item.contains.indexOf(c.id) >= 0 ? 'has' : null;
      else v = item.facts[c.id] || null;
      if (!v) return '';
      var txt = { yes: c.kind === 'require' ? 'Stated' : 'Meets', no: c.kind === 'require' ? 'Not met' : 'Has it', unknown: 'Not stated', has: 'Has it' }[v];
      var cls = { yes: 'ok', no: 'no', unknown: 'unk', has: 'no' }[v];
      return '<tr><th scope="row">' + termLink(c.term, c.label.charAt(0).toUpperCase() + c.label.slice(1)) + '</th><td><span class="v ' + cls + '">' + txt + '</span></td><td class="sw">' + (RULES[c.id] ? 'Switch on' : 'Switch off') + '</td></tr>';
    }).join('');
    return '<table class="rules-t"><caption class="sr">How this item reads against each material rule</caption><thead><tr><th scope="col">Rule</th><th scope="col">This item</th><th scope="col">Your setting</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function renderProduct(id) {
    var item = C.items.filter(function (i) { return i.id === id; })[0];
    if (!item) { main.innerHTML = '<div class="page"><h1>Not found</h1><p>No product with that address. <a href="#/">Back to the shop</a>.</p></div>'; return; }
    var r = status(item), g = groupOf(item.group), cat = C.cats[item.cat];
    var stds = item.standards.map(function (s) { var d = C.standards.filter(function (x) { return x.id === s; })[0]; return d ? '<li>' + termLink(d.term, d.label) + '</li>' : ''; }).join('');
    var buy = item.products.map(function (p) {
      var from = p.ships_from === 'US' ? 'US shop' : p.ships_from ? 'Ships from ' + p.ships_from : '';
      return '<li class="offer"><div><p class="o-name">' + esc(p.name) + '</p><p class="o-meta">' + esc(p.store) + (from ? ' · ' + esc(from) : '') + '</p>' +
        (p.note ? '<p class="o-note">' + esc(p.note) + '</p>' : '') + '</div>' +
        '<p class="o-price">' + esc(p.price) + '</p><a class="btn-buy" href="' + esc(p.url) + '" target="_blank" rel="noopener">View at ' + esc(p.store.replace(/\s*\(.*\)$/, '')) + ' <span aria-hidden="true">↗</span></a></li>';
    }).join('');
    var more = C.brands[item.brandId].items.filter(function (i) { return i !== item; });
    var also = C.items.filter(function (i) { return i.cat === item.cat && i !== item && i.brandId !== item.brandId && status(i).ok; }).slice(0, 8);
    main.innerHTML = '<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Shop</a><span>/</span><a href="#/?dept=' + g.id + '">' + esc(g.title) + '</a><span>/</span><a href="#/?cat=' + cat.id + '">' + esc(cat.title) + '</a></nav>' +
      '<article class="pdp">' +
      '<div class="pdp-media">' + photo(item, 'big') + '</div>' +
      '<div class="pdp-info">' +
      '<p class="brand"><a href="#/?brand=' + item.brandId + '">' + esc(item.brand) + '</a></p><h1>' + esc(item.line) + '</h1>' +
      '<p class="pdp-price">' + esc(S.priceLabel(item)) + (item.products.length > 1 ? '<span> · ' + item.products.length + ' products</span>' : '') + '</p>' +
      statusLine(item, r) +
      (item.quote ? '<blockquote class="ev"><p>' + esc(item.quote) + '</p><footer>From the store page</footer></blockquote>' : item.evidence ? '<p class="ev-p">' + esc(item.evidence) + '</p>' : '') +
      (item.note ? '<p class="note">' + esc(item.note) + '</p>' : '') +
      '<h2 class="h-sub">Where to buy</h2><ul class="offers">' + buy + '</ul>' +
      '<dl class="facts">' +
      (stds ? '<div><dt>Standards named</dt><dd><ul class="plain">' + stds + '</ul></dd></div>' : '') +
      '<div><dt>Age rating</dt><dd>' + (item.age ? esc(item.age.text) : 'None recorded') + '</dd></div>' +
      '<div><dt>Product type</dt><dd><a href="#/?cat=' + cat.id + '">' + esc(cat.title) + '</a></dd></div></dl>' +
      '</div></article>' +
      '<section class="pdp-sec"><h2>Materials checklist</h2><p class="sec-lede">What the maker or store names, what they say is absent, and what no page states. Underlined words open a short definition.</p>' + checklist(item) + '</section>' +
      '<section class="pdp-sec"><h2>Against your material rules</h2><p class="sec-lede">' + (r.ok ? 'This item meets the switches you have on.' : 'This item misses ' + plural(r.miss.length, 'switch', 'switches') + ' you have on.') + ' <a href="#/" id="pdp-rules">Change rules</a></p>' + ruleTable(item) + '</section>' +
      (cat.intro || cat.outro ? '<section class="pdp-sec"><h2>About ' + esc(cat.title.toLowerCase()) + '</h2>' + (cat.intro ? '<p>' + esc(cat.intro) + '</p>' : '') + (cat.outro ? '<p>' + esc(cat.outro) + '</p>' : '') + '</section>' : '') +
      (more.length ? '<section class="pdp-sec"><h2>More from ' + esc(item.brand) + '</h2><div class="grid row-grid">' + more.map(card).join('') + '</div></section>' : '') +
      (also.length ? '<section class="pdp-sec"><h2>Also in ' + esc(cat.title.toLowerCase()) + '</h2><div class="grid row-grid">' + also.map(card).join('') + '</div></section>' : '');
    setNav('shop');
    document.title = item.brand + ' ' + item.line + ' · Saved by the Thread';
  }

  // ---------- brands ----------
  function renderBrands() {
    var list = Object.keys(C.brands).map(function (k) { return C.brands[k]; }).sort(function (a, b) { return S.fold(a.name).localeCompare(S.fold(b.name)); });
    var by = {};
    list.forEach(function (b) { var L = S.fold(b.name).charAt(0).toUpperCase(); L = /[A-Z]/.test(L) ? L : '#'; (by[L] = by[L] || []).push(b); });
    var letters = Object.keys(by).sort();
    main.innerHTML = '<div class="page"><h1>Brands</h1><p class="lede">' + list.length + ' brands, each with the products listed for it.</p>' +
      '<nav class="az" aria-label="Jump to letter">' + letters.map(function (L) { return '<a href="#/brands" data-jump="az-' + L + '">' + L + '</a>'; }).join('') + '</nav>' +
      letters.map(function (L) {
        return '<section class="az-sec" id="az-' + L + '"><h2>' + L + '</h2><ul class="brand-list">' + by[L].map(function (b) {
          var cats = {}; b.items.forEach(function (i) { cats[i.cat] = 1; });
          return '<li><a class="b-name" href="#/?brand=' + b.id + '">' + esc(b.name) + '</a><span class="b-meta">' + plural(b.items.length, 'listing') + ' · ' +
            Object.keys(cats).map(function (c) { return esc(C.cats[c].short); }).join(', ') + '</span></li>';
        }).join('') + '</ul></section>';
      }).join('') + '</div>';
    setNav('brands');
    document.title = 'Brands · Saved by the Thread';
  }

  // ---------- glossary ----------
  function renderGlossary(termId) {
    if (!GLOSS) { main.innerHTML = '<div class="page"><h1>Glossary</h1><p>The glossary could not be loaded.</p></div>'; return; }
    var types = GLOSS.source_types || {};
    main.innerHTML = '<div class="page glossary"><h1>' + esc(GLOSS.title || 'Glossary') + '</h1><p class="lede">' + esc(GLOSS.intro || '') + '</p>' +
      '<nav class="gjump" aria-label="Glossary sections">' + GLOSS.sections.map(function (s) { return '<a href="#/glossary" data-jump="gs-' + s.id + '">' + esc(s.title) + '<span>' + s.terms.length + '</span></a>'; }).join('') + '</nav>' +
      GLOSS.sections.map(function (s) {
        return '<section class="gsec" id="gs-' + s.id + '"><h2>' + esc(s.title) + '</h2><div class="terms">' + s.terms.map(function (t) {
          var srcs = (t.sources || []).map(function (r) {
            return '<li><span class="rt">' + esc(types[r.type] || r.type || '') + '</span><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.title) + '</a>' + (r.publisher ? ' <span class="pub">' + esc(r.publisher) + '</span>' : '') + '</li>';
          }).join('');
          return '<article class="term" id="t-' + esc(t.id) + '"><h3>' + esc(t.term) + '</h3>' + (t.aka && t.aka.length ? '<p class="aka">Also called ' + esc(t.aka.join(', ')) + '</p>' : '') +
            '<p>' + esc(t.definition) + '</p><p class="lab">On this site</p><p>' + esc(t.on_this_site) + '</p><p class="lab">What sources say</p><p>' + esc(t.what_sources_say) + '</p>' +
            (srcs ? '<details><summary>Sources (' + t.sources.length + ')</summary><ul>' + srcs + '</ul></details>' : '') +
            '<p class="t-shop"><a href="#/?q=' + encodeURIComponent(t.term) + '">Search products for “' + esc(t.term) + '”</a></p></article>';
        }).join('') + '</div></section>';
      }).join('') + '</div>';
    setNav('glossary');
    document.title = 'Glossary · Saved by the Thread';
    if (termId) {
      var el = document.getElementById('t-' + termId);
      if (el) { el.classList.add('hl'); el.scrollIntoView(); var d = el.querySelector('details'); if (d) d.open = true; }
    }
  }

  // ---------- about ----------
  function renderAbout() {
    var nprod = C.items.reduce(function (n, i) { return n + i.products.length; }, 0);
    main.innerHTML = '<div class="page about"><h1>How this guide works</h1>' +
      '<p class="lede">Saved by the Thread lists ' + C.items.length + ' listings (' + nprod + ' products from ' + Object.keys(C.brands).length + ' brands) for babies and toddlers. It reports what makers and stores say about materials, finishes and standards, and what they leave out. It doesn\'t rank products by safety or risk.</p>' +
      '<section><h2>Reading a product</h2><ul class="legend">' +
      '<li class="r-uses"><span class="ic" aria-hidden="true">✓</span><span><b>Made with</b>: materials the maker or store names.</span></li>' +
      '<li class="r-free"><span class="ic" aria-hidden="true">⊘</span><span><b>Stated free of</b>: things the maker says are absent.</span></li>' +
      '<li class="r-unk"><span class="ic" aria-hidden="true">?</span><span><b>Not stated</b>: parts no page describes, such as thread, glue or dye.</span></li>' +
      '<li class="r-out"><span class="ic" aria-hidden="true">✕</span><span><b>Flagged parts</b>: parts a rule can leave out, such as plastic, synthetic fill, an unnamed colourant or treated wool.</span></li></ul>' +
      '<p>A listing covers one product, or a brand\'s line of products made the same way.</p></section>' +
      '<section><h2>Material rules</h2><p>The switches under Material rules each hide the items that don\'t meet them. They start from the preferences this guide was built around: no plastic or synthetics in the main materials or small parts, no synthetic dyes or paints, solid wood rather than plywood, no superwash wool, no plasticisers in rubber, and silicone only when the maker says the finished product was tested to German LFGB or the French Arrêté. Leather and natural latex can be hidden with their own switches, which start off. A detail that no page states doesn\'t count as a miss unless you turn that on. Your choices are saved in this browser.</p></section>' +
      '<section><h2>Questions makers can answer</h2><ul>' + C.ask.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></section>' +
      '<section><h2>Prices and stock</h2><p>Prices, stock and shipping were read from store pages and change often. Prices in pounds, euros and other currencies are converted roughly to US dollars for sorting. Last updated ' + esc(C.updated) + '.</p></section></div>';
    setNav('about');
    document.title = 'About · Saved by the Thread';
  }

  // ---------- nav, router ----------
  function setNav(which) {
    $$('.links a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === which); if (a.getAttribute('data-nav') === which) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $$('#depts a').forEach(function (a) {
      var d = a.getAttribute('data-dept');
      a.classList.toggle('on', which === 'shop' && (d === '' ? !STATE.dept.length && !STATE.cat.length : STATE.dept.indexOf(d) >= 0 || STATE.cat.some(function (c) { return C.cats[c] && C.cats[c].group === d; })));
    });
  }
  function route() {
    closePop(false);
    document.body.classList.remove('side-on');
    var h = parseHash(), p = h.parts, key = p[0] || '';
    if (lastRoute === '' && key !== 'p') shopScroll = 0;
    if (lastRoute === 'shop' && key !== '') shopScroll = window.scrollY;
    if (key === 'p' && p[1]) { renderProduct(decodeURIComponent(p[1])); window.scrollTo(0, 0); }
    else if (key === 'brands') { renderBrands(); window.scrollTo(0, 0); }
    else if (key === 'glossary') { window.scrollTo(0, 0); renderGlossary(p[1]); }
    else if (key === 'about') { renderAbout(); window.scrollTo(0, 0); }
    else { STATE = readState(h.q); renderShop(); window.scrollTo(0, lastRoute === 'p' ? shopScroll : 0); }
    lastRoute = key === '' ? 'shop' : key;
  }

  // ---------- events ----------
  function toggleIn(arr, v) { var i = arr.indexOf(v); var out = arr.slice(); if (i >= 0) out.splice(i, 1); else out.push(v); return out; }
  function copyState() { var st = { q: STATE.q, sort: STATE.sort, misses: STATE.misses }; FACETS.forEach(function (f) { st[f] = STATE[f].slice(); }); return st; }
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.matches('[data-facet]')) {
      var st = copyState(), f = t.getAttribute('data-facet');
      st[f] = toggleIn(st[f], t.value);
      if (f === 'cat') st.dept = [];
      setState(st);
    } else if (t.matches('[data-rule]')) {
      RULES[t.getAttribute('data-rule')] = t.checked; saveRules(); renderShop(true);
    } else if (t.id === 'r-strict') {
      STRICT = t.checked; saveRules(); renderShop(true);
    } else if (t.id === 'sort') {
      var s2 = copyState(); s2.sort = t.value; setState(s2);
    }
  });
  document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (d.matches && d.matches('details.panel')) openPanels[d.getAttribute('data-panel')] = d.open;
  }, true);
  document.addEventListener('input', function (ev) { if (ev.target.id === 'brand-find') filterBrandList(ev.target.value); });
  $('#searchform').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var v = $('#q').value.trim();
    var st = readState({}); st.q = v; st.sort = STATE.sort;
    location.hash = stateHash(st);
    $('#q').blur();
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('button, a');
    if (!t) return;
    if (t.matches('[data-clear]')) {
      var st = copyState(), f = t.getAttribute('data-clear');
      if (f === 'q') st.q = ''; else st[f] = st[f].filter(function (x) { return x !== t.getAttribute('data-val'); });
      setState(st);
    } else if (t.id === 'clear-all' || t.id === 'clear-all-2') {
      var s0 = readState({}); s0.sort = STATE.sort; s0.misses = STATE.misses; setState(s0);
    } else if (t.id === 'toggle-misses') {
      var s1 = copyState(); s1.misses = !s1.misses; setState(s1);
    } else if (t.id === 'rules-reset') {
      C.criteria.forEach(function (c) { RULES[c.id] = !!c['default']; }); STRICT = false; saveRules(); renderShop(true);
    } else if (t.id === 'open-rules' || t.id === 'pdp-rules') {
      ev.preventDefault();
      openPanels.rules = true;
      if (t.id === 'pdp-rules') { location.hash = '#/'; setTimeout(showRules, 0); } else showRules();
    } else if (t.id === 'side-open') {
      document.body.classList.add('side-on'); $('#side-close').focus();
    } else if (t.id === 'side-close') {
      document.body.classList.remove('side-on'); $('#side-open').focus();
    } else if (t.hasAttribute('data-jump')) {
      ev.preventDefault(); var el = document.getElementById(t.getAttribute('data-jump')); if (el) el.scrollIntoView();
    }
  });
  function showRules() {
    var p = $('[data-panel="rules"]'); if (!p) return;
    p.open = true;
    if (window.matchMedia('(max-width: 900px)').matches) document.body.classList.add('side-on');
    p.scrollIntoView({ block: 'start' });
  }
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && document.body.classList.contains('side-on')) { document.body.classList.remove('side-on'); var b = $('#side-open'); if (b) b.focus(); } });

  // ---------- glossary popover ----------
  var pop = document.getElementById('gpop'), cur = null, hoverT = null;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function place(a) {
    var r = a.getBoundingClientRect(), w = pop.offsetWidth, vw = document.documentElement.clientWidth;
    var left = Math.min(Math.max(16, r.left + window.scrollX), window.scrollX + vw - w - 16);
    var below = r.bottom + 8 + pop.offsetHeight < window.innerHeight || r.top < pop.offsetHeight + 80;
    pop.style.left = left + 'px';
    pop.style.top = (below ? r.bottom + window.scrollY + 8 : r.top + window.scrollY - pop.offsetHeight - 8) + 'px';
  }
  function openPop(a, id) {
    var g = TERMS[id];
    pop.innerHTML = '<button type="button" class="x" aria-label="Close">&times;</button><h4 id="gpop-h">' + esc(g.term) + '</h4><p>' + esc(g.definition) + '</p>' +
      (g.on_this_site ? '<p class="lab">On this site</p><p>' + esc(g.on_this_site) + '</p>' : '') + '<a class="more" href="#/glossary/' + id + '">Full entry and sources →</a>';
    pop.hidden = false; place(a);
    if (cur && cur !== a) cur.setAttribute('aria-expanded', 'false');
    cur = a; a.setAttribute('aria-expanded', 'true'); a.setAttribute('aria-controls', 'gpop');
  }
  function closePop(refocus) {
    if (pop.hidden) return; pop.hidden = true;
    if (cur) { cur.setAttribute('aria-expanded', 'false'); if (refocus) cur.focus(); }
    cur = null;
  }
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('#gpop .x')) { closePop(true); return; }
    if (ev.target.closest('#gpop .more')) { closePop(false); return; }
    var a = ev.target.closest('a[data-term]');
    if (a && TERMS[a.getAttribute('data-term')] && !a.closest('.glossary')) {
      ev.preventDefault(); ev.stopPropagation();
      if (cur === a && !pop.hidden && a.getAttribute('data-click') === '1') closePop(false);
      else { openPop(a, a.getAttribute('data-term')); a.setAttribute('data-click', '1'); }
      return;
    }
    if (!ev.target.closest('#gpop')) closePop(false);
  }, true);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closePop(true); });
  if (fine) {
    document.addEventListener('mouseover', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[data-term]');
      clearTimeout(hoverT);
      if (a && a !== cur && TERMS[a.getAttribute('data-term')] && !a.closest('.glossary')) hoverT = setTimeout(function () { openPop(a, a.getAttribute('data-term')); a.removeAttribute('data-click'); }, 250);
      else if (!a && !ev.target.closest('#gpop') && cur && !pop.hidden && cur.getAttribute('data-click') !== '1') hoverT = setTimeout(function () { closePop(false); }, 300);
    });
  }
  window.addEventListener('resize', function () { if (cur && !pop.hidden) place(cur); });

  // ---------- boot ----------
  function inline(id) { var el = document.getElementById(id); return el ? JSON.parse(el.textContent) : null; }
  function get(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  var data = inline('sbtt-data'), gloss = inline('sbtt-glossary');
  Promise.all([data ? data : get('data.json'), gloss ? gloss : get('glossary.json').catch(function () { return null; })]).then(function (res) {
    C = S.build(res[0]); GLOSS = res[1];
    if (GLOSS) GLOSS.sections.forEach(function (s) { s.terms.forEach(function (t) { TERMS[t.id] = t; }); });
    loadRules();
    $('#depts').innerHTML = '<a href="#/" data-dept="">All</a>' + C.groups.map(function (g) {
      return '<a href="#/?dept=' + g.id + '" data-dept="' + g.id + '">' + esc(g.title) + '</a>';
    }).join('');
    window.addEventListener('hashchange', route);
    route();
  }).catch(function (e) {
    main.innerHTML = '<div class="page"><h1>Couldn\'t load the catalog</h1><p>' + esc(e.message) + '</p></div>';
  });
})();
