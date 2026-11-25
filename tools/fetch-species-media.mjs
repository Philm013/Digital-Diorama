// Real photos, range maps and short descriptions for the species cards (dev tool).
//
//   node tools/fetch-species-media.mjs                      every living species not done yet
//   node tools/fetch-species-media.mjs --only mammal/zebra,bird/robin --refresh
//   node tools/fetch-species-media.mjs --all                redo every species (from the cache)
//   node tools/fetch-species-media.mjs --credits            only rewrite public/species/CREDITS.md
//
// For each living species in the catalog it finds the taxon on Wikidata (by its scientific name,
// then other names) and takes the item's own picture (P18) and range map (P181) from Wikimedia
// Commons, but only when the file's licence lets anyone reuse it: public domain, CC0, CC BY or
// CC BY-SA (read from the machine-readable licence data on the file's page). If Commons has no
// photo it can use, it takes a curated or the most-favourited research-grade photo on iNaturalist
// with one of those licences. The description is the opening of the species' Wikipedia article
// (CC BY-SA, via iNaturalist), shortened. Pictures are resized and saved as WebP in
// public/species/, with credits and text in public/species/media.json and a credits list in
// public/species/CREDITS.md. Responses are cached in .cache/species-media, so a re-run only
// fetches what is missing; --refresh fetches again.
//
// Picks can be pinned in PIN below (a Commons file or an iNaturalist photo id) when the
// automatic choice is a poor likeness. Uses the Playwright Chromium already on the machine to
// read the catalog (through a Vite dev server) and to resize images. Behind a proxy, run it
// with NODE_USE_ENV_PROXY=1 so Node's fetch uses it.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => { if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]); return acc; }, []));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/species');
const DATA = path.join(OUT, 'media.json');
const CACHE = path.join(ROOT, '.cache/species-media');
const PORT = Number(args.port ?? 5197);
const REFRESH = !!args.refresh;
// Wikimedia asks scripts to say who they are: add a way to reach you here if you run this often.
const UA = String(args.ua ?? 'species-card-builder/1.0 (educational species cards; occasional batch)');
// cards show photos about 370 px wide: 480 px keeps all of them to roughly 12 MB
const PHOTO = { max: 480, quality: 0.55 };
const MAP = { max: 480, quality: 0.8 };
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(CACHE, 'http'), { recursive: true });

/**
 * How to look up the entries without a plain species name, and picks pinned by hand.
 * `titles`: English Wikipedia titles to find the Wikidata item by (tried before the names);
 * `also`: titles to look for a photo under when the species has none (its genus or phylum);
 * `skip`: Commons files not to use (old drawings, labelled diagrams, a market stall…);
 * `commons`: a Commons file to use as the photo; `inat`: an iNaturalist photo id; `noMap`: skip the range map;
 * `noInat`: no description or sightings (a general model, such as "Broadleaf tree");
 * `noPhoto`: no picture (only drawings exist of it: its card shows the 3D model instead).
 */
