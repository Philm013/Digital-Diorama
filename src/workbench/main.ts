/**
 * ANIMAL WORKBENCH (dev only) — workbench.html
 *
 * Pick any animal in the library, see it live (orbit, views, clips, wireframe, skeleton,
 * bounds, lighting) next to a real photo of the species, and work on its code:
 *
 *   Params  the exact parameters the app builds it with, as editable code, plus generated
 *           controls for every parameter the module exposes. Changes rebuild the model live;
 *           "Save to tuning.json" keeps them for the app.
 *   Code    the source files that define it (asset module, species preset, family defaults,
 *           painter, catalog rows, remaps) with jumps to each region. Ctrl/Cmd+S writes the
 *           file; asset modules are re-imported in place and the model rebuilds.
 *   Spec    what the build produced (size, triangles, clips, rig, zones, resolved anatomy).
 *   Diff    git diff of this animal's files against HEAD.
 *
 * Photo overlay: show the reference photo over the 3D view (opacity, drag to move, wheel to
 * scale, flip) to match silhouettes. Snapshots keep before/after captures to compare.
 *
 * Scriptable through `window.wb` (see the API at the bottom) and URL parameters
 * (?id=mammal/lion&view=side&clip=walk&phase=0.3&q=medium&tab=code), which is how
 * tools/workbench.mjs drives it from Playwright.
 */
import './workbench.css';
import * as THREE from 'three';
import { CATALOG, CATALOG_BY_ID, UNTUNED_PARAMS } from '../assets/catalog';
import { buildModel, clearModelCache, type BuiltModel } from '../assets/builder';
import { replaceModule, type ParamSpec } from '../assets/modules';
import { BUILTINS } from '../assets/models/builtin';
import * as marineNs from '../assets/models/builtin/marine';
import * as fungiNs from '../assets/models/builtin/fungi';
import * as fishNs from '../assets/models/builtin/fish';
import { ANIMALS as WILDFORM } from '../assets/models/wildform/species';
import type { AssetDef } from '../assets/types';
import type { Quality } from '../engine/types';
import { CodeEditor } from './editor';
import { sourcesFor, type SourceFile } from './sources';
import { Viewport, VIEW_DIRS, type Lighting, type ViewName } from './viewport';

/* ───────────────────────── small DOM helpers ───────────────────────── */
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const fmtLen = (n: number) => (n >= 1 ? n.toFixed(2) + ' m' : n >= 0.01 ? (n * 100).toFixed(1) + ' cm' : (n * 1000).toFixed(2) + ' mm');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ───────────────────────── params as code ───────────────────────── */
const IDENT = /^[A-Za-z_$][\w$]*$/;
/** Pretty-print a value as a JS object literal (unquoted keys, single quotes, short arrays inline). */
export function toJS(v: unknown, ind = ''): string {
  const pad = ind + '  ';
  if (v === null) return 'null';
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
  if (typeof v === 'number') return Number.isFinite(v) ? String(+v.toFixed(6)) : 'null';
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    const parts = v.map((x) => toJS(x, pad));
    const flat = `[${parts.join(', ')}]`;
    return flat.length < 90 && !flat.includes('\n') ? flat : `[\n${parts.map((p) => pad + p).join(',\n')},\n${ind}]`;
  }
  if (typeof v === 'object') {
    const ents = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
    if (!ents.length) return '{}';
    const parts = ents.map(([k, x]) => `${IDENT.test(k) ? k : toJS(k)}: ${toJS(x, pad)}`);
    const flat = `{ ${parts.join(', ')} }`;
    return flat.length < 90 && !flat.includes('\n') && ind.length > 0 ? flat : `{\n${parts.map((p) => pad + p).join(',\n')},\n${ind}}`;
  }
  return 'undefined';
}
function evalParams(text: string): Record<string, unknown> {
  const v = new Function(`"use strict"; return (${text}\n);`)();
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Params must be an object literal { ... }');
  return v as Record<string, unknown>;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ───────────────────────── persistent state ───────────────────────── */
interface State {
  id: string; q: Quality; trueScale: boolean; light: Lighting; bg: string; tab: string;
  wire: boolean; bounds: boolean; skel: boolean; rotate: boolean; rigAnim: boolean; speed: number; clip: string;
  overlay: { on: boolean; opacity: number; x: number; y: number; s: number; flip: boolean };
  cams: Record<string, { p: number[]; t: number[] }>;
  file: Record<string, string>;
}
const DEFAULT_STATE: State = {
  id: 'mammal/lion', q: 'medium', trueScale: true, light: 'studio', bg: '#e9e4d8', tab: 'params',
  wire: false, bounds: false, skel: false, rotate: false, rigAnim: true, speed: 1, clip: '',
  overlay: { on: false, opacity: 0.5, x: 0, y: 0, s: 1, flip: false }, cams: {}, file: {},
};
const LS = 'wb:state:v1';
function loadState(): State {
  try { return { ...DEFAULT_STATE, ...JSON.parse(localStorage.getItem(LS) ?? '{}') }; } catch { return { ...DEFAULT_STATE }; }
}
const S = loadState();
let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch { /* private mode */ } }, 150);
}
const editKey = (id: string) => `wb:params:${id}`;
function storedParams(id: string): string | null { try { return localStorage.getItem(editKey(id)); } catch { return null; } }
function storeParams(id: string, text: string | null) { try { if (text === null) localStorage.removeItem(editKey(id)); else localStorage.setItem(editKey(id), text); } catch { /* ignore */ } }
const bufKey = (path: string) => `wb:buf:${path}`;

/* ───────────────────────── reference media ───────────────────────── */
interface Media { name?: string; photo?: { src: string; by?: string; lic?: string; url?: string }; wiki?: string; about?: string }
let MEDIA: Record<string, Media> = {};
const mediaReady = fetch('species/media.json').then((r) => (r.ok ? r.json() : {})).then((m) => { MEDIA = m; }).catch(() => {});

/* ───────────────────────── URL overrides ───────────────────────── */
const URLP = new URLSearchParams(location.search);
if (URLP.get('id')) S.id = URLP.get('id')!;
if (URLP.get('q')) S.q = URLP.get('q') as Quality;
if (URLP.get('tab')) S.tab = URLP.get('tab')!;
if (URLP.has('true')) S.trueScale = URLP.get('true') !== '0';
if (URLP.get('clip')) S.clip = URLP.get('clip')!;
const startView = URLP.get('view');
const bare = URLP.get('ui') === '0';

