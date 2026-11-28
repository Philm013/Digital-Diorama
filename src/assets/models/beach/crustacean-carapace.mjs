/**
 * CRAB MOLT / HORSESHOE CRAB (High Detail). License: MIT.
 * QUICK START: import { createAsset } from './crustacean-carapace.mjs';
 * scene.add(createAsset({ carapaceType: 'blue-crab', mergeForProduction: true }));
 * SPECS: blue crab 0.28 x 0.055 x 0.20 m; horseshoe 0.23 x 0.06 x 0.39 m.
 * BUDGET: approximately 7,000 triangles. A genuinely hollow shell canopy.
 * OPTIONS: carapaceType, spikeSharpness, jointAngle.
 * RIG / DETACH: telsonSpike, crabClaw, carapace, walkingLegs, sandCaking.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const BASE = { shell: '#b88d72', ridge: '#d8b59a', interior: '#ded0b4', accent: '#7b8e83' };
export const COLORWAYS = { default: { ...BASE }, gothic: { shell: '#837b7d', ridge: '#b0a4a2', interior: '#d3cac0', accent: '#555666' }, pacific: { shell: '#ac6b4d', ridge: '#d79a70', interior: '#cbb4a0', accent: '#6d6672' }, bioluminescent: { shell: '#a679b1', ridge: '#deb0d5', interior: '#b0eadd', accent: '#6e7eb7' } };
export const presets = COLORWAYS;
export const params = { mergeForProduction: { type: 'toggle', default: false, label: 'Merge for production', affects: 'geometry', describe: 'Bake poses per material or preserve named appendages.' }, colorway: { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Colorway', affects: 'colors', describe: 'Curated coastal palette.' }, carapaceType: { type: 'choice', default: 'blue-crab', options: ['blue-crab', 'horseshoe'], label: 'Carapace type', affects: 'geometry', describe: 'Rebuild the exoskeleton as a blue crab or horseshoe crab.' }, spikeSharpness: { type: 'range', default: 0.62, min: 0.1, max: 1, step: 0.01, label: 'Spine sharpness', affects: 'geometry', describe: 'Length of marginal carapace spines.' }, jointAngle: { type: 'range', default: 24, min: -20, max: 65, step: 1, label: 'Joint angle', affects: 'geometry', describe: 'Reconstruct the segmented leg pose in degrees.' }, shell: { type: 'color', default: BASE.shell, label: 'Carapace', affects: 'colors', describe: 'Dorsal exoskeleton.' }, ridge: { type: 'color', default: BASE.ridge, label: 'Edges', affects: 'colors', describe: 'Sun-bleached edges.' }, interior: { type: 'color', default: BASE.interior, label: 'Interior', affects: 'colors', describe: 'Hollow shell lining.' }, accent: { type: 'color', default: BASE.accent, label: 'Claws', affects: 'colors', describe: 'Leg and claw pigment.' } };
export const rig = { telsonSpike: { axis: 'x', range: [-25, 35], describe: 'Tail hinge in degrees.' }, crabClaw: { axis: 'y', range: [0, 40], describe: 'Open the movable claw pincer, degrees.' } };
export const detach = ['carapace', 'walkingLegs', 'telsonSpike', 'crabClaw', 'sandCaking'];
export const night = { ridge: { color: '#a2e1dd', intensity: 0.3, distance: 0.2, describe: 'Calcified edge fluorescence.' } };
const hexOf = v => typeof v === 'number' && Number.isFinite(v) ? v & 0xffffff : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : null;
function zonesFor(name, o = {}) { const cw = COLORWAYS[name] || COLORWAYS.default, used = new Set(), out = {}; for (const k of Object.keys(BASE)) { let h = hexOf(o[k]) ?? hexOf(cw[k]); while (used.has(h)) h = (h + 1) & 0xffffff; used.add(h); out[k] = h; } return out; }
function prep(g, hex) { if (g.index) { const old = g; g = g.toNonIndexed(); old.dispose(); } g.deleteAttribute('uv'); g.deleteAttribute('normal'); const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.66, side: THREE.DoubleSide });
function finish(list, material = MAT, name = 'solid', merge = true) { if (!list.length) return null; if (merge) { const src = list.map(p => prep(p.g, p.c)), geo = mergeGeometries(src); src.forEach(g => g.dispose()); if (!geo) return null; geo.computeVertexNormals(); const m = new THREE.Mesh(geo, material); m.name = name; m.castShadow = m.receiveShadow = true; return m; } const root = new THREE.Group(); root.name = name; const groups = {}; list.forEach((p, i) => { const geo = prep(p.g, p.c); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, material); m.name = `${p.n || name}_part_${i + 1}`; m.castShadow = m.receiveShadow = true; if (p.n) { if (!groups[p.n]) { groups[p.n] = new THREE.Group(); groups[p.n].name = p.n; root.add(groups[p.n]); } groups[p.n].add(m); } else root.add(m); }); return root; }
function addCylinder(parts, rt, rb, h, seg, x, y, z, rx = 0, ry = 0, rz = 0, c = BASE.shell, n = 'carapace') { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); parts.push({ g, c, n }); }
export function createAsset(userParams = {}) {
  const p = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.default])); Object.assign(p, userParams); const C = zonesFor(p.colorway, userParams), root = new THREE.Group(), parts = [], horse = p.carapaceType === 'horseshoe'; root.name = 'crustacean-carapace';
  const point = (t, a, inner) => { const width = horse ? 0.106 : 0.072, depth = horse ? 0.105 : 0.052, edge = 1 + (horse ? 0.02 : 0.055) * Math.sin(a * 14) * Math.pow(Math.sin(t), 8); return [Math.cos(a) * (width - inner * 0.002) * Math.sin(t) * edge, 0.008 + (horse ? 0.048 : 0.032) * Math.cos(t) - inner * 0.002, Math.sin(a) * (depth - inner * 0.002) * Math.sin(t)]; };
  for (let inner = 0; inner < 2; inner++) for (let i = 0; i < 18; i++) { const vertices = []; for (let j = 0; j < 64; j++) { const a = j / 64 * Math.PI * 2, b = (j + 1) / 64 * Math.PI * 2, t = i / 18 * Math.PI / 2, u = (i + 1) / 18 * Math.PI / 2; vertices.push(...point(t, a, inner), ...point(u, a, inner), ...point(u, b, inner), ...point(t, a, inner), ...point(u, b, inner), ...point(t, b, inner)); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); parts.push({ g, c: inner ? C.interior : i === 17 ? C.ridge : C.shell, n: 'carapace' }); }
  if (horse) {
    addCylinder(parts, 0.0002, 0.009, 0.18, 8, 0, 0.014, -0.17, -Math.PI / 2, 0, 0, C.shell, 'telsonSpike');
    for (let s of [-1, 1]) for (let i = 0; i < 6; i++) addCylinder(parts, 0, 0.004, 0.007 + p.spikeSharpness * 0.012, 5, s * (0.07 - i * 0.006), 0.012, -0.07 - i * 0.007, -0.5, 0, s * -1.0, C.ridge, 'carapace');
  } else {
    // Every appendage originates from the carapace's own rim curve (t = PI/2)
    // at a matching angle, so legs and claws visibly emerge from the shell
    // edge instead of floating disconnected in space.
    const edge = a => point(Math.PI / 2, a, 0);
    const legAngle = (i, s) => { const base = -0.06 * Math.PI - i * 0.12 * Math.PI; return s > 0 ? base : Math.PI - base; };
    for (let s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const a = p.jointAngle * Math.PI / 180, root = edge(legAngle(i, s));
      const outDir = new THREE.Vector3(Math.cos(legAngle(i, s)), 0, Math.sin(legAngle(i, s)));
      const points = [
        new THREE.Vector3(root[0], root[1] - 0.003, root[2]),
        new THREE.Vector3(root[0] + outDir.x * 0.036, root[1] + 0.011, root[2] + outDir.z * 0.036),
        new THREE.Vector3(root[0] + outDir.x * (0.066 + Math.sin(a) * 0.013), root[1] + 0.006, root[2] + outDir.z * (0.066 + Math.sin(a) * 0.013)),
        new THREE.Vector3(root[0] + outDir.x * 0.094, root[1] - 0.011, root[2] + outDir.z * 0.094)
      ];
      const curve = new THREE.CatmullRomCurve3(points);
      parts.push({ g: new THREE.TubeGeometry(curve, 18, 0.0027, 6, false), c: C.accent, n: 'walkingLegs' });
      for (let k = 1; k < 3; k++) parts.push({ g: new THREE.SphereGeometry(0.0038, 8, 6).translate(...points[k].toArray()), c: C.ridge, n: 'walkingLegs' });
    }
    const clawAngle = s => s > 0 ? 0.32 * Math.PI : Math.PI - 0.32 * Math.PI;
    for (const s of [-1, 1]) {
      const a = clawAngle(s), root = edge(a), outDir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const armEnd = new THREE.Vector3(root[0] + outDir.x * 0.05, root[1] + 0.014, root[2] + outDir.z * 0.05);
      const pincerBase = new THREE.Vector3(root[0] + outDir.x * 0.078, root[1] + 0.009, root[2] + outDir.z * 0.078);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(root[0], root[1] - 0.002, root[2]), armEnd, pincerBase]);
      parts.push({ g: new THREE.TubeGeometry(curve, 16, 0.0058, 8, false), c: C.accent, n: 'walkingLegs' });
      parts.push({ g: new THREE.SphereGeometry(0.013, 14, 8).scale(0.85, 0.65, 1.4).translate(pincerBase.x + outDir.x * 0.006, pincerBase.y, pincerBase.z + outDir.z * 0.006), c: C.shell, n: 'walkingLegs' });
      for (const side of [-1, 1]) { const tip = new THREE.Vector3(pincerBase.x + outDir.x * 0.026 + side * outDir.z * 0.01, pincerBase.y + 0.004, pincerBase.z + outDir.z * 0.026 - side * outDir.x * 0.01); const claw = new THREE.CatmullRomCurve3([pincerBase.clone().addScaledVector(outDir, 0.01), tip.clone().lerp(pincerBase, 0.4), tip]); parts.push({ g: new THREE.TubeGeometry(claw, 12, 0.003, 6, false), c: C.ridge, n: side < 0 ? 'crabClaw' : 'walkingLegs' }); }
    }
    for (const s of [-1, 1]) { const a = s > 0 ? 0.42 * Math.PI : Math.PI - 0.42 * Math.PI, root = edge(a), outDir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); addCylinder(parts, 0, 0.0062, 0.014 + p.spikeSharpness * 0.016, 6, root[0], root[1] + 0.006, root[2], 0, 0, s * -Math.PI / 2.4, C.ridge, 'carapace'); parts.push({ g: new THREE.SphereGeometry(0.0034, 8, 6).translate(root[0] + outDir.x * 0.016, root[1] + 0.009, root[2] + outDir.z * 0.016), c: '#20201c', n: 'carapace' }); }
  }
  for (let i = 0; i < 14; i++) parts.push({ g: new THREE.IcosahedronGeometry(0.0008).translate(Math.sin(i * 2.4) * 0.027, 0.01, 0.047 + Math.cos(i * 4.1) * 0.003), c: C.interior, n: 'sandCaking' });
  const solid = finish(parts, MAT, 'solid', p.mergeForProduction); if (solid) root.add(solid);
  if (!p.mergeForProduction) { const tail = root.getObjectByName('telsonSpike'); if (tail) { tail.position.z = -0.08; tail.children.forEach(m => m.geometry.translate(0, 0, 0.08)); } const claw = root.getObjectByName('crabClaw'); if (claw) { claw.position.z = 0.09; claw.children.forEach(m => m.geometry.translate(0, 0, -0.09)); } }
  root.userData = { params: p, zones: C, rig, detach, night, units: 'meters' }; return root;
}
export default createAsset;