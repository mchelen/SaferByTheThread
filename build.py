"""Build the Safer by the Thread site from data.json (schema 3) and, if present, glossary.json.

Usage: python3 -I build.py [OUT_DIR]   (default: ./site)
Downloads any missing photo listed as img_src into img/, resizes it, then writes
OUT_DIR/index.html, OUT_DIR/img/*.jpg and OUT_DIR/files.json (the Artifact publish map).
"""
import html, json, os, re, shutil, subprocess, sys, tempfile, unicodedata
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(HERE, 'site')
E = html.escape
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
CRITERIA = []
ROWS = [('uses', 'r-uses', '✓', 'Made with'), ('free', 'r-free', '⊘', 'Stated free of'),
        ('unconfirmed', 'r-unk', '?', 'Not stated'), ('outside', 'r-out', '✕', 'Flagged parts')]


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def fetch_photo(key, url):
    dest = os.path.join(HERE, 'img', key + '.jpg')
    if os.path.exists(dest) or not url:
        return
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, 'raw')
        subprocess.run(['curl', '-sSL', '-A', UA, '--max-time', '40', '-o', raw, 'https:' + url if url.startswith('//') else url])
        try:
            im = Image.open(raw).convert('RGBA')
        except Exception:
            print('photo failed:', key, url)
            return
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        im = bg.convert('RGB')
        im.thumbnail((640, 640))
        im.save(dest, quality=80)


# Chip text -> glossary term id. Checked in order; a chip can link several terms, never overlapping.
TERM_KEYS = [
    ('superwash', r'superwash|shrink-proofing|machine washable|wool treatments?|treatment on the (?:merino|wool)|treatment of the wool'),
    ('gots', r'gots'), ('gols', r'gols'), ('oeko-tex', r'oeko-tex'),
    ('flammability', r'flame retardants?|fire barrier'),
    ('natural-rubber', r'natural (?:vulcanised )?rubber(?: latex)?|rubber additives'),
    ('latex-foam', r'(?:natural |organic )?(?:dunlop |talalay )?latex(?! product)(?: core| insert)?|dunlop|talalay'),
    ('plasticisers', r'phthalates?|plastici[sz]ers?'), ('pvc', r'pvc|vinyl'),
    ('bpa', r'bpa|bps'), ('tpr', r'tpr'), ('eva', r'(?:algae-based )?eva'),
    ('synthetic-rubber', r'synthetic rubber|rubber type(?: in outsole)?(?: \(natural or synthetic\))?|outsole compound'),
    ('polyurethane', r'polyurethane(?: film| foam)?|tpu|synthetic foam|(?<!pla )foam'),
    ('polyester', r'polyester(?: binder)?|synthetic (?:batting|fill)|micro-fleece'),
    ('platinum', r'platinum(?:-cured)?'), ('lfgb', r'lfgb'), ('arrete', r'arrêté'),
    ('migration', r'(?:published )?test report|finished-product testing|tested to us rules'),
    ('silicone', r'silicone'),
    ('chrome', r'chrome(?:-free)?(?: tanning)?|tanning(?: method)?'),
    ('leather', r'leather|calfskin|suede|sheepskin'),
    ('merino', r'merino(?: lambswool)?'), ('felt', r'felt(?:ed wool)?|wool melton|melton'),
    ('wool', r'(?:lambs)?wool|mohair'), ('organic', r'organic'), ('cotton', r'cotton'), ('linen', r'linen'),
    ('silk', r'silk'), ('kapok', r'kapok'), ('coir', r'coir'), ('buckwheat', r'buckwheat(?: hulls)?'),
    ('food-grade', r'food[- ]grade'), ('non-toxic', r'non-toxic'),
    ('dyes', r'(?:azo-free )?dyes?|pigments?|colou?rant|colouring|printing inks?|ink binder'),
    ('linseed', r'linseed(?: oil)?|flaxseed(?: oil)?'), ('beeswax', r'beeswax'),
    ('water-based', r'water-based paint|paint'),
    ('hardwood', r'(?:solid )?hardwood|plywood|particle board|fiberboard|veneer|layered wood|engineered wood|wood frame|wood type|maple|pine|beech|walnut|cherry|oak|birch|poplar|ash|solid wood'),
    ('plastic', r'plastics?|polypropylene|polycarbonate|polyethylene|pe beans|pla|nylon|viscose|petrochemicals?|synthetics'),
    ('hidden', r'(?:seam |hem |tufting )?thread(?: fibre)?|zippers?|glues?|adhesive(?: resin)?|elastic(?:ized)?|closures?|lining|hook-and-loop|velcro'),
    ('toy-safety', r'age rating'),
]


