/*
 * FISH SCHOOL (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A school of fish as one instanced draw call — sardines, tuna, clownfish, koi, trout or neon
 * tetras, each with its own body proportions and markings — swimming in formation on a loop, a
 * figure-eight, or milling in a tight bait ball, every fish wagging as it turns. Shown inside a
 * cut-away aquarium of sand, rocks and swaying weed with caustics rippling over the floor and a
 * bubbler; switch the tank off to drop the school into any lake, reef or ocean.
 *
 * QUICK START
 *   import { createAsset } from './fish-school.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // tank: false → only the school; its centre sits `depth` below the asset origin
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | tuna | clownfish | koi | trout | neon — Theme
 *   species             sardine | tuna | clownfish | koi | trout | neon — Species
 *   count               1–400 (default 90) — Fish
 *   size                0.3–3 (default 1) — Size
 *   behaviour           loop | eight | ball — Behaviour
 *   radius              0.3–30 m (default 5) — Radius
 *   depth               0.3–20 m (default 3) — Depth
 *   speed               0.1–4 m/s (default 1.2) — Speed
 *   spread              0–4 m (default 1) — Spread
 *   tank                on/off (default on) — Aquarium
 *   seed                1–999 (default 3) — Seed
 *   body                colour (default #9ab8c8) — Body Colour
 *   belly               colour (default #eef2f4) — Belly Colour
 *   fin                 colour (default #5a7a8a) — Fin Colour
 *   stripe              colour (default #f4f4f0) — Stripe Colour
 *   sand                colour (default #d8c8a0) — Sand Colour
 *   sandDark            colour (default #c4b48c) — Sand Dark Colour
 *   rock                colour (default #7a7468) — Rock Colour
 *   weed                colour (default #4f8a4a) — Weed Colour
 *   weedDark            colour (default #3a6a3a) — Weed Dark Colour
 *   water               colour (default #3f9fbf) — Water Colour
 *   deep                colour (default #145a7a) — Deep Colour
 *   foam                colour (default #f6fcff) — Foam Colour
 *
 * SPECS  8,848 triangles at defaults, 5 materials, 6 draw calls when merged,
 *        14.0 x 6.3 x 11.0 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: school, tank
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  rng, noise2, fbm2, smooth, mixC, addRock, heightField, dioramaSkirt, makeWaterMaterial, waterify, waterGrid,
  waterColumnSides, makeSwayMaterial, swayify, partsBag, makeEmitter, makeFishSchool, bindModule
} from './kit.mjs';

const BASE = { body: '#9ab8c8', belly: '#eef2f4', fin: '#5a7a8a', stripe: '#f4f4f0', sand: '#d8c8a0', sandDark: '#c4b48c', rock: '#7a7468', weed: '#4f8a4a', weedDark: '#3a6a3a', water: '#3f9fbf', deep: '#145a7a', foam: '#f6fcff' };
export const COLORWAYS = {
  'default': { ...BASE },
  tuna: { ...BASE, body: '#2a3a5a', belly: '#d8dce0', fin: '#f2c81e' },
  clownfish: { ...BASE, body: '#ff7a1a', belly: '#ff9a3a', fin: '#1e1e22', stripe: '#fafaf6' },
  koi: { ...BASE, body: '#ff8a3a', belly: '#f8f0e0', fin: '#f4f4ee', stripe: '#f8f4ec', water: '#4a8a7a', deep: '#1f4a40' },
  trout: { ...BASE, body: '#8a9a6a', belly: '#e8d8b8', fin: '#7a6a4a', water: '#5a9a8a', deep: '#2a5a4a', sand: '#9a8a6a', sandDark: '#8a7a5a' },
  neon: { ...BASE, body: '#2a6aff', belly: '#ff3a3a', fin: '#d8e8ff', stripe: '#3affff' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  species: { type: 'choice', default: 'sardine', options: ['sardine', 'tuna', 'clownfish', 'koi', 'trout', 'neon'], label: 'Species', affects: 'geometry', describe: 'Body shape, size and markings (with the Default theme, also its natural colours).' },
  count: { type: 'range', default: 90, min: 1, max: 400, step: 1, label: 'Fish', affects: 'geometry', describe: 'Number of fish (one draw call).' },
  size: { type: 'range', default: 1, min: 0.3, max: 3, step: 0.05, label: 'Size', affects: 'geometry', describe: 'Scale on the species’ typical length.' },
  behaviour: { type: 'choice', default: 'loop', options: ['loop', 'eight', 'ball'], label: 'Behaviour', affects: 'geometry', describe: 'Formation loop, figure-eight, or a milling bait ball.' },
  radius: { type: 'range', default: 5, min: 0.3, max: 30, step: 0.1, unit: 'm', label: 'Radius', affects: 'geometry', describe: 'Size of the swimming path.' },
  depth: { type: 'range', default: 3, min: 0.3, max: 20, step: 0.1, unit: 'm', label: 'Depth', affects: 'geometry', describe: 'Depth of the school below the surface.' },
  speed: { type: 'range', default: 1.2, min: 0.1, max: 4, step: 0.05, unit: 'm/s', label: 'Speed', affects: 'geometry', describe: 'Swimming speed.' },
  spread: { type: 'range', default: 1, min: 0, max: 4, step: 0.05, unit: 'm', label: 'Spread', affects: 'geometry', describe: 'How loose the formation is.' },
  tank: { type: 'toggle', default: true, label: 'Aquarium', affects: 'geometry', describe: 'Cut-away water tank with sand, rocks, weed, caustics and bubbles.' },
  seed: { type: 'range', default: 3, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['school', 'tank'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const cw = p.colorway === 'default' && COLORWAYS[p.species] ? p.species : p.colorway;
  const C = zonesFor(cw, colorOverrides(userParams, cw));
  const g = new THREE.Group();
  g.name = 'fish-school';
  const P = partsBag();
  const SP = {
    sardine: { len: 0.2, shape: { width: 0.13, height: 0.17, tail: 0.9 } },
    tuna: { len: 1.6, shape: { width: 0.2, height: 0.27, tail: 1.35 } },
    clownfish: { len: 0.1, shape: { width: 0.17, height: 0.3, tail: 0.8 }, stripes: { at: [0.45, -0.02, -0.6], width: 0.09 } },
    koi: { len: 0.55, shape: { width: 0.2, height: 0.24, tail: 1.15 }, stripes: { at: [0.32, -0.25], width: 0.16 } },
    trout: { len: 0.4, shape: { width: 0.14, height: 0.2, tail: 1 } },
    neon: { len: 0.035, shape: { width: 0.14, height: 0.2, tail: 0.9 }, stripes: { at: [0.1, 0.25, 0.4], width: 0.12 } },
  }[p.species];
  const Lf = SP.len * p.size, R = p.radius, Dp = p.depth, wan = Math.max(0.1, Math.min(R * 0.15, Dp * 0.4));
  const school = makeFishSchool('school', {
    count: p.count, center: [0, -Dp, 0], radius: [R, R * 0.7], wander: wan, speed: p.speed, size: Lf, colors: [C.body, C.belly, C.fin], spread: p.spread, seed: p.seed,
    path: p.behaviour, shape: SP.shape, stripes: SP.stripes ? { ...SP.stripes, color: C.stripe } : null,
  });
  let waterMat = null, swayMat = null;
  const emitters = [];
  if (p.tank) {
    const tk = P.sub('tank', [0, 0, 0]), r = rng(p.seed + 3), m = Math.max(2, Lf * 6) + p.spread * 2;
    const W = 2 * R + m, Dd = 1.4 * R + m, yF = -(Dp + wan + Math.max(1, p.spread) + 0.6);
    const n = Math.max(16, Math.min(60, Math.round(W / 0.5))), nz = Math.max(12, Math.round((n * Dd) / W));
    const h = (x, z) => yF + 0.35 * fbm2(x * 0.25, z * 0.25, p.seed) + 0.6 * Math.max(0, (Math.abs(x) / W) * 2 - 0.6);
    tk.solid.push({ g: heightField(W, Dd, n, nz, h, (x, y, z) => (noise2(x * 0.8, z * 0.8, p.seed) > 0.55 ? C.sandDark : C.sand)), c: null, n: 'floor' });
    dioramaSkirt(tk.solid, null, W, Dd, n, nz, h, yF - 1, [C.sand, C.sandDark, C.rock]);
    for (let i = 0; i < 6; i++) { const x = (r() - 0.5) * W * 0.8, z = (r() - 0.5) * Dd * 0.8, s = Math.min(0.3 + r() * 0.8, Dp * 0.3); addRock(tk.solid, s, x, h(x, z) + s * 0.2, z, C.rock, p.seed + i, 0.7); }
    for (let i = 0; i < 26; i++) {
      const x = (r() - 0.5) * W * 0.9, z = (r() - 0.5) * Dd * 0.9, y = h(x, z), ht = Math.min(-y - 0.3, 0.6 + r() * 1.6), ph = r() * 6.28;
      if (ht < 0.3) continue;
      for (let k = 0; k < 3; k++) { const blade = new THREE.ConeGeometry(0.05, ht, 3).scale(1, 1, 0.3).translate(0, ht / 2, 0).rotateZ((k - 1) * 0.15).rotateY(r() * 3).translate(x + (r() - 0.5) * 0.15, y, z + (r() - 0.5) * 0.15); tk.sway.push({ g: swayify(blade, ph + k * 0.4, y, y + ht), c: k % 2 ? C.weed : C.weedDark, n: 'weed' }); }
    }
    const nx = Math.max(10, Math.round(W / 1.0)), nz2 = Math.max(8, Math.round(Dd / 0.9));
    tk.water.push({ g: waterify(waterGrid(W, Dd, nx, nz2, 0), (x, y, z) => ({ s: x, u: z, speed: 0.25, foam: 0.03, ocean: 1, color: mixC(C.water, C.deep, 0.2 + noise2(x * 0.1, z * 0.1, p.seed) * 0.2) })), c: null, n: 'surface' });
    waterColumnSides(tk.water, W, Dd, nx, nz2, 0, (x, z) => h(x, z), (x, y) => mixC(C.water, C.deep, smooth(0, yF, y) * 0.8), () => 1, 4);
    tk.water.push({ g: waterify(heightField(W * 0.98, Dd * 0.98, Math.round(n * 0.6), Math.round(nz * 0.6), (x, z) => h(x, z) + 0.04, () => 0xffffff), (x, y, z) => ({ s: x * 1.4, u: z * 0.5, speed: 0.35, mode: 4, color: 0xffffff })), c: null, n: 'caustics' });
    waterMat = makeWaterMaterial({ waves: [[1, 0.3, 0.05, 6], [-0.4, 1, 0.03, 3.5]], opacity: 0.55, foam: C.foam, streakAlong: 0.6, streakAcross: 0.6, roughness: 0.08 });
    swayMat = makeSwayMaterial({ amp: 0.1, freq: 0.8, dir: [1, 0.3] });
    const bx = -W * 0.3, bz = Dd * 0.2, by = h(bx, bz) + 0.3;
    emitters.push(makeEmitter('bubbles', {
      count: 40, shape: 'bubble', color: C.foam, opacity: 0.6, gravity: [0, 0.25, 0], sway: [0.05, 3], parent: 'tank', seed: p.seed + 9,
      spawn: (i, rr) => { const sp = 0.3 + rr() * 0.2; return { p: [bx + (rr() - 0.5) * 0.15, by, bz + (rr() - 0.5) * 0.15], v: [0, sp, 0], life: -by / (sp + 0.45), size: 0.02 + rr() * 0.03 }; },
    }));
  }
  g.userData.view = { target: [0, -Dp * 0.75, 0], radius: Math.max(6, R * 3) };
  return finalize(g, P, p, C, { waterMat, swayMat, emitters, objects: [school], tick: (t) => school.userData.swim(t) });
}
export default createAsset;
