/*
 * RAINBOW (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * Sunlight refracted through raindrops: a primary bow (red outside, violet inside, ≈42°) and an
 * optional fainter secondary bow with reversed colours (≈51°). The arc tapers at its feet, can
 * billboard toward the camera, fades away at night or turns into a pale moonbow.
 *
 * QUICK START
 *   import { createAsset } from './rainbow.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   rainbow.userData.camera = camera;   // with billboard on, it keeps facing the viewer
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | pastel | vivid | moonbow — Theme
 *   radius              5–300 m (default 40) — Radius
 *   arc                 0.2–1 (default 0.85) — Visible Arc
 *   bandWidth           0.02–0.14 (default 0.06) — Band Width
 *   opacity             0.1–0.95 (default 0.55) — Opacity
 *   secondary           on/off (default on) — Secondary Bow
 *   billboard           on/off (default on) — Face Camera
 *   moonbowAtNight      on/off (default off) — Moonbow at Night
 *   red                 colour (default #ff3b30) — Red Colour
 *   orange              colour (default #ff9500) — Orange Colour
 *   yellow              colour (default #ffd60a) — Yellow Colour
 *   green               colour (default #34c759) — Green Colour
 *   blue                colour (default #0a84ff) — Blue Colour
 *   indigo              colour (default #3f51b5) — Indigo Colour
 *   violet              colour (default #a259ff) — Violet Colour
 *
 * SPECS  1,792 triangles at defaults, 1 materials, 2 draw calls when merged,
 *        98.8 x 43.5 x 0.0 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: primary, secondary
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import { lerp, partsBag, makeGlowMaterial, bindModule } from './kit.mjs';

const BASE = { red: '#ff3b30', orange: '#ff9500', yellow: '#ffd60a', green: '#34c759', blue: '#0a84ff', indigo: '#3f51b5', violet: '#a259ff' };
export const COLORWAYS = {
  'default': { ...BASE },
  pastel: { red: '#ff9a9a', orange: '#ffc48a', yellow: '#fff09a', green: '#a8e8a8', blue: '#9ac8ff', indigo: '#a8a8e8', violet: '#d0a8ff' },
  vivid: { red: '#ff0040', orange: '#ff7a00', yellow: '#ffe600', green: '#00d84a', blue: '#0066ff', indigo: '#4b00ff', violet: '#c000ff' },
  moonbow: { red: '#e8e2f0', orange: '#ece8f2', yellow: '#f2f0f4', green: '#e6f0ee', blue: '#e2eaf6', indigo: '#e4e4f4', violet: '#ece4f6' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  radius: { type: 'range', default: 40, min: 5, max: 300, step: 1, unit: 'm', label: 'Radius', affects: 'geometry', describe: 'Radius of the primary bow.' },
  arc: { type: 'range', default: 0.85, min: 0.2, max: 1, step: 0.05, label: 'Visible Arc', affects: 'geometry', describe: 'Fraction of the half-circle above the horizon.' },
  bandWidth: { type: 'range', default: 0.06, min: 0.02, max: 0.14, step: 0.005, label: 'Band Width', affects: 'geometry', describe: 'Total width of the colour band relative to the radius.' },
  opacity: { type: 'range', default: 0.55, min: 0.1, max: 0.95, step: 0.05, label: 'Opacity', affects: 'colors', describe: 'Brightness / translucency.' },
  secondary: { type: 'toggle', default: true, label: 'Secondary Bow', affects: 'geometry', describe: 'Fainter outer bow with reversed colour order.' },
  billboard: { type: 'toggle', default: true, label: 'Face Camera', affects: 'geometry', describe: 'Turn (yaw) toward userData.camera every frame.' },
  moonbowAtNight: { type: 'toggle', default: false, label: 'Moonbow at Night', affects: 'colors', describe: 'Stay visible (pale) at night instead of fading out.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['primary', 'secondary'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'rainbow';
  const P = partsBag();
  const order = [C.red, C.orange, C.yellow, C.green, C.blue, C.indigo, C.violet];
  const bow = (name, R, colors, wScale) => {
    const sub = P.sub(name, [0, 0, 0]), bw = R * p.bandWidth * wScale, seg = 64, a0 = Math.PI * (1 - p.arc) / 2, a1 = Math.PI - a0;
    colors.forEach((hex, k) => {
      const v = [];
      for (let i = 0; i < seg; i++) {
        const t0 = i / seg, t1 = (i + 1) / seg, ta = lerp(a0, a1, t0), tb = lerp(a0, a1, t1);
        const taper = (t) => Math.min(1, Math.sin(Math.PI * t) * 3);
        const ri = (t) => R - bw / 2 + (bw / 7) * k * taper(t) + (bw / 2) * (1 - taper(t)), ro = (t) => ri(t) + (bw / 7) * taper(t);
        const P0 = (rr, a) => [Math.cos(a) * rr, Math.sin(a) * rr, 0];
        v.push(...P0(ri(t0), ta), ...P0(ro(t0), ta), ...P0(ro(t1), tb), ...P0(ri(t0), ta), ...P0(ro(t1), tb), ...P0(ri(t1), tb));
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      sub.glow.push({ g: geo, c: hex, n: 'band' });
    });
  };
  bow('primary', p.radius, [...order].reverse(), 1);
  if (p.secondary) bow('secondary', p.radius * 1.27, order, 1.35);
  const glowMat = makeGlowMaterial();
  glowMat.transparent = true; glowMat.depthWrite = false; glowMat.side = THREE.DoubleSide; glowMat.opacity = p.opacity;
  g.userData.view = { target: [0, p.radius * 0.45, 0], radius: p.radius * 2.6 };
  const tmp = new THREE.Vector3();
  finalize(g, P, p, C, {
    glowMat,
    onNight: (k) => { glowMat.color.setScalar(1); glowMat.opacity = p.opacity * (p.moonbowAtNight ? 1 - 0.6 * k : 1 - k); },
    tick: () => {
      const sec = g.getObjectByName('secondary'); if (sec) sec.traverse((o) => { if (o.material) o.renderOrder = 1; });
      const cam = g.userData.camera;
      if (p.billboard && cam && cam.getWorldPosition) { cam.getWorldPosition(tmp); g.updateWorldMatrix(true, false); const e = g.matrixWorld.elements; g.rotation.y = Math.atan2(tmp.x - e[12], tmp.z - e[14]); }
    },
  });
  return g;
}
export default createAsset;
