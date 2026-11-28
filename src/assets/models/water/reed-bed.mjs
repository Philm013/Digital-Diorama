/*
 * REED BED (High Detail)
 * A parametric low-poly model for three.js: one import, no loader, no textures, merged draw calls.
 * A lakeshore reed bed in a cut-away diorama: a muddy bank shelving into shallow water, dense
 * stands of feathery-plumed common reed, cattails with brown seed heads, dark rushes and yellow
 * flag irises, all bending in the wind. Reeds thin out into deeper water, ripple rings spread from
 * stems and from rising fish, and a red-winged blackbird clings to a swaying cattail.
 *
 * QUICK START
 *   import { createAsset } from './reed-bed.mjs';
 *   const asset = createAsset({ mergeForProduction: true });
 *   scene.add(asset);
 *   renderer.setAnimationLoop((ms) => asset.userData.update(ms / 1000));   // water, particles, rigs
 *   // the bank rises toward −Z; water level is waterLevel above the asset origin
 *
 * PARAMETERS
 *   mergeForProduction  on/off (default off) — Merge for Production
 *   colorway            default | autumn | spring | winter | lush — Theme
 *   width               3–30 m (default 10) — Width
 *   depth               3–20 m (default 7) — Depth
 *   density             0.2–3 (default 1) — Density
 *   height              0.8–3.5 m (default 2.2) — Height
 *   mix                 mixed | phragmites | cattail | rush — Plants
 *   irises              on/off (default on) — Yellow Flags
 *   wind                0–1 (default 0.4) — Wind
 *   waterLevel          0–0.6 m (default 0.2) — Water Level
 *   showBird            on/off (default on) — Blackbird
 *   base                on/off (default on) — Bank & Water
 *   seed                1–999 (default 8) — Seed
 *   reed                colour (default #8a9a4a) — Reed Colour
 *   reedDark            colour (default #6a7a3a) — Reed Dark Colour
 *   plume               colour (default #b8a080) — Plume Colour
 *   cattail             colour (default #5a3a24) — Cattail Colour
 *   rush                colour (default #3f6a34) — Rush Colour
 *   iris                colour (default #f2d23a) — Iris Colour
 *   irisLeaf            colour (default #4f8a3a) — Iris Leaf Colour
 *   mud                 colour (default #5a4a34) — Mud Colour
 *   mudWet              colour (default #463826) — Mud Wet Colour
 *   grass               colour (default #7a9a4a) — Grass Colour
 *   soil                colour (default #4a3a2a) — Soil Colour
 *   water               colour (default #4a7a6a) — Water Colour
 *   deep                colour (default #22443a) — Deep Colour
 *   foam                colour (default #eef6f0) — Foam Colour
 *   bird                colour (default #1e1e22) — Bird Colour
 *   epaulet             colour (default #d8342a) — Epaulet Colour
 *
 * SPECS  5,386 triangles at defaults, 3 materials, 4 draw calls when merged,
 *        10.1 x 4.5 x 7.2 m (W x H x D, real-world scale).
 * PARTS animate: water shader, particles
 *        detach: reeds, irises
 * API    userData.update(t) · setRig(name, value | null) · setNight(0..1) · params · zones · triangles
 *        userData.surface.heightAt(x, z, t) · userData.drape(heightAt, keep?) — with Bank & Water off, every clump settles on a real shore; keep(x, z, y, 'reed' | 'iris') culls dry or deep spots
 *
 * LICENSE  MIT — free for personal and commercial use, modification and redistribution; keep this header.
 */

import * as THREE from 'three';
import {
  rng, hash2, fbm2, smooth, lerp, mixC, heightField, dioramaSkirt, makeWaterMaterial, waterify, waterGrid,
  makeSwayMaterial, swayify, anchorMark, anchorTag, partsBag, makeSurface, bindModule
} from './kit.mjs';

