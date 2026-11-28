/*
 * DUCK FAMILY (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A mother duck leads her ducklings in a bobbing line around the pond with the drake paddling
 * alongside; every bird trails its own little V-wake and ring of ripples, and now and then the
 * mother tips up to dabble, tail in the air. Switch species to a swan pair with grey cygnets.
 * Floats on its own pond patch or rides any water asset.
 *
 * QUICK START
 *   import { createAsset } from './duck-family.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   ducks.userData.waterSurface = pond.userData.surface; ducks.userData.matchWaves(pond);
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | whiteDomestic | woodDuck | swan | blackSwan — Theme
 *   species             duck | swan — Species
 *   youngAmount         0–10 (default 6) — Young
 *   mate                on/off (default on) — Mate
 *   pathRadius          1–15 m (default 3.5) — Path Radius
 *   speed               0.05–1.2 m/s (default 0.3) — Speed
 *   dabble              on/off (default on) — Dabbling
 *   waterPatch          on/off (default on) — Water Patch
 *   seed                1–999 (default 5) — Seed
 *   body                colour (default #8a6a4a) — Body Colour
 *   bodyDark            colour (default #6a4f36) — Body Dark Colour
 *   breast              colour (default #a8805a) — Breast Colour
 *   head                colour (default #7a5a3a) — Head Colour
 *   bill                colour (default #d88a2a) — Bill Colour
 *   eye                 colour (default #141414) — Eye Colour
 *   speculum            colour (default #3a4ad8) — Speculum Colour
 *   drakeHead           colour (default #1f6a3a) — Drake Head Colour
 *   ring                colour (default #f4f4ee) — Ring Colour
 *   drakeBreast         colour (default #7a3a2a) — Drake Breast Colour
 *   drakeBody           colour (default #c8c8c4) — Drake Body Colour
 *   tail                colour (default #2a2a2a) — Tail Colour
 *   young               colour (default #e8c84a) — Young Colour
 *   youngDark           colour (default #6a5a3a) — Young Dark Colour
 *   water               colour (default #3a6a6a) — Water Colour
 *   deep                colour (default #1f3a3a) — Deep Colour
 *   foam                colour (default #eef6f6) — Foam Colour
 *   mud                 colour (default #4a3a2a) — Mud Colour
 *
 * SPECS  3,254 triangles at defaults, 3 materials, 18 draw calls when merged,
 *        12.1 x 1.5 x 12.1 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: mother, mate, water-patch
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.waterSurface · userData.surface · userData.matchWaves(asset)
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  addWire, sweep, rng, faceTint, makeWaterMaterial, waterify, waterRibbon, matchWavesFrom, partsBag, fireRipple,
  patchWaves, waterPatch, bindModule
} from './kit.mjs';

const BASE = {
  body: '#8a6a4a', bodyDark: '#6a4f36', breast: '#a8805a', head: '#7a5a3a', bill: '#d88a2a', eye: '#141414', speculum: '#3a4ad8', drakeHead: '#1f6a3a', ring: '#f4f4ee', drakeBreast: '#7a3a2a', drakeBody: '#c8c8c4', tail: '#2a2a2a',
  young: '#e8c84a', youngDark: '#6a5a3a', water: '#3a6a6a', deep: '#1f3a3a', foam: '#eef6f6', mud: '#4a3a2a',
};
export const COLORWAYS = {
  'default': { ...BASE },
  whiteDomestic: { ...BASE, body: '#f4f2ee', bodyDark: '#e8e4dc', breast: '#f0eee8', head: '#f4f2ef', drakeHead: '#f4f2f0', drakeBreast: '#efede7', drakeBody: '#f2f0ea', tail: '#e8e6e0', young: '#f8e070', bill: '#f29a2a' },
  woodDuck: { ...BASE, body: '#8a7a6a', drakeHead: '#2a5a4a', drakeBreast: '#8a3a3a', drakeBody: '#c8a87a', ring: '#f4f4f0' },
  swan: { ...BASE, body: '#f8f8f4', bodyDark: '#ececE6', breast: '#f6f6f2', head: '#f8f8f5', bill: '#e86a2a', young: '#a8a8a4', youngDark: '#8a8a86', drakeBody: '#f8f8f6', drakeHead: '#f8f8f7', drakeBreast: '#f6f6f3', tail: '#1e1e22' },
  blackSwan: { ...BASE, body: '#1e1e22', bodyDark: '#2a2a2e', breast: '#1e1e23', head: '#1e1e24', bill: '#d8302a', young: '#5a5a5a', youngDark: '#4a4a4a', drakeBody: '#1e1e25', drakeHead: '#1e1e26', drakeBreast: '#1e1e27', tail: '#f4f4f0' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  species: { type: 'choice', default: 'duck', options: ['duck', 'swan'], label: 'Species', affects: 'geometry', describe: 'Mallard-style ducks, or swans with cygnets (with the Default theme, natural colours).' },
  youngAmount: { type: 'range', default: 6, min: 0, max: 10, step: 1, label: 'Young', affects: 'geometry', describe: 'Ducklings / cygnets in the line.' },
  mate: { type: 'toggle', default: true, label: 'Mate', affects: 'geometry', describe: 'Drake (or cob) paddling alongside.' },
  pathRadius: { type: 'range', default: 3.5, min: 1, max: 15, step: 0.1, unit: 'm', label: 'Path Radius', affects: 'geometry', describe: 'Size of the paddling loop.' },
  speed: { type: 'range', default: 0.3, min: 0.05, max: 1.2, step: 0.01, unit: 'm/s', label: 'Speed', affects: 'geometry', describe: 'Paddling speed.' },
  dabble: { type: 'toggle', default: true, label: 'Dabbling', affects: 'geometry', describe: 'The mother tips up to feed now and then.' },
  waterPatch: { type: 'toggle', default: true, label: 'Water Patch', affects: 'geometry', describe: 'Own pond patch (turn off when placing on another water asset).' },
  seed: { type: 'range', default: 5, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['mother', 'mate', 'water-patch'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const SW = p.species === 'swan', cw = p.colorway === 'default' && SW ? 'swan' : p.colorway;
  const C = zonesFor(cw, colorOverrides(userParams, cw));
  const g = new THREE.Group();
  g.name = 'duck-family';
  const P = partsBag();
  const r = rng(p.seed);
  const bird = (list, kind) => {
    const mate = kind === 'mate', col = { body: mate ? C.drakeBody : C.body, dark: mate ? (SW ? C.drakeBody : C.tail) : C.bodyDark, breast: mate ? C.drakeBreast : C.breast, head: mate ? C.drakeHead : C.head };
    if (kind === 'young') {
      const k = SW ? 1.8 : 1;
      list.push({ g: faceTint(new THREE.IcosahedronGeometry(1, 1).scale(0.06 * k, 0.055 * k, 0.085 * k).translate(0, 0.03 * k, 0), (x, y) => (y > 0.05 * k ? C.youngDark : C.young)), c: null, n: 'down' });
      list.push({ g: new THREE.IcosahedronGeometry(0.042 * k, 1).translate(0, 0.095 * k, 0.07 * k), c: C.young, n: 'head' });
      list.push({ g: new THREE.BoxGeometry(0.022 * k, 0.01 * k, 0.03 * k).translate(0, 0.088 * k, 0.11 * k), c: C.youngDark, n: 'bill' });
      for (const s of [-1, 1]) list.push({ g: new THREE.SphereGeometry(0.006 * k, 4, 3).translate(s * 0.03 * k, 0.105 * k, 0.095 * k), c: C.eye, n: 'eye' });
      return;
    }
    if (SW) {
      const k = mate ? 1.1 : 1, neck = [[0, 0.16, 0.36], [0, 0.42, 0.46], [0, 0.62, 0.36], [0, 0.72, 0.42]].map((q) => q.map((v) => v * k));
      list.push({ g: faceTint(new THREE.IcosahedronGeometry(1, 2).scale(0.24 * k, 0.17 * k, 0.5 * k).translate(0, 0.08 * k, 0), (x, y) => (y > 0.18 * k ? col.dark : col.body)), c: null, n: 'body' });
      for (const s of [-1, 1]) list.push({ g: new THREE.IcosahedronGeometry(1, 1).scale(0.09 * k, 0.1 * k, 0.32 * k).rotateZ(s * 0.5).translate(s * 0.15 * k, 0.2 * k, -0.08 * k), c: col.body, n: 'wing' });
      list.push({ g: new THREE.ConeGeometry(0.08 * k, 0.18 * k, 6).rotateX(-Math.PI / 2 - 0.4).translate(0, 0.14 * k, -0.52 * k), c: col.body, n: 'tail' });
      list.push({ g: sweep(neck, (t) => (0.05 - 0.015 * t) * k, 6, 12, false), c: col.body, n: 'neck' });
      list.push({ g: new THREE.IcosahedronGeometry(0.055 * k, 1).scale(0.9, 0.9, 1.2).translate(0, 0.74 * k, 0.46 * k), c: col.head, n: 'head' });
      list.push({ g: new THREE.ConeGeometry(0.03 * k, 0.11 * k, 6).rotateX(Math.PI / 2 + 0.35).translate(0, 0.71 * k, 0.55 * k), c: C.bill, n: 'bill' });
      list.push({ g: new THREE.SphereGeometry(0.022 * k, 5, 4).translate(0, 0.745 * k, 0.5 * k), c: C.tail, n: 'knob' });
      for (const s of [-1, 1]) list.push({ g: new THREE.SphereGeometry(0.009 * k, 4, 3).translate(s * 0.04 * k, 0.755 * k, 0.47 * k), c: C.eye, n: 'eye' });
      return;
    }
    list.push({ g: faceTint(new THREE.IcosahedronGeometry(1, 1).scale(0.15, 0.11, 0.26).translate(0, 0.05, 0), (x, y) => (y > 0.1 ? col.dark : col.body)), c: null, n: 'body' });
    list.push({ g: new THREE.IcosahedronGeometry(0.105, 1).translate(0, 0.07, 0.15), c: col.breast, n: 'breast' });
    list.push({ g: new THREE.ConeGeometry(0.05, 0.13, 5).rotateX(-Math.PI / 2 - 0.5).translate(0, 0.1, -0.27), c: mate ? C.tail : col.dark, n: 'tail' });
    if (mate) list.push({ g: new THREE.TorusGeometry(0.02, 0.006, 3, 8, Math.PI * 1.4).translate(0, 0.18, -0.33), c: C.tail, n: 'curl' });
    for (const s of [-1, 1]) {
      list.push({ g: new THREE.IcosahedronGeometry(1, 1).scale(0.05, 0.05, 0.17).translate(s * 0.115, 0.11, -0.04), c: col.dark, n: 'wing' });
      list.push({ g: new THREE.BoxGeometry(0.008, 0.025, 0.06).translate(s * 0.16, 0.11, -0.08), c: C.speculum, n: 'speculum' });
      list.push({ g: new THREE.SphereGeometry(0.009, 4, 3).translate(s * 0.043, 0.285, 0.25), c: C.eye, n: 'eye' });
    }
    addWire(list, [0, 0.12, 0.17], [0, 0.24, 0.21], col.head, 0.042, 6);
    if (mate) list.push({ g: new THREE.TorusGeometry(0.043, 0.009, 4, 12).rotateX(Math.PI / 2 - 0.3).translate(0, 0.17, 0.185), c: C.ring, n: 'ring' });
    list.push({ g: new THREE.IcosahedronGeometry(0.065, 1).scale(0.9, 0.95, 1.15).translate(0, 0.27, 0.22), c: col.head, n: 'head' });
    list.push({ g: new THREE.BoxGeometry(0.045, 0.018, 0.075).rotateX(0.15).translate(0, 0.255, 0.3), c: C.bill, n: 'bill' });
  };
  // V-wake overlay that travels with each bird (foam bucket, rides the swell)
  const vWake = (list, len, half, z0) => {
    for (const sg of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= 6; i++) { const d = (i / 6) * len; pts.push([sg * (half + Math.sin(0.36) * d), 0.012, z0 - Math.cos(0.36) * d]); }
      list.push({ g: waterify(waterRibbon(pts, (t) => 0.02 + t * len * 0.06, 2), (x, y, z, s, u) => ({ s, u, speed: p.speed + 0.2, foam: 0.55 * Math.max(0, 1 - s / len), ocean: 1, mode: 3 })), c: null, n: 'wake' });
    }
  };
  const flock = [{ name: 'mother', kind: 'mother', lag: 0, off: 0 }];
  if (p.mate) flock.push({ name: 'mate', kind: 'mate', lag: SW ? 1.1 : 0.55, off: SW ? 1.0 : 0.6 });
  for (let k = 0; k < p.youngAmount; k++) flock.push({ name: `young-${k + 1}`, kind: 'young', lag: (SW ? 1.5 : 0.7) + k * (SW ? 0.75 : 0.34) + r() * 0.08, off: 0, ph: r() * 6.28 });
  for (const b of flock) {
    const sb = P.sub(b.name, [0, 0, 0]), big = SW ? 2.1 : 1, yg = b.kind === 'young';
    bird(sb.solid, b.kind);
    vWake(sb.water, (yg ? 0.45 : 1.2) * big, (yg ? 0.04 : 0.1) * big, (yg ? 0.08 : 0.2) * big);
  }
  // Water
  const R = p.pathRadius, waves = patchWaves(0.05);
  const waterMat = makeWaterMaterial({ waves, opacity: 0.86, foam: C.foam, roughness: 0.06, streakAlong: 0.3, streakAcross: 0.4, ripples: flock.slice(0, 8).map(() => [0, 0, -0.6, 0.004]) });
  if (p.waterPatch) g.userData.waterSurface = g.userData.surface = waterPatch(P.sub('water-patch', [0, 0, 0]), g, { r: R * 1.15 + (SW ? 3 : 2), depth: 1.0, waves, water: C.water, deep: C.deep, floor: C.mud, mat: waterMat });
  const U = waterMat.userData.uniforms, Ravg = R * 0.825;
  const at = (s) => { const a = s / Ravg; return { x: R * Math.cos(a), z: 0.65 * R * Math.sin(a), tx: -R * Math.sin(a), tz: 0.65 * R * Math.cos(a) }; };
  const surf = (x, z, t) => { const s = g.userData.waterSurface; if (!s || !s.heightAt) return 0; g.updateWorldMatrix(true, false); const w = new THREE.Vector3(x, 0, z).applyMatrix4(g.matrixWorld); const h = s.heightAt(w.x, w.z, t); return h === null ? 0 : h - g.matrixWorld.elements[13]; };
  const nodes = [];
  let dabbled = -1;
  g.userData.view = { target: [0, 0.2, 0], radius: R * 1.7 + 1.5 };
  finalize(g, P, p, C, {
    waterMat,
    tick: (t) => {
      if (!nodes.length) for (const b of flock) { const nd = g.getObjectByName(b.name); nd.rotation.order = 'YXZ'; nodes.push(nd); }
      flock.forEach((b, i) => {
        const s = p.speed * t - b.lag, q = at(s), tl = Math.hypot(q.tx, q.tz) || 1, nx = q.tz / tl, nz = -q.tx / tl;
        const wig = b.kind === 'young' ? Math.sin(t * 1.3 + b.ph) * 0.06 : 0, x = q.x + nx * (b.off + wig), z = q.z + nz * (b.off + wig);
        let pitch = 0, dy = 0;
        if (b.kind === 'mother' && p.dabble) {
          const cyc = Math.floor(t / 11), u = t - cyc * 11 - 6;
          if (u > 0 && u < 2) { pitch = 1.35 * Math.pow(Math.sin((u / 2) * Math.PI), 0.6); dy = -0.06 * Math.sin((u / 2) * Math.PI); if (dabbled !== cyc) { dabbled = cyc; U.uRip.value[7].set(x, z, t, 0.02); U.uRipCount.value = 8; fireRipple(g, x, z, t, 0.02); } }
        }
        const nd = nodes[i];
        nd.position.set(x, surf(x, z, t) + dy + 0.006 * Math.sin(t * 5.5 + i), z);
        nd.rotation.set(pitch, Math.atan2(q.tx, q.tz), 0.04 * Math.sin(t * 2.1 + i));
        if (i < 7) U.uRip.value[i].set(x, z, -0.6, 0.004);
      });
    },
  });
  g.userData.matchWaves = (src) => matchWavesFrom(waterMat, src);
  return g;
}
export default createAsset;
