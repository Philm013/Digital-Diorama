/*
 * SEAGULLS (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A flock of gulls over the water: fliers wheel on banked soaring circles at different heights,
 * gliding with bursts of flapping on gull-bent wings; one plunges for a fish now and then — a
 * splash and a ring of ripples — and climbs away. Others float on the swell with folded wings, and
 * a few stand sentry on mooring posts. Instanced bodies and wings keep the whole flock to a
 * handful of draw calls.
 *
 * QUICK START
 *   import { createAsset } from './seagull-flock.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   gulls.userData.waterSurface = sea.userData.surface;   // floaters ride another asset's water
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | blackBacked | laughing | tern | harbour — Theme
 *   flying              1–40 (default 12) — Flying
 *   floating            0–30 (default 6) — Floating
 *   posts               0–5 (default 2) — Posts
 *   radius              5–60 m (default 20) — Radius
 *   height              3–40 m (default 12) — Height
 *   wingspan            0.6–2 m (default 1.3) — Wingspan
 *   dive                on/off (default on) — Plunge Dives
 *   swell               0–2 m (default 0.5) — Swell
 *   waterPatch          on/off (default on) — Water Patch
 *   seed                1–999 (default 17) — Seed
 *   body                colour (default #f4f4f0) — Body Colour
 *   head                colour (default #f6f6f2) — Head Colour
 *   back                colour (default #a8b0b8) — Back Colour
 *   wingTip             colour (default #1e1e22) — Wing Tip Colour
 *   beak                colour (default #f2c81e) — Beak Colour
 *   legs                colour (default #f2a07a) — Legs Colour
 *   eye                 colour (default #1a1a1a) — Eye Colour
 *   post                colour (default #6a5a48) — Post Colour
 *   postCap             colour (default #3a3a3a) — Post Cap Colour
 *   water               colour (default #2f7f99) — Water Colour
 *   deep                colour (default #164c66) — Deep Colour
 *   foam                colour (default #f6fcff) — Foam Colour
 *   seabed              colour (default #55605a) — Seabed Colour
 *
 * SPECS  7,004 triangles at defaults, 3 materials, 7 draw calls when merged,
 *        30.0 x 6.1 x 30.0 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: flock, posts, water-patch
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.waterSurface · userData.onWaterEvent hook · userData.matchWaves(asset)
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  prep, MAT, addCylinder, addWire, rng, clamp01, lerp, faceTint, makeWaterMaterial, matchWavesFrom, partsBag,
  fireRipple, makeEmitter, patchWaves, waterPatch, bindModule
} from './kit.mjs';

const BASE = { body: '#f4f4f0', head: '#f6f6f2', back: '#a8b0b8', wingTip: '#1e1e22', beak: '#f2c81e', legs: '#f2a07a', eye: '#1a1a1a', post: '#6a5a48', postCap: '#3a3a3a', water: '#2f7f99', deep: '#164c66', foam: '#f6fcff', seabed: '#55605a' };
export const COLORWAYS = {
  'default': { ...BASE },
  blackBacked: { ...BASE, back: '#2a2e34' },
  laughing: { ...BASE, head: '#1e1e23', back: '#5a6068', beak: '#8a2a2a', legs: '#8a2a2b' },
  tern: { ...BASE, head: '#1e1e24', back: '#d8dce0', beak: '#e8402f', legs: '#e8402e', wingTip: '#7a8088' },
  harbour: { ...BASE, water: '#3a7a7a', deep: '#1a4a4a', post: '#4a3a2a' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  flying: { type: 'range', default: 12, min: 1, max: 40, step: 1, label: 'Flying', affects: 'geometry', describe: 'Gulls soaring overhead.' },
  floating: { type: 'range', default: 6, min: 0, max: 30, step: 1, label: 'Floating', affects: 'geometry', describe: 'Gulls riding the swell.' },
  posts: { type: 'range', default: 2, min: 0, max: 5, step: 1, label: 'Posts', affects: 'geometry', describe: 'Mooring posts, each with a perched gull.' },
  radius: { type: 'range', default: 20, min: 5, max: 60, step: 1, unit: 'm', label: 'Radius', affects: 'geometry', describe: 'Size of the area the flock wheels over.' },
  height: { type: 'range', default: 12, min: 3, max: 40, step: 0.5, unit: 'm', label: 'Height', affects: 'geometry', describe: 'Typical soaring height.' },
  wingspan: { type: 'range', default: 1.3, min: 0.6, max: 2, step: 0.05, unit: 'm', label: 'Wingspan', affects: 'geometry', describe: 'Bird size.' },
  dive: { type: 'toggle', default: true, label: 'Plunge Dives', affects: 'geometry', describe: 'One gull periodically dives into the water.' },
  swell: { type: 'range', default: 0.5, min: 0, max: 2, step: 0.05, unit: 'm', label: 'Swell', affects: 'geometry', describe: 'Wave height of the preview water patch.' },
  waterPatch: { type: 'toggle', default: true, label: 'Water Patch', affects: 'geometry', describe: 'Own patch of sea (turn off when placing over another water asset).' },
  seed: { type: 'range', default: 17, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['flock', 'posts', 'water-patch'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'seagull-flock';
  const P = partsBag();
  const r = rng(p.seed), k = p.wingspan / 1.3;
  // Geometry (unit gull, +Z forward): body+head+beak+tail; one wing (+X), mirrored for the other
  const bodyParts = (list, sc = 1, at = [0, 0, 0], folded = false) => {
    const T = (geo) => geo.scale(sc, sc, sc).translate(at[0], at[1], at[2]);
    list.push({ g: T(faceTint(new THREE.IcosahedronGeometry(1, 1).scale(0.075, 0.07, 0.22), (x, y) => (y > 0.03 ? C.back : C.body))), c: null, n: 'body' });
    list.push({ g: T(new THREE.IcosahedronGeometry(0.055, 1).translate(0, 0.045, 0.21)), c: C.head, n: 'head' });
    list.push({ g: T(new THREE.ConeGeometry(0.013, 0.075, 5).rotateX(Math.PI / 2).translate(0, 0.035, 0.295)), c: C.beak, n: 'beak' });
    list.push({ g: T(new THREE.BoxGeometry(0.1, 0.015, 0.11).translate(0, 0.01, -0.25)), c: C.body, n: 'tail' });
    for (const s of [-1, 1]) list.push({ g: T(new THREE.SphereGeometry(0.009, 4, 3).translate(s * 0.035, 0.06, 0.24)), c: C.eye, n: 'eye' });
    if (folded) for (const s of [-1, 1]) list.push({ g: T(faceTint(new THREE.IcosahedronGeometry(1, 1).scale(0.03, 0.035, 0.24).translate(s * 0.065, 0.055, -0.08), (x, y, z) => (z < -0.2 ? C.wingTip : C.back))), c: null, n: 'folded-wing' });
  };
  const wingGeo = (s) => {
    const v = [], P2 = (x, y, z) => [s * x, y, z];
    const tri = (a, b, c2) => v.push(...a, ...b, ...c2);
    const A = P2(0.05, 0.03, 0.08), B = P2(0.36, 0.06, 0.07), Cc = P2(0.36, 0.06, -0.09), D = P2(0.05, 0.03, -0.07), E = P2(0.66, 0.02, -0.03), F = P2(0.5, 0.04, -0.1);
    tri(A, B, Cc); tri(A, Cc, D); tri(B, E, F); tri(B, F, Cc);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const m = prep(faceTint(geo, (x) => (Math.abs(x) > 0.48 ? C.wingTip : C.back)), null);
    m.computeVertexNormals();
    return m;
  };
  const nF = p.flying, nW = p.floating, nAll = nF + nW;
  const bodyList = [];
  bodyParts(bodyList);
  const bodyGeo = mergeGeometries(bodyList.map((it) => prep(it.g, it.c)));
  bodyGeo.computeVertexNormals();
  const IM = (name, geo, n2) => { const m = new THREE.InstancedMesh(geo, MAT, Math.max(1, n2)); m.name = name; m.count = n2; m.frustumCulled = false; m.castShadow = true; return m; };
  const flock = new THREE.Group();
  flock.name = 'flock';
  const bodies = IM('gull-bodies', bodyGeo, nAll), wl = IM('gull-wings-l', wingGeo(1), nAll), wr = IM('gull-wings-r', wingGeo(-1), nAll);
  flock.add(bodies, wl, wr);
  const fliers = [], floaters = [];
  for (let i = 0; i < nF; i++) fliers.push({ cx: (r() - 0.5) * p.radius * 0.6, cz: (r() - 0.5) * p.radius * 0.6, rad: p.radius * (0.3 + r() * 0.5), h: p.height * (0.6 + r() * 0.8), dir: r() < 0.5 ? 1 : -1, ph: r() * 6.28, v: 7 + r() * 3, fl: r() * 6.28 });
  for (let i = 0; i < nW; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * p.radius * 0.4; floaters.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, yaw: r() * 6.28, ph: r() * 6.28 }); }
  // Posts with perched gulls (static)
  if (p.posts > 0) {
    const ps = P.sub('posts', [0, 0, 0]);
    for (let i = 0; i < p.posts; i++) {
      const a = (i / p.posts) * Math.PI * 2 + 0.6, d = p.radius * 0.28, x = Math.cos(a) * d, z = Math.sin(a) * d, top = 1.6;
      addCylinder(ps.solid, 0.14, 0.16, top + 4, 8, x, top / 2 - 2, z, 0, 0, 0, C.post);
      ps.solid.push({ g: new THREE.CylinderGeometry(0.16, 0.16, 0.06, 8).translate(x, top + 0.03, z), c: C.postCap, n: 'cap' });
      bodyParts(ps.solid, k, [x, top + 0.2 * k, z], true);
      for (const s of [-1, 1]) addWire(ps.solid, [x + s * 0.03 * k, top + 0.06, z], [x + s * 0.03 * k, top + 0.16 * k, z], C.legs, 0.008 * k, 3);
    }
  }
  // Water
  const waves = patchWaves(p.swell);
  const waterMat = makeWaterMaterial({ waves, opacity: 0.84, foam: C.foam, roughness: 0.12, streakAlong: 0.4, streakAcross: 0.6, cap: [0.5, 0.78], ripples: [[0, 0, 0, 0], [0, 0, 0, 0]] });
  if (p.waterPatch) g.userData.waterSurface = g.userData.surface = waterPatch(P.sub('water-patch', [0, 0, 0]), g, { r: Math.max(12, p.radius * 0.75), depth: 4, waves, water: C.water, deep: C.deep, floor: C.seabed, mat: waterMat });
  const emitters = [], Td = 17;
  let splash = null;
  if (p.dive && nF > 0) { splash = makeEmitter('dive-splash', { count: 60, shape: 'drop', color: C.foam, stretch: 0.03, floor: -0.2, cycle: [Td, 0.25 / Td, 0], timeOffset: -12.0, seed: 61, spawn: (i, rr) => { const a = rr() * 6.28; return { p: [0, 0.05, 0], v: [Math.cos(a) * (0.5 + rr()), 2 + rr() * 2.5, Math.sin(a) * (0.5 + rr())], life: 1.2, size: 0.04 + rr() * 0.05 }; } }); emitters.push(splash); }
  const U = waterMat.userData.uniforms, m4 = new THREE.Matrix4(), mw = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), vp = new THREE.Vector3(), vs = new THREE.Vector3(k, k, k);
  const sh = [new THREE.Matrix4().makeTranslation(0.05, 0.03, 0), new THREE.Matrix4().makeTranslation(-0.05, 0.03, 0)], shi = [new THREE.Matrix4().makeTranslation(-0.05, -0.03, 0), new THREE.Matrix4().makeTranslation(0.05, -0.03, 0)];
  const wingM = (side, ang, fold) => { const R = new THREE.Matrix4().makeRotationZ(side * ang); if (fold) R.multiply(new THREE.Matrix4().makeRotationY(-side * 1.35)).multiply(new THREE.Matrix4().makeScale(0.55, 1, 0.7)); return sh[side > 0 ? 0 : 1].clone().multiply(R).multiply(shi[side > 0 ? 0 : 1]); };
  const surf = (x, z, t) => { const s = g.userData.waterSurface; if (!s || !s.heightAt) return 0.04 * Math.sin(t * 1.3 + x); g.updateWorldMatrix(true, false); const w = new THREE.Vector3(x, 0, z).applyMatrix4(g.matrixWorld); const h = s.heightAt(w.x, w.z, t); return h === null ? 0 : h - g.matrixWorld.elements[13]; };
  let lastDive = -1;
  g.userData.view = { target: [0, p.height * 0.45, 0], radius: Math.max(30, p.radius * 1.7) };
  finalize(g, P, p, C, {
    waterMat, emitters, objects: [flock],
    tick: (t) => {
      fliers.forEach((f, i) => {
        const w = (f.v / f.rad) * f.dir, a = f.ph + w * t;
        let x = f.cx + f.rad * Math.cos(a), z = f.cz + f.rad * Math.sin(a), y = f.h + 1.2 * Math.sin(t * 0.3 + f.ph), pitch = 0;
        const hx = -Math.sin(a) * f.dir, hz = Math.cos(a) * f.dir;
        if (i === 0 && splash) {
          const cyc = Math.floor(t / Td), u = t - cyc * Td;
          if (u > 10.5 && u < 15) {
            const dIn = clamp01((u - 10.5) / 1.5), dOut = clamp01((u - 12.3) / 2.7);
            y = u < 12 ? lerp(f.h, 0.05, dIn * dIn) : u < 12.3 ? 0.05 : lerp(0.05, f.h, Math.sqrt(dOut));
            pitch = u < 12 ? 1.0 * dIn : u < 12.3 ? 0 : -0.5 * (1 - dOut);
            if (u >= 12 && lastDive !== cyc) { lastDive = cyc; U.uRip.value[0].set(x, z, t, 0.04); U.uRip.value[1].set(x + 0.3, z, t + 0.2, 0.025); fireRipple(g, x, z, t, 0.04); splash.position.set(x, 0, z); }
          }
        }
        const bank = Math.atan((f.v * f.v) / (9.81 * f.rad)) * Math.sign(w);
        const flap = Math.sin(t * 0.4 + f.fl) > 0.55 ? Math.sin(t * 17 + f.fl) * 0.6 : 0.08 + 0.04 * Math.sin(t * 2 + f.fl);
        e.set(pitch, Math.atan2(hx, hz), -bank); q.setFromEuler(e); vp.set(x, y, z); m4.compose(vp, q, vs);
        bodies.setMatrixAt(i, m4);
        wl.setMatrixAt(i, mw.copy(m4).multiply(wingM(1, flap, false)));
        wr.setMatrixAt(i, mw.copy(m4).multiply(wingM(-1, flap, false)));
      });
      floaters.forEach((f, j) => {
        const i = nF + j, x = f.x + Math.sin(t * 0.1 + f.ph) * 0.3, z = f.z + Math.cos(t * 0.08 + f.ph) * 0.3;
        e.set(0.05 * Math.sin(t * 1.1 + f.ph), f.yaw + Math.sin(t * 0.15 + f.ph) * 0.4, 0.06 * Math.sin(t * 0.9 + f.ph)); q.setFromEuler(e); vp.set(x, surf(x, z, t) + 0.02 * k, z); m4.compose(vp, q, vs);
        bodies.setMatrixAt(i, m4);
        wl.setMatrixAt(i, mw.copy(m4).multiply(wingM(1, -0.1, true)));
        wr.setMatrixAt(i, mw.copy(m4).multiply(wingM(-1, -0.1, true)));
      });
      bodies.instanceMatrix.needsUpdate = true; wl.instanceMatrix.needsUpdate = true; wr.instanceMatrix.needsUpdate = true;
    },
  });
  g.userData.matchWaves = (src) => matchWavesFrom(waterMat, src);
  return g;
}
export default createAsset;
