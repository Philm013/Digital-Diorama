/*
 * RAIN CLOUD & PRECIPITATION (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A cloud that actually precipitates: a lumpy cumulus/cumulonimbus mass, dark at the base and
 * bright on top, releases rain, drizzle, snow, hail or sleet that falls at its real terminal speed
 * (rain ≈ 7 m/s, snow ≈ 1 m/s), slants with the wind and bursts into splash rings on the ground
 * below. Optional lightning forks flicker through the cloud.
 *
 * QUICK START
 *   import { createAsset } from './rain-cloud.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // the ground (splash plane) is y = 0; place the cloud anywhere — precipitation always reaches local y = 0
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | thunderhead | fairWeather | sunset | night — Theme
 *   size                10–200 m (default 40) — Cloud Width
 *   altitude            5–120 m (default 24) — Cloud Base Altitude
 *   thickness           4–60 m (default 14) — Cloud Thickness
 *   precipitation       rain | drizzle | snow | hail | sleet | none — Precipitation
 *   intensity           0–1 (default 0.6) — Intensity
 *   wind                -1–1 (default 0.2) — Wind
 *   splashes            on/off (default on) — Ground Splashes
 *   lightning           on/off (default off) — Lightning
 *   flashInterval       2–30 s (default 7) — Flash Interval
 *   puffiness           0–1 (default 0.6) — Puffiness
 *   seed                1–999 (default 4) — Seed
 *   cloudTop            colour (default #f4f6f8) — Cloud Top Colour
 *   cloudBase           colour (default #7d8590) — Cloud Base Colour
 *   rain                colour (default #a8c8e0) — Rain Colour
 *   snow                colour (default #ffffff) — Snow Colour
 *   hail                colour (default #e8f4fa) — Hail Colour
 *   splash              colour (default #d8ecf8) — Splash Colour
 *   bolt                colour (default #e8f0ff) — Bolt Colour
 *
 * SPECS  36,558 triangles at defaults, 4 materials, 4 draw calls when merged,
 *        38.6 x 11.3 x 29.3 m (W x H x D, real-world scale).
 * PARTS animate: cloud (translate x -20…20 m)
 *        detach: cloud, precipitation, splashes, splash-drops, bolt-1, bolt-2, bolt-3
 *        night: lightning
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import { addWire, rng, smooth, mixC, tint, partsBag, makeEmitter, makeGlowMaterial, bindModule } from './kit.mjs';

const BASE = {
  cloudTop: '#f4f6f8', cloudBase: '#7d8590', rain: '#a8c8e0', snow: '#ffffff', hail: '#e8f4fa', splash: '#d8ecf8', bolt: '#e8f0ff',
};
export const COLORWAYS = {
  'default': { ...BASE },
  thunderhead: { ...BASE, cloudTop: '#d8dde4', cloudBase: '#3d434c', rain: '#8fb0c8' },
  fairWeather: { ...BASE, cloudTop: '#ffffff', cloudBase: '#c8d0da' },
  sunset: { ...BASE, cloudTop: '#ffd8c0', cloudBase: '#7a5a6a', rain: '#e0b8a0' },
  night: { ...BASE, cloudTop: '#5a6478', cloudBase: '#1e232e', rain: '#6f88a8', bolt: '#d8e4ff' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  size: { type: 'range', default: 40, min: 10, max: 200, step: 2, unit: 'm', label: 'Cloud Width', affects: 'geometry', describe: 'Horizontal extent of the cloud (and the precipitation footprint).' },
  altitude: { type: 'range', default: 24, min: 5, max: 120, step: 1, unit: 'm', label: 'Cloud Base Altitude', affects: 'geometry', describe: 'Height of the cloud base above the ground plane.' },
  thickness: { type: 'range', default: 14, min: 4, max: 60, step: 1, unit: 'm', label: 'Cloud Thickness', affects: 'geometry', describe: 'Vertical depth (towering cumulonimbus at the top end).' },
  precipitation: { type: 'choice', default: 'rain', options: ['rain', 'drizzle', 'snow', 'hail', 'sleet', 'none'], label: 'Precipitation', affects: 'geometry', describe: 'What falls from the cloud.' },
  intensity: { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Intensity', affects: 'geometry', describe: 'Precipitation rate.' },
  wind: { type: 'range', default: 0.2, min: -1, max: 1, step: 0.05, label: 'Wind', affects: 'geometry', describe: 'Slants the precipitation along X (− left, + right).' },
  splashes: { type: 'toggle', default: true, label: 'Ground Splashes', affects: 'geometry', describe: 'Splash rings where drops land (y = 0).' },
  lightning: { type: 'toggle', default: false, label: 'Lightning', affects: 'geometry', describe: 'Forked lightning flashes.' },
  flashInterval: { type: 'range', default: 7, min: 2, max: 30, step: 0.5, unit: 's', label: 'Flash Interval', affects: 'geometry', describe: 'Seconds between lightning strikes.' },
  puffiness: { type: 'range', default: 0.6, min: 0, max: 1, step: 0.05, label: 'Puffiness', affects: 'geometry', describe: 'Lumpy cumulus ↔ flat stratus.' },
  seed: { type: 'range', default: 4, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = { cloud: { type: 'translate', axis: 'x', range: [-20, 20], describe: 'Drift the cloud mass (precipitation stays under it only when not overridden).' } };
export const detach = ['cloud', 'precipitation', 'splashes', 'splash-drops', 'bolt-1', 'bolt-2', 'bolt-3'];
export const night = { lightning: { color: '#d8e4ff', intensity: 4, distance: 120, offset: [0, 10, 0], describe: 'Lightning flash illumination (pulse a light while userData.flash > 0).' } };

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'rain-cloud';
  const P = partsBag();
  const W = p.size, H0 = p.altitude, T = p.thickness, r = rng(p.seed);
  const cloud = P.sub('cloud', [0, H0, 0]);
  const nb = Math.round(10 + W * 0.5);
  for (let i = 0; i < nb; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * W * 0.42, x = Math.cos(a) * d, z = Math.sin(a) * d * 0.7;
    const edge = 1 - d / (W * 0.45), rad = (W * 0.08 + r() * W * 0.08) * (0.6 + 0.6 * edge);
    const y = H0 + rad * 0.5 + r() * T * p.puffiness * edge * 0.8;
    const geo = new THREE.IcosahedronGeometry(rad, 1).scale(1.2, (0.55 + 0.4 * p.puffiness) * Math.min(1, T / (rad * 1.6) + 0.3), 1).translate(x, y, z);
    cloud.solid.push({ g: tint(geo, (px, py) => mixC(C.cloudBase, C.cloudTop, smooth(H0, H0 + T * 0.8, py))), c: null, n: 'puff' });
  }
  cloud.solid.push({ g: tint(new THREE.CylinderGeometry(W * 0.4, W * 0.36, 1.2, 14).scale(1, 1, 0.7).translate(0, H0 + 0.3, 0), () => C.cloudBase), c: null, n: 'base' });
  const kind = p.precipitation, I = p.intensity, emitters = [];
  const spec = { rain: [7.5, 'streak', C.rain, 0.05, 2.2], drizzle: [3.5, 'streak', C.rain, 0.03, 2.2], snow: [1.0, 'flake', C.snow, 0.09, 0], hail: [14, 'chunk', C.hail, 0.07, 0], sleet: [4.5, 'streak', C.hail, 0.05, 0.9] }[kind];
  if (spec && I > 0) {
    const [v, shape, col, size, stretch] = spec, area = (W * 0.8) * (W * 0.56), dens = { rain: 4, drizzle: 7, snow: 3, hail: 0.8, sleet: 3 }[kind];
    const count = Math.min(5000, Math.round(area * dens * I) + 1), wx = p.wind * v * 0.45;
    emitters.push(makeEmitter('precipitation', {
      count, shape, color: col, stretch, gravity: [0, 0, 0], sway: kind === 'snow' ? [0.35, 1.1] : [0, 0], seed: p.seed + 1, floor: -0.05,
      spawn: (i, rr) => { const x = (rr() - 0.5) * W * 0.8, z = (rr() - 0.5) * W * 0.56, sp = v * (0.85 + rr() * 0.3); return { p: [x - wx * (H0 / sp), H0, z], v: [wx, -sp, 0], life: H0 / sp + 0.04, size: size * (0.7 + rr() * 0.6), spin: kind === 'snow' || kind === 'hail' ? (rr() - 0.5) * 4 : 0 }; },
    }));
    if (p.splashes && kind !== 'snow') {
      emitters.push(makeEmitter('splashes', {
        count: Math.min(900, Math.round(count * 0.18) + 1), shape: 'ring', color: C.splash, gravity: [0, 0, 0], grow: [0.04, kind === 'hail' ? 0.18 : 0.26], seed: p.seed + 2,
        spawn: (i, rr) => ({ p: [(rr() - 0.5) * W * 0.8, 0.02, (rr() - 0.5) * W * 0.56], v: [0, 0, 0], life: 0.45 + rr() * 0.2, size: 1 }),
      }));
      emitters.push(makeEmitter('splash-drops', {
        count: Math.min(600, Math.round(count * 0.1) + 1), shape: 'drop', color: C.splash, floor: 0, seed: p.seed + 3,
        spawn: (i, rr) => { const a = rr() * 6.28, sp = 0.6 + rr() * 0.8; return { p: [(rr() - 0.5) * W * 0.8, 0.02, (rr() - 0.5) * W * 0.56], v: [Math.cos(a) * sp, 1 + rr() * 1.2, Math.sin(a) * sp], life: 0.35, size: 0.02 }; },
      }));
    }
  }
  // Lightning: three pre-built forks, one shown per flash
  let glowMat = null;
  if (p.lightning) {
    glowMat = makeGlowMaterial();
    for (let b = 0; b < 3; b++) {
      const lb = P.sub(`bolt-${b + 1}`, [0, 0, 0]), rb = rng(p.seed * 11 + b);
      let x = (rb() - 0.5) * W * 0.4, z = (rb() - 0.5) * W * 0.3, y = H0;
      const pts = [[x, y, z]];
      while (y > 0.5) { y = Math.max(0, y - (1.5 + rb() * 3)); x += (rb() - 0.5) * 3; z += (rb() - 0.5) * 2; pts.push([x, y, z]); }
      for (let k = 0; k < pts.length - 1; k++) addWire(lb.glow, pts[k], pts[k + 1], C.bolt, 0.12, 4);
      for (let f = 0; f < 3; f++) {
        const k0 = 1 + Math.floor(rb() * (pts.length - 3)); let q = pts[k0].slice();
        for (let s = 0; s < 4; s++) { const nq = [q[0] + (rb() - 0.5) * 4, q[1] - 1.5 - rb() * 2, q[2] + (rb() - 0.5) * 3]; addWire(lb.glow, q, nq, C.bolt, 0.06, 3); q = nq; }
      }
    }
  }
  g.userData.flash = 0;
  finalize(g, P, p, C, {
    emitters, glowMat,
    tick: (t) => {
      let flash = 0;
      if (p.lightning) {
        const k = Math.floor(t / p.flashInterval), ph = t - k * p.flashInterval, which = k % 3;
        const on = ph < 0.08 || (ph > 0.16 && ph < 0.22) || (ph > 0.3 && ph < 0.34);
        for (let b = 0; b < 3; b++) { const o = g.getObjectByName(`bolt-${b + 1}`); if (o) o.visible = on && b === which; }
        flash = on ? 1 : Math.max(0, 1 - (ph - 0.34) * 4) * (ph < 0.6 ? 0.4 : 0);
        if (glowMat) glowMat.color.setScalar(1.6 + flash);
      }
      g.userData.flash = flash;
    },
  });
  for (let b = 0; b < 3; b++) { const o = g.getObjectByName(`bolt-${b + 1}`); if (o) o.visible = false; }
  return g;
}
export default createAsset;