const PIN = {
  'aqua/soft-coral': { titles: ['Xenia (coral)', 'Alcyonacea'] },
  'aqua/anemone': { titles: ['Sea anemone'] },
  'aqua/stony-coral': { titles: ['Scleractinia'] },
  'aqua/plate-coral': { titles: ['Acropora cytherea', 'Acropora'] },
  'aqua/cleaner-shrimp': { titles: ['Lysmata amboinensis'] },
  'aqua/hermit-crab': { titles: ['Hermit crab'] },
  'aqua/neon-school': { titles: ['Neon tetra'] },
  'aqua/vallisneria': { titles: ['Vallisneria'] },
  'plant/nepenthes-pitcher-plant': { titles: ['Nepenthes'] },
  'plant/sundew': { titles: ['Drosera'] },
  'plant/geranium': { titles: ['Pelargonium'] },
  'tree/broadleaf': { titles: ['Tree'] },
  'grove/birch': { titles: ['Betula pendula'] },
  'grove/mixed': { titles: ['Temperate broadleaf and mixed forests', 'Mixed forest'], noMap: true },
  'grove/pines': { titles: ['Pinus sylvestris'] },
  'grove/palms': { titles: ['Date palm'] },
  'grove/willows': { titles: ['Willow'] },
  'feature/log': { titles: ['Coarse woody debris', 'Nurse log'], noMap: true },
  'mammal/dog': { titles: ['Labrador Retriever'] },
  // tiny animals few people have photographed: a photo of their group
  'wild/hairyback': { also: ['Chaetonotus', 'Gastrotricha'] },
  'wild/symbion': { also: ['Cycliophora'] },
  'wild/xenoturbella': { also: ['Xenoturbella', 'Xenacoelomorpha'] },
};
// (hand-picked fixes after looking at the results; "_" keys are notes)
for (const [k, v] of Object.entries(readJson(path.join(ROOT, 'tools/species-media-pins.json')) ?? {})) if (!k.startsWith('_')) PIN[k] = { ...PIN[k], ...v };

/* ------------------------------------------------------------------ http with a disk cache */
const last = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
/** GET a URL (text or bytes), following redirects; cached by URL. Returns { status, url, body } */
async function get(url, { bytes = false } = {}) {
  const key = crypto.createHash('sha1').update(url).digest('hex');
  const metaFile = path.join(CACHE, 'http', key + '.json');
  const bodyFile = path.join(CACHE, 'http', key + (bytes ? '.bin' : '.txt'));
  if (!REFRESH && fs.existsSync(metaFile) && fs.existsSync(bodyFile)) {
    const meta = readJson(metaFile);
    return { ...meta, body: bytes ? fs.readFileSync(bodyFile) : fs.readFileSync(bodyFile, 'utf8') };
  }
  const host = new URL(url).host;
  // be gentle: iNaturalist asks for about one request a second, Wikimedia for no bursts
  const gap = host.includes('inaturalist') ? 1100 : 350;
  for (let attempt = 0; ; attempt++) {
    const wait = (last.get(host) ?? 0) + gap - Date.now();
    if (wait > 0) await sleep(wait);
    last.set(host, Date.now());
    let res;
    try { res = await fetch(url, { headers: { 'user-agent': UA, accept: bytes ? 'image/*' : '*/*' }, redirect: 'follow' }); }
    catch (e) { if (attempt < 3) { await sleep(2000 * (attempt + 1)); continue; } throw e; }
    // (a picture smaller than the width asked for redirects to its original file, which Wikimedia may
    // refuse to scripts with 429: the caller then asks for a smaller size, so don't wait for it)
    if ((res.status === 429 || res.status >= 500) && attempt < (bytes ? 0 : 4)) { await sleep(4000 * (attempt + 1)); continue; }
    const body = bytes ? Buffer.from(await res.arrayBuffer()) : await res.text();
    const meta = { status: res.status, url: res.url, type: res.headers.get('content-type') ?? '' };
    if (res.status === 200) { fs.writeFileSync(bodyFile, body); fs.writeFileSync(metaFile, JSON.stringify(meta)); }
    return { ...meta, body };
  }
}
async function getJson(url) { const r = await get(url); if (r.status !== 200) return null; try { return JSON.parse(r.body); } catch { return null; } }