const BASE = {
  reed: '#8a9a4a', reedDark: '#6a7a3a', plume: '#b8a080', cattail: '#5a3a24', rush: '#3f6a34', iris: '#f2d23a', irisLeaf: '#4f8a3a', mud: '#5a4a34', mudWet: '#463826', grass: '#7a9a4a', soil: '#4a3a2a',
  water: '#4a7a6a', deep: '#22443a', foam: '#eef6f0', bird: '#1e1e22', epaulet: '#d8342a',
};
export const COLORWAYS = {
  'default': { ...BASE },
  autumn: { ...BASE, reed: '#b8a060', reedDark: '#9a8a4a', plume: '#d8c8a0', grass: '#a89a5a', rush: '#7a7a3a', irisLeaf: '#8a8a4a' },
  spring: { ...BASE, reed: '#8ac04a', reedDark: '#6aa03a', grass: '#8ac05a', rush: '#4f8a3a' },
  winter: { ...BASE, reed: '#c8b890', reedDark: '#a89878', plume: '#e8e0d0', grass: '#b8b0a0', rush: '#8a8a6a', irisLeaf: '#9a9a7a', water: '#6a8a90', deep: '#3a5a60' },
  lush: { ...BASE, reed: '#5a9a3a', reedDark: '#3f7a2f', water: '#3a6a5a', deep: '#1f3a32' },
};
// the kit's colour, parameter and assembly helpers, bound to this module's own tables
const { zonesFor, colorOverrides, baseParams, zoneParams, resolveParams, finalize } =
  bindModule({ BASE, COLORWAYS, params: () => params, rig: () => rig });