/* ───────────────────────── layout ───────────────────────── */
const ANIMALS = CATALOG.filter((d) => d.category === 'animals');
const WILD_BY_ID = Object.fromEntries(WILDFORM.map((a) => [a.id, a]));
document.title = 'Animal workbench';
const app = $('#wb');
if (bare) app.classList.add('bare');

const listEl = h('div', { class: 'groups' });
const search = h('input', { class: 'search', placeholder: `Search ${ANIMALS.length} animals…  (/)`, type: 'search' });
const aside = h('aside', { class: 'list' }, h('header', {}, h('b', {}, '🧪 Animal workbench'), search), listEl);

const view3d = h('div', { class: 'view3d' });
const overlayImg = h('img', { class: 'overlay', alt: '' });
const errBox = h('div', { class: 'err hidden' });
const busy = h('div', { class: 'busy hidden' }, 'Building…');
view3d.append(overlayImg, errBox, busy);
const statusBar = h('div', { class: 'statusbar' });
const strip = h('div', { class: 'strip' });

const btn = (label: string, title: string, on: (e: Event) => void, cls = '') => h('button', { class: 'btn ' + cls, title, onclick: on }, label);
const toggle = (label: string, title: string, get: () => boolean, set: (v: boolean) => void) => {
  const b = btn(label, title, () => { set(!get()); b.classList.toggle('on', get()); persist(); });
  b.classList.toggle('on', get());
  return b;
};
const sel = (opts: [string, string][], value: string, on: (v: string) => void, title = '') => {
  const s = h('select', { title, onchange: () => on(s.value) }, ...opts.map(([v, l]) => h('option', { value: v }, l)));
  s.value = value;
  return s;
};

const clipSel = h('select', { title: 'Animation clip', onchange: () => { S.clip = clipSel.value; vp.playClip(clipSel.value); persist(); } });
const scrub = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: 0, title: 'Clip phase (pauses)', oninput: () => { vp.playing = false; playBtn.textContent = '▶'; vp.scrub(Number(scrub.value)); } });
const playBtn = btn('⏸', 'Play / pause (space)', () => { vp.playing = !vp.playing; playBtn.textContent = vp.playing ? '⏸' : '▶'; });
const speedSel = sel([['0.25', '¼×'], ['0.5', '½×'], ['1', '1×'], ['2', '2×']], String(S.speed), (v) => { S.speed = Number(v); vp.speed = S.speed; persist(); }, 'Playback speed');

const toolbar = h('div', { class: 'toolbar' },
  h('span', { class: 'grp' }, ...(['front34', 'front', 'side', 'right', 'back', 'top', 'low'] as ViewName[]).map((v) => btn(v === 'front34' ? '¾' : v, `Camera: ${v} (${'1234567'[['front34', 'front', 'side', 'right', 'back', 'top', 'low'].indexOf(v)]})`, () => vp.view(v))),
    btn('face', 'Close-up of the head (8; 9 from the side)', () => vp.view('head'))),
  h('span', { class: 'grp' }, clipSel, playBtn, scrub, speedSel),
  h('span', { class: 'grp' },
    sel([['low', 'Fast (phones)'], ['medium', 'Balanced'], ['high', 'Detailed']], S.q, (v) => { S.q = v as Quality; persist(); rebuild(); }, 'Graphics tier (what the app builds on each setting)'),
    toggle('True size', 'Real size (off: the magnified "exhibit" size small animals get in the app)', () => S.trueScale, (v) => { S.trueScale = v; rebuild(); }),
  ),
  h('span', { class: 'grp' },
    toggle('Wire', 'Wireframe (W)', () => S.wire, (v) => { S.wire = v; vp.setWire(v); }),
    toggle('Bounds', 'Bounding box', () => S.bounds, (v) => { S.bounds = v; vp.setBounds(v); }),
    toggle('Bones', 'Skeleton (skinned rigs)', () => S.skel, (v) => { S.skel = v; vp.setSkeleton(v); }),
    toggle('Idle', 'Animate pivot rigs (reptiles, Wildform, built-ins)', () => S.rigAnim, (v) => { S.rigAnim = v; vp.rigAnim = v; }),
    toggle('Spin', 'Turntable (R)', () => S.rotate, (v) => { S.rotate = v; vp.autoRotate = v; }),
    sel([['studio', 'Studio'], ['daylight', 'Daylight'], ['overcast', 'Overcast'], ['night', 'Night']], S.light, (v) => { S.light = v as Lighting; vp.setLighting(S.light); persist(); }, 'Lighting'),
    h('input', { type: 'color', value: S.bg, title: 'Background', oninput: (e) => { S.bg = (e.target as HTMLInputElement).value; vp.setBackground(S.bg); persist(); } }),
  ),
  h('span', { class: 'grp' },
    btn('📸 Snapshot', 'Keep a capture to compare against (S)', () => snapshot()),
    btn('▦ Sheet', 'Photo + front/side/top/back captures in one image', () => openSheet()),
  ),
);
const stage = h('main', { class: 'stage' }, toolbar, view3d, statusBar, strip);

/* reference panel */
const refImg = h('img', { class: 'photo', alt: '' });
const refCredit = h('div', { class: 'credit' });
const refInfo = h('div', { class: 'facts' });
const ovOpacity = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: S.overlay.opacity, title: 'Overlay opacity', oninput: () => { S.overlay.opacity = Number(ovOpacity.value); applyOverlay(); persist(); } });
const ovBtn = toggle('Overlay on 3D', 'Show the photo over the 3D view (drag to move, wheel to scale; O)', () => S.overlay.on, (v) => { S.overlay.on = v; applyOverlay(); });
const refPanel = h('div', { class: 'ref' },
  h('div', { class: 'refhead' }, h('b', { class: 'refname' }), h('i', { class: 'refsci' })),
  refImg, refCredit,
  h('div', { class: 'ovrow' }, ovBtn, ovOpacity,
    btn('⇋', 'Flip the photo', () => { S.overlay.flip = !S.overlay.flip; applyOverlay(); persist(); }),
    btn('⟲', 'Reset the overlay position', () => { Object.assign(S.overlay, { x: 0, y: 0, s: 1 }); applyOverlay(); persist(); })),
  refInfo,
);

