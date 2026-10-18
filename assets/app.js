/* Saved by the Thread: shop-style front end. Hash routes:
   #/            catalog (query: q, dept, cat, brand, mat, std, age, ship, price, sort, misses)
   #/p/<id>      product page          #/brands     brand index
   #/glossary    glossary (#/glossary/<term> opens at a term)   #/about   how the guide works */
(function () {
  'use strict';
  var S = window.SBTT;
  var main = document.getElementById('main');
  var live = document.getElementById('live');
  var C, TERMS = {}, GLOSS = null, RULES = {}, STRICT = false;
  var RULES_KEY = 'sbtt-filters-2';
  var FACETS = ['dept', 'cat', 'brand', 'mat', 'std', 'age', 'ship', 'price'];
  var openPanels = { rules: true, cat: true, price: true, brand: true, mat: true };
  var scrollMem = {}, lastHash = null, lastRoute = '';

  // ---------- helpers ----------
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function termsIn(text) {
    var ids = [];
    S.termRuns(text, TERMS).forEach(function (r) { if (r[1] && ids.indexOf(r[1]) < 0) ids.push(r[1]); });
    return ids;
  }
  // A checklist chip: one link for the whole chip, opening its first glossary term; other terms ride along in data-also.
  function chip(text) {
    var ids = termsIn(text);
    if (!ids.length) return '<span class="chip">' + esc(text) + '</span>';
    return '<a class="chip term-link" href="#/glossary/' + ids[0] + '" data-term="' + ids[0] + '"' + (ids.length > 1 ? ' data-also="' + ids.slice(1).join(',') + '"' : '') + '>' + esc(text) + '</a>';
  }
  function termLink(id, label) {
    return TERMS[id] ? '<a class="term-link" href="#/glossary/' + id + '" data-term="' + id + '">' + esc(label) + '</a>' : esc(label);
  }
  function catTitle(id) { return C.cats[id] ? C.cats[id].title : id; }
  function groupOf(id) { return C.groups.filter(function (g) { return g.id === id; })[0]; }
  function ruleLabel(c) { return c.label.charAt(0).toUpperCase() + c.label.slice(1); }

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
  function rulesOn() { return C.criteria.filter(function (c) { return RULES[c.id]; }).length + (STRICT ? 1 : 0); }
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
    else { try { history.replaceState(null, '', h); } catch (e) { location.hash = h; } lastHash = h; renderShop(true); }
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
  function photo(item, cls, eager) {
    var alt = esc(item.brand + ' ' + item.line);
    if (!item.img) return '<div class="ph ' + (cls || '') + ' empty"><span>No store photo saved</span></div>';
    return '<div class="ph ' + (cls || '') + '"><img src="' + esc(item.img) + '" alt="' + alt + '" width="640" height="480" decoding="async"' +
      (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' onerror="this.parentNode.classList.add(\'empty\');this.outerHTML=\'<span>No store photo saved</span>\'"></div>';
  }
  function missText(item, r) {
    return r.miss.map(function (c) { return c.short + (c.kind !== 'contains' && item.facts[c.id] === 'unknown' ? ' (not stated)' : ''); }).join(', ');
  }
  // Cards only carry the exception: what the item misses, or how much isn't stated.
  function cardStatus(item, r) {
    if (!r.ok) return '<p class="pill miss">Misses: ' + esc(missText(item, r)) + '</p>';
    if (r.unst.length) return '<p class="pill quiet">' + plural(r.unst.length, 'detail') + ' not stated</p>';
    return '<p class="pill quiet">Every covered detail stated</p>';
  }
  function pageStatus(item, r) {
    if (!r.ok) return '<p class="pill miss">Misses: ' + esc(missText(item, r)) + '</p>';
    return '<p class="pill ok">Meets the ' + plural(rulesOn(), 'rule') + ' you have on' + (r.unst.length ? '<span> · ' + plural(r.unst.length, 'detail') + ' not stated</span>' : '') + '</p>';
  }
  function card(item, i) {
    var r = status(item);
    var mats = item.materials.slice(0, 3).map(function (m) { return S.MATERIALS.filter(function (x) { return x.id === m; })[0].label; });
    var abroad = item.ships.indexOf('abroad') >= 0 && item.ships.indexOf('us') < 0;
    return '<article class="card' + (r.ok ? '' : ' is-miss') + '">' +
      '<a class="card-link" href="#/p/' + esc(item.id) + '">' + photo(item, '', i != null && i < 4) +
      (item.products.length > 1 ? '<span class="badge">' + item.products.length + ' products</span>' : '') +
      '<div class="card-body"><p class="brand">' + esc(item.brand) + '</p><h3>' + esc(item.line) + '</h3>' +
      '<p class="price">' + esc(S.priceLabel(item)) + '</p>' +
      '<p class="tags">' + mats.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') + (abroad ? '<span class="tag-ship">Ships from abroad</span>' : '') + '</p>' +
      cardStatus(item, r) + '</div></a></article>';
  }

  // ---------- shop ----------
  // Counts per facet value: n = items the visitor would see, h = items hidden by the rules.
  function countsFor(f, st) {
    var counts = {};
    filtered(st, f).forEach(function (it) {
      var ok = status(it).ok;
      facetValues(it, f).forEach(function (v) {
        var c = counts[v] || (counts[v] = { n: 0, h: 0 });
        if (ok || st.misses) c.n++; else c.h++;
      });
    });
    return counts;
  }
  function optionList(f, opts, counts, st) {
    return opts.map(function (o) {
      var c = counts[o.id] || { n: 0, h: 0 }, on = st[f].indexOf(o.id) >= 0;
      if (!c.n && !c.h && !on && o.hideEmpty) return '';
      return '<label class="opt' + (c.n || on ? '' : ' dim') + '"><input type="checkbox" data-facet="' + f + '" value="' + esc(o.id) + '" id="f-' + f + '-' + esc(o.id) + '"' + (on ? ' checked' : '') + '>' +
        '<span>' + esc(o.label) + '</span><span class="n">' + c.n + (c.h ? '<i title="' + plural(c.h, 'item') + ' hidden by your material rules"> +' + c.h + ' hidden</i>' : '') + '</span></label>';
    }).join('');
  }
  function panel(id, title, body, extra) {
    return '<details class="panel" data-panel="' + id + '"' + (openPanels[id] ? ' open' : '') + '><summary>' + title + (extra || '') + '</summary><div class="panel-body">' + body + '</div></details>';
  }
  function cnt(arr) { return arr.length ? '<span class="cnt">' + arr.length + '</span>' : ''; }
  function switchHtml(c) {
    return '<label class="switch"><input type="checkbox" data-rule="' + c.id + '" id="r-' + c.id + '"' + (RULES[c.id] ? ' checked' : '') + '><span class="track" aria-hidden="true"></span>' +
      '<span class="sw-text"><b>' + esc(ruleLabel(c)) + '</b>' + (TERMS[c.term] ? ' <a class="q" href="#/glossary/' + c.term + '" data-term="' + c.term + '" aria-label="What this means: ' + esc(c.short) + '">?</a>' : '') +
      '<small>' + esc(c.help) + '</small></span></label>';
  }
  function rulesPanel() {
    var kinds = [['avoid contains', 'Hide items that have'], ['require', 'Hide items unless the maker states']];
    var body = '<p class="hint lead">Each switch that is on hides the items it names. These start from one family\'s preferences; change any of them.</p>' +
      kinds.map(function (k) {
        return '<fieldset><legend>' + k[1] + '</legend>' + C.criteria.filter(function (c) { return k[0].split(' ').indexOf(c.kind) >= 0; }).map(switchHtml).join('') + '</fieldset>';
      }).join('') +
      '<fieldset><legend>Details that aren\'t stated</legend><label class="switch"><input type="checkbox" id="r-strict"' + (STRICT ? ' checked' : '') + '><span class="track" aria-hidden="true"></span>' +
      '<span class="sw-text"><b>Count unstated details as misses</b><small>When on, an item is hidden if a detail one of your switches covers isn\'t stated on its page.</small></span></label></fieldset>' +
      '<button type="button" class="btn-ghost" id="rules-reset"' + (rulesAreDefault() ? ' disabled' : '') + '>Reset to defaults</button>';
    return panel('rules', 'Material rules', body, '<span class="cnt">' + rulesOn() + ' on' + (rulesAreDefault() ? '' : ', changed') + '</span>');
  }
  function sidebar(st) {
    var h = rulesPanel();
    var cc = countsFor('cat', st);
    h += panel('cat', 'Product type', C.groups.map(function (g) {
      return '<p class="opt-group">' + esc(g.title) + '</p>' + optionList('cat', g.cats.map(function (id) { return { id: id, label: C.cats[id].title }; }), cc, st);
    }).join(''), cnt(st.cat));
    h += panel('price', 'Price', optionList('price', S.PRICE_BANDS.concat([{ id: 'none', label: 'Price not listed', hideEmpty: true }]), countsFor('price', st), st) +
      '<p class="hint">Prices in other currencies are converted roughly to US dollars.</p>', cnt(st.price));
    var brands = Object.keys(C.brands).map(function (k) { return C.brands[k]; }).sort(function (a, b) { return S.fold(a.name).localeCompare(S.fold(b.name)); });
    h += panel('brand', 'Brand', '<input type="search" class="brand-find" id="brand-find" placeholder="Find a brand" aria-label="Find a brand">' +
      '<div class="brand-opts" id="brand-opts">' + optionList('brand', brands.map(function (b) { return { id: b.id, label: b.name }; }), countsFor('brand', st), st) + '</div>', cnt(st.brand));
    h += panel('mat', 'Made with', optionList('mat', S.MATERIALS, countsFor('mat', st), st) +
      '<p class="hint">From each product\'s Made with and Flagged parts lists. Ticking several shows products that have all of them.</p>', cnt(st.mat));
    h += panel('std', 'Standards the maker names', optionList('std', C.standards.map(function (s) { return { id: s.id, label: s.label }; }), countsFor('std', st), st) +
      '<p class="hint">Listed when a maker or store names the standard. The product page says what the claim covers.</p>', cnt(st.std));
    h += panel('age', 'Age rating', optionList('age', S.AGE_BANDS.concat([{ id: 'none', label: 'No age rating recorded' }]), countsFor('age', st), st) +
      '<p class="hint">The age a maker or store states. Most product pages give none.</p>', cnt(st.age));
    h += panel('ship', 'Ships from', optionList('ship', [{ id: 'us', label: 'The US' }, { id: 'abroad', label: 'Outside the US' }, { id: 'unknown', label: 'Not recorded' }], countsFor('ship', st), st), cnt(st.ship));
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
    st.ship.forEach(function (v) { add('ship', v, { us: 'Ships from the US', abroad: 'Ships from outside the US', unknown: 'Shipping not recorded' }[v]); });
    st.price.forEach(function (v) { var b = S.PRICE_BANDS.filter(function (x) { return x.id === v; })[0]; add('price', v, b ? b.label : 'Price not listed'); });
    if (chips.length > 1) chips.push('<button type="button" class="chip-clear" id="clear-all">Clear all</button>');
    return chips.join('');
  }
  function hero() {
    var tiles = C.groups.map(function (g) {
      var items = C.items.filter(function (i) { return i.group === g.id; });
      var pic = items.filter(function (i) { return i.img; })[0];
      return '<a class="dept" href="#/?dept=' + g.id + '">' + (pic ? '<img src="' + esc(pic.img) + '" alt="" decoding="async">' : '') +
        '<span class="dept-t">' + esc(g.title) + '</span><span class="dept-n">' + plural(items.length, 'product') + '</span></a>';
    }).join('');
    return '<section class="hero"><div class="hero-copy"><p class="eyebrow">For parents and guardians of babies and toddlers</p>' +
      '<h1>Saved by the Thread</h1><p class="tagline">Reading the fine print so you don’t have to.</p>' +
      '<p class="lede">Every product lists what its maker says it is made of, what the maker says is absent, and what no page states. The material rules in the sidebar hide what you don\'t want; they start from one family\'s preferences, and you can change them.</p></div>' +
      '<div class="depts-grid">' + tiles + '</div></section>';
  }
  // Zero results: say what was asked and offer the closest brand or product type.
  function emptyState(st, miss) {
    var sug = '';
    if (st.q) {
      var q = S.fold(st.q);
      var brands = Object.keys(C.brands).map(function (k) { return C.brands[k]; }).filter(function (b) { return q.split(/\s+/).some(function (w) { return w.length > 2 && S.fold(b.name).indexOf(w) >= 0; }); }).slice(0, 4);
      var cats = Object.keys(C.cats).map(function (k) { return C.cats[k]; }).filter(function (c) { return q.split(/\s+/).some(function (w) { return w.length > 2 && S.fold(c.title).indexOf(w) >= 0; }); }).slice(0, 4);
      if (brands.length || cats.length) sug = '<p>Try ' + brands.map(function (b) { return '<a href="#/?brand=' + b.id + '">' + esc(b.name) + '</a>'; })
        .concat(cats.map(function (c) { return '<a href="#/?cat=' + c.id + '">' + esc(c.title) + '</a>'; })).join(', ') + '.</p>';
    }
    return '<div class="empty-state"><p>Nothing matches ' + (st.q ? '“' + esc(st.q) + '”' + (FACETS.some(function (f) { return st[f].length; }) ? ' with these filters' : '') : 'these filters') +
      (miss.length && !st.misses ? ', though ' + plural(miss.length, 'item is', 'items are') + ' hidden by your material rules' : '') + '.</p>' + sug +
      '<p>' + (miss.length && !st.misses ? '<button type="button" class="btn-ghost" id="toggle-misses">Show hidden items</button> ' : '') +
      '<button type="button" class="btn-ghost" id="clear-all-2">Clear filters</button></p></div>';
  }
  function renderShop(keepFocus) {
    var st = STATE;
    var focusId = keepFocus && document.activeElement && document.activeElement.id;
    var brandFind = $('#brand-find') ? $('#brand-find').value : '';
    var sideOpen = document.body.classList.contains('side-on');
    var all = sortItems(filtered(st), st.sort);
    var ok = all.filter(function (i) { return status(i).ok; }), miss = all.filter(function (i) { return !status(i).ok; });
    var shown = st.misses ? ok.concat(miss) : ok;
    var anyFilter = st.q || FACETS.some(function (f) { return st[f].length; });
    var only = function (f) { return st[f].length === 1 && !st.q && FACETS.every(function (g) { return g === f || !st[g].length; }); };
    var title = st.q ? 'Results for “' + esc(st.q) + '”' : only('cat') ? esc(catTitle(st.cat[0])) : only('dept') ? esc(groupOf(st.dept[0]).title) : only('brand') ? esc(C.brands[st.brand[0]].name) : 'All products';
    var intro = '';
    if (only('cat') && C.cats[st.cat[0]].intro) intro = '<p class="cat-intro">' + esc(C.cats[st.cat[0]].intro) + '</p>';
    else if (only('dept')) {
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
      '<div class="res-tools"><p class="res-count">' + plural(shown.length, 'product') + '</p>' +
      '<button type="button" class="btn-ghost filt-btn" id="side-open" aria-expanded="' + (sideOpen ? 'true' : 'false') + '" aria-controls="side">Filters' + (anyFilter ? ' <span class="cnt">on</span>' : '') + '</button>' +
      '<label class="sort">Sort by <select id="sort">' + SORTS.map(function (s) { return '<option value="' + s[0] + '"' + (st.sort === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></label></div></div>' +
      '<div class="active">' + activeChips(st) + '</div>' + missBar +
      (shown.length ? '<div class="grid">' + shown.map(card).join('') + '</div>' : emptyState(st, miss)) +
      '</section></div>';
    if (sideOpen) openSide(false);
    $('#q').value = st.q;
    if (brandFind) { $('#brand-find').value = brandFind; filterBrandList(brandFind); }
    if (focusId && document.getElementById(focusId)) document.getElementById(focusId).focus();
    setNav('shop');
    announce(plural(shown.length, 'product') + (miss.length && !st.misses ? ', ' + miss.length + ' hidden by your rules' : '') + '. List updated.');
    document.title = (title === 'All products' ? '' : title.replace(/&[^;]+;/g, '') + ' · ') + 'Saved by the Thread';
  }
  function filterBrandList(v) {
    var f = S.fold(v);
    $$('#brand-opts .opt').forEach(function (l) { l.hidden = f && S.fold(l.textContent).indexOf(f) < 0; });
  }
  function announce(text) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = text; }, 50); } }

  // ---------- search suggestions ----------
  var sugg = document.getElementById('sugg'), suggT = null;
  function suggestions(q) {
    var f = S.fold(q.trim());
    if (f.length < 2) { sugg.hidden = true; sugg.innerHTML = ''; return; }
    var out = [];
    Object.keys(C.brands).map(function (k) { return C.brands[k]; }).filter(function (b) { return S.fold(b.name).indexOf(f) >= 0; }).slice(0, 4)
      .forEach(function (b) { out.push('<a href="#/?brand=' + b.id + '"><span class="sg-k">Brand</span>' + esc(b.name) + '</a>'); });
    Object.keys(C.cats).map(function (k) { return C.cats[k]; }).filter(function (c) { return S.fold(c.title).indexOf(f) >= 0; }).slice(0, 3)
      .forEach(function (c) { out.push('<a href="#/?cat=' + c.id + '"><span class="sg-k">Type</span>' + esc(c.title) + '</a>'); });
    S.MATERIALS.filter(function (m) { return S.fold(m.label).indexOf(f) >= 0; }).slice(0, 2)
      .forEach(function (m) { out.push('<a href="#/?mat=' + m.id + '"><span class="sg-k">Made with</span>' + esc(m.label) + '</a>'); });
    if (GLOSS) Object.keys(TERMS).filter(function (k) { return S.fold(TERMS[k].term).indexOf(f) >= 0; }).slice(0, 2)
      .forEach(function (k) { out.push('<a href="#/glossary/' + k + '"><span class="sg-k">Glossary</span>' + esc(TERMS[k].term) + '</a>'); });
    sugg.innerHTML = out.join('');
    sugg.hidden = !out.length;
  }
  function closeSugg() { sugg.hidden = true; }

  // ---------- product page ----------
  var ROWS = [['uses', 'r-uses', '✓', 'Made with'], ['free', 'r-free', '⊘', 'Stated free of'], ['unconfirmed', 'r-unk', '?', 'Not stated'], ['outside', 'r-out', '✕', 'Flagged parts']];
  function checklist(item) {
    return '<dl class="check" id="checklist">' + ROWS.filter(function (r) { return item[r[0]] && item[r[0]].length; }).map(function (r) {
      return '<div class="row ' + r[1] + '"><span class="ic" aria-hidden="true">' + r[2] + '</span><dt>' + r[3] + '</dt><dd>' + item[r[0]].map(chip).join('') + '</dd></div>';
    }).join('') + '</dl>';
  }
  function ruleTable(item) {
    var rows = C.criteria.map(function (c) {
      var v;
      if (c.kind === 'contains') v = item.contains.indexOf(c.id) >= 0 ? 'has' : null;
      else v = item.facts[c.id] || null;
      if (!v) return '';
      var txt = { yes: c.kind === 'require' ? 'Stated by the maker' : 'Not present', no: c.kind === 'require' ? 'Not stated' : 'Present', unknown: 'Not stated', has: 'Present' }[v];
      var cls = { yes: 'ok', no: 'no', unknown: 'unk', has: 'no' }[v];
      var hides = RULES[c.id] && (v === 'no' || v === 'has' || (c.kind === 'require' && v !== 'yes') || (STRICT && v === 'unknown'));
      return '<tr' + (hides ? ' class="hides"' : '') + '><th scope="row">' + termLink(c.term, ruleLabel(c)) + '<small>' + esc(c.help) + '</small></th><td><span class="v ' + cls + '">' + txt + '</span></td>' +
        '<td class="sw"><label class="switch mini"><input type="checkbox" data-rule="' + c.id + '" id="t-' + c.id + '"' + (RULES[c.id] ? ' checked' : '') + '><span class="track" aria-hidden="true"></span><span class="sw-text">' + (RULES[c.id] ? (hides ? 'On, hides this item' : 'On') : 'Off') + '</span></label></td></tr>';
    }).join('');
    return '<table class="rules-t"><caption class="sr">How this item reads against each material rule</caption><thead><tr><th scope="col">Rule</th><th scope="col">This item</th><th scope="col">Your switch</th></tr></thead><tbody>' + rows +
      '<tr><th scope="row">Count unstated details as misses<small>When on, an item is hidden if a detail one of your switches covers isn\'t stated on its page.</small></th><td></td><td class="sw"><label class="switch mini"><input type="checkbox" id="t-strict"' + (STRICT ? ' checked' : '') + '><span class="track" aria-hidden="true"></span><span class="sw-text">' + (STRICT ? 'On' : 'Off') + '</span></label></td></tr></tbody></table>';
  }
  function renderProduct(id, keepFocus) {
    var item = C.items.filter(function (i) { return i.id === id; })[0];
    if (!item) { main.innerHTML = '<div class="page"><h1>Not found</h1><p>No product with that address. <a href="#/">Back to the shop</a>.</p></div>'; return; }
    var focusId = keepFocus && document.activeElement && document.activeElement.id, y = window.scrollY;
    var r = status(item), g = groupOf(item.group), cat = C.cats[item.cat];
    var stds = item.standards.map(function (s) { var d = C.standards.filter(function (x) { return x.id === s; })[0]; return d ? '<li>' + termLink(d.term, d.label) + '</li>' : ''; }).join('');
    var buy = item.products.map(function (p) {
      var from = p.ships_from === 'US' ? 'Ships from the US' : p.ships_from ? 'Ships from ' + p.ships_from : 'Shipping not recorded';
      return '<li class="offer"><div><p class="o-name">' + esc(p.name) + '</p><p class="o-meta">' + esc(p.store) + ' · ' + esc(from) + (p.shipping ? ' · ' + esc(p.shipping) : '') + '</p>' +
        (p.note ? '<p class="o-note">' + esc(p.note) + '</p>' : '') + '</div>' +
        '<p class="o-price">' + esc(p.price) + '</p><a class="btn-buy" href="' + esc(p.url) + '" target="_blank" rel="noopener">View at ' + esc(p.store.replace(/\s*\(.*\)$/, '')) + ' <span aria-hidden="true">↗</span></a></li>';
    }).join('');
    var more = C.brands[item.brandId].items.filter(function (i) { return i !== item; });
    var also = C.items.filter(function (i) { return i.cat === item.cat && i !== item && i.brandId !== item.brandId && status(i).ok; }).slice(0, 8);
    var mini = '<div class="mini"><p class="h-sub">Made with</p><p class="mini-chips">' + item.uses.map(chip).join('') + '</p>' +
      (item.outside.length ? '<p class="h-sub">Flagged parts</p><p class="mini-chips r-out">' + item.outside.map(chip).join('') + '</p>' : '') +
      '<p class="mini-more"><a href="#/p/' + esc(item.id) + '" data-jump="checklist">Full checklist: ' + plural(item.free.length, 'thing') + ' stated absent, ' + plural(item.unconfirmed.length, 'detail') + ' not stated ↓</a></p></div>';
    main.innerHTML = '<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Shop</a><span>/</span><a href="#/?dept=' + g.id + '">' + esc(g.title) + '</a><span>/</span><a href="#/?cat=' + cat.id + '">' + esc(cat.title) + '</a></nav>' +
      '<article class="pdp">' +
      '<div class="pdp-media">' + photo(item, 'big', true) + '</div>' +
      '<div class="pdp-info">' +
      '<p class="brand"><a href="#/?brand=' + item.brandId + '">' + esc(item.brand) + '</a></p><h1>' + esc(item.line) + '</h1>' +
      '<p class="pdp-price">' + esc(S.priceLabel(item)) + (item.products.length > 1 ? '<span> · ' + item.products.length + ' products</span>' : '') + '</p>' +
      pageStatus(item, r) +
      (item.quote ? '<blockquote class="ev"><p>' + esc(item.quote) + '</p><footer>From the store page</footer></blockquote>' : item.evidence ? '<p class="ev-p">' + esc(item.evidence) + '</p>' : '') +
      (item.note ? '<p class="note">' + esc(item.note) + '</p>' : '') +
      mini +
      '<h2 class="h-sub">Where to buy</h2><ul class="offers">' + buy + '</ul>' +
      '<dl class="facts">' +
      (stds ? '<div><dt>Standards named</dt><dd><ul class="plain">' + stds + '</ul></dd></div>' : '') +
      '<div><dt>Age rating</dt><dd>' + (item.age ? esc(item.age.text) : 'None recorded') + '</dd></div>' +
      '<div><dt>Product type</dt><dd><a href="#/?cat=' + cat.id + '">' + esc(cat.title) + '</a></dd></div></dl>' +
      '</div></article>' +
      '<section class="pdp-sec"><h2>Materials checklist</h2><p class="sec-lede">What the maker or store names, what they say is absent, and what no page states. Underlined chips open a short definition.</p>' + checklist(item) + '</section>' +
      '<section class="pdp-sec" id="rules-sec"><h2>Against your material rules</h2><p class="sec-lede">' + (r.ok ? 'This item meets every switch you have on.' : 'This item is hidden in the shop by ' + plural(r.miss.length, 'switch', 'switches') + ' you have on.') + ' Switches changed here apply to the whole shop.</p>' + ruleTable(item) + '</section>' +
      (cat.intro || cat.outro ? '<section class="pdp-sec"><h2>About ' + esc(cat.title.toLowerCase()) + '</h2>' + (cat.intro ? '<p>' + esc(cat.intro) + '</p>' : '') + (cat.outro ? '<p>' + esc(cat.outro) + '</p>' : '') + '</section>' : '') +
      (more.length ? '<section class="pdp-sec"><h2>More from ' + esc(item.brand) + '</h2><div class="grid row-grid">' + more.map(function (i) { return card(i); }).join('') + '</div></section>' : '') +
      (also.length ? '<section class="pdp-sec"><h2>Also in ' + esc(cat.title.toLowerCase()) + '</h2><div class="grid row-grid">' + also.map(function (i) { return card(i); }).join('') + '</div></section>' : '');
    setNav('shop');
    document.title = item.brand + ' ' + item.line + ' · Saved by the Thread';
    if (keepFocus) { window.scrollTo(0, y); if (focusId && document.getElementById(focusId)) document.getElementById(focusId).focus(); }
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
    if (!GLOSS) { main.innerHTML = '<div class="page"><h1>Glossary</h1><p class="loading">Loading the glossary…</p></div>'; return; }
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
    closePop(false); closeSugg();
    closeSide(false);
    if (lastHash !== null) scrollMem[lastHash] = window.scrollY;
    var h = parseHash(), p = h.parts, key = p[0] || '', hash = location.hash || '#/';
    if (key === 'p' && p[1]) renderProduct(decodeURIComponent(p[1]));
    else if (key === 'brands') renderBrands();
    else if (key === 'glossary') renderGlossary(p[1]);
    else if (key === 'about') renderAbout();
    else { STATE = readState(h.q); renderShop(); }
    // Coming back to a page we left (usually the browser's Back button) restores where the visitor was.
    if (hash in scrollMem && !(key === 'glossary' && p[1])) { window.scrollTo(0, scrollMem[hash]); delete scrollMem[hash]; }
    else if (!(key === 'glossary' && p[1])) window.scrollTo(0, 0);
    lastHash = hash; lastRoute = key === '' ? 'shop' : key;
    toTop.hidden = window.scrollY < 600;
  }
  function rerender() {
    var p = parseHash().parts;
    if (p[0] === 'p') renderProduct(decodeURIComponent(p[1]), true); else renderShop(true);
  }

  // ---------- filter drawer (phone) ----------
  function openSide(focus) {
    var side = $('#side'); if (!side) return;
    document.body.classList.add('side-on');
    side.setAttribute('role', 'dialog'); side.setAttribute('aria-modal', 'true');
    var b = $('#side-open'); if (b) b.setAttribute('aria-expanded', 'true');
    if (focus) $('#side-close').focus();
  }
  function closeSide(focus) {
    if (!document.body.classList.contains('side-on')) return;
    document.body.classList.remove('side-on');
    var side = $('#side'); if (side) { side.removeAttribute('role'); side.removeAttribute('aria-modal'); }
    var b = $('#side-open'); if (b) { b.setAttribute('aria-expanded', 'false'); if (focus) b.focus(); }
  }
  function trapTab(ev) {
    var side = $('#side'); if (!side || !document.body.classList.contains('side-on') || ev.key !== 'Tab') return;
    var f = $$('a[href], button:not([disabled]), input, select, summary', side).filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    else if (!side.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
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
      RULES[t.getAttribute('data-rule')] = t.checked; saveRules(); rerender();
    } else if (t.id === 'r-strict' || t.id === 't-strict') {
      STRICT = t.checked; saveRules(); rerender();
    } else if (t.id === 'sort') {
      var s2 = copyState(); s2.sort = t.value; setState(s2);
    }
  });
  document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (d.matches && d.matches('details.panel')) openPanels[d.getAttribute('data-panel')] = d.open;
  }, true);
  document.addEventListener('input', function (ev) {
    if (ev.target.id === 'brand-find') filterBrandList(ev.target.value);
    if (ev.target.id === 'q') {
      var v = ev.target.value;
      clearTimeout(suggT);
      suggT = setTimeout(function () {
        suggestions(v);
        // Search as you type while on the shop; other pages wait for Enter.
        if (lastRoute === 'shop' && v.trim() !== STATE.q) { var st = copyState(); st.q = v.trim(); setState(st); }
      }, 180);
    }
  });
  $('#searchform').addEventListener('submit', function (ev) {
    ev.preventDefault();
    clearTimeout(suggT); closeSugg();
    var v = $('#q').value.trim();
    var st = readState({}); st.q = v; st.sort = STATE.sort;
    if (lastRoute === 'shop') setState(st); else location.hash = stateHash(st);
    $('#q').blur();
  });
  $('#q').addEventListener('focus', function () { if (sugg.innerHTML) sugg.hidden = false; });
  document.addEventListener('click', function (ev) {
    if (!ev.target.closest('.search')) closeSugg();
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
      C.criteria.forEach(function (c) { RULES[c.id] = !!c['default']; }); STRICT = false; saveRules(); rerender();
    } else if (t.id === 'open-rules') {
      ev.preventDefault(); showRules();
    } else if (t.id === 'side-open') {
      openSide(true);
    } else if (t.id === 'side-close') {
      closeSide(true);
    } else if (t.id === 'totop') {
      window.scrollTo({ top: 0, behavior: 'smooth' }); var m = $('#main'); if (m) m.focus();
    } else if (t.hasAttribute('data-jump')) {
      ev.preventDefault(); var el = document.getElementById(t.getAttribute('data-jump')); if (el) { el.scrollIntoView(); el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
    }
  });
  function showRules() {
    var p = $('[data-panel="rules"]'); if (!p) return;
    p.open = true; openPanels.rules = true;
    if (window.matchMedia('(max-width: 900px)').matches) openSide(false);
    p.scrollIntoView({ block: 'start' });
    var first = p.querySelector('input'); if (first) first.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { if (!sugg.hidden) closeSugg(); else if (document.body.classList.contains('side-on')) closeSide(true); }
    trapTab(ev);
  });
  var toTop = document.getElementById('totop');
  window.addEventListener('scroll', function () { toTop.hidden = window.scrollY < 600; }, { passive: true });

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
  function openPop(a, id, also) {
    var g = TERMS[id];
    var others = (also || []).filter(function (k) { return TERMS[k] && k !== id; });
    pop.innerHTML = '<button type="button" class="x" aria-label="Close">&times;</button><h4 id="gpop-h">' + esc(g.term) + '</h4><p>' + esc(g.definition) + '</p>' +
      (g.on_this_site ? '<p class="lab">On this site</p><p>' + esc(g.on_this_site) + '</p>' : '') +
      '<p class="gpop-links"><a class="more" href="#/glossary/' + id + '">Full entry and sources →</a>' +
      (others.length ? '<span class="also">Also in this chip: ' + others.map(function (k) { return '<a href="#/glossary/' + k + '" data-term="' + k + '" data-also="' + [id].concat(others).join(',') + '">' + esc(TERMS[k].term) + '</a>'; }).join(', ') + '</span>' : '') + '</p>';
    pop.hidden = false; place(a);
    if (cur && cur !== a) cur.setAttribute('aria-expanded', 'false');
    cur = a; a.setAttribute('aria-expanded', 'true'); a.setAttribute('aria-controls', 'gpop');
  }
  function closePop(refocus) {
    if (pop.hidden) return; pop.hidden = true;
    if (cur) { cur.setAttribute('aria-expanded', 'false'); if (refocus) cur.focus(); }
    cur = null;
  }
  function alsoOf(a) { var s = a.getAttribute('data-also'); return s ? s.split(',') : []; }
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('#gpop .x')) { closePop(true); return; }
    if (ev.target.closest('#gpop .more')) { closePop(false); return; }
    var a = ev.target.closest('a[data-term]');
    if (a && TERMS[a.getAttribute('data-term')] && !a.closest('.glossary')) {
      ev.preventDefault(); ev.stopPropagation();
      if (a.closest('#gpop')) { openPop(cur, a.getAttribute('data-term'), alsoOf(a)); return; }
      if (cur === a && !pop.hidden && a.getAttribute('data-click') === '1') closePop(false);
      else { openPop(a, a.getAttribute('data-term'), alsoOf(a)); a.setAttribute('data-click', '1'); }
      return;
    }
    if (!ev.target.closest('#gpop')) closePop(false);
  }, true);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closePop(true); });
  if (fine) {
    document.addEventListener('mouseover', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[data-term]');
      clearTimeout(hoverT);
      if (a && a !== cur && !a.closest('#gpop') && TERMS[a.getAttribute('data-term')] && !a.closest('.glossary')) hoverT = setTimeout(function () { openPop(a, a.getAttribute('data-term'), alsoOf(a)); a.removeAttribute('data-click'); }, 250);
      else if (!a && !ev.target.closest('#gpop') && cur && !pop.hidden && cur.getAttribute('data-click') !== '1') hoverT = setTimeout(function () { closePop(false); }, 300);
    });
  }
  window.addEventListener('resize', function () { if (cur && !pop.hidden) place(cur); });

  // ---------- boot ----------
  function inline(id) { var el = document.getElementById(id); return el ? JSON.parse(el.textContent) : null; }
  function get(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  function useGlossary(g) {
    GLOSS = g;
    if (GLOSS) GLOSS.sections.forEach(function (s) { s.terms.forEach(function (t) { TERMS[t.id] = t; }); });
    // Term links appear once the glossary is here; refresh the page that is showing.
    var p = parseHash().parts;
    if (p[0] === 'p') renderProduct(decodeURIComponent(p[1]), true);
    else if (p[0] === 'glossary') renderGlossary(p[1]);
    else if (!p[0]) renderShop(true);
  }
  var data = inline('sbtt-data'), gloss = inline('sbtt-glossary');
  (data ? Promise.resolve(data) : get('data.json')).then(function (d) {
    C = S.build(d);
    loadRules();
    $('#depts').innerHTML = '<a href="#/" data-dept="">All</a>' + C.groups.map(function (g) {
      return '<a href="#/?dept=' + g.id + '" data-dept="' + g.id + '">' + esc(g.title) + '</a>';
    }).join('');
    window.addEventListener('hashchange', route);
    route();
    // The glossary is not needed for the first paint; fetch it after.
    if (gloss) useGlossary(gloss);
    else get('glossary.json').then(useGlossary, function () { useGlossary(null); });
  }).catch(function (e) {
    main.innerHTML = '<div class="page"><h1>Couldn\'t load the catalog</h1><p>' + esc(e.message) + '</p></div>';
  });
})();