/* ------------------------------------------------------------------ licences */
const CC = { by: 'https://creativecommons.org/licenses/by/', 'by-sa': 'https://creativecommons.org/licenses/by-sa/' };
/** a licence anyone may reuse with credit: rank 0 public domain, 1 CC BY, 2 CC BY-SA; null otherwise */
function freeLicence(short, link = '') {
  const s = String(short).trim();
  const l = s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
  if (!l || /non ?free|fair use|\bnc\b|\bnd\b|noncommercial|noderiv|all rights/.test(l)) return null;
  if (/^cc0|cc zero/.test(l)) return { lic: 'CC0', url: link || 'https://creativecommons.org/publicdomain/zero/1.0/', rank: 0 };
  if (/public domain|^pd\b|^pd /.test(l)) return { lic: 'Public domain', url: link, rank: 0 };
  // (ported licences keep their country: "CC BY-SA 3.0 NL")
  let m = l.match(/^cc by sa (\d\.\d)(?: ([a-z]{2,3})\b)?/);
  if (m) return { lic: `CC BY-SA ${m[1]}${m[2] ? ' ' + m[2].toUpperCase() : ''}`, url: link || `${CC['by-sa']}${m[1]}/`, rank: 2 };
  m = l.match(/^cc by (\d\.\d)(?: ([a-z]{2,3})\b)?/);
  if (m) return { lic: `CC BY ${m[1]}${m[2] ? ' ' + m[2].toUpperCase() : ''}`, url: link || `${CC.by}${m[1]}/`, rank: 1 };
  return null;
}
const INAT_LICENCE = {
  cc0: { lic: 'CC0', url: 'https://creativecommons.org/publicdomain/zero/1.0/', rank: 0 },
  pd: { lic: 'Public domain', url: '', rank: 0 },
  'cc-by': { lic: 'CC BY 4.0', url: `${CC.by}4.0/`, rank: 1 },
  'cc-by-sa': { lic: 'CC BY-SA 4.0', url: `${CC['by-sa']}4.0/`, rank: 2 },
};