/* code panel */
const tabs = ['params', 'code', 'spec', 'diff'] as const;
const tabBar = h('nav', { class: 'tabs' }, ...tabs.map((t) => h('button', { class: 'tab', 'data-tab': t, onclick: () => setTab(t) }, { params: 'Params', code: 'Code', spec: 'Spec', diff: 'Diff' }[t])));
const paramsHost = h('div', { class: 'cm' });
const paramsMsg = h('div', { class: 'msg' });
const controls = h('div', { class: 'controls' });
const paramsPane = h('div', { class: 'pane', 'data-pane': 'params' },
  h('div', { class: 'bar' },
    h('span', { class: 'hint' }, 'Live: edits rebuild the model.'),
    btn('Reset', 'Back to the catalog params', () => resetParams()),
    btn('Save to tuning.json', 'Keep these params for the app (src/assets/tuning.json)', () => saveTuning(), 'primary')),
  paramsHost, paramsMsg, h('div', { class: 'ctrlhead' }, 'Parameters'), controls);
const fileChips = h('div', { class: 'chips files' });
const regionChips = h('div', { class: 'chips regions' });
const codeHost = h('div', { class: 'cm' });
const codeMsg = h('div', { class: 'msg' });
const codePane = h('div', { class: 'pane', 'data-pane': 'code' },
  fileChips, regionChips,
  h('div', { class: 'bar' },
    h('span', { class: 'hint' }, 'Ctrl/Cmd+S saves; asset modules hot-swap.'),
    btn('Revert to HEAD', 'Replace the editor text with the committed version (not saved until you save)', () => revertFile()),
    btn('Save', 'Write this file (Ctrl/Cmd+S)', () => saveFile(), 'primary')),
  codeHost, codeMsg);
const specPre = h('pre', { class: 'spec' });
const specPane = h('div', { class: 'pane', 'data-pane': 'spec' }, specPre);
const diffPre = h('pre', { class: 'diff' });
const diffPane = h('div', { class: 'pane', 'data-pane': 'diff' }, h('div', { class: 'bar' }, btn('Refresh', 'git diff HEAD of this animal\'s files', () => loadDiff())), diffPre);
const side = h('section', { class: 'side' }, refPanel, h('div', { class: 'code' }, tabBar, paramsPane, codePane, specPane, diffPane));

app.append(aside, stage, side);

const vp = new Viewport(view3d);
vp.speed = S.speed; vp.rigAnim = S.rigAnim; vp.autoRotate = S.rotate;
vp.setLighting(S.light); vp.setBackground(S.bg);
vp.setWire(S.wire);
let camSaveT = 0;
vp.controls.addEventListener('change', () => {
  clearTimeout(camSaveT);
  camSaveT = window.setTimeout(() => { S.cams[S.id] = vp.cameraState(); persist(); }, 300);
});
vp.onFrame = () => { if (vp.action && vp.playing) scrub.value = String(vp.clipPhase()); };

const paramsEd = new CodeEditor({ parent: paramsHost, onChange: () => onParamsText(), onSave: () => saveTuning() });
const codeEd = new CodeEditor({ parent: codeHost, onChange: () => markDirty(), onSave: () => saveFile() });

/* ───────────────────────── list ───────────────────────── */
const ORDER = ['Mammals', 'Birds', 'Reptiles', 'Amphibians', 'Fish', 'Insects & arthropods', 'Sea invertebrates', 'Corals', 'Molluscs', 'Worms', 'Microscopic life'];
const itemEls = new Map<string, HTMLElement>();
function renderList() {
  const q = search.value.trim().toLowerCase();
  listEl.textContent = '';
  itemEls.clear();
  const groups = new Map<string, AssetDef[]>();
  for (const d of ANIMALS) {
    const hay = `${d.name} ${d.id} ${d.info.scientific ?? ''} ${d.family} ${d.group} ${d.info.class ?? ''}`.toLowerCase();
    if (q && !q.split(/\s+/).every((w) => hay.includes(w))) continue;
    if (!groups.has(d.group)) groups.set(d.group, []);
    groups.get(d.group)!.push(d);
  }
  const names = [...groups.keys()].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
  for (const g of names) {
    const items = groups.get(g)!;
    listEl.append(h('div', { class: 'ghead' }, g, h('small', {}, String(items.length))));
    for (const d of items) {
      const tuned = !same(UNTUNED_PARAMS[d.id], d.params);
      const el = h('button', { class: 'item' + (d.id === S.id ? ' sel' : ''), title: `${d.id} · ${d.family}`, onclick: () => select(d.id) },
        h('span', { class: 'em' }, d.emoji), h('span', { class: 'nm' }, d.name),
        h('span', { class: 'tags' },
          MEDIA[d.id]?.photo ? h('i', { class: 'tag ph', title: 'Has a reference photo' }, '📷') : null,
          tuned ? h('i', { class: 'tag tu', title: 'Has saved tuning' }, 'T') : null,
          storedParams(d.id) !== null ? h('i', { class: 'tag ed', title: 'Unsaved param edits' }, '●') : null,
          h('i', { class: 'tag fam' }, d.family)));
      itemEls.set(d.id, el);
      listEl.append(el);
    }
  }
}
search.addEventListener('input', () => renderList());

/* ───────────────────────── selection & build ───────────────────────── */
let def: AssetDef = CATALOG_BY_ID[S.id] ?? ANIMALS[0];
let params: Record<string, unknown> = {};
let schema: Record<string, ParamSpec> = {};
let buildSeq = 0;
let building: Promise<void> = Promise.resolve();
let lastBuildMs = 0;
let prevModel: BuiltModel | null = null;
let files: SourceFile[] = [];

async function select(id: string, keepEdits = true) {
  const d = CATALOG_BY_ID[id];
  if (!d) return;
  if (S.id !== id) persistParamsNow();
  def = d; S.id = id; persist();
  for (const [k, el] of itemEls) el.classList.toggle('sel', k === id);
  itemEls.get(id)?.scrollIntoView({ block: 'nearest' });
  let stored = keepEdits ? storedParams(id) : null;
  // edits that match the catalog (e.g. just saved to tuning.json) are not edits
  if (stored !== null) { try { if (same(evalParams(stored), d.params)) { storeParams(id, null); stored = null; } } catch { /* keep */ } }
  let text = stored ?? toJS(d.params);
  try { params = evalParams(text); } catch { text = toJS(d.params); params = { ...d.params }; }
  paramsEd.open(id, text, true);
  paramsMsg.textContent = stored !== null ? 'Restored your unsaved edits for this animal.' : '';
  paramsMsg.className = 'msg' + (stored !== null ? ' note' : '');
  updateReference();
  files = sourcesFor(def, { wildPlan: def.family === 'wildform' ? WILD_BY_ID[String(def.params.__animal)]?.bodyPlan : undefined });
  renderFileChips();
  if (S.tab === 'code') openFile(S.file[id] ?? files[0]?.path);
  if (S.tab === 'diff') loadDiff();
  await rebuild(true);
}

