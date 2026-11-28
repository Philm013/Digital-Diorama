/*
 * GEYSER BASIN (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A geothermal basin around a sinter cone: the vent pool simmers and surges, then the geyser
 * erupts on a timed cycle — a column of water shoots to the set height and rains back, a steam
 * cloud billows and drifts off — before falling quiet again. Rainbow-ringed hot pools (blue
 * centres grading through green, yellow and orange microbial mats), steaming fumaroles and runoff
 * channels complete the scene.
 *
 * QUICK START
 *   import { createAsset } from './geyser.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // eruptions repeat every `interval` seconds for `duration` × interval
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | iceland | winter | dawn | sulfur — Theme
 *   size                20–80 m (default 36) — Basin Size
 *   height              5–60 m (default 25) — Eruption Height
 *   interval            10–120 s (default 36) — Interval
 *   duration            0.1–0.6 (default 0.28) — Eruption Duration
 *   steamAmount         0–1 (default 0.7) — Steam
 *   pools               0–6 (default 3) — Hot Pools
 *   runoff              0–1 (default 0.6) — Runoff
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 15) — Seed
 *   sinter              colour (default #d8d2c2) — Sinter Colour
 *   sinterDark          colour (default #b0a894) — Sinter Dark Colour
 *   mat                 colour (default #e0a040) — Mat Colour
 *   matRed              colour (default #c0582a) — Mat Red Colour
 *   matGreen            colour (default #9aa83a) — Mat Green Colour
 *   ground              colour (default #a89a82) — Ground Colour
 *   soil                colour (default #6a5a48) — Soil Colour
 *   water               colour (default #2fb8d0) — Water Colour
 *   deep                colour (default #0f6f9a) — Deep Colour
 *   foam                colour (default #ffffff) — Foam Colour
 *   steam               colour (default #f4f6f8) — Steam Colour
 *   rim                 colour (default #f0e0a0) — Rim Colour
 *
 * SPECS  22,749 triangles at defaults, 6 materials, 7 draw calls when merged,
 *        36.0 x 6.2 x 36.0 m (W x H x D, real-world scale).
 * PARTS animate: vent (translate y 0…0.3 m)
 *        detach: column, steam, fumaroles, splash
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  rng, noise2, fbm2, smooth, lerp, mixC, heightField, makeWaterMaterial, waterify, waterDisc, tileEdge, partsBag,
  makeEmitter, bindModule
} from './kit.mjs';

const BASE = {
  sinter: '#d8d2c2', sinterDark: '#b0a894', mat: '#e0a040', matRed: '#c0582a', matGreen: '#9aa83a', ground: '#a89a82', soil: '#6a5a48',
  water: '#2fb8d0', deep: '#0f6f9a', foam: '#ffffff', steam: '#f4f6f8', rim: '#f0e0a0',
};
export const COLORWAYS = {
  'default': { ...BASE },
  iceland: { ...BASE, ground: '#5a5650', sinter: '#c8c4b8', sinterDark: '#8a867c', mat: '#c89a4a' },
  winter: { ...BASE, ground: '#e8eef2', sinter: '#dfe4e6', steam: '#ffffff' },
  dawn: { ...BASE, steam: '#ffe8e0', sinter: '#e8d8c8', water: '#3fa8c8' },
  sulfur: { ...BASE, mat: '#e8d040', matRed: '#d08a2a', matGreen: '#b8c03a', water: '#5fc8b0' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  size: { type: 'range', default: 36, min: 20, max: 80, step: 2, unit: 'm', label: 'Basin Size', affects: 'geometry', describe: 'Square basin edge length.' },
  height: { type: 'range', default: 25, min: 5, max: 60, step: 1, unit: 'm', label: 'Eruption Height', affects: 'geometry', describe: 'Peak column height (launch speed √(2gh)).' },
  interval: { type: 'range', default: 36, min: 10, max: 120, step: 1, unit: 's', label: 'Interval', affects: 'geometry', describe: 'Seconds between eruptions.' },
  duration: { type: 'range', default: 0.28, min: 0.1, max: 0.6, step: 0.01, label: 'Eruption Duration', affects: 'geometry', describe: 'Fraction of each cycle spent erupting.' },
  steamAmount: { type: 'range', default: 0.7, min: 0, max: 1, step: 0.05, label: 'Steam', affects: 'geometry', describe: 'Steam cloud and fumarole density.' },
  pools: { type: 'range', default: 3, min: 0, max: 6, step: 1, label: 'Hot Pools', affects: 'geometry', describe: 'Rainbow hot springs around the cone.' },
  runoff: { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Runoff', affects: 'geometry', describe: 'Shallow runoff channels and microbial mats.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away sections.' },
  seed: { type: 'range', default: 15, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = { vent: { type: 'translate', axis: 'y', range: [0, 0.3], describe: 'Vent pool surge (auto-animated before each eruption).' } };
export const detach = ['column', 'steam', 'fumaroles', 'splash'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'geyser';
  const P = partsBag();
  const S = p.size, r = rng(p.seed), coneH = 1.6 + p.height * 0.03, coneR = 5 + p.height * 0.08;
  const pools = [];
  for (let i = 0; i < p.pools * 8 && pools.length < p.pools; i++) {
    const a = r() * 6.28, d = coneR + 3 + r() * (S * 0.4 - coneR - 4), q = { x: Math.cos(a) * d, z: Math.sin(a) * d, rad: 1.4 + r() * 2.2 };
    if (pools.every((o) => Math.hypot(o.x - q.x, o.z - q.z) > o.rad + q.rad + 1.5)) pools.push(q);
  }
  const chans = [];
  for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.28 + r(); chans.push(a); }
  const h = (x, z) => {
    const d = Math.hypot(x, z), a = Math.atan2(z, x);
    let y = (fbm2(x * 0.08, z * 0.08, p.seed, 3) - 0.5) * 0.5 + coneH * Math.max(0, 1 - d / coneR) ** 1.4;
    y += 0.12 * Math.sin(d * 3.2) * smooth(coneR, coneR * 0.3, d);
    if (d < 1.1) y -= (1.1 - d) * 0.8;
    for (const ch of chans) { const da = Math.abs(((a - ch + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * d; y -= 0.18 * p.runoff * smooth(1.2, 0, da) * smooth(coneR * 0.6, coneR * 1.5, d); }
    for (const q of pools) { const k = Math.hypot(x - q.x, z - q.z) / q.rad; if (k < 1.2) y = Math.min(y, lerp(-1.8, y, smooth(0.7, 1.15, k))); }
    return y;
  };
  const n = Math.max(40, Math.round(S / 0.5));
  const terrainCol = (x, y, z) => {
      const d = Math.hypot(x, z);
      for (const q of pools) { const k = Math.hypot(x - q.x, z - q.z) / q.rad; if (k < 1.5) return k < 1.15 ? C.rim : k < 1.3 ? C.mat : C.matRed; }
      if (d < coneR) return Math.floor(d * 1.6) % 2 ? C.sinter : C.sinterDark;
      if (p.runoff > 0 && y < -0.1) return noise2(x, z, p.seed) > 0.5 ? C.mat : C.matRed;
      return d < coneR * 1.6 ? C.sinterDark : noise2(x * 0.2, z * 0.2, p.seed) > 0.5 ? C.ground : C.matGreen;
  };
  P.solid.push({ g: heightField(S, S, n, n, h, terrainCol), c: null, n: 'basin' });
  tileEdge(p, P.solid, null, S, S, n, n, h, -4, [C.sinterDark, C.ground, C.soil]);
  // Vent pool (surges before eruptions) + hot pools with microbial colour rings
  const vent = P.sub('vent', [0, coneH - 0.35, 0]);
  vent.water.push({ g: waterify(waterDisc(1.3, 5, coneH - 0.35), (x, y, z) => ({ s: x, u: z, speed: 0.6, foam: 0.35, ripple: 1, mode: 2, color: mixC(C.water, C.deep, 0.4) })), c: null, n: 'vent-pool' });
  for (const q of pools) {
    P.water.push({ g: waterify(waterDisc(q.rad * 1.1, 6, -0.05, q.x, q.z), (x, y, z) => { const k = Math.hypot(x - q.x, z - q.z) / q.rad; return { s: x, u: z, speed: 0.1, foam: 0, ripple: 1, color: k < 0.55 ? mixC(C.deep, C.water, k / 0.55) : k < 0.85 ? mixC(C.water, C.matGreen, (k - 0.55) / 0.3) : mixC(C.matGreen, C.mat, (k - 0.85) / 0.25) }; }), c: null, n: 'hot-pool' });
  }
  const top = coneH - 0.3, v0 = Math.sqrt(2 * 9.81 * p.height), cyc = [p.interval, p.duration, 0.45];
  const emitters = [
    makeEmitter('column', { count: 520, shape: 'streak', color: C.foam, stretch: 0.35, drag: 0.05, cycle: cyc, floor: -0.5, seed: p.seed,
      spawn: (i, rr) => { const a = rr() * 6.28, sp = rr() * 0.07 * v0; return { p: [(rr() - 0.5) * 0.6, top, (rr() - 0.5) * 0.6], v: [Math.cos(a) * sp, v0 * (0.78 + rr() * 0.24), Math.sin(a) * sp], life: (2 * v0) / 9.81 + 0.6, size: 0.09 + rr() * 0.1 }; } }),
    makeEmitter('splash', { count: 80, shape: 'drop', color: C.foam, stretch: 0.05, floor: top - 0.3, seed: p.seed + 1,
      spawn: (i, rr) => { const a = rr() * 6.28, sp = 0.5 + rr(); return { p: [Math.cos(a) * 0.4, top, Math.sin(a) * 0.4], v: [Math.cos(a) * sp, 1.2 + rr() * 2.5, Math.sin(a) * sp], life: 0.9, size: 0.05 + rr() * 0.05 }; } }),
  ];
  if (p.steamAmount > 0) {
    emitters.push(makeEmitter('steam', { count: Math.round(90 * p.steamAmount), shape: 'cloud', color: C.steam, opacity: 0.26, drag: 0.6, grow: [1, 4.5], gravity: [0.4, 0.6, 0.1], cycle: [p.interval, Math.min(0.9, p.duration * 1.6), 0.2], seed: p.seed + 2,
      spawn: (i, rr) => ({ p: [(rr() - 0.5) * 1.5, top + rr() * p.height * 0.6, (rr() - 0.5) * 1.5], v: [(rr() - 0.5) * 2, 2 + rr() * 4, (rr() - 0.5) * 2], life: 7 + rr() * 3, size: 0.8 + rr() * 0.8 }) }));
    const fum = pools.map((q) => [q.x, 0, q.z]).concat([[coneR * 1.2, 0, -coneR * 0.6], [-coneR, 0, coneR * 1.1]]);
    emitters.push(makeEmitter('fumaroles', { count: Math.round(14 * fum.length * p.steamAmount) + 1, shape: 'puff', color: C.steam, opacity: 0.2, drag: 0.5, grow: [0.4, 2.4], gravity: [0.25, 0.4, 0], seed: p.seed + 3,
      spawn: (i, rr) => { const f = fum[i % fum.length]; return { p: [f[0] + (rr() - 0.5), 0.1, f[2] + (rr() - 0.5)], v: [0, 0.8 + rr(), 0], life: 4 + rr() * 2, size: 0.4 + rr() * 0.4 }; } }));
  }
  const waterMat = makeWaterMaterial({ opacity: 0.85, foam: C.foam, streakAlong: 0.8, streakAcross: 0.8, roughness: 0.06, ripples: [[0, 0, -0.6, 0.03]].concat(pools.slice(0, 5).map((q) => [q.x, q.z, -q.rad * 0.4, 0.008])) });
  return finalize(g, P, p, C, {
    waterMat, emitters, ground: { h, col: terrainCol, w: S, d: S },
    tick: (t, dt, drive) => {
      const ph = (t % p.interval) / p.interval;
      drive('vent', ph > 0.85 ? (ph - 0.85) / 0.15 * 0.25 : ph < p.duration ? 0.25 * (1 - ph / p.duration) : 0);
      const sp = emitters[1].userData.uniforms.uEmit; sp.value = ph > 0.75 || ph < p.duration ? 1 : 0.25;
    },
  });
}
export default createAsset;
