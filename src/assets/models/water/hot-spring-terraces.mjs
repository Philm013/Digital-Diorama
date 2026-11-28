/*
 * HOT SPRING TERRACES (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * Travertine terraces built by mineral-rich hot water: a steaming source pool spills down a
 * staircase of scalloped rimmed basins, thin sheets cascading over every lip into the next pool.
 * Colours grade from orange microbial mats at the hot source to milky turquoise pools on white
 * travertine below.
 *
 * QUICK START
 *   import { createAsset } from './hot-spring-terraces.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // water enters at the top tier (−X) and steps down toward +X
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | mammoth | rust | jade | dusk — Theme
 *   tiers               2–10 (default 6) — Terraces
 *   width               6–40 m (default 18) — Width
 *   length              8–60 m (default 24) — Length
 *   stepHeight          0.3–2 m (default 0.9) — Step Height
 *   flow                0–1 (default 0.6) — Overflow
 *   steamAmount         0–1 (default 0.6) — Steam
 *   chainEnds           on/off (default off) — Standard Outflow
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 25) — Seed
 *   travertine          colour (default #f2efe6) — Travertine Colour
 *   travDark            colour (default #d8d2c2) — Trav Dark Colour
 *   rim                 colour (default #fbfaf5) — Rim Colour
 *   mat                 colour (default #d8803a) — Mat Colour
 *   matLight            colour (default #e8b060) — Mat Light Colour
 *   ground              colour (default #b8a888) — Ground Colour
 *   soil                colour (default #7a6a55) — Soil Colour
 *   water               colour (default #6fd0d8) — Water Colour
 *   deep                colour (default #2fa0b8) — Deep Colour
 *   foam                colour (default #ffffff) — Foam Colour
 *   steam               colour (default #f6f8fa) — Steam Colour
 *
 * SPECS  21,178 triangles at defaults, 3 materials, 4 draw calls when merged,
 *        24.0 x 9.3 x 24.0 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: cascades, steam
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  rng, noise2, smooth, lerp, mixC, heightField, makeWaterMaterial, waterify, waterGrid, waterRibbon,
  chainProfile, tileEdge, partsBag, makeEmitter, bindModule
} from './kit.mjs';

const BASE = {
  travertine: '#f2efe6', travDark: '#d8d2c2', rim: '#fbfaf5', mat: '#d8803a', matLight: '#e8b060', ground: '#b8a888', soil: '#7a6a55',
  water: '#6fd0d8', deep: '#2fa0b8', foam: '#ffffff', steam: '#f6f8fa',
};
export const COLORWAYS = {
  'default': { ...BASE },
  mammoth: { ...BASE, travertine: '#ece2cc', travDark: '#d2c4a4', mat: '#c87a3a', water: '#7fc8c0' },
  rust: { ...BASE, travertine: '#d89a62', travDark: '#b8784a', rim: '#e8b07a', mat: '#a84a2a', water: '#5fb0b8' },
  jade: { ...BASE, travertine: '#dfe8dc', travDark: '#bcd0bc', water: '#5fc8a0', deep: '#2f9a7a' },
  dusk: { ...BASE, water: '#7aa8e0', deep: '#3a6ab0', steam: '#ffe8f0' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  tiers: { type: 'range', default: 6, min: 2, max: 10, step: 1, label: 'Terraces', affects: 'geometry', describe: 'Number of stepped pools.' },
  width: { type: 'range', default: 18, min: 6, max: 40, step: 1, unit: 'm', label: 'Width', affects: 'geometry', describe: 'Terrace width (Z).' },
  length: { type: 'range', default: 24, min: 8, max: 60, step: 1, unit: 'm', label: 'Length', affects: 'geometry', describe: 'Downhill extent (X).' },
  stepHeight: { type: 'range', default: 0.9, min: 0.3, max: 2, step: 0.05, unit: 'm', label: 'Step Height', affects: 'geometry', describe: 'Drop between terraces.' },
  flow: { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Overflow', affects: 'geometry', describe: 'How much water spills over the rims.' },
  steamAmount: { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Steam', affects: 'geometry', describe: 'Steam wisps over the upper pools.' },
  chainEnds: { type: 'toggle', default: false, label: 'Standard Outflow', affects: 'geometry', describe: 'The lowest pool drains into a 10 m outflow run in the shared river cross-section, so a brook can carry the warm water on seamlessly.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away sections.' },
  seed: { type: 'range', default: 25, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['cascades', 'steam'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'hot-spring-terraces';
  const P = partsBag();
  const T = p.tiers, Lx = p.length, Wt = p.width, hw = Wt / 2, sh = p.stepHeight, r = rng(p.seed), seg = Lx / T;
  const lvl = (k) => (T - 1 - k) * sh;
  const lipX = (k, z) => -Lx / 2 + (k + 1) * seg - 0.35 - 0.7 * Math.abs(Math.sin(z * 0.55 + k * 1.7)) - 0.3 * noise2(z * 0.4, k, p.seed);
  const tierOf = (x) => Math.max(0, Math.min(T - 1, Math.floor((x + Lx / 2) / seg)));
  const Lrun = p.chainEnds ? 10 : 0, wO = 3, wlOut = -0.35, lipLast = lipX(T - 1, 0);
  const runLvl = (x) => lerp(lvl(T - 1) - 0.04, wlOut, smooth(lipLast, Lx / 2 + Lrun, x));
  const h0 = (x, z) => {
    const k = tierOf(x), lx = lipX(k, z), y0 = lvl(k), next = k < T - 1 ? lvl(k + 1) : lvl(k) - sh;
    let y;
    if (x < lx - 0.35) y = y0 - 0.32 - 0.1 * noise2(x, z, p.seed);
    else if (x < lx) y = lerp(y0 - 0.32, y0 + 0.07, smooth(lx - 0.35, lx, x));
    else y = lerp(y0 + 0.07, next - 0.32, smooth(lx, lx + Math.min(0.9, seg * 0.3), x)) - 0.05 * Math.abs(Math.sin(z * 4.1 + k));
    const side = smooth(hw - 1.6, hw, Math.abs(z));
    return lerp(y, Math.max(y, y0 + 0.4), side) + smooth(hw, hw + 4, Math.abs(z)) * 1.2;
  };
  // Outflow run: past the last lip the ground becomes the standard channel carrying the water on
  const h = p.chainEnds ? (x, z) => (x > lipLast ? lerp(h0(Math.min(x, Lx / 2 - 0.01), z), chainProfile(z, wO, runLvl(x)), smooth(lipLast, lipLast + 1.2, x)) : h0(x, z)) : h0;
  const S = Math.max(Lx, Wt) * 1.1, nx = Math.max(40, Math.round((Lx + Lrun) / 0.3)), nz = Math.max(30, Math.round((Wt + 6) / 0.35));
  P.solid.push({
    g: heightField(Lx + Lrun, Wt + 6, nx, nz, h, (x, y, z, sl) => {
      if (x > lipLast + 0.6) return Math.abs(z) < wO / 2 + 0.4 ? C.travDark : C.ground;
      const k = tierOf(x), hot = 1 - k / Math.max(1, T - 1);
      if (Math.abs(z) > hw + 0.5) return C.ground;
      if (sl > 0.5) return hot > 0.7 && noise2(x, z, p.seed) > 0.4 ? C.mat : C.travDark;
      if (Math.abs(x - lipX(k, z)) < 0.2) return C.rim;
      return hot > 0.8 ? C.matLight : C.travertine;
    }, Lrun / 2, 0),
    c: null, n: 'travertine',
  });
  tileEdge(p, P.solid, P.water, Lx + Lrun, Wt + 6, nx, nz, h, lvl(T - 1) - sh - 2.5, [C.travDark, C.ground, C.soil], (x) => (x > Lx / 2 ? runLvl(x) : lvl(tierOf(x)) - (x > lipX(tierOf(x), 0) ? 99 : 0)), C.deep, Lrun / 2, 0);
  if (p.chainEnds) {
    const oPts = [];
    for (let x = lipLast - 0.2; x <= Lx / 2 + Lrun + 0.01; x += 0.5) oPts.push([x, runLvl(x) + 0.01, 0]);
    P.water.push({ g: waterify(waterRibbon(oPts, wO / 2 + 0.4, 4), (x, y, z, s, u) => ({ s, u, speed: 0.8, foam: 0.12 * smooth(lipLast + 2, lipLast, x), mode: 2, ripple: 1, color: mixC(C.water, C.deep, 0.15) })), c: null, n: 'outflow' });
  }
  // Pools (flat, clipped by the rims) — colour shifts from hot orange-green to turquoise downhill
  for (let k = 0; k < T; k++) {
    const x0 = -Lx / 2 + k * seg, len = seg - 0.2, hot = 1 - k / Math.max(1, T - 1);
    P.water.push({
      g: waterify(waterGrid(len, Wt - 1, Math.max(6, Math.round(len / 0.5)), Math.max(6, Math.round(Wt / 0.5)), lvl(k), x0 + len / 2, 0), (x, y, z) => ({
        s: x, u: z, speed: 0.15 + 0.3 * p.flow, foam: 0.25 * smooth(lipX(k, z) - 0.8, lipX(k, z), x) * p.flow, ripple: 1,
        color: mixC(mixC(C.water, C.deep, smooth(lipX(k, z) - 2, lipX(k, z) - seg, x) * 0.4), C.matLight, hot * hot * 0.45),
      })),
      c: null, n: 'pool',
    });
  }
  // Cascading sheets over each lip
  const cas = P.sub('cascades', [0, 0, 0]);
  for (let k = 0; k < T - 1; k++) {
    const nS = Math.round(3 + p.flow * 6);
    for (let i = 0; i < nS; i++) {
      const z = (i / Math.max(1, nS - 1) - 0.5) * (Wt - 3) + (r() - 0.5) * 0.6, lx = lipX(k, z), y0 = lvl(k) + 0.02, y1 = lvl(k + 1), fp = [];
      for (let j = 0; j <= 6; j++) { const t = j / 6; fp.push([lx + 0.02 + t * Math.min(0.9, seg * 0.3) * 0.9, lerp(y0, y1, t * t * (3 - 2 * t)) + 0.02, z]); }
      cas.water.push({ g: waterify(waterRibbon(fp, 0.25 + r() * 0.5 * p.flow, 3, [0, 0, 1]), (x, y, zz, s, u) => ({ s, u, speed: 0.9, mode: 1, foam: 0.35, color: mixC(C.water, C.foam, 0.35) })), c: null, n: 'sheet' });
    }
  }
  const emitters = [];
  if (p.steamAmount > 0) emitters.push(makeEmitter('steam', { count: Math.round(70 * p.steamAmount), shape: 'cloud', color: C.steam, opacity: 0.18, drag: 0.4, grow: [0.6, 3], gravity: [0.2, 0.3, 0], seed: p.seed,
    spawn: (i, rr) => { const k = rr() < 0.6 ? 0 : 1, x = -Lx / 2 + (k + rr() * 0.8) * seg; return { p: [x, lvl(k) + 0.2, (rr() - 0.5) * (Wt - 2)], v: [0.2, 0.5 + rr() * 0.6, 0], life: 6 + rr() * 3, size: 0.5 + rr() * 0.5 }; } }));
  const waterMat = makeWaterMaterial({ opacity: 0.8, foam: C.foam, streakAlong: 0.6, streakAcross: 1.2, roughness: 0.05, ripples: [[-Lx / 2 + seg * 0.3, 0, -1.2, 0.02], [-Lx / 2 + seg * 0.3, 1.2, -0.9, 0.015]] });
  const terrainCol = (x, y, z) => (x > lipLast + 0.6 ? C.ground : Math.abs(z) > hw + 0.5 ? C.ground : C.travertine);
  return finalize(g, P, p, C, {
    waterMat, emitters,
    ports: { outlet: p.chainEnds ? { position: [Lx / 2 + Lrun, wlOut, 0], direction: [1, 0, 0], width: wO, level: wlOut, s: 0 } : { position: [Lx / 2, lvl(T - 1), 0], direction: [1, 0, 0], width: Wt, level: lvl(T - 1), s: 0 } },
    ground: { h, col: terrainCol, w: Lx + Lrun, d: Wt + 6, cx: Lrun / 2 },
  });
}
export default createAsset;