/** set while saving to tuning.json: the page reloads with the new catalog, so nothing is "unsaved" */
let savingTuning = false;
function persistParamsNow() {
  if (savingTuning) return;
  const text = paramsEd.text(S.id);
  if (!text) return;
  try { const p = evalParams(text); storeParams(S.id, same(p, def.params) ? null : text); } catch { storeParams(S.id, text); }
}

let paramsTimer = 0;
function onParamsText() {
  clearTimeout(paramsTimer);
  paramsTimer = window.setTimeout(() => {
    const text = paramsEd.text();
    try {
      const p = evalParams(text);
      paramsMsg.textContent = ''; paramsMsg.className = 'msg';
      params = p;
      storeParams(S.id, same(p, def.params) ? null : text);
      renderControls();
      rebuild();
    } catch (e) {
      paramsMsg.textContent = String((e as Error).message);
      paramsMsg.className = 'msg error';
    }
  }, 280);
}

function setParams(p: Record<string, unknown>, rebuildNow = true) {
  params = p;
  const text = toJS(p);
  paramsEd.open(S.id, text, true);
  storeParams(S.id, same(p, def.params) ? null : text);
  renderControls();
  return rebuildNow ? rebuild() : Promise.resolve();
}
function resetParams() { setParams({ ...def.params }); paramsMsg.textContent = 'Back to the catalog params.'; paramsMsg.className = 'msg note'; }

function rebuild(fresh = false): Promise<void> {
  const seq = ++buildSeq;
  busy.classList.remove('hidden');
  building = (async () => {
    await sleep(0);
    if (seq !== buildSeq) return;
    const t0 = performance.now();
    try {
      const d2: AssetDef = { ...def, params: { ...params } };
      const m = await buildModel(d2, {}, S.q, S.trueScale, false);
      if (seq !== buildSeq) { disposeModel(m); return; }
      lastBuildMs = performance.now() - t0;
      const keepCam = !fresh;
      vp.setModel(m, keepCam);
      if (fresh) {
        const cam = S.cams[S.id];
        if (cam) vp.setCameraState(cam);
      }
      if (prevModel && prevModel !== m) disposeModel(prevModel);
      prevModel = m;
      schema = m.schema ?? {};
      errBox.classList.add('hidden');
      updateClips(m);
      renderControls();
      updateStatus();
      updateSpec();
      updateReference();
    } catch (e) {
      errBox.textContent = `Build failed: ${(e as Error)?.stack ?? e}`.slice(0, 1600);
      errBox.classList.remove('hidden');
      console.error(e);
    } finally {
      if (seq === buildSeq) busy.classList.add('hidden');
    }
  })();
  return building;
}
function disposeModel(m: BuiltModel) {
  m.object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    // uncached builds own their coat textures (module-level shared materials have none)
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const map = (mat as THREE.MeshStandardMaterial).map;
      if (map && map.name === 'coat-atlas') map.dispose();
    }
  });
}

function updateClips(m: BuiltModel) {
  const names = m.clips.map((c) => c.name);
  clipSel.textContent = '';
  clipSel.disabled = !names.length;
  scrub.disabled = !names.length;
  if (!names.length) { clipSel.append(h('option', { value: '' }, m.rig.length ? `rig · ${m.rig.length} pivots` : 'no clips')); return; }
  for (const n of names) clipSel.append(h('option', { value: n }, n));
  const want = names.includes(S.clip) ? S.clip : names.includes('idle') ? 'idle' : names.includes('perch') ? 'perch' : names[0];
  clipSel.value = want;
  vp.playClip(want);
}

function updateStatus() {
  const m = vp.model;
  if (!m) { statusBar.textContent = ''; return; }
  const b = vp.bounds();
  let meshes = 0; const mats = new Set<THREE.Material>();
  m.object.traverse((o) => { const x = o as THREE.Mesh; if (x.isMesh && o.name !== '__wire') { meshes++; (Array.isArray(x.material) ? x.material : [x.material]).forEach((mm) => mats.add(mm)); } });
  const real = def.realLength ? ` · catalog length ${fmtLen(def.realLength)}` : def.info.size ? ` · real ${def.info.size}` : '';
  statusBar.innerHTML = '';
  statusBar.append(
    h('span', {}, h('b', {}, def.emoji + ' ' + def.name), ` ${def.id}`),
    h('span', {}, `${m.triangles.toLocaleString()} tris · ${meshes} meshes · ${mats.size} materials`),
    h('span', {}, b ? `L ${fmtLen(b.z)} · W ${fmtLen(b.x)} · H ${fmtLen(b.y)}${real}` : ''),
    h('span', {}, S.trueScale ? 'true size' : `exhibit ×${m.exhibitScale.toFixed(m.exhibitScale < 10 ? 1 : 0)}`),
    h('span', {}, `grid ${fmtLen(vp.gridStep)}`),
    h('span', {}, `built in ${lastBuildMs.toFixed(0)} ms`),
  );
}

