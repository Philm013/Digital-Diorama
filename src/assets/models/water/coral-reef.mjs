/*
 * CORAL REEF (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * Sunlit reef patch: rippled sand, reef rock, brain, staghorn, table and lettuce corals, sea fans
 * and tube sponges, a giant clam and an anemone with its clownfish. Schools of fish circle the
 * reef, bubbles rise to a translucent swell, and caustic light nets dance over everything. A
 * bleaching slider drains the colour from the corals.
 *
 * QUICK START
 *   import { createAsset } from './coral-reef.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // looks best from just above the surface or through the cut-away sides; in a sea, set seaWater: false and sink it by `depth`
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | pastel | deep | sunset | caribbean — Theme
 *   size                16–60 m (default 30) — Patch Size
 *   depth               3–25 m (default 8) — Water Depth
 *   coral               0–1 (default 0.8) — Coral Cover
 *   fish                0–200 (default 60) — Fish
 *   bleaching           0–1 (default 0) — Bleaching
 *   seagrassCover       0–1 (default 0.4) — Seagrass
 *   clarity             0.15–0.9 (default 0.3) — Surface Opacity
 *   caustics            on/off (default on) — Caustics
 *   bubbles             on/off (default on) — Bubbles
 *   seaWater            on/off (default on) — Own Sea
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 13) — Seed
 *   sand                colour (default #e8dbb4) — Sand Colour
 *   sandDark            colour (default #cbb98d) — Sand Dark Colour
 *   reefRock            colour (default #9c8c78) — Reef Rock Colour
 *   brain               colour (default #d8a04a) — Brain Colour
 *   brainGroove         colour (default #9c6a2a) — Brain Groove Colour
 *   staghorn            colour (default #c9806b) — Staghorn Colour
 *   tip                 colour (default #f2c3a8) — Tip Colour
 *   table               colour (default #6fa8a0) — Table Colour
 *   lettuce             colour (default #a3b55a) — Lettuce Colour
 *   fan                 colour (default #a8326e) — Fan Colour
 *   sponge              colour (default #7a3fa0) — Sponge Colour
 *   clam                colour (default #5c6e7a) — Clam Colour
 *   mantle              colour (default #2d7fd0) — Mantle Colour
 *   anemone             colour (default #e9a6c2) — Anemone Colour
 *   seagrass            colour (default #4f8f45) — Seagrass Colour
 *   fishA               colour (default #2f6fe0) — Fish A Colour
 *   fishB               colour (default #f2c12e) — Fish B Colour
 *   fin                 colour (default #1d2a4a) — Fin Colour
 *   clown               colour (default #f26b1d) — Clown Colour
 *   water               colour (default #2bb0c4) — Water Colour
 *   deep                colour (default #0f6f8f) — Deep Colour
 *   foam                colour (default #f2ffff) — Foam Colour
 *   bleach              colour (default #f4f1ea) — Bleach Colour
 *   soil                colour (default #b39d74) — Soil Colour
 *
 * SPECS  26,151 triangles at defaults, 5 materials, 10 draw calls when merged,
 *        30.0 x 11.0 x 30.0 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: corals, fish-a, fish-b, clownfish, bubbles, surface, caustics
 *        night: plankton
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  addCylinder, addWire, sweep, rng, noise2, fbm2, mixC, faceTint, heightField, makeWaterMaterial, waterify,
  waterGrid, makeSwayMaterial, swayify, tileEdge, partsBag, makeEmitter, addLathe, makeFishSchool, bindModule
} from './kit.mjs';

const BASE = {
  sand: '#e8dbb4', sandDark: '#cbb98d', reefRock: '#9c8c78', brain: '#d8a04a', brainGroove: '#9c6a2a',
  staghorn: '#c9806b', tip: '#f2c3a8', table: '#6fa8a0', lettuce: '#a3b55a', fan: '#a8326e', sponge: '#7a3fa0',
  clam: '#5c6e7a', mantle: '#2d7fd0', anemone: '#e9a6c2', seagrass: '#4f8f45', fishA: '#2f6fe0', fishB: '#f2c12e',
  fin: '#1d2a4a', clown: '#f26b1d', water: '#2bb0c4', deep: '#0f6f8f', foam: '#f2ffff', bleach: '#f4f1ea', soil: '#b39d74',
};
export const COLORWAYS = {
  'default': { ...BASE },
  pastel: { ...BASE, brain: '#f0c08a', staghorn: '#f0a8b0', table: '#9ccfc8', lettuce: '#c8d890', fan: '#d888b8', sponge: '#b89ad8' },
  deep: { ...BASE, water: '#1b6f9a', deep: '#0a3f66', sand: '#c9c4ad', brain: '#b07a3a', staghorn: '#a85a4a', fan: '#7a2050' },
  sunset: { ...BASE, water: '#3b8fb0', brain: '#e08a3a', staghorn: '#e0604a', fan: '#c23a5a', sponge: '#d0603a', fishA: '#e05a8a' },
  caribbean: { ...BASE, water: '#38d0d0', deep: '#0f9ab0', sand: '#f7f0d8', fishB: '#ffe04a' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  size: { type: 'range', default: 30, min: 16, max: 60, step: 2, unit: 'm', label: 'Patch Size', affects: 'geometry', describe: 'Square reef patch edge length.' },
  depth: { type: 'range', default: 8, min: 3, max: 25, step: 0.5, unit: 'm', label: 'Water Depth', affects: 'geometry', describe: 'Sand floor to surface.' },
  coral: { type: 'range', default: 0.8, min: 0, max: 1, step: 0.05, label: 'Coral Cover', affects: 'geometry', describe: 'How densely the reef is colonised.' },
  fish: { type: 'range', default: 60, min: 0, max: 200, step: 5, label: 'Fish', affects: 'geometry', describe: 'Fish across the two schools.' },
  bleaching: { type: 'range', default: 0, min: 0, max: 1, step: 0.05, label: 'Bleaching', affects: 'colors', describe: 'Heat-stressed corals lose their algae and turn white.' },
  seagrassCover: { type: 'range', default: 0.4, min: 0, max: 1, step: 0.05, label: 'Seagrass', affects: 'geometry', describe: 'Seagrass meadow on the sand.' },
  clarity: { type: 'range', default: 0.3, min: 0.15, max: 0.9, step: 0.05, label: 'Surface Opacity', affects: 'colors', describe: 'Opacity of the water surface and cut-away (lower = clearer).' },
  caustics: { type: 'toggle', default: true, label: 'Caustics', affects: 'geometry', describe: 'Dancing light nets on the reef.' },
  bubbles: { type: 'toggle', default: true, label: 'Bubbles', affects: 'geometry', describe: 'Bubble streams rising to the surface.' },
  seaWater: { type: 'toggle', default: true, label: 'Own Sea', affects: 'geometry', describe: 'The asset’s own patch of sea. Turn it off when the asset sits in an ocean tile, which then supplies (and shoals) the water.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Water-column and sediment cut-away.' },
  seed: { type: 'range', default: 13, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['corals', 'fish-a', 'fish-b', 'clownfish', 'bubbles', 'surface', 'caustics'];
export const night = {
  plankton: { color: '#7af2ff', intensity: 0.3, describe: 'Faint glow of plankton in the swell at night.' },
};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'coral-reef';
  const P = partsBag();
  const S = p.size, hs = S / 2, Dp = p.depth, r = rng(p.seed);
  const mounds = [];
  for (let i = 0; i < 5; i++) mounds.push({ x: (r() - 0.5) * S * 0.6, z: (r() - 0.5) * S * 0.6, rad: S * (0.1 + r() * 0.1), ht: Dp * (0.18 + r() * 0.22) });
  const mound = (x, z) => mounds.reduce((m, q) => Math.max(m, q.ht * Math.exp(-((Math.hypot(x - q.x, z - q.z) / q.rad) ** 2) * 1.6)), 0);
  const h = (x, z) => mound(x, z) + Math.sin(x * 1.3 + z * 0.4) * 0.05 + (fbm2(x * 0.15, z * 0.15, p.seed, 3) - 0.5) * 0.6;
  const n = Math.max(30, Math.round(S / 0.6));
  const floorCol = (x, y, z, sl) => (mound(x, z) > 0.6 ? (sl > 0.3 ? C.reefRock : mixC(C.reefRock, C.sandDark, 0.4).getHex()) : noise2(x * 0.3, z * 0.3, p.seed) > 0.6 ? C.sandDark : C.sand);
  P.solid.push({ g: heightField(S, S, n, n, h, floorCol), c: null, n: 'floor' });
  tileEdge(p, P.solid, p.seaWater ? P.water : null, S, S, n, n, h, -3, [C.sand, C.soil, C.reefRock], () => Dp, C.deep);

  const bl = (hex) => mixC(hex, C.bleach, p.bleaching * 0.92).getHex();
  const corals = P.sub('corals', [0, 0, 0]);
  const site = () => { for (let k = 0; k < 8; k++) { const x = (r() - 0.5) * S * 0.9, z = (r() - 0.5) * S * 0.9; if (mound(x, z) > 0.4 || r() < 0.15) return [x, h(x, z), z]; } const x = (r() - 0.5) * S * 0.8, z = (r() - 0.5) * S * 0.8; return [x, h(x, z), z]; };
  const branch = (list, p0, dir, len, rad, depth, hexA, hexB) => {
    const end = p0.clone().addScaledVector(dir, len), mid = p0.clone().lerp(end, 0.5).add(new THREE.Vector3((r() - 0.5) * len * 0.15, 0, (r() - 0.5) * len * 0.15));
    list.push({ g: sweep([p0, mid, end], (t) => rad * (1 - t * 0.35), 4, 3, depth === 0), c: depth === 0 ? hexB : hexA, n: 'branch' });
    if (depth > 0) for (let k = 0; k < 2 + (r() > 0.6 ? 1 : 0); k++) {
      const nd = dir.clone().add(new THREE.Vector3((r() - 0.5) * 1.3, r() * 0.5, (r() - 0.5) * 1.3)).normalize();
      branch(list, end, nd, len * 0.72, rad * 0.7, depth - 1, hexA, hexB);
    }
  };
  const nCoral = Math.round(p.coral * S * S * 0.045);
  for (let i = 0; i < nCoral; i++) {
    const [x, y, z] = site(), kind = r(), s = 1 + r() * 1.3;
    if (kind < 0.24) {
      const geo = new THREE.IcosahedronGeometry(0.55 * s, 2).scale(1, 0.62, 1).translate(x, y + 0.12 * s, z);
      corals.solid.push({ g: faceTint(geo, (cx, cy, cz) => (Math.sin(Math.atan2(cz - z, cx - x) * 7 + cy * 22 + noise2(cx * 4, cz * 4, i) * 4) > 0.1 ? bl(C.brain) : bl(C.brainGroove))), c: null, n: 'brain-coral' });
    } else if (kind < 0.46) {
      for (let k = 0; k < 3; k++) branch(corals.solid, new THREE.Vector3(x, y, z), new THREE.Vector3((r() - 0.5) * 0.8, 1, (r() - 0.5) * 0.8).normalize(), 0.45 * s, 0.05 * s, 2, bl(C.staghorn), bl(C.tip));
    } else if (kind < 0.62) {
      addCylinder(corals.solid, 0.07 * s, 0.12 * s, 0.35 * s, 6, x, y + 0.17 * s, z, 0, 0, 0, bl(C.table));
      const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([t * 1.1 * s, 0.35 * s + Math.sin(t * 3) * 0.06 * s + t * t * 0.08 * s]); }
      pts.push([1.1 * s, 0.32 * s + 0.08 * s], [0, 0.3 * s]);
      corals.solid.push({ g: faceTint(new THREE.LatheGeometry(pts.map((q) => new THREE.Vector2(q[0], q[1])), 14).translate(x, y, z), (cx, cy, cz) => (Math.hypot(cx - x, cz - z) > 0.9 * s ? bl(C.tip) : bl(C.table))), c: null, n: 'table-coral' });
    } else if (kind < 0.72) {
      for (let k = 0; k < 4; k++) {
        const a = r() * 6.28, pts = [];
        for (let j = 0; j <= 5; j++) { const t = j / 5; pts.push([0.04 + t * 0.45 * s, t * 0.4 * s + Math.sin(t * 9 + k) * 0.05]); }
        const geo = new THREE.LatheGeometry(pts.map((q) => new THREE.Vector2(q[0], q[1])), 8, a, 1.6).translate(x, y, z);
        corals.solid.push({ g: geo, c: bl(C.lettuce), n: 'lettuce-coral' });
      }
    } else if (kind < 0.84) {
      const a = r() * Math.PI, ph = r() * 6.28, ca = Math.cos(a), sa = Math.sin(a), hgt = 1.1 * s, tmp = [];
      addWire(tmp, [x, y, z], [x, y + hgt * 0.35, z], C.fan, 0.03, 4);
      for (let k = 0; k < 9; k++) {
        const t = (k / 8 - 0.5) * 1.6, tip = [x + Math.sin(t) * hgt * 0.75 * ca, y + hgt * (0.35 + 0.65 * Math.cos(t * 0.6)), z + Math.sin(t) * hgt * 0.75 * sa];
        addWire(tmp, [x, y + hgt * 0.3, z], tip, C.fan, 0.012, 3);
        if (k) { const t0 = ((k - 1) / 8 - 0.5) * 1.6; addWire(tmp, [x + Math.sin(t0) * hgt * 0.5 * ca, y + hgt * (0.35 + 0.45 * Math.cos(t0 * 0.6)), z + Math.sin(t0) * hgt * 0.5 * sa], [x + Math.sin(t) * hgt * 0.5 * ca, y + hgt * (0.35 + 0.45 * Math.cos(t * 0.6)), z + Math.sin(t) * hgt * 0.5 * sa], C.fan, 0.008, 3); }
      }
      for (const it of tmp) corals.sway.push({ g: swayify(it.g, ph, y, y + hgt * 1.4), c: bl(C.fan), n: 'sea-fan' });
    } else {
      for (let k = 0; k < 3 + Math.floor(r() * 3); k++) {
        const rr = (0.07 + r() * 0.07) * s, ht = (0.35 + r() * 0.6) * s, ox = (r() - 0.5) * 0.4, oz = (r() - 0.5) * 0.4;
        addLathe(corals.solid, [[rr * 0.9, 0], [rr, ht * 0.5], [rr * 1.15, ht], [rr * 0.8, ht], [rr * 0.7, 0.05]], 7, bl(C.sponge), x + ox, y - 0.02, z + oz);
      }
    }
  }
  // Giant clam + anemone with clownfish
  const cl = site(), an = site();
  for (const sgn of [-1, 1]) {
    const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(new THREE.Vector2(0.5 * Math.sin(t * Math.PI / 2) * (1 + 0.06 * Math.sin(t * 30)), 0.35 * t)); }
    const half = new THREE.LatheGeometry(pts, 10, 0, Math.PI).rotateX(sgn * 0.35).translate(cl[0], cl[1] + 0.05, cl[2]);
    corals.solid.push({ g: half.scale(1, 1, 1), c: C.clam, n: 'clam' });
  }
  corals.solid.push({ g: new THREE.IcosahedronGeometry(0.32, 1).scale(1.3, 0.35, 0.5).translate(cl[0], cl[1] + 0.32, cl[2]), c: C.mantle, n: 'mantle' });
  addLathe(corals.solid, [[0, 0], [0.22, 0], [0.18, 0.15], [0.26, 0.2], [0, 0.2]], 9, C.anemone, an[0], an[1], an[2]);
  const ph0 = r() * 6.28;
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2, d = 0.08 + (k % 3) * 0.05;
    const t = new THREE.ConeGeometry(0.022, 0.28, 3).translate(0, 0.14, 0).rotateZ(0.35 + (k % 3) * 0.2).rotateY(-a).translate(an[0] + Math.cos(a) * d, an[1] + 0.2, an[2] + Math.sin(a) * d);
    corals.sway.push({ g: swayify(t, ph0 + k * 0.1, an[1] + 0.2, an[1] + 0.55), c: C.anemone, n: 'tentacle' });
  }
  // Seagrass meadow
  for (let i = 0; i < Math.round(p.seagrassCover * S * S * 0.12); i++) {
    const x = (r() - 0.5) * S * 0.95, z = (r() - 0.5) * S * 0.95;
    if (mound(x, z) > 0.3) continue;
    const y = h(x, z), ht = 0.3 + r() * 0.4, ph = (x + z) * 0.4;
    const blade = new THREE.ConeGeometry(0.03, ht, 3).scale(1, 1, 0.25).translate(0, ht / 2, 0).rotateY(r() * 3).translate(x, y, z);
    corals.sway.push({ g: swayify(blade, ph, y, y + ht * 1.2), c: C.seagrass, n: 'seagrass' });
  }

  // Surface, caustics
  const sea = P.sub('surface', [0, Dp, 0]);
  const nW = Math.max(16, Math.round(S / 1.2));
  if (p.seaWater) sea.water.push({ g: waterify(waterGrid(S, S, nW, Math.round(nW / 0.866), Dp), (x, y, z) => ({ s: x, u: z, speed: 0.3, foam: 0.05, ocean: 1, color: mixC(C.water, C.deep, 0.25 + 0.3 * noise2(x * 0.1, z * 0.1, p.seed)) })), c: null, n: 'surface' });
  if (p.caustics) {
    const cau = P.sub('caustics', [0, 0, 0]);
    const geo = heightField(S, S, Math.round(n * 0.7), Math.round(n * 0.7), (x, z) => h(x, z) + 0.06, () => 0xffffff);
    cau.water.push({ g: waterify(geo, (x, y, z) => ({ s: x * 1.5, u: z * 0.5, speed: 0.4, mode: 4, color: 0xffffff })), c: null, n: 'caustics' });
  }

  const emitters = [], fish = [];
  if (p.fish > 0) {
    const a = makeFishSchool('fish-a', { count: Math.round(p.fish * 0.65), center: [0, Dp * 0.45, 0], radius: [S * 0.3, S * 0.22], wander: Dp * 0.12, speed: 1.6, size: 0.26, colors: [C.fishA, C.fishB, C.fin], spread: 1.4, seed: p.seed });
    const b = makeFishSchool('fish-b', { count: Math.max(1, Math.round(p.fish * 0.35)), center: [S * 0.1, Dp * 0.3, -S * 0.08], radius: [S * 0.16, S * 0.2], wander: Dp * 0.08, speed: 1.1, size: 0.2, colors: [C.fishB, C.bleach, C.fin], spread: 0.9, seed: p.seed + 4 });
    fish.push(a, b);
  }
  const clown = makeFishSchool('clownfish', { count: 2, center: [an[0], an[1] + 0.45, an[2]], radius: [0.35, 0.3], wander: 0.08, speed: 0.5, size: 0.12, colors: [C.clown, C.bleach, C.fin], spread: 0.1, seed: p.seed + 8 });
  fish.push(clown);
  if (p.bubbles) {
    const vents = [site(), site(), site()];
    emitters.push(makeEmitter('bubbles', {
      count: 70, shape: 'bubble', color: C.foam, opacity: 0.55, gravity: [0, 0.25, 0], sway: [0.06, 3], seed: p.seed + 5,
      spawn: (i, rr) => { const v = vents[i % 3], sp = 0.35 + rr() * 0.25; return { p: [v[0] + (rr() - 0.5) * 0.2, v[1] + 0.2, v[2] + (rr() - 0.5) * 0.2], v: [0, sp, 0], life: (Dp - v[1]) / (sp + 0.6), size: 0.03 + rr() * 0.05 }; },
    }));
  }

  const waterMat = makeWaterMaterial({ waves: [[1, 0.3, 0.08, 9], [-0.4, 1, 0.05, 5]], opacity: p.clarity, foam: C.foam, streakAlong: 0.6, streakAcross: 0.6, roughness: 0.1 });
  g.userData.view = { target: [0, Dp * 0.25, 0], radius: S * 0.9 };
  const swayMat = makeSwayMaterial({ amp: 0.12, freq: 0.9, dir: [1, 0.4] });
  return finalize(g, P, p, C, {
    waterMat, swayMat, emitters, objects: fish, ground: { h, col: floorCol, w: S, d: S },
    tick: (t) => { for (const f of fish) f.userData.swim(t); },
    onNight: (k) => waterMat.userData.uniforms.uGlow.value.set(0x7af2ff).multiplyScalar(k * 0.25),
  });
}
export default createAsset;