def load_glossary():
    """glossary.json: {sections: [{id, title, terms: [{id, term, definition, on_this_site, what_sources_say, sources}]}]}."""
    p = os.path.join(HERE, 'glossary.json')
    if not os.path.exists(p):
        return None
    return json.load(open(p))


def linker(gloss):
    ids = {t['id'] for s in gloss['sections'] for t in s['terms']} if gloss else set()
    keys = [(tid, re.compile(r'(?<![a-zà-ÿ])(?:' + rx + r')(?![a-zà-ÿ])', re.I)) for tid, rx in TERM_KEYS if tid in ids]
    def link(text):
        spans = []
        for tid, rx in keys:
            for m in rx.finditer(text):
                if not any(m.start() < b and a < m.end() for a, b, _ in spans):
                    spans.append((m.start(), m.end(), tid))
        out, pos = '', 0
        for a, b, tid in sorted(spans):
            out += E(text[pos:a]) + f'<a href="#{tid}">{E(text[a:b])}</a>'
            pos = b
        return out + E(text[pos:])
    return link


def photo(e):
    n = len(e['products'])
    badge = f'<span class="n">{n} products</span>' if n > 1 else ''
    if e.get('img') and os.path.exists(os.path.join(HERE, 'img', e['img'] + '.jpg')):
        return f'<div class="plate"><img src="img/{e["img"]}.jpg" alt="{E(e["brand"] + " " + e["line"])}" loading="lazy" width="640" height="480">{badge}</div>'
    return f'<div class="plate empty"><span>No store photo saved</span><a href="{E(e["products"][0]["url"])}" target="_blank" rel="noopener">See it on the product page</a>{badge}</div>'


def card(e, link):
    rows = ''.join(
        f'<div class="row {cls}"><span class="ic" aria-hidden="true">{icon}</span><dt>{label}</dt><dd>'
        + ''.join(f'<span class="chip">{link(x)}</span>' for x in e[key]) + '</dd></div>'
        for key, cls, icon, label in ROWS if e.get(key))
    ev = ''
    if e.get('quote'):
        ev = f'<p class="ev">From the store page: <q>{E(e["quote"])}</q></p>'
    elif e.get('evidence'):
        ev = f'<p class="ev">{E(e["evidence"])}</p>'
    note = f'<p class="note">{E(e["note"])}</p>' if e.get('note') else ''
    prods = ''.join(
        f'<li><span class="pn">{E(p["name"])}</span>'
        + (f'<span class="pnote">{E(p["note"])}</span>' if p.get('note') else '')
        + f'<span class="pp">{E(p["price"])}</span>'
        + f'<a class="store" href="{E(p["url"])}" target="_blank" rel="noopener">{E(p["store"])} ↗</a></li>'
        for p in e['products'])
    _, misses, unstated = evaluate(e)
    st = status_html(misses, unstated)
    return f'''<article class="card{' most' if misses else ''}" id="{e['id']}" data-id="{e['id']}">
{photo(e)}
<div class="body">
<div><p class="brand">{E(e["brand"])}</p><h4>{E(e["line"])}</h4><p class="status{' miss' if misses else ''}">{st}</p></div>
<dl class="check">{rows}</dl>
{ev}{note}
<ul class="prods">{prods}</ul>
</div></article>'''


def evaluate(e, chosen=None):
    """Status of an entry under a filter choice (default: each criterion's default). Mirrors apply() in template.html."""
    misses, unstated = [], []
    for c in CRITERIA:
        on = c['default'] if chosen is None else chosen[c['id']]
        f = e['facts'].get(c['id'])
        if c['kind'] == 'contains':
            if on and c['id'] in e.get('contains', []):
                misses.append(c['short'])
        elif on and f is not None:
            if f == 'no' or (c['kind'] == 'require' and f != 'yes'):
                misses.append(c['short'])
            elif f == 'unknown':
                unstated.append(c['short'])
    return not misses, misses, unstated


def status_html(misses, unstated):
    if misses:
        return 'Misses: ' + E(', '.join(misses))
    return 'Meets your filters' + (f'<span class="unst"> · not stated: {E(", ".join(unstated).lower())}</span>' if unstated else '')


