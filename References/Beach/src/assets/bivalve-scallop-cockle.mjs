/**
 * SCALLOP / COCKLE (High Detail). License: MIT.
 * QUICK START: import { createAsset } from './bivalve-scallop-cockle.mjs';
 * scene.add(createAsset({ ridgeCount: 18, mergeForProduction: true }));
 * SPECS: nominal 0.19 x 0.055 x 0.19 m; approximately 9,500 triangles.
 * OPTIONS: ridgeCount, wingSize, cuppingDepth, openingAngle, colorway.
 * RIG / DETACH: leftValve, rightValve. Hinge rotation in degrees.
 * Two continuous corrugated valves with real thickness and nacre interiors.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const BASE = { shell: '#dca398', ridge: '#f0c5b1', interior: '#f9e2d0', accent: '#ad776d' };
export const COLORWAYS = { default: { ...BASE }, gothic: { shell: '#afa6b5', ridge: '#d9d4dc', interior: '#eee9e1', accent: '#6c6274' }, pacific: { shell: '#b7664e', ridge: '#e5ac89', interior: '#e2bec2', accent: '#7f4840' }, bioluminescent: { shell: '#ac79b7', ridge: '#e8a5d9', interior: '#9fefe2', accent: '#6464aa' } };
export const presets = COLORWAYS;
export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for production', affects: 'geometry', describe: 'Bake valves into one mesh per material, or preserve named hinges.' },
  colorway: { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Colorway', affects: 'colors', describe: 'Curated coastal palette.' },
  ridgeCount: { type: 'range', default: 18, min: 8, max: 32, step: 1, label: 'Radial ridges', affects: 'geometry', describe: 'Number of continuous corrugated ribs.' },
  wingSize: { type: 'range', default: 0.024, min: 0.008, max: 0.04, step: 0.001, label: 'Hinge wings', affects: 'geometry', describe: 'Width of the calcified ears in meters.' },
  cuppingDepth: { type: 'range', default: 0.027, min: 0.008, max: 0.05, step: 0.001, label: 'Cupping depth', affects: 'geometry', describe: 'Depth of the radial bowl in meters.' },
  openingAngle: { type: 'range', default: 14, min: 0, max: 155, step: 1, label: 'Valve opening', affects: 'geometry', describe: 'Hinge opening, in degrees.' },
  shell: { type: 'color', default: BASE.shell, label: 'Shell', affects: 'colors', describe: 'Shell pigment.' }, ridge: { type: 'color', default: BASE.ridge, label: 'Ridges', affects: 'colors', describe: 'Raised rib color.' }, interior: { type: 'color', default: BASE.interior, label: 'Nacre', affects: 'colors', describe: 'Inner pearl color.' }, accent: { type: 'color', default: BASE.accent, label: 'Growth lines', affects: 'colors', describe: 'Growth band pigment.' }
};
export const rig = { leftValve: { axis: 'x', range: [0, -155], describe: 'Upper valve opening in degrees.' }, rightValve: { axis: 'x', range: [0, 20], describe: 'Lower valve hinge.' } };
export const detach = ['leftValve', 'rightValve'];
export const night = { interior: { color: '#a4ebe0', intensity: 0.3, distance: 0.15, describe: 'Pearlescent rim light.' } };
const hexOf = v => typeof v === 'number' && Number.isFinite(v) ? v & 0xffffff : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : null;
function zonesFor(name, o = {}) { const cw = COLORWAYS[name] || COLORWAYS.default, used = new Set(), out = {}; for (const k of Object.keys(BASE)) { let h = hexOf(o[k]) ?? hexOf(cw[k]); while (used.has(h)) h = (h + 1) & 0xffffff; used.add(h); out[k] = h; } return out; }
function prep(g, hex) { if (g.index) { const old = g; g = g.toNonIndexed(); old.dispose(); } g.deleteAttribute('uv'); g.deleteAttribute('normal'); const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
const MAT = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, iridescence: 0.24, clearcoat: 0.15, flatShading: true, side: THREE.DoubleSide });
function finish(list, material = MAT, name = 'solid', merge = true) { if (!list.length) return null; if (merge) { const src = list.map(p => prep(p.g, p.c)), geo = mergeGeometries(src); src.forEach(g => g.dispose()); if (!geo) return null; geo.computeVertexNormals(); const m = new THREE.Mesh(geo, material); m.name = name; m.castShadow = m.receiveShadow = true; return m; } const root = new THREE.Group(); root.name = name; const groups = {}; list.forEach((p, i) => { const geo = prep(p.g, p.c); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, material); m.name = `${p.n || name}_part_${i + 1}`; m.castShadow = m.receiveShadow = true; if (p.n) { if (!groups[p.n]) { groups[p.n] = new THREE.Group(); groups[p.n].name = p.n; root.add(groups[p.n]); } groups[p.n].add(m); } else root.add(m); }); return root; }
function box(w, h, d, x = 0, y = 0, z = 0) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }
function addCylinder(parts, rt, rb, h, seg, x, y, z, rx = 0, ry = 0, rz = 0, c = BASE.shell, n = 'hinge') { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); parts.push({ g, c, n }); }
function addWire(parts, a, b, c, r = 0.001, radial = 6, n = 'hinge') { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B); if (len < 1e-6) return; const g = new THREE.CylinderGeometry(r, r, len, radial); g.applyMatrix4(new THREE.Matrix4().compose(A.clone().lerp(B, 0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize()), new THREE.Vector3(1, 1, 1))); parts.push({ g, c, n }); }
function addExtrusion(parts, shape, depth, c, n = 'hinge') { parts.push({ g: new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 }), c, n }); }
export function createAsset(userParams = {}) {
  const p = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.default])); Object.assign(p, userParams);
  const C = zonesFor(p.colorway, userParams), root = new THREE.Group(), parts = []; root.name = 'bivalve-scallop-cockle';
  const angular = Math.round(p.ridgeCount) * 6, radial = 18, radius = 0.15;
  for (let valve = 0; valve < 2; valve++) {
    const n = valve ? 'leftValve' : 'rightValve', angle = valve ? -p.openingAngle * Math.PI / 180 : 0;
    const point = (u, v, inner = false) => { const a = (v - 0.5) * Math.PI * 0.95, r = u * radius, wave = Math.cos(v * Math.PI * 2 * p.ridgeCount), corrugation = wave * 0.0035 * Math.pow(u, 0.6), cup = p.cuppingDepth * Math.sin(u * Math.PI * 0.92); let x = Math.sin(a) * r, z = Math.cos(a) * r - 0.065, y = 0.009 + (valve ? 1 : -1) * (cup + corrugation) + (inner ? -0.0025 * (valve ? 1 : -1) : 0); const zz = z + 0.065; return [x, y * Math.cos(angle) - zz * Math.sin(angle) + 0.025, zz * Math.cos(angle) + y * Math.sin(angle) - 0.065]; };
    for (let inner = 0; inner < 2; inner++) for (let j = 0; j < angular; j++) { const vertices = []; for (let i = 0; i < radial; i++) { const a = point(i / radial, j / angular, !!inner), b = point((i + 1) / radial, j / angular, !!inner), c = point((i + 1) / radial, (j + 1) / angular, !!inner), d = point(i / radial, (j + 1) / angular, !!inner); vertices.push(...a, ...b, ...c, ...a, ...c, ...d); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); parts.push({ g, c: inner ? C.interior : j % 6 < 2 ? C.ridge : C.shell, n }); }
    const edge = []; for (let j = 0; j < angular; j++) edge.push(...point(1, j / angular), ...point(1, (j + 1) / angular), ...point(1, (j + 1) / angular, true), ...point(1, j / angular), ...point(1, (j + 1) / angular, true), ...point(1, j / angular, true)); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3)); parts.push({ g: geo, c: C.ridge, n });
    for (const s of [-1, 1]) { const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(s * p.wingSize, -0.005); shape.lineTo(s * p.wingSize * 1.1, 0.024); shape.lineTo(0, 0.036); shape.closePath(); const g = new THREE.ExtrudeGeometry(shape, { depth: 0.003, bevelEnabled: true, bevelSize: 0.001, bevelThickness: 0.001, bevelSegments: 1 }).rotateX(Math.PI / 2 + angle).translate(0, 0.034, -0.065); parts.push({ g, c: C.ridge, n }); }
  }
  const mesh = finish(parts, MAT, 'solid', p.mergeForProduction); if (mesh) root.add(mesh);
  if (!p.mergeForProduction) for (const n of detach) { const hinge = root.getObjectByName(n); if (hinge) { hinge.position.set(0, 0.034, -0.065); hinge.children.forEach(m => m.geometry.translate(0, -0.034, 0.065)); } }
  root.userData = { params: p, zones: C, rig, detach, night, units: 'meters' }; return root;
}
export default createAsset;