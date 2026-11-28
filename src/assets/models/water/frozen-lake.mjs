/*
 * FROZEN LAKE (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A lake locked under ice: a translucent sheet webbed with dark cracks and a jagged pressure
 * ridge, wind-sculpted snow drifts, an augered fishing hole where open water still ripples, a
 * little ice-fishing shelter, and an open lead where a stream keeps the ice from closing. Fine
 * snow drifts down.
 *
 * QUICK START
 *   import { createAsset } from './frozen-lake.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // ice surface ≈ y 0; `iceCover` < 1 opens a lead of dark water on the +X side
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | blackIce | dusk | glacial | spring — Theme
 *   size                20–120 m (default 50) — Lake Size
 *   iceCover            0.3–1 (default 0.85) — Ice Cover
 *   thickness           0.05–1 m (default 0.3) — Ice Thickness
 *   snowAmount          0–1 (default 0.5) — Snow Cover
 *   cracks              0–1 (default 0.6) — Cracks
 *   ridge               on/off (default on) — Pressure Ridge
 *   fishingHole         on/off (default on) — Fishing Hole & Shelter
 *   snowfall            0–1 (default 0.3) — Snowfall
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 27) — Seed
 *   ice                 colour (default #bfe0ec) — Ice Colour
 *   iceDark             colour (default #8fc4d8) — Ice Dark Colour
 *   crack               colour (default #2f5f78) — Crack Colour
 *   snow                colour (default #f4f8fb) — Snow Colour
 *   snowShade           colour (default #dde8f0) — Snow Shade Colour
 *   water               colour (default #2f5f72) — Water Colour
 *   deep                colour (default #14354a) — Deep Colour
 *   foam                colour (default #ffffff) — Foam Colour
 *   shore               colour (default #e8eef2) — Shore Colour
 *   rock                colour (default #6f747a) — Rock Colour
 *   bark                colour (default #4f3a2a) — Bark Colour
 *   needle              colour (default #2f5040) — Needle Colour
 *   tent                colour (default #c0392b) — Tent Colour
 *   tentDark            colour (default #8e2a20) — Tent Dark Colour
 *   wood                colour (default #8a6a48) — Wood Colour
 *   soil                colour (default #4a4038) — Soil Colour
 *
 * SPECS  33,551 triangles at defaults, 4 materials, 8 draw calls when merged,
 *        75.4 x 16.7 x 75.3 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: ice, snowdrifts, shelter, snowfall, trees
 *        night: lantern
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  addCylinder, addWire, rng, noise2, fbm2, smooth, lerp, mixC, faceTint, heightField, makeWaterMaterial,
  waterify, waterDisc, addPine, tileEdge, partsBag, makeEmitter, makeGlowMaterial, bindModule
} from './kit.mjs';

const BASE = {
  ice: '#bfe0ec', iceDark: '#8fc4d8', crack: '#2f5f78', snow: '#f4f8fb', snowShade: '#dde8f0', water: '#2f5f72', deep: '#14354a', foam: '#ffffff',
  shore: '#e8eef2', rock: '#6f747a', bark: '#4f3a2a', needle: '#2f5040', tent: '#c0392b', tentDark: '#8e2a20', wood: '#8a6a48', soil: '#4a4038',
};
export const COLORWAYS = {
  'default': { ...BASE },
  blackIce: { ...BASE, ice: '#3f5f6f', iceDark: '#2a4352', crack: '#d8eef6', snow: '#e8eef2' },
  dusk: { ...BASE, ice: '#c8c4e0', iceDark: '#9a94c4', snow: '#f0e8f4', snowShade: '#d8cce4', tent: '#3f6fb0', tentDark: '#2a4f80' },
  glacial: { ...BASE, ice: '#9fd8e8', iceDark: '#5fb4d0', crack: '#1f4f6f' },
  spring: { ...BASE, ice: '#b8d0d8', snow: '#e0e6e8', shore: '#8a9a6a', water: '#3f6f80' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  size: { type: 'range', default: 50, min: 20, max: 120, step: 2, unit: 'm', label: 'Lake Size', affects: 'geometry', describe: 'Lake diameter.' },
  iceCover: { type: 'range', default: 0.85, min: 0.3, max: 1, step: 0.05, label: 'Ice Cover', affects: 'geometry', describe: 'How much of the lake is frozen (an open lead remains on +X).' },
  thickness: { type: 'range', default: 0.3, min: 0.05, max: 1, step: 0.05, unit: 'm', label: 'Ice Thickness', affects: 'geometry', describe: 'Sheet thickness (visible at the hole and the lead).' },
  snowAmount: { type: 'range', default: 0.5, min: 0, max: 1, step: 0.05, label: 'Snow Cover', affects: 'geometry', describe: 'Wind-drifted snow on the ice.' },
  cracks: { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Cracks', affects: 'geometry', describe: 'Crack network density.' },
  ridge: { type: 'toggle', default: true, label: 'Pressure Ridge', affects: 'geometry', describe: 'Buckled slabs where floes pushed together.' },
  fishingHole: { type: 'toggle', default: true, label: 'Fishing Hole & Shelter', affects: 'geometry', describe: 'An augered hole with open water and a pop-up shelter.' },
  snowfall: { type: 'range', default: 0.3, min: 0, max: 1, step: 0.05, label: 'Snowfall', affects: 'geometry', describe: 'Falling snow density.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away showing ice over dark water.' },
  seed: { type: 'range', default: 27, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['ice', 'snowdrifts', 'shelter', 'snowfall', 'trees'];
export const night = { lantern: { color: '#ffb64a', intensity: 0.8, distance: 8, offset: [0, 1.2, 0], describe: 'Lantern glow inside the ice-fishing shelter.' } };

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'frozen-lake';
  const P = partsBag();
  const R0 = p.size / 2, S = p.size * 1.5, r = rng(p.seed), th = p.thickness;
  const Rth = (a) => R0 * (1 + 0.18 * (noise2(Math.cos(a) * 1.5 + 2, Math.sin(a) * 1.5, p.seed) - 0.5) * 2);
  const h = (x, z) => { const k = Math.hypot(x, z) / Rth(Math.atan2(z, x)); return k < 1 ? -3 * Math.pow(1 - k * k, 0.7) - 0.4 : 0.25 + smooth(1, 1.6, k) * (1 + 2.5 * fbm2(x * 0.05, z * 0.05, p.seed, 3)); };
  const n = Math.max(40, Math.round(S / 1));
  const terrainCol = (x, y, z, sl) => (sl > 0.5 ? C.rock : y < -0.2 ? C.rock : noise2(x * 0.3, z * 0.3, p.seed) > 0.5 ? C.shore : C.snowShade);
  P.solid.push({ g: heightField(S, S, n, n, h, terrainCol), c: null, n: 'shore' });
  const leadX = R0 * (1 - 2 * (1 - p.iceCover)) * 1.05;
  const hole = [-R0 * 0.25, R0 * 0.2];
  const inside = (x, z) => Math.hypot(x, z) < Rth(Math.atan2(z, x)) * 1.04 && x < leadX + Math.sin(z * 0.3) * 1.5 && Math.hypot(x - hole[0], z - hole[1]) > (p.fishingHole ? 0.35 : -1);
  // Ice sheet: one slab built from the grid cells inside the lake (top + bottom + edge walls at the lead / hole)
  const ice = P.sub('ice', [0, 0, 0]), cell = Math.max(0.6, p.size / 70), N = Math.ceil(S / cell), top = [], walls = [];
  const yT = 0.02, yB = -th;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x0 = -S / 2 + i * cell, z0 = -S / 2 + j * cell, x1 = x0 + cell, z1 = z0 + cell;
    if (!inside((x0 + x1) / 2, (z0 + z1) / 2)) continue;
    top.push([x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]);
    const nb = [[-1, 0, x0, z0, x0, z1], [1, 0, x1, z1, x1, z0], [0, -1, x1, z0, x0, z0], [0, 1, x0, z1, x1, z1]];
    for (const [di, dj, ax, az, bx, bz] of nb) if (!inside((x0 + x1) / 2 + di * cell, (z0 + z1) / 2 + dj * cell)) walls.push([ax, az, bx, bz]);
  }
  const vT = [], vW = [];
  for (const q of top) vT.push(q[0], yT, q[1]);
  for (let k = top.length - 1; k >= 0; k--) vT.push(top[k][0], yB, top[k][1]);
  for (const [ax, az, bx, bz] of walls) vW.push(ax, yT, az, bx, yT, bz, bx, yB, bz, ax, yT, az, bx, yB, bz, ax, yB, az);
  const gT = new THREE.BufferGeometry(); gT.setAttribute('position', new THREE.Float32BufferAttribute(vT, 3));
  ice.solid.push({ g: faceTint(gT, (x, y, z) => (y < -0.01 ? C.iceDark : noise2(x * 0.35, z * 0.35, p.seed + 1) > 0.55 ? C.iceDark : C.ice)), c: null, n: 'ice-sheet' });
  if (vW.length) { const gW = new THREE.BufferGeometry(); gW.setAttribute('position', new THREE.Float32BufferAttribute(vW, 3)); ice.solid.push({ g: gW, c: C.iceDark, n: 'ice-edge' }); }
  // Cracks: thin dark polylines branching across the ice
  for (let c = 0; c < Math.round(p.cracks * 10); c++) {
    let x = (r() - 0.5) * R0 * 1.4, z = (r() - 0.5) * R0 * 1.4, a = r() * 6.28;
    for (let k = 0; k < 10 + Math.floor(r() * 10); k++) {
      const L = 0.8 + r() * 1.6, nx2 = x + Math.cos(a) * L, nz2 = z + Math.sin(a) * L;
      if (!inside(nx2, nz2) || !inside(x, z)) break;
      const dx = nx2 - x, dz = nz2 - z, w = 0.03 + r() * 0.03, l = Math.hypot(dx, dz);
      ice.solid.push({ g: new THREE.BoxGeometry(l, 0.008, w).rotateY(-Math.atan2(dz, dx)).translate((x + nx2) / 2, yT + 0.004, (z + nz2) / 2), c: C.crack, n: 'crack' });
      x = nx2; z = nz2; a += (r() - 0.5) * 1.1;
    }
  }
  if (p.ridge) {
    for (let k = 0; k < 18; k++) {
      const t = k / 17, x = lerp(-R0 * 0.7, R0 * 0.3, t), z = lerp(R0 * 0.6, -R0 * 0.55, t) + Math.sin(t * 9) * 1.2;
      if (!inside(x, z)) continue;
      const sz = 0.5 + r() * 0.9;
      ice.solid.push({ g: new THREE.BoxGeometry(sz * 1.4, th + 0.05, sz).rotateZ((r() - 0.5) * 1.6).rotateY(r() * 3).translate(x, yT + sz * 0.3, z), c: r() < 0.5 ? C.ice : C.iceDark, n: 'ridge-slab' });
    }
  }
  const drifts = P.sub('snowdrifts', [0, 0, 0]);
  for (let i = 0; i < Math.round(p.snowAmount * 26); i++) {
    const x = (r() - 0.5) * R0 * 1.6, z = (r() - 0.5) * R0 * 1.6;
    if (!inside(x, z)) continue;
    const L = 2 + r() * 5;
    drifts.solid.push({ g: new THREE.IcosahedronGeometry(1, 1).scale(L, 0.12 + r() * 0.15, L * 0.35).rotateY(0.5 + (r() - 0.5) * 0.3).translate(x, yT, z), c: r() < 0.6 ? C.snow : C.snowShade, n: 'drift' });
  }
  // Open water under & beside the ice: lead, fishing hole, sections
  P.water.push({ g: waterify(waterDisc(R0 * 1.3, 16, -0.03), (x, y, z) => ({ s: x, u: z, speed: 0.25, foam: x > leadX - 1 ? 0.04 : 0, ripple: 1, ocean: 0.2, color: mixC(C.water, C.deep, 0.4) })), c: null, n: 'open-water' });
  tileEdge(p, P.solid, P.water, S, S, n, n, h, -4.5, [C.snowShade, C.soil, C.rock], () => -0.03, C.deep);
  let glowMat = null;
  if (p.fishingHole) {
    const sh = P.sub('shelter', [hole[0] + 1.2, 0, hole[1]]), sx = hole[0] + 1.2, sz2 = hole[1];
    for (const sgn of [-1, 1]) sh.solid.push({ g: new THREE.BoxGeometry(2.2, 0.03, 1.9).rotateX(sgn * 0.62).translate(sx, 0.78, sz2 + sgn * 0.68), c: sgn < 0 ? C.tent : C.tentDark, n: 'tent-wall' });
    sh.solid.push({ g: new THREE.BoxGeometry(0.03, 1.5, 2.6).translate(sx + 1.1, 0.75, sz2), c: C.tentDark, n: 'tent-back' });
    addCylinder(sh.solid, 0.2, 0.2, 0.35, 8, sx + 0.3, 0.2, sz2 + 0.5, 0, 0, 0, C.wood);
    addWire(sh.solid, [hole[0], 0.02, hole[1]], [hole[0] + 0.4, 1.0, hole[1] + 0.2], C.bark, 0.012, 3);
    glowMat = makeGlowMaterial();
    sh.glow.push({ g: new THREE.IcosahedronGeometry(0.09, 1).translate(sx + 0.5, 1.1, sz2 - 0.3), c: 0xffc46a, n: 'lantern' });
  }
  const trees = P.sub('trees', [0, 0, 0]);
  for (let i = 0; i < 14; i++) {
    const a = r() * 6.28, d = Rth(a) * (1.25 + r() * 0.4), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x) > S / 2 - 1 || Math.abs(z) > S / 2 - 1) continue;
    const y = h(x, z), ht = 6 + r() * 6;
    addPine(trees.solid, x, y, z, ht, [C.bark, C.needle, C.snow], p.seed + i);
  }
  const emitters = [];
  if (p.snowfall > 0) {
    emitters.push(makeEmitter('snowfall', {
      count: Math.round(400 * p.snowfall), shape: 'flake', color: C.snow, gravity: [0, 0, 0], sway: [0.4, 1.3], seed: p.seed + 4,
      spawn: (i, rr) => { const sp = 0.8 + rr() * 0.6, y0 = 14 + rr() * 4; return { p: [(rr() - 0.5) * S, y0, (rr() - 0.5) * S], v: [0.2, -sp, 0.05], life: y0 / sp, size: 0.05 + rr() * 0.04, spin: (rr() - 0.5) * 3 }; },
    }));
  }
  const waterMat = makeWaterMaterial({ waves: [[1, 0.2, 0.03, 4]], opacity: 0.9, foam: C.foam, streakAlong: 0.3, streakAcross: 0.6, roughness: 0.06, ripples: p.fishingHole ? [[hole[0], hole[1], -0.4, 0.008]] : [] });
  return finalize(g, P, p, C, { waterMat, emitters, glowMat, ground: { h, col: terrainCol, w: S, d: S } });
}
export default createAsset;
