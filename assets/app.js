/* Saved by the Thread: storefront front end. Pages render in the browser from data.json; URLs are clean paths
   under the site's base (GitHub Pages serves 404.html for them, which hands the path back to this script):
     /                home                 /shop            every product, with filters in the query string
     /d/<dept>        a department         /c/<type>        a product type        /b/<brand>   a brand
     /search?q=       search results       /p/<id>          a product page
     /brands  /glossary[/<term>]  /about  /saved  /compare
   Filters in the query string: q, cat, brand, price, mat, std, age, ship, sort, all (show items the material
   filters exclude), m (material criteria that are on, when they differ from the defaults), strict. */
(function () {
  'use strict';
  var S = window.SBTT;
  var main = document.getElementById('main');
  var live = document.getElementById('live');
  var C, TERMS = {}, GLOSS = null, CRIT = {}, STRICT = false;
  var PREF_KEY = 'sbtt-filters-3', SAVED_KEY = 'sbtt-saved', CMP_KEY = 'sbtt-compare', RECENT_KEY = 'sbtt-recent';
  var FACETS = ['cat', 'brand', 'price', 'mat', 'std', 'age', 'ship'];
  var PAGE = 24;
  var openGroups = { crit: true, cat: true, price: true, brand: false, mat: true, std: false, age: false, ship: false };
  var scrollMem = {}, lastUrl = null, pageShown = PAGE, PEND = null;

  // ---------- base path and URLs ----------
  var SCRIPT = document.currentScript && document.currentScript.src || (location.origin + '/assets/app.js');
  var BASE = new URL(SCRIPT.replace(/assets\/app\.js.*$/, ''), location.href);
  var BASE_PATH = BASE.pathname.replace(/\/?$/, '/');
  function U(path, query) {
    var qs = query ? encodeQuery(query) : '';
    return BASE_PATH + String(path || '/').replace(/^\//, '') + (qs ? '?' + qs : '');
  }
  function asset(p) { return BASE_PATH + p; }
  function encodeQuery(q) {
    return Object.keys(q).filter(function (k) { return q[k] !== '' && q[k] != null && q[k] !== false; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(String(q[k])).replace(/%2C/g, ','); }).join('&');
  }
  function parseQuery(qs) {
    var q = {};
    String(qs || '').replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return; var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
    });
    return q;
  }
  function currentPath() {
    var p = location.pathname;
    if (p.indexOf(BASE_PATH) === 0) p = p.slice(BASE_PATH.length - 1);
    return p || '/';
  }
  function go(url, replace) {
    if (lastUrl !== null) scrollMem[lastUrl] = window.scrollY;
    try { history[replace ? 'replaceState' : 'pushState'](null, '', url); } catch (e) { location.href = url; return; }
    route();
  }

  // ---------- helpers ----------
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function icon(id) { return '<svg aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function byId(id) { return C.items.filter(function (i) { return i.id === id; })[0]; }
  function catOf(id) { return C.cats[id]; }
  function groupOf(id) { return C.groups.filter(function (g) { return g.id === id; })[0]; }
  function matLabel(id) { var m = S.MATERIALS.filter(function (x) { return x.id === id; })[0]; return m ? m.label : id; }
  function brandList() { return Object.keys(C.brands).map(function (k) { return C.brands[k]; }).sort(function (a, b) { return S.fold(a.name).localeCompare(S.fold(b.name)); }); }
  function termsIn(text) {
    var ids = [];
    S.termRuns(text, TERMS).forEach(function (r) { if (r[1] && ids.indexOf(r[1]) < 0) ids.push(r[1]); });
    return ids;
  }
  function chip(text) {
    var ids = termsIn(text);
    if (!ids.length) return '<span class="chip">' + esc(text) + '</span>';
    return '<a class="chip term-link" href="' + U('/glossary/' + ids[0]) + '" data-term="' + ids[0] + '"' + (ids.length > 1 ? ' data-also="' + ids.slice(1).join(',') + '"' : '') + '>' + esc(text) + '</a>';
  }
  function termLink(id, label) {
    return TERMS[id] ? '<a class="term-link" href="' + U('/glossary/' + id) + '" data-term="' + id + '">' + esc(label) + '</a>' : esc(label);
  }
  function store(key, val) {
    try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null'); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; }
  }

  // ---------- material criteria (filters that persist as a preference) ----------
  function defaults() { var d = {}; C.criteria.forEach(function (c) { d[c.id] = !!c['default']; }); return d; }
  function loadPref() {
    CRIT = defaults(); STRICT = false;
    var s = store(PREF_KEY);
    if (s) { Object.keys(s.c || {}).forEach(function (k) { if (k in CRIT) CRIT[k] = !!s.c[k]; }); STRICT = !!s.strict; }
  }
  function savePref() { store(PREF_KEY, { c: CRIT, strict: STRICT }); }
  function critIsDefault(crit, strict) { var d = defaults(); return !strict && C.criteria.every(function (c) { return !!crit[c.id] === d[c.id]; }); }
  function critOn(crit, strict) { return C.criteria.filter(function (c) { return crit[c.id]; }).length + (strict ? 1 : 0); }
  function status(item, crit, strict) { return S.evaluate(item, C.criteria, crit || CRIT, strict == null ? STRICT : strict); }

  // ---------- listing state ----------
  function readState(kind, key, q) {
    var st = { kind: kind, key: key || '', q: q.q || '', sort: q.sort || 'featured', all: q.all === '1' };
    FACETS.forEach(function (f) { st[f] = q[f] ? q[f].split(',').filter(Boolean) : []; });
    if (kind === 'cat') st.cat = [key]; else if (kind === 'brand') st.brand = [key];
    if (q.m !== undefined) {
      var on = q.m.split(',').filter(Boolean), crit = {};
      C.criteria.forEach(function (c) { crit[c.id] = on.indexOf(c.id) >= 0; });
      st.crit = crit; st.strict = q.strict === '1';
    } else { st.crit = Object.assign({}, CRIT); st.strict = STRICT; }
    return st;
  }
  function stateUrl(st) {
    var q = {};
    if (st.q) q.q = st.q;
    FACETS.forEach(function (f) {
      if ((f === 'cat' && st.kind === 'cat') || (f === 'brand' && st.kind === 'brand')) return;
      if (st[f].length) q[f] = st[f].join(',');
    });
    if (st.sort && st.sort !== 'featured') q.sort = st.sort;
    if (st.all) q.all = '1';
    if (!critIsDefault(st.crit, st.strict)) { q.m = C.criteria.filter(function (c) { return st.crit[c.id]; }).map(function (c) { return c.id; }).join(',') || 'none'; if (st.strict) q.strict = '1'; }
    var path = st.kind === 'cat' ? '/c/' + st.key : st.kind === 'dept' ? '/d/' + st.key : st.kind === 'brand' ? '/b/' + st.key : st.kind === 'search' ? '/search' : '/shop';
    return U(path, q);
  }
  var STATE = null;
  function copyState(st) { var c = JSON.parse(JSON.stringify(st || STATE)); return c; }
  function setState(st, push) {
    // Material criteria changed on a listing page become the visitor's preference everywhere.
    CRIT = Object.assign({}, st.crit); STRICT = st.strict; savePref();
    STATE = st; pageShown = PAGE;
    var url = stateUrl(st);
    try { history[push ? 'pushState' : 'replaceState'](null, '', url); } catch (e) {}
    lastUrl = url;
    renderList(true);
  }

  // ---------- filtering ----------
  function facetValues(item, f) {
    switch (f) {
      case 'cat': return [item.cat];
      case 'brand': return [item.brandId];
      case 'mat': return item.materials;
      case 'std': return item.standards;
      case 'age': return [item.ageBand];
      case 'ship': return item.ships;
      case 'price':
        return S.PRICE_BANDS.filter(function (b) { return item.min != null && item.min < b.max && (item.max == null ? item.min : item.max) >= b.min; })
          .map(function (b) { return b.id; }).concat(item.min == null ? ['none'] : []);
    }
    return [];
  }
  function matchesFacet(item, f, st) {
    if (!st[f].length) return true;
    var v = facetValues(item, f);
    if (f === 'mat' || f === 'std') return st[f].every(function (x) { return v.indexOf(x) >= 0; });
    return st[f].some(function (x) { return v.indexOf(x) >= 0; });
  }
  function matchesQuery(item, q) {
    if (!q) return true;
    return S.fold(q).split(/\s+/).filter(Boolean).every(function (w) { return item.q.indexOf(w) >= 0; });
  }
  function inScope(item, st) { return st.kind !== 'dept' || item.group === st.key; }
  // Items matching the search, scope and facets, before the material criteria.
  function base(st, except) {
    return C.items.filter(function (it) {
      return inScope(it, st) && matchesQuery(it, st.q) && FACETS.every(function (f) { return f === except || matchesFacet(it, f, st); });
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
               ['brand', 'Brand: A to Z'], ['name', 'Name: A to Z'], ['stated', 'Fewest details not stated']];

  // ---------- saved, compare, recently viewed ----------
  function listGet(key) { return store(key) || []; }
  function listToggle(key, id, max) {
    var l = listGet(key), i = l.indexOf(id);
    if (i >= 0) l.splice(i, 1); else { if (max && l.length >= max) return false; l.push(id); }
    store(key, l); return true;
  }
  function recentAdd(id) { var l = listGet(RECENT_KEY).filter(function (x) { return x !== id; }); l.unshift(id); store(RECENT_KEY, l.slice(0, 12)); }
  function badgeCounts() {
    var s = listGet(SAVED_KEY).length, c = listGet(CMP_KEY).length;
    $('#saved-n').textContent = s; $('#saved-n').hidden = !s;
    $('#compare-n').textContent = c; $('#compare-n').hidden = !c;
    renderTray();
  }
  function saveBtn(item, cls) {
    var on = listGet(SAVED_KEY).indexOf(item.id) >= 0;
    return '<button type="button" class="' + (cls || 'save-btn') + '" data-save="' + esc(item.id) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Remove from saved' : 'Save') + ': ' + esc(item.brand + ' ' + item.line) + '">' + icon('heart') + (cls ? '<span>' + (on ? 'Saved' : 'Save') + '</span>' : '') + '</button>';
  }
  function compareBtn(item) {
    var on = listGet(CMP_KEY).indexOf(item.id) >= 0;
    return '<button type="button" class="btn-3" data-compare="' + esc(item.id) + '" aria-pressed="' + on + '">' + icon('compare') + '<span>' + (on ? 'In compare' : 'Compare') + '</span></button>';
  }

  // ---------- pieces ----------
  function photo(item, eager) {
    if (!item.img) return '<div class="ph empty"><span>No store photo saved</span></div>';
    return '<div class="ph"><img src="' + esc(asset(item.img)) + '" alt="' + esc(item.brand + ' ' + item.line) + '" width="640" height="800" decoding="async"' +
      (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' onerror="this.parentNode.classList.add(\'empty\');this.outerHTML=\'<span>No store photo saved</span>\'"></div>';
  }
  function missText(item, r) {
    return r.miss.map(function (c) { return c.short + (c.kind !== 'contains' && item.facts[c.id] === 'unknown' ? ' (not stated)' : ''); }).join(', ');
  }
  function card(item, i, crit, strict) {
    var r = status(item, crit, strict);
    var mats = item.materials.slice(0, 3).map(matLabel);
    var badges = [];
    if (!r.ok) badges.push('<span class="badge miss">Doesn’t match a filter</span>');
    if (item.freeShip) badges.push('<span class="badge free">Free shipping</span>');
    if (item.products.length > 1) badges.push('<span class="badge soft">' + item.products.length + ' stores</span>');
    return '<article class="card' + (r.ok ? '' : ' is-miss') + '" data-id="' + esc(item.id) + '">' +
      '<a class="card-link" href="' + U('/p/' + item.id) + '">' + photo(item, i != null && i < 4) +
      '<div class="ph-badges">' + badges.join('') + '</div>' +
      '<div class="card-body"><p class="brand">' + esc(item.brand) + '</p><h3>' + esc(item.line) + '</h3>' +
      '<p class="mats">' + esc(mats.join(' · ') || 'Materials on the product page') + '</p>' +
      '<p class="price">' + esc(S.priceFrom(item)) + '</p>' +
      '<p class="meta">' + (r.ok ? (r.unst.length ? plural(r.unst.length, 'detail') + ' not stated' : 'Every covered detail stated') : 'Doesn’t match: ' + esc(missText(item, r))) + '</p>' +
      '</div></a>' + saveBtn(item) +
      '<button type="button" class="qv-btn" data-qv="' + esc(item.id) + '">Quick view</button></article>';
  }
  function cardRail(items, title, moreHref, moreText) {
    if (!items.length) return '';
    return '<section class="sec rail"><div class="sec-h"><h2>' + title + '</h2>' + (moreHref ? '<a href="' + moreHref + '">' + esc(moreText || 'See all') + '</a>' : '') + '</div>' +
      '<div class="grid rail-grid">' + items.map(function (i) { return card(i); }).join('') + '</div></section>';
  }
  function crumbs(list) {
    return '<ol class="crumbs"><li><a href="' + U('/') + '">Home</a></li>' + list.map(function (c) { return '<li>' + (c[1] ? '<a href="' + c[1] + '">' + esc(c[0]) + '</a>' : '<span aria-current="page">' + esc(c[0]) + '</span>') + '</li>'; }).join('') + '</ol>';
  }
  function announce(text) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = text; }, 50); } }
  function setTitle(t) { document.title = (t ? t + ' · ' : '') + 'Saved by the Thread'; }
  function setNav(kind, key) {
    $$('#cats .cat-a').forEach(function (a) {
      var d = a.getAttribute('data-nav');
      var on = d === kind || (kind === 'dept' && d === 'd:' + key) || (kind === 'cat' && C.cats[key] && d === 'd:' + C.cats[key].group) || (kind === 'product' && d === 'd:' + key);
      a.classList.toggle('on', !!on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  // ---------- home ----------
  function renderHome() {
    var okItems = C.items.filter(function (i) { return status(i).ok; });
    var art = okItems.filter(function (i) { return i.img; }).filter(function (i, k, a) { return a.findIndex(function (x) { return x.group === i.group; }) === k; }).slice(0, 3);
    var tiles = C.groups.map(function (g) {
      var items = C.items.filter(function (i) { return i.group === g.id; });
      var pic = items.filter(function (i) { return i.img && status(i).ok; })[0] || items.filter(function (i) { return i.img; })[0];
      return '<a class="tile" href="' + U('/d/' + g.id) + '"><div class="tile-img">' + (pic ? '<img src="' + esc(asset(pic.img)) + '" alt="" loading="lazy" decoding="async">' : '') + '</div>' +
        '<span class="tile-t">' + esc(g.title) + '</span><span class="tile-n">' + plural(items.length, 'listing') + ' · ' + g.cats.length + ' types</span></a>';
    }).join('');
    var types = Object.keys(C.cats).map(function (k) { return C.cats[k]; }).map(function (c) {
      var n = C.items.filter(function (i) { return i.cat === c.id; }).length;
      return '<a href="' + U('/c/' + c.id) + '">' + esc(c.title) + ' <span>' + n + '</span></a>';
    }).join('');
    var topBrands = brandList().sort(function (a, b) { return b.items.length - a.items.length || S.fold(a.name).localeCompare(S.fold(b.name)); }).slice(0, 18)
      .map(function (b) { return '<a href="' + U('/b/' + b.id) + '">' + esc(b.name) + '<span>' + b.items.length + '</span></a>'; }).join('');
    var featured = okItems.filter(function (i) { return i.img; }).filter(function (i, k, a) { return a.findIndex(function (x) { return x.brandId === i.brandId; }) === k; }).slice(0, 8);
    var hidden = C.items.length - okItems.length;
    main.innerHTML = '<div class="wrap">' +
      '<section class="hero"><div><p class="eyebrow">Toys, beds, bedding, ice trays and footwear for babies and toddlers</p>' +
      '<h1>Reading the fine print so you don’t have to.</h1>' +
      '<p class="lede">' + C.items.length + ' products from ' + Object.keys(C.brands).length + ' brands, each with what its maker says it is made of, what the maker says is absent, and what no page states. Filter by material, standard, price, brand and more, then buy from the store that sells it.</p>' +
      '<div class="hero-cta"><a class="btn" href="' + U('/shop') + '">Shop all products</a><a class="btn-2" href="' + U('/about') + '">How the guide works</a></div></div>' +
      '<div class="hero-art" aria-hidden="true">' + art.map(function (i) { return '<a href="' + U('/p/' + i.id) + '" tabindex="-1"><img src="' + esc(asset(i.img)) + '" alt="" decoding="async"></a>'; }).join('') + '</div></section>' +
      '<section class="sec"><div class="sec-h"><h2>Shop by department</h2><a href="' + U('/shop') + '">All products →</a></div><div class="tiles">' + tiles + '</div></section>' +
      '<section class="sec"><div class="sec-h"><h2>Shop by product type</h2></div><div class="types">' + types + '</div></section>' +
      cardRail(featured, 'Featured products', U('/shop'), 'See all ' + okItems.length) +
      '<section class="sec"><div class="sec-h"><h2>What every listing tells you</h2><a href="' + U('/about') + '">How we read a product →</a></div><div class="explain">' +
      '<div class="r-uses"><span class="ic" aria-hidden="true">✓</span><b>Made with</b><p>The materials the maker or store names.</p></div>' +
      '<div class="r-free"><span class="ic" aria-hidden="true">⊘</span><b>Stated free of</b><p>What the maker says is absent.</p></div>' +
      '<div class="r-unk"><span class="ic" aria-hidden="true">?</span><b>Not stated</b><p>Parts no page describes, such as thread, glue or dye.</p></div>' +
      '<div class="r-out"><span class="ic" aria-hidden="true">✕</span><b>Flagged parts</b><p>Parts like a plastic lid or synthetic fill, named so you can decide.</p></div></div></section>' +
      '<section class="sec"><div class="sec-h"><h2>Brands</h2><a href="' + U('/brands') + '">All ' + Object.keys(C.brands).length + ' brands →</a></div><div class="brand-strip">' + topBrands + '</div></section>' +
      '</div>' +
      '<section class="band"><div class="wrap"><div><h2>Your material filters</h2><p>' + plural(critOn(CRIT, STRICT), 'material filter is', 'material filters are') + ' on, so ' + okItems.length + ' of ' + C.items.length + ' products show by default and ' + hidden + ' are set aside. They are ordinary filters: untick one in the filter rail and the products come back.</p><a class="btn-2" href="' + U('/shop') + '">Open the filters</a></div>' +
      '<div><h2>Materials glossary</h2><p>' + Object.keys(TERMS).length + ' terms from store pages, from superwash wool to LFGB-tested silicone, each with a plain definition, what it means on this site and its sources. Dotted words on any product open a definition in place.</p><a class="btn-2" href="' + U('/glossary') + '">Browse the glossary</a></div></div></section>';
    setNav('home'); setTitle('');
  }

  // ---------- listing page ----------
  function countsFor(f, st) {
    var counts = {};
    base(st, f).forEach(function (it) {
      var ok = status(it, st.crit, st.strict).ok;
      facetValues(it, f).forEach(function (v) {
        var c = counts[v] || (counts[v] = { n: 0, h: 0 });
        if (ok || st.all) c.n++; else c.h++;
      });
    });
    return counts;
  }
  function optionList(f, opts, counts, st, limit) {
    var rows = opts.map(function (o) {
      var c = counts[o.id] || { n: 0, h: 0 }, on = st[f].indexOf(o.id) >= 0;
      if (!c.n && !c.h && !on && o.hideEmpty) return '';
      return '<label class="opt' + (c.n || on ? '' : ' dim') + '"><input type="checkbox" data-facet="' + f + '" value="' + esc(o.id) + '" id="f-' + f + '-' + esc(o.id) + '"' + (on ? ' checked' : '') + '>' +
        '<span class="lbl">' + esc(o.label) + '</span><span class="n">' + c.n + (c.h ? '<span class="sr">, </span><i title="' + plural(c.h, 'more item', 'more items') + ' set aside by your material filters"> +' + c.h + '</i>' : '') + '</span></label>';
    }).filter(Boolean);
    if (limit && rows.length > limit) {
      return rows.slice(0, limit).join('') + '<div class="more-opts-wrap" hidden>' + rows.slice(limit).join('') + '</div>' +
        '<button type="button" class="more-opts" data-more-opts>Show all ' + rows.length + '</button>';
    }
    return rows.join('');
  }
  function group(id, title, body, n) {
    return '<details class="fgroup" data-group="' + id + '"' + (openGroups[id] ? ' open' : '') + '><summary>' + esc(title) + (n ? '<span class="cnt">' + n + '</span>' : '') + icon('chev') + '</summary><div class="fbody">' + body + '</div></details>';
  }
  // The material criteria as a filter group: each option narrows the list like any other checkbox.
  function critGroup(st) {
    var b = base(st), on = critOn(st.crit, st.strict);
    var rows = C.criteria.map(function (c) {
      var crit = Object.assign({}, st.crit); crit[c.id] = true;
      var n = b.filter(function (it) { return status(it, crit, st.strict).ok; }).length;
      return '<label class="opt' + (n ? '' : ' dim') + '"><input type="checkbox" data-crit="' + c.id + '" id="f-crit-' + c.id + '"' + (st.crit[c.id] ? ' checked' : '') + '>' +
        '<span class="lbl">' + esc(S.filterLabel(c)) + (TERMS[c.term] ? ' <a class="q" href="' + U('/glossary/' + c.term) + '" data-term="' + c.term + '" aria-label="What this means: ' + esc(c.short) + '">?</a>' : '') + '<small>' + esc(c.help) + '</small></span><span class="n">' + n + '</span></label>';
    }).join('');
    var nStrict = b.filter(function (it) { return status(it, st.crit, true).ok; }).length;
    rows += '<label class="opt"><input type="checkbox" data-crit="strict" id="f-crit-strict"' + (st.strict ? ' checked' : '') + '><span class="lbl">Every detail above is stated<small>Leaves out items whose page doesn’t say, for the filters you have on.</small></span><span class="n">' + nStrict + '</span></label>';
    var hint = '<p class="hint">Ticked filters leave out products that don’t meet them' + (critIsDefault(st.crit, st.strict) ? '; these start from one family’s preferences.' : '.') + ' <a href="#" data-crit-reset>' + (critIsDefault(st.crit, st.strict) ? 'Untick all' : 'Reset to defaults') + '</a></p>';
    return group('crit', 'Materials & making', rows + hint, on);
  }
  function filterRail(st) {
    var h = critGroup(st);
    if (st.kind !== 'cat') {
      var cc = countsFor('cat', st);
      var groups = C.groups.filter(function (g) { return st.kind !== 'dept' || g.id === st.key; });
      h += group('cat', 'Product type', groups.map(function (g) {
        return (groups.length > 1 ? '<p class="opt-group">' + esc(g.title) + '</p>' : '') + optionList('cat', g.cats.map(function (id) { return { id: id, label: C.cats[id].title }; }), cc, st);
      }).join(''), st.cat.length);
    }
    h += group('price', 'Price', optionList('price', S.PRICE_BANDS.concat([{ id: 'none', label: 'Price not listed', hideEmpty: true }]), countsFor('price', st), st) +
      '<p class="hint">Other currencies converted roughly to US dollars.</p>', st.price.length);
    if (st.kind !== 'brand') {
      h += group('brand', 'Brand', '<input type="search" class="find" id="brand-find" placeholder="Find a brand" aria-label="Find a brand">' +
        '<div id="brand-opts">' + optionList('brand', brandList().map(function (b) { return { id: b.id, label: b.name }; }), countsFor('brand', st), st, 8) + '</div>', st.brand.length);
    }
    h += group('mat', 'Made with', optionList('mat', S.MATERIALS, countsFor('mat', st), st) + '<p class="hint">Several ticked: products made with all of them.</p>', st.mat.length);
    h += group('std', 'Standards named', optionList('std', C.standards.map(function (s) { return { id: s.id, label: s.label }; }), countsFor('std', st), st) + '<p class="hint">Listed when a maker or store names the standard.</p>', st.std.length);
    h += group('age', 'Age rating', optionList('age', S.AGE_BANDS.concat([{ id: 'none', label: 'No age rating recorded' }]), countsFor('age', st), st), st.age.length);
    h += group('ship', 'Ships from', optionList('ship', [{ id: 'us', label: 'The US' }, { id: 'abroad', label: 'Outside the US' }, { id: 'unknown', label: 'Not recorded' }], countsFor('ship', st), st), st.ship.length);
    return h;
  }
  function activeChips(st) {
    var chips = [];
    function add(f, v, label) { chips.push('<button type="button" class="chip-x" data-clear="' + f + '" data-val="' + esc(v) + '">' + esc(label) + icon('x') + '<span class="sr"> remove</span></button>'); }
    if (st.q && st.kind !== 'search') add('q', '', '“' + st.q + '”');
    if (st.kind !== 'cat') st.cat.forEach(function (v) { add('cat', v, catOf(v) ? catOf(v).title : v); });
    if (st.kind !== 'brand') st.brand.forEach(function (v) { add('brand', v, C.brands[v] ? C.brands[v].name : v); });
    st.price.forEach(function (v) { var b = S.PRICE_BANDS.filter(function (x) { return x.id === v; })[0]; if (b || v === 'none') add('price', v, b ? b.label : 'Price not listed'); });
    st.mat.forEach(function (v) { add('mat', v, matLabel(v)); });
    st.std.forEach(function (v) { var s = C.standards.filter(function (x) { return x.id === v; })[0]; add('std', v, s ? s.label : v); });
    st.age.forEach(function (v) { var a = S.AGE_BANDS.filter(function (x) { return x.id === v; })[0]; add('age', v, a ? a.label : 'No age rating'); });
    st.ship.forEach(function (v) { var l = { us: 'Ships from the US', abroad: 'Ships from outside the US', unknown: 'Shipping not recorded' }[v]; if (l) add('ship', v, l); });
    var d = defaults();
    C.criteria.forEach(function (c) { if (st.crit[c.id] && !d[c.id]) add('crit', c.id, S.filterLabel(c)); });
    if (st.strict) add('crit', 'strict', 'Every detail stated');
    if (chips.length > 1) chips.push('<button type="button" class="chip-clear" data-clear-all>Clear all</button>');
    return chips.join('');
  }
  function emptyState(st, hidden) {
    var sug = [];
    if (st.q) {
      var words = S.fold(st.q).split(/\s+/).filter(function (w) { return w.length > 2; });
      brandList().filter(function (b) { return words.some(function (w) { return S.fold(b.name).indexOf(w) >= 0; }); }).slice(0, 4)
        .forEach(function (b) { sug.push('<a href="' + U('/b/' + b.id) + '">' + esc(b.name) + '</a>'); });
      Object.keys(C.cats).map(function (k) { return C.cats[k]; }).filter(function (c) { return words.some(function (w) { return S.fold(c.title).indexOf(w) >= 0; }); }).slice(0, 4)
        .forEach(function (c) { sug.push('<a href="' + U('/c/' + c.id) + '">' + esc(c.title) + '</a>'); });
    }
    return '<div class="empty-state"><p><b>Nothing matches</b>' + (st.q ? ' “' + esc(st.q) + '”' : ' these filters') +
      (hidden && !st.all ? ', though ' + plural(hidden, 'product is', 'products are') + ' set aside by your material filters' : '') + '.</p>' +
      (sug.length ? '<p>Try:</p><div class="types">' + sug.join('') + '</div>' : '') +
      '<p style="margin-top:16px">' + (hidden && !st.all ? '<button type="button" class="btn-2" data-toggle-all>Show the ' + hidden + ' set aside</button> ' : '') +
      '<button type="button" class="btn-2" data-clear-all>Clear filters</button></p></div>';
  }
  function listTitle(st) {
    if (st.kind === 'cat') return catOf(st.key) ? catOf(st.key).title : st.key;
    if (st.kind === 'dept') return groupOf(st.key) ? groupOf(st.key).title : st.key;
    if (st.kind === 'brand') return C.brands[st.key] ? C.brands[st.key].name : st.key;
    if (st.kind === 'search') return st.q ? 'Results for “' + st.q + '”' : 'Search';
    return 'All products';
  }
  function renderList(keepFocus) {
    var st = STATE, show = PEND || st;
    var focusId = keepFocus && document.activeElement && document.activeElement.id;
    var brandFind = $('#brand-find') ? $('#brand-find').value : '';
    var drawer = document.body.classList.contains('drawer-on');
    var all = sortItems(base(st), st.sort);
    var ok = all.filter(function (i) { return status(i, st.crit, st.strict).ok; }), hidden = all.length - ok.length;
    var list = st.all ? all : ok;
    var shown = list.slice(0, pageShown);
    var title = listTitle(st), intro = '', sub = '', trail = [];
    if (st.kind === 'cat' && catOf(st.key)) {
      var c = catOf(st.key), g = groupOf(c.group);
      trail = [[g.title, U('/d/' + g.id)], [c.title]];
      if (c.intro) intro = c.intro;
    } else if (st.kind === 'dept' && groupOf(st.key)) {
      var gg = groupOf(st.key);
      trail = [[gg.title]];
      intro = gg.blurb + (gg.source ? ' <a href="' + esc(gg.source) + '" target="_blank" rel="noopener">Read the research post</a>.' : '');
      sub = '<div class="subcats">' + gg.cats.map(function (id) { var n = C.items.filter(function (i) { return i.cat === id && status(i, st.crit, st.strict).ok; }).length; return '<a href="' + U('/c/' + id) + '">' + esc(C.cats[id].title) + '<span>' + n + '</span></a>'; }).join('') + '</div>';
    } else if (st.kind === 'brand' && C.brands[st.key]) {
      var b = C.brands[st.key], bc = {}; b.items.forEach(function (i) { bc[i.cat] = 1; });
      trail = [['Brands', U('/brands')], [b.name]];
      intro = plural(b.items.length, 'listing') + ' in ' + Object.keys(bc).map(function (k) { return C.cats[k].title.toLowerCase(); }).join(', ') + '.';
    } else if (st.kind === 'search') trail = [[st.q ? 'Search: ' + st.q : 'Search']];
    else trail = [['All products']];
    var pend = PEND ? (PEND.all ? base(PEND) : base(PEND).filter(function (i) { return status(i, PEND.crit, PEND.strict).ok; })).length : list.length;
    main.innerHTML = '<div class="wrap">' + crumbs(trail) +
      '<header class="plp-head"><h1>' + esc(title) + '</h1>' + (intro ? '<p class="intro">' + (st.kind === 'dept' ? intro : esc(intro)) + '</p>' : '') + sub + '</header>' +
      '<div class="plp">' +
      '<aside class="rail-f" id="rail" aria-label="Filters"><div class="rail-h"><h2>Filters</h2><div>' + (activeChips(show) ? '<button type="button" class="link-b" data-clear-all>Clear all</button> ' : '') + '<button type="button" class="ib rail-close" data-drawer-close aria-label="Close filters">' + icon('x') + '</button></div></div>' +
      filterRail(show) +
      '<div class="drawer-foot"><button type="button" class="btn-2" data-clear-all>Clear</button><button type="button" class="btn" data-drawer-apply>Show ' + plural(pend, 'result') + '</button></div></aside>' +
      '<section class="results" aria-labelledby="res-count">' +
      '<div class="toolbar"><p class="count" id="res-count"><b>' + plural(list.length, 'product') + '</b>' + (hidden && !st.all ? ' · ' + hidden + ' set aside' : '') + '</p>' +
      '<div class="tools"><button type="button" class="btn-3 filt-btn" data-drawer-open aria-expanded="' + drawer + '" aria-controls="rail">' + icon('sliders') + 'Filter & sort' + (activeChips(st) ? ' <span class="cnt">•</span>' : '') + '</button>' +
      '<label class="sort"><span>Sort by</span><select id="sort" aria-label="Sort by">' + SORTS.map(function (s) { return '<option value="' + s[0] + '"' + (st.sort === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></label></div></div>' +
      '<div class="chips">' + activeChips(st) + '</div>' +
      (hidden ? '<div class="hidden-note"><p>' + (st.all ? plural(hidden, 'product that doesn’t', 'products that don’t') + ' match your material filters ' + (hidden === 1 ? 'is' : 'are') + ' shown with a badge.' : '<b>' + plural(hidden, 'more product', 'more products') + '</b> set aside by your material filters.') + '</p><button type="button" data-toggle-all>' + (st.all ? 'Hide them' : 'Show them') + '</button></div>' : '') +
      (shown.length ? '<div class="grid" id="grid">' + shown.map(function (it, i) { return card(it, i, st.crit, st.strict); }).join('') + '</div>' : emptyState(st, hidden)) +
      (list.length > shown.length ? '<div class="more-wrap"><p>Showing ' + shown.length + ' of ' + list.length + '</p><button type="button" class="btn-2" data-more>Show more</button></div>' : (list.length > PAGE ? '<div class="more-wrap"><p>Showing all ' + list.length + '</p></div>' : '')) +
      '</section></div></div>';
    $('#q').value = st.kind === 'search' || st.q ? st.q : '';
    if (brandFind && $('#brand-find')) { $('#brand-find').value = brandFind; filterBrandList(brandFind); }
    if (drawer) openDrawer(false);
    if (focusId && document.getElementById(focusId)) document.getElementById(focusId).focus({ preventScroll: true });
    setNav(st.kind, st.key);
    setTitle(title === 'All products' ? 'Shop' : title);
    announce(plural(list.length, 'product') + (hidden && !st.all ? ', ' + hidden + ' set aside by your material filters' : '') + '. List updated.');
  }
  function filterBrandList(v) {
    var f = S.fold(v), box = $('#brand-opts'); if (!box) return;
    $$('.opt', box).forEach(function (l) { l.hidden = !!f && S.fold(l.textContent).indexOf(f) < 0; });
    var more = $('.more-opts-wrap', box), btn = $('.more-opts', box);
    if (more) { more.hidden = !f && !more.getAttribute('data-shown'); if (btn) btn.hidden = !!f || !!more.getAttribute('data-shown'); }
  }

  // ---------- product page ----------
  function checklist(item) {
    var rows = [
      ['r-uses', '✓', 'Made with', 'Materials the maker or store names', item.uses],
      ['r-free', '⊘', 'Stated free of', 'What the maker says is absent', item.free],
      ['r-unk', '?', 'Not stated', 'Parts no page describes', item.unconfirmed],
      ['r-out', '✕', 'Flagged parts', 'Named so you can decide', item.outside]
    ];
    return '<div class="check">' + rows.map(function (r) {
      return '<div class="row ' + r[0] + '"><div class="row-h"><span class="ic" aria-hidden="true">' + r[1] + '</span><span>' + r[2] + '<small>' + r[3] + '</small></span></div>' +
        '<div class="chips-row">' + (r[4].length ? r[4].map(chip).join('') : '<span class="none">' + (r[0] === 'r-free' ? 'Nothing stated absent' : r[0] === 'r-unk' ? 'Every covered detail is stated' : 'None') + '</span>') + '</div></div>';
    }).join('') + '</div>';
  }
  function filterTable(item) {
    var rows = C.criteria.map(function (c) {
      var f = item.facts[c.id], has = item.contains.indexOf(c.id) >= 0, res;
      if (c.kind === 'contains') res = has ? '<span class="no">Has it</span>' : '<span class="ok">Doesn’t have it</span>';
      else if (f === undefined) res = '<span class="muted">Doesn’t apply</span>';
      else if (c.kind === 'require') res = f === 'yes' ? '<span class="ok">Stated</span>' : f === 'no' ? '<span class="no">Stated not</span>' : '<span class="unk">Not stated</span>';
      else res = f === 'yes' ? '<span class="ok">Meets it</span>' : f === 'no' ? '<span class="no">Doesn’t meet it</span>' : '<span class="unk">Not stated</span>';
      return '<tr><th scope="row">' + esc(S.filterLabel(c)) + (TERMS[c.term] ? ' <a class="q term-link" href="' + U('/glossary/' + c.term) + '" data-term="' + c.term + '" aria-label="What this means">?</a>' : '') + '<small>' + esc(c.help) + '</small></th><td class="res">' + res + '</td>' +
        '<td class="sw"><label class="opt"><input type="checkbox" data-crit="' + c.id + '" id="t-' + c.id + '"' + (CRIT[c.id] ? ' checked' : '') + '><span class="lbl">' + (CRIT[c.id] ? 'On' : 'Off') + '</span></label></td></tr>';
    }).join('');
    rows += '<tr><th scope="row">Every detail above is stated<small>Leaves out items whose page doesn’t say.</small></th><td class="res">' + (item.unconfirmed.length ? '<span class="unk">' + plural(item.unconfirmed.length, 'detail') + ' not stated</span>' : '<span class="ok">All stated</span>') + '</td>' +
      '<td class="sw"><label class="opt"><input type="checkbox" data-crit="strict" id="t-strict"' + (STRICT ? ' checked' : '') + '><span class="lbl">' + (STRICT ? 'On' : 'Off') + '</span></label></td></tr>';
    return '<table class="ftable"><caption class="sr">How this product reads against each material filter</caption><thead><tr><th scope="col">Filter</th><th scope="col">This product</th><th scope="col">Your filter</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function offerHtml(p, k) {
    var from = p.ships_from === 'US' ? 'Ships from the US' : p.ships_from ? 'Ships from ' + p.ships_from : 'Ships from: not recorded';
    var ship = p.shipping || (/free (?:us )?shipping/i.test(p.price) ? 'Free shipping' : '');
    return '<li class="offer"><p class="o-name">' + esc(p.name) + '</p><p class="o-price">' + esc(p.price.replace(/,?\s*free (us )?shipping.*$/i, '')) + '</p>' +
      '<p class="o-meta">' + esc(p.store) + ' · ' + esc(from) + (ship ? ' · <span class="o-ship">' + icon('truck') + esc(ship) + '</span>' : '') + '</p>' +
      (p.note ? '<p class="o-note">' + esc(p.note) + '</p>' : '') +
      '<a class="' + (k === 0 ? 'btn' : 'btn-2') + '" href="' + esc(p.url) + '" target="_blank" rel="noopener">Buy at ' + esc(p.store.replace(/\s*\(.*\)$/, '')) + icon('ext') + '</a>' +
      (p.price_checked ? '<p class="o-checked">Price checked ' + esc(p.price_checked) + '</p>' : '') + '</li>';
  }
  function renderProduct(id, keep) {
    var item = byId(id);
    if (!item) { renderNotFound(); return; }
    var y = window.scrollY, focusId = keep && document.activeElement && document.activeElement.id;
    var r = status(item), cat = catOf(item.cat), g = groupOf(item.group);
    var stds = item.standards.map(function (s) { var d = C.standards.filter(function (x) { return x.id === s; })[0]; return d ? termLink(d.term, d.label) : esc(s); });
    var more = C.brands[item.brandId].items.filter(function (i) { return i !== item; });
    var also = C.items.filter(function (i) { return i.cat === item.cat && i !== item && i.brandId !== item.brandId && status(i).ok; }).slice(0, 8);
    var recent = listGet(RECENT_KEY).filter(function (x) { return x !== item.id; }).map(byId).filter(Boolean).slice(0, 8);
    recentAdd(item.id);
    main.innerHTML = '<div class="wrap">' + crumbs([[g.title, U('/d/' + g.id)], [cat.title, U('/c/' + cat.id)], [item.line]]) +
      '<article class="pdp">' +
      '<div class="gallery">' + (item.img ? '<button type="button" class="ph-zoom" data-zoom="' + esc(asset(item.img)) + '" aria-label="Enlarge photo" style="all:unset;display:block;cursor:zoom-in">' + photo(item, true) + '</button><span class="zoom-hint">' + icon('zoom') + 'Enlarge</span>' : photo(item, true)) +
      (item.img ? '<p class="img-src">Store photo' + (item.products[0] ? ' from ' + esc(item.products[0].store) : '') + '.</p>' : '') + '</div>' +
      '<div class="buybox">' +
      '<p class="brand"><a href="' + U('/b/' + item.brandId) + '">' + esc(item.brand) + '</a></p><h1>' + esc(item.line) + '</h1>' +
      '<p class="price">' + esc(S.priceLabel(item)) + (item.products.length > 1 ? '<small>' + item.products.length + ' stores</small>' : '') + '</p>' +
      '<div class="status">' + (r.ok ? '<span class="badge free" style="background:var(--accent-soft);color:var(--accent-strong)">Meets your ' + plural(critOn(CRIT, STRICT), 'material filter') + '</span>' : '<span class="badge miss">Doesn’t match: ' + esc(missText(item, r)) + '</span>') +
      (r.unst.length ? '<span>' + plural(r.unst.length, 'covered detail') + ' not stated</span>' : '') + '</div>' +
      '<div class="made"><p class="lab">Made with</p><div class="chips-row">' + item.uses.map(chip).join('') + '</div>' +
      (item.outside.length ? '<p class="lab" style="margin-top:10px">Flagged parts</p><div class="chips-row out">' + item.outside.map(chip).join('') + '</div>' : '') +
      '<a class="link-b" href="#checklist" data-jump="checklist">Full materials checklist ↓</a></div>' +
      '<h2 class="sr">Where to buy</h2><ul class="offers">' + item.products.map(offerHtml).join('') + '</ul>' +
      '<div class="buy-actions">' + saveBtn(item, 'btn-3') + compareBtn(item) + '</div>' +
      (item.quote ? '<blockquote class="ev"><p>“' + esc(item.quote) + '”</p><footer>From the store page</footer></blockquote>' : item.evidence ? '<p class="ev"><span>' + esc(item.evidence) + '</span></p>' : '') +
      (item.note ? '<p class="muted" style="font-size:14px">' + esc(item.note) + '</p>' : '') +
      '<dl class="facts">' + (stds.length ? '<div><dt>Standards named</dt><dd>' + stds.join(', ') + '</dd></div>' : '') +
      '<div><dt>Age rating</dt><dd>' + (item.age ? esc(item.age.text) : 'None recorded') + '</dd></div>' +
      '<div><dt>Product type</dt><dd><a href="' + U('/c/' + cat.id) + '">' + esc(cat.title) + '</a></dd></div>' +
      '<div><dt>Department</dt><dd><a href="' + U('/d/' + g.id) + '">' + esc(g.title) + '</a></dd></div></dl>' +
      '</div></article>' +
      '<div class="pdp-below">' +
      '<details class="acc" open id="checklist"><summary>Materials checklist' + icon('chev') + '</summary><div class="acc-body"><p class="lede">What the maker or store names, what they say is absent, and what no page states. Dotted chips open a definition.</p>' + checklist(item) + '</div></details>' +
      '<details class="acc" id="filters-sec"' + (r.ok ? '' : ' open') + '><summary>Against your material filters' + icon('chev') + '</summary><div class="acc-body"><p class="lede">' + (r.ok ? 'This product meets every material filter you have on.' : 'This product is set aside in listings by ' + plural(r.miss.length, 'filter') + ' you have on.') + ' Filters changed here apply across the site.</p>' + filterTable(item) + '</div></details>' +
      (cat.intro || cat.outro ? '<details class="acc"><summary>About ' + esc(cat.title.toLowerCase()) + icon('chev') + '</summary><div class="acc-body">' + (cat.intro ? '<p>' + esc(cat.intro) + '</p>' : '') + (cat.outro ? '<p>' + esc(cat.outro) + '</p>' : '') + '</div></details>' : '') +
      '<details class="acc"><summary>Prices and shipping' + icon('chev') + '</summary><div class="acc-body"><p>Prices and shipping statements were read from the store pages and are checked weekly; the date under each store link is the last check. Prices in pounds, euros and other currencies are converted roughly to US dollars for sorting.</p></div></details>' +
      '</div>' +
      cardRail(more, 'More from ' + esc(item.brand), U('/b/' + item.brandId), 'All ' + item.brand) +
      cardRail(also, 'You may also like', U('/c/' + cat.id), 'All ' + cat.title.toLowerCase()) +
      (recent.length ? '<div class="recent">' + cardRail(recent, 'Recently viewed') + '</div>' : '') +
      '</div>';
    setNav('product', item.group);
    setTitle(item.brand + ' ' + item.line);
    if (keep) { window.scrollTo(0, y); if (focusId && document.getElementById(focusId)) document.getElementById(focusId).focus({ preventScroll: true }); }
  }

  // ---------- brands, glossary, about, saved, compare ----------
  function renderBrands() {
    var list = brandList(), by = {};
    list.forEach(function (b) { var L = S.fold(b.name).charAt(0).toUpperCase(); L = /[A-Z]/.test(L) ? L : '#'; (by[L] = by[L] || []).push(b); });
    var letters = Object.keys(by).sort();
    main.innerHTML = '<div class="wrap">' + crumbs([['Brands']]) + '<div class="page wide"><h1>Brands</h1><p class="lede">' + list.length + ' brands. Each brand page lists its products with the same filters as the shop.</p>' +
      '<nav class="az" aria-label="Jump to letter">' + letters.map(function (L) { return '<a href="#az-' + L + '" data-jump="az-' + L + '">' + L + '</a>'; }).join('') + '</nav>' +
      letters.map(function (L) {
        return '<section class="az-sec" id="az-' + L + '"><h2>' + L + '</h2><ul class="brand-list">' + by[L].map(function (b) {
          var cats = {}; b.items.forEach(function (i) { cats[i.cat] = 1; });
          return '<li><a class="b-name" href="' + U('/b/' + b.id) + '">' + esc(b.name) + '</a><span class="b-meta">' + plural(b.items.length, 'listing') + ' · ' + Object.keys(cats).map(function (c) { return esc(C.cats[c].short); }).join(', ') + '</span></li>';
        }).join('') + '</ul></section>';
      }).join('') + '</div></div>';
    setNav('brands'); setTitle('Brands');
  }
  function renderGlossary(termId) {
    if (!GLOSS) { main.innerHTML = '<div class="wrap"><div class="page"><h1>Glossary</h1><p class="loading">Loading the glossary…</p></div></div>'; return; }
    var types = GLOSS.source_types || {};
    main.innerHTML = '<div class="wrap">' + crumbs([['Glossary']]) + '<div class="page glossary"><h1>' + esc(GLOSS.title || 'Glossary') + '</h1><p class="lede">' + esc(GLOSS.intro || '') + '</p>' +
      '<nav class="gjump" aria-label="Glossary sections">' + GLOSS.sections.map(function (s) { return '<a href="#gs-' + s.id + '" data-jump="gs-' + s.id + '">' + esc(s.title) + '<span>' + s.terms.length + '</span></a>'; }).join('') + '</nav>' +
      GLOSS.sections.map(function (s) {
        return '<section class="gsec" id="gs-' + s.id + '"><h2>' + esc(s.title) + '</h2><div class="terms">' + s.terms.map(function (t) {
          var srcs = (t.sources || []).map(function (r) {
            return '<li><span class="rt">' + esc(types[r.type] || r.type || '') + '</span><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.title) + '</a>' + (r.publisher ? ' <span class="pub">' + esc(r.publisher) + '</span>' : '') + '</li>';
          }).join('');
          return '<article class="term" id="t-' + esc(t.id) + '"><h3>' + esc(t.term) + '</h3>' + (t.aka && t.aka.length ? '<p class="aka">Also called ' + esc(t.aka.join(', ')) + '</p>' : '') +
            '<p>' + esc(t.definition) + '</p><p class="lab">On this site</p><p>' + esc(t.on_this_site) + '</p><p class="lab">What sources say</p><p>' + esc(t.what_sources_say) + '</p>' +
            (srcs ? '<details><summary>Sources (' + t.sources.length + ')</summary><ul>' + srcs + '</ul></details>' : '') +
            '<p class="t-shop"><a href="' + U('/search', { q: t.term }) + '">Search products for “' + esc(t.term) + '”</a></p></article>';
        }).join('') + '</div></section>';
      }).join('') + '</div></div>';
    setNav('glossary'); setTitle('Glossary');
    if (termId) {
      var el = document.getElementById('t-' + termId);
      if (el) { el.classList.add('hl'); el.scrollIntoView(); var d = el.querySelector('details'); if (d) d.open = true; }
    }
  }
  function renderAbout() {
    var nprod = C.items.reduce(function (n, i) { return n + i.products.length; }, 0);
    main.innerHTML = '<div class="wrap">' + crumbs([['How this guide works']]) + '<div class="page prose"><h1>How this guide works</h1>' +
      '<p class="lede">Saved by the Thread lists ' + C.items.length + ' products (' + nprod + ' store listings from ' + Object.keys(C.brands).length + ' brands) for babies and toddlers. It reports what makers and stores say about materials, finishes and standards, and what they leave out. It doesn’t rank products by safety or risk, and it sells nothing: every product links to the store that does.</p>' +
      '<h2>Reading a product</h2><ul class="legend">' +
      '<li class="r-uses"><span class="ic" aria-hidden="true">✓</span><span><b>Made with</b>: materials the maker or store names.</span></li>' +
      '<li class="r-free"><span class="ic" aria-hidden="true">⊘</span><span><b>Stated free of</b>: things the maker says are absent.</span></li>' +
      '<li class="r-unk"><span class="ic" aria-hidden="true">?</span><span><b>Not stated</b>: parts no page describes, such as thread, glue or dye.</span></li>' +
      '<li class="r-out"><span class="ic" aria-hidden="true">✕</span><span><b>Flagged parts</b>: parts a filter can leave out, such as plastic, synthetic fill, an unnamed colourant or treated wool.</span></li></ul>' +
      '<p>A listing covers one product, or a brand’s line of products made the same way.</p>' +
      '<h2>Material filters</h2><p>The “Materials & making” filters work like every other filter: each one you tick leaves out the products that don’t meet it. They start from the preferences this guide was built around: no plastic or synthetics in the main materials or small parts, no synthetic dyes or paints, solid wood rather than plywood, no superwash wool, no plasticisers in rubber, and silicone only when the maker says the finished product was tested to German LFGB or the French Arrêté. Natural latex and leather have their own filters, which start unticked. A detail that no page states doesn’t count against a product unless you tick “Every detail above is stated”. Your choices are kept in this browser, and a link to a filtered page carries them.</p>' +
      '<h2>Questions makers can answer</h2><ul>' + C.ask.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' +
      '<h2>Prices, shipping and stock</h2><p>Prices and shipping statements were read from store pages and are checked weekly by a script; the product page shows the date of the last check. Prices in pounds, euros and other currencies are converted roughly to US dollars for sorting. Catalog last updated ' + esc(C.updated) + '.</p>' +
      '<h2>Source</h2><p>The data and the site are open at <a href="https://github.com/mchelen/SaferByTheThread" target="_blank" rel="noopener">github.com/mchelen/SaferByTheThread</a>.</p></div></div>';
    setNav('about'); setTitle('About');
  }
  function renderSaved() {
    var items = listGet(SAVED_KEY).map(byId).filter(Boolean);
    main.innerHTML = '<div class="wrap">' + crumbs([['Saved']]) + '<div class="page wide"><h1>Saved products</h1><p class="lede">' + (items.length ? plural(items.length, 'product') + ' saved in this browser.' : 'Nothing saved yet. The heart on any product keeps it here, in this browser.') + '</p>' +
      (items.length ? '<div class="grid">' + items.map(function (i) { return card(i); }).join('') + '</div>' : '<p><a class="btn" href="' + U('/shop') + '">Shop all products</a></p>') + '</div></div>';
    setNav('saved'); setTitle('Saved');
  }
  function renderCompare() {
    var items = listGet(CMP_KEY).map(byId).filter(Boolean);
    var rows = [];
    function row(label, cells) { rows.push('<tr><th scope="row">' + label + '</th>' + cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'); }
    if (items.length) {
      row('Price', items.map(function (i) { return esc(S.priceLabel(i)); }));
      row('Stores', items.map(function (i) { return i.products.map(function (p) { return '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.store) + '</a>' + (p.shipping ? ' <span class="muted">(' + esc(p.shipping) + ')</span>' : ''); }).join('<br>'); }));
      row('Your material filters', items.map(function (i) { var r = status(i); return r.ok ? '<span style="color:var(--moss);font-weight:600">Meets them</span>' + (r.unst.length ? '<br><span class="muted">' + plural(r.unst.length, 'detail') + ' not stated</span>' : '') : '<span style="color:var(--clay);font-weight:600">Doesn’t match:</span> ' + esc(missText(i, r)); }));
      row('Made with', items.map(function (i) { return '<div class="chips-row">' + i.uses.map(chip).join('') + '</div>'; }));
      row('Stated free of', items.map(function (i) { return i.free.length ? '<div class="chips-row r-free">' + i.free.map(chip).join('') + '</div>' : '<span class="muted">Nothing stated</span>'; }));
      row('Not stated', items.map(function (i) { return i.unconfirmed.length ? '<div class="chips-row r-unk">' + i.unconfirmed.map(chip).join('') + '</div>' : '<span class="muted">All covered details stated</span>'; }));
      row('Flagged parts', items.map(function (i) { return i.outside.length ? '<div class="chips-row r-out">' + i.outside.map(chip).join('') + '</div>' : '<span class="muted">None</span>'; }));
      row('Standards named', items.map(function (i) { return i.standards.length ? i.standards.map(function (s) { var d = C.standards.filter(function (x) { return x.id === s; })[0]; return d ? termLink(d.term, d.label) : esc(s); }).join(', ') : '<span class="muted">None</span>'; }));
      row('Age rating', items.map(function (i) { return i.age ? esc(i.age.text) : '<span class="muted">None recorded</span>'; }));
      row('Ships from', items.map(function (i) { return i.products.map(function (p) { return p.ships_from || 'not recorded'; }).filter(function (v, k, a) { return a.indexOf(v) === k; }).join(', '); }));
    }
    main.innerHTML = '<div class="wrap">' + crumbs([['Compare']]) + '<div class="page wide"><h1>Compare products</h1><p class="lede">' + (items.length ? plural(items.length, 'product') + ' side by side; up to four at a time, kept in this browser.' : 'Nothing to compare yet. “Compare” on any product page or quick view adds it here, up to four at a time.') + '</p>' +
      (items.length ? '<div class="cmp"><table><thead><tr><th scope="col"><span class="sr">Attribute</span></th>' + items.map(function (i) {
        return '<th scope="col"><a href="' + U('/p/' + i.id) + '" style="text-decoration:none">' + photo(i) + '<span class="brand" style="display:block;margin-top:8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">' + esc(i.brand) + '</span><span style="font-weight:600">' + esc(i.line) + '</span></a><button type="button" class="rm" data-compare="' + esc(i.id) + '">Remove</button></th>';
      }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '<p><a class="btn" href="' + U('/shop') + '">Shop all products</a></p>') + '</div></div>';
    setNav('compare'); setTitle('Compare');
  }
  function renderNotFound() {
    main.innerHTML = '<div class="wrap"><div class="page"><h1>Page not found</h1><p class="lede">Nothing lives at this address.</p><p><a class="btn" href="' + U('/shop') + '">Shop all products</a></p></div></div>';
    setTitle('Not found');
  }

  // ---------- quick view, lightbox, compare tray ----------
  var qv = document.getElementById('qv'), scrim = document.getElementById('scrim'), qvOpener = null;
  function openQuickView(id, opener) {
    var item = byId(id); if (!item) return;
    var r = status(item);
    qv.innerHTML = '<button type="button" class="ib x" data-qv-close aria-label="Close quick view">' + icon('x') + '</button><div class="qv-in">' + photo(item, true) +
      '<div><p class="eyebrow">' + esc(item.brand) + '</p><h2 id="qv-h">' + esc(item.line) + '</h2><p class="price">' + esc(S.priceLabel(item)) + '</p>' +
      '<p class="muted" style="margin:6px 0 0;font-size:14px">' + (r.ok ? 'Meets your material filters' + (r.unst.length ? ' · ' + plural(r.unst.length, 'detail') + ' not stated' : '') : 'Doesn’t match: ' + esc(missText(item, r))) + '</p>' +
      '<div class="made"><p class="lab">Made with</p><div class="chips-row">' + item.uses.map(chip).join('') + '</div>' + (item.outside.length ? '<p class="lab" style="margin-top:10px">Flagged parts</p><div class="chips-row out">' + item.outside.map(chip).join('') + '</div>' : '') + '</div>' +
      '<ul class="offers">' + item.products.slice(0, 2).map(offerHtml).join('') + '</ul>' +
      '<div class="qv-actions"><a class="btn-2" href="' + U('/p/' + item.id) + '">Full details</a>' + saveBtn(item, 'btn-3') + compareBtn(item) + '</div></div></div>';
    qv.hidden = false; scrim.hidden = false; document.body.classList.add('no-scroll');
    qvOpener = opener || null;
    $('[data-qv-close]', qv).focus();
  }
  function closeQuickView() {
    if (qv.hidden) return;
    qv.hidden = true; scrim.hidden = true; document.body.classList.remove('no-scroll');
    if (qvOpener && document.body.contains(qvOpener)) qvOpener.focus();
    qvOpener = null;
  }
  function openLightbox(src, alt) {
    var lb = document.createElement('div');
    lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', 'Enlarged photo');
    lb.innerHTML = '<button type="button" class="ib x" aria-label="Close">' + icon('x') + '</button><img src="' + esc(src) + '" alt="' + esc(alt || '') + '">';
    document.body.appendChild(lb); document.body.classList.add('no-scroll');
    lb.querySelector('button').focus();
    lb.addEventListener('click', function () { lb.remove(); document.body.classList.remove('no-scroll'); });
  }
  var tray = document.getElementById('tray');
  function renderTray() {
    var items = listGet(CMP_KEY).map(byId).filter(Boolean);
    var onCompare = currentPath() === '/compare';
    if (!items.length || onCompare) { tray.hidden = true; document.body.classList.remove('tray-on'); return; }
    tray.innerHTML = '<div class="tray-in"><p>Compare (' + items.length + '/4)</p><div class="tray-items">' + items.map(function (i) { return '<a href="' + U('/p/' + i.id) + '" aria-label="' + esc(i.brand + ' ' + i.line) + '">' + (i.img ? '<img src="' + esc(asset(i.img)) + '" alt="">' : '') + '</a>'; }).join('') + '</div>' +
      '<a class="btn" href="' + U('/compare') + '">Compare</a><button type="button" class="btn-3" data-compare-clear>Clear</button></div>';
    tray.hidden = false; document.body.classList.add('tray-on');
  }

  // ---------- phone filter drawer (changes wait for Apply) ----------
  function isPhone() { return window.matchMedia('(max-width: 900px)').matches; }
  function openDrawer(focus) {
    var rail = $('#rail'); if (!rail) return;
    document.body.classList.add('drawer-on', 'no-scroll');
    rail.setAttribute('role', 'dialog'); rail.setAttribute('aria-modal', 'true');
    var b = $('[data-drawer-open]'); if (b) b.setAttribute('aria-expanded', 'true');
    if (focus) { var c = $('[data-drawer-close]', rail); if (c) c.focus(); }
  }
  function closeDrawer(focus) {
    if (!document.body.classList.contains('drawer-on')) return;
    document.body.classList.remove('drawer-on', 'no-scroll');
    var rail = $('#rail'); if (rail) { rail.removeAttribute('role'); rail.removeAttribute('aria-modal'); }
    var b = $('[data-drawer-open]'); if (b) { b.setAttribute('aria-expanded', 'false'); if (focus) b.focus(); }
  }
  function trapTab(ev) {
    var box = !qv.hidden ? qv : document.body.classList.contains('drawer-on') ? $('#rail') : null;
    if (!box || ev.key !== 'Tab') return;
    var f = $$('a[href], button:not([disabled]), input, select, summary, [tabindex="0"]', box).filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    else if (!box.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
  }

  // ---------- header: departments menu and search suggestions ----------
  function buildNav() {
    var h = '<div class="menu-x" hidden><button type="button" class="ib" id="menu-close" aria-label="Close menu">' + icon('x') + '</button></div>';
    h += '<div class="cat-item"><a class="cat-a" href="' + U('/shop') + '" data-nav="shop">All products</a></div>';
    C.groups.forEach(function (g) {
      var n = C.items.filter(function (i) { return i.group === g.id; }).length;
      h += '<div class="cat-item" data-dept="' + g.id + '"><button type="button" class="cat-a" data-nav="d:' + g.id + '" aria-expanded="false" aria-haspopup="true">' + esc(g.title) + icon('chev') + '</button>' +
        '<div class="mega"><p>' + esc(g.title) + ' · ' + plural(n, 'product') + '</p><ul>' + g.cats.map(function (id) { var c = C.cats[id], k = C.items.filter(function (i) { return i.cat === id; }).length; return '<li><a href="' + U('/c/' + id) + '">' + esc(c.title) + '<span>' + k + '</span></a></li>'; }).join('') + '</ul>' +
        '<a class="mega-all" href="' + U('/d/' + g.id) + '">Shop all ' + esc(g.title.toLowerCase()) + ' →</a></div></div>';
    });
    h += '<span class="spacer"></span>';
    h += '<div class="cat-item"><a class="cat-a quiet" href="' + U('/brands') + '" data-nav="brands">Brands</a></div>' +
      '<div class="cat-item"><a class="cat-a quiet" href="' + U('/glossary') + '" data-nav="glossary">Glossary</a></div>' +
      '<div class="cat-item"><a class="cat-a quiet" href="' + U('/about') + '" data-nav="about">About</a></div>';
    $('#cats').innerHTML = h;
    $('#foot-shop').innerHTML = '<li><a href="' + U('/shop') + '">All products</a></li>' + C.groups.map(function (g) { return '<li><a href="' + U('/d/' + g.id) + '">' + esc(g.title) + '</a></li>'; }).join('');
    $('#foot-brands').innerHTML = brandList().sort(function (a, b) { return b.items.length - a.items.length; }).slice(0, 6).map(function (b) { return '<li><a href="' + U('/b/' + b.id) + '">' + esc(b.name) + '</a></li>'; }).join('') + '<li><a href="' + U('/brands') + '">All brands →</a></li>';
    $$('a[data-link]').forEach(function (a) { a.href = U(a.getAttribute('href')); });
  }
  function closeMegas(except) {
    $$('#cats .cat-item.open').forEach(function (d) { if (d !== except) { d.classList.remove('open'); var b = $('.cat-a', d); if (b) b.setAttribute('aria-expanded', 'false'); } });
  }
  function openMenu() { $('#menu').classList.add('open'); $('#menu-open').setAttribute('aria-expanded', 'true'); $('.menu-x').hidden = false; document.body.classList.add('no-scroll'); $('#menu-close').focus(); }
  function closeMenu(focus) { var m = $('#menu'); if (!m.classList.contains('open')) return; m.classList.remove('open'); $('#menu-open').setAttribute('aria-expanded', 'false'); $('.menu-x').hidden = true; document.body.classList.remove('no-scroll'); closeMegas(); if (focus) $('#menu-open').focus(); }
  var hoverT = null;
  document.addEventListener('mouseover', function (ev) {
    if (isPhone()) return;
    var item = ev.target.closest && ev.target.closest('#cats .cat-item[data-dept]');
    clearTimeout(hoverT);
    if (item) { closeMegas(item); item.classList.add('open'); $('.cat-a', item).setAttribute('aria-expanded', 'true'); }
    else if (!ev.target.closest('#cats')) hoverT = setTimeout(closeMegas, 200);
  });
  document.addEventListener('mouseleave', function () { if (!isPhone()) hoverT = setTimeout(closeMegas, 200); }, true);

  var sugg = document.getElementById('sugg'), qInput = document.getElementById('q'), suggT = null;
  function suggestions(q) {
    var f = S.fold(q.trim());
    if (f.length < 2) { closeSugg(); return; }
    var out = [];
    C.items.filter(function (i) { return matchesQuery(i, q); }).slice(0, 4).forEach(function (i) {
      out.push('<a href="' + U('/p/' + i.id) + '" role="option">' + (i.img ? '<img class="sg-img" src="' + esc(asset(i.img)) + '" alt="">' : '<span class="sg-img"></span>') + '<span>' + esc(i.brand) + ' ' + esc(i.line) + '</span><span class="sg-p">' + esc(S.priceFrom(i)) + '</span></a>');
    });
    brandList().filter(function (b) { return S.fold(b.name).indexOf(f) >= 0; }).slice(0, 3).forEach(function (b) { out.push('<a href="' + U('/b/' + b.id) + '" role="option"><span class="sg-k">Brand</span>' + esc(b.name) + '</a>'); });
    Object.keys(C.cats).map(function (k) { return C.cats[k]; }).filter(function (c) { return S.fold(c.title).indexOf(f) >= 0; }).slice(0, 3).forEach(function (c) { out.push('<a href="' + U('/c/' + c.id) + '" role="option"><span class="sg-k">Type</span>' + esc(c.title) + '</a>'); });
    S.MATERIALS.filter(function (m) { return S.fold(m.label).indexOf(f) >= 0; }).slice(0, 2).forEach(function (m) { out.push('<a href="' + U('/shop', { mat: m.id }) + '" role="option"><span class="sg-k">Made with</span>' + esc(m.label) + '</a>'); });
    if (GLOSS) Object.keys(TERMS).filter(function (k) { return S.fold(TERMS[k].term).indexOf(f) >= 0; }).slice(0, 2).forEach(function (k) { out.push('<a href="' + U('/glossary/' + k) + '" role="option"><span class="sg-k">Glossary</span>' + esc(TERMS[k].term) + '</a>'); });
    out.push('<a href="' + U('/search', { q: q.trim() }) + '" role="option"><span class="sg-k">Search</span>See all results for “' + esc(q.trim()) + '”</a>');
    sugg.innerHTML = out.join('');
    sugg.hidden = false; qInput.setAttribute('aria-expanded', 'true');
  }
  function closeSugg() { sugg.hidden = true; qInput.setAttribute('aria-expanded', 'false'); }

  // ---------- router ----------
  function route() {
    closeSugg(); closeQuickView(); closeDrawer(false); closeMenu(false); closePop(false); PEND = null;
    var path = currentPath(), q = parseQuery(location.search), p = path.split('/').filter(Boolean), key = p[0] || '';
    var url = location.pathname + location.search;
    if (key === '') renderHome();
    else if (key === 'shop') { STATE = readState('shop', '', q); pageShown = PAGE; renderList(); }
    else if (key === 'd' && groupOf(p[1])) { STATE = readState('dept', p[1], q); pageShown = PAGE; renderList(); }
    else if (key === 'c' && catOf(p[1])) { STATE = readState('cat', p[1], q); pageShown = PAGE; renderList(); }
    else if (key === 'b' && C.brands[p[1]]) { STATE = readState('brand', p[1], q); pageShown = PAGE; renderList(); }
    else if (key === 'search') { STATE = readState('search', '', q); pageShown = PAGE; renderList(); }
    else if (key === 'p' && p[1]) renderProduct(decodeURIComponent(p[1]));
    else if (key === 'brands') renderBrands();
    else if (key === 'glossary') renderGlossary(p[1]);
    else if (key === 'about') renderAbout();
    else if (key === 'saved') renderSaved();
    else if (key === 'compare') renderCompare();
    else renderNotFound();
    if (key !== 'p' && key !== 'search' && !(key === 'shop' && q.q)) qInput.value = '';
    if (url in scrollMem && !(key === 'glossary' && p[1])) { window.scrollTo(0, scrollMem[url]); delete scrollMem[url]; }
    else if (!(key === 'glossary' && p[1]) && !location.hash) window.scrollTo(0, 0);
    lastUrl = url;
    badgeCounts();
    toTop.hidden = window.scrollY < 800;
  }
  function rerender() {
    var key = currentPath().split('/').filter(Boolean)[0] || '';
    if (key === 'p') {
      var open = $$('.acc').map(function (d, i) { return d.open ? i : -1; }); // keep the accordions as the visitor left them
      renderProduct(decodeURIComponent(currentPath().split('/')[2]), true);
      $$('.acc').forEach(function (d, i) { d.open = open[i] >= 0; });
    }
    else if (STATE && ['shop', 'd', 'c', 'b', 'search'].indexOf(key) >= 0) { STATE.crit = Object.assign({}, CRIT); STATE.strict = STRICT; setState(STATE); }
    else if (key === 'compare') renderCompare();
    else if (key === 'saved') renderSaved();
    else if (key === '') renderHome();
  }
  // Old links (#/p/<id>, #/?cat=balls, #/glossary/<term>) still arrive; map them onto the new paths.
  function legacyHash() {
    var h = location.hash;
    if (!/^#\//.test(h)) return null;
    var rest = h.slice(2), qi = rest.indexOf('?'), path = qi >= 0 ? rest.slice(0, qi) : rest, q = parseQuery(qi >= 0 ? rest.slice(qi + 1) : '');
    var parts = path.split('/').filter(Boolean);
    if (parts[0] === 'p') return U('/p/' + parts[1]);
    if (parts[0] === 'brands' || parts[0] === 'about') return U('/' + parts[0]);
    if (parts[0] === 'glossary') return U('/glossary' + (parts[1] ? '/' + parts[1] : ''));
    if (q.dept && !q.cat) { var d = q.dept; delete q.dept; return U('/d/' + d, q); }
    if (q.misses) { delete q.misses; q.all = '1'; }
    return Object.keys(q).length ? U('/shop', q) : U('/');
  }

  // ---------- events ----------
  function toggleIn(arr, v) { var i = arr.indexOf(v), out = arr.slice(); if (i >= 0) out.splice(i, 1); else out.push(v); return out; }
  function editing() { return document.body.classList.contains('drawer-on') ? (PEND || (PEND = copyState())) : copyState(); }
  function commit(st) {
    if (document.body.classList.contains('drawer-on')) { PEND = st; renderList(true); }
    else { PEND = null; setState(st, true); }
  }
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.matches('[data-facet]')) {
      var st = editing(), f = t.getAttribute('data-facet');
      st[f] = toggleIn(st[f], t.value);
      commit(st);
    } else if (t.matches('[data-crit]')) {
      var id = t.getAttribute('data-crit');
      if (STATE && $('#rail')) {
        var s2 = editing();
        if (id === 'strict') s2.strict = t.checked; else s2.crit[id] = t.checked;
        commit(s2);
      } else {
        if (id === 'strict') STRICT = t.checked; else CRIT[id] = t.checked;
        savePref(); rerender();
      }
    } else if (t.id === 'sort') {
      var s3 = copyState(); s3.sort = t.value; PEND = null; setState(s3, true);
    }
  });
  document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (d.matches && d.matches('details.fgroup')) openGroups[d.getAttribute('data-group')] = d.open;
  }, true);
  document.addEventListener('input', function (ev) {
    if (ev.target.id === 'brand-find') filterBrandList(ev.target.value);
    if (ev.target.id === 'q') {
      var v = ev.target.value;
      clearTimeout(suggT);
      suggT = setTimeout(function () {
        suggestions(v);
        // On a listing page the results follow the typing; elsewhere Enter opens the search page.
        if (STATE && $('#grid, .empty-state') && (STATE.kind === 'search' || STATE.kind === 'shop') && v.trim() !== STATE.q) { var st = copyState(); st.q = v.trim(); PEND = null; setState(st); }
      }, 180);
    }
  });
  $('#searchform').addEventListener('submit', function (ev) {
    ev.preventDefault(); clearTimeout(suggT); closeSugg();
    var v = qInput.value.trim();
    if (!v) return;
    go(U('/search', { q: v }));
    qInput.blur();
  });
  qInput.addEventListener('focus', function () { if (sugg.innerHTML && qInput.value.trim().length >= 2) { sugg.hidden = false; qInput.setAttribute('aria-expanded', 'true'); } });
  qInput.addEventListener('keydown', function (ev) {
    if (sugg.hidden) return;
    var opts = $$('a', sugg), i = opts.findIndex(function (a) { return a.classList.contains('on'); });
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault(); i = ev.key === 'ArrowDown' ? Math.min(i + 1, opts.length - 1) : Math.max(i - 1, 0);
      opts.forEach(function (a, k) { a.classList.toggle('on', k === i); });
    } else if (ev.key === 'Enter' && i >= 0) { ev.preventDefault(); go(opts[i].getAttribute('href')); }
  });

  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[href]');
    // Internal links render in place; everything else is left to the browser.
    if (a && !a.hasAttribute('data-term') && !a.closest('.glossary') && a.origin === location.origin && a.pathname.indexOf(BASE_PATH) === 0 && !a.target && !a.hasAttribute('download') && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey && ev.button === 0) {
      if (a.hasAttribute('data-jump')) {
        ev.preventDefault(); var el = document.getElementById(a.getAttribute('data-jump'));
        if (el) { if (el.tagName === 'DETAILS') el.open = true; el.scrollIntoView(); el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
        return;
      }
      if (a.getAttribute('href').charAt(0) === '#') return;
      ev.preventDefault();
      if (!ev.target.closest('.search')) closeSugg();
      go(a.pathname + a.search + a.hash);
      return;
    }
    if (!ev.target.closest('.search')) closeSugg();
    var t = ev.target.closest('button, a');
    if (!t) { if (!ev.target.closest('#cats')) closeMegas(); return; }
    if (t.matches('[data-clear]')) {
      var st = copyState(), f = t.getAttribute('data-clear'), v = t.getAttribute('data-val');
      if (f === 'q') st.q = ''; else if (f === 'crit') { if (v === 'strict') st.strict = false; else st.crit[v] = false; } else st[f] = st[f].filter(function (x) { return x !== v; });
      PEND = null; setState(st, true);
    } else if (t.matches('[data-clear-all]')) {
      var s0 = readState(STATE.kind, STATE.key, STATE.kind === 'search' ? { q: STATE.q } : {}); s0.sort = STATE.sort; s0.all = STATE.all; s0.crit = defaults(); s0.strict = false;
      PEND = null; setState(s0, true);
    } else if (t.matches('[data-crit-reset]')) {
      ev.preventDefault();
      var s4 = editing(), d = critIsDefault(s4.crit, s4.strict);
      C.criteria.forEach(function (c) { s4.crit[c.id] = d ? false : !!c['default']; }); s4.strict = false;
      commit(s4);
    } else if (t.matches('[data-toggle-all]')) {
      var s1 = copyState(); s1.all = !s1.all; PEND = null; setState(s1, true);
    } else if (t.matches('[data-more]')) {
      pageShown += PAGE; var n = $$('#grid .card').length; renderList(false);
      var cards = $$('#grid .card'); if (cards[n]) { var l = $('.card-link', cards[n]); if (l) l.focus({ preventScroll: true }); }
    } else if (t.matches('[data-more-opts]')) {
      var w = t.previousElementSibling; if (w) { w.hidden = false; w.setAttribute('data-shown', '1'); } t.hidden = true;
    } else if (t.matches('[data-drawer-open]')) {
      PEND = copyState(); openDrawer(true);
    } else if (t.matches('[data-drawer-close]')) {
      PEND = null; closeDrawer(true); renderList(false);
    } else if (t.matches('[data-drawer-apply]')) {
      var p2 = PEND; PEND = null; closeDrawer(true); if (p2) setState(p2, true);
    } else if (t.matches('[data-save]')) {
      listToggle(SAVED_KEY, t.getAttribute('data-save'));
      var on = listGet(SAVED_KEY).indexOf(t.getAttribute('data-save')) >= 0;
      $$('[data-save="' + t.getAttribute('data-save') + '"]').forEach(function (b) { b.setAttribute('aria-pressed', on); var s = b.querySelector('span'); if (s) s.textContent = on ? 'Saved' : 'Save'; b.setAttribute('aria-label', (on ? 'Remove from saved: ' : 'Save: ') + b.getAttribute('aria-label').replace(/^(Remove from saved|Save): /, '')); });
      announce(on ? 'Saved' : 'Removed from saved'); badgeCounts();
      if (currentPath() === '/saved') renderSaved();
    } else if (t.matches('[data-compare]')) {
      var cid = t.getAttribute('data-compare');
      if (!listToggle(CMP_KEY, cid, 4)) { announce('Compare holds four products; remove one first.'); t.textContent = 'Compare is full (4)'; return; }
      var inC = listGet(CMP_KEY).indexOf(cid) >= 0;
      $$('[data-compare="' + cid + '"]').forEach(function (b) { b.setAttribute('aria-pressed', inC); var s = b.querySelector('span'); if (s) s.textContent = inC ? 'In compare' : 'Compare'; });
      announce(inC ? 'Added to compare' : 'Removed from compare'); badgeCounts();
      if (currentPath() === '/compare') renderCompare();
    } else if (t.matches('[data-compare-clear]')) {
      store(CMP_KEY, []); badgeCounts(); if (currentPath() === '/compare') renderCompare();
    } else if (t.matches('[data-qv]')) {
      openQuickView(t.getAttribute('data-qv'), t);
    } else if (t.matches('[data-qv-close]')) {
      closeQuickView();
    } else if (t.matches('[data-zoom]')) {
      openLightbox(t.getAttribute('data-zoom'), $('img', t) && $('img', t).alt);
    } else if (t.id === 'menu-open') {
      openMenu();
    } else if (t.id === 'menu-close') {
      closeMenu(true);
    } else if (t.matches('#cats .cat-item[data-dept] > .cat-a')) {
      var item = t.parentNode, was = item.classList.contains('open');
      closeMegas(); if (!was) { item.classList.add('open'); t.setAttribute('aria-expanded', 'true'); }
    } else if (t.id === 'totop') {
      window.scrollTo({ top: 0, behavior: 'smooth' }); main.focus({ preventScroll: true });
    }
  });
  scrim.addEventListener('click', closeQuickView);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      if (!sugg.hidden) closeSugg();
      else if ($('.lightbox')) { $('.lightbox').remove(); document.body.classList.remove('no-scroll'); }
      else if (!qv.hidden) closeQuickView();
      else if (document.body.classList.contains('drawer-on')) { PEND = null; closeDrawer(true); renderList(false); }
      else if ($('#menu').classList.contains('open')) closeMenu(true);
      else if ($$('#cats .cat-item.open').length) closeMegas();
    }
    trapTab(ev);
  });
  var toTop = document.getElementById('totop');
  window.addEventListener('scroll', function () { toTop.hidden = window.scrollY < 800; }, { passive: true });
  window.addEventListener('popstate', function () { if (lastUrl !== null) scrollMem[lastUrl] = window.scrollY; route(); });

  // ---------- glossary popover ----------
  var pop = document.getElementById('gpop'), cur = null, popT = null;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function place(a) {
    var r = a.getBoundingClientRect(), w = pop.offsetWidth, vw = document.documentElement.clientWidth;
    var left = Math.min(Math.max(16, r.left + window.scrollX), window.scrollX + vw - w - 16);
    var below = r.bottom + 8 + pop.offsetHeight < window.innerHeight || r.top < pop.offsetHeight + 80;
    pop.style.left = left + 'px';
    pop.style.top = (below ? r.bottom + window.scrollY + 8 : r.top + window.scrollY - pop.offsetHeight - 8) + 'px';
  }
  function openPop(a, id, also) {
    var g = TERMS[id]; if (!g) return;
    var others = (also || []).filter(function (k) { return TERMS[k] && k !== id; });
    pop.innerHTML = '<button type="button" class="x" aria-label="Close">&times;</button><h4 id="gpop-h">' + esc(g.term) + '</h4><p>' + esc(g.definition) + '</p>' +
      (g.on_this_site ? '<p class="lab">On this site</p><p>' + esc(g.on_this_site) + '</p>' : '') +
      '<p class="gpop-links"><a class="more" href="' + U('/glossary/' + id) + '">Full entry and sources →</a>' +
      (others.length ? '<span class="also">Also here: ' + others.map(function (k) { return '<a href="' + U('/glossary/' + k) + '" data-term="' + k + '" data-also="' + [id].concat(others).join(',') + '">' + esc(TERMS[k].term) + '</a>'; }).join(', ') + '</span>' : '') + '</p>';
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
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !pop.hidden) closePop(true); });
  if (fine) {
    document.addEventListener('mouseover', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[data-term]');
      clearTimeout(popT);
      if (a && a !== cur && !a.closest('#gpop') && TERMS[a.getAttribute('data-term')] && !a.closest('.glossary')) popT = setTimeout(function () { openPop(a, a.getAttribute('data-term'), alsoOf(a)); a.removeAttribute('data-click'); }, 250);
      else if (!a && !ev.target.closest('#gpop') && cur && !pop.hidden && cur.getAttribute('data-click') !== '1') popT = setTimeout(function () { closePop(false); }, 300);
    });
  }
  window.addEventListener('resize', function () { if (cur && !pop.hidden) place(cur); });

  // ---------- boot ----------
  function inline(id) { var el = document.getElementById(id); return el ? JSON.parse(el.textContent) : null; }
  function get(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  function useGlossary(g) {
    GLOSS = g;
    if (GLOSS) GLOSS.sections.forEach(function (s) { s.terms.forEach(function (t) { TERMS[t.id] = t; }); });
    var key = currentPath().split('/').filter(Boolean)[0] || '';
    if (key === 'p') {
      var open = $$('.acc').map(function (d, i) { return d.open ? i : -1; }); // keep the accordions as the visitor left them
      renderProduct(decodeURIComponent(currentPath().split('/')[2]), true);
      $$('.acc').forEach(function (d, i) { d.open = open[i] >= 0; });
    }
    else if (key === 'glossary') renderGlossary(currentPath().split('/')[2]);
    else if (key === '') renderHome();
    else if (STATE) renderList(true);
  }
  if (isPhone()) qInput.placeholder = 'Search';
  var data = inline('sbtt-data'), gloss = inline('sbtt-glossary');
  (data ? Promise.resolve(data) : get(asset('data.json'))).then(function (d) {
    C = S.build(d);
    loadPref();
    buildNav();
    // A deep link arrives from 404.html as ?p=/c/balls; an old link as #/p/<id>. Put the real address back.
    var q0 = parseQuery(location.search);
    if (q0.p) { try { history.replaceState(null, '', U(q0.p.replace(/^\//, ''))); } catch (e) {} }
    else { var lh = legacyHash(); if (lh) { try { history.replaceState(null, '', lh); } catch (e) {} } }
    route();
    if (gloss) useGlossary(gloss);
    else get(asset('glossary.json')).then(useGlossary, function () { useGlossary(null); });
  }).catch(function (e) {
    main.innerHTML = '<div class="wrap"><div class="page"><h1>Couldn’t load the catalog</h1><p>' + esc(e.message) + '</p></div></div>';
  });
})();
