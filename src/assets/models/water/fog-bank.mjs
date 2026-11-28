/*
 * FOG BANK & MIST (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * Low-lying fog: soft translucent billows hug the ground, drift downwind, swell and dissolve, and
 * endlessly re-form upwind. Tune it from wisps of morning mist over a pond to a thick advection
 * fog bank rolling in off the sea or valley fog pooled between hills.
 *
 * QUICK START
 *   import { createAsset } from './fog-bank.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // the fog fills a box of width × depth × height sitting on y = 0
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | dawn | sea | smog | night — Theme
 *   width               10–300 m (default 60) — Width
 *   depth               10–300 m (default 40) — Depth
 *   height              0.5–30 m (default 4) — Layer Height
 *   density             0.05–1 (default 0.6) — Density
 *   opacity             0.03–0.5 (default 0.1) — Opacity
 *   puffSize            1–12 m (default 5.5) — Billow Size
 *   wind                0–4 m/s (default 0.5) — Drift Speed
 *   windDir             0–360 ° (default 0) — Drift Heading
 *   seed                1–999 (default 3) — Seed
 *   fog                 colour (default #eef2f5) — Fog Colour
 *   fogShade            colour (default #c9d2da) — Fog Shade Colour
 *
 * SPECS  9,122 triangles at defaults, 3 materials, 3 draw calls when merged,
 *        0.0 x 0.0 x 0.0 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: fog
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import { partsBag, makeEmitter, bindModule } from './kit.mjs';

const BASE = { fog: '#eef2f5', fogShade: '#c9d2da' };
export const COLORWAYS = {
  'default': { ...BASE },
  dawn: { fog: '#fbe8dc', fogShade: '#e2c2b8' },
  sea: { fog: '#e6eef0', fogShade: '#b0c2c8' },
  smog: { fog: '#d8d2c0', fogShade: '#a8a08a' },
  night: { fog: '#8a96aa', fogShade: '#5a6478' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  width: { type: 'range', default: 60, min: 10, max: 300, step: 5, unit: 'm', label: 'Width', affects: 'geometry', describe: 'Extent along the wind (X before rotation).' },
  depth: { type: 'range', default: 40, min: 10, max: 300, step: 5, unit: 'm', label: 'Depth', affects: 'geometry', describe: 'Extent across the wind.' },
  height: { type: 'range', default: 4, min: 0.5, max: 30, step: 0.5, unit: 'm', label: 'Layer Height', affects: 'geometry', describe: 'Thickness of the fog layer.' },
  density: { type: 'range', default: 0.6, min: 0.05, max: 1, step: 0.05, label: 'Density', affects: 'geometry', describe: 'Number of billows.' },
  opacity: { type: 'range', default: 0.1, min: 0.03, max: 0.5, step: 0.01, label: 'Opacity', affects: 'colors', describe: 'Translucency of each billow.' },
  puffSize: { type: 'range', default: 5.5, min: 1, max: 12, step: 0.25, unit: 'm', label: 'Billow Size', affects: 'geometry', describe: 'Average billow radius.' },
  wind: { type: 'range', default: 0.5, min: 0, max: 4, step: 0.05, unit: 'm/s', label: 'Drift Speed', affects: 'geometry', describe: 'Downwind drift speed.' },
  windDir: { type: 'range', default: 0, min: 0, max: 360, step: 5, unit: '°', label: 'Drift Heading', affects: 'geometry', describe: 'Direction the fog drifts toward.' },
  seed: { type: 'range', default: 3, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['fog'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'fog-bank';
  const P = partsBag();
  const W = p.width, D = p.depth, a = (p.windDir * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const count = Math.min(1500, Math.round(((W * D) / (p.puffSize * p.puffSize)) * 2.4 * p.density * Math.min(2, 0.6 + p.height / (p.puffSize * 2))) + 4);
  const sp = Math.max(0.05, p.wind), life = (W + p.puffSize * 4) / sp;
  const mk = (name, hex, frac, yk) => makeEmitter(name, {
    count: Math.max(2, Math.round(count * frac)), shape: 'flatcloud', color: hex, opacity: p.opacity, gravity: [0, 0, 0], pulse: true, grow: [0.75, 1.25], sway: [0.6, 0.15], seed: p.seed + name.length,
    spawn: (i, rr) => {
      const u = -W / 2 - p.puffSize * 2, v = (rr() - 0.5) * D, y = Math.pow(rr(), 1.6) * p.height * yk + p.puffSize * 0.25, spd = sp * (0.8 + rr() * 0.4);
      return { p: [u * ca - v * sa, y, u * sa + v * ca], v: [ca * spd, (rr() - 0.5) * 0.04, sa * spd], life: life * (sp / spd), size: p.puffSize * (0.6 + rr() * 0.8) * (1 - 0.3 * (y / (p.height + 1))) };
    },
  });
  const emitters = [mk('fog', C.fog, 0.65, 1), mk('fog-low', C.fogShade, 0.35, 0.5)];
  // Invisible footprint marker so the asset has a stable bounding volume for editors
  P.solid.push({ g: new THREE.PlaneGeometry(0.01, 0.01).rotateX(-Math.PI / 2), c: C.fogShade, n: 'anchor' });
  g.userData.view = { target: [0, p.height * 0.4, 0], radius: Math.max(W, D) * 0.9 };
  return finalize(g, P, p, C, { emitters });
}
export default createAsset;
