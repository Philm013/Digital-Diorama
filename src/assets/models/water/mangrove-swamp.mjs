/*
 * MANGROVE SWAMP (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * Tidal mangrove forest: trees stand on arching stilt roots over brackish water, pencil-like
 * pneumatophores poke up from the mud to breathe, and the tide floods and drains the channels —
 * set it high to drown the roots or low to expose the mud. A slow tidal current carries leaves
 * between the trunks and small fish school in the shade.
 *
 * QUICK START
 *   import { createAsset } from './mangrove-swamp.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // `tide` raises or lowers the water across the whole forest floor
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | turquoise | blackwater | sunset | dry — Theme
 *   size                20–80 m (default 36) — Size
 *   trees               1–30 (default 10) — Mangroves
 *   tide                -0.6–0.8 m (default -0.05) — Tide
 *   current             0–0.8 m/s (default 0.15) — Tidal Current
 *   pneumatophores      0–1 (default 0.6) — Breathing Roots
 *   fishAmount          0–60 (default 18) — Fish
 *   seaWater            on/off (default on) — Own Sea
 *   chainEnds           on/off (default off) — Standard Creek Inlet
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 23) — Seed
 *   mud                 colour (default #6f5c44) — Mud Colour
 *   mudWet              colour (default #4a3d2e) — Mud Wet Colour
 *   water               colour (default #5f8a72) — Water Colour
 *   deep                colour (default #2f4f45) — Deep Colour
 *   foam                colour (default #e6ece2) — Foam Colour
 *   root                colour (default #7a6a55) — Root Colour
 *   rootDark            colour (default #5a4c3c) — Root Dark Colour
 *   bark                colour (default #6a5a48) — Bark Colour
 *   leaf                colour (default #3f7a3a) — Leaf Colour
 *   leafDark            colour (default #2a5a2f) — Leaf Dark Colour
 *   propagule           colour (default #6a8a3a) — Propagule Colour
 *   fish                colour (default #a8b0a0) — Fish Colour
 *   fin                 colour (default #5a6458) — Fin Colour
 *   soil                colour (default #3f3428) — Soil Colour
 *   crab                colour (default #c0503a) — Crab Colour
 *
 * SPECS  26,971 triangles at defaults, 2 materials, 6 draw calls when merged,
 *        36.0 x 12.7 x 36.0 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: trees, pneumatophores, fish, debris
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  addWire, sweep, rng, noise2, fbm2, smooth, mixC, heightField, makeWaterMaterial, waterify, waterGrid,
  chainEnds, tileEdge, partsBag, makeSurface, makeFishSchool, polyline, makeDrifters, bindModule
} from './kit.mjs';

const BASE = {
  mud: '#6f5c44', mudWet: '#4a3d2e', water: '#5f8a72', deep: '#2f4f45', foam: '#e6ece2', root: '#7a6a55', rootDark: '#5a4c3c',
  bark: '#6a5a48', leaf: '#3f7a3a', leafDark: '#2a5a2f', propagule: '#6a8a3a', fish: '#a8b0a0', fin: '#5a6458', soil: '#3f3428', crab: '#c0503a',
};
export const COLORWAYS = {
  'default': { ...BASE },
  turquoise: { ...BASE, water: '#3f9a8f', deep: '#1f6a62', mud: '#8a7a5f' },
  blackwater: { ...BASE, water: '#3a3a2a', deep: '#1f1f17', leaf: '#2f6a32' },
  sunset: { ...BASE, water: '#7a6a5a', deep: '#4a3a3a', leaf: '#4f7a35', foam: '#f8e8d8' },
  dry: { ...BASE, mud: '#8a7458', mudWet: '#6a5642', leaf: '#5a8a3f' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  size: { type: 'range', default: 36, min: 20, max: 80, step: 2, unit: 'm', label: 'Size', affects: 'geometry', describe: 'Square patch edge length.' },
  trees: { type: 'range', default: 10, min: 1, max: 30, step: 1, label: 'Mangroves', affects: 'geometry', describe: 'Number of mangrove trees.' },
  tide: { type: 'range', default: -0.05, min: -0.6, max: 0.8, step: 0.05, unit: 'm', label: 'Tide', affects: 'geometry', describe: 'Water level relative to the mud flat.' },
  current: { type: 'range', default: 0.15, min: 0, max: 0.8, step: 0.05, unit: 'm/s', label: 'Tidal Current', affects: 'geometry', describe: 'Speed of the ebb / flood current.' },
  pneumatophores: { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Breathing Roots', affects: 'geometry', describe: 'Density of pencil roots in the mud.' },
  fishAmount: { type: 'range', default: 18, min: 0, max: 60, step: 1, label: 'Fish', affects: 'geometry', describe: 'Juvenile fish sheltering between the roots.' },
  seaWater: { type: 'toggle', default: true, label: 'Own Sea', affects: 'geometry', describe: 'The asset’s own patch of sea. Turn it off when the asset sits in an ocean tile, which then supplies (and shoals) the water.' },
  chainEnds: { type: 'toggle', default: false, label: 'Standard Creek Inlet', affects: 'geometry', describe: 'The tidal creek enters at −X in the shared river cross-section, so a river reach can feed the swamp seamlessly.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away mud and water sections.' },
  seed: { type: 'range', default: 23, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['trees', 'pneumatophores', 'fish', 'debris'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'mangrove-swamp';
  const P = partsBag();
  const S = p.size, r = rng(p.seed), wl = p.tide;
  const chan = (x) => Math.sin(x * 0.12 + p.seed) * S * 0.12 * (p.chainEnds ? smooth(-S / 2, -S / 2 + 10, x) : 1);
  const h0 = (x, z) => 0.1 + (fbm2(x * 0.08, z * 0.08, p.seed, 3) - 0.5) * 0.7 - 1.1 * smooth(3.4, 1, Math.abs(z - chan(x)));
  const h = p.chainEnds ? chainEnds(h0, { axis: 'x', lo: -S / 2, hi: S / 2, inlet: { w: 4, wl: wl } }) : h0;
  const n = Math.max(40, Math.round(S / 0.6));
  const terrainCol = (x, y, z) => (y < wl - 0.1 ? C.mudWet : noise2(x * 0.5, z * 0.5, p.seed) > 0.6 ? C.mudWet : C.mud);
  P.solid.push({ g: heightField(S, S, n, n, h, terrainCol), c: null, n: 'mudflat' });
  const pts = [];
  for (let x = -S / 2; x <= S / 2 + 0.01; x += 1) pts.push([x, wl, chan(x)]);
  const line = polyline(pts);
  if (p.seaWater) P.water.push({
    g: waterify(waterGrid(S, S, Math.round(S / 0.9), Math.round(S / 0.8), wl), (x, y, z) => {
      const nr = line.nearest(x, z);
      return { s: x, u: z, speed: p.current * (0.4 + 0.6 * smooth(4, 0, nr.d)), foam: 0.015, ripple: 1, mode: 2, ocean: 0.2, color: mixC(C.water, C.deep, smooth(0.1, 1.2, wl - h(x, z))) };
    }),
    c: null, n: 'tidewater',
  });
  tileEdge(p, P.solid, p.seaWater ? P.water : null, S, S, n, n, h, -2.5, [C.mud, C.soil, C.mudWet], () => wl, C.deep);
  // Mangroves: trunk on arching prop roots + canopy
  const trees = P.sub('trees', [0, 0, 0]), rootPts = [];
  for (let i = 0; i < p.trees; i++) {
    let x = 0, z = 0;
    for (let k = 0; k < 20; k++) { x = (r() - 0.5) * S * 0.85; z = (r() - 0.5) * S * 0.85; if (Math.abs(z - chan(x)) > 3.5) break; }
    const y0 = h(x, z), ht = 4 + r() * 4, hub = y0 + 1.2 + r() * 0.6;
    trees.solid.push({ g: sweep([[x, hub, z], [x + (r() - 0.5) * 0.4, hub + ht * 0.45, z + (r() - 0.5) * 0.4], [x + (r() - 0.5) * 0.6, hub + ht * 0.8, z]], (t) => 0.16 * (1 - t * 0.5), 6, 5, true), c: C.bark, n: 'trunk' });
    const nr = 6 + Math.floor(r() * 5);
    for (let k = 0; k < nr; k++) {
      const a = (k / nr) * Math.PI * 2 + r() * 0.4, reach = 1.3 + r() * 1.3, sy = hub - 0.2 + r() * 0.6;
      const ex = x + Math.cos(a) * reach, ez = z + Math.sin(a) * reach;
      trees.solid.push({ g: sweep([[x, sy, z], [x + Math.cos(a) * reach * 0.45, sy + 0.35, z + Math.sin(a) * reach * 0.45], [ex, h(ex, ez) - 0.2, ez]], (t) => 0.06 * (1 - t * 0.4), 5, 8, false), c: k % 2 ? C.root : C.rootDark, n: 'prop-root' });
      rootPts.push([ex, ez]);
    }
    for (let k = 0; k < 6; k++) {
      const a = r() * 6.28, d = r() * 1.6, cy = hub + ht * (0.7 + r() * 0.3);
      trees.solid.push({ g: new THREE.IcosahedronGeometry(1.2 + r() * 0.8, 1).scale(1, 0.65, 1).translate(x + Math.cos(a) * d, cy, z + Math.sin(a) * d), c: k % 2 ? C.leaf : C.leafDark, n: 'canopy' });
    }
    for (let k = 0; k < 4; k++) addWire(trees.solid, [x + (r() - 0.5) * 2, hub + ht * 0.6, z + (r() - 0.5) * 2], [x + (r() - 0.5) * 2, hub + ht * 0.6 - 0.35, z + (r() - 0.5) * 2], C.propagule, 0.02, 3);
  }
  const pn = P.sub('pneumatophores', [0, 0, 0]);
  for (let i = 0; i < Math.round(p.pneumatophores * S * S * 0.25); i++) {
    const x = (r() - 0.5) * S * 0.95, z = (r() - 0.5) * S * 0.95, y = h(x, z), ht = 0.15 + r() * 0.35;
    pn.solid.push({ g: new THREE.ConeGeometry(0.018, ht, 4).translate(x, y + ht / 2, z), c: C.rootDark, n: 'pneumatophore' });
  }
  const objects = [];
  if (p.fishAmount > 0 && wl > -0.3) objects.push(makeFishSchool('fish', { count: p.fishAmount, center: [0, Math.min(wl - 0.25, -0.2), chan(0)], radius: [S * 0.3, 2.2], wander: 0.1, speed: 0.6, size: 0.12, colors: [C.fish, C.foam, C.fin], spread: 0.5, seed: p.seed }));
  objects.push(makeDrifters('debris', line, { count: 16, speed: p.current, halfWidth: 2.5, kind: 'leaf', colors: [C.leaf, C.bark], size: 0.12, seed: p.seed }));
  const waterMat = makeWaterMaterial({ waves: [[1, 0.2, 0.02, 3]], opacity: 0.72, foam: C.foam, streakAlong: 0.4, streakAcross: 0.8, roughness: 0.1, ripples: rootPts.filter((q) => h(q[0], q[1]) < wl).slice(0, 6).map((q) => [q[0], q[1], -0.8, 0.006]) });
  finalize(g, P, p, C, {
    waterMat, objects, tick: (t) => { for (const o of objects) (o.userData.swim || o.userData.drift)(t); },
    ports: p.chainEnds ? { inlet: { position: [-S / 2, wl, 0], direction: [1, 0, 0], width: 4, level: wl, s: 0 } } : undefined,
    ground: { h, col: terrainCol, w: S, d: S },
  });
  g.userData.surface = makeSurface(g, (lx, lz) => (h(lx, lz) < wl ? wl : null));
  return g;
}
export default createAsset;
