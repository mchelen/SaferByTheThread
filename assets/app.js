/* Saved by the Thread: storefront front end. Pages render in the browser from data.json; URLs are clean paths
   under the site's base (GitHub Pages serves 404.html for them, which hands the path back to this script):
     /                home                 /shop            every product, with filters in the query string
     /a/<aisle>       an aisle (menu)      /c/<type>        a product type        /b/<brand>   a brand
     /m               every material       /m/<material>    one material, or a family such as Natural fibres
     /search?q=       search results       /p/<id>          a product page
     /brands  /glossary[/<term>]  /about  /saved  /compare
   Filters in the query string: q, cat, brand, price, deliv (shipping), mat, std, age, ship, sort, all (show items the material
   filters exclude), m (material criteria that are on, when they differ from the defaults), strict. */
(function () {
  'use strict';
  var S = window.SBTT;
  var main = document.getElementById('main');
  var live = document.getElementById('live');
  var C, TERMS = {}, GLOSS = null, CRIT = {}, STRICT = false;
  var PREF_KEY = 'sbtt-filters-3', SAVED_KEY = 'sbtt-saved', CMP_KEY = 'sbtt-compare', RECENT_KEY = 'sbtt-recent';
  var FACETS = ['cat', 'brand', 'price', 'deliv', 'mat', 'std', 'age', 'ship'];
  var DELIV = [{ id: 'free', label: 'Free shipping' }, { id: 'paid', label: 'Shipping cost stated' }, { id: 'unknown', label: 'Free over a minimum, at checkout or not recorded' }];
  var PAGE = 24;
  var openGroups = { mat: true, tested: false, cat: true, age: true, price: true, brand: false, ship: false, deliv: false };
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
  // Materials a visitor can pick under Made with; plastic is left to the Leave out filters.
  function pickMaterials() { return S.MATERIALS.filter(function (m) { return m.id !== 'synthetic'; }); }
  function pickIds() { return pickMaterials().map(function (m) { return m.id; }); }
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
    // mat= in a link lists the materials included ("/shop?mat=wood" is wood only); the state keeps the ones left out.
    st.mat = q.mat ? pickIds().filter(function (id) { return st.mat.indexOf(id) < 0; }) : [];
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
      if (f === 'mat') { if (st.mat.length) q.mat = pickIds().filter(function (id) { return st.mat.indexOf(id) < 0; }).join(',') || 'none'; return; }
      if (st[f].length) q[f] = st[f].join(',');
    });
    if (st.sort && st.sort !== 'featured') q.sort = st.sort;
    if (st.all) q.all = '1';
    if (!critIsDefault(st.crit, st.strict)) { q.m = C.criteria.filter(function (c) { return st.crit[c.id]; }).map(function (c) { return c.id; }).join(',') || 'none'; if (st.strict) q.strict = '1'; }
    var path = st.kind === 'cat' ? '/c/' + st.key : st.kind === 'dept' ? '/a/' + st.key : st.kind === 'mat' ? '/m/' + st.key : st.kind === 'brand' ? '/b/' + st.key : st.kind === 'search' ? '/search' : '/shop';
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
      case 'age': return item.ageBands;
      case 'ship': return item.ships;
      case 'deliv': return [item.deliv];
      case 'price':
        return S.PRICE_BANDS.filter(function (b) { return item.min != null && item.min < b.max && (item.max == null ? item.min : item.max) >= b.min; })
          .map(function (b) { return b.id; }).concat(item.min == null ? ['none'] : []);
    }
    return [];
  }
  function matchesFacet(item, f, st) {
    if (!st[f].length) return true;
    var v = facetValues(item, f);
    // Materials: nothing the visitor left out, and at least one they kept (a listing with none recorded can't be judged).
    if (f === 'mat') {
      if (v.some(function (x) { return st.mat.indexOf(x) >= 0; })) return false;
      var inc = pickIds().filter(function (id) { return st.mat.indexOf(id) < 0; });
      return !v.length || v.some(function (x) { return inc.indexOf(x) >= 0; });
    }
    if (f === 'std') return st[f].every(function (x) { return v.indexOf(x) >= 0; });
    return st[f].some(function (x) { return v.indexOf(x) >= 0; });
  }
  function matchesQuery(item, q) {
    if (!q) return true;
    return S.fold(q).split(/\s+/).filter(Boolean).every(function (w) { return item.q.indexOf(w) >= 0; });
  }
  function inScope(item, st) {
    if (st.kind === 'mat') { var sc = matScope(st.key); return !!sc && hasMat(item, sc.ids); }
    return st.kind !== 'dept' || item.aisles.indexOf(st.key) >= 0;
  }
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
      total: function (a, b) { var x = a.total != null ? a.total : a.min, y = b.total != null ? b.total : b.min; return (x == null) - (y == null) || x - y || a.n - b.n; },
      'price-desc': function (a, b) { return (a.min == null) - (b.min == null) || b.min - a.min || a.n - b.n; },
      brand: function (a, b) { return S.fold(a.brand).localeCompare(S.fold(b.brand)) || a.n - b.n; },
      name: function (a, b) { return S.fold(a.line).localeCompare(S.fold(b.line)) || a.n - b.n; },
      stated: function (a, b) { return a.unstatedCount - b.unstatedCount || a.n - b.n; }
    }[how] || function (a, b) { return a.n - b.n; };
    return list.slice().sort(by);
  }
  var SORTS = [['featured', 'Featured'], ['price-asc', 'Price: low to high'], ['total', 'Price + shipping: low to high'], ['price-desc', 'Price: high to low'],
               ['brand', 'Brand: A to Z'], ['name', 'Name: A to Z'], ['stated', 'Fewest unstated materials']];

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
    filterBadge();
    renderTray();
  }
  // The header's Filters button counts what differs from the default filters, plus this page's ticked facets.
  function onListing() { return ['shop', 'a', 'c', 'b', 'm', 'search'].indexOf(currentPath().split('/').filter(Boolean)[0] || '') >= 0 && !!STATE && currentPath() !== '/m'; }
  function filterBadge() {
    var st = onListing() ? (PEND || STATE) : null, d = defaults(), crit = st ? st.crit : CRIT, n = (st ? st.strict : STRICT) ? 1 : 0;
    C.criteria.forEach(function (c) { if (!!crit[c.id] !== d[c.id]) n++; });
    if (st) FACETS.forEach(function (f) { if (!((f === 'cat' && st.kind === 'cat') || (f === 'brand' && st.kind === 'brand'))) n += st[f].length; });
    $('#filters-n').textContent = n; $('#filters-n').hidden = !n;
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
  // Product page photos: the first large, the rest as thumbnails that swap into the main frame.
  function gallery(item) {
    if (!item.photos.length) return '<div class="gallery">' + photo(item, true) + '</div>';
    var alt = item.brand + ' ' + item.line, src = item.products[0] ? ' from ' + esc(item.products[0].store) : '';
    return '<div class="gallery"><button type="button" class="ph-zoom" data-zoom="' + esc(asset(item.photos[0])) + '" aria-label="Enlarge photo" style="all:unset;display:block;position:relative;cursor:zoom-in">' +
      '<div class="ph"><img id="g-main" src="' + esc(asset(item.photos[0])) + '" alt="' + esc(alt) + '" width="640" height="800" decoding="async" fetchpriority="high"></div><span class="zoom-hint">' + icon('zoom') + 'Enlarge</span></button>' +
      (item.photos.length > 1 ? '<div class="thumbs" role="group" aria-label="Photos">' + item.photos.map(function (p, k) {
        return '<button type="button" class="thumb" data-photo="' + esc(asset(p)) + '" aria-pressed="' + (k === 0) + '" aria-label="Photo ' + (k + 1) + ' of ' + item.photos.length + '"><img src="' + esc(asset(p)) + '" alt="" loading="lazy" decoding="async"></button>';
      }).join('') + '</div>' : '') +
      '<p class="img-src">' + (item.photos.length > 1 ? item.photos.length + ' store photos' : 'Store photo') + src + '.</p></div>';
  }
  // How a listing reads against the visitor's material filters. A miss names what the listing has that a filter
  // hides, one line each. Otherwise one "Not stated" line names the parts no page describes (the filter itself when
  // the listing doesn't say which part), else all materials are stated. Cards show the first and a count.
  function factText(item, c) {
    var l = c.label.charAt(0).toLowerCase() + c.label.slice(1), f = item.facts[c.id];
    if (c.kind === 'contains') return 'Has ' + l;
    if (f === 'unknown') return 'Not stated: ' + (c.kind === 'avoid' ? 'any ' : '') + l;
    return (c.kind === 'require' ? 'Not ' : 'Has ') + l;
  }
  function lc(t) { return /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
  function unstatedParts(item, list) {
    var out = [];
    list.forEach(function (c) {
      (item.unstated[c.id] || [(c.kind === 'avoid' ? 'any ' : '') + lc(c.label)]).forEach(function (p) { p = lc(p); if (out.indexOf(p) < 0) out.push(p); });
    });
    return out;
  }
  function fitP(cls, mk, text) { return '<p class="fit ' + cls + '"><span class="mk" aria-hidden="true">' + mk + '</span>' + esc(text) + '</p>'; }
  function fitLine(item, r, max) {
    if (r.ok && !r.unst.length) return '';
    if (r.ok) {
      var p = unstatedParts(item, r.unst);
      return fitP('is-unk', '?', 'Not stated: ' + (max && p.length > max ? p.slice(0, max).join(' · ') + ' (+' + (p.length - max) + ' more)' : p.join(' · ')));
    }
    var t = r.miss.map(function (c) { return factText(item, c); });
    if (max && t.length > max) t = t.slice(0, max - 1).concat([t[max - 1] + ' (+' + (t.length - max) + ' more)']);
    return t.map(function (x) { return fitP('is-miss', '✕', x); }).join('');
  }
  // Stars filled to the rating, the number, and the review count; the store it came from is in the label.
  function storeName(s) { return s.replace(/\s*\(.*\)$/, ''); }
  function stars(r, long) {
    var v = (Math.round(r.value * 10) / 10).toFixed(1), label = v + ' out of 5 stars from ' + plural(r.count, 'review') + ' at ' + storeName(r.store);
    return '<p class="rating" role="img" aria-label="' + esc(label) + '" title="' + esc(label) + '"><span class="stars" style="--rv:' + r.value + '" aria-hidden="true">★★★★★</span>' +
      '<span class="r-v" aria-hidden="true">' + v + '</span><span class="r-n" aria-hidden="true">' + (long ? esc(plural(r.count, 'review')) + ' at ' + esc(storeName(r.store)) : '(' + r.count.toLocaleString('en-US') + ')') + '</span></p>';
  }
  function card(item, i, crit, strict) {
    var r = status(item, crit, strict);
    var mats = item.materials.slice(0, 3).map(matLabel);
    var badges = [];
    if (item.products.length > 1) badges.push('<span class="badge soft">' + (storeCount(item) > 1 ? storeCount(item) + ' stores' : item.products.length + ' options') + '</span>');
    return '<article class="card' + (r.ok ? '' : ' is-miss') + '" data-id="' + esc(item.id) + '">' +
      '<a class="card-link" href="' + U('/p/' + item.id) + '">' + photo(item, i != null && i < 4) +
      '<div class="ph-badges">' + badges.join('') + '</div>' +
      '<div class="card-body"><p class="brand">' + esc(item.brand) + '</p><h3>' + esc(item.line) + '</h3>' +
      (item.rating ? stars(item.rating) : '') +
      '<p class="mats">' + esc(mats.join(' · ') || 'Materials on the product page') + '</p>' +
      '<p class="price">' + esc(S.priceFrom(item)) + '</p>' +
      '<p class="ship' + (item.deliv === 'free' ? ' is-free' : '') + '">' + esc(item.shipLine) + '</p>' +
      fitLine(item, r, 1) +
      '</div></a>' + (offersOf(item)[0] ? '<a class="btn-buy sm card-buy" href="' + esc(offersOf(item)[0].url) + '" target="_blank" rel="noopener" aria-label="' + buyText(offersOf(item)[0]) + ': ' + esc(item.brand + ' ' + item.line) + ' (opens the store)" title="' + buyText(offersOf(item)[0]) + '">Buy at store' + icon('ext') + '</a>' : '') + saveBtn(item) +
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
  var toastEl = document.getElementById('toast'), toastT = null;
  function toast(html) {
    clearTimeout(toastT);
    toastEl.innerHTML = html; toastEl.hidden = false;
    toastT = setTimeout(function () { toastEl.hidden = true; }, 4000);
  }
  // The phone share sheet where there is one, otherwise the link goes to the clipboard.
  function shareLink(url, title) {
    if (navigator.share && isPhone()) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
    var done = function () { toast('Link copied. Paste it anywhere to share.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link', url); });
    else window.prompt('Copy this link', url);
  }
  function idsParam() { var q = parseQuery(location.search); return q.ids ? q.ids.split(',').filter(Boolean) : null; }
  function announce(text) { if (live) { live.textContent = ''; setTimeout(function () { live.textContent = text; }, 50); } }
  function setTitle(t) { document.title = (t ? t + ' · ' : '') + 'Saved by the Thread'; }
  function setNav(kind, key) {
    $$('#cats .cat-a').forEach(function (a) {
      var d = a.getAttribute('data-nav');
      var on = d === kind || (kind === 'dept' && d === 'd:' + key) || (kind === 'cat' && C.cats[key] && d === 'd:' + C.cats[key].group) || (kind === 'product' && d === 'd:' + key) || ((kind === 'mat' || kind === 'materials') && d === 'materials');
      a.classList.toggle('on', !!on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  // ---------- home ----------
  // The home page navigates by pictures, like a shop: category tiles, age chips, then a row of round product-type
  // tiles per category. Categories and types come from data.json (C.groups and C.cats), so the page follows the
  // taxonomy without changes here.
  function typePic(id) {
    var items = C.items.filter(function (i) { return i.cat === id && i.img; });
    return items.filter(function (i) { return status(i).ok; })[0] || items[0] || null;
  }
  function groupPic(g) {
    var items = C.items.filter(function (i) { return i.aisles.indexOf(g.id) >= 0 && i.img; });
    return items.filter(function (i) { return status(i).ok; })[0] || items[0] || null;
  }
  // `pool` limits the photos to those items, and `within` sends each tile to that page filtered to the type instead of
  // to the type's own page (a material page's types stay on the material page and show that material).
  function typeTiles(ids, cls, current, query, pool, within) {
    var sorted = ids.slice().sort(function (x, y) { return typeCount(y) - typeCount(x); });
    return '<div class="ttiles' + (cls ? ' ' + cls : '') + '">' + sorted.map(function (id) {
      var c = C.cats[id], pic = pool && pool.filter(function (i) { return i.cat === id && i.img; })[0] || typePic(id);
      return '<a class="ttile' + (id === current ? ' on' : '') + '" href="' + (within ? U(within, id === current ? null : { cat: id }) : U('/c/' + id, query)) + '"' + (id === current ? ' aria-current="page"' : '') + '><span class="ttile-img">' + (pic ? '<img src="' + esc(asset(pic.img)) + '" alt="" decoding="async">' : '<span class="ttile-ph" aria-hidden="true">' + esc((c.short || c.title).charAt(0)) + '</span>') + '</span>' +
        '<span class="ttile-t">' + esc(c.short || c.title) + '</span></a>';
    }).join('') + '</div>';
  }
  function typeCount(id) { return C.items.filter(function (i) { return i.cat === id; }).length; }
  function liveGroups() { return C.groups.filter(function (g) { return g.cats.some(function (id) { return typeCount(id) > 0; }); }); }
  function liveTypes() { return Object.keys(C.cats).filter(function (id) { return typeCount(id) > 0; }); }
  function aisleTiles(groups) {
    return '<div class="tiles">' + (groups || liveGroups()).map(function (g) {
      var pic = groupPic(g);
      return '<a class="tile" href="' + U('/a/' + g.id) + '"><span class="tile-img">' + (pic ? '<img src="' + esc(asset(pic.img)) + '" alt="" decoding="async">' : '') + '</span>' +
        '<span class="tile-t">' + esc(g.title) + '</span></a>';
    }).join('') + '</div>';
  }
  // Materials are a way in, like categories: Natural fibres and each material a visitor can pick, with a page each
  // (/m/<id>) that opens into kinds of that material (Wood > Solid wood, FSC wood) and the product types made with it.
  function matScope(key) {
    var g = S.MATERIAL_GROUPS.filter(function (x) { return x.id === key; })[0];
    if (g) return { id: g.id, label: g.label, group: true, ids: pickMaterials().filter(function (m) { return m.group === g.id; }).map(function (m) { return m.id; }) };
    var m = pickMaterials().filter(function (x) { return x.id === key; })[0];
    return m ? { id: m.id, label: m.label, ids: [m.id] } : null;
  }
  function hasMat(item, ids) { return item.materials.some(function (x) { return ids.indexOf(x) >= 0; }); }
  function matItems(sc) { return C.items.filter(function (i) { return hasMat(i, sc.ids); }); }
  // A photo for a material: a listing that meets the filters and is made of the fewest materials, so the picture is
  // mostly that material; `used` keeps a row of tiles from showing the same photo twice.
  function matPic(sc, test, used) {
    var items = matItems(sc).filter(function (i) { return i.img && (!test || test(i)); })
      .sort(function (a, b) { return (status(b).ok - status(a).ok) || (a.materials.length - b.materials.length) || a.n - b.n; });
    var pic = items.filter(function (i) { return !used || used.indexOf(i.img) < 0; })[0] || items[0] || null;
    if (pic && used) used.push(pic.img);
    return pic;
  }
  // Natural fibres first, then the materials with the most listings.
  function liveMats() {
    var mats = pickMaterials().map(function (m) { return matScope(m.id); }).filter(function (sc) { return matItems(sc).length; })
      .sort(function (a, b) { return matItems(b).length - matItems(a).length; });
    return S.MATERIAL_GROUPS.map(function (g) { return matScope(g.id); }).filter(function (sc) { return matItems(sc).length; }).concat(mats);
  }
  function picSpan(pic, cls, label) {
    return pic ? '<img src="' + esc(asset(pic.img)) + '" alt="" decoding="async">' : '<span class="' + cls + '" aria-hidden="true">' + esc(label.charAt(0)) + '</span>';
  }
  function matTiles(list, cls) {
    var used = [];
    return '<div class="ttiles' + (cls ? ' ' + cls : '') + '">' + list.map(function (sc) {
      return '<a class="ttile" href="' + U('/m/' + sc.id) + '"><span class="ttile-img">' + picSpan(matPic(sc, null, used), 'ttile-ph', sc.label) + '</span><span class="ttile-t">' + esc(sc.label) + '</span></a>';
    }).join('') + '</div>';
  }
  // The kinds a material page opens into: the filters nested under that material in the rail (named by `keeps`, the
  // kind they keep), and for a family its members. "All" first; a kind ticked shows pressed, as its filter is in the rail.
  function kindsOf(sc) {
    if (sc.group) return [];
    var cs = C.criteria.filter(function (c) { return c.under === sc.id; }).map(function (c) {
      return { kind: 'crit', id: c.id, label: c.keeps || c.short, test: function (i) { return i.facts[c.id] === 'yes'; } };
    });
    var ss = C.standards.filter(function (s) { return s.under === sc.id && !s.filter; }).map(function (s) {
      return { kind: 'std', id: s.id, label: s.sub || s.label, test: function (i) { return i.standards.indexOf(s.id) >= 0; } };
    });
    return cs.concat(ss);
  }
  function kindOn(st, k) { return k.kind === 'crit' ? !!st.crit[k.id] : st.std.indexOf(k.id) >= 0; }
  // A kind is a link (a family's members, each with its own page) or a button that ticks its filter.
  function pill(o) {
    var inner = '<span class="kind-img">' + picSpan(o.pic, 'kind-ph', o.label) + '</span>' + esc(o.label);
    if (o.href) return '<a class="kind' + (o.on ? ' on' : '') + '" href="' + o.href + '"' + (o.on ? ' aria-current="page"' : '') + '>' + inner + '</a>';
    return '<button type="button" class="kind' + (o.on ? ' on' : '') + '" data-kind="' + o.kind + '" aria-pressed="' + !!o.on + '">' + inner + '</button>';
  }
  function kindRow(st, sc) {
    if (sc.group) {
      var u = [];
      return '<nav class="kinds" aria-label="' + esc(sc.label) + '">' + pill({ href: U('/m/' + sc.id), on: true, pic: matPic(sc, null, u), label: 'All ' + lc(sc.label) }) +
        sc.ids.map(function (id) { var m = matScope(id); return matItems(m).length ? pill({ href: U('/m/' + id), pic: matPic(m, null, u), label: m.label }) : ''; }).join('') + '</nav>';
    }
    var kinds = kindsOf(sc), used = []; if (!kinds.length) return '';
    var any = kinds.some(function (k) { return kindOn(st, k); });
    return '<div class="kinds" role="group" aria-label="Kinds of ' + esc(lc(sc.label)) + '">' + pill({ kind: '*', on: !any, pic: matPic(sc, null, used), label: 'All ' + lc(sc.label) }) +
      kinds.map(function (k) { return pill({ kind: k.kind + ':' + k.id, on: kindOn(st, k), pic: matPic(sc, k.test, used), label: k.label }); }).join('') + '</div>';
  }
  function renderMaterials() {
    var used = [];
    main.innerHTML = '<div class="wrap">' + crumbs([['Materials']]) + '<div class="page wide"><h1>Materials</h1>' +
      '<div class="tiles mat-tiles">' + liveMats().map(function (sc) {
        var pic = matPic(sc, null, used);
        return '<a class="tile" href="' + U('/m/' + sc.id) + '"><span class="tile-img">' + (pic ? '<img src="' + esc(asset(pic.img)) + '" alt="" decoding="async">' : '') + '</span>' +
          '<span class="tile-t">' + esc(sc.label) + '</span><span class="tile-n">' + plural(matItems(sc).length, 'product') + '</span></a>';
      }).join('') + '</div></div></div>';
    setNav('materials'); setTitle('Materials');
  }
  function renderHome() {
    var okItems = C.items.filter(function (i) { return status(i).ok; });
    var groups = liveGroups();
    var art = groups.map(groupPic).filter(Boolean).slice(0, 3);
    var tiles = aisleTiles(groups);
    var ages = S.AGE_BANDS.map(function (b) {
      var n = C.items.filter(function (i) { return i.ageBands.indexOf(b.id) >= 0; }).length;
      return n ? '<a class="age-chip" href="' + U('/shop', { age: b.id }) + '">' + esc(b.label) + '</a>' : '';
    }).join('');
    var rows = groups.map(function (g) {
      return '<section class="sec row-sec"><div class="sec-h"><h2><a href="' + U('/a/' + g.id) + '">' + esc(g.title) + '</a></h2><a href="' + U('/a/' + g.id) + '">All ' + esc(g.title.toLowerCase()) + ' →</a></div>' + typeTiles(g.cats) + '</section>';
    }).join('');
    var topBrands = brandList().sort(function (a, b) { return b.items.length - a.items.length || S.fold(a.name).localeCompare(S.fold(b.name)); }).slice(0, 18)
      .map(function (b) { return '<a href="' + U('/b/' + b.id) + '">' + esc(b.name) + '</a>'; }).join('');
    var featured = okItems.filter(function (i) { return i.img; }).filter(function (i, k, a) { return a.findIndex(function (x) { return x.brandId === i.brandId; }) === k; }).slice(0, 8);
    main.innerHTML = '<div class="wrap">' +
      '<section class="hero"><div><h1>Reading the fine print so you don’t have to.</h1>' +
      '<p class="lede">What ' + C.items.length + ' babies’ and toddlers’ things are made of, in their makers’ own words.</p>' +
      '<div class="hero-cta"><a class="btn" href="' + U('/shop') + '">Shop all products</a></div></div>' +
      '<div class="hero-art" aria-hidden="true">' + art.map(function (i) { return '<a href="' + U('/p/' + i.id) + '" tabindex="-1"><img src="' + esc(asset(i.img)) + '" alt="" decoding="async"></a>'; }).join('') + '</div></section>' +
      '<section class="sec"><div class="sec-h"><h2>Shop by category</h2><a href="' + U('/shop') + '">All products →</a></div>' + tiles + '</section>' +
      '<section class="sec"><div class="sec-h"><h2>Shop by material</h2><a href="' + U('/m') + '">All materials →</a></div>' + matTiles(liveMats(), 'mat-row') + '</section>' +
      '<section class="sec"><div class="sec-h"><h2>Shop by age</h2></div><div class="ages">' + ages + '</div></section>' +
      rows +
      cardRail(listGet(RECENT_KEY).map(byId).filter(Boolean).slice(0, 8), 'Pick up where you left off', U('/saved'), 'Your saved products') +
      cardRail(featured, 'Featured products', U('/shop'), 'See all ' + okItems.length) +
      '</div>' +
      '<section class="band"><div class="wrap"><div><h2>Brands</h2><div class="brand-strip">' + topBrands + '</div><a class="link-b" href="' + U('/brands') + '">All ' + Object.keys(C.brands).length + ' brands</a></div>' +
      '<div><h2>Materials glossary</h2><p>' + Object.keys(TERMS).length + ' materials and terms from store pages, each with its sources.</p><a class="btn-2" href="' + U('/glossary') + '">Browse the glossary</a></div></div></section>';
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
  function optRow(f, o, c, on, extra) {
    return '<label class="opt' + (c.n || on ? '' : ' dim') + '"><input type="checkbox" data-facet="' + f + '" value="' + esc(o.id) + '" id="f-' + f + '-' + esc(o.id) + '"' + (on ? ' checked' : '') + '>' +
      '<span class="lbl">' + esc(o.label) + (extra || '') + '</span><span class="n">' + c.n + (c.h ? '<span class="sr">, </span><i title="' + plural(c.h, 'more item', 'more items') + ' set aside by your material filters"> +' + c.h + '</i>' : '') + '</span></label>';
  }
  function optionList(f, opts, counts, st, limit) {
    var rows = opts.map(function (o) {
      var c = counts[o.id] || { n: 0, h: 0 }, on = st[f].indexOf(o.id) >= 0;
      if (!c.n && !c.h && !on && o.hideEmpty) return '';
      return optRow(f, o, c, on);
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
  // One Materials tree: a checked row means products with that material or kind are included, an unchecked one leaves
  // them out. Families (Natural fibres, Plastic and synthetics, Added treatments) open into their members, and a
  // material opens into the kinds of it a visitor can leave out (Wood > Plywood, MDF or veneer). A parent reads as
  // checked when it and every child are, part-checked when only some are, and unchecked when it is left out, which
  // also shows its children unchecked. In the state, st.mat lists the materials left out and a criterion that is on
  // leaves out its kind, so a checked kind row is a criterion that is off. Tests & certifications sit beside the tree.
  function treeCrit(c) { return !!c.under || c.kind !== 'require'; }
  function kindsUnder(id) { return C.criteria.filter(function (c) { return c.under === id; }); }
  function critSetOf(gid) { return C.criteria.filter(function (c) { return c.group === gid && !c.under && treeCrit(c); }); }
  function hasKind(item, c) { var f = item.facts[c.id]; return c.kind === 'require' ? f !== undefined && f !== 'yes' : f === 'no'; }
  function kindName(c) { return c.sub || c.label; }
  // A kind's name on its own, for chips: "No plywood, MDF or veneer", "No plastic in small parts", or the test required.
  function critChip(c) {
    if (c.kind === 'require') return S.filterLabel(c);
    if (c.group === 'plastic' && c.sub) return 'No plastic ' + lc(c.sub);
    return 'No ' + lc(kindName(c));
  }
  // The same name with its parent, for the product page: "Wood: plywood, MDF or veneer".
  function critFull(c) {
    if (c.under) return matLabel(c.under) + ': ' + lc(kindName(c));
    if (c.group === 'plastic' && c.sub) return 'Plastic ' + lc(c.sub);
    return S.filterLabel(c);
  }
  function qLink(term, what) { return TERMS[term] ? ' <a class="q" href="' + U('/glossary/' + term) + '" data-term="' + term + '" aria-label="What this means: ' + esc(what) + '">?</a>' : ''; }
  function matIn(st, id) { return st.mat.indexOf(id) < 0; }
  function matState(st, m) {
    if (!matIn(st, m.id)) return 'off';
    return kindsUnder(m.id).every(function (c) { return !st.crit[c.id]; }) ? 'on' : 'mixed';
  }
  function setState3(states) { return states.every(function (x) { return x === 'on'; }) ? 'on' : states.every(function (x) { return x === 'off'; }) ? 'off' : 'mixed'; }
  function treeRow(attrs, id, state, label, n, h, extra, dim) {
    return '<label class="opt' + (dim ? ' dim' : '') + '"><input type="checkbox" ' + attrs + ' id="' + id + '"' + (state === 'on' ? ' checked' : '') + (state === 'mixed' ? ' data-indet' : '') + '>' +
      '<span class="lbl">' + esc(label) + (extra || '') + '</span><span class="n">' + n + (h ? '<span class="sr">, </span><i title="' + plural(h, 'more item', 'more items') + ' set aside by your material filters"> +' + h + '</i>' : '') + '</span></label>';
  }
  // A tree node: its row, an "Only" shortcut for materials and families, and a button that opens its children.
  var openNodes = {};
  function tnode(id, label, row, kids, open, only) {
    var onlyBtn = only ? '<button type="button" class="only" data-only="' + esc(only) + '" aria-label="Only ' + esc(label) + '">Only</button>' : '<span></span>';
    if (!kids) return '<div class="tnode"><div class="trow">' + row + onlyBtn + '<span></span></div></div>';
    open = openNodes[id] != null ? openNodes[id] : open;
    return '<div class="tnode has-kids"><div class="trow">' + row + onlyBtn + '<button type="button" class="tx" data-tnode="' + id + '" aria-expanded="' + !!open + '" aria-controls="tk-' + id + '" aria-label="' + esc(label) + ' options">' + icon('chev') + '</button></div>' +
      '<div class="tkids" id="tk-' + id + '"' + (open ? '' : ' hidden') + '>' + kids + '</div></div>';
  }
  function treeKindRow(st, b, c, parentOff) {
    var crit = Object.assign({}, st.crit); crit[c.id] = false;
    var n = b.filter(function (it) { return hasKind(it, c) && status(it, crit, st.strict).ok; }).length;
    var state = parentOff || st.crit[c.id] ? 'off' : 'on';
    return '<div class="tnode"><div class="trow">' + treeRow('data-crit="' + c.id + '" data-inv', 'f-crit-' + c.id, state, kindName(c), n, 0, qLink(c.term, c.short), !n) + '<span></span><span></span></div></div>';
  }
  function materialsGroup(st) {
    var b = base(st), counts = countsFor('mat', st), mats = pickMaterials(), done = {}, nOn = 0;
    var anyOk = base(st, 'mat').filter(function (it) { return st.all || status(it, st.crit, st.strict).ok; });
    function matNode(m) {
      var state = matState(st, m), kinds = kindsUnder(m.id), c = counts[m.id] || { n: 0, h: 0 };
      var kids = kinds.map(function (k) { return treeKindRow(st, b, k, state === 'off'); }).join('');
      var changed = state === 'off' || kinds.some(function (k) { return !!st.crit[k.id] !== !!k['default']; });
      return tnode('m-' + m.id, m.label, treeRow('data-mat="' + m.id + '"', 'f-mat-' + m.id, state, m.label, c.n, c.h, '', !c.n && !c.h), kids, changed, m.id);
    }
    var rows = mats.map(function (m) {
      if (!m.group) return matNode(m);
      if (done[m.group]) return '';
      done[m.group] = 1;
      var g = S.MATERIAL_GROUPS.filter(function (x) { return x.id === m.group; })[0] || { id: m.group, label: m.group };
      var members = mats.filter(function (x) { return x.group === m.group; }), ids = members.map(function (x) { return x.id; });
      var state = setState3(members.map(function (x) { return matState(st, x); }));
      var n = anyOk.filter(function (it) { return it.materials.some(function (x) { return ids.indexOf(x) >= 0; }); }).length;
      return tnode('g-' + g.id, g.label, treeRow('data-matgroup="' + g.id + '"', 'f-matg-' + g.id, state, g.label, n, 0, '', !n), members.map(matNode).join(''), state === 'mixed', 'g:' + g.id);
    }).join('');
    // Families of things that are not a material a visitor picks: plastic by where it sits, and added treatments.
    C.critGroups.filter(function (g) { return critSetOf(g.id).length; }).forEach(function (g) {
      var list = critSetOf(g.id);
      var state = setState3(list.map(function (c) { return st.crit[c.id] ? 'off' : 'on'; }));
      var all = Object.assign({}, st.crit); list.forEach(function (c) { all[c.id] = false; });
      var n = b.filter(function (it) { return list.some(function (c) { return hasKind(it, c); }) && status(it, all, st.strict).ok; }).length;
      rows += tnode('s-' + g.id, g.title, treeRow('data-critset="' + g.id + '"', 'f-crits-' + g.id, state, g.title, n, 0, '', !n), list.map(function (c) { return treeKindRow(st, b, c, false); }).join(''), false);
    });
    var nStrict = b.filter(function (it) { return status(it, st.crit, true).ok; }).length;
    rows += '<div class="tnode"><div class="trow">' + treeRow('data-crit="strict" data-inv', 'f-crit-strict', st.strict ? 'off' : 'on', 'Parts whose material isn’t stated', nStrict, 0) + '<span></span><span></span></div></div>' +
      '<p class="hint"><a href="#" data-crit-reset>' + (critIsDefault(st.crit, st.strict) && !st.mat.length ? 'Allow everything' : 'Reset to defaults') + '</a></p>';
    nOn = st.mat.length + C.criteria.filter(function (c) { return treeCrit(c) && st.crit[c.id]; }).length + (st.strict ? 1 : 0);
    return group('mat', 'Materials', rows, nOn);
  }
  function testedGroup(st) {
    var b = base(st), sc = countsFor('std', st), list = C.criteria.filter(function (c) { return !treeCrit(c); });
    function row(c) {
      var crit = Object.assign({}, st.crit); crit[c.id] = true;
      var n = b.filter(function (it) { return status(it, crit, st.strict).ok; }).length;
      return '<label class="opt' + (n ? '' : ' dim') + '"><input type="checkbox" data-crit="' + c.id + '" id="f-crit-' + c.id + '"' + (st.crit[c.id] ? ' checked' : '') + '>' +
        '<span class="lbl">' + esc(S.filterLabel(c)) + qLink(c.term, c.short) + '</span><span class="n">' + n + '</span></label>';
    }
    var stds = C.standards.filter(function (s) { return !s.filter; });
    var rows = list.map(row).join('') + stds.map(function (s) { return optRow('std', { id: s.id, label: s.label }, sc[s.id] || { n: 0, h: 0 }, st.std.indexOf(s.id) >= 0, qLink(s.term, s.label)); }).join('');
    return group('tested', 'Tests & certifications', rows, list.filter(function (c) { return st.crit[c.id]; }).length + st.std.length);
  }
  // The rail in three headed sections: what the product is, what it is made of, and price and delivery.
  function railSec(title, body) { return body ? '<section class="rail-sec"><h3 class="rail-sec-h">' + esc(title) + '</h3>' + body + '</section>' : ''; }
  function filterRail(st) {
    var what = '';
    if (st.kind !== 'cat') {
      var cc = countsFor('cat', st), seen = {};
      var groups = C.groups.filter(function (g) { return st.kind !== 'dept' || g.id === st.key; });
      what += group('cat', 'Product type', groups.map(function (g) {
        // A type in several aisles is listed once, under the first aisle shown.
        var ids = g.cats.filter(function (id) { if (seen[id]) return false; seen[id] = 1; return true; });
        if (!ids.length) return '';
        return (groups.length > 1 ? '<p class="opt-group">' + esc(g.title) + '</p>' : '') + optionList('cat', ids.map(function (id) { return { id: id, label: C.cats[id].short }; }), cc, st);
      }).join(''), st.cat.length);
    }
    what += group('age', 'Age range', optionList('age', S.AGE_BANDS, countsFor('age', st), st) +
      '<p class="hint">The maker’s age rating where one is recorded, otherwise the usual ages for the product type. Several ticked: products for any of them.</p>', st.age.length);
    if (st.kind !== 'brand') {
      what += group('brand', 'Brand', '<input type="search" class="find" id="brand-find" placeholder="Find a brand" aria-label="Find a brand">' +
        '<div id="brand-opts">' + optionList('brand', brandList().map(function (b) { return { id: b.id, label: b.name }; }), countsFor('brand', st), st, 8) + '</div>', st.brand.length);
    }
    var made = materialsGroup(st) + testedGroup(st);
    var buy = group('price', 'Price', optionList('price', S.PRICE_BANDS.concat([{ id: 'none', label: 'Price not listed', hideEmpty: true }]), countsFor('price', st), st) +
        '<p class="hint">Other currencies converted roughly to US dollars.</p>', st.price.length) +
      group('deliv', 'Shipping to the US', optionList('deliv', DELIV, countsFor('deliv', st), st) + '<p class="hint">As the store page states it. Free-over-a-minimum counts as free when the price is over it.</p>', st.deliv.length) +
      group('ship', 'Ships from', optionList('ship', [{ id: 'us', label: 'The US' }, { id: 'abroad', label: 'Outside the US' }, { id: 'unknown', label: 'Not recorded' }], countsFor('ship', st), st), st.ship.length);
    return railSec('What it is', what) + railSec('What it’s made of', made) + railSec('Price and delivery', buy);
  }
  // One-tap refinements above the grid, as on Google Shopping: the same facets as the rail, shown as toggles.
  function quickChips(st, list) {
    var q = [['deliv', 'free', 'Free shipping'], ['ship', 'us', 'Ships from the US']];
    S.PRICE_BANDS.slice(0, 3).forEach(function (b) { q.push(['price', b.id, b.label]); });
    var mc = {}; list.forEach(function (i) { i.materials.forEach(function (m) { mc[m] = (mc[m] || 0) + 1; }); });
    delete mc.synthetic;
    Object.keys(mc).sort(function (a, b) { return mc[b] - mc[a]; }).slice(0, 3).forEach(function (m) { q.push(['only', m, 'Only ' + lc(matLabel(m))]); });
    var counts = {}, inc = pickIds().filter(function (id) { return st.mat.indexOf(id) < 0; });
    return '<div class="quick" role="group" aria-label="Quick filters">' + q.map(function (x) {
      var on = x[0] === 'only' ? inc.length === 1 && inc[0] === x[1] : st[x[0]].indexOf(x[1]) >= 0;
      var c = (counts[x[0]] || (counts[x[0]] = countsFor(x[0] === 'only' ? 'mat' : x[0], st)))[x[1]];
      if (!on && !(c && c.n)) return '';
      return '<button type="button" class="qchip" data-quick="' + x[0] + '" data-val="' + esc(x[1]) + '" aria-pressed="' + on + '">' + (on ? icon('check') : '') + esc(x[2]) + '</button>';
    }).join('') + '</div>';
  }
  function activeChips(st, withDefaults) {
    var chips = [];
    function add(f, v, label) { chips.push('<button type="button" class="chip-x" data-clear="' + f + '" data-val="' + esc(v) + '">' + esc(label) + icon('x') + '<span class="sr"> remove</span></button>'); }
    if (st.q && st.kind !== 'search') add('q', '', '“' + st.q + '”');
    if (st.kind !== 'cat') st.cat.forEach(function (v) { add('cat', v, catOf(v) ? catOf(v).title : v); });
    if (st.kind !== 'brand') st.brand.forEach(function (v) { add('brand', v, C.brands[v] ? C.brands[v].name : v); });
    st.price.forEach(function (v) { var b = S.PRICE_BANDS.filter(function (x) { return x.id === v; })[0]; if (b || v === 'none') add('price', v, b ? b.label : 'Price not listed'); });
    st.deliv.forEach(function (v) { var d = DELIV.filter(function (x) { return x.id === v; })[0]; if (d) add('deliv', v, d.label); });
    // Materials left out: a few kept reads "Only wood or wool"; otherwise one chip per material (or whole family) left out.
    if (st.mat.length) {
      var inc = pickMaterials().filter(function (m) { return matIn(st, m.id); });
      if (inc.length <= 3) add('mat-all', '', inc.length ? 'Only ' + inc.map(function (m) { return lc(m.label); }).join(' or ') : 'No materials included');
      else {
        var whole = S.MATERIAL_GROUPS.filter(function (g) { return S.MATERIALS.filter(function (m) { return m.group === g.id; }).every(function (m) { return !matIn(st, m.id); }); });
        whole.forEach(function (g) { add('matgroup', g.id, 'No ' + lc(g.label)); });
        st.mat.forEach(function (v) { var m = S.MATERIALS.filter(function (x) { return x.id === v; })[0]; if (!(m && whole.some(function (g) { return g.id === m.group; }))) add('mat', v, 'No ' + lc(matLabel(v))); });
      }
    }
    st.std.forEach(function (v) { var s = C.standards.filter(function (x) { return x.id === v; })[0]; add('std', v, s ? s.label : v); });
    st.age.forEach(function (v) { var a = S.AGE_BANDS.filter(function (x) { return x.id === v; })[0]; if (a) add('age', v, 'Age: ' + a.label); });
    st.ship.forEach(function (v) { var l = { us: 'Ships from the US', abroad: 'Ships from outside the US', unknown: 'Shipping not recorded' }[v]; if (l) add('ship', v, l); });
    var d = defaults();
    var nd = chips.length;
    C.criteria.forEach(function (c) { if (st.crit[c.id] && (withDefaults || !d[c.id])) { add('crit', c.id, critChip(c)); if (!d[c.id]) nd++; } });
    if (st.strict) { add('crit', 'strict', 'Every part’s material stated'); nd++; }
    if (nd > 1) chips.push('<button type="button" class="chip-clear" data-clear-all>Clear all</button>');
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
    if (st.kind === 'mat') return matScope(st.key).label;
    if (st.kind === 'brand') return C.brands[st.key] ? C.brands[st.key].name : st.key;
    if (st.kind === 'search') return st.q ? 'Results for “' + st.q + '”' : 'Search';
    return 'All products';
  }
  function renderList(keepFocus) {
    var st = STATE, show = PEND || st;
    var focusId = keepFocus && document.activeElement && document.activeElement.id;
    var brandFind = $('#brand-find') ? $('#brand-find').value : '';
    var drawer = document.body.classList.contains('drawer-on');
    // Rebuilding the page must not move it: remember where the window and the filter rail were scrolled, which
    // facets had "Show all" open, and hold the page's height while the markup is swapped (an empty #main would let
    // the browser clamp the scroll position to the top).
    var y = window.scrollY, oldRail = $('#rail'), railTop = oldRail ? oldRail.scrollTop : 0, mainH = main.offsetHeight;
    var expanded = $$('.fgroup').filter(function (g) { var w = $('.more-opts-wrap', g); return w && w.getAttribute('data-shown'); }).map(function (g) { return g.getAttribute('data-group'); });
    main.style.minHeight = mainH + 'px';
    var all = sortItems(base(st), st.sort);
    var ok = all.filter(function (i) { return status(i, st.crit, st.strict).ok; }), hidden = all.length - ok.length;
    var list = st.all ? all : ok;
    var shown = list.slice(0, pageShown);
    var title = listTitle(st), intro = '', sub = '', trail = [];
    if (st.kind === 'cat' && catOf(st.key)) {
      var c = catOf(st.key), g = groupOf(c.group);
      trail = g ? [[g.title, U('/a/' + g.id)], [c.title]] : [[c.title]];
      if (c.intro) intro = c.intro;
      if (g.cats.length > 1) sub = '<nav class="sibling-types" aria-label="Other types in ' + esc(g.title) + '">' + typeTiles(g.cats.filter(function (id) { return typeCount(id) > 0; }), 'sm', c.id) + '</nav>';
    } else if (st.kind === 'dept' && groupOf(st.key)) {
      var gg = groupOf(st.key);
      trail = [[gg.title]];
      sub = typeTiles(gg.cats, 'type-tiles');
    } else if (st.kind === 'mat') {
      var sc = matScope(st.key), types = liveTypes().filter(function (id) { return all.some(function (i) { return i.cat === id; }); });
      trail = [['Materials', U('/m')], [sc.label]];
      sub = kindRow(st, sc) + (types.length > 1 ? '<nav class="sibling-types" aria-label="Product types made with ' + esc(lc(sc.label)) + '">' + typeTiles(types, 'sm', st.cat.length === 1 ? st.cat[0] : null, null, ok.concat(all), '/m/' + sc.id) + '</nav>' : '');
    } else if (st.kind === 'brand' && C.brands[st.key]) {
      var b = C.brands[st.key], bc = {}; b.items.forEach(function (i) { bc[i.cat] = 1; });
      trail = [['Brands', U('/brands')], [b.name]];
      intro = plural(b.items.length, 'listing') + ' in ' + Object.keys(bc).map(function (k) { return C.cats[k].title.toLowerCase(); }).join(', ') + '.';
    } else if (st.kind === 'search') {
      trail = [[st.q ? 'Search: ' + st.q : 'Search']];
      var hitTypes = liveTypes().filter(function (id) { return all.some(function (i) { return i.cat === id; }); });
      if (hitTypes.length > 1) sub = '<nav class="sibling-types" aria-label="Product types in these results">' + typeTiles(hitTypes, 'sm') + '</nav>';
    } else {
      trail = [['All products']];
      sub = '<nav class="sibling-types" aria-label="Product types">' + typeTiles(liveTypes(), 'sm') + '</nav>';
    }
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
      quickChips(st, list) +
      '<div class="chips">' + activeChips(st, true) + '</div>' +
      (hidden ? '<div class="hidden-note"><p>' + (st.all ? plural(hidden, 'product that doesn’t', 'products that don’t') + ' match your material filters ' + (hidden === 1 ? 'is' : 'are') + ' shown.' : '<b>' + plural(hidden, 'more product', 'more products') + '</b> set aside by your material filters.') + '</p><button type="button" data-toggle-all>' + (st.all ? 'Hide them' : 'Show them') + '</button></div>' : '') +
      (shown.length ? '<div class="grid" id="grid">' + shown.map(function (it, i) { return card(it, i, st.crit, st.strict); }).join('') + '</div>' : emptyState(st, hidden)) +
      (list.length > shown.length ? '<div class="more-wrap"><p>Showing ' + shown.length + ' of ' + list.length + '</p><button type="button" class="btn-2" data-more>Show more</button></div>' : (list.length > PAGE ? '<div class="more-wrap"><p>Showing all ' + list.length + '</p></div>' : '')) +
      '</section></div></div>';
    $('#q').value = st.kind === 'search' || st.q ? st.q : '';
    if (brandFind && $('#brand-find')) { $('#brand-find').value = brandFind; filterBrandList(brandFind); }
    expanded.forEach(function (id) {
      var g = $('.fgroup[data-group="' + id + '"]'); if (!g) return;
      var w = $('.more-opts-wrap', g), b = $('.more-opts', g);
      if (w) { w.hidden = false; w.setAttribute('data-shown', '1'); } if (b) b.hidden = true;
    });
    $$('#rail [data-indet]').forEach(function (x) { x.indeterminate = true; });
    if (drawer) openDrawer(false);
    // Keep the visitor where they were: a shorter list gets just enough room below it to hold the scroll position
    // (route() clears this on the next page), and the rail keeps its own scroll so the box they ticked stays put.
    main.style.minHeight = '';
    var short = y + window.innerHeight - document.documentElement.scrollHeight;
    if (short > 0) main.style.minHeight = (main.offsetHeight + short) + 'px';
    window.scrollTo(0, y);
    var newRail = $('#rail'); if (newRail) newRail.scrollTop = railTop;
    if (focusId && document.getElementById(focusId)) document.getElementById(focusId).focus({ preventScroll: true });
    setNav(st.kind, st.key);
    filterBadge();
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
      ['r-uses', '✓', 'Made with', item.uses],
      ['r-out', '✕', 'Flagged parts', item.outside],
      ['r-free', '⊘', 'Stated free of', item.free],
      ['r-unk', '?', 'Not stated', item.unconfirmed]
    ];
    return '<div class="check">' + rows.filter(function (r) { return r[3].length; }).map(function (r) {
      return '<div class="row ' + r[0] + '"><div class="row-h"><span class="ic" aria-hidden="true">' + r[1] + '</span><span>' + r[2] + '</span></div>' +
        '<div class="chips-row">' + r[3].map(chip).join('') + '</div></div>';
    }).join('') + '</div>';
  }
  // How this product reads against each material filter, as information only: the filters themselves
  // are set on the listing pages. Criteria that don't apply to the product are left out.
  function filterTable(item) {
    var row = function (c) {
      var f = item.facts[c.id], res;
      if (!CRIT[c.id] || f === undefined) return '';
      if (c.kind === 'require') res = f === 'yes' ? '<span class="ok">Stated</span>' : f === 'no' ? '<span class="no">Stated not</span>' : '<span class="unk">Not stated</span>';
      else res = f === 'yes' ? '<span class="ok">None</span>' : f === 'no' ? '<span class="no">Has it</span>' : '<span class="unk">Not stated</span>';
      return '<tr><th scope="row">' + esc(critFull(c)) + (TERMS[c.term] ? ' <a class="q term-link" href="' + U('/glossary/' + c.term) + '" data-term="' + c.term + '" aria-label="What this means">?</a>' : '') + '</th><td class="res">' + res + '</td></tr>';
    };
    // The same two groups as the filter rail.
    var body = [[true, 'Materials'], [false, 'Tests & certifications']].map(function (g) {
      var rows = C.criteria.filter(function (c) { return treeCrit(c) === g[0]; }).map(row).join('');
      return rows ? '<tbody><tr class="grp"><th scope="rowgroup" colspan="2">' + esc(g[1]) + '</th></tr>' + rows + '</tbody>' : '';
    }).join('');
    if (!body) return '<p class="muted">No material filters are on.</p>';
    return '<table class="ftable"><caption class="sr">How this product reads against each material filter you have on</caption><thead><tr><th scope="col">Filter</th><th scope="col">This product</th></tr></thead>' + body + '</table>';
  }
  // Several stores: cheapest first (with shipping where known), like a price comparison. One store's sizes or
  // options keep the order the research recorded them in.
  function storeCount(item) { return item.products.map(function (p) { return p.store; }).filter(function (v, k, a) { return a.indexOf(v) === k; }).length; }
  function offersOf(item) { return storeCount(item) > 1 ? item.byCost : item.products; }
  function buyText(p) { return 'Buy at ' + esc(p.store.replace(/\s*\(.*\)$/, '')); }
  // `rated`: several stores or options, so each offer shows its own page's rating.
  function offerHtml(p, k, rated) {
    var from = p.ships_from === 'US' ? 'Ships from the US' : p.ships_from ? 'Ships from ' + p.ships_from : 'Ships from: not recorded';
    var ship = p.shipping || (/free (?:us )?shipping/i.test(p.price) ? 'Free shipping' : '');
    return '<li class="offer"><p class="o-name">' + esc(p.name) + '</p>' + (rated === true && p.rating && p.rating.count > 0 ? stars({ value: p.rating.value, count: p.rating.count, store: p.store }) : '') + '<p class="o-price">' + esc(p.price.replace(/,?\s*free (us )?shipping.*$/i, '')) +
      (p.total != null && p.shipCost > 0 ? '<small>' + (p.approx ? 'about ' : '') + esc(S.money(p.total)) + ' with shipping</small>' : '') + '</p>' +
      '<p class="o-meta">' + esc(p.store) + ' · ' + esc(from) + (ship ? ' · <span class="o-ship">' + icon('truck') + esc(ship) + '</span>' : '') + '</p>' +
      (p.note ? '<p class="o-note">' + esc(p.note) + '</p>' : '') +
      '<a class="btn-buy' + (k === 0 ? '' : ' sm') + '" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + buyText(p) + icon('ext') + '</a>' +
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
    var similar = C.items.filter(function (i) { return i.cat === item.cat && i !== item; })
      .sort(function (a, b) { return (status(b).ok - status(a).ok) || (!!b.img - !!a.img); }).slice(0, 3);
    recentAdd(item.id);
    main.innerHTML = '<div class="wrap">' + crumbs([[g.title, U('/a/' + g.id)], [cat.title, U('/c/' + cat.id)], [item.line]]) +
      '<article class="pdp">' +
      gallery(item) +
      '<div class="buybox">' +
      '<p class="brand"><a href="' + U('/b/' + item.brandId) + '">' + esc(item.brand) + '</a></p><h1>' + esc(item.line) + '</h1>' +
      (item.rating ? '<a class="rating-link" href="' + esc(item.rating.url) + '" target="_blank" rel="noopener">' + stars(item.rating, true) + '</a>' : '') +
      '<p class="price">' + esc(S.priceLabel(item)) + (item.products.length > 1 ? '<small>' + (storeCount(item) > 1 ? storeCount(item) + ' stores' : item.products.length + ' options') + '</small>' : '') + '</p>' +
      (storeCount(item) > 1 ? '<h2 class="offers-h">Prices at ' + storeCount(item) + ' stores, lowest first</h2>' : '<h2 class="sr">Where to buy</h2>') + '<ul class="offers">' + offersOf(item).map(function (p, k) { return offerHtml(p, k, item.products.length > 1); }).join('') + '</ul>' +
      '<div class="status">' + (r.ok ? '<p class="fit is-ok"><span class="mk" aria-hidden="true">✓</span>Meets your ' + plural(critOn(CRIT, STRICT), 'material filter') + '</p>' : fitLine(item, r)) +
      (r.unst.length ? fitLine(item, { ok: true, miss: [], unst: r.unst }) : '') + '</div>' +
      '<div class="made">' + (item.uses.length ? '<p class="lab">Made with</p><div class="chips-row">' + item.uses.map(chip).join('') + '</div>' : '') +
      (item.outside.length ? '<p class="lab"' + (item.uses.length ? ' style="margin-top:10px"' : '') + '>Flagged parts</p><div class="chips-row out">' + item.outside.map(chip).join('') + '</div>' : '') +
      '<a class="link-b" href="#materials" data-jump="materials">Full materials ↓</a></div>' +
      '<div class="buy-actions">' + saveBtn(item, 'btn-3') + compareBtn(item) + '<button type="button" class="btn-3" data-share="' + esc(U('/p/' + item.id)) + '" data-share-title="' + esc(item.brand + ' ' + item.line) + '">' + icon('share') + '<span>Share</span></button></div>' +
      (item.quote ? '<blockquote class="ev"><p>“' + esc(item.quote) + '”</p><footer>From the store page</footer></blockquote>' : item.evidence ? '<p class="ev"><span>' + esc(item.evidence) + '</span></p>' : '') +
      (item.note ? '<p class="muted" style="font-size:14px">' + esc(item.note) + '</p>' : '') +
      '<dl class="facts">' + (stds.length ? '<div><dt>Standards named</dt><dd>' + stds.join(', ') + '</dd></div>' : '') +
      '<div><dt>Age</dt><dd>' + esc(item.ageLabel) + (item.ageStated ? ' <small class="muted">(maker’s rating)</small>' : ' <small class="muted">(usual for ' + esc(cat.title.toLowerCase()) + '; no maker rating recorded)</small>') + '</dd></div>' +
      '<div><dt>Product type</dt><dd><a href="' + U('/c/' + cat.id) + '">' + esc(cat.title) + '</a></dd></div>' +
      '<div><dt>Browse</dt><dd>' + cat.aisles.map(function (id) { return '<a href="' + U('/a/' + id) + '">' + esc(groupOf(id).title) + '</a>'; }).join(', ') + '</dd></div></dl>' +
      '</div></article>' +
      '<div class="pdp-below">' +
      '<details class="acc" open id="materials"><summary>Materials' + icon('chev') + '</summary><div class="acc-body">' + checklist(item) +
      '<h3 class="sub">By filter</h3>' + filterTable(item) + '</div></details>' +
      (cat.intro || cat.outro ? '<details class="acc"><summary>About ' + esc(cat.title.toLowerCase()) + icon('chev') + '</summary><div class="acc-body">' + (cat.intro ? '<p>' + esc(cat.intro) + '</p>' : '') + (cat.outro ? '<p>' + esc(cat.outro) + '</p>' : '') + '</div></details>' : '') +
      '<details class="acc"><summary>Prices and shipping' + icon('chev') + '</summary><div class="acc-body"><p>Prices and shipping statements were read from the store pages and are checked weekly; the date under each store link is the last check. Prices in pounds, euros and other currencies are converted roughly to US dollars for sorting.</p></div></details>' +
      '</div>' +
      (similar.length ? '<section class="sec similar"><div class="sec-h"><h2>Compare with similar items</h2><a href="' + U('/compare', { ids: [item.id].concat(similar.map(function (i) { return i.id; })).join(',') }) + '">Open in Compare →</a></div>' +
        compareTable([item].concat(similar), { current: item.id, rows: ['price', 'ship', 'rating', 'filters', 'made', 'out', 'unst', 'from'] }) + '</section>' : '') +
      (groupOf(cat.group) && groupOf(cat.group).cats.length > 1 ? '<section class="sec row-sec"><div class="sec-h"><h2><a href="' + U('/a/' + cat.group) + '">More in ' + esc(groupOf(cat.group).title.toLowerCase()) + '</a></h2><a href="' + U('/a/' + cat.group) + '">All ' + esc(groupOf(cat.group).title.toLowerCase()) + ' →</a></div>' + typeTiles(groupOf(cat.group).cats.filter(function (id) { return typeCount(id) > 0; }), 'sm', cat.id) + '</section>' : '') +
      cardRail(more, 'More from ' + esc(item.brand), U('/b/' + item.brandId), 'All ' + item.brand) +
      cardRail(also, 'You may also like', U('/c/' + cat.id), 'All ' + cat.title.toLowerCase()) +
      (recent.length ? '<div class="recent">' + cardRail(recent, 'Recently viewed') + '</div>' : '') +
      '</div>';
    setNav('product', item.group);
    setTitle(item.brand + ' ' + item.line);
    buyBar(item);
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
          var pic = b.items.filter(function (i) { return i.img && status(i).ok; })[0] || b.items.filter(function (i) { return i.img; })[0];
          return '<li><a class="b-pic" href="' + U('/b/' + b.id) + '" tabindex="-1" aria-hidden="true">' + (pic ? '<img src="' + esc(asset(pic.img)) + '" alt="" loading="lazy" decoding="async">' : '') + '</a><div><a class="b-name" href="' + U('/b/' + b.id) + '">' + esc(b.name) + '</a><span class="b-meta">' + plural(b.items.length, 'listing') + ' · ' + Object.keys(cats).map(function (c) { return esc(C.cats[c].short); }).join(', ') + '</span></div></li>';
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
      '<h2>Material filters</h2><p>The <b>Materials</b> filter is one tree: a checked material or kind is included, an unchecked one is left out, and a product shows when it has none of what you left out and at least one of what you kept. A family such as Natural fibres or Plastic and synthetics opens into its members, and a material opens into the kinds of it you can leave out, such as plywood under Wood, superwash under Wool, or silicone whose testing to German LFGB or the French Arrêté isn’t stated. “Only” beside a material keeps just that one. <b>Tests & certifications</b> keeps products whose maker states a test or certificate. The tree starts from the preferences this guide was built around: no plastic or synthetics in the main materials or small parts, no melamine, no synthetic dyes, paints, flame retardants or repellent finishes, no plywood, superwash wool or rubber plasticisers, and silicone only when the maker says the finished product was tested. A part whose material no page states doesn’t count against a product while “Parts whose material isn’t stated” is checked. Your choices are kept in this browser, and a link to a filtered page carries them.</p>' +
      '<h2>Questions makers can answer</h2><ul>' + C.ask.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' +
      '<h2>Prices, shipping and stock</h2><p>Prices and shipping statements were read from store pages and are checked weekly by a script; the product page shows the date of the last check. Prices in pounds, euros and other currencies are converted roughly to US dollars for sorting. Catalog last updated ' + esc(C.updated) + '.</p>' +
      '<h2>Source</h2><p>The data and the site are open at <a href="https://github.com/mchelen/SaferByTheThread" target="_blank" rel="noopener">github.com/mchelen/SaferByTheThread</a>.</p></div></div>';
    setNav('about'); setTitle('About');
  }
  function stdLinks(i) { return i.standards.map(function (s) { var d = C.standards.filter(function (x) { return x.id === s; })[0]; return d ? termLink(d.term, d.label) : esc(s); }).join(', '); }
  // Side-by-side table, used by the Compare page and by "Compare with similar items" on product pages.
  var CMP_ROWS = {
    price: ['Price', function (i) { return esc(S.priceLabel(i)); }],
    stores: ['Stores', function (i) { return i.products.map(function (p) { return '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.store) + '</a>' + (p.shipping ? ' <span class="muted">(' + esc(p.shipping) + ')</span>' : ''); }).join('<br>'); }],
    ship: ['Shipping', function (i) { return esc(i.shipLine); }],
    rating: ['Rating', function (i) { return i.rating ? stars(i.rating, true) : '<span class="muted">None on the store page</span>'; }],
    filters: ['Your material filters', function (i) { var r = status(i); return r.ok && !r.unst.length ? fitP('is-ok', '✓', 'Meets them all') : fitLine(i, r); }],
    made: ['Made with', function (i) { return i.uses.length ? '<div class="chips-row">' + i.uses.map(chip).join('') + '</div>' : '<span class="muted">None</span>'; }],
    free: ['Stated free of', function (i) { return i.free.length ? '<div class="chips-row r-free">' + i.free.map(chip).join('') + '</div>' : '<span class="muted">Nothing stated</span>'; }],
    unst: ['Not stated', function (i) { return i.unconfirmed.length ? '<div class="chips-row r-unk">' + i.unconfirmed.map(chip).join('') + '</div>' : '<span class="muted">None</span>'; }],
    out: ['Flagged parts', function (i) { return i.outside.length ? '<div class="chips-row r-out">' + i.outside.map(chip).join('') + '</div>' : '<span class="muted">None</span>'; }],
    std: ['Standards named', function (i) { return i.standards.length ? stdLinks(i) : '<span class="muted">None</span>'; }],
    age: ['Age', function (i) { return esc(i.ageLabel) + (i.ageStated ? '' : ' <span class="muted">(usual for the type)</span>'); }],
    from: ['Ships from', function (i) { return esc(i.products.map(function (p) { return p.ships_from || 'not recorded'; }).filter(function (v, k, a) { return a.indexOf(v) === k; }).join(', ')); }]
  };
  function compareTable(items, opt) {
    opt = opt || {};
    var keys = opt.rows || Object.keys(CMP_ROWS);
    return '<div class="cmp"><table><thead><tr><th scope="col"><span class="sr">Attribute</span></th>' + items.map(function (i) {
      var here = i.id === opt.current;
      return '<th scope="col"' + (here ? ' class="here"' : '') + '>' + (here ? '<span class="here-t">This item</span>' : '') + '<a href="' + U('/p/' + i.id) + '" style="text-decoration:none">' + photo(i) + '<span class="brand" style="display:block;margin-top:8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">' + esc(i.brand) + '</span><span style="font-weight:600">' + esc(i.line) + '</span></a>' +
        (offersOf(i)[0] ? '<a class="btn-buy sm cmp-buy" href="' + esc(offersOf(i)[0].url) + '" target="_blank" rel="noopener">' + buyText(offersOf(i)[0]) + icon('ext') + '</a>' : '') +
        (opt.removable ? '<button type="button" class="rm" data-compare="' + esc(i.id) + '">Remove</button>' : '') + '</th>';
    }).join('') + '</tr></thead><tbody>' + keys.map(function (k) {
      return '<tr><th scope="row">' + CMP_ROWS[k][0] + '</th>' + items.map(function (i) { return '<td' + (i.id === opt.current ? ' class="here"' : '') + '>' + CMP_ROWS[k][1](i) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
  }
  // A list arrives from a shared link as ?ids=a,b,c; it is shown without touching the visitor's own list.
  function sharedBar(ids, mine, what) {
    return '<div class="shared-note"><p><b>A shared ' + what + '</b> of ' + plural(ids.length, 'product') + '. Your own ' + what + ' in this browser is unchanged.</p><div>' +
      '<button type="button" class="btn" data-take="' + esc(ids.join(',')) + '" data-take-into="' + (what === 'list' ? 'saved' : 'compare') + '">' + (what === 'list' ? 'Save all to my list' : 'Use as my compare list') + '</button>' +
      '<a class="btn-2" href="' + U(mine) + '">' + (what === 'list' ? 'My saved products' : 'My compare list') + '</a></div></div>';
  }
  function shareBtn(path, ids, title) {
    return '<button type="button" class="btn-3" data-share="' + esc(U(path, { ids: ids.join(',') })) + '" data-share-title="' + esc(title) + '">' + icon('share') + '<span>Share this list</span></button>';
  }
  function renderSaved() {
    var shared = idsParam(), ids = shared || listGet(SAVED_KEY);
    var items = ids.map(byId).filter(Boolean);
    main.innerHTML = '<div class="wrap">' + crumbs([[shared ? 'Shared list' : 'Saved']]) + '<div class="page wide"><div class="page-h"><h1>' + (shared ? 'Shared list' : 'Saved products') + '</h1>' + (!shared && items.length ? shareBtn('/saved', ids, 'Saved products') : '') + '</div>' +
      (shared ? sharedBar(items.map(function (i) { return i.id; }), '/saved', 'list') : '<p class="lede">' + (items.length ? plural(items.length, 'product') + ' saved in this browser. “Share this list” makes a link that opens the same products on any device, for a gift list or to decide with someone.' : 'Nothing saved yet. The heart on any product keeps it here, in this browser.') + '</p>') +
      (items.length ? '<div class="grid">' + items.map(function (i) { return card(i); }).join('') + '</div>' : '<div class="empty-tiles"><h2>Shop by category</h2>' + aisleTiles() + '</div>') + '</div></div>';
    setNav('saved'); setTitle(shared ? 'Shared list' : 'Saved');
  }
  function renderCompare() {
    var shared = idsParam(), items = (shared || listGet(CMP_KEY)).map(byId).filter(Boolean).slice(0, 4);
    main.innerHTML = '<div class="wrap">' + crumbs([['Compare']]) + '<div class="page wide"><div class="page-h"><h1>Compare products</h1>' + (!shared && items.length > 1 ? shareBtn('/compare', items.map(function (i) { return i.id; }), 'Compare products') : '') + '</div>' +
      (shared ? sharedBar(items.map(function (i) { return i.id; }), '/compare', 'comparison') : '<p class="lede">' + (items.length ? plural(items.length, 'product') + ' side by side; up to four at a time, kept in this browser.' : 'Nothing to compare yet. “Compare” on any product page or quick view adds it here, up to four at a time.') + '</p>') +
      (items.length ? compareTable(items, { removable: !shared }) : '<div class="empty-tiles"><h2>Shop by category</h2>' + aisleTiles() + '</div>') + '</div></div>';
    setNav('compare'); setTitle('Compare');
  }
  function renderNotFound() {
    main.innerHTML = '<div class="wrap"><div class="page"><h1>Page not found</h1><p class="lede">Nothing lives at this address.</p><div class="empty-tiles"><h2>Shop by category</h2>' + aisleTiles() + '</div></div></div>';
    setTitle('Not found');
  }

  // ---------- quick view, lightbox, compare tray ----------
  var qv = document.getElementById('qv'), scrim = document.getElementById('scrim'), qvOpener = null;
  function openQuickView(id, opener) {
    var item = byId(id); if (!item) return;
    var r = status(item);
    qv.innerHTML = '<button type="button" class="ib x" data-qv-close aria-label="Close quick view">' + icon('x') + '</button><div class="qv-in">' + gallery(item) +
      '<div><p class="eyebrow">' + esc(item.brand) + '</p><h2 id="qv-h">' + esc(item.line) + '</h2>' + (item.rating ? stars(item.rating, true) : '') + '<p class="price">' + esc(S.priceLabel(item)) + '</p>' +
      fitLine(item, r) +
      '<ul class="offers">' + offersOf(item).slice(0, 2).map(function (p, k) { return offerHtml(p, k, item.products.length > 1); }).join('') + '</ul>' +
      '<div class="made">' + (item.uses.length ? '<p class="lab">Made with</p><div class="chips-row">' + item.uses.map(chip).join('') + '</div>' : '') + (item.outside.length ? '<p class="lab"' + (item.uses.length ? ' style="margin-top:10px"' : '') + '>Flagged parts</p><div class="chips-row out">' + item.outside.map(chip).join('') + '</div>' : '') + '</div>' +
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

  // ---------- phone buy bar: price and the first store link stay in reach once the buy box scrolls away ----------
  var buybar = document.getElementById('buybar'), buyOffers = null;
  function buyBarCheck() {
    var past = !!buyOffers && buyOffers.isConnected && buyOffers.getBoundingClientRect().bottom < 0;
    if (past === !buybar.hidden) return;
    buybar.hidden = !past; document.body.classList.toggle('buybar-on', past);
  }
  window.addEventListener('scroll', buyBarCheck, { passive: true });
  function buyBar(item) {
    buyOffers = null; buyBarCheck();
    var p = item && offersOf(item)[0], offers = $('.offers', main);
    if (!p || !offers) return;
    buybar.innerHTML = '<div class="buybar-in"><div class="bb-t"><span class="bb-name">' + esc(item.line) + '</span><span class="bb-price">' + esc(S.priceLabel(item)) + '</span></div>' +
      '<a class="btn-buy" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + buyText(p) + icon('ext') + '</a></div>';
    buyOffers = offers; buyBarCheck();
  }

  // ---------- phone filter drawer (changes wait for Apply) ----------
  function isPhone() { return window.matchMedia('(max-width: 900px)').matches; }
  function openDrawer(focus) {
    var rail = $('#rail'); if (!rail) return;
    document.body.classList.add('drawer-on', 'no-scroll');
    if (!isPhone()) scrim.hidden = false;
    rail.setAttribute('role', 'dialog'); rail.setAttribute('aria-modal', 'true');
    var b = $('[data-drawer-open]'); if (b) b.setAttribute('aria-expanded', 'true');
    if (focus) { var c = $('[data-drawer-close]', rail); if (c) c.focus(); }
  }
  function closeDrawer(focus) {
    if (!document.body.classList.contains('drawer-on')) return;
    document.body.classList.remove('drawer-on', 'no-scroll');
    if (qv.hidden) scrim.hidden = true;
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

  // ---------- header: aisle menu and search suggestions ----------
  function buildNav() {
    var h = '<div class="menu-x" hidden><button type="button" class="ib" id="menu-close" aria-label="Close menu">' + icon('x') + '</button></div>';
    h += '<div class="cat-item"><a class="cat-a" href="' + U('/shop') + '" data-nav="shop">All products</a></div>';
    C.groups.forEach(function (g) {
      var n = C.items.filter(function (i) { return i.aisles.indexOf(g.id) >= 0; }).length;
      h += '<div class="cat-item" data-dept="' + g.id + '"><button type="button" class="cat-a" data-nav="d:' + g.id + '" aria-expanded="false" aria-haspopup="true">' + esc(g.title) + icon('chev') + '</button>' +
        '<div class="mega"><p>' + esc(g.title) + ' · ' + plural(n, 'product') + '</p>' + typeTiles(g.cats, 'mega-tiles') +
        '<a class="mega-all" href="' + U('/a/' + g.id) + '">Shop all ' + esc(g.title.toLowerCase()) + ' →</a></div></div>';
    });
    h += '<div class="cat-item" data-dept="materials"><button type="button" class="cat-a" data-nav="materials" aria-expanded="false" aria-haspopup="true">Materials' + icon('chev') + '</button>' +
      '<div class="mega"><p>Materials</p>' + matTiles(liveMats(), 'mega-tiles') + '<a class="mega-all" href="' + U('/m') + '">All materials →</a></div></div>';
    h += '<span class="spacer"></span>';
    h += '<div class="cat-item"><a class="cat-a quiet" href="' + U('/brands') + '" data-nav="brands">Brands</a></div>' +
      '<div class="cat-item"><a class="cat-a quiet" href="' + U('/glossary') + '" data-nav="glossary">Glossary</a></div>' +
      '<div class="cat-item"><a class="cat-a quiet" href="' + U('/about') + '" data-nav="about">About</a></div>';
    $('#cats').innerHTML = h;
    $('#foot-shop').innerHTML = '<li><a href="' + U('/shop') + '">All products</a></li>' + C.groups.map(function (g) { return '<li><a href="' + U('/a/' + g.id) + '">' + esc(g.title) + '</a></li>'; }).join('') + '<li><a href="' + U('/m') + '">Materials</a></li>';
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
    Object.keys(C.cats).map(function (k) { return C.cats[k]; }).filter(function (c) { return S.fold(c.title).indexOf(f) >= 0; }).slice(0, 3).forEach(function (c) { var pic = typePic(c.id); out.push('<a href="' + U('/c/' + c.id) + '" role="option">' + (pic ? '<img class="sg-img" src="' + esc(asset(pic.img)) + '" alt="">' : '<span class="sg-img"></span>') + '<span>' + esc(c.title) + '</span><span class="sg-p">' + plural(typeCount(c.id), 'product') + '</span></a>'); });
    pickMaterials().filter(function (m) { return S.fold(m.label).indexOf(f) >= 0; }).slice(0, 2).forEach(function (m) { out.push('<a href="' + U('/m/' + m.id) + '" role="option"><span class="sg-k">Made with</span>' + esc(m.label) + '</a>'); });
    if (GLOSS) Object.keys(TERMS).filter(function (k) { return S.fold(TERMS[k].term).indexOf(f) >= 0; }).slice(0, 2).forEach(function (k) { out.push('<a href="' + U('/glossary/' + k) + '" role="option"><span class="sg-k">Glossary</span>' + esc(TERMS[k].term) + '</a>'); });
    out.push('<a href="' + U('/search', { q: q.trim() }) + '" role="option"><span class="sg-k">Search</span>See all results for “' + esc(q.trim()) + '”</a>');
    sugg.innerHTML = out.join('');
    sugg.hidden = false; qInput.setAttribute('aria-expanded', 'true');
  }
  function closeSugg() { sugg.hidden = true; qInput.setAttribute('aria-expanded', 'false'); }

  // ---------- router ----------
  function route() {
    closeSugg(); closeQuickView(); closeDrawer(false); closeMenu(false); closePop(false); PEND = null; buyBar(null); main.style.minHeight = '';
    var path = currentPath(), q = parseQuery(location.search), p = path.split('/').filter(Boolean), key = p[0] || '';
    var url = location.pathname + location.search;
    if (key === '') renderHome();
    else if (key === 'shop') { STATE = readState('shop', '', q); pageShown = PAGE; renderList(); }
    else if (key === 'a' && groupOf(p[1])) { STATE = readState('dept', p[1], q); pageShown = PAGE; renderList(); }
    else if ((key === 'd' || key === 'a') && renamed('groups', p[1])) { go(U('/a/' + renamed('groups', p[1]), q), true); return; }
    else if (key === 'c' && catOf(p[1])) { STATE = readState('cat', p[1], q); pageShown = PAGE; renderList(); }
    else if (key === 'c' && renamed('cats', p[1])) { go(U('/c/' + renamed('cats', p[1]), q), true); return; }
    else if (key === 'm' && !p[1]) renderMaterials();
    else if (key === 'm' && matScope(p[1])) { STATE = readState('mat', p[1], q); pageShown = PAGE; renderList(); }
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
    else if (STATE && ['shop', 'a', 'c', 'b', 'm', 'search'].indexOf(key) >= 0 && onListing()) { STATE.crit = Object.assign({}, CRIT); STATE.strict = STRICT; setState(STATE); }
    else if (key === 'compare') renderCompare();
    else if (key === 'saved') renderSaved();
    else if (key === '') renderHome();
  }
  // Departments became aisles (/d/toys is now /a/play) and some product types were split or renamed; each aisle and
  // type lists its old ids in `was`, so old links land on the new page.
  function renamed(kind, id) {
    if (kind === 'groups') { if (groupOf(id)) return id; var g = C.groups.filter(function (x) { return x.was.indexOf(id) >= 0; })[0]; return g ? g.id : null; }
    if (catOf(id)) return id;
    var c = Object.keys(C.cats).filter(function (k) { return C.cats[k].was.indexOf(id) >= 0; })[0];
    return c || null;
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
    if (q.dept && !q.cat) { var d = q.dept; delete q.dept; return U('/a/' + (renamed('groups', d) || d), q); }
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
    } else if (t.matches('[data-matgroup]')) {
      // A family: checked includes every member (and, from part-checked, allows their kinds); unchecked leaves them all out.
      var sg = editing(), gid = t.getAttribute('data-matgroup'), was = t.hasAttribute('data-indet');
      var ids = S.MATERIALS.filter(function (m) { return m.group === gid; }).map(function (m) { return m.id; });
      sg.mat = sg.mat.filter(function (x) { return ids.indexOf(x) < 0; }).concat(t.checked ? [] : ids);
      if (t.checked && was) ids.forEach(function (id) { kindsUnder(id).forEach(function (c) { sg.crit[c.id] = false; }); });
      commit(sg);
    } else if (t.matches('[data-mat]')) {
      // A material: unchecked leaves it out; checked includes it, and from part-checked also allows all its kinds.
      var sm = editing(), mid = t.getAttribute('data-mat'), wasMixed = t.hasAttribute('data-indet');
      sm.mat = sm.mat.filter(function (x) { return x !== mid; }).concat(t.checked ? [] : [mid]);
      if (t.checked && wasMixed) kindsUnder(mid).forEach(function (c) { sm.crit[c.id] = false; });
      commit(sm);
    } else if (t.matches('[data-critset]')) {
      var ss = editing(), sid = t.getAttribute('data-critset');
      critSetOf(sid).forEach(function (c) { ss.crit[c.id] = !t.checked; });
      commit(ss);
    } else if (t.matches('[data-crit]')) {
      // In the Materials tree a checked kind is a criterion that is off; checking a kind also includes its material.
      var id = t.getAttribute('data-crit'), val = t.hasAttribute('data-inv') ? !t.checked : t.checked;
      var cu = C.criteria.filter(function (c) { return c.id === id; })[0];
      if (STATE && $('#rail')) {
        var s2 = editing();
        if (id === 'strict') s2.strict = val; else s2.crit[id] = val;
        if (cu && cu.under && t.checked) s2.mat = s2.mat.filter(function (x) { return x !== cu.under; });
        commit(s2);
      } else {
        if (id === 'strict') STRICT = val; else CRIT[id] = val;
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
    if (a && a.id === 'nav-filters' && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && ev.button === 0) { ev.preventDefault(); openFilters(); return; }
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
      if (f === 'q') st.q = '';
      else if (f === 'crit') { if (v === 'strict') st.strict = false; else st.crit[v] = false; }
      else if (f === 'mat-all') st.mat = [];
      else if (f === 'matgroup') st.mat = st.mat.filter(function (x) { return !S.MATERIALS.some(function (m) { return m.id === x && m.group === v; }); });
      else st[f] = st[f].filter(function (x) { return x !== v; });
      PEND = null; setState(st, true);
    } else if (t.matches('[data-quick]')) {
      var sq = copyState(), qf = t.getAttribute('data-quick'), qv = t.getAttribute('data-val');
      if (qf === 'only') sq.mat = t.getAttribute('aria-pressed') === 'true' ? [] : pickIds().filter(function (id) { return id !== qv; });
      else sq[qf] = toggleIn(sq[qf], qv);
      PEND = null; setState(sq, true);
    } else if (t.matches('[data-clear-all]')) {
      var s0 = readState(STATE.kind, STATE.key, STATE.kind === 'search' ? { q: STATE.q } : {}); s0.sort = STATE.sort; s0.all = STATE.all; s0.crit = defaults(); s0.strict = false;
      PEND = null; setState(s0, true);
    } else if (t.matches('[data-crit-reset]')) {
      ev.preventDefault();
      var s4 = editing(), d = critIsDefault(s4.crit, s4.strict) && !s4.mat.length;
      C.criteria.forEach(function (c) { s4.crit[c.id] = d ? false : !!c['default']; }); s4.strict = false; s4.mat = [];
      commit(s4);
    } else if (t.matches('[data-only]')) {
      // "Only" keeps one material (or one family) and leaves every other out.
      var so = editing(), ov = t.getAttribute('data-only');
      var keep = ov.indexOf('g:') === 0 ? S.MATERIALS.filter(function (m) { return m.group === ov.slice(2); }).map(function (m) { return m.id; }) : [ov];
      so.mat = pickIds().filter(function (id) { return keep.indexOf(id) < 0; });
      commit(so);
    } else if (t.matches('[data-tnode]')) {
      var nid = t.getAttribute('data-tnode'), kids = document.getElementById('tk-' + nid), open = t.getAttribute('aria-expanded') !== 'true';
      openNodes[nid] = open; t.setAttribute('aria-expanded', String(open)); if (kids) kids.hidden = !open;
    } else if (t.matches('[data-kind]')) {
      var sk = copyState(), kv = t.getAttribute('data-kind'), ks = kindsOf(matScope(sk.key));
      ks.forEach(function (k) {
        if (kv !== '*' && kv !== k.kind + ':' + k.id) return;
        var on = kv === '*' ? false : !kindOn(sk, k);
        if (k.kind === 'crit') sk.crit[k.id] = on; else sk.std = sk.std.filter(function (x) { return x !== k.id; }).concat(on ? [k.id] : []);
      });
      PEND = null; setState(sk, true);
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
      if (on && currentPath() !== '/saved') toast('Saved to your list. <a href="' + U('/saved') + '">View saved (' + listGet(SAVED_KEY).length + ')</a>');
      if (currentPath() === '/saved') renderSaved();
    } else if (t.matches('[data-compare]')) {
      var cid = t.getAttribute('data-compare');
      if (!listToggle(CMP_KEY, cid, 4)) { announce('Compare holds four products; remove one first.'); t.textContent = 'Compare is full (4)'; return; }
      var inC = listGet(CMP_KEY).indexOf(cid) >= 0;
      $$('[data-compare="' + cid + '"]').forEach(function (b) { b.setAttribute('aria-pressed', inC); var s = b.querySelector('span'); if (s) s.textContent = inC ? 'In compare' : 'Compare'; });
      announce(inC ? 'Added to compare' : 'Removed from compare'); badgeCounts();
      if (currentPath() === '/compare') renderCompare();
    } else if (t.matches('[data-share]')) {
      shareLink(location.origin + t.getAttribute('data-share'), t.getAttribute('data-share-title') + ' · Saved by the Thread');
    } else if (t.matches('[data-take]')) {
      var into = t.getAttribute('data-take-into') === 'saved' ? SAVED_KEY : CMP_KEY, ids = t.getAttribute('data-take').split(',');
      if (into === SAVED_KEY) store(SAVED_KEY, listGet(SAVED_KEY).concat(ids.filter(function (x) { return listGet(SAVED_KEY).indexOf(x) < 0; })));
      else store(CMP_KEY, ids.slice(0, 4));
      badgeCounts(); go(U(into === SAVED_KEY ? '/saved' : '/compare'), true);
      announce(into === SAVED_KEY ? 'Saved to your list' : 'Compare list replaced');
    } else if (t.matches('[data-compare-clear]')) {
      store(CMP_KEY, []); badgeCounts(); if (currentPath() === '/compare') renderCompare();
    } else if (t.matches('[data-qv]')) {
      openQuickView(t.getAttribute('data-qv'), t);
    } else if (t.matches('[data-qv-close]')) {
      closeQuickView();
    } else if (t.matches('[data-photo]')) {
      var gm = $('#g-main'), z = $('.ph-zoom'), ph = t.getAttribute('data-photo');
      if (gm) gm.src = ph; if (z) z.setAttribute('data-zoom', ph);
      $$('.thumb').forEach(function (b) { b.setAttribute('aria-pressed', b === t); });
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
  scrim.addEventListener('click', function () {
    if (document.body.classList.contains('drawer-on')) { PEND = null; closeDrawer(true); renderList(false); } else closeQuickView();
  });
  // The header's Filters button: every filter, from any page. A listing page opens its own filters; elsewhere the
  // shop opens with them.
  function openFilters() {
    if (!onListing()) go(U('/shop'));
    else closeMenu(false);
    PEND = copyState(); openDrawer(true);
  }
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
  // The deploy stamps each build into <meta name="build"> and onto the stylesheet and script URLs, so a fix reaches
  // visitors on their next load instead of after GitHub Pages' ten-minute cache; the data files get the same stamp.
  var BUILD = (document.querySelector('meta[name="build"]') || {}).content || '';
  function get(url) {
    var u = BUILD && BUILD !== 'dev' ? url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(BUILD) : url;
    return fetch(u).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  }
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
