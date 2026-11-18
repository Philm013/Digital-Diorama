/**
 * AUGER / TURRITELLA (High Detail). License: MIT.
 * QUICK START: import { createAsset } from './gastropod-auger.mjs';
 * scene.add(createAsset({ whorlCount: 12, mergeForProduction: true }));
 * SPECS: default 0.045 x 0.045 x 0.24 m; approximately 7,000 triangles.
 * OPTIONS: whorlCount, taperLength, ribbingIntensity, brokenTip.
 * RIG: brokenTip (Z separation). DETACH: shell, brokenTip, sandCaking.
 * A continuous tapered helicoidal shell with an open, lined axial cavity.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const BASE = { shell: '#e7d3b5', ridge: '#fff0d8', interior: '#ab8c75', accent: '#b88e6f' };
export const COLORWAYS = { default: { ...BASE }, gothic: { shell: '#dbd5c6', ridge: '#f0ecdf', interior: '#76727b', accent: '#9b9093' }, pacific: { shell: '#bba98a', ridge: '#e0d3bb', interior: '#645047', accent: '#947057' }, bioluminescent: { shell: '#8c81bd', ridge: '#b3f3e7', interior: '#594e8b', accent: '#be93da' } };
export const presets = COLORWAYS;
export const params = { mergeForProduction: { type: 'toggle', default: false, label: 'Merge for production', affects: 'geometry', describe: 'Merge geometry per material, or retain selectable whorls.' }, colorway: { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Colorway', affects: 'colors', describe: 'Curated palette.' }, whorlCount: { type: 'range', default: 11, min: 5, max: 20, step: 1, label: 'Whorl count', affects: 'geometry', describe: 'Number of complete helical turns.' }, taperLength: { type: 'range', default: 0.24, min: 0.1, max: 0.38, step: 0.005, label: 'Taper length', affects: 'geometry', describe: 'Total shell length in meters.' }, ribbingIntensity: { type: 'range', default: 0.65, min: 0, max: 1, step: 0.01, label: 'Ribbing', affects: 'geometry', describe: 'Height of fine axial ribs.' }, brokenTip: { type: 'toggle', default: false, label: 'Broken tip', affects: 'geometry', describe: 'Remove the last whorls and expose the hollow core.' }, shell: { type: 'color', default: BASE.shell, label: 'Shell', affects: 'colors', describe: 'Calcium color.' }, ridge: { type: 'color', default: BASE.ridge, label: 'Ridges', affects: 'colors', describe: 'Raised ribs.' }, interior: { type: 'color', default: BASE.interior, label: 'Interior', affects: 'colors', describe: 'Inner column.' }, accent: { type: 'color', default: BASE.accent, label: 'Bands', affects: 'colors', describe: 'Growth bands.' } };
export const rig = { brokenTip: { axis: 'z', range: [0, -0.05], describe: 'Separated tip translation in meters.' } };
export const detach = ['shell', 'brokenTip', 'sandCaking'];
export const night = { ridge: { color: '#98eadb', intensity: 0.15, distance: 0.1, describe: 'Luminous growth lines.' } };
const hexOf = v => typeof v === 'number' && Number.isFinite(v) ? v & 0xffffff : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : null;
function zonesFor(name, o = {}) { const cw = COLORWAYS[name] || COLORWAYS.default, used = new Set(), out = {}; for (const k of Object.keys(BASE)) { let h = hexOf(o[k]) ?? hexOf(cw[k]); while (used.has(h)) h = (h + 1) & 0xffffff; used.add(h); out[k] = h; } return out; }
function prep(g, hex) { if (g.index) { const old = g; g = g.toNonIndexed(); old.dispose(); } g.deleteAttribute('uv'); g.deleteAttribute('normal'); const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, side: THREE.DoubleSide });
function finish(list, material = MAT, name = 'solid', merge = true) { if (!list.length) return null; if (merge) { const src = list.map(p => prep(p.g, p.c)), geo = mergeGeometries(src); src.forEach(g => g.dispose()); if (!geo) return null; geo.computeVertexNormals(); const m = new THREE.Mesh(geo, material); m.name = name; m.castShadow = m.receiveShadow = true; return m; } const root = new THREE.Group(); root.name = name; const groups = {}; list.forEach((p, i) => { const geo = prep(p.g, p.c); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, material); m.name = `${p.n || name}_part_${i + 1}`; m.castShadow = m.receiveShadow = true; if (p.n) { if (!groups[p.n]) { groups[p.n] = new THREE.Group(); groups[p.n].name = p.n; root.add(groups[p.n]); } groups[p.n].add(m); } else root.add(m); }); return root; }
function box(w, h, d, x = 0, y = 0, z = 0) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }
function addCylinder(parts, rt, rb, h, seg, x, y, z, rx = 0, ry = 0, rz = 0, c = BASE.shell, n = 'shell') { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); parts.push({ g, c, n }); }
function addWire(parts, a, b, c, r = 0.001, radial = 6, n = 'shell') { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B); if (len < 1e-6) return; const g = new THREE.CylinderGeometry(r, r, len, radial); g.applyMatrix4(new THREE.Matrix4().compose(A.clone().lerp(B, 0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize()), new THREE.Vector3(1, 1, 1))); parts.push({ g, c, n }); }
function addExtrusion(parts, shape, depth, c, n = 'shell') { parts.push({ g: new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), c, n }); }
export function createAsset(userParams = {}) {
  const p = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.default])); Object.assign(p, userParams); const C = zonesFor(p.colorway, userParams), root = new THREE.Group(), parts = []; root.name = 'gastropod-auger';
  const rows = Math.round(p.whorlCount) * 24, sides = 16, start = p.brokenTip ? 0.14 : 0.006;
  // The shell advances turnSpacing meters along its axis per full revolution. Each
  // whorl's tube radius is sized directly from that spacing (not from the small
  // central radius) so consecutive coils touch and overlap slightly instead of
  // leaving gaps that expose the inner column, which is what created a "screw
  // thread" look rather than a continuous, tightly whorled shell.
  const turnSpacing = p.taperLength / p.whorlCount;
  const point = (u, v, inner = false) => {
    const a = u * p.whorlCount * Math.PI * 2;
    const r = 0.0018 + 0.015 * Math.pow(u, 0.88);
    const rib = inner ? 0 : p.ribbingIntensity * 0.0005 * Math.sin(v * 10 + a * 2.4);
    const tube = turnSpacing * (0.58 + 0.2 * u) + rib - (inner ? 0.0011 : 0);
    return [
      (r + tube * Math.cos(v)) * Math.cos(a),
      0.024 + (r + tube * Math.cos(v)) * Math.sin(a),
      p.taperLength * (u - 0.5) + tube * Math.sin(v)
    ];
  };
  for (let i = 0; i < rows; i++) { const u = start + i / rows * (1 - start), v = start + (i + 1) / rows * (1 - start), a = []; for (let j = 0; j < sides; j++) { const x = j / sides * Math.PI * 2, y = (j + 1) / sides * Math.PI * 2; a.push(...point(u, x), ...point(v, x), ...point(v, y), ...point(u, x), ...point(v, y), ...point(u, y)); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); parts.push({ g, c: i % 24 < 5 ? C.accent : i % 3 ? C.shell : C.ridge, n: u < 0.14 ? 'brokenTip' : 'shell' }); }
  const cavityRadius = Math.min(0.0055, turnSpacing * 0.32);
  const cavity = new THREE.CylinderGeometry(cavityRadius, p.brokenTip ? 0.0013 : 0.0002, p.taperLength * (1 - start) * 0.985, 20, 1, true).rotateX(Math.PI / 2).translate(0, 0.024, p.taperLength * start / 2); parts.push({ g: cavity, c: C.interior, n: 'shell' });
  for (let i = 0; i < 22; i++) { const u = 0.5 + i / 44, pos = point(u, Math.PI * 0.85); parts.push({ g: new THREE.IcosahedronGeometry(0.0008 + (i % 3) * 0.0002).translate(...pos), c: C.ridge, n: 'sandCaking' }); }
  const mesh = finish(parts, MAT, 'solid', p.mergeForProduction); if (mesh) root.add(mesh); root.userData = { params: p, zones: C, rig, detach, night, units: 'meters' }; return root;
}
export default createAsset;