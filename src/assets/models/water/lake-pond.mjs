/*
 * LAKE & POND (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A still lake in a meadow basin: wind riffles scud across the surface, a shallow littoral shelf
 * glows lighter than the deep middle, lily pads bob with their flowers, reeds and cattails lean in
 * the breeze, a jetty stands on posts that ring the water, and now and then a fish leaps out and
 * splashes back, printing ripple rings.
 *
 * QUICK START
 *   import { createAsset } from './lake-pond.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   rowboat.userData.waterSurface = asset.userData.surface;   // anything floating can ride it
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | alpine | murky | autumn | sunset — Theme
 *   size                20–120 m (default 50) — Lake Diameter
 *   irregularity        0–1 (default 0.5) — Shoreline Irregularity
 *   depth               1–15 m (default 4) — Max Depth
 *   wind                0–1 (default 0.3) — Wind
 *   rain                0–1 (default 0) — Rain on Surface
 *   lilies              0–80 (default 24) — Lily Pads
 *   reeds               0–1 (default 0.6) — Reeds & Cattails
 *   jetty               on/off (default on) — Jetty
 *   leapingFish         on/off (default on) — Leaping Fish
 *   trees               0–1 (default 0.5) — Trees
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 10) — Seed
 *   grass               colour (default #7fae55) — Grass Colour
 *   grassDark           colour (default #5f8f40) — Grass Dark Colour
 *   sand                colour (default #cdb88a) — Sand Colour
 *   mud                 colour (default #6f5a40) — Mud Colour
 *   water               colour (default #3f8f8a) — Water Colour
 *   deep                colour (default #1f5560) — Deep Colour
 *   shallow             colour (default #6fb3a0) — Shallow Colour
 *   foam                colour (default #f2faf8) — Foam Colour
 *   lily                colour (default #4f9a3a) — Lily Colour
 *   flower              colour (default #f6c6d8) — Flower Colour
 *   reed                colour (default #9aa857) — Reed Colour
 *   reedHead            colour (default #6a4a2a) — Reed Head Colour
 *   wood                colour (default #8a6a48) — Wood Colour
 *   post                colour (default #5a4433) — Post Colour
 *   fish                colour (default #c0c8b0) — Fish Colour
 *   bark                colour (default #5f4632) — Bark Colour
 *   leaf                colour (default #5f9f45) — Leaf Colour
 *   leafDark            colour (default #3f7f38) — Leaf Dark Colour
 *   soil                colour (default #5a4634) — Soil Colour
 *
 * SPECS  33,381 triangles at defaults, 3 materials, 6 draw calls when merged,
 *        80.0 x 18.6 x 80.0 m (W x H x D, real-world scale).
 * PARTS animate: jumper (translate y -1…1.5 m)
 *        detach: jetty, lilies, vegetation, jumper
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.surface.heightAt(x, z, t) · userData.ground
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  rng, noise2, fbm2, smooth, mixC, heightField, makeWaterMaterial, waterify, waterDisc, makeSwayMaterial,
  swayify, addPine, addBroadleaf, addReeds, tileEdge, partsBag, makeSurface, bindModule
} from './kit.mjs';

const BASE = {
  grass: '#7fae55', grassDark: '#5f8f40', sand: '#cdb88a', mud: '#6f5a40', water: '#3f8f8a', deep: '#1f5560', shallow: '#6fb3a0', foam: '#f2faf8',
  lily: '#4f9a3a', flower: '#f6c6d8', reed: '#9aa857', reedHead: '#6a4a2a', wood: '#8a6a48', post: '#5a4433', fish: '#c0c8b0', bark: '#5f4632', leaf: '#5f9f45', leafDark: '#3f7f38', soil: '#5a4634',
};
export const COLORWAYS = {
  'default': { ...BASE },
  alpine: { ...BASE, water: '#3fa8b8', deep: '#1a6f88', shallow: '#7fd0d0', grass: '#7f9f5f', sand: '#a9a8a0', leaf: '#2f6a45', leafDark: '#24553a' },
  murky: { ...BASE, water: '#5f7f4a', deep: '#3a5232', shallow: '#7f9a5a', lily: '#5f8a2a' },
  autumn: { ...BASE, grass: '#b0a058', grassDark: '#98884a', leaf: '#d8822a', leafDark: '#b04a1f', reed: '#c0a060' },
  sunset: { ...BASE, water: '#5a6f9a', deep: '#2a3a66', shallow: '#d09a7a', foam: '#ffe8d8' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  size: { type: 'range', default: 50, min: 20, max: 120, step: 2, unit: 'm', label: 'Lake Diameter', affects: 'geometry', describe: 'Approximate shoreline diameter.' },
  irregularity: { type: 'range', default: 0.5, min: 0, max: 1, step: 0.05, label: 'Shoreline Irregularity', affects: 'geometry', describe: 'Round pond → lobed, bay-cut lake.' },
  depth: { type: 'range', default: 4, min: 1, max: 15, step: 0.5, unit: 'm', label: 'Max Depth', affects: 'geometry', describe: 'Depth at the centre of the basin.' },
  wind: { type: 'range', default: 0.3, min: 0, max: 1, step: 0.05, label: 'Wind', affects: 'geometry', describe: 'Wind chop and riffles.' },
  rain: { type: 'range', default: 0, min: 0, max: 1, step: 0.05, label: 'Rain on Surface', affects: 'geometry', describe: 'Raindrop rings.' },
  lilies: { type: 'range', default: 24, min: 0, max: 80, step: 1, label: 'Lily Pads', affects: 'geometry', describe: 'Floating lily pads (some flowering).' },
  reeds: { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Reeds & Cattails', affects: 'geometry', describe: 'Emergent vegetation around the margin.' },
  jetty: { type: 'toggle', default: true, label: 'Jetty', affects: 'geometry', describe: 'Wooden jetty on posts (posts ring the water).' },
  leapingFish: { type: 'toggle', default: true, label: 'Leaping Fish', affects: 'geometry', describe: 'A fish periodically jumps and splashes.' },
  trees: { type: 'range', default: 0.5, min: 0, max: 1, step: 0.05, label: 'Trees', affects: 'geometry', describe: 'Trees around the lake.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away sections.' },
  seed: { type: 'range', default: 10, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = { jumper: { type: 'translate', axis: 'y', range: [-1, 1.5], describe: 'Leaping fish height (auto-animated).' } };
export const detach = ['jetty', 'lilies', 'vegetation', 'jumper'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'lake-pond';
  const P = partsBag();
  const R0 = p.size / 2, S = p.size * 1.6, r = rng(p.seed);
  const Rth = (th) => R0 * (1 + p.irregularity * 0.35 * (noise2(Math.cos(th) * 1.6 + 5, Math.sin(th) * 1.6, p.seed) - 0.5) * 2 + p.irregularity * 0.12 * Math.sin(th * 3 + p.seed));
  const h = (x, z) => {
    const rr = Math.hypot(x, z), R = Rth(Math.atan2(z, x)), k = rr / R;
    if (k < 1) return -p.depth * Math.pow(1 - k * k, 0.8) + (noise2(x * 0.3, z * 0.3, p.seed) - 0.5) * 0.15 - 0.02;
    return 0.35 * smooth(1, 1.12, k) + smooth(1.15, 1.7, k) * (1.2 + 2.5 * fbm2(x * 0.05, z * 0.05, p.seed + 3, 3));
  };
  const n = Math.max(40, Math.round(S / 0.9));
  const terrainCol = (x, y, z, sl) => (y < -0.6 ? C.mud : y < 0.25 ? C.sand : noise2(x * 0.2, z * 0.2, p.seed) > 0.5 ? C.grass : C.grassDark);
  P.solid.push({ g: heightField(S, S, n, n, h, terrainCol), c: null, n: 'basin' });
  const wind = p.wind;
  const waves = [[1, 0.35, 0.08 * wind, 6], [0.6, -0.8, 0.05 * wind, 3.5], [-0.2, 1, 0.03 * wind, 2.2]];
  const disc = waterDisc(R0 * 1.5, 18, 0);
  P.water.push({
    g: waterify(disc, (x, y, z) => {
      const d = -h(x, z), k = Math.hypot(x, z) / Rth(Math.atan2(z, x));
      return { s: x, u: z, speed: 0.15 + wind * 0.8, foam: 0.02 + wind * 0.08 * fbm2(x * 0.1, z * 0.1, p.seed + 7, 2), ocean: smooth(0, 0.6, d), ripple: 1, color: mixC(mixC(C.shallow, C.water, smooth(0.2, 1.5, d)), C.deep, smooth(1.5, p.depth, d)) };
    }),
    c: null, n: 'lake',
  });
  tileEdge(p, P.solid, P.water, S, S, n, n, h, -p.depth - 2.5, [C.grassDark, C.soil, C.mud], () => 0, C.deep);
  // Lily pads (bob as one group) & margin reeds
  const lil = P.sub('lilies', [0, 0, 0]);
  for (let i = 0; i < p.lilies; i++) {
    const th = r() * 6.28, R = Rth(th), d = R * (0.55 + r() * 0.38), x = Math.cos(th) * d, z = Math.sin(th) * d, rr = 0.25 + r() * 0.3;
    lil.solid.push({ g: new THREE.CylinderGeometry(rr, rr, 0.02, 12, 1, false, r() * 6, Math.PI * 1.85).translate(x, 0.015, z), c: C.lily, n: 'pad' });
    if (r() < 0.3) {
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; lil.solid.push({ g: new THREE.ConeGeometry(0.035, 0.12, 4).rotateZ(0.9).rotateY(-a).translate(x + Math.cos(a) * 0.05, 0.08, z + Math.sin(a) * 0.05), c: C.flower, n: 'petal' }); }
    }
  }
  const veg = P.sub('vegetation', [0, 0, 0]);
  for (let i = 0; i < Math.round(p.reeds * p.size * 1.3); i++) {
    const th = r() * 6.28, R = Rth(th), d = R * (0.93 + r() * 0.12), x = Math.cos(th) * d, z = Math.sin(th) * d, y = h(x, z), tmp = [], ph = r() * 6.28;
    addReeds(tmp, x, Math.max(y, -0.4) - 0.05, z, 6, 1.6, [C.reed, C.grassDark, C.reedHead], p.seed + i, 0.5);
    for (const it of tmp) veg.sway.push({ g: swayify(it.g, ph, y, y + 3.2), c: it.c, n: it.n });
  }
  for (let i = 0; i < Math.round(p.trees * p.size * 0.5); i++) {
    const th = r() * 6.28, d = Rth(th) * (1.2 + r() * 0.6), x = Math.cos(th) * d, z = Math.sin(th) * d;
    if (Math.abs(x) > S / 2 - 1 || Math.abs(z) > S / 2 - 1) continue;
    const y = h(x, z), ht = 6 + r() * 6, tmp = [], ph = r() * 6.28;
    if (r() < 0.65) addBroadleaf(tmp, x, y, z, ht, [C.bark, C.leaf, C.leafDark], p.seed + i); else addPine(tmp, x, y, z, ht * 1.2, [C.bark, C.leafDark, C.leaf], p.seed + i);
    for (const it of tmp) veg.sway.push({ g: swayify(it.g, ph, y + ht * 0.3, y + ht * 4), c: it.c, n: it.n });
  }
  // Jetty
  const posts = [];
  if (p.jetty) {
    const th = Math.PI * 0.35, R = Rth(th), len = Math.min(R * 0.45, 12), dx = -Math.cos(th), dz = -Math.sin(th);
    const x0 = Math.cos(th) * (R + 1.5), z0 = Math.sin(th) * (R + 1.5), deckY = 0.6, jt = P.sub('jetty', [x0, 0, z0]);
    const m = new THREE.Matrix4().makeRotationY(Math.atan2(dx, dz)).setPosition(x0, 0, z0);
    const nP = Math.max(2, Math.round((len + 1.5) / 1.4));
    for (let i = 0; i <= nP; i++) {
      const t = (i / nP) * (len + 1.5);
      for (const sgn of [-1, 1]) {
        const g2 = new THREE.CylinderGeometry(0.09, 0.1, deckY + p.depth * 0.4 + 0.5, 6).translate(sgn * 0.8, (deckY - p.depth * 0.4 - 0.5) / 2 + 0.05, t).applyMatrix4(m);
        jt.solid.push({ g: g2, c: C.post, n: 'post' });
        const wpos = new THREE.Vector3(sgn * 0.8, 0, t).applyMatrix4(m);
        if (h(wpos.x, wpos.z) < -0.05 && posts.length < 6) posts.push([wpos.x, wpos.z]);
      }
    }
    for (let i = 0; i < Math.round((len + 1.5) / 0.32); i++) jt.solid.push({ g: new THREE.BoxGeometry(2.0, 0.06, 0.28).translate(0, deckY, 0.16 + i * 0.32).applyMatrix4(m), c: C.wood, n: 'plank' });
    for (const sgn of [-1, 1]) jt.solid.push({ g: new THREE.BoxGeometry(0.12, 0.14, len + 1.5).translate(sgn * 0.82, deckY - 0.1, (len + 1.5) / 2).applyMatrix4(m), c: C.post, n: 'stringer' });
  }
  // Leaping fish
  const jumpAt = { x: 0, z: 0, a: 0 };
  if (p.leapingFish) {
    const jp = P.sub('jumper', [0, 0, 0]);
    jp.solid.push({ g: new THREE.OctahedronGeometry(1, 1).scale(0.07, 0.09, 0.25), c: C.fish, n: 'fish' });
    jp.solid.push({ g: new THREE.ConeGeometry(0.08, 0.12, 3).rotateX(Math.PI / 2).translate(0, 0, -0.28), c: C.fish, n: 'tail' });
  }
  const waterMat = makeWaterMaterial({ waves, opacity: 0.82, foam: C.foam, rain: p.rain, streakAlong: 0.25, streakAcross: 0.25, roughness: 0.08, ripples: posts.slice(0, 4).map((q) => [q[0], q[1], -1.2, 0.012]) });
  const swayMat = makeSwayMaterial({ amp: 0.1 + wind * 0.25, freq: 1.2 + wind, dir: [1, 0.35] });
  const U = waterMat.userData.uniforms, base = U.uRipCount.value;
  if (p.leapingFish) U.uRipCount.value = Math.min(8, base + 2);   // reserve the leap / splash slots (addRipple uses the rest)
  let lastJump = -1;
  finalize(g, P, p, C, {
    waterMat, swayMat, ground: { h, col: terrainCol, w: S, d: S },
    tick: (t, dt, drive) => {
      const lp = g.getObjectByName('lilies');
      if (lp) lp.position.y = Math.sin(t * 1.3) * 0.015 * (1 + wind * 3);
      const jp = g.getObjectByName('jumper');
      if (jp) {
        const period = 7, k = Math.floor(t / period), ph = t / period - k;
        if (k !== lastJump) {
          lastJump = k; const rr = rng(k * 7 + p.seed), th = rr() * 6.28, d = Rth(th) * (0.2 + rr() * 0.45);
          jumpAt.x = Math.cos(th) * d; jumpAt.z = Math.sin(th) * d; jumpAt.a = rr() * 6.28;
        }
        const T = 0.75, tt = ph * period;
        jp.visible = tt < T;
        const f = Math.min(1, tt / T), ca = Math.cos(jumpAt.a), sa = Math.sin(jumpAt.a);
        jp.position.set(jumpAt.x + ca * (f - 0.5) * 1.3, 0, jumpAt.z + sa * (f - 0.5) * 1.3);
        drive('jumper', 4 * 0.75 * f * (1 - f) - 0.1);
        jp.rotation.set(-(1 - 2 * f) * 1.1 * 0, Math.atan2(ca, sa), 0);
        jp.rotation.x = -(1 - 2 * f) * 1.0;
        if (tt < 0.05) { U.uRip.value[base].set(jumpAt.x - ca * 0.6, jumpAt.z - sa * 0.6, t - tt, 0.06); }
        if (tt > T - 0.02 && tt < T + 0.1) { U.uRip.value[Math.min(7, base + 1)].set(jumpAt.x + ca * 0.6, jumpAt.z + sa * 0.6, t - tt + T, 0.08); }
        U.uRipCount.value = Math.max(U.uRipCount.value, Math.min(8, base + 2));
      }
    },
  });
  g.userData.surface = makeSurface(g, (lx, lz) => (h(lx, lz) < 0 ? 0 : null));
  return g;
}
export default createAsset;
