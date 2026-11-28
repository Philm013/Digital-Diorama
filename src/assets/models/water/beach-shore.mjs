/*
 * BEACH & SURF (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * Sandy beach profile from an offshore bar to the dunes. Shoaling Gerstner waves steepen over the
 * bar, roll in as foam lines and run up the slope as swash before draining back — the waterline
 * moves because the animated sea genuinely intersects the sand. Wet-sand band, wrack line,
 * driftwood, shells, rocks, swaying dune grass and palms.
 *
 * QUICK START
 *   import { createAsset } from './beach-shore.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // sea on −Z, land on +Z; `tide` slides the waterline up or down the slope
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | tropical | volcanic | shingle | sunset — Theme
 *   width               30–200 m (default 60) — Beach Length
 *   depth               40–120 m (default 64) — Sea-to-Dune Depth
 *   slope               0.03–0.2 (default 0.07) — Beach Slope
 *   tide                -1–1 m (default 0) — Tide Level
 *   waveHeight          0–2.5 m (default 0.9) — Wave Height
 *   wavePeriod          4–14 s (default 7) — Wave Period
 *   waveAngle           -40–40 ° (default 8) — Wave Approach Angle
 *   surfFoam            0–1 (default 0.8) — Surf Foam
 *   sandbar             on/off (default on) — Offshore Sandbar
 *   cusps               0–1 (default 0.5) — Beach Cusps
 *   vegetation          none | dunegrass | palms | mixed — Vegetation
 *   rocks               0–30 (default 6) — Rocks
 *   driftwood           0–10 (default 3) — Driftwood
 *   shells              on/off (default on) — Shells & Wrack
 *   seaWater            on/off (default on) — Own Sea
 *   diorama             on/off (default on) — Diorama Sides
 *   seed                1–999 (default 11) — Seed
 *   sand                colour (default #e6d3a3) — Sand Colour
 *   wetSand             colour (default #b9a175) — Wet Sand Colour
 *   dune                colour (default #d8c08a) — Dune Colour
 *   grass               colour (default #8fae5a) — Grass Colour
 *   grassDark           colour (default #6b8f45) — Grass Dark Colour
 *   water               colour (default #2a8fa6) — Water Colour
 *   deep                colour (default #145d7a) — Deep Colour
 *   foam                colour (default #fbfdff) — Foam Colour
 *   rock                colour (default #7b776f) — Rock Colour
 *   wood                colour (default #9a7b5a) — Wood Colour
 *   palm                colour (default #7a5c3c) — Palm Colour
 *   frond               colour (default #4f8f3f) — Frond Colour
 *   shell               colour (default #f1e4d0) — Shell Colour
 *   weed                colour (default #4b5a32) — Weed Colour
 *   soil                colour (default #8c6d4a) — Soil Colour
 *
 * SPECS  24,507 triangles at defaults, 3 materials, 4 draw calls when merged,
 *        60.0 x 20.0 x 64.0 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: vegetation, props
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.surface.heightAt(worldX, worldZ, t) → sea height (world metres)
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  addWire, sweep, rng, noise2, fbm2, smooth, mixC, addRock, heightField, makeWaterMaterial, waterify, waterGrid,
  waterColumnSides, makeSwayMaterial, swayify, addPalm, addReeds, tileEdge, partsBag, makeSurface, bindModule
} from './kit.mjs';

const BASE = {
  sand: '#e6d3a3', wetSand: '#b9a175', dune: '#d8c08a', grass: '#8fae5a', grassDark: '#6b8f45',
  water: '#2a8fa6', deep: '#145d7a', foam: '#fbfdff', rock: '#7b776f', wood: '#9a7b5a',
  palm: '#7a5c3c', frond: '#4f8f3f', shell: '#f1e4d0', weed: '#4b5a32', soil: '#8c6d4a',
};
export const COLORWAYS = {
  'default': { ...BASE },
  tropical: { ...BASE, sand: '#f4ead2', wetSand: '#d6c49a', dune: '#efe1bd', water: '#22b5bf', deep: '#0a7a95', grass: '#7fbf5a', frond: '#3fa04a' },
  volcanic: { ...BASE, sand: '#3b3836', wetSand: '#242221', dune: '#4a4642', water: '#2b7d8f', deep: '#123f52', rock: '#2a2828', shell: '#d9d2c4', soil: '#3a2f28' },
  shingle: { ...BASE, sand: '#a9a49a', wetSand: '#7d786f', dune: '#b7ae96', water: '#4f8496', deep: '#25495a', foam: '#eef3f5', grass: '#7a9461', rock: '#6b6a66' },
  sunset: { ...BASE, sand: '#e8c39a', wetSand: '#b98e6a', water: '#4a7fa0', deep: '#2b4a72', foam: '#fff1e0' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  width: { type: 'range', default: 60, min: 30, max: 200, step: 5, unit: 'm', label: 'Beach Length', affects: 'geometry', describe: 'Alongshore extent (X).' },
  depth: { type: 'range', default: 64, min: 40, max: 120, step: 2, unit: 'm', label: 'Sea-to-Dune Depth', affects: 'geometry', describe: 'Cross-shore extent (Z): offshore bar → surf → beach → dunes.' },
  slope: { type: 'range', default: 0.07, min: 0.03, max: 0.2, step: 0.01, label: 'Beach Slope', affects: 'geometry', describe: 'Gradient of the beach face (rise/run). Steeper = narrower swash.' },
  tide: { type: 'range', default: 0, min: -1, max: 1, step: 0.05, unit: 'm', label: 'Tide Level', affects: 'geometry', describe: 'Still-water level; the wet band and waterline follow it.' },
  waveHeight: { type: 'range', default: 0.9, min: 0, max: 2.5, step: 0.05, unit: 'm', label: 'Wave Height', affects: 'geometry', describe: 'Breaker height (crest to trough) arriving from offshore.' },
  wavePeriod: { type: 'range', default: 7, min: 4, max: 14, step: 0.5, unit: 's', label: 'Wave Period', affects: 'geometry', describe: 'Seconds between breakers; sets wavelength via shallow-water speed √(g·h).' },
  waveAngle: { type: 'range', default: 8, min: -40, max: 40, step: 1, unit: '°', label: 'Wave Approach Angle', affects: 'geometry', describe: 'Angle of the incoming swell relative to straight onshore (drives longshore drift).' },
  surfFoam: { type: 'range', default: 0.8, min: 0, max: 1, step: 0.05, label: 'Surf Foam', affects: 'geometry', describe: 'Whitewater in the surf zone and swash lace.' },
  sandbar: { type: 'toggle', default: true, label: 'Offshore Sandbar', affects: 'geometry', describe: 'A submerged bar where waves first trip and break.' },
  cusps: { type: 'range', default: 0.5, min: 0, max: 1, step: 0.05, label: 'Beach Cusps', affects: 'geometry', describe: 'Scalloped, crescent-shaped shoreline.' },
  vegetation: { type: 'choice', default: 'mixed', options: ['none', 'dunegrass', 'palms', 'mixed'], label: 'Vegetation', affects: 'geometry', describe: 'Dune grass, palms, both or bare sand.' },
  rocks: { type: 'range', default: 6, min: 0, max: 30, step: 1, label: 'Rocks', affects: 'geometry', describe: 'Boulders scattered in the surf and on the beach.' },
  driftwood: { type: 'range', default: 3, min: 0, max: 10, step: 1, label: 'Driftwood', affects: 'geometry', describe: 'Logs stranded along the high-water line.' },
  shells: { type: 'toggle', default: true, label: 'Shells & Wrack', affects: 'geometry', describe: 'Shells and seaweed wrack marking the last high tide.' },
  seaWater: { type: 'toggle', default: true, label: 'Own Sea', affects: 'geometry', describe: 'The asset’s own patch of sea. Turn it off when the asset sits in an ocean tile, which then supplies (and shoals) the water.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Sides', affects: 'geometry', describe: 'Cut-away soil, rock and water-column sides.' },
  seed: { type: 'range', default: 11, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['vegetation', 'props'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'beach-shore';
  const P = partsBag();
  const W = p.width, D = p.depth, hw = W / 2, hd = D / 2, r = rng(p.seed);
  const zs0 = -hd + D * 0.45;
  const shoreZ = (x) => zs0 + p.cusps * 2.4 * Math.sin(x * 0.12 + p.seed) + (noise2(x * 0.03, 1.5, p.seed) - 0.5) * 3;
  const h = (x, z) => {
    const dz = z - shoreZ(x);
    let y;
    if (dz < 0) {
      y = Math.max(-5.5, dz * p.slope * 0.8);
      if (p.sandbar) y += 0.9 * Math.exp(-(((dz + 15) / 4.5) ** 2));
    } else {
      y = Math.min(dz * p.slope * 0.85, 1.25) + Math.max(0, dz - 14) * 0.02;
      y += smooth(18, 30, dz) * (1.4 + 1.6 * fbm2(x * 0.05, z * 0.05, p.seed + 2, 3));
    }
    return y + (noise2(x * 0.4, z * 0.4, p.seed + 9) - 0.5) * 0.06;
  };
  const runup = 0.3 + p.waveHeight * 0.45;
  const nx = Math.max(24, Math.round(W / 1.2)), nz = Math.max(24, Math.round(D / 1.2));
  const terrainCol = (x, y, z, sl) => {
      if (y < p.tide + runup) return y < p.tide - 0.6 ? C.wetSand : mixC(C.wetSand, C.sand, smooth(p.tide, p.tide + runup, y) * 0.4).getHex();
    if (y > 1.5 && sl < 0.3 && noise2(x * 0.18, z * 0.18, p.seed) > 0.42) return noise2(x * 0.5, z * 0.5, p.seed + 1) > 0.5 ? C.grass : C.grassDark;
    return y > 1.35 ? C.dune : C.sand;
  };
  P.solid.push({ g: heightField(W, D, nx, nz, h, terrainCol), c: null, n: 'beach' });

  // Surf: a world-phase Gerstner sea whose amplitude shoals over the bar and runs up the beach face.
  const zMax = zs0 + 10, wdz = zMax + hd;
  const nxW = Math.max(16, Math.round(W / 1.1)), nzW = Math.max(8, Math.round(wdz / ((W / nxW) * 0.866)));
  const Lw = p.wavePeriod * Math.sqrt(9.81 * 2.4), aW = (p.waveAngle * Math.PI) / 180, kw = (2 * Math.PI) / Lw, A = p.waveHeight / 2;
  const waves = [
    [Math.sin(aW), Math.cos(aW), Math.min(0.62, A * kw), Lw],
    [Math.sin(aW + 0.35), Math.cos(aW + 0.35), Math.min(0.25, A * kw * 0.64), Lw * 0.55],
    [Math.sin(aW - 0.6), Math.cos(aW - 0.6), Math.min(0.12, A * kw * 0.3), Lw * 0.31],
  ];
  const depthAt = (x, z) => p.tide - h(x, z);
  const wWeight = (d) => 0.75 + 0.55 * Math.exp(-(((d - 1.4) / 1.1) ** 2)) - 0.25 * smooth(0.9, 0, d);
  const wCol = (x, z) => {
    const d = depthAt(x, z);
    return mixC(mixC(C.water, C.deep, smooth(0.8, 5, d)), C.sand, 0.28 * smooth(1.4, 0, d));
  };
  const foamAt = (d) => p.surfFoam * (d < 0.3 ? 0.6 * smooth(-0.6, 0.3, d) + 0.2 : d < 2.4 ? 0.08 + 0.22 * smooth(2.4, 0.4, d) : 0.02);
  const Qs = waves.reduce((a, w) => a + w[2], 0);
  const cel = Math.sqrt(9.81 * 1.5);
  if (p.seaWater) P.water.push({
    g: waterify(waterGrid(W, wdz, nxW, nzW, p.tide, 0, (-hd + zMax) / 2), (x, y, z) => {
      const d = depthAt(x, z);
      return { s: z * Math.cos(aW) + x * Math.sin(aW), u: x * Math.cos(aW) - z * Math.sin(aW), speed: cel, foam: foamAt(d), ocean: wWeight(d), color: wCol(x, z) };
    }),
    c: null, n: 'surf',
  });
  if (p.diorama && p.seaWater) {
    waterColumnSides(P.water, W, wdz, nxW, nzW, p.tide, (x, z) => Math.min(h(x, z), p.tide),
      (x, y, z) => mixC(wCol(x, z), C.deep, 0.5), (x, z) => wWeight(depthAt(x, z)), 3, 0, (-hd + zMax) / 2);
  }
  tileEdge(p, P.solid, null, W, D, nx, nz, h, -8, [C.sand, C.soil, C.rock]);

  // Props
  const props = P.sub('props', [0, 0, 0]);
  for (let i = 0; i < p.rocks; i++) {
    const x = (r() - 0.5) * W * 0.9, z = zs0 + (r() - 0.65) * 22, rr = 0.4 + r() * 1.3;
    addRock(props.solid, rr, x, h(x, z) + rr * 0.15, z, C.rock, p.seed * 31 + i, 0.6);
  }
  const hiZ = (x) => shoreZ(x) + (p.tide + runup + 0.25) / (p.slope * 0.85);
  for (let i = 0; i < p.driftwood; i++) {
    const x = (r() - 0.5) * W * 0.85, z = hiZ(x) + 1 + r() * 4, L = 2 + r() * 3.5, a = r() * Math.PI, y = h(x, z);
    const ca = Math.cos(a) * L / 2, sa = Math.sin(a) * L / 2;
    props.solid.push({ g: sweep([[x - ca, y + 0.12, z - sa], [x + ca * 0.1, y + 0.2, z + sa * 0.1], [x + ca, y + 0.1, z + sa]], (t) => 0.16 * (1 - t * 0.4), 6, 4, true), c: C.wood, n: 'driftwood' });
    addWire(props.solid, [x + ca * 0.3, y + 0.2, z + sa * 0.3], [x + ca * 0.4 - sa * 0.35, y + 0.55, z + sa * 0.4 + ca * 0.35], C.wood, 0.05, 5);
  }
  if (p.shells) {
    for (let i = 0; i < Math.round(W * 0.6); i++) {
      const x = (r() - 0.5) * W * 0.95, z = hiZ(x) + (r() - 0.5) * 2.2, y = h(x, z);
      if (r() < 0.45) props.solid.push({ g: new THREE.IcosahedronGeometry(0.16 + r() * 0.2, 0).scale(1.6, 0.25, 0.7).rotateY(r() * 3).translate(x, y + 0.03, z), c: C.weed, n: 'wrack' });
      else if (r() < 0.5) props.solid.push({ g: new THREE.ConeGeometry(0.035, 0.1, 5).rotateZ(Math.PI / 2).rotateY(r() * 6).translate(x, y + 0.03, z), c: C.shell, n: 'shell' });
      else props.solid.push({ g: new THREE.IcosahedronGeometry(0.045, 0).scale(1, 0.35, 0.8).rotateY(r() * 6).translate(x, y + 0.015, z), c: C.shell, n: 'clam' });
    }
  }

  // Vegetation (sways in the sea breeze)
  const veg = P.sub('vegetation', [0, 0, 0]);
  const swayPush = (items, ph, y0, y1) => { for (const it of items) veg.sway.push({ g: swayify(it.g, ph, y0, y1), c: it.c, n: it.n }); };
  if (p.vegetation === 'dunegrass' || p.vegetation === 'mixed') {
    for (let i = 0; i < Math.round(W * 0.7); i++) {
      const x = (r() - 0.5) * W * 0.95, z = shoreZ(x) + 17 + r() * (hd - shoreZ(x) - 18), y = h(x, z);
      if (y < 1.3) continue;
      const tmp = [];
      addReeds(tmp, x, y - 0.05, z, 7, 0.75, [C.grass, C.grassDark, C.dune], p.seed + i, 0.35);
      swayPush(tmp, r() * 6.28, y, y + 2.4);
    }
  }
  if (p.vegetation === 'palms' || p.vegetation === 'mixed') {
    const n = Math.max(2, Math.round(W / 14));
    for (let i = 0; i < n; i++) {
      const x = -hw + (i + 0.5 + (r() - 0.5) * 0.6) * (W / n), z = shoreZ(x) + 13 + r() * 9, y = h(x, z), ph = 7 + r() * 4;
      const tmp = [];
      addPalm(tmp, x, y, z, ph, [C.palm, C.frond, C.grassDark], p.seed + i * 3, 0.12 + r() * 0.12);
      swayPush(tmp, r() * 6.28, y, y + ph * 1.1);
    }
  }

  const waterMat = makeWaterMaterial({ waves, opacity: 0.84, foam: C.foam, streakAlong: 0.35, streakAcross: 0.05, roughness: 0.14, cap: [Qs * 0.9, Qs * 1.15] });
  const swayMat = makeSwayMaterial({ amp: 0.35, freq: 1.4, dir: [0.3, 1] });
  finalize(g, P, p, C, { waterMat, swayMat, ground: { h, col: terrainCol, w: W, d: D } });
  g.userData.surface = makeSurface(g, (lx, lz, t, wx, wz) => {
    let y = 0;
    for (const w of waves) {
      const k = (2 * Math.PI) / w[3], c = Math.sqrt(9.81 / k);
      y += (w[2] / k) * Math.sin(k * (w[0] * wx + w[1] * wz - c * t));
    }
    return p.tide + y * wWeight(depthAt(lx, lz));
  });
  return g;
}
export default createAsset;
