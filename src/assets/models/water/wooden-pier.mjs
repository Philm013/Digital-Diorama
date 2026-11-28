/*
 * WOODEN PIER (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A timber pier marching out from the beach on paired piles: X-braced bents, stringers and plank
 * decking, railings, bollards, a life ring, a ladder down to the water, lamp posts and an optional
 * T-head. Swell rolls in beneath it, foam collars swirl around every pile, ripple rings spread
 * from the piles in deeper water, and the cut-away sea walls ride the waves.
 *
 * QUICK START
 *   import { createAsset } from './wooden-pier.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   boat.userData.waterSurface = pier.userData.surface;   // moor boats alongside
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | cedar | whitePainted | tar | tropical — Theme
 *   length              10–120 m (default 40) — Length
 *   width               2–8 m (default 3.5) — Deck Width
 *   deckHeight          1–5 m (default 2.2) — Deck Height
 *   bay                 1.8–4.5 m (default 2.6) — Bent Spacing
 *   tHead               on/off (default on) — T-head
 *   railing             on/off (default on) — Railing
 *   lamps               0–12 (default 4) — Lamp Posts
 *   waterDepth          1–10 m (default 3) — Water Depth
 *   waves               0–1.5 m (default 0.4) — Swell
 *   site                beach | structure — Site
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 6) — Seed
 *   deck                colour (default #9a8a74) — Deck Colour
 *   deckDark            colour (default #7f705c) — Deck Dark Colour
 *   pile                colour (default #6a5a48) — Pile Colour
 *   rail                colour (default #b8ab95) — Rail Colour
 *   iron                colour (default #3a3a3a) — Iron Colour
 *   lamp                colour (default #ffd890) — Lamp Colour
 *   buoy                colour (default #e8502f) — Buoy Colour
 *   sand                colour (default #d6c39a) — Sand Colour
 *   wetSand             colour (default #b4a078) — Wet Sand Colour
 *   water               colour (default #2f8aa0) — Water Colour
 *   deep                colour (default #165f7a) — Deep Colour
 *   foam                colour (default #f6fcff) — Foam Colour
 *   soil                colour (default #7a6248) — Soil Colour
 *
 * SPECS  16,450 triangles at defaults, 3 materials, 7 draw calls when merged,
 *        29.5 x 11.7 x 62.0 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: railing, lamps, ladder, props
 *        night: pier-lamps
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.surface.heightAt(x, z, t)
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  addCylinder, addWire, noise2, smooth, lerp, mixC, heightField, makeWaterMaterial, waterify, waterGrid,
  waterSkirt, tileEdge, partsBag, makeSurface, swellAt, makeGlowMaterial, addLathe, bindModule
} from './kit.mjs';

const BASE = {
  deck: '#9a8a74', deckDark: '#7f705c', pile: '#6a5a48', rail: '#b8ab95', iron: '#3a3a3a', lamp: '#ffd890', buoy: '#e8502f',
  sand: '#d6c39a', wetSand: '#b4a078', water: '#2f8aa0', deep: '#165f7a', foam: '#f6fcff', soil: '#7a6248',
};
export const COLORWAYS = {
  'default': { ...BASE },
  cedar: { ...BASE, deck: '#b07a4a', deckDark: '#8f5f38', pile: '#6a4a30', rail: '#c08a5a' },
  whitePainted: { ...BASE, deck: '#d8d4cc', deckDark: '#b8b4ac', rail: '#f4f2ee', pile: '#7a7068' },
  tar: { ...BASE, deck: '#4a443e', deckDark: '#3a3530', pile: '#2a2622', rail: '#5a544c' },
  tropical: { ...BASE, water: '#22b0bf', deep: '#0a7a95', sand: '#f2e6c8', wetSand: '#d8c8a0' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  length: { type: 'range', default: 40, min: 10, max: 120, step: 1, unit: 'm', label: 'Length', affects: 'geometry', describe: 'Pier length from the shore (+Z).' },
  width: { type: 'range', default: 3.5, min: 2, max: 8, step: 0.1, unit: 'm', label: 'Deck Width', affects: 'geometry', describe: 'Walkway width.' },
  deckHeight: { type: 'range', default: 2.2, min: 1, max: 5, step: 0.1, unit: 'm', label: 'Deck Height', affects: 'geometry', describe: 'Deck above mean sea level.' },
  bay: { type: 'range', default: 2.6, min: 1.8, max: 4.5, step: 0.1, unit: 'm', label: 'Bent Spacing', affects: 'geometry', describe: 'Distance between pile bents.' },
  tHead: { type: 'toggle', default: true, label: 'T-head', affects: 'geometry', describe: 'Wide platform at the seaward end.' },
  railing: { type: 'toggle', default: true, label: 'Railing', affects: 'geometry', describe: 'Hand rails along both edges.' },
  lamps: { type: 'range', default: 4, min: 0, max: 12, step: 1, label: 'Lamp Posts', affects: 'geometry', describe: 'Number of lamp posts.' },
  waterDepth: { type: 'range', default: 3, min: 1, max: 10, step: 0.25, unit: 'm', label: 'Water Depth', affects: 'geometry', describe: 'Depth at the seaward end.' },
  waves: { type: 'range', default: 0.4, min: 0, max: 1.5, step: 0.05, unit: 'm', label: 'Swell', affects: 'geometry', describe: 'Wave height.' },
  site: { type: 'choice', default: 'beach', options: ['beach', 'structure'], label: 'Site', affects: 'geometry', describe: 'Beach: the pier with its own sloping beach and sea. Structure: the pier alone, piles sunk to the water depth, to stand on another beach or harbour floor (the sea comes from there).' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away soil sections. Off: a short flange so the patch can sit in surrounding terrain.' },
  seed: { type: 'range', default: 6, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['railing', 'lamps', 'ladder', 'props'];
export const night = { 'pier-lamps': { color: '#ffd890', intensity: 0.6, distance: 14, offset: [0, 5.4, 20], describe: 'Pier lamp light pooled on the deck.' } };

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'wooden-pier';
  const P = partsBag();
  const L = p.length, Wd = p.width, Hd = p.deckHeight, D = p.waterDepth, hw = Wd / 2;
  const TW = Math.max(24, Wd * 5 + (p.tHead ? 12 : 0)), Z0 = -10, Z1 = L + 12, TD = Z1 - Z0, czT = (Z0 + Z1) / 2;
  const own = p.site !== 'structure';
  const h = (x, z) => (!own ? -D - 1 : z < 0 ? 0.9 - z * 0.05 : lerp(0.9, -D - 0.5, smooth(0, L * 0.9, z))) + 0.1 * (noise2(x * 0.3, z * 0.3, p.seed) - 0.5);
  const nx = Math.round(TW / 0.8), nz = Math.round(TD / 0.8);
  const terrainCol = (x, y) => (y > 0.3 ? C.sand : C.wetSand);
  if (own) P.solid.push({ g: heightField(TW, TD, nx, nz, h, terrainCol, 0, czT), c: null, n: 'seabed' });
  if (own) tileEdge(p, P.solid, null, TW, TD, nx, nz, h, -D - 3, [C.sand, C.soil, C.wetSand], null, 0, 0, czT);
  // Bents: paired piles + caps + X-bracing (four piles under the T-head)
  const piles = [], headW = p.tHead ? Wd * 3 : Wd, headL = p.tHead ? 7 : 0;
  for (let z = 1.5; z <= L + 0.01; z += p.bay) {
    const wide = p.tHead && z > L - headL, xs = wide ? [-headW / 2 + 0.25, -hw + 0.25, hw - 0.25, headW / 2 - 0.25] : [-hw + 0.25, hw - 0.25];
    for (const x of xs) { const yb = h(x, z) - 0.5; addCylinder(P.solid, 0.16, 0.18, Hd - yb, 7, x, (Hd + yb) / 2 - 0.1, z, 0, 0, 0, C.pile); piles.push([x, z]); }
    P.solid.push({ g: new THREE.BoxGeometry((wide ? headW : Wd) + 0.2, 0.25, 0.3).translate(0, Hd - 0.32, z), c: C.pile, n: 'pile-cap' });
    const yb = Math.max(h(0, z), -1.5);
    addWire(P.solid, [xs[0], yb + 0.4, z], [xs[xs.length - 1], Hd - 0.5, z], C.pile, 0.06, 4);
    addWire(P.solid, [xs[xs.length - 1], yb + 0.4, z], [xs[0], Hd - 0.5, z], C.pile, 0.06, 4);
  }
  for (const s of [-1, 1]) P.solid.push({ g: new THREE.BoxGeometry(0.18, 0.3, L + 0.5).translate(s * (hw - 0.3), Hd - 0.6, L / 2 + 0.6), c: C.deckDark, n: 'stringer' });
  for (let z = 0; z < L + 0.3; z += 0.3) P.solid.push({ g: new THREE.BoxGeometry((p.tHead && z > L - headL ? headW : Wd) + 0.1, 0.06, 0.27).translate(0, Hd - 0.17, z + 0.15), c: Math.floor(z / 0.3) % 3 ? C.deck : C.deckDark, n: 'plank' });
  // Railing, lamps, bollards + life ring, ladder
  if (p.railing) {
    const rl = P.sub('railing', [0, Hd, 0]), zEnd = p.tHead ? L - headL : L;
    for (const s of [-1, 1]) {
      const xr = s * (hw - 0.05);
      for (let z = 0.2; z <= zEnd + 0.01; z += p.bay) addWire(rl.solid, [xr, Hd - 0.14, z], [xr, Hd + 1.0, z], C.rail, 0.05, 4);
      addWire(rl.solid, [xr, Hd + 1.0, 0.2], [xr, Hd + 1.0, zEnd], C.rail, 0.04, 4);
      addWire(rl.solid, [xr, Hd + 0.55, 0.2], [xr, Hd + 0.55, zEnd], C.rail, 0.03, 4);
      if (p.tHead) {
        const xh = (s * headW) / 2;
        addWire(rl.solid, [xh, Hd + 1.0, L - headL], [xh, Hd + 1.0, L + 0.3], C.rail, 0.04, 4);
        addWire(rl.solid, [xr, Hd + 1.0, L - headL], [xh, Hd + 1.0, L - headL], C.rail, 0.04, 4);
        for (let z = L - headL; z <= L + 0.31; z += 1.5) addWire(rl.solid, [xh, Hd - 0.14, z], [xh, Hd + 1.0, z], C.rail, 0.05, 4);
      }
    }
    if (p.tHead) addWire(rl.solid, [-headW / 2, Hd + 1.0, L + 0.3], [headW / 2, Hd + 1.0, L + 0.3], C.rail, 0.04, 4);
  }
  let glowMat = null;
  if (p.lamps > 0) {
    glowMat = makeGlowMaterial();
    const lp = P.sub('lamps', [0, Hd, 0]);
    for (let i = 0; i < p.lamps; i++) {
      const z = ((i + 0.5) / p.lamps) * L, x = (i % 2 ? 1 : -1) * (hw - 0.15);
      addLathe(lp.solid, [[0.1, 0], [0.06, 0.2], [0.05, 3], [0.1, 3.1], [0, 3.15]], 6, C.iron, x, Hd - 0.14, z);
      lp.glow.push({ g: new THREE.OctahedronGeometry(0.18, 0).scale(1, 1.3, 1).translate(x, Hd + 3.25, z), c: C.lamp, n: 'lamp' });
    }
  }
  const pr = P.sub('props', [0, Hd, L]);
  for (const s of [-1, 1]) addLathe(pr.solid, [[0.15, 0], [0.15, 0.35], [0.22, 0.42], [0, 0.45]], 8, C.iron, s * (hw - 0.3), Hd - 0.14, L - 1);
  pr.solid.push({ g: new THREE.TorusGeometry(0.35, 0.09, 6, 14).rotateY(Math.PI / 2).translate(hw - 0.12, Hd + 0.62, L * 0.5), c: C.buoy, n: 'life-ring' });
  const ld = P.sub('ladder', [hw, 0, L]);
  for (const s of [-0.25, 0.25]) addWire(ld.solid, [hw + 0.08, Hd, L + s - 0.6], [hw + 0.08, -1, L + s - 0.6], C.iron, 0.03, 4);
  for (let y = -0.8; y < Hd; y += 0.3) addWire(ld.solid, [hw + 0.08, y, L - 0.85], [hw + 0.08, y, L - 0.35], C.iron, 0.02, 3);
  // Sea: foam on the shoreline and around the piles; the cut-away walls hang from the surface edge
  const Lw = 14, kw = (2 * Math.PI) / Lw;
  const waves = [[0.15, -1, Math.min(0.5, (p.waves / 2) * kw), Lw], [-0.4, -0.9, Math.min(0.2, (p.waves / 6) * kw * 2), Lw * 0.55]];
  const wz0 = -2, wD = Z1 - wz0;
  const sea = waterify(waterGrid(TW, wD, Math.round(TW / 0.9), Math.round(wD / 0.8), 0, 0, (wz0 + Z1) / 2), (x, y, z) => {
    const d = -h(x, z);
    let f = d < 0.3 ? 0.7 : 0.03;
    for (const q of piles) { const dd = Math.hypot(x - q[0], z - q[1]); if (dd < 1.2) f = Math.max(f, 0.75 * smooth(1.0, 0.2, dd)); }
    return { s: z, u: x, speed: 0.8, foam: f, ocean: smooth(-0.2, 1.5, d) * 0.8 + 0.2, ripple: 1, color: mixC(C.water, C.deep, smooth(0.5, D, d)) };
  });
  if (own) P.water.push({ g: sea, c: null, n: 'sea' });
  if (own && p.diorama) waterSkirt(P.water, sea, (x, z) => h(x, z), (x, y) => mixC(C.water, C.deep, smooth(0, -D, y)), (x, z) => h(x, z) < -0.02);
  const deepPiles = piles.filter((q) => q[1] > L * 0.5).slice(-6);
  const waterMat = makeWaterMaterial({ waves, opacity: 0.84, foam: C.foam, streakAlong: 0.4, streakAcross: 0.6, roughness: 0.12, ripples: deepPiles.map((q) => [q[0], q[1], -1.4, 0.03]) });
  g.userData.view = { target: [0, Hd * 0.5, L * 0.45], radius: Math.max(L * 0.95, 24) };
  finalize(g, P, p, C, { waterMat: own ? waterMat : null, glowMat, ground: own ? { h, col: terrainCol, w: TW, d: TD, cz: czT } : undefined });
  if (own) g.userData.surface = makeSurface(g, (lx, lz, t, wx, wz) => (h(lx, lz) > 0 ? null : swellAt(waves, wx, wz, t, waterMat.userData.uniforms.uWaveAmp.value)));
  return g;
}
export default createAsset;
