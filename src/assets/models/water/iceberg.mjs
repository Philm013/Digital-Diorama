/*
 * ICEBERG & FLOES (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A drifting iceberg built to scale — the submerged keel is several times the visible freeboard
 * (see it through the cut-away). Tabular, pinnacle, dome, wedge or dry-dock shapes with blue-ice
 * veins and a wave-cut notch. Meltwater drips from the rim, a slab periodically calves into the
 * sea with a splash and ripple ring, and pancake floes bob around it.
 *
 * QUICK START
 *   import { createAsset } from './iceberg.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   berg.userData.waterSurface = ocean.userData.surface;   // optional: ride an ocean tile
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | glacial | sediment | polarNight | turquoise — Theme
 *   shape               tabular | pinnacle | dome | wedge | drydock — Berg Shape
 *   length              10–150 m (default 40) — Length
 *   freeboard           2–40 m (default 9) — Freeboard
 *   draftRatio          3–8 (default 5.5) — Keel : Freeboard
 *   floes               0–40 (default 12) — Ice Floes
 *   melt                0–1 (default 0.4) — Melt
 *   calving             on/off (default on) — Calving
 *   calvePeriod         8–40 s (default 16) — Calving Interval
 *   swell               0–2 m (default 0.5) — Swell
 *   veins               0–1 (default 0.6) — Blue Veins
 *   diorama             on/off (default on) — Water-Column Cut-away
 *   seed                1–999 (default 9) — Seed
 *   snow                colour (default #f7fbff) — Snow Colour
 *   ice                 colour (default #d6ecf5) — Ice Colour
 *   blueIce             colour (default #7cc3e0) — Blue Ice Colour
 *   underIce            colour (default #5fb8c9) — Under Ice Colour
 *   deepIce             colour (default #2f7f95) — Deep Ice Colour
 *   sediment            colour (default #8f8a80) — Sediment Colour
 *   water               colour (default #22566e) — Water Colour
 *   deep                colour (default #0d2c40) — Deep Colour
 *   foam                colour (default #ffffff) — Foam Colour
 *   floe                colour (default #e9f4f8) — Floe Colour
 *
 * SPECS  16,900 triangles at defaults, 4 materials, 6 draw calls when merged,
 *        104.0 x 65.9 x 104.0 m (W x H x D, real-world scale).
 * PARTS animate: berg (rotate y 0…360°)
 *        detach: berg, floes, calf, drips, splash
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.surface.heightAt(x, z, t) · userData.matchWaves(sea) · userData.seaHole → the square of its own sea to cut out of an ocean it floats in (setHoles)
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  rng, hash2, noise2, smooth, lerp, mixC, faceTint, rockGeo, makeWaterMaterial, waterify, waterGrid,
  waterColumnSides, partsBag, makeEmitter, bindModule
} from './kit.mjs';

const BASE = {
  snow: '#f7fbff', ice: '#d6ecf5', blueIce: '#7cc3e0', underIce: '#5fb8c9', deepIce: '#2f7f95', sediment: '#8f8a80',
  water: '#22566e', deep: '#0d2c40', foam: '#ffffff', floe: '#e9f4f8',
};
export const COLORWAYS = {
  'default': { ...BASE },
  glacial: { ...BASE, ice: '#c9e6f2', blueIce: '#3f9fd0', underIce: '#3fa8c0', water: '#1e4f66' },
  sediment: { ...BASE, ice: '#dfe4e2', blueIce: '#9fc6d0', sediment: '#6f6658', snow: '#f1f2ee' },
  polarNight: { ...BASE, snow: '#d8e2f0', ice: '#aac4dc', blueIce: '#5f8fc0', water: '#0f2a40', deep: '#06131f' },
  turquoise: { ...BASE, water: '#1f6f7a', deep: '#0b3a44', underIce: '#5fd8c8', deepIce: '#1f8f8a' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  shape: { type: 'choice', default: 'tabular', options: ['tabular', 'pinnacle', 'dome', 'wedge', 'drydock'], label: 'Berg Shape', affects: 'geometry', describe: 'WMO iceberg shape classes.' },
  length: { type: 'range', default: 40, min: 10, max: 150, step: 2, unit: 'm', label: 'Length', affects: 'geometry', describe: 'Waterline length of the berg.' },
  freeboard: { type: 'range', default: 9, min: 2, max: 40, step: 0.5, unit: 'm', label: 'Freeboard', affects: 'geometry', describe: 'Height above the waterline.' },
  draftRatio: { type: 'range', default: 5.5, min: 3, max: 8, step: 0.25, label: 'Keel : Freeboard', affects: 'geometry', describe: 'Depth below water relative to the visible height (ice floats ~89% submerged).' },
  floes: { type: 'range', default: 12, min: 0, max: 40, step: 1, label: 'Ice Floes', affects: 'geometry', describe: 'Pancake floes and bergy bits around the berg.' },
  melt: { type: 'range', default: 0.4, min: 0, max: 1, step: 0.05, label: 'Melt', affects: 'geometry', describe: 'Meltwater dripping from the rim.' },
  calving: { type: 'toggle', default: true, label: 'Calving', affects: 'geometry', describe: 'A slab periodically breaks off and splashes into the sea.' },
  calvePeriod: { type: 'range', default: 16, min: 8, max: 40, step: 1, unit: 's', label: 'Calving Interval', affects: 'geometry', describe: 'Seconds between calving events.' },
  swell: { type: 'range', default: 0.5, min: 0, max: 2, step: 0.05, unit: 'm', label: 'Swell', affects: 'geometry', describe: 'Height of the surrounding swell.' },
  veins: { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Blue Veins', affects: 'colors', describe: 'Bands of clear blue refrozen meltwater in the ice.' },
  diorama: { type: 'toggle', default: true, label: 'Water-Column Cut-away', affects: 'geometry', describe: 'Show the water block so the hidden keel is visible.' },
  seed: { type: 'range', default: 9, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {
  berg: { type: 'rotate', axis: 'y', range: [0, 360], describe: 'Heading of the drifting berg.' },
};
export const detach = ['berg', 'floes', 'calf', 'drips', 'splash'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'iceberg';
  const P = partsBag();
  const r = rng(p.seed), Lb = p.length, F = p.freeboard, Dr = F * p.draftRatio;
  const Rx = Lb / 2, Rz = Lb * (0.3 + 0.12 * r()), ph = r() * 6.28;
  const R = (th) => { const e = (Rx * Rz) / Math.hypot(Rz * Math.cos(th), Rx * Math.sin(th)); return e * (1 + 0.16 * (noise2(Math.cos(th) * 2 + ph, Math.sin(th) * 2, p.seed) - 0.5) * 2); };
  const topY = (x, z) => {
    const ux = x / Rx;
    switch (p.shape) {
      case 'pinnacle': return F * (0.45 + 0.55 * Math.max(Math.exp(-(((ux - 0.2) / 0.25) ** 2)), 0.7 * Math.exp(-(((ux + 0.45) / 0.18) ** 2))));
      case 'dome': return F;
      case 'wedge': return F * (0.35 + 0.65 * (ux + 1) / 2);
      case 'drydock': return F * (0.3 + 0.7 * smooth(0.12, 0.45, Math.abs(ux)));
      default: return F * (0.96 + 0.04 * noise2(x * 0.2, z * 0.2, p.seed));
    }
  };
  const geo = new THREE.IcosahedronGeometry(1, 7);
  const pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const vx = pa.getX(i), vy = pa.getY(i), vz = pa.getZ(i), th = Math.atan2(vz, vx), rho = Math.sqrt(Math.max(0, 1 - vy * vy)), Rt = R(th);
    const jit = hash2(Math.round(vx * 500), Math.round(vy * 500) * 1.3 + Math.round(vz * 500) * 0.7, p.seed) - 0.5;
    let x, y, z;
    if (vy >= 0) {
      const cut = 0.3;
      if (p.shape === 'dome' || p.shape === 'pinnacle') {
        const rad = Rt * Math.pow(rho, p.shape === 'dome' ? 0.5 : 0.8);
        x = Math.cos(th) * rad; z = Math.sin(th) * rad; y = topY(x, z) * Math.pow(vy, p.shape === 'dome' ? 0.55 : 0.75);
      } else if (vy < cut) {
        const t = vy / cut, rad = Rt * (1 - 0.06 * t);
        x = Math.cos(th) * rad; z = Math.sin(th) * rad; y = topY(x, z) * Math.pow(t, 0.85);
      } else {
        const t = rho / Math.sqrt(1 - cut * cut), rad = Rt * 0.94 * Math.min(1, t);
        x = Math.cos(th) * rad; z = Math.sin(th) * rad; y = topY(x, z) * (p.shape === 'pinnacle' ? 1 : 1 - 0.015 * (1 - t));
      }
      y += jit * F * 0.05;
    } else {
      const t = -vy, rad = Rt * 1.22 * Math.pow(rho, 0.75);
      x = Math.cos(th) * rad; z = Math.sin(th) * rad; y = -Dr * Math.pow(t, 0.8);
    }
    const notch = Math.abs(y) < 0.8 ? 0.9 : 1, k = notch * (1 + jit * 0.08);
    pa.setXYZ(i, x * k, y, z * k);
  }
  const berg = P.sub('berg', [0, 0, 0]);
  berg.solid.push({
    g: faceTint(geo, (x, y, z) => {
      if (y < -0.3) return mixC(C.underIce, C.deepIce, smooth(0, Dr, -y)).getHex();
      if (Math.abs(y) < 0.6) return C.blueIce;
      const v = Math.sin(x * 0.45 + noise2(x * 0.1, z * 0.1, p.seed) * 4);
      if (v > 1 - p.veins * 0.25) return C.blueIce;
      if (p.colorway === 'sediment' && Math.sin(y * 1.6 + x * 0.05) > 0.8) return C.sediment;
      return y > topY(x, z) - F * 0.06 ? C.snow : C.ice;
    }),
    c: null, n: 'berg',
  });

  // Sea tile with a foam collar hugging the berg's waterline
  const T = Math.max(60, Lb * 2.6), nW = Math.max(24, Math.round(T / 1.5)), nZ = Math.round(nW / 0.866);
  const Lw = 22, kw = (2 * Math.PI) / Lw;
  const waves = [[1, 0.25, Math.min(0.5, (p.swell / 2) * kw), Lw], [0.3, -1, Math.min(0.2, (p.swell / 5) * kw * 2), Lw * 0.5], [-1, 0.6, 0.05, 6]];
  const collar = (x, z) => { const th = Math.atan2(z, x), d = Math.hypot(x, z) - R(th) * 0.9; return d; };
  const wCol = (x, z) => { const d = collar(x, z); return mixC(C.water, C.underIce, 0.35 * smooth(6, 0, d)); };
  // the patch edge fades to plain open sea (shared shoreline model, deep water) so an ocean around it joins seamlessly
  const edgeK = (x, z) => smooth(0, 10, T / 2 - Math.max(Math.abs(x), Math.abs(z)));
  P.water.push({ g: waterify(waterGrid(T, T, nW, nZ, 0), (x, y, z) => { const d = collar(x, z), k = edgeK(x, z); return { s: x, u: z, speed: 0.4, foam: lerp(0.03, smooth(3, -0.5, d) * 0.75 + 0.03, k), ocean: 1, ripple: smooth(15, 5, d), color: mixC(mixC(C.water, C.deep, 0.45), wCol(x, z), k) }; }), c: null, n: 'sea' });
  if (p.diorama) waterColumnSides(P.water, T, T, nW, nZ, 0, -Dr * 1.15, (x, y, z) => mixC(wCol(x, z), C.deep, Math.min(1, -y / Dr) * 0.55), () => 1);

  // Floes
  if (p.floes > 0) {
    const fl = P.sub('floes', [0, 0, 0]);
    for (let i = 0; i < p.floes; i++) {
      const a = r() * 6.28, d = R(a) * 1.2 + 3 + r() * (T / 2 - R(a) * 1.2 - 5), fx = Math.cos(a) * d, fz = Math.sin(a) * d, fr = 0.8 + r() * 2.4, th = 0.3 + r() * 0.5;
      const sh = new THREE.Shape(), m = 7 + Math.floor(r() * 3);
      for (let k = 0; k < m; k++) { const b = (k / m) * Math.PI * 2, rr = fr * (0.7 + r() * 0.5); k ? sh.lineTo(Math.cos(b) * rr, Math.sin(b) * rr) : sh.moveTo(Math.cos(b) * rr, Math.sin(b) * rr); }
      const fg = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.08, bevelSegments: 1 }).rotateX(-Math.PI / 2).translate(fx, -th * 0.8, fz);
      fl.solid.push({ g: faceTint(fg, (x, y) => (y > 0.05 ? C.floe : C.underIce)), c: null, n: 'floe' });
    }
  }
  // Calving slab
  const calfS = Math.max(1.2, F * 0.3), calfA = Math.PI / 2 + (r() - 0.5) * 0.6, calfR = R(calfA) * 0.88;
  const cx = Math.cos(calfA) * calfR, cz = Math.sin(calfA) * calfR, cy = topY(cx, cz) - calfS * 0.5;
  if (p.calving) {
    const calf = P.sub('calf', [cx, cy - calfS * 0.5, cz], 'berg');
    calf.solid.push({ g: faceTint(rockGeo(calfS * 0.6, p.seed + 3, 1, 1.2, 0.18).translate(cx, cy, cz), (x, y) => (y > cy + calfS * 0.4 ? C.snow : C.ice)), c: null, n: 'calf' });
  }
  const emitters = [];
  if (p.melt > 0) {
    emitters.push(makeEmitter('drips', {
      count: Math.round(10 + 60 * p.melt), shape: 'streak', color: C.ice, stretch: 1.6, floor: 0, seed: p.seed + 2,
      spawn: (i, rr) => { const a = rr() * 6.28, x = Math.cos(a) * R(a) * 0.9, z = Math.sin(a) * R(a) * 0.9, y = Math.max(0.5, topY(x, z) * 0.85); return { p: [x, y, z], v: [Math.cos(a) * 0.3, -0.5, Math.sin(a) * 0.3], life: Math.sqrt((2 * y) / 9.81) + 0.15, size: 0.035 }; },
    }));
  }
  const fallT = Math.sqrt((2 * Math.max(0.5, cy)) / 9.81), phiI = 0.62 + fallT / p.calvePeriod;
  if (p.calving) {
    emitters.push(makeEmitter('splash', {
      count: 140, shape: 'drop', color: C.foam, stretch: 0.04, floor: -0.2, seed: p.seed + 5, cycle: [p.calvePeriod, 0.06, 0.4], timeOffset: -phiI * p.calvePeriod,
      spawn: (i, rr) => { const a = rr() * 6.28, sp = 2 + rr() * 5; return { p: [cx + Math.cos(calfA) * calfS + (rr() - 0.5) * calfS, 0.2, cz + Math.sin(calfA) * calfS + (rr() - 0.5) * calfS], v: [Math.cos(a) * sp * 0.5, 4 + rr() * 9 * Math.min(1.5, calfS / 3), Math.sin(a) * sp * 0.5], life: 2.4, size: 0.12 + rr() * 0.22 }; },
    }));
  }

  const waterMat = makeWaterMaterial({ waves, opacity: p.diorama ? 0.7 : 0.86, foam: C.foam, streakAlong: 0.45, streakAcross: 0.45, roughness: 0.12 });
  const U = waterMat.userData.uniforms;
  let lastCycle = -1;
  g.userData.view = { target: [0, F * 0.2, 0], radius: Math.max(Lb * 1.5, 40) };
  g.userData.seaHole = { w: T, d: T };   // the square of sea to cut out of an ocean it floats in
  return finalize(g, P, p, C, {
    waterMat, emitters,
    tick: (t, dt, drive) => {
      const b = g.getObjectByName('berg');
      if (b) b.position.y = Math.sin(t * 0.33) * 0.14 * (0.5 + p.swell);
      const fl = g.getObjectByName('floes');
      if (fl) { fl.position.y = Math.sin(t * 0.9 + 1) * 0.06; fl.rotation.y = Math.sin(t * 0.05) * 0.02; }
      const c = g.getObjectByName('calf');
      if (c) {
        const cyc = Math.floor(t / p.calvePeriod), phi = t / p.calvePeriod - cyc;
        const base = c.userData.rest;
        if (phi < 0.55 || phi > 0.985) { c.visible = true; c.position.copy(base); c.rotation.set(0, 0, 0); c.scale.setScalar(phi > 0.985 ? (phi - 0.985) / 0.015 : 1); }
        else if (phi < 0.62) { const k = (phi - 0.55) / 0.07; c.position.copy(base); c.rotation.set(Math.sin(calfA) * k * 0.7, 0, -Math.cos(calfA) * k * 0.7); c.scale.setScalar(1); }
        else {
          const te = (phi - 0.62) * p.calvePeriod, y = base.y - 0.5 * 9.81 * te * te;
          c.position.set(base.x + Math.cos(calfA) * te * 1.6, Math.max(y, -calfS * 3), base.z + Math.sin(calfA) * te * 1.6);
          c.rotation.set(Math.sin(calfA) * (0.7 + te * 1.2), 0, -Math.cos(calfA) * (0.7 + te * 1.2));
          c.visible = y > -calfS * 2.5;
          if (phi >= phiI && cyc !== lastCycle) { lastCycle = cyc; U.uRip.value[0].set(cx + Math.cos(calfA) * calfS, cz + Math.sin(calfA) * calfS, t, 0.35); U.uRipCount.value = 1; }
        }
      }
    },
  });
}
export default createAsset;