/* ───────────────────────── generated controls ───────────────────────── */
function renderControls() {
  controls.textContent = '';
  const hidden = new Set(def.hidden ?? []);
  const entries = Object.entries(schema).filter(([k]) => !hidden.has(k) && !k.startsWith('__'));
  if (!entries.length) { controls.append(h('div', { class: 'hint' }, 'This module exposes no parameters.')); return; }
  let group = '';
  for (const [k, spec] of entries) {
    const g = spec.group ?? (spec.type === 'color' ? 'Colours' : '');
    if (g && g !== group) { group = g; controls.append(h('div', { class: 'cgroup' }, g)); }
    const cur = params[k] ?? spec.default;
    const changed = params[k] !== undefined && !same(params[k], def.params[k] ?? spec.default);
    const label = h('label', { title: `${k}${spec.describe ? ' — ' + spec.describe : ''}`, class: changed ? 'changed' : '' }, spec.label ?? k);
    let input: HTMLElement;
    const set = (v: unknown) => { const next = { ...params, [k]: v }; setParams(next); };
    if (spec.type === 'range') {
      const val = h('span', { class: 'val' }, fmtNum(Number(cur)));
      const r = h('input', { type: 'range', min: spec.min ?? 0, max: spec.max ?? 1, step: spec.step ?? 0.01, value: Number(cur) });
      r.addEventListener('input', () => { val.textContent = fmtNum(Number(r.value)); });
      r.addEventListener('change', () => set(Number(r.value)));
      input = h('span', { class: 'rng' }, r, val);
    } else if (spec.type === 'choice') {
      const s = h('select', {}, ...(spec.options ?? []).map((o) => h('option', { value: String(o) }, String(o))));
      s.value = String(cur);
      s.addEventListener('change', () => set(typeof spec.default === 'number' ? Number(s.value) : s.value));
      input = s;
    } else if (spec.type === 'toggle') {
      const c = h('input', { type: 'checkbox' }); c.checked = !!cur;
      c.addEventListener('change', () => set(c.checked));
      input = c;
    } else if (spec.type === 'color') {
      const c = h('input', { type: 'color', value: normHex(String(cur)) });
      c.addEventListener('change', () => set(c.value));
      input = c;
    } else {
      const t = h('input', { type: 'text', value: String(cur ?? '') });
      t.addEventListener('change', () => set(t.value));
      input = t;
    }
    const reset = changed ? h('button', { class: 'mini', title: 'Back to the catalog value', onclick: () => { const next = { ...params }; if (k in def.params) next[k] = def.params[k]; else delete next[k]; setParams(next); } }, '↺') : null;
    controls.append(h('div', { class: 'crow' }, label, input, reset));
  }
}
const fmtNum = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2));
const normHex = (s: string) => (/^#[0-9a-f]{6}$/i.test(s) ? s : /^#[0-9a-f]{3}$/i.test(s) ? '#' + s.slice(1).split('').map((c) => c + c).join('') : '#888888');

/* ───────────────────────── tuning.json ───────────────────────── */
async function saveTuning() {
  let p: Record<string, unknown>;
  try { p = evalParams(paramsEd.text()); } catch (e) { paramsMsg.textContent = String((e as Error).message); paramsMsg.className = 'msg error'; return; }
  const base = UNTUNED_PARAMS[S.id] ?? {};
  const delta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (!same(v, base[k])) delta[k] = v;
  const dropped = Object.keys(base).filter((k) => !(k in p));
  if (dropped.length) { paramsMsg.textContent = `Can't save a removed key (${dropped.join(', ')}): set it to a value instead.`; paramsMsg.className = 'msg error'; return; }
  const res = await fetch('/__wb/file?path=src/assets/tuning.json');
  let json: Record<string, { params?: Record<string, unknown> }> = {};
  try { json = JSON.parse(await res.text()); } catch { json = {}; }
  if (Object.keys(delta).length) json[S.id] = { params: delta }; else delete json[S.id];
  savingTuning = true;
  const sorted = Object.fromEntries(Object.keys(json).sort().map((k) => [k, json[k]]));
  storeParams(S.id, null);
  persist();
  const put = await fetch('/__wb/file?path=src/assets/tuning.json', { method: 'PUT', body: JSON.stringify(sorted, null, 2) + '\n' });
  paramsMsg.textContent = put.ok ? `Saved ${Object.keys(delta).length} key(s) to src/assets/tuning.json — reloading…` : `Save failed: ${await put.text()}`;
  paramsMsg.className = 'msg ' + (put.ok ? 'note' : 'error');
  // the catalog imports tuning.json, so the page reloads with it (Vite does this; this is a fallback)
  if (put.ok) setTimeout(() => location.reload(), 1500);
  else savingTuning = false; // nothing was saved: keep remembering the edits
}

/* ───────────────────────── code files ───────────────────────── */
const loaded = new Map<string, string>(); // path → text on disk
const dirty = new Set<string>();
function renderFileChips() {
  fileChips.textContent = '';
  for (const f of files) {
    fileChips.append(h('button', { class: 'chip' + (codeEd.key === f.path ? ' on' : '') + (dirty.has(f.path) ? ' dirty' : ''), title: f.path + (f.hot ? ' (hot-swaps)' : ' (page reloads on save)'), onclick: () => openFile(f.path) }, f.title + (dirty.has(f.path) ? ' ●' : '')));
  }
  renderRegionChips();
}
function renderRegionChips() {
  regionChips.textContent = '';
  const f = files.find((x) => x.path === codeEd.key);
  if (!f) return;
  const text = codeEd.text();
  for (const r of f.regions) {
    const at = text ? r.find(text) : null;
    regionChips.append(h('button', { class: 'chip region', disabled: !at, title: at ? `Lines ${lineOf(text, at[0])}–${lineOf(text, at[1])}` : 'Not found in this file', onclick: () => { const a = r.find(codeEd.text()); if (a) codeEd.reveal(a[0], a[1]); } }, r.label));
  }
}
const lineOf = (text: string, off: number) => text.slice(0, off).split('\n').length;
async function fetchFile(path: string) {
  const r = await fetch('/__wb/file?path=' + encodeURIComponent(path));
  if (!r.ok) throw new Error(await r.text());
  return r.text();
}
async function openFile(path?: string) {
  if (!path) return;
  S.file[S.id] = path; persist();
  try {
    if (!loaded.has(path)) loaded.set(path, await fetchFile(path));
    let text = loaded.get(path)!;
    let restored = false;
    if (!codeEd.has(path)) {
      // unsaved text from before a reload
      const buf = sessionStorage.getItem(bufKey(path));
      if (buf !== null && buf !== text) { text = buf; dirty.add(path); restored = true; }
    }
    codeEd.open(path, text);
    codeMsg.textContent = restored ? 'Restored unsaved changes from before the page reloaded.' : '';
    codeMsg.className = 'msg' + (restored ? ' note' : '');
    renderFileChips();
    const f = files.find((x) => x.path === path);
    const first = f?.regions.map((r) => r.find(codeEd.text())).find(Boolean);
    if (first) codeEd.reveal(first[0], first[1]);
  } catch (e) {
    codeMsg.textContent = `Can't open ${path}: ${(e as Error).message}`;
    codeMsg.className = 'msg error';
  }
}
let dirtyTimer = 0;
function markDirty() {
  const path = codeEd.key;
  const isDirty = codeEd.text() !== loaded.get(path);
  if (isDirty !== dirty.has(path)) { if (isDirty) dirty.add(path); else dirty.delete(path); renderFileChips(); }
  clearTimeout(dirtyTimer);
  dirtyTimer = window.setTimeout(() => { try { if (isDirty) sessionStorage.setItem(bufKey(path), codeEd.text()); else sessionStorage.removeItem(bufKey(path)); } catch { /* quota */ } renderRegionChips(); }, 400);
}
async function saveFile() {
  const path = codeEd.key;
  if (!path) return;
  const text = codeEd.text();
  const f = files.find((x) => x.path === path);
  codeMsg.textContent = 'Saving…'; codeMsg.className = 'msg';
  // the dev server tells us (wb:file) when its watcher sees the write — often before the PUT
  // returns — and we swap then; if no event comes (e.g. unchanged text), swap after a moment
  const swapped = f?.hot ? new Promise<void>((resolve) => {
    const t = window.setTimeout(() => { pendingSwaps.delete(path); hotSwap(path).then(resolve); }, 2500);
    pendingSwaps.set(path, () => { clearTimeout(t); resolve(); });
  }) : null;
  const r = await fetch('/__wb/file?path=' + encodeURIComponent(path), { method: 'PUT', body: text });
  if (!r.ok) {
    pendingSwaps.get(path)?.(); pendingSwaps.delete(path);
    codeMsg.textContent = `Save failed: ${await r.text()}`; codeMsg.className = 'msg error'; return;
  }
  loaded.set(path, text);
  dirty.delete(path);
  try { sessionStorage.removeItem(bufKey(path)); } catch { /* ignore */ }
  renderFileChips();
  if (swapped) {
    if (pendingSwaps.has(path)) { codeMsg.textContent = `Saved ${path} — re-importing…`; codeMsg.className = 'msg note'; }
    await swapped;
  } else {
    codeMsg.textContent = `Saved ${path} — the page reloads to pick it up.`; codeMsg.className = 'msg note';
    persistParamsNow(); persist();
    setTimeout(() => location.reload(), 1500);
  }
}
async function revertFile() {
  const path = codeEd.key;
  if (!path) return;
  const r = await fetch('/__wb/head?path=' + encodeURIComponent(path));
  if (!r.ok) { codeMsg.textContent = `No committed version: ${await r.text()}`; codeMsg.className = 'msg error'; return; }
  codeEd.replace(await r.text());
  markDirty();
  codeMsg.textContent = 'Editor now holds the committed version — Save to write it.'; codeMsg.className = 'msg note';
}

/* hot swap: re-import a saved asset module and rebuild */
const builtinNs: Record<string, Record<string, unknown>> = { 'src/assets/models/builtin/marine.ts': { ...marineNs }, 'src/assets/models/builtin/fungi.ts': { ...fungiNs }, 'src/assets/models/builtin/fish.ts': { ...fishNs } };
async function hotSwap(path: string) {
  const url = '/' + path.split('/').map(encodeURIComponent).join('/') + '?t=' + Date.now();
  try {
    const mod = await import(/* @vite-ignore */ url);
    if (path.endsWith('.mjs')) replaceModule('/' + path, mod);
    else if (builtinNs[path]) {
      const old = builtinNs[path];
      for (const [key, b] of Object.entries(BUILTINS)) {
        const next = { ...b } as Record<string, unknown>;
        let hit = false;
        for (const field of ['createAsset', 'params', 'rig'] as const) {
          const name = Object.keys(old).find((n) => old[n] === (b as unknown as Record<string, unknown>)[field]);
          if (name && name in mod) { next[field] = mod[name]; hit = true; }
        }
        if (hit) (BUILTINS as Record<string, unknown>)[key] = next;
      }
      if (mod.FUNGI_BUILTINS) Object.assign(BUILTINS, mod.FUNGI_BUILTINS);
      builtinNs[path] = { ...mod };
    }
    clearModelCache();
    codeMsg.textContent = `Saved & re-imported ${path} (${new Date().toLocaleTimeString()}).`; codeMsg.className = 'msg note';
    await rebuild();
  } catch (e) {
    codeMsg.textContent = `Re-import failed: ${(e as Error).message}`; codeMsg.className = 'msg error';
    errBox.textContent = `Module failed to load: ${(e as Error)?.stack ?? e}`.slice(0, 1600);
    errBox.classList.remove('hidden');
  }
}
/** saves waiting for their module to be swapped in */
const pendingSwaps = new Map<string, () => void>();
if (import.meta.hot) {
  import.meta.hot.on('wb:file', (d: { path: string; own: boolean; hot: boolean }) => {
    if (!d.own || !d.hot) return;
    const done = pendingSwaps.get(d.path);
    pendingSwaps.delete(d.path);
    hotSwap(d.path).then(() => done?.());
  });
}

/* ───────────────────────── spec & diff ───────────────────────── */
function updateSpec() {
  const m = vp.model;
  if (!m) return;
  const ud = { ...(m.raw.userData ?? {}) } as Record<string, unknown>;
  for (const k of ['update', 'setNight']) delete ud[k];
  const b = vp.bounds();
  const out = {
    asset: { id: def.id, family: def.family, module: def.path, loco: def.loco, water: def.water, yaw: def.yaw, realLength: def.realLength, exhibitScale: +m.exhibitScale.toFixed(3) },
    built: { triangles: m.triangles, skinned: m.skinned, clips: m.clips.map((c) => `${c.name} (${c.duration.toFixed(2)} s)`), rig: m.rig.map((r) => `${r.name} ${r.axis} [${r.min}, ${r.max}] (${r.role})`), bounds: b && { length: +b.z.toFixed(4), width: +b.x.toFixed(4), height: +b.y.toFixed(4) } },
    userData: ud,
  };
  specPre.textContent = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[function]' : v instanceof THREE.Object3D ? `[${v.type}]` : typeof v === 'number' ? +v.toFixed(5) : v), 2).slice(0, 200000);
}
async function loadDiff() {
  const paths = files.map((f) => f.path).join(',');
  diffPre.textContent = 'Loading…';
  try {
    const r = await fetch('/__wb/diff?path=' + encodeURIComponent(paths));
    const t = await r.text();
    diffPre.innerHTML = '';
    if (!t.trim()) { diffPre.textContent = 'No changes against HEAD in: ' + files.map((f) => f.path).join(', '); return; }
    for (const line of t.split('\n')) diffPre.append(h('div', { class: line.startsWith('+') && !line.startsWith('+++') ? 'add' : line.startsWith('-') && !line.startsWith('---') ? 'del' : line.startsWith('@@') ? 'hunk' : line.startsWith('diff ') ? 'file' : '' }, line || ' '));
  } catch (e) { diffPre.textContent = String(e); }
}

/* ───────────────────────── reference & overlay ───────────────────────── */
async function updateReference() {
  await mediaReady;
  const md = MEDIA[def.id];
  ($('.refname') as HTMLElement).textContent = `${def.emoji} ${def.name}`;
  ($('.refsci') as HTMLElement).textContent = def.info.scientific ?? '';
  if (md?.photo?.src) {
    const src = 'species/' + md.photo.src;
    if (!refImg.src.endsWith(src)) { refImg.src = src; overlayImg.src = src; }
    refImg.classList.remove('hidden');
    refCredit.innerHTML = '';
    refCredit.append('Photo: ', md.photo.url ? h('a', { href: md.photo.url, target: '_blank', rel: 'noopener' }, md.photo.by ?? 'source') : md.photo.by ?? '', md.photo.lic ? ` · ${md.photo.lic}` : '', md.wiki ? h('span', {}, ' · ', h('a', { href: md.wiki, target: '_blank', rel: 'noopener' }, 'Wikipedia')) : '');
  } else {
    refImg.removeAttribute('src'); overlayImg.removeAttribute('src');
    refImg.classList.add('hidden');
    refCredit.textContent = 'No reference photo for this asset.';
  }
  const i = def.info;
  const b = vp.bounds();
  refInfo.innerHTML = '';
  const rowEl = (k: string, v?: string) => (v ? h('div', { class: 'fact' }, h('span', {}, k), h('span', {}, v)) : null);
  const rows: (HTMLElement | null)[] = [
    rowEl('Taxonomy', [i.class, i.order, i.family].filter(Boolean).join(' › ')),
    rowEl('Real size', i.size ?? (def.realLength ? fmtLen(def.realLength) : undefined)),
    rowEl('Model', b ? `${fmtLen(b.z)} long, ${fmtLen(b.y)} tall${S.trueScale ? '' : ' (exhibit size)'}` : undefined),
    rowEl('Diet', i.diet), rowEl('Status', i.status),
    i.fact ? h('p', { class: 'fact-text' }, i.fact) : null,
    md?.about ? h('p', { class: 'about' }, md.about.slice(0, 420) + (md.about.length > 420 ? '…' : '')) : null,
  ];
  refInfo.append(...rows.filter((r): r is HTMLElement => !!r));
  applyOverlay();
}
function applyOverlay() {
  const o = S.overlay;
  overlayImg.classList.toggle('hidden', !o.on || !overlayImg.getAttribute('src'));
  overlayImg.style.opacity = String(o.opacity);
  overlayImg.style.transform = `translate(calc(-50% + ${o.x}px), calc(-50% + ${o.y}px)) scale(${o.s * (o.flip ? -1 : 1)}, ${o.s})`;
  overlayImg.classList.toggle('align', o.on);
}
// drag & wheel the overlay (only while it is shown; hold Alt to orbit through it)
let drag: { x: number; y: number; ox: number; oy: number } | null = null;
overlayImg.addEventListener('pointerdown', (e) => { if (e.altKey) return; drag = { x: e.clientX, y: e.clientY, ox: S.overlay.x, oy: S.overlay.y }; overlayImg.setPointerCapture(e.pointerId); e.preventDefault(); });
overlayImg.addEventListener('pointermove', (e) => { if (!drag) return; S.overlay.x = drag.ox + e.clientX - drag.x; S.overlay.y = drag.oy + e.clientY - drag.y; applyOverlay(); });
overlayImg.addEventListener('pointerup', () => { drag = null; persist(); });
overlayImg.addEventListener('wheel', (e) => { e.preventDefault(); S.overlay.s = Math.max(0.1, Math.min(8, S.overlay.s * Math.exp(-e.deltaY * 0.0012))); applyOverlay(); persist(); }, { passive: false });

/* ───────────────────────── snapshots & sheets ───────────────────────── */
function snapshot(label?: string) {
  const url = vp.capture();
  const cap = label ?? new Date().toLocaleTimeString();
  const img = h('img', { src: url, title: 'Click: compare over the live view · double-click: download' });
  const card = h('figure', { class: 'snap' }, img, h('figcaption', {}, `${def.name} · ${cap}`), h('button', { class: 'mini x', title: 'Remove', onclick: () => card.remove() }, '✕'));
  img.addEventListener('click', () => {
    const on = overlayImg.dataset.snap !== url;
    overlayImg.dataset.snap = on ? url : '';
    overlayImg.src = on ? url : MEDIA[def.id]?.photo?.src ? 'species/' + MEDIA[def.id]!.photo!.src : '';
    if (on) { S.overlay.on = true; S.overlay.x = 0; S.overlay.y = 0; S.overlay.flip = false; S.overlay.s = 1; overlayImg.classList.add('snapmode'); }
    else overlayImg.classList.remove('snapmode');
    ovBtn.classList.toggle('on', S.overlay.on);
    applyOverlay();
  });
  img.addEventListener('dblclick', () => { const a = h('a', { href: url, download: `${def.id.replace('/', '-')}-${Date.now()}.png` }); a.click(); });
  strip.prepend(card);
  return url;
}
/** A composite image: the reference photo and the model from several views. */
type AnyView = ViewName | 'head' | 'headside' | 'body' | 'bodyside';
async function sheet(views: AnyView[] = ['front34', 'side', 'front', 'top'], w = 420, hgt = 320): Promise<string> {
  await building;
  const cam = vp.cameraState();
  const shots: [string, string][] = [];
  for (const v of views) { vp.view(v); shots.push([v, vp.capture(w, hgt)]); }
  vp.setCameraState(cam);
  const photo = MEDIA[def.id]?.photo?.src ? 'species/' + MEDIA[def.id]!.photo!.src : null;
  const cells = (photo ? 1 : 0) + shots.length;
  const cv = document.createElement('canvas');
  const pad = 8, head = 34;
  cv.width = cells * (w + pad) + pad; cv.height = hgt + head + pad;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#f4efe4'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#2b2620'; g.font = 'bold 16px system-ui, sans-serif';
  g.fillText(`${def.emoji} ${def.name}  ·  ${def.id}  ·  ${def.info.scientific ?? ''}`, pad, 23);
  let x = pad;
  const label = (t: string, x0: number) => { g.font = '12px system-ui, sans-serif'; g.fillStyle = '#fffc'; g.fillRect(x0 + 4, head + hgt - 20, g.measureText(t).width + 8, 16); g.fillStyle = '#3a3226'; g.fillText(t, x0 + 8, head + hgt - 8); };
  if (photo) {
    const im = new Image(); im.src = photo;
    await im.decode().catch(() => {});
    g.fillStyle = '#ddd5c4'; g.fillRect(x, head, w, hgt);
    if (im.naturalWidth) {
      const k = Math.min(w / im.naturalWidth, hgt / im.naturalHeight);
      const iw = im.naturalWidth * k, ih = im.naturalHeight * k;
      g.drawImage(im, x + (w - iw) / 2, head + (hgt - ih) / 2, iw, ih);
    }
    label('photo', x);
    x += w + pad;
  }
  for (const [v, url] of shots) {
    const im = new Image(); im.src = url;
    await im.decode();
    g.drawImage(im, x, head, w, hgt);
    label(v, x);
    x += w + pad;
  }
  return cv.toDataURL('image/png');
}
async function openSheet() {
  const url = await sheet();
  const w = window.open('', '_blank');
  if (w) { w.document.title = `${def.name} sheet`; w.document.body.style.margin = '0'; w.document.body.append(Object.assign(w.document.createElement('img'), { src: url, style: 'max-width:100%' })); }
}
async function saveShot(name: string, dataUrl: string) {
  const r = await fetch('/__wb/shot?name=' + encodeURIComponent(name), { method: 'PUT', body: dataUrl });
  return r.ok ? (await r.json()).file as string : Promise.reject(new Error(await r.text()));
}

/* ───────────────────────── tabs & keys ───────────────────────── */
function setTab(t: string) {
  S.tab = t; persist();
  for (const b of tabBar.querySelectorAll<HTMLElement>('.tab')) b.classList.toggle('on', b.dataset.tab === t);
  for (const p of side.querySelectorAll<HTMLElement>('.pane')) p.classList.toggle('on', p.dataset.pane === t);
  if (t === 'code' && !codeEd.key) openFile(S.file[S.id] ?? files[0]?.path);
  if (t === 'code' && codeEd.key && !files.some((f) => f.path === codeEd.key)) openFile(files[0]?.path);
  if (t === 'diff') loadDiff();
  if (t === 'spec') updateSpec();
}
window.addEventListener('keydown', (e) => {
  const tgt = e.target as HTMLElement;
  if (tgt.closest('.cm-editor') || ['INPUT', 'SELECT', 'TEXTAREA'].includes(tgt.tagName)) {
    if (e.key === 'Escape') (tgt as HTMLElement).blur();
    return;
  }
  const views: ViewName[] = ['front34', 'front', 'side', 'right', 'back', 'top', 'low'];
  if (/^[1-7]$/.test(e.key)) { vp.view(views[Number(e.key) - 1]); return; }
  if (e.key === '8' || e.key === '9') { vp.view(e.key === '8' ? 'head' : 'headside'); return; }
  if (e.key === '/') { e.preventDefault(); search.focus(); return; }
  if (e.key === ' ') { e.preventDefault(); playBtn.click(); return; }
  if (e.key === 'w') { S.wire = !S.wire; vp.setWire(S.wire); persist(); return; }
  if (e.key === 'r') { S.rotate = !S.rotate; vp.autoRotate = S.rotate; persist(); return; }
  if (e.key === 'o') { ovBtn.click(); return; }
  if (e.key === 's') { snapshot(); return; }
  if (e.key === 'f') { vp.fit(true); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const ids = [...itemEls.keys()];
    const i = ids.indexOf(S.id);
    const next = ids[Math.max(0, Math.min(ids.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (next) select(next);
  }
});
window.addEventListener('beforeunload', () => { persistParamsNow(); try { localStorage.setItem(LS, JSON.stringify(S)); } catch { /* ignore */ } });

/* ───────────────────────── automation API ───────────────────────── */
const api = {
  /** resolves when the current build has finished */
  ready: async () => { await mediaReady; await building; await sleep(30); },
  ids: () => ANIMALS.map((d) => d.id),
  /** animal ids in a library group (e.g. 'Mammals') and/or module family (e.g. 'wildform') */
  idsWhere: (o: { group?: string | null; family?: string | null }) => ANIMALS.filter((d) => (!o.group || d.group === o.group) && (!o.family || d.family === o.family)).map((d) => d.id),
  /** show the reference photo over the view at this opacity (0 hides it) */
  overlay: (opacity: number) => { S.overlay.on = opacity > 0; S.overlay.opacity = opacity; ovBtn.classList.toggle('on', S.overlay.on); applyOverlay(); },
  select: async (id: string, keepEdits = false) => { await select(id, keepEdits); await api.ready(); },
  params: () => ({ ...params }),
  setParams: async (p: Record<string, unknown> | string) => { await setParams(typeof p === 'string' ? evalParams(p) : p); await api.ready(); },
  /** shallow-merge keys (objects such as specOverride merge one level deep) */
  patchParams: async (p: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...params };
    for (const [k, v] of Object.entries(p)) next[k] = v && typeof v === 'object' && !Array.isArray(v) && next[k] && typeof next[k] === 'object' ? { ...(next[k] as object), ...v } : v;
    await setParams(next); await api.ready();
  },
  resetParams: async () => { resetParams(); await api.ready(); },
  view: (v: AnyView) => vp.view(v),
  views: () => Object.keys(VIEW_DIRS),
  clip: (name: string, phase?: number) => { S.clip = name; vp.playClip(name); clipSel.value = name; if (phase !== undefined) { vp.playing = false; vp.scrub(phase); } },
  pause: (on = true) => { vp.playing = !on; },
  quality: async (q: Quality) => { S.q = q; await rebuild(); await api.ready(); },
  trueScale: async (on: boolean) => { S.trueScale = on; await rebuild(); await api.ready(); },
  tab: (t: string) => setTab(t),
  capture: (w?: number, hh?: number) => vp.capture(w, hh),
  sheet: (views?: AnyView[], w?: number, hh?: number) => sheet(views, w, hh),
  saveShot: (name: string, dataUrl: string) => saveShot(name, dataUrl),
  info: () => ({ id: def.id, triangles: vp.model?.triangles, bounds: vp.bounds()?.toArray(), buildMs: lastBuildMs, clips: vp.model?.clips.map((c) => c.name), error: errBox.classList.contains('hidden') ? null : errBox.textContent }),
  hotSwap: (path: string) => hotSwap(path),
  /** the Code tab: open one of this animal's files, read or replace its text, save it */
  code: {
    files: () => files.map((f) => f.path),
    open: async (path: string) => { setTab('code'); await openFile(path); },
    text: () => codeEd.text(),
    setText: (t: string) => { codeEd.replace(t); markDirty(); },
    save: async () => { await saveFile(); await sleep(50); await api.ready(); },
    message: () => codeMsg.textContent,
  },
  viewport: vp,
};
(window as unknown as { wb: typeof api }).wb = api;

/* ───────────────────────── start ───────────────────────── */
mediaReady.then(() => renderList());
renderList();
setTab(S.tab);
select(def.id).then(() => {
  if (startView) vp.view(startView as AnyView);
  const ph = URLP.get('phase');
  if (ph !== null) api.clip(S.clip || vp.clipName, Number(ph));
  if (URLP.get('overlay')) { S.overlay.on = true; S.overlay.opacity = Number(URLP.get('overlay')); applyOverlay(); }
});
