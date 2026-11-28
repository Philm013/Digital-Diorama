/*
 * WATER LILIES (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A drifting colony of water lilies: notched, gently cupped pads (or giant rimmed Victoria-style
 * pads), layered open blooms and closed buds, each tethered by a stem to the muddy bottom and
 * riding whatever water it floats on. A frog sits on a pad and leaps from pad to pad — ripples
 * ring out at take-off and landing — while dragonflies dart, hover and dip their tails to the
 * surface.
 *
 * QUICK START
 *   import { createAsset } from './water-lilies.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   lilies.userData.waterSurface = pond.userData.surface;   // pads ride another asset's water (set waterPatch: false)
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | pinkLotus | yellow | blueLotus | autumn — Theme
 *   pads                5–160 (default 45) — Pads
 *   spread              1–12 m (default 3.5) — Spread
 *   padSize             0.12–1.2 m (default 0.32) — Pad Radius
 *   flowers             0–1 (default 0.3) — Blooms
 *   buds                0–1 (default 0.2) — Buds
 *   rimmed              on/off (default off) — Giant Rimmed Pads
 *   showFrog            on/off (default on) — Frog
 *   dragonflies         0–6 (default 2) — Dragonflies
 *   drift               0–1 (default 0.3) — Drift
 *   waterPatch          on/off (default on) — Water Patch
 *   seed                1–999 (default 21) — Seed
 *   pad                 colour (default #4f8a3a) — Pad Colour
 *   padDark             colour (default #468036) — Pad Dark Colour
 *   flower              colour (default #f8f0f4) — Flower Colour
 *   flowerTip           colour (default #f0a0c0) — Flower Tip Colour
 *   center              colour (default #f2c81e) — Center Colour
 *   bud                 colour (default #c86a8a) — Bud Colour
 *   stem                colour (default #5a7a3a) — Stem Colour
 *   frog                colour (default #5a9a3a) — Frog Colour
 *   frogBelly           colour (default #e8e0b0) — Frog Belly Colour
 *   frogEye             colour (default #1e1e22) — Frog Eye Colour
 *   dragonfly           colour (default #2a8acf) — Dragonfly Colour
 *   wing                colour (default #d8f0ff) — Wing Colour
 *   water               colour (default #3a6a5a) — Water Colour
 *   deep                colour (default #1f3a32) — Deep Colour
 *   foam                colour (default #e8f4ee) — Foam Colour
 *   mud                 colour (default #4a3a2a) — Mud Colour
 *
 * SPECS  4,658 triangles at defaults, 3 materials, 9 draw calls when merged,
 *        12.0 x 1.5 x 12.0 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: lily-pads, lily-flowers, lily-stems, frog, dragonflies, water-patch
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.waterSurface · userData.surface · userData.matchWaves(asset)
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  prep, MAT, GLASS_MAT, rng, hash2, clamp01, smooth, lerp, mixC, tint, faceTint, makeWaterMaterial,
  matchWavesFrom, partsBag, fireRipple, patchWaves, waterPatch, makeLinks, bindModule
} from './kit.mjs';

const BASE = {
  pad: '#4f8a3a', padDark: '#468036', flower: '#f8f0f4', flowerTip: '#f0a0c0', center: '#f2c81e', bud: '#c86a8a', stem: '#5a7a3a', frog: '#5a9a3a', frogBelly: '#e8e0b0', frogEye: '#1e1e22',
  dragonfly: '#2a8acf', wing: '#d8f0ff', water: '#3a6a5a', deep: '#1f3a32', foam: '#e8f4ee', mud: '#4a3a2a',
};
export const COLORWAYS = {
  'default': { ...BASE },
  pinkLotus: { ...BASE, flower: '#fbd0e0', flowerTip: '#e0608f', bud: '#e0608e' },
  yellow: { ...BASE, flower: '#f8e070', flowerTip: '#f2c81f', bud: '#d8b030' },
  blueLotus: { ...BASE, flower: '#c8c0ff', flowerTip: '#7a6aff', center: '#f2d03a', bud: '#7a6afe' },
  autumn: { ...BASE, pad: '#8a8a3a', padDark: '#807a32', water: '#4a5a4a' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  pads: { type: 'range', default: 45, min: 5, max: 160, step: 1, label: 'Pads', affects: 'geometry', describe: 'Number of lily pads.' },
  spread: { type: 'range', default: 3.5, min: 1, max: 12, step: 0.1, unit: 'm', label: 'Spread', affects: 'geometry', describe: 'Radius of the colony.' },
  padSize: { type: 'range', default: 0.32, min: 0.12, max: 1.2, step: 0.01, unit: 'm', label: 'Pad Radius', affects: 'geometry', describe: 'Typical pad radius.' },
  flowers: { type: 'range', default: 0.3, min: 0, max: 1, step: 0.05, label: 'Blooms', affects: 'geometry', describe: 'Open flowers per pad.' },
  buds: { type: 'range', default: 0.2, min: 0, max: 1, step: 0.05, label: 'Buds', affects: 'geometry', describe: 'Closed buds per pad.' },
  rimmed: { type: 'toggle', default: false, label: 'Giant Rimmed Pads', affects: 'geometry', describe: 'Upturned rims like Victoria amazonica.' },
  showFrog: { type: 'toggle', default: true, label: 'Frog', affects: 'geometry', describe: 'A frog that hops between pads.' },
  dragonflies: { type: 'range', default: 2, min: 0, max: 6, step: 1, label: 'Dragonflies', affects: 'geometry', describe: 'Darting dragonflies.' },
  drift: { type: 'range', default: 0.3, min: 0, max: 1, step: 0.05, label: 'Drift', affects: 'geometry', describe: 'How much the pads wander on their stems.' },
  waterPatch: { type: 'toggle', default: true, label: 'Water Patch', affects: 'geometry', describe: 'Own pond patch (turn off when placing on another water asset).' },
  seed: { type: 'range', default: 21, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['lily-pads', 'lily-flowers', 'lily-stems', 'frog', 'dragonflies', 'water-patch'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'water-lilies';
  const P = partsBag();
  const r = rng(p.seed), S = p.padSize, depth = 1.2;
  // Placement: loose Poisson scatter inside the colony radius
  const items = [];
  for (let tries = 0; tries < p.pads * 30 && items.length < p.pads; tries++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * p.spread, x = Math.cos(a) * d, z = Math.sin(a) * d, s = S * (0.6 + r() * 0.7);
    if (items.some((q) => Math.hypot(q.x - x, q.z - z) < (q.s + s) * 0.95)) continue;
    items.push({ x, z, s, rot: r() * 6.28, ph: r() * 6.28, root: [x + (r() - 0.5) * 0.6, -depth + 0.05, z + (r() - 0.5) * 0.6] });
  }
  const nF = Math.round(items.length * p.flowers), nB = Math.round(items.length * p.buds);
  // Pad geometry (unit radius): notched, cupped disc with veined colouring (optional upturned rim)
  const padGeo = (() => {
    const v = [], seg = 20, notch = 0.32, cup = 0.06, Pt = (a, rr) => [Math.cos(a) * rr, cup * rr * rr, Math.sin(a) * rr];
    for (let i = 0; i < seg; i++) {
      const a0 = notch / 2 + (i / seg) * (Math.PI * 2 - notch), a1 = notch / 2 + ((i + 1) / seg) * (Math.PI * 2 - notch), A = Pt(a0, 1), B = Pt(a1, 1);
      v.push(0, 0.012, 0, ...B, ...A);
      if (p.rimmed) v.push(...A, ...B, B[0] * 1.02, B[1] + 0.14, B[2] * 1.02, ...A, B[0] * 1.02, B[1] + 0.14, B[2] * 1.02, A[0] * 1.02, A[1] + 0.14, A[2] * 1.02);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const m = prep(faceTint(geo, (x, y, z, i) => (y > 0.07 ? C.padDark : i % 2 ? C.padDark : C.pad)), null);
    m.computeVertexNormals();
    return m;
  })();
  const flowerGeo = (() => {
    const parts = [prep(new THREE.CylinderGeometry(0.16, 0.12, 0.08, 10).translate(0, 0.05, 0), C.center)];
    for (let ring = 0; ring < 3; ring++) for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + ring * 0.39, len = 0.62 - ring * 0.12, tilt = 0.35 + ring * 0.42, w = 0.13 - ring * 0.015;
      const base = [Math.cos(a) * 0.1, 0.03, Math.sin(a) * 0.1], tip = [Math.cos(a) * (0.1 + len * Math.cos(tilt)), 0.03 + len * Math.sin(tilt), Math.sin(a) * (0.1 + len * Math.cos(tilt))];
      const sx = -Math.sin(a) * w, sz = Math.cos(a) * w, mid = [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2 - 0.02, (base[2] + tip[2]) / 2];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([...base, mid[0] + sx, mid[1], mid[2] + sz, ...tip, ...base, ...tip, mid[0] - sx, mid[1], mid[2] - sz], 3));
      parts.push(prep(tint(geo, (x, y) => mixC(C.flower, C.flowerTip, smooth(0.15, 0.5, y)).getHex()), null));
    }
    const m = mergeGeometries(parts);
    m.computeVertexNormals();
    return m;
  })();
  const budGeo = (() => { const m = mergeGeometries([prep(new THREE.ConeGeometry(0.09, 0.3, 6).translate(0, 0.17, 0), C.bud), prep(new THREE.ConeGeometry(0.1, 0.1, 6).rotateX(Math.PI).translate(0, 0.02, 0), C.stem)]); m.computeVertexNormals(); return m; })();
  const mkIM = (name, geo, n2, mat = MAT) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n2)); m.name = name; m.frustumCulled = false; m.count = n2; return m; };
  const padsIM = mkIM('lily-pads', padGeo, items.length), flowersIM = mkIM('lily-flowers', flowerGeo, nF), budsIM = mkIM('lily-buds', budGeo, nB);
  const stems = makeLinks('lily-stems', items.length + nF + nB, 0.008, C.stem, 3);
  const extras = [];
  for (let i = 0; i < nF + nB; i++) { const host = items[Math.floor(r() * items.length)], a = r() * 6.28, d = host.s * (0.4 + r() * 0.5); extras.push({ x: host.x + Math.cos(a) * d, z: host.z + Math.sin(a) * d, s: S * (0.55 + r() * 0.3), rot: r() * 6.28, ph: r() * 6.28, root: [host.root[0], host.root[1], host.root[2]], bud: i >= nF }); }
  // Frog (sub that hops between pads) and dragonflies (instanced bodies + glassy wings)
  let frogSub = null;
  if (p.showFrog && items.length) {
    frogSub = P.sub('frog', [0, 0, 0]);
    const f = frogSub.solid;
    f.push({ g: faceTint(new THREE.IcosahedronGeometry(1, 1).scale(0.05, 0.03, 0.065).translate(0, 0.035, 0), (x, y) => (y < 0.025 ? C.frogBelly : C.frog)), c: null, n: 'frog-body' });
    f.push({ g: new THREE.IcosahedronGeometry(1, 1).scale(0.04, 0.025, 0.035).translate(0, 0.05, 0.05), c: C.frog, n: 'frog-head' });
    for (const s of [-1, 1]) {
      f.push({ g: new THREE.SphereGeometry(0.012, 6, 4).translate(s * 0.022, 0.072, 0.058), c: C.frogEye, n: 'eye' });
      f.push({ g: new THREE.CapsuleGeometry(0.012, 0.05, 2, 5).rotateX(Math.PI / 2).rotateY(s * 0.6).translate(s * 0.05, 0.02, -0.03), c: C.frog, n: 'thigh' });
      f.push({ g: new THREE.CapsuleGeometry(0.009, 0.045, 2, 5).rotateX(Math.PI / 2).rotateY(-s * 0.3).translate(s * 0.065, 0.012, 0.005), c: C.frog, n: 'shin' });
      f.push({ g: new THREE.CapsuleGeometry(0.007, 0.03, 2, 4).rotateX(0.5).translate(s * 0.035, 0.015, 0.06), c: C.frog, n: 'arm' });
    }
  }
  const nD = p.dragonflies;
  const dBody = (() => { const m = mergeGeometries([prep(new THREE.CapsuleGeometry(0.006, 0.07, 2, 5).rotateX(Math.PI / 2), C.dragonfly), prep(new THREE.SphereGeometry(0.01, 6, 4).translate(0, 0, 0.045), C.dragonfly)]); m.computeVertexNormals(); return m; })();
  const dWing = (() => { const v = []; for (const s of [-1, 1]) for (const z of [0.012, -0.008]) v.push(0, 0, z, s * 0.055, 0.004, z + 0.008, s * 0.055, 0.004, z - 0.006); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); const m = prep(geo, C.wing); m.computeVertexNormals(); return m; })();
  const dragon = new THREE.Group();
  dragon.name = 'dragonflies';
  const dB = mkIM('dragonfly-bodies', dBody, nD), dW = mkIM('dragonfly-wings', dWing, nD, GLASS_MAT);
  dragon.add(dB, dW);
  const flies = [];
  for (let i = 0; i < nD; i++) flies.push({ from: [0, 0.5, 0], to: [(r() - 0.5) * p.spread, 0.3 + r() * 0.5, (r() - 0.5) * p.spread], t0: 0, dur: 1, seed: i * 7 + 1 });
  // Water
  const waves = patchWaves(0.04);
  const waterMat = makeWaterMaterial({ waves, opacity: 0.86, foam: C.foam, roughness: 0.06, streakAlong: 0.3, streakAcross: 0.4, ripples: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] });
  if (p.waterPatch) g.userData.waterSurface = g.userData.surface = waterPatch(P.sub('water-patch', [0, 0, 0]), g, { r: p.spread + 2.5, depth, waves, water: C.water, deep: C.deep, floor: C.mud, mat: waterMat });
  const U = waterMat.userData.uniforms, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), vp = new THREE.Vector3(), vs = new THREE.Vector3();
  let rip = 0, frogAt = 0, hopFrom = 0, hopT = -10, nextHop = 4, landPending = false;
  const surf = (x, z, t) => { const s = g.userData.waterSurface; if (!s || !s.heightAt) return 0.01 * Math.sin(t * 0.8 + x + z); g.updateWorldMatrix(true, false); const w = new THREE.Vector3(x, 0, z).applyMatrix4(g.matrixWorld); const h = s.heightAt(w.x, w.z, t); return h === null ? 0 : h - g.matrixWorld.elements[13]; };
  const ripple = (x, z, t, a) => { U.uRip.value[rip].set(x, z, t, a); rip = (rip + 1) % 6; fireRipple(g, x, z, t, a); };
  const placeAll = (t) => {
    const all = items.concat(extras);
    all.forEach((it, i) => {
      const dx = Math.sin(t * 0.21 + it.ph) * 0.15 * p.drift, dz = Math.cos(t * 0.17 + it.ph * 1.3) * 0.15 * p.drift, x = it.x + dx, z = it.z + dz, y = surf(x, z, t) + (i < items.length ? 0.012 : 0.0);
      it.cur = [x, y, z];
      e.set(0, it.rot + Math.sin(t * 0.13 + it.ph) * 0.08, 0); q.setFromEuler(e); vp.set(x, y, z); vs.setScalar(it.s); m4.compose(vp, q, vs);
      if (i < items.length) padsIM.setMatrixAt(i, m4); else if (!it.bud) flowersIM.setMatrixAt(i - items.length, m4); else budsIM.setMatrixAt(i - items.length - nF, m4);
      stems.userData.set(i, [x, y - 0.01, z], it.root);
    });
    padsIM.instanceMatrix.needsUpdate = true; flowersIM.instanceMatrix.needsUpdate = true; budsIM.instanceMatrix.needsUpdate = true;
  };
  g.userData.view = { target: [0, 0.2, 0], radius: p.spread * 2.4 + 3 };
  finalize(g, P, p, C, {
    waterMat, objects: [padsIM, flowersIM, budsIM, stems, dragon],
    tick: (t) => {
      placeAll(t);
      if (frogSub && items.length) {
        const fn = g.getObjectByName('frog');
        if (t >= nextHop && t - hopT > 1) {
          hopFrom = frogAt; const cur = items[frogAt].cur;
          let best = frogAt, bd = Infinity;
          for (let k = 0; k < items.length; k++) { if (k === frogAt) continue; const d = Math.hypot(items[k].cur[0] - cur[0], items[k].cur[2] - cur[2]); const sc = Math.abs(d - 0.8) + hash2(k, Math.floor(t), 3) * 0.6; if (sc < bd) { bd = sc; best = k; } }
          frogAt = best; hopT = t; nextHop = t + 5 + hash2(t, 1, 2) * 6; landPending = true; ripple(cur[0], cur[2], t, 0.025);
        }
        const A = items[hopFrom].cur, B = items[frogAt].cur, k = clamp01((t - hopT) / 0.55);
        if (k >= 1 && landPending) { landPending = false; ripple(B[0], B[2], t, 0.03); }
        const x = lerp(A[0], B[0], k), z = lerp(A[2], B[2], k), y = lerp(A[1], B[1], k) + Math.sin(k * Math.PI) * 0.35 + 0.02;
        fn.position.set(x, y, z);
        fn.rotation.y = Math.atan2(B[0] - A[0], B[2] - A[2]) || fn.rotation.y;
        fn.rotation.x = k < 1 ? -0.5 * Math.sin(k * Math.PI) : 0;
      }
      for (let i = 0; i < nD; i++) {
        const f = flies[i];
        if (t >= f.t0 + f.dur) {
          f.from = f.to; f.t0 = t; f.dur = 0.4 + hash2(i, t, 4) * 0.8;
          const dip = hash2(i, t, 8) < 0.18, a = hash2(i, t, 5) * 6.28, d = Math.sqrt(hash2(i, t, 6)) * p.spread;
          f.to = [Math.cos(a) * d, dip ? 0.03 : 0.25 + hash2(i, t, 7) * 0.6, Math.sin(a) * d];
          if (dip) f.dipAt = t + f.dur; else f.dipAt = null;
        }
        if (f.dipAt && t >= f.dipAt) { ripple(f.to[0], f.to[2], t, 0.02); f.dipAt = null; }
        const k = smooth(0, 1, (t - f.t0) / f.dur), x = lerp(f.from[0], f.to[0], k), y = lerp(f.from[1], f.to[1], k) + Math.sin(t * 7 + i) * 0.01, z = lerp(f.from[2], f.to[2], k);
        e.set(0, Math.atan2(f.to[0] - f.from[0], f.to[2] - f.from[2]), 0); q.setFromEuler(e); vp.set(x, y, z); vs.set(1, 1, 1); m4.compose(vp, q, vs);
        dB.setMatrixAt(i, m4);
        e.set(Math.sin(t * 90 + i) * 0.25, e.y, 0); q.setFromEuler(e); m4.compose(vp, q, vs);
        dW.setMatrixAt(i, m4);
      }
      dB.instanceMatrix.needsUpdate = true; dW.instanceMatrix.needsUpdate = true;
    },
  });
  g.userData.matchWaves = (src) => matchWavesFrom(waterMat, src);
  return g;
}
export default createAsset;
