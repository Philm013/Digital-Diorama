/*
 * CAVE & DRIP POOL (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A limestone cave chamber opened like a diorama: stalactites hang from the vault, stalagmites
 * rise to meet them (some already fused into columns), flowstone curtains drape the walls and
 * rimstone dams ring a crystal-clear pool. Drops fall from the dripping tips and each impact
 * prints a ripple ring exactly when it lands. Glow-worms twinkle on the ceiling and calcite
 * crystals sparkle at the water's edge.
 *
 * QUICK START
 *   import { createAsset } from './cave-pool.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // the cut-away faces +Z; `opening` sets how much of the dome is removed
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | iceCave | lavaTube | crystal | ochre — Theme
 *   size                8–30 m (default 16) — Chamber Diameter
 *   height              3–14 m (default 7) — Vault Height
 *   opening             0.15–0.6 (default 0.32) — Cut-away Opening
 *   stalactites         0–80 (default 30) — Stalactites
 *   columns             0–8 (default 3) — Columns
 *   drips               0–8 (default 5) — Dripping Tips
 *   poolSize            0.2–0.7 (default 0.45) — Pool Size
 *   glowworms           on/off (default on) — Glow-worms
 *   diorama             on/off (default on) — Diorama Base
 *   crystals            on/off (default on) — Crystals
 *   seed                1–999 (default 18) — Seed
 *   rock                colour (default #b8a88a) — Rock Colour
 *   rockDark            colour (default #8a7a62) — Rock Dark Colour
 *   rockLight           colour (default #d6c8a8) — Rock Light Colour
 *   flowstone           colour (default #e0cfa6) — Flowstone Colour
 *   tip                 colour (default #efe6cc) — Tip Colour
 *   mud                 colour (default #6a5a45) — Mud Colour
 *   water               colour (default #4fb8c0) — Water Colour
 *   deep                colour (default #1f6f80) — Deep Colour
 *   foam                colour (default #ffffff) — Foam Colour
 *   crystal             colour (default #d8f0ff) — Crystal Colour
 *   glowworm            colour (default #7affd8) — Glowworm Colour
 *   soil                colour (default #5a4a38) — Soil Colour
 *
 * SPECS  9,513 triangles at defaults, 5 materials, 7 draw calls when merged,
 *        18.4 x 9.4 x 18.4 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: vault, formations, crystals, glowworms, drips
 *        night: glowworms
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  sweep, rng, hash2, noise2, fbm2, smooth, lerp, mixC, tint, faceTint, heightField, makeWaterMaterial, waterify,
  waterDisc, tileEdge, partsBag, makeEmitter, makeGlowMaterial, bindModule
} from './kit.mjs';

const BASE = {
  rock: '#b8a88a', rockDark: '#8a7a62', rockLight: '#d6c8a8', flowstone: '#e0cfa6', tip: '#efe6cc', mud: '#6a5a45',
  water: '#4fb8c0', deep: '#1f6f80', foam: '#ffffff', crystal: '#d8f0ff', glowworm: '#7affd8', soil: '#5a4a38',
};
export const COLORWAYS = {
  'default': { ...BASE },
  iceCave: { ...BASE, rock: '#9fd0e6', rockDark: '#6fb0d0', rockLight: '#d0ecf8', flowstone: '#b8e2f2', tip: '#ffffff', water: '#3fa8d0', crystal: '#ffffff', mud: '#5a7a8a' },
  lavaTube: { ...BASE, rock: '#4a4442', rockDark: '#2f2a28', rockLight: '#6a605a', flowstone: '#8a6a4a', tip: '#a88a6a', water: '#3f8f8a', mud: '#2a2420' },
  crystal: { ...BASE, rock: '#8a7a9a', rockDark: '#5f4f72', rockLight: '#b8a8c8', flowstone: '#c8b0d8', crystal: '#e8c8ff', water: '#6fa8d8', glowworm: '#c8a0ff' },
  ochre: { ...BASE, rock: '#c08a5a', rockDark: '#94643f', rockLight: '#dcae80', flowstone: '#e8c090', tip: '#f4dcc0' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  size: { type: 'range', default: 16, min: 8, max: 30, step: 1, unit: 'm', label: 'Chamber Diameter', affects: 'geometry', describe: 'Width of the cave chamber.' },
  height: { type: 'range', default: 7, min: 3, max: 14, step: 0.5, unit: 'm', label: 'Vault Height', affects: 'geometry', describe: 'Floor to ceiling.' },
  opening: { type: 'range', default: 0.32, min: 0.15, max: 0.6, step: 0.01, label: 'Cut-away Opening', affects: 'geometry', describe: 'Fraction of the dome removed on the +Z side.' },
  stalactites: { type: 'range', default: 30, min: 0, max: 80, step: 1, label: 'Stalactites', affects: 'geometry', describe: 'Number of hanging formations.' },
  columns: { type: 'range', default: 3, min: 0, max: 8, step: 1, label: 'Columns', affects: 'geometry', describe: 'Stalactites fused with stalagmites.' },
  drips: { type: 'range', default: 5, min: 0, max: 8, step: 1, label: 'Dripping Tips', affects: 'geometry', describe: 'Tips over the pool that drip (synchronised ripples).' },
  poolSize: { type: 'range', default: 0.45, min: 0.2, max: 0.7, step: 0.01, label: 'Pool Size', affects: 'geometry', describe: 'Pool radius relative to the chamber.' },
  glowworms: { type: 'toggle', default: true, label: 'Glow-worms', affects: 'geometry', describe: 'Bioluminescent dots on the ceiling.' },
  diorama: { type: 'toggle', default: true, label: 'Diorama Base', affects: 'geometry', describe: 'Cut-away base block. Off: the dome is buried in a rock mass (entrance left open on +Z) so the cave can sit in a hillside.' },
  crystals: { type: 'toggle', default: true, label: 'Crystals', affects: 'geometry', describe: 'Calcite crystal clusters at the pool edge.' },
  seed: { type: 'range', default: 18, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['vault', 'formations', 'crystals', 'glowworms', 'drips'];
export const night = { glowworms: { color: '#7affd8', intensity: 0.5, describe: 'Glow-worm light (always on; brighter at night).' } };

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'cave-pool';
  const P = partsBag();
  const R = p.size / 2, Hc = p.height, r = rng(p.seed), poolR = R * p.poolSize, pc = [-R * 0.1, -R * 0.05], wl = -0.05;
  const ceil = (x, z) => Hc * Math.sqrt(Math.max(0, 1 - (Math.hypot(x, z) / R) ** 2)) * (0.92 + 0.08 * noise2(x * 0.4, z * 0.4, p.seed));
  const f0 = p.opening;
  const h = (x, z) => {
    const d = Math.hypot(x - pc[0], (z - pc[1]) * 1.2) / poolR;
    let y = 0.15 * fbm2(x * 0.3, z * 0.3, p.seed, 3) + smooth(R * 0.75, R, Math.hypot(x, z)) * 1.2;
    if (d < 1.15) y = Math.min(y, lerp(wl - 1.2, y, smooth(0.6, 1.15, d)));
    if (!p.diorama) {
      // buried: rock mass round the dome, open in front of the entrance (+Z)
      const rr = Math.hypot(x, z), a = Math.abs(Math.atan2(x, z)), open = smooth(Math.PI * f0 + 0.3, Math.PI * f0 - 0.05, a);
      y = Math.max(y, smooth(R, R + 1.4, rr) * (1 - open) * Hc * (0.8 + 0.1 * fbm2(x * 0.2, z * 0.2, p.seed + 4, 3)));
    }
    return y;
  };
  const S = p.size * 1.15, n = Math.max(30, Math.round(S / 0.4));
  const terrainCol = (x, y, z, sl) => (y < wl ? C.mud : sl > 0.4 ? C.rockDark : noise2(x * 0.8, z * 0.8, p.seed) > 0.55 ? C.flowstone : C.rock);
  P.solid.push({ g: heightField(S, S, n, n, h, terrainCol), c: null, n: 'floor' });
  tileEdge(p, P.solid, P.water, S, S, n, n, h, -2.5, [C.rockDark, C.rock, C.rockDark], () => wl, C.deep);
  // Vault: partial lathe dome, roughened, banded
  const prof = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14, a = (t * Math.PI) / 2; prof.push(new THREE.Vector2(R * Math.cos(a) * (1 + 0.04 * Math.sin(i * 2.3)), Hc * Math.sin(a))); }
  const f = p.opening;
  const dome = new THREE.LatheGeometry(prof, 40, Math.PI * f, Math.PI * 2 * (1 - f)).toNonIndexed();
  const pa = dome.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), k = 1 + (hash2(Math.round(x * 30), Math.round(y * 30) * 1.3 + Math.round(z * 30) * 0.7, p.seed) - 0.5) * 0.12;
    pa.setXYZ(i, x * k, y * (0.97 + 0.06 * (k - 1)), z * k);
  }
  const vault = P.sub('vault', [0, 0, 0]);
  vault.solid.push({ g: faceTint(dome, (x, y) => [C.rock, C.rockLight, C.rockDark][Math.abs(Math.floor(y / 0.9)) % 3]), c: null, n: 'vault' });
  // Formations
  const form = P.sub('formations', [0, 0, 0]), tipsOverPool = [];
  const inOpen = (x, z) => { const a = Math.atan2(x, z); return Math.abs(a) < Math.PI * f + 0.15; };
  for (let i = 0; i < p.stalactites; i++) {
    let x, z, k = 0;
    do { const a = r() * 6.28, d = Math.sqrt(r()) * R * 0.85; x = Math.cos(a) * d; z = Math.sin(a) * d; k++; } while (inOpen(x, z) && k < 20);
    const cy = ceil(x, z), L = 0.4 + r() * Math.min(2.4, cy * 0.4), rb = 0.06 + L * 0.08;
    form.solid.push({ g: tint(new THREE.ConeGeometry(rb, L, 6).rotateX(Math.PI).translate(x, cy - L / 2 + 0.15, z), (px, py) => (py < cy - L * 0.7 ? C.tip : C.flowstone)), c: null, n: 'stalactite' });
    if (Math.hypot(x - pc[0], (z - pc[1]) * 1.2) < poolR * 0.85) tipsOverPool.push([x, cy - L + 0.15, z]);
    else if (r() < 0.45) { const y0 = h(x, z), Lm = 0.25 + r() * 1.2; form.solid.push({ g: new THREE.ConeGeometry(rb * 1.6, Lm, 7).translate(x, y0 + Lm / 2 - 0.05, z), c: C.flowstone, n: 'stalagmite' }); }
  }
  for (let i = 0; i < p.columns; i++) {
    const a = r() * 6.28, d = R * (0.45 + r() * 0.35), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (inOpen(x, z) || Math.hypot(x - pc[0], z - pc[1]) < poolR * 1.2) continue;
    const y0 = h(x, z), y1 = ceil(x, z) + 0.2;
    form.solid.push({ g: new THREE.LatheGeometry([[0.55, 0], [0.32, 0.25], [0.22, 0.5], [0.18, 0.75], [0.3, 0.9], [0.6, 1.0]].map((q) => new THREE.Vector2(q[0] * (0.8 + r() * 0.5), y0 + q[1] * (y1 - y0))), 8).translate(x, 0, z), c: C.flowstone, n: 'column' });
  }
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * f + 0.4 + r() * (Math.PI * 2 * (1 - f) - 0.8), x = Math.sin(a) * R * 0.93, z = Math.cos(a) * R * 0.93, y = Hc * (0.35 + r() * 0.3), L = 1.2 + r() * 1.5;
    const pts = []; for (let k = 0; k <= 8; k++) pts.push([x + Math.cos(a) * Math.sin(k * 1.4) * 0.12, y - (k / 8) * L, z - Math.sin(a) * Math.sin(k * 1.4) * 0.12]);
    form.solid.push({ g: sweep(pts, (t) => 0.22 * (1 - t * 0.8), 4, 8, false).scale(1, 1, 1), c: C.flowstone, n: 'drapery' });
  }
  // Rimstone dams around the pool
  for (let k = 0; k < 3; k++) form.solid.push({ g: new THREE.TorusGeometry(poolR * (1.02 + k * 0.12), 0.07, 3, 40, Math.PI * (1.1 + r() * 0.6)).rotateX(Math.PI / 2).rotateY(r() * 6).scale(1, 1, 1 / 1.2).translate(pc[0], wl + 0.03 + k * 0.05, pc[1]), c: C.flowstone, n: 'rimstone' });
  P.water.push({ g: waterify(waterDisc(poolR * 1.25, 9, wl, pc[0], pc[1]), (x, y, z) => ({ s: x, u: z, speed: 0, foam: 0, ripple: 1, color: mixC(C.water, C.deep, smooth(0, poolR, poolR - Math.hypot(x - pc[0], z - pc[1]))) })), c: null, n: 'pool' });
  if (p.crystals) {
    const cr = P.sub('crystals', [0, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const a = r() * 6.28, x = pc[0] + Math.cos(a) * poolR * 1.15, z = pc[1] + Math.sin(a) * poolR * 1.0, y = h(x, z);
      for (let k = 0; k < 6; k++) cr.glass.push({ g: new THREE.ConeGeometry(0.05 + r() * 0.05, 0.25 + r() * 0.4, 5).translate(0, 0.15, 0).rotateZ((r() - 0.5) * 1.2).rotateY(r() * 6).translate(x + (r() - 0.5) * 0.3, y, z + (r() - 0.5) * 0.3), c: C.crystal, n: 'crystal' });
    }
  }
  let glowMat = null;
  if (p.glowworms) {
    glowMat = makeGlowMaterial();
    const gw = P.sub('glowworms', [0, 0, 0]);
    for (let i = 0; i < 90; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * R * 0.88, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (inOpen(x, z)) continue;
      gw.glow.push({ g: new THREE.OctahedronGeometry(0.025, 0).translate(x, ceil(x, z) - 0.05, z), c: C.glowworm, n: 'glowworm' });
    }
  }
  // Drips: one particle per tip, phase known, so each impact fires a ripple at the right moment.
  const tips = tipsOverPool.slice(0, p.drips), drops = tips.map((q, i) => ({ q, life: 2.2 + ((i * 0.77) % 1) * 2.6, phase: ((i * 0.37) % 1), tf: Math.sqrt((2 * Math.max(0.05, q[1] - wl)) / 9.81) }));
  const emitters = [];
  if (drops.length) emitters.push(makeEmitter('drips', { count: drops.length, shape: 'drop', color: C.water, stretch: 0.08, floor: wl, seed: 1, spawn: (i) => ({ p: drops[i].q, v: [0, 0, 0], life: drops[i].life, phase: drops[i].phase, size: 0.035, rank: 0 }) }));
  const waterMat = makeWaterMaterial({ opacity: 0.62, foam: C.foam, roughness: 0.04, streakAlong: 0.4, streakAcross: 0.4 });
  const U = waterMat.userData.uniforms, fired = drops.map(() => -1);
  g.userData.view = { target: [0, Hc * 0.35, 0], radius: R * 2.6 };
  return finalize(g, P, p, C, {
    waterMat, glowMat, emitters, ground: { h, col: terrainCol, w: S, d: S },
    onNight: (k) => { if (glowMat) glowMat.color.setScalar(1.0 + 0.8 * k); },
    tick: (t) => {
      drops.forEach((d, i) => {
        const n = Math.floor((t + d.phase * d.life) / d.life), tImp = n * d.life - d.phase * d.life + d.tf;
        if (t >= tImp && fired[i] !== n) { fired[i] = n; U.uRip.value[i].set(d.q[0], d.q[2], tImp, 0.025); }
      });
      U.uRipCount.value = drops.length;
    },
  });
}
export default createAsset;
