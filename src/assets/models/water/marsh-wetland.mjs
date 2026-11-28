/*
 * MARSH & WETLAND (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A freshwater marsh: a mosaic of shallow pools and winding channels between sedge hummocks and
 * mudflats, duckweed rafts drifting on the water, reeds and cattails rippling in the wind,
 * marsh-gas bubbles plopping up through the ooze, a heron fishing in the shallows and a raised
 * boardwalk crossing it all.
 *
 * QUICK START
 *   import { createAsset } from './marsh-wetland.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // the water table sits at y = 0; raise `wetness` to drown more of the hummocks
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | autumn | spring | swamp | winter — Theme
 *   size                20–100 m (default 40) — Size
 *   wetness             0.1–0.95 (default 0.55) — Wetness
 *   reeds               0–1 (default 0.7) — Reeds & Cattails
 *   duckweedAmount      0–1 (default 0.4) — Duckweed
 *   boardwalk           on/off (default on) — Boardwalk
 *   showHeron           on/off (default on) — Heron
 *   bubbles             on/off (default on) — Marsh Gas
 *   wind                0–1 (default 0.35) — Wind
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 31) — Seed
 *   sedge               colour (default #8a9a52) — Sedge Colour
 *   sedgeDark           colour (default #6a7a3f) — Sedge Dark Colour
 *   mud                 colour (default #5a4a35) — Mud Colour
 *   mudWet              colour (default #3f3427) — Mud Wet Colour
 *   water               colour (default #4f6f5a) — Water Colour
 *   deep                colour (default #2f4a3a) — Deep Colour
 *   duckweed            colour (default #8fbf3f) — Duckweed Colour
 *   foam                colour (default #eef2e8) — Foam Colour
 *   reed                colour (default #a8a55a) — Reed Colour
 *   reedHead            colour (default #5f4228) — Reed Head Colour
 *   wood                colour (default #8a6a48) — Wood Colour
 *   post                colour (default #5a4433) — Post Colour
 *   heron               colour (default #9aa4ac) — Heron Colour
 *   heronDark           colour (default #4a5058) — Heron Dark Colour
 *   beak                colour (default #e0a83a) — Beak Colour
 *   soil                colour (default #4a3a2a) — Soil Colour
 *
 * SPECS  33,173 triangles at defaults, 4 materials, 7 draw calls when merged,
 *        40.1 x 4.3 x 40.0 m (W x H x D, real-world scale).
 * PARTS animate: neck (rotate x -60…20°)
 *        detach: boardwalk, heron, vegetation, gas
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  addCylinder, addWire, sweep, rng, noise2, fbm2, smooth, lerp, mixC, heightField, makeWaterMaterial, waterify,
  waterGrid, makeSwayMaterial, swayify, addReeds, rimmed, tileEdge, partsBag, makeSurface, makeEmitter, polyline,
  bindModule
} from './kit.mjs';

const BASE = {
  sedge: '#8a9a52', sedgeDark: '#6a7a3f', mud: '#5a4a35', mudWet: '#3f3427', water: '#4f6f5a', deep: '#2f4a3a', duckweed: '#8fbf3f', foam: '#eef2e8',
  reed: '#a8a55a', reedHead: '#5f4228', wood: '#8a6a48', post: '#5a4433', heron: '#9aa4ac', heronDark: '#4a5058', beak: '#e0a83a', soil: '#4a3a2a',
};
export const COLORWAYS = {
  'default': { ...BASE },
  autumn: { ...BASE, sedge: '#b0944a', sedgeDark: '#8a703a', reed: '#c8a85a', duckweed: '#a8a83a' },
  spring: { ...BASE, sedge: '#8fbf55', sedgeDark: '#6f9f45', duckweed: '#a8d84a', water: '#5f8f6a' },
  swamp: { ...BASE, water: '#4a5a3a', deep: '#2a3522', sedge: '#5f7f3a', mud: '#3f3528' },
  winter: { ...BASE, sedge: '#d8d4c4', sedgeDark: '#b8b4a4', reed: '#c8bc98', water: '#6f8a8f', duckweed: '#8a9a7a' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  size: { type: 'range', default: 40, min: 20, max: 100, step: 2, unit: 'm', label: 'Size', affects: 'geometry', describe: 'Square marsh patch edge length.' },
  wetness: { type: 'range', default: 0.55, min: 0.1, max: 0.95, step: 0.05, label: 'Wetness', affects: 'geometry', describe: 'Fraction of the marsh under open water.' },
  reeds: { type: 'range', default: 0.7, min: 0, max: 1, step: 0.05, label: 'Reeds & Cattails', affects: 'geometry', describe: 'Emergent vegetation density.' },
  duckweedAmount: { type: 'range', default: 0.4, min: 0, max: 1, step: 0.05, label: 'Duckweed', affects: 'colors', describe: 'Green floating duckweed rafts on the pools.' },
  boardwalk: { type: 'toggle', default: true, label: 'Boardwalk', affects: 'geometry', describe: 'Raised timber walkway across the marsh.' },
  showHeron: { type: 'toggle', default: true, label: 'Heron', affects: 'geometry', describe: 'A wading heron (it strikes at fish).' },
  bubbles: { type: 'toggle', default: true, label: 'Marsh Gas', affects: 'geometry', describe: 'Methane bubbles rising through the shallows.' },
  wind: { type: 'range', default: 0.35, min: 0, max: 1, step: 0.05, label: 'Wind', affects: 'geometry', describe: 'Reed sway and ripple.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away peat and water sections.' },
  seed: { type: 'range', default: 31, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = { neck: { axis: 'x', range: [-60, 20], describe: 'Heron neck strike (auto-animated).' } };
export const detach = ['boardwalk', 'heron', 'vegetation', 'gas'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'marsh-wetland';
  const P = partsBag();
  const S = p.size, r = rng(p.seed), thr = 0.74 - p.wetness * 0.46;
  const field = (x, z) => fbm2(x * 0.07, z * 0.07, p.seed, 4) + Math.sin(x * 0.18 + z * 0.05 + p.seed) * 0.08;
  const h0 = (x, z) => { const f = field(x, z) - thr; return f > 0 ? Math.min(0.45, f * 2.4) + 0.02 : Math.max(-0.9, f * 4.5); };
  const h = p.diorama ? h0 : rimmed(h0, S, S, 0, 6); // set into terrain, the pools close off before the tile edge
  const n = Math.max(40, Math.round(S / 0.5));
  const terrainCol = (x, y, z) => (y < -0.05 ? C.mudWet : y < 0.08 ? C.mud : noise2(x * 0.6, z * 0.6, p.seed) > 0.5 ? C.sedge : C.sedgeDark);
  P.solid.push({ g: heightField(S, S, n, n, h, terrainCol), c: null, n: 'marsh' });
  P.water.push({
    g: waterify(waterGrid(S, S, Math.round(S / 0.8), Math.round(S / 0.7), 0), (x, y, z) => {
      const dw = smooth(0.48, 0.62, noise2(x * 0.25, z * 0.25, p.seed + 4)) * p.duckweedAmount;
      return { s: x, u: z, speed: 0.08 + p.wind * 0.2, foam: 0.01, ocean: 0.3, ripple: 1, color: mixC(mixC(C.water, C.deep, smooth(0, 0.8, -h(x, z))), C.duckweed, dw) };
    }),
    c: null, n: 'pools',
  });
  tileEdge(p, P.solid, P.water, S, S, n, n, h, -2.5, [C.sedgeDark, C.soil, C.mud], () => 0, C.deep);
  const veg = P.sub('vegetation', [0, 0, 0]);
  for (let i = 0; i < Math.round(p.reeds * S * S * 0.05); i++) {
    const x = (r() - 0.5) * S * 0.96, z = (r() - 0.5) * S * 0.96, y = h(x, z);
    if (y < -0.35) continue;
    const tmp = [], ph = (x * 0.3 + z * 0.1);
    addReeds(tmp, x, y - 0.05, z, y > 0.05 ? 5 : 7, y > 0.05 ? 0.9 : 1.7, [C.reed, C.sedgeDark, C.reedHead], p.seed + i, 0.4);
    for (const it of tmp) veg.sway.push({ g: swayify(it.g, ph, y, y + 2.6), c: it.c, n: it.n });
  }
  // Boardwalk on stilts
  if (p.boardwalk) {
    const bw = P.sub('boardwalk', [0, 0, 0]), pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([lerp(-S * 0.48, S * 0.48, t), 0, Math.sin(t * 3.4 + p.seed) * S * 0.15]); }
    const line = polyline(pts), deckY = 0.75;
    for (let s = 0; s < line.length; s += 0.3) {
      const q = line.at(s), a = Math.atan2(q.tx, q.tz);
      bw.solid.push({ g: new THREE.BoxGeometry(1.6, 0.06, 0.26).rotateY(a).translate(q.x, deckY, q.z), c: C.wood, n: 'plank' });
    }
    for (let s = 0; s < line.length; s += 2.2) {
      const q = line.at(s);
      for (const sgn of [-1, 1]) {
        const x = q.x - q.tz * 0.75 * sgn, z = q.z + q.tx * 0.75 * sgn;
        addCylinder(bw.solid, 0.06, 0.07, deckY + 1.4, 5, x, (deckY - 1.4) / 2 + 0.6, z, 0, 0, 0, C.post);
        addWire(bw.solid, [x, deckY + 0.9, z], [x + q.tx * 2.2, deckY + 0.9, z + q.tz * 2.2], C.post, 0.035, 4);
      }
    }
  }
  // Heron
  const hx = S * 0.18, hz = -S * 0.12;
  if (p.showHeron) {
    const hy = Math.max(h(hx, hz), -0.3), he = P.sub('heron', [hx, hy, hz]);
    for (const sgn of [-1, 1]) addWire(he.solid, [hx + sgn * 0.08, hy, hz], [hx + sgn * 0.06, hy + 0.65, hz], C.beak, 0.015, 4);
    he.solid.push({ g: new THREE.OctahedronGeometry(1, 1).scale(0.17, 0.2, 0.38).rotateX(-0.35).translate(hx, hy + 0.85, hz - 0.05), c: C.heron, n: 'body' });
    he.solid.push({ g: new THREE.ConeGeometry(0.12, 0.35, 4).rotateX(-2.2).translate(hx, hy + 0.85, hz - 0.42), c: C.heronDark, n: 'tail' });
    const nk = P.sub('neck', [hx, hy + 0.95, hz + 0.18], 'heron');
    nk.solid.push({ g: sweep([[hx, hy + 0.95, hz + 0.18], [hx, hy + 1.25, hz + 0.12], [hx, hy + 1.45, hz + 0.28]], () => 0.045, 5, 6, false), c: C.heron, n: 'neck' });
    nk.solid.push({ g: new THREE.IcosahedronGeometry(0.07, 0).scale(1, 0.9, 1.4).translate(hx, hy + 1.48, hz + 0.33), c: C.heron, n: 'head' });
    nk.solid.push({ g: new THREE.ConeGeometry(0.025, 0.22, 4).rotateX(Math.PI / 2).translate(hx, hy + 1.47, hz + 0.5), c: C.beak, n: 'beak' });
  }
  const emitters = [];
  if (p.bubbles) {
    const vents = [];
    for (let i = 0; i < 40 && vents.length < 6; i++) { const x = (r() - 0.5) * S * 0.9, z = (r() - 0.5) * S * 0.9, y = h(x, z); if (y < -0.25) vents.push([x, y, z]); }
    if (vents.length) emitters.push(makeEmitter('gas', {
      count: 36, shape: 'bubble', color: C.foam, opacity: 0.6, gravity: [0, 0.6, 0], seed: p.seed + 2,
      spawn: (i, rr) => { const v = vents[i % vents.length]; return { p: [v[0] + (rr() - 0.5) * 0.3, v[1] + 0.05, v[2] + (rr() - 0.5) * 0.3], v: [0, 0.3, 0], life: 2.5 + rr() * 3, size: 0.04 + rr() * 0.05 }; },
      floor: -2,
    }));
    if (emitters[0]) emitters[0].userData.vents = vents;
  }
  const waterMat = makeWaterMaterial({ waves: [[1, 0.3, 0.03 * p.wind, 3]], opacity: 0.8, foam: C.foam, streakAlong: 0.4, streakAcross: 0.4, roughness: 0.1 });
  const swayMat = makeSwayMaterial({ amp: 0.08 + p.wind * 0.3, freq: 1.1 + p.wind * 1.2, dir: [1, 0.25] });
  const U = waterMat.userData.uniforms;
  let next = 0, slot = 0;
  finalize(g, P, p, C, {
    waterMat, swayMat, emitters, ground: { h, col: terrainCol, w: S, d: S },
    tick: (t, dt, drive) => {
      const k = (t % 9) / 9;
      drive('neck', k > 0.8 && k < 0.88 ? -55 * Math.sin(((k - 0.8) / 0.08) * Math.PI) : -8 + 4 * Math.sin(t * 0.7));
      if (k > 0.83 && k < 0.84) { U.uRip.value[7].set(hx, hz + 0.6, t, 0.03); U.uRipCount.value = 8; }
      if (t >= next && emitters[0]) {
        const v = emitters[0].userData.vents[Math.floor(Math.random() * emitters[0].userData.vents.length)];
        U.uRip.value[slot].set(v[0], v[2], t, 0.01); slot = (slot + 1) % 7; U.uRipCount.value = 8; next = t + 0.6 + Math.random();
      }
    },
  });
  g.userData.surface = makeSurface(g, (lx, lz) => (h(lx, lz) < 0 ? 0 : null));
  return g;
}
export default createAsset;