/** shorten a credit line: drop links, "(talk)", social handles and boilerplate */
function cleanAuthor(s) {
  let t = String(s ?? '').replace(/\s+/g, ' ').trim();
  const assumed = t.match(/No machine-readable author provided\.\s*(.+?)\s+assumed/i);
  if (assumed) t = assumed[1];
  // "…You must credit this: Citron / CC-BY-SA-3.0": the credit asked for
  const asked = t.match(/credit this\s*:\s*(.+)$/i);
  if (asked) t = asked[1];
  // (no web or email addresses: a name is the credit)
  t = t.replace(/https?:\/\/\S+/g, '').replace(/\(?\s*[\w.+-]+@[\w-]+(\.[\w-]+)+\s*\)?/g, '').replace(/\(\s*\)/g, '')
    .replace(/\((talk|contribs?|discussion|website|homepage|Facebook|Flickr)[^)]*\)/gi, '')
    .replace(/\b(from|at|on) (Flickr|Wikimedia Commons)\b.*$/i, '').replace(/^(Photo(graph)? (by|:)|Author:|By)\s*/i, '')
    // boilerplate around the name: requests, wiki signatures and timestamps
    .replace(/\s*See the original file here\.?/i, '').replace(/\s*\(Original text:[^)]*\)/i, '').replace(/\s+Please credit\b.*$/i, '')
    .replace(/\s+I(?:'|’)d appreciate\b.*$/i, '').replace(/\s*\d{1,2}:\d{2},? \d{1,2} \w+ \d{4}(?: \(UTC\))?/g, '').replace(/\s+--\s*$/, '')
    .replace(/^This (illustration|photo(graph)?|image|picture) was (made|taken|created) by\s+/i, '')
    .replace(/\s*[|·•]\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  if (t.length > 150) t = t.slice(0, 148).replace(/\s+\S*$/, '') + '…';
  return t;
}

/* ------------------------------------------------------------------ the browser: catalog, HTML parsing, resizing */
let page;
/** licences and author from a Commons file description (rendered) */
async function commonsFile(file) {
  const title = 'File:' + file.replace(/ /g, '_');
  const r = await get(`https://commons.wikimedia.org/w/index.php?title=${encodeURIComponent(title)}&action=render`);
  if (r.status !== 200) return null;
  const info = await page.evaluate((html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // (template styles and edit links are not part of anyone's name)
    for (const el of doc.querySelectorAll('style, script, link, .mw-editsection, sup.reference, .noprint')) el.remove();
    const txt = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const lics = [...doc.querySelectorAll('.licensetpl')].map((el) => ({
      short: txt(el.querySelector('.licensetpl_short')), link: txt(el.querySelector('.licensetpl_link')),
      attr: txt(el.querySelector('.licensetpl_attr')), attrReq: txt(el.querySelector('.licensetpl_attr_req')),
    }));
    const autCell = doc.querySelector('#fileinfotpl_aut')?.nextElementSibling;
    // an artist's {{Creator}} box holds the name in #creator; otherwise the cell is the name
    const author = txt(autCell?.querySelector('#creator')) || txt(autCell?.querySelector('.vcard .fn, [itemprop=name]')) || txt(autCell);
    return { lics, author, nonfree: !!doc.querySelector('.licensetpl_nonfree') };
  }, r.body);
  if (info.nonfree) return null;
  const ok = info.lics.map((l) => ({ ...l, free: freeLicence(l.short, l.link) })).filter((l) => l.free).sort((a, b) => a.free.rank - b.free.rank);
  if (!ok.length) return { rejected: info.lics.map((l) => l.short).join(' / ') || 'no licence data' };
  const best = ok[0];
  const by = cleanAuthor(best.attr || info.author);
  // attribution is required for everything but the public domain: no author, no use
  if (!by && best.free.rank > 0) return { rejected: `${best.free.lic} without an author` };
  return { by: by || 'Unknown author', lic: best.free.lic, licUrl: best.free.url, url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title).replace(/%2F/g, '/').replace(/%3A/g, ':')}` };
}

/** download a picture and save it as WebP no bigger than `max` px; returns its size */
async function saveImage(url, out, { max, quality }) {
  const r = await get(url, { bytes: true });
  if (r.status !== 200 || !/^image\//.test(r.type) || r.body.length < 500) return null;
  const res = await page.evaluate(async ({ b64, type, max, quality }) => {
    const blob = new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type });
    const src = await createImageBitmap(blob);
    const s = Math.min(1, max / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * s)), h = Math.max(1, Math.round(src.height * s));
    const bmp = await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    const c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(bmp, 0, 0);
    const outBlob = await c.convertToBlob({ type: 'image/webp', quality });
    const buf = new Uint8Array(await outBlob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { w, h, b64: btoa(bin) };
  }, { b64: r.body.toString('base64'), type: r.type.split(';')[0], max, quality });
  fs.writeFileSync(out, Buffer.from(res.b64, 'base64'));
  return { w: res.w, h: res.h };
}
const filePath = (file, width) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=${width}`;

/* ------------------------------------------------------------------ Wikidata */
async function itemByTitle(title) {
  const r = await get(`https://www.wikidata.org/wiki/Special:ItemByTitle/enwiki/${encodeURIComponent(title.replace(/ /g, '_'))}`);
  const m = r.status === 200 && r.url.match(/\/wiki\/(Q\d+)$/);
  return m ? m[1] : null;
}
async function entity(q) {
  const d = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${q}.json`);
  const e = d?.entities?.[q] ?? (d && Object.values(d.entities ?? {})[0]);
  if (!e) return null;
  const vals = (p) => (e.claims?.[p] ?? []).filter((s) => s.rank !== 'deprecated' && s.mainsnak?.datavalue)
    .sort((a, b) => (a.rank === 'preferred' ? 0 : 1) - (b.rank === 'preferred' ? 0 : 1)).map((s) => s.mainsnak.datavalue.value);
  return { q, images: vals('P18'), maps: vals('P181'), taxon: vals('P225')[0] ?? null, inat: vals('P3151')[0] ?? null, enwiki: e.sitelinks?.enwiki?.title ?? null };
}

/* ------------------------------------------------------------------ iNaturalist */
async function inatTaxon(def, wd) {
  let id = wd?.inat ? Number(wd.inat) : null;
  if (!id) {
    // (only a taxon that really goes by that name: a loose match would describe some other species)
    const same = (a, b) => !!a && !!b && a.toLowerCase().replace(/s$/, '') === b.toLowerCase().replace(/s$/, '');
    for (const q0 of [def.info.scientific, ...(PIN[def.id]?.titles ?? []), def.name].filter(Boolean)) {
      const q = q0.replace(/ sp\.?$/, '');
      const d = await getJson(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(q)}&per_page=5`);
      const hit = d?.results?.find((t) => same(t.name, q) || same(t.matched_term, q) || same(t.preferred_common_name, q));
      if (hit) { id = hit.id; break; }
    }
  }
  if (!id) return null;
  let t = (await getJson(`https://api.inaturalist.org/v1/taxa/${id}`))?.results?.[0] ?? null;
  // a taxon iNaturalist has since split or renamed (Wikidata can lag behind): follow it to the current one
  if (t && t.is_active === false && t.current_synonymous_taxon_ids?.length) {
    const now = [];
    for (const sid of t.current_synonymous_taxon_ids.slice(0, 3)) { const c = (await getJson(`https://api.inaturalist.org/v1/taxa/${sid}`))?.results?.[0]; if (c?.is_active !== false && c) now.push(c); }
    t = now.find((c) => c.name === def.info.scientific) ?? now.sort((a, b) => (b.observations_count ?? 0) - (a.observations_count ?? 0))[0] ?? t;
  }
  return t;
}
function inatCredit(photo, user) {
  const free = INAT_LICENCE[photo.license_code];
  if (!free) return null;
  const m = String(photo.attribution ?? '').match(/^\(c\)\s*(.+?),\s*(some|no) rights/i);
  const by = cleanAuthor(m ? m[1] : user?.name || user?.login || '');
  if (!by && free.rank > 0) return null;
  return { by: by || 'Unknown photographer', lic: free.lic, licUrl: free.url, url: `https://www.inaturalist.org/photos/${photo.id}`, img: String(photo.url).replace(/\/square\./, '/large.') };
}
async function inatPhoto(taxon) {
  // curated photos first, then the most-favourited research-grade observations
  for (const tp of taxon.taxon_photos ?? []) { const c = inatCredit(tp.photo); if (c) return c; }
  const d = await getJson(`https://api.inaturalist.org/v1/observations?taxon_id=${taxon.id}&photo_license=cc0,cc-by,cc-by-sa&quality_grade=research&order_by=votes&per_page=8&photos=true`);
  for (const o of d?.results ?? []) for (const p of o.photos ?? []) { const c = inatCredit(p, o.user); if (c) return c; }
  return null;
}