export const presets = COLORWAYS;
export const params = {
  ...baseParams(),
  width: { type: 'range', default: 10, min: 3, max: 30, step: 0.5, unit: 'm', label: 'Width', affects: 'geometry', describe: 'Diorama width (X).' },
  depth: { type: 'range', default: 7, min: 3, max: 20, step: 0.5, unit: 'm', label: 'Depth', affects: 'geometry', describe: 'Diorama depth (Z), bank to open water.' },
  density: { type: 'range', default: 1, min: 0.2, max: 3, step: 0.05, label: 'Density', affects: 'geometry', describe: 'Stems per square metre (scaled).' },
  height: { type: 'range', default: 2.2, min: 0.8, max: 3.5, step: 0.05, unit: 'm', label: 'Height', affects: 'geometry', describe: 'Typical stem height.' },
  mix: { type: 'choice', default: 'mixed', options: ['mixed', 'phragmites', 'cattail', 'rush'], label: 'Plants', affects: 'geometry', describe: 'Species mix.' },
  irises: { type: 'toggle', default: true, label: 'Yellow Flags', affects: 'geometry', describe: 'Flowering irises along the bank.' },
  wind: { type: 'range', default: 0.4, min: 0, max: 1, step: 0.05, label: 'Wind', affects: 'geometry', describe: 'How hard the reeds bend.' },
  waterLevel: { type: 'range', default: 0.2, min: 0, max: 0.6, step: 0.01, unit: 'm', label: 'Water Level', affects: 'geometry', describe: 'Water height (the bank floods as it rises).' },
  showBird: { type: 'toggle', default: true, label: 'Blackbird', affects: 'geometry', describe: 'Red-winged blackbird on a cattail.' },
  base: { type: 'toggle', default: true, label: 'Bank & Water', affects: 'geometry', describe: 'Own muddy bank and shallow water. Off: the plants alone, spread evenly, to drape along another asset’s shore (userData.drape culls clumps that land on dry ground or in deep water).' },
  seed: { type: 'range', default: 8, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Variation seed.' },
  ...zoneParams(),
};
export const rig = {};
export const detach = ['reeds', 'irises'];
export const night = {};

export function createAsset(userParams = {}) {
  const p = resolveParams(userParams);
  const C = zonesFor(p.colorway, colorOverrides(userParams, p.colorway));
  const g = new THREE.Group();
  g.name = 'reed-bed';
  const P = partsBag();
  const W = p.width, D = p.depth, wl = p.waterLevel, Hh = p.height, r = rng(p.seed);
  const h = (x, z) => !p.base ? 0 : lerp(0.75, -0.45, smooth(-D / 2, D * 0.3, z + 0.6 * Math.sin(x * 0.4 + p.seed))) + 0.1 * (fbm2(x * 0.3, z * 0.3, p.seed) - 0.5);
  const nx = Math.round(W / 0.35), nz = Math.round(D / 0.35);
  if (p.base) P.solid.push({ g: heightField(W, D, nx, nz, h, (x, y) => (y > wl + 0.25 ? C.grass : y > wl - 0.05 ? C.mud : C.mudWet)), c: null, n: 'bank' });
  if (p.base) dioramaSkirt(P.solid, P.water, W, D, nx, nz, h, -1.4, [C.mud, C.soil, C.soil], () => wl, mixC(C.water, C.deep, 0.5).getHex());
  const sea = waterify(waterGrid(W, D, Math.round(W / 0.6), Math.round(D / 0.55), wl), (x, y, z) => ({ s: x, u: z, speed: 0.1, foam: 0.02 + 0.3 * smooth(0.12, 0, wl - h(x, z)), ripple: 1, ocean: 0.4, color: mixC(C.water, C.deep, smooth(0, 0.6, wl - h(x, z))) }));
  if (p.base) P.water.push({ g: sea, c: null, n: 'water' });
  // Reeds: dense where water is shallow / bank is wet, thinning into deep water
  const reeds = P.sub('reeds', [0, 0, 0]), sp = [], anchors = [];
  const clumps = Math.round(W * D * 0.45 * p.density);
  let birdStem = null;
  for (let c = 0; c < clumps; c++) {
    const x = (r() - 0.5) * W * 0.96, z = (r() - 0.5) * D * 0.96, y0 = h(x, z), dw = wl - y0;
    if (p.base && r() > Math.exp(-Math.pow((dw - 0.1) / 0.35, 2))) continue;
    const mk = anchorMark(reeds), ai = anchors.length;
    anchors.push([x, z, 'reed']);
    const kind = p.mix === 'mixed' ? ['phragmites', 'phragmites', 'cattail', 'rush'][Math.floor(r() * 4)] : p.mix, nS = 5 + Math.floor(r() * 7), ph = x * 0.4 + z * 0.3;
    for (let s = 0; s < nS; s++) {
      const sx = x + (r() - 0.5) * 0.5, sz = z + (r() - 0.5) * 0.5, sy = h(sx, sz), ht = Hh * (0.6 + r() * 0.5) * (kind === 'rush' ? 0.55 : 1), tilt = (r() - 0.5) * 0.12, rot = r() * 6.28, phs = ph + s * 0.2;
      const put = (geo, col, n) => reeds.sway.push({ g: swayify(geo.rotateZ(tilt).rotateY(rot).translate(sx, sy, sz), phs, sy, sy + ht), c: col, n });
      put(new THREE.ConeGeometry(kind === 'rush' ? 0.008 : 0.012, ht, 3, 1).translate(0, ht / 2, 0), kind === 'rush' ? C.rush : s % 2 ? C.reed : C.reedDark, 'stem');
      if (kind === 'phragmites') {
        for (let l = 0; l < 2; l++) { const ly = ht * (0.35 + l * 0.25), la = l * 2.4; put(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, ly, 0, Math.cos(la) * 0.4, ly + 0.12, Math.sin(la) * 0.4, Math.cos(la) * 0.02, ly + 0.05, Math.sin(la) * 0.02 + 0.02], 3)), C.reed, 'leaf'); }
        put(new THREE.ConeGeometry(0.06, 0.32, 5).rotateZ(0.5).translate(0.06, ht - 0.05, 0), C.plume, 'plume');
      } else if (kind === 'cattail') {
        put(new THREE.CapsuleGeometry(0.022, 0.2, 2, 6).translate(0, ht * 0.8, 0), C.cattail, 'head');
        for (let l = 0; l < 2; l++) { const la = l * 3.1 + 0.5; put(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0.1, 0, Math.cos(la) * 0.22, ht * 0.95, Math.sin(la) * 0.22, Math.cos(la) * 0.02 + 0.02, 0.1, Math.sin(la) * 0.02], 3)), C.reedDark, 'blade'); }
        if (!birdStem && p.showBird && Math.abs(sz) < D * 0.3 && (dw > 0 || !p.base)) birdStem = { x: sx, y: sy + ht * 0.92, z: sz, ph: phs, y0: sy, ht, tilt, rot, ai };
      }
    }
    anchorTag(reeds, mk, ai);
    if (sp.length < 4 && dw > 0.05) sp.push([x, z]);
  }
  // Red-winged blackbird clinging to a cattail (shares that stem's sway so it rides it)
  if (birdStem) {
    const b = birdStem, bp = [], mkB = anchorMark(reeds);
    bp.push([new THREE.IcosahedronGeometry(1, 1).scale(0.035, 0.035, 0.07).rotateX(-0.6), C.bird]);
    bp.push([new THREE.SphereGeometry(0.025, 8, 6).translate(0, 0.045, 0.045), C.bird]);
    bp.push([new THREE.ConeGeometry(0.009, 0.03, 5).rotateX(Math.PI / 2).translate(0, 0.045, 0.078), C.bird]);
    bp.push([new THREE.BoxGeometry(0.03, 0.006, 0.07).rotateX(0.7).translate(0, -0.035, -0.06), C.bird]);
    for (const s of [-1, 1]) bp.push([new THREE.BoxGeometry(0.012, 0.018, 0.03).translate(s * 0.034, 0.012, 0.012), C.epaulet]);
    for (const [geo, col] of bp) {
      const gg = geo.translate(0.045, 0, 0).rotateZ(b.tilt).rotateY(b.rot).translate(b.x, b.y, b.z);
      const pa = gg.attributes.position, sw = new Float32Array(pa.count * 2);
      for (let i = 0; i < pa.count; i++) { sw[i * 2] = 0.92; sw[i * 2 + 1] = b.ph; }
      gg.setAttribute('aSway', new THREE.BufferAttribute(sw, 2));
      reeds.sway.push({ g: gg, c: col, n: 'blackbird' });
    }
    anchorTag(reeds, mkB, b.ai);
  }
  // Yellow flag irises along the waterline
  if (p.irises) {
    const ir = P.sub('irises', [0, 0, 0]);
    for (let c = 0; c < Math.round(W * 1.2); c++) {
      const x = (r() - 0.5) * W * 0.95;
      let z = -D / 2, best = 9;
      if (!p.base) { z = (r() - 0.5) * D * 0.9; best = 0; }
      else for (let k = 0; k < 24; k++) { const zz = -D / 2 + (k / 23) * D, d = Math.abs(h(x, zz) - wl - 0.08); if (d < best) { best = d; z = zz; } }
      z += (r() - 0.5) * 0.4;
      const y0 = h(x, z), ph = x * 0.5, mkI = anchorMark(ir), ai = anchors.length;
      anchors.push([x, z, 'iris']);
      for (let l = 0; l < 6; l++) { const a = (l / 6) * Math.PI * 2 + r(), ht = 0.6 + r() * 0.4; ir.sway.push({ g: swayify(new THREE.ConeGeometry(0.03, ht, 3).scale(1, 1, 0.2).translate(0, ht / 2, 0).rotateZ(0.15).rotateY(a).translate(x, y0, z), ph, y0, y0 + ht), c: C.irisLeaf, n: 'leaf' }); }
      if (r() < 0.75) {
        const fy = y0 + 0.75 + r() * 0.2;
        ir.sway.push({ g: swayify(new THREE.CylinderGeometry(0.008, 0.008, fy - y0, 4).translate(x, (fy + y0) / 2, z), ph, y0, fy), c: C.irisLeaf, n: 'stalk' });
        for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; ir.sway.push({ g: swayify(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([x, fy, z, x + Math.cos(a) * 0.09, fy - 0.04, z + Math.sin(a) * 0.09, x + Math.cos(a + 0.6) * 0.05, fy + 0.02, z + Math.sin(a + 0.6) * 0.05], 3)), ph, y0, fy), c: C.iris, n: 'petal' }); }
      }
      anchorTag(ir, mkI, ai);
    }
  }
  const ripples = p.base ? sp.map(([x, z]) => [x, z, -0.5, 0.004]) : [];
  const waterMat = makeWaterMaterial({ waves: [[1, 0.2, 0.06, 2.2], [0.3, 1, 0.04, 1.4]], waveAmp: 0.4 + p.wind, opacity: 0.84, foam: C.foam, streakAlong: 0.5, streakAcross: 1.2, roughness: 0.08, ripples });
  const swayMat = makeSwayMaterial({ amp: 0.06 + p.wind * 0.3, freq: 1.0 + p.wind * 1.2, dir: [1, 0.25] });
  const U = waterMat.userData.uniforms, base = ripples.length;
  let next = 2, slot = 0;
  g.userData.view = { target: [0, wl + Hh * 0.3, 0], radius: Math.max(W, D) * 1.2 };
  finalize(g, P, p, C, {
    waterMat: p.base ? waterMat : null, swayMat, drape: p.base ? null : anchors,
    tick: (t) => {
      if (p.base && t > next && base < 8) {
        const x = (hash2(t, 1, 3) - 0.5) * W * 0.9, z = (hash2(t, 2, 3) - 0.5) * D * 0.9;
        if (h(x, z) < wl - 0.15) { U.uRip.value[base + (slot % (8 - base))].set(x, z, t, 0.014); U.uRipCount.value = 8; slot++; }
        next = t + 1.5 + hash2(t, 3, 3) * 3;
      }
    },
  });
  if (p.base) g.userData.surface = makeSurface(g, (lx, lz) => (h(lx, lz) < wl && Math.abs(lx) <= W / 2 && Math.abs(lz) <= D / 2 ? wl : null));
  return g;
}
export default createAsset;
