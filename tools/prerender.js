#!/usr/bin/env node
/* Writes a real HTML file for every page search engines should find, so GitHub Pages answers those addresses
   with a 200 and the page's own title, description, share preview and structured data, instead of handing
   them to 404.html (which answers 404 with "noindex"). Each file is index.html with its <head> filled in and
   <main> holding the page's text; app.js then draws the page as usual, so visitors see no difference.

   Usage: node tools/prerender.js <site dir> <site URL>
     node tools/prerender.js _site https://mchelen.github.io/SaferByTheThread/
   Writes <dir>/p/<id>.html, c/<type>.html, a/<dept>.html, b/<brand>.html, m/<material>.html,
   glossary/<term>.html, shop.html, brands.html, about.html, m.html, glossary.html (Pages serves /about from
   about.html), rewrites <dir>/index.html for the home page, and writes <dir>/sitemap.xml and <dir>/robots.txt.
   Run it after the asset URLs are stamped, since every file is a copy of index.html. */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('../assets/catalog.js');

const NAME = 'Saved by the Thread';
const TAGLINE = 'Reading the fine print so you don’t have to.';

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
// A description of at most ~160 characters, cut at a word.
function clip(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  n = n || 160;
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  return cut.slice(0, cut.lastIndexOf(' ') > 60 ? cut.lastIndexOf(' ') : cut.length).replace(/[,;:.\s]+$/, '') + '…';
}
function list(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
// JSON for a <script> block: no "</" can close the tag early.
function ld(o) { return '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>'; }

function build(dir, siteUrl) {
  const SITE = siteUrl.replace(/\/?$/, '/');
  const BASE = new URL(SITE).pathname; // e.g. /SaferByTheThread/
  const abs = (p) => SITE + String(p || '').replace(/^\//, '');
  const href = (p) => BASE + String(p || '').replace(/^\//, '');
  const shell = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
  const gloss = JSON.parse(fs.readFileSync(path.join(dir, 'glossary.json'), 'utf8'));
  const C = S.build(data);
  const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(C.updated || '') ? C.updated : null;
  const pages = [];

  const typeTitle = (id) => (C.cats[id] ? C.cats[id].title : '');
  const groupOf = (id) => C.groups.filter((g) => g.id === id)[0];
  const itemsOf = (fn) => C.items.filter(fn);
  const photo = (item) => (item && item.photos[0] ? abs(item.photos[0]) : null);
  const firstPhoto = (items) => photo(items.filter((i) => i.photos.length)[0]);
  const crumbsLd = (trail) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => Object.assign({ '@type': 'ListItem', position: i + 1, name: t[0] }, t[1] != null ? { item: abs(t[1]) } : {})) });
  const crumbsHtml = (trail) => '<nav class="crumbs" aria-label="Breadcrumb">' +
    trail.map((t) => (t[1] != null ? '<a href="' + esc(href(t[1])) + '">' + esc(t[0]) + '</a>' : '<span>' + esc(t[0]) + '</span>')).join(' › ') + '</nav>';
  const itemLink = (i) => '<li><a href="' + esc(href('/p/' + i.id)) + '">' + esc(i.brand + ' ' + i.line) + '</a> · ' + esc(S.priceFrom(i)) + '</li>';
  const itemListLd = (name, items) => ({ '@context': 'https://schema.org', '@type': 'ItemList', name: name, numberOfItems: items.length,
    itemListElement: items.map((i, k) => ({ '@type': 'ListItem', position: k + 1, url: abs('/p/' + i.id), name: i.brand + ' ' + i.line })) });
  const typeLinks = (ids) => '<ul>' + ids.filter((id) => C.cats[id] && C.items.some((i) => i.cat === id))
    .map((id) => '<li><a href="' + esc(href('/c/' + id)) + '">' + esc(C.cats[id].title) + '</a></li>').join('') + '</ul>';

  function listing(p, h1, intro, items, trail, extra) {
    pages.push({
      path: p, title: h1, desc: intro, image: firstPhoto(items), type: 'website',
      ld: [itemListLd(h1, items)].concat(trail ? [crumbsLd(trail)] : []),
      body: (trail ? crumbsHtml(trail) : '') + '<div class="page prose"><h1>' + esc(h1) + '</h1><p class="lede">' + esc(intro) + '</p>' +
        '<ul>' + items.map(itemLink).join('') + '</ul>' + (extra || '') + '</div>'
    });
  }

  // Home
  pages.push({
    path: '/', title: '', image: firstPhoto(C.items), type: 'website',
    desc: TAGLINE + ' ' + C.items.length + ' toys, beds, bedding, clothes, feeding and nursery things for babies and toddlers, with what each maker says they are made of.',
    ld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, url: SITE, description: TAGLINE }],
    body: '<div class="page prose"><h1>' + esc(NAME) + '</h1><p class="lede">' + esc(TAGLINE) + '</p>' +
      C.groups.map((g) => '<h2><a href="' + esc(href('/a/' + g.id)) + '">' + esc(g.title) + '</a></h2>' + typeLinks(g.cats)).join('') +
      '<h2><a href="' + esc(href('/m')) + '">Shop by material</a></h2><ul>' +
      S.MATERIAL_GROUPS.concat(S.MATERIALS.filter((m) => m.id !== 'synthetic')).map((m) => '<li><a href="' + esc(href('/m/' + m.id)) + '">' + esc(m.label) + '</a></li>').join('') + '</ul>' +
      '<p><a href="' + esc(href('/shop')) + '">All products</a> · <a href="' + esc(href('/brands')) + '">Brands</a> · <a href="' + esc(href('/glossary')) + '">Materials glossary</a> · <a href="' + esc(href('/about')) + '">How this guide works</a></p></div>'
  });

  listing('/shop', 'Shop', C.items.length + ' products for babies and toddlers, each with what the maker says it is made of, what it is stated free of and what no page states.', C.items, [[NAME, '/'], ['All products']]);

  C.groups.forEach((g) => {
    const items = itemsOf((i) => i.aisles.indexOf(g.id) >= 0);
    listing('/a/' + g.id, g.title, g.title + ' for babies and toddlers: ' + plural(items.length, 'product', 'products') + ' across ' + list(g.cats.map((id) => (C.cats[id].short || C.cats[id].title).toLowerCase())) + ', with what each maker says they are made of.',
      items, [[NAME, '/'], [g.title]], '<h2>Product types</h2>' + typeLinks(g.cats));
  });

  Object.keys(C.cats).forEach((id) => {
    const c = C.cats[id], items = itemsOf((i) => i.cat === id);
    if (!items.length) return;
    const g = groupOf(c.group);
    const intro = c.intro || (c.title + ' for babies and toddlers: ' + plural(items.length, 'product', 'products') + ' compared by what each maker says they are made of.');
    listing('/c/' + id, c.title, intro, items, [[NAME, '/']].concat(g ? [[g.title, '/a/' + g.id]] : []).concat([[c.title]]),
      g ? '<h2>More in ' + esc(g.title) + '</h2>' + typeLinks(g.cats.filter((x) => x !== id)) : '');
  });

  Object.keys(C.brands).forEach((id) => {
    const b = C.brands[id];
    listing('/b/' + id, b.name, b.name + ': ' + plural(b.items.length, 'product', 'products') + ' for babies and toddlers (' + list(Array.from(new Set(b.items.map((i) => typeTitle(i.cat).toLowerCase())))) + '), with what the maker says each is made of.',
      b.items, [[NAME, '/'], ['Brands', '/brands'], [b.name]]);
  });

  const mats = S.MATERIALS.filter((m) => m.id !== 'synthetic');
  S.MATERIAL_GROUPS.map((g) => ({ id: g.id, label: g.label, ids: mats.filter((m) => m.group === g.id).map((m) => m.id) }))
    .concat(mats.map((m) => ({ id: m.id, label: m.label, ids: [m.id] })))
    .forEach((sc) => {
      const items = itemsOf((i) => i.materials.some((x) => sc.ids.indexOf(x) >= 0));
      if (!items.length) return;
      listing('/m/' + sc.id, sc.label, sc.label + ' in baby and toddler products: ' + plural(items.length, 'product', 'products') + ' whose maker names ' + sc.label.toLowerCase() + ' among the materials.',
        items, [[NAME, '/'], ['Materials', '/m'], [sc.label]]);
    });

  pages.push({
    path: '/m', title: 'Materials', type: 'website', image: firstPhoto(C.items),
    desc: 'Browse baby and toddler products by what they are made of: wool, cotton, linen, silk, wood, natural rubber, leather, silicone and more.',
    body: crumbsHtml([[NAME, '/'], ['Materials']]) + '<div class="page prose"><h1>Materials</h1><ul>' +
      S.MATERIAL_GROUPS.concat(mats).map((m) => '<li><a href="' + esc(href('/m/' + m.id)) + '">' + esc(m.label) + '</a></li>').join('') + '</ul></div>'
  });

  const brands = Object.keys(C.brands).map((k) => C.brands[k]).sort((a, b) => a.name.localeCompare(b.name));
  pages.push({
    path: '/brands', title: 'Brands', type: 'website', image: firstPhoto(C.items),
    desc: brands.length + ' brands of toys, bedding, clothes and nursery things for babies and toddlers, with what each maker says their products are made of.',
    body: crumbsHtml([[NAME, '/'], ['Brands']]) + '<div class="page prose"><h1>Brands</h1><ul>' +
      brands.map((b) => '<li><a href="' + esc(href('/b/' + b.id)) + '">' + esc(b.name) + '</a> (' + b.items.length + ')</li>').join('') + '</ul></div>'
  });

  const nprod = C.items.reduce((n, i) => n + i.products.length, 0);
  pages.push({
    path: '/about', title: 'About', type: 'website', image: firstPhoto(C.items),
    desc: NAME + ' lists ' + C.items.length + ' products for babies and toddlers and reports what makers and stores say about materials, finishes and standards. It sells nothing.',
    body: crumbsHtml([[NAME, '/'], ['How this guide works']]) + '<div class="page prose"><h1>How this guide works</h1><p class="lede">' + esc(NAME) + ' lists ' + C.items.length + ' products (' + nprod + ' store listings from ' + brands.length +
      ' brands) for babies and toddlers. It reports what makers and stores say about materials, finishes and standards, and what they leave out. It doesn’t rank products by safety or risk, and it sells nothing: every product links to the store that does.</p></div>'
  });

  const terms = [];
  gloss.sections.forEach((s) => s.terms.forEach((t) => terms.push(t)));
  pages.push({
    path: '/glossary', title: 'Glossary', type: 'website',
    desc: clip(gloss.intro || ('A glossary of ' + terms.length + ' materials, treatments and standards found in baby and toddler products.')),
    ld: [{ '@context': 'https://schema.org', '@type': 'DefinedTermSet', name: gloss.title || 'Materials glossary', url: abs('/glossary') }],
    body: crumbsHtml([[NAME, '/'], ['Glossary']]) + '<div class="page prose"><h1>' + esc(gloss.title || 'Glossary') + '</h1><p class="lede">' + esc(gloss.intro || '') + '</p>' +
      gloss.sections.map((s) => '<h2>' + esc(s.title) + '</h2><ul>' + s.terms.map((t) => '<li><a href="' + esc(href('/glossary/' + t.id)) + '">' + esc(t.term) + '</a></li>').join('') + '</ul>').join('') + '</div>'
  });
  terms.forEach((t) => {
    pages.push({
      path: '/glossary/' + t.id, title: t.term + ' · Glossary', type: 'article',
      desc: clip(t.definition),
      ld: [{ '@context': 'https://schema.org', '@type': 'DefinedTerm', name: t.term, description: t.definition, url: abs('/glossary/' + t.id),
        inDefinedTermSet: abs('/glossary') }, crumbsLd([[NAME, '/'], ['Glossary', '/glossary'], [t.term]])],
      body: crumbsHtml([[NAME, '/'], ['Glossary', '/glossary'], [t.term]]) + '<div class="page prose"><h1>' + esc(t.term) + '</h1>' +
        (t.aka && t.aka.length ? '<p class="aka">Also called ' + esc(t.aka.join(', ')) + '</p>' : '') +
        '<p>' + esc(t.definition) + '</p>' + (t.on_this_site ? '<h2>On this site</h2><p>' + esc(t.on_this_site) + '</p>' : '') + '</div>'
    });
  });

  // Products
  C.items.forEach((i) => {
    const name = i.brand + ' ' + i.line, c = C.cats[i.cat], g = groupOf(i.group);
    const trail = [[NAME, '/']].concat(g ? [[g.title, '/a/' + g.id]] : []).concat(c ? [[c.title, '/c/' + c.id]] : []).concat([[name]]);
    const desc = name + '.' + (i.uses.length ? ' Made with: ' + i.uses.join(', ') + '.' : '') +
      (i.unconfirmed.length ? ' Not stated: ' + i.unconfirmed.join(', ') + '.' : '');
    const offers = i.byCost.filter((p) => p.usd != null && !p.approx).map((p) => ({ '@type': 'Offer', url: p.url, price: p.usd.toFixed(2), priceCurrency: 'USD',
      seller: { '@type': 'Organization', name: p.store } }));
    const product = { '@context': 'https://schema.org', '@type': 'Product', name: name, url: abs('/p/' + i.id), brand: { '@type': 'Brand', name: i.brand },
      description: clip(desc, 500), category: c ? c.title : undefined, material: i.uses.join('; ') || undefined };
    if (i.photos.length) product.image = i.photos.map(abs);
    if (offers.length) product.offers = offers.length === 1 ? offers[0] : offers;
    const sec = (h, a) => (a.length ? '<h2>' + esc(h) + '</h2><ul>' + a.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '');
    pages.push({
      path: '/p/' + i.id, title: name, desc: clip(desc), image: photo(i), type: 'product',
      ld: [product, crumbsLd(trail)],
      body: crumbsHtml(trail) + '<div class="page prose"><h1>' + esc(name) + '</h1><p class="lede">' + esc((c ? c.title + ' · ' : '') + i.ageLabel + ' · ' + S.priceLabel(i)) + '</p>' +
        sec('Made with', i.uses) + sec('Stated free of', i.free || []) + sec('Not stated', i.unconfirmed) + sec('Flagged parts', i.outside) +
        '<h2>Where to buy</h2><ul>' + i.byCost.map((p) => '<li><a href="' + esc(p.url) + '" rel="nofollow noopener">' + esc(p.name) + ' at ' + esc(p.store) + '</a>' + (p.price ? ' · ' + esc(p.price) : '') + '</li>').join('') + '</ul>' +
        (c ? '<p><a href="' + esc(href('/c/' + c.id)) + '">More ' + esc(c.title.toLowerCase()) + '</a> · <a href="' + esc(href('/b/' + i.brandId)) + '">More from ' + esc(i.brand) + '</a></p>' : '') + '</div>'
    });
  });

  // Write
  const written = [];
  pages.forEach((pg) => {
    const html = render(shell, pg, { SITE, BASE, abs, href });
    const rel = pg.path === '/' ? 'index.html' : pg.path.replace(/^\//, '') + '.html';
    const out = path.join(dir, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    // /m and /glossary are also folders; if Pages answers the folder first (/m/), it finds the same page there.
    if (pg.path === '/m' || pg.path === '/glossary') fs.mkdirSync(path.join(dir, pg.path.slice(1)), { recursive: true }), fs.writeFileSync(path.join(dir, pg.path.slice(1), 'index.html'), html);
    written.push(pg.path);
  });

  const urls = written.map((p) => '  <url><loc>' + esc(abs(p === '/' ? '' : p)) + '</loc>' + (lastmod ? '<lastmod>' + lastmod + '</lastmod>' : '') + '</url>').join('\n');
  fs.writeFileSync(path.join(dir, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n');
  // Crawlers only read robots.txt at the root of a host, so this one counts once the site has its own domain.
  fs.writeFileSync(path.join(dir, 'robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: ' + abs('sitemap.xml') + '\n');
  return written;
}

function render(shell, pg, ctx) {
  const url = ctx.abs(pg.path === '/' ? '' : pg.path);
  const title = (pg.title ? pg.title + ' · ' : '') + NAME;
  const desc = clip(pg.desc);
  const meta = [
    '<link rel="canonical" href="' + esc(url) + '">',
    '<meta property="og:site_name" content="' + esc(NAME) + '">',
    '<meta property="og:type" content="' + esc(pg.type || 'website') + '">',
    '<meta property="og:title" content="' + esc(pg.title || NAME) + '">',
    '<meta property="og:description" content="' + esc(desc) + '">',
    '<meta property="og:url" content="' + esc(url) + '">',
    pg.image ? '<meta property="og:image" content="' + esc(pg.image) + '">' : '',
    '<meta name="twitter:card" content="' + (pg.image ? 'summary_large_image' : 'summary') + '">'
  ].concat((pg.ld || []).map(ld)).filter(Boolean).join('\n');
  let h = shell
    .replace(/\n?<!--seo-->[\s\S]*?<!--\/seo-->/g, '') // a second run replaces the first one's tags
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(desc) + '">\n<!--seo-->\n' + meta + '\n<!--/seo-->')
    // Files sit in folders (p/<id>.html), so every relative address becomes absolute. app.js reads the site's
    // base path from its own script address, which this also fixes.
    .replace(/(href|src)="(?!https?:|data:|#|\/)([^"]+)"/g, (m, a, v) => a + '="' + ctx.BASE + v + '"')
    // Root-relative links in the shell (/about) point at the site, not the host.
    .replace(/href="\/(?!\/)([^"]*)"/g, (m, v) => (('/' + v).indexOf(ctx.BASE) === 0 && ctx.BASE !== '/' ? m : 'href="' + ctx.BASE + v + '"'))
    .replace(/<main id="main" tabindex="-1">[\s\S]*?<\/main>/, '<main id="main" tabindex="-1">\n<div class="wrap">' + pg.body.replace(/\$/g, '$$$$') + '</div>\n</main>');
  return h;
}

module.exports = { build, clip };

if (require.main === module) {
  const [dir, url] = process.argv.slice(2);
  if (!dir || !url) { console.error('Usage: node tools/prerender.js <site dir> <site URL>'); process.exit(2); }
  const out = build(dir, url);
  console.log('Wrote ' + out.length + ' pages, sitemap.xml and robots.txt into ' + dir);
}