/* ------------------------------------------------------------------ text */
const ABBR = /(?:\b(?:e\.g|i\.e|c|ca|approx|St|Mt|Dr|Mr|Mrs|No|sp|spp|subsp|var|cf|vs|etc|U\.S|U\.K|Jr|Sr|al)|\b[A-Z])\.$/;
/** the opening of a Wikipedia summary, without asides in brackets: up to three sentences */
async function aboutText(html) {
  if (!html) return '';
  let t = await page.evaluate((h) => new DOMParser().parseFromString(h, 'text/html').body.textContent ?? '', html);
  // no citation marks: "[3]", or page numbers after a sentence ("Columbidae.:624 In…")
  t = t.replace(/\[\d+\]/g, '').replace(/([.,;!?"”’)])(?::\s?\d+(?:[–-]\d+)?)+/g, '$1');
  for (let i = 0; i < 3; i++) t = t.replace(/\s*\([^()]*\)/g, '');
  // and no pronunciation guides ("Pelargonium /ˌpɛlɑːrˈɡoʊniəm/ is…")
  t = t.replace(/\s*\/[^/\s][^/]{0,60}?[ˈˌːəɪʊɛɔæʃʒθðŋɑɒʌɜ][^/]{0,60}?\//g, '');
  t = t.replace(/\s+([,.;:])/g, '$1').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
  const out = [];
  let start = 0;
  const re = /[.!?]["”’]?(?=\s+["“‘]?[A-Z0-9])/g;
  let m;
  while ((m = re.exec(t))) {
    const piece = t.slice(start, m.index + m[0].length).trim();
    if (ABBR.test(t.slice(Math.max(0, m.index - 8), m.index + 1))) continue;
    out.push(piece);
    start = m.index + m[0].length;
    if (out.length >= 3) break;
  }
  if (out.length < 3 && start < t.length) out.push(t.slice(start).trim());
  // iNaturalist cuts long summaries off ("for..."): leave out a sentence that doesn't finish
  const whole = (x) => /[.!?]["”’]?$/.test(x) && !/(\.\.\.|…)["”’]?$/.test(x);
  while (out.length > 1 && !whole(out[out.length - 1])) out.pop();
  if (out.length === 1 && !whole(out[0])) return '';
  let s = '';
  for (const piece of out) { if (s && (s + ' ' + piece).length > 460) break; s = s ? `${s} ${piece}` : piece; }
  return s;
}

/* ------------------------------------------------------------------ one species */
async function species(def, prev) {
  const pin = PIN[def.id] ?? {};
  const slug = def.id.replace(/\//g, '-');
  const entry = { name: def.name };
  const log = [];
  // the Wikidata item: pinned titles, the scientific name, then the common name; when an item has
  // no photo anyone may reuse, the next one (`also`: a genus or phylum, say) is tried for one
  const sci = def.info.scientific && !/^angiospermae$/i.test(def.info.scientific) ? def.info.scientific.replace(/ sp\.?$/, '') : null;
  const titles = [...new Set([...(pin.titles ?? []), sci, def.name, ...(pin.also ?? [])].filter(Boolean))];
  const seen = new Set();
  let ti = 0;
  const nextItem = async () => {
    while (ti < titles.length) {
      const q = await itemByTitle(titles[ti++]);
      if (!q || seen.has(q)) continue;
      seen.add(q);
      const e = await entity(q);
      if (e && (e.taxon || e.images.length)) return e;
    }
    return null;
  };
  const wd = await nextItem();
  if (wd) { entry.q = wd.q; if (wd.enwiki) entry.wiki = `https://en.wikipedia.org/wiki/${encodeURIComponent(wd.enwiki.replace(/ /g, '_'))}`; }
  else log.push('no Wikidata item');
  if (wd?.taxon && sci && wd.taxon !== sci && !pin.titles) log.push(`taxon on Wikidata is ${wd.taxon}`);

  // the photo: pinned, Commons (the item's own pictures, photos before drawings), then iNaturalist
  const photoOut = path.join(OUT, `${slug}.webp`);
  const norm = (f) => decodeURIComponent(f).replace(/_/g, ' ').trim().toLowerCase();
  const skip = new Set((pin.skip ?? []).map(norm));
  const fromCommons = async (files) => {
    const cands = files.filter((f) => !/\.(svg|gif|tiff?|pdf|djvu|webm|ogv|ogg)$/i.test(f) && !skip.has(norm(f))).sort((a, b) => Number(/\.png$/i.test(a)) - Number(/\.png$/i.test(b)));
    for (const f of cands.slice(0, 4)) {
      const c = await commonsFile(f);
      if (!c) continue;
      if (c.rejected) { log.push(`skip ${f}: ${c.rejected}`); continue; }
      const size = await saveImage(filePath(f, 960), photoOut, PHOTO) ?? await saveImage(filePath(f, 500), photoOut, PHOTO);
      if (size) return { src: `${slug}.webp`, ...size, by: c.by, lic: c.lic, licUrl: c.licUrl, url: c.url, from: 'Wikimedia Commons' };
    }
    return null;
  };
  let photo = null;
  if (pin.noPhoto) { /* the card shows the 3D model */ }
  else if (pin.commons) photo = await fromCommons([pin.commons]);
  else if (!pin.inat) for (let item = wd, n = 0; item && !photo && n < 3; n++) { photo = await fromCommons(item.images); if (!photo) item = await nextItem(); }
  const taxon = pin.noInat ? null : await inatTaxon(def, wd);
  if (!photo && !pin.noPhoto) {
    let c = null;
    if (pin.inat) {
      const d = await getJson(`https://api.inaturalist.org/v1/photos/${pin.inat}`);
      const p = d?.results?.[0] ?? d;
      if (p?.id) c = inatCredit({ ...p, url: p.url ?? `https://inaturalist-open-data.s3.amazonaws.com/photos/${p.id}/square.jpg` });
    } else if (taxon) c = await inatPhoto(taxon);
    if (c) {
      const size = await saveImage(c.img, photoOut, PHOTO) ?? await saveImage(c.img.replace('/large.', '/medium.'), photoOut, PHOTO);
      if (size) photo = { src: `${slug}.webp`, ...size, by: c.by, lic: c.lic, licUrl: c.licUrl, url: c.url, from: 'iNaturalist' };
    }
  }
  if (photo) entry.photo = photo;
  else { log.push('NO PHOTO'); if (fs.existsSync(photoOut)) fs.rmSync(photoOut); }

  // the range map
  if (!pin.noMap) for (const f of (wd?.maps ?? []).slice(0, 2)) {
    const c = await commonsFile(f);
    if (!c || c.rejected) { if (c?.rejected) log.push(`skip map ${f}: ${c.rejected}`); continue; }
    const size = await saveImage(filePath(f, 500), path.join(OUT, `${slug}-map.webp`), MAP);
    if (size) { entry.map = { src: `${slug}-map.webp`, ...size, by: c.by, lic: c.lic, licUrl: c.licUrl, url: c.url, from: 'Wikimedia Commons' }; break; }
  }
  if (!entry.map && fs.existsSync(path.join(OUT, `${slug}-map.webp`))) fs.rmSync(path.join(OUT, `${slug}-map.webp`));

  // about it, how often it is seen, its Red List page
  if (taxon) {
    entry.inat = taxon.id;
    if (taxon.observations_count) entry.obs = taxon.observations_count;
    const about = await aboutText(taxon.wikipedia_summary);
    // (credited to the article it really came from, which can differ from the item's: "Dog" for a Labrador)
    const src = String(taxon.wikipedia_url ?? '').replace(/^http:/, 'https:').replace(/ /g, '_');
    if (about && /^https:\/\/en\.wikipedia\.org\/wiki\//.test(src)) {
      entry.about = about;
      if (src !== entry.wiki) entry.aboutUrl = src;
      if (!entry.wiki) entry.wiki = src;
    }
    // the global IUCN Red List category and its page
    const cs = taxon.conservation_status;
    if (cs && /iucn/i.test(cs.authority ?? '') && !cs.place) {
      const code = String(cs.status ?? '').toUpperCase();
      if (['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'DD'].includes(code)) entry.redlist = code;
      if (/^https:\/\/(www\.)?iucnredlist\.org\//.test(cs.url ?? '')) entry.iucn = cs.url;
    }
  } else log.push('no iNaturalist taxon');
  if (prev?.photo && !entry.photo) log.push('(kept nothing: previous photo dropped)');
  return { entry, log };
}

/* ------------------------------------------------------------------ credits */
function writeCredits(media) {
  const rows = Object.entries(media).flatMap(([, e]) => [
    e.photo && `| ${e.name} | photo | ${e.photo.by.replace(/\|/g, '/')} | [${e.photo.lic}](${e.photo.licUrl || e.photo.url}) | [${e.photo.from}](${e.photo.url}) |`,
    e.map && `| ${e.name} | range map | ${e.map.by.replace(/\|/g, '/')} | [${e.map.lic}](${e.map.licUrl || e.map.url}) | [${e.map.from}](${e.map.url}) |`,
  ]).filter(Boolean);
  fs.writeFileSync(path.join(OUT, 'CREDITS.md'), [
    '# Species photos, range maps and descriptions',
    '',
    'The pictures in this folder are by the people named below and are used under the licences shown (public domain, CC0, CC BY or CC BY-SA). They have been resized and saved as WebP; nothing else was changed. Each one is credited on its species card too, with links to its source and licence.',
    '',
    'The short descriptions in `media.json` are adapted (shortened) from the opening of each species\' English Wikipedia article and are available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); each card links to its article.',
    '',
    'Generated by `tools/fetch-species-media.mjs`.',
    '',
    '| Species | Picture | By | Licence | Source |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n'));
}

/* ------------------------------------------------------------------ main */
const prevMedia = readJson(DATA) ?? {};
if (args.credits) { writeCredits(prevMedia); process.exit(0); }
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--clearScreen', 'false'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
async function up() { for (let k = 0; k < 120; k++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return; } catch { /* wait */ } await sleep(700); } throw new Error('vite did not start'); }
let browser;
try {
  await up();
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  const catalog = await page.evaluate(async () => {
    const m = await import('/src/assets/catalog.ts');
    return m.CATALOG.filter((d) => d.living !== false && d.category !== 'habitats').map((d) => ({ id: d.id, name: d.name, info: { scientific: d.info.scientific } }));
  });
  await page.goto('about:blank');
  const only = args.only ? new Set(String(args.only).split(',')) : null;
  const limit = Number(args.limit ?? Infinity);
  const media = { ...prevMedia };
  // species no longer in the catalog drop out
  for (const id of Object.keys(media)) if (!catalog.some((d) => d.id === id)) delete media[id];
  let n = 0;
  for (const def of catalog) {
    if (only ? !only.has(def.id) : media[def.id] && !REFRESH && !args.all) continue;
    if (n++ >= limit) break;
    try {
      const { entry, log } = await species(def, media[def.id]);
      media[def.id] = entry;
      console.log(`${def.id.padEnd(34)} ${entry.photo ? `${entry.photo.from === 'iNaturalist' ? 'iNat   ' : 'Commons'} ${entry.photo.lic.padEnd(13)}` : '—'.padEnd(21)} ${entry.map ? 'map' : '   '} ${entry.about ? 'about' : '     '} ${log.join('; ')}`);
    } catch (e) { console.log(`${def.id.padEnd(34)} FAILED ${e.message}`); }
    // save as we go, so an interrupted run keeps what it fetched
    const sorted = Object.fromEntries(Object.keys(media).sort().map((k) => [k, media[k]]));
    fs.writeFileSync(DATA, JSON.stringify(sorted, null, 0).replace(/\},"/g, '},\n"') + '\n');
  }
  const final = readJson(DATA) ?? {};
  writeCredits(final);
  // pictures no species uses any more
  const used = new Set(Object.values(final).flatMap((e) => [e.photo?.src, e.map?.src]).filter(Boolean));
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.webp') && !used.has(f)) { fs.rmSync(path.join(OUT, f)); console.log('removed', f); }
  const all = Object.values(final);
  console.log(`\n${all.length} species: ${all.filter((e) => e.photo).length} photos (${all.filter((e) => e.photo?.from === 'iNaturalist').length} from iNaturalist), ${all.filter((e) => e.map).length} range maps, ${all.filter((e) => e.about).length} descriptions`);
} finally {
  await browser?.close();
  vite.kill('SIGKILL');
}
process.exit(0);