def section(c, link):
    ok = [e for e in c['entries'] if evaluate(e)[0]]
    miss = [e for e in c['entries'] if not evaluate(e)[0]]
    s = (f'<section id="{c["id"]}" class="cat" data-type="{c["id"]}"><header class="cat-h"><h3 class="cat-title">{E(c["title"])}</h3>'
         f'<p class="count">{len(ok)} of {len(c["entries"])} meet your filters</p></header>')
    if c.get('intro'):
        s += f'<p class="intro">{E(c["intro"])}</p>'
    s += '<div class="grid meets">' + '\n'.join(card(e, link) for e in ok) + '</div>'
    s += f'<p class="none"{"" if not ok else " hidden"}>Nothing in this type meets your current filters.</p>'
    s += (f'<details class="misses"{"" if miss else " hidden"}><summary>{len(miss)} more {"item misses" if len(miss) == 1 else "items miss"} your filters</summary><div class="grid">'
          + '\n'.join(card(e, link) for e in miss) + '</div></details>')
    if c.get('outro'):
        s += f'<p class="outro">{E(c["outro"])}</p>'
    return s + '</section>'


def filters_html(groups, terms):
    kinds = [('avoid contains', 'Hide items that have'), ('require', 'Hide items unless the maker states')]
    fs = []
    for k, title in kinds:
        items = []
        for c in CRITERIA:
            if c['kind'] not in k.split():
                continue
            label = c['label']
            g = f' <a class="gl" href="#{c["term"]}" aria-label="Glossary: {E(c["short"])}">?</a>' if c.get('term') in terms else ''
            items.append(f'<label class="crit"><input type="checkbox" data-crit="{c["id"]}"{" checked" if c["default"] else ""}>'
                         f'<span><b>{E(label[0].upper() + label[1:])}</b>{g}<small>{E(c["help"])}</small></span></label>')
        fs.append(f'<fieldset><legend>{title}</legend>{"".join(items)}</fieldset>')
    opts = ''.join(f'<optgroup label="{E(g["title"])}">' + ''.join(f'<option value="{c["id"]}">{E(c["title"])}</option>' for c in g['categories']) + '</optgroup>' for g in groups)
    return (f'<div class="fgrid">{"".join(fs)}</div>'
            '<div class="frow"><label class="crit strict"><input type="checkbox" id="strict"><span><b>Details that aren\'t stated</b>'
            '<small>When on, an item is hidden if a detail one of your switches covers isn\'t stated on its page.</small></span></label>'
            f'<label class="fsel">Product type<select id="ftype"><option value="">All types</option>{opts}</select></label>'
            '<label class="fsel">Brand or product<input type="search" id="fq" placeholder="e.g. Maple Landmark"></label>'
            '<button type="button" id="freset">Reset to defaults</button></div>')


def brands_section(groups):
    by = {}
    for g in groups:
        for c in g['categories']:
            for e in c['entries']:
                by.setdefault(e['brand'], []).append((e, c))
    items = []
    for b in sorted(by, key=lambda s: unicodedata.normalize("NFKD", s).lower()):
        links = ' <span class="sep">·</span> '.join(f'<a href="#{e["id"]}">{E(c.get("short", c["title"]))}: {E(e["line"])}</a>' for e, c in by[b])
        items.append(f'<li><b>{E(b)}</b>{links}</li>')
    return ('<section id="brands" class="brands"><h2>Brands</h2><p>Every brand in the guide, with links to its entries.</p>'
            f'<ul class="brand-list">{"".join(items)}</ul></section>'), len(by)


def glossary_section(g):
    if not g:
        return ''
    types = g.get('source_types', {})
    jump, parts = [], []
    for sec in g['sections']:
        jump.append(f'<a href="#gs-{sec["id"]}">{E(sec["title"])}<span>{len(sec["terms"])}</span></a>')
        cards = []
        for t in sec['terms']:
            aka = f'<p class="aka">Also called {E(", ".join(t["aka"]))}</p>' if t.get('aka') else ''
            srcs = ''.join(
                f'<li><span class="rt">{E(types.get(r.get("type"), r.get("type", "")))}</span>'
                f'<a href="{E(r["url"])}" target="_blank" rel="noopener">{E(r["title"])}</a>'
                f'{" <span class=pub>" + E(r["publisher"]) + "</span>" if r.get("publisher") else ""}</li>' for r in t.get('sources', []))
            cards.append(f'<article class="term" id="{E(t["id"])}"><h4>{E(t["term"])}</h4>{aka}<p>{E(t["definition"])}</p>'
                         f'<p class="lab">On this site</p><p>{E(t["on_this_site"])}</p>'
                         f'<p class="lab">What sources say</p><p>{E(t["what_sources_say"])}</p>'
                         + (f'<details><summary>Sources ({len(t["sources"])})</summary><ul>{srcs}</ul></details>' if srcs else '')
                         + '</article>')
        parts.append(f'<div class="gsec" id="gs-{sec["id"]}"><h3>{E(sec["title"])}</h3><div class="terms">{"".join(cards)}</div></div>')
    return (f'<section id="glossary" class="glossary"><h2>{E(g.get("title", "Glossary"))}</h2><p>{E(g.get("intro", ""))}</p>'
            f'<nav class="gjump" aria-label="Glossary sections">{"".join(jump)}</nav>{"".join(parts)}</section>')


def main():
    data = json.load(open(os.path.join(HERE, 'data.json')))
    assert data.get('schema') == 3, 'data.json must be schema 3'
    CRITERIA[:] = data['criteria']
    groups = data['groups']
    entries = [e for g in groups for c in g['categories'] for e in c['entries']]
    for e in entries:
        if e.get('img'):
            fetch_photo(e['img'], e.get('img_src'))
    gloss = load_glossary()
    nterms = sum(len(s['terms']) for s in gloss['sections']) if gloss else 0
    link = linker(gloss)
    nav, body = [], []
    for g in groups:
        nav.append(f'<a class="grp" href="#{g["id"]}">{E(g["title"])}</a>')
        nav += [f'<a href="#{c["id"]}" data-nav="{c["id"]}">{E(c.get("short", c["title"]))}<span>{sum(evaluate(e)[0] for e in c["entries"])}</span></a>' for c in g['categories']]
        src = f' <a href="{E(g["source"])}" target="_blank" rel="noopener">Read the post</a>.' if g.get('source') else ''
        body.append(f'<section id="{g["id"]}" class="group"><header class="group-h"><h2>{E(g["title"])}</h2><p>{E(g["blurb"])}{src}</p></header>'
                    + '\n'.join(section(c, link) for c in g['categories']) + '</section>')
    brands, nbrands = brands_section(groups)
    nav.append('<a class="grp" href="#brands">Index</a><a href="#brands">Brands<span>%d</span></a>' % nbrands)
    if gloss:
        nav.append(f'<a href="#glossary">Glossary<span>{nterms}</span></a>')
    tpl = open(os.path.join(HERE, 'template.html')).read()
    out = (tpl.replace('{{NAV}}', '\n'.join(nav)).replace('{{SECTIONS}}', '\n'.join(body))
              .replace('{{FILTERS}}', filters_html(groups, {t['id'] for sec in gloss['sections'] for t in sec['terms']} if gloss else set()))
              .replace('{{CRITERIA_JSON}}', json.dumps({'criteria': data['criteria'], 'entries': {e['id']: {'facts': e['facts'], 'contains': e.get('contains', []), 'q': ' '.join([e['brand'], e['line']] + [p['name'] for p in e['products']]).lower()} for e in entries}}, ensure_ascii=False).replace('</', '<\\/'))
              .replace('{{TERMS_JSON}}', json.dumps({t['id']: {'t': t['term'], 'd': t['definition'], 's': t['on_this_site']} for sec in (gloss or {'sections': []})['sections'] for t in sec['terms']}, ensure_ascii=False).replace('</', '<\\/'))
              .replace('{{NMEET}}', str(sum(evaluate(e)[0] for e in entries)))
              .replace('{{BRANDS}}', brands).replace('{{GLOSSARY}}', glossary_section(gloss))
              .replace('{{GLOSSARY_LINK}}', ' Underlined materials link to their <a href="#glossary">glossary</a> entry.' if gloss else '')
              .replace('{{NENTRIES}}', str(len(entries))).replace('{{NPRODUCTS}}', str(sum(len(e['products']) for e in entries)))
              .replace('{{NCATS}}', str(sum(len(g['categories']) for g in groups)))
              .replace('{{ASK}}', '\n'.join(f'<li>{E(a)}</li>' for a in data['ask'])).replace('{{UPDATED}}', E(data['updated'])))
    os.makedirs(os.path.join(OUT, 'img'), exist_ok=True)
    open(os.path.join(OUT, 'index.html'), 'w').write(out)
    used = sorted({e['img'] for e in entries if e.get('img') and os.path.exists(os.path.join(HERE, 'img', e['img'] + '.jpg'))})
    for k in used:
        shutil.copy(os.path.join(HERE, 'img', k + '.jpg'), os.path.join(OUT, 'img', k + '.jpg'))
    json.dump({f'img/{k}.jpg': f'img/{k}.jpg' for k in used}, open(os.path.join(OUT, 'files.json'), 'w'), indent=0)
    print(f'{len(entries)} entries, {sum(len(e["products"]) for e in entries)} products, {nterms} glossary terms, {len(used)} photos -> {OUT}')


if __name__ == '__main__':
    main()
