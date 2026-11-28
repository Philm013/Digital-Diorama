/**
 * OYSTER / MUSSEL (High Detail). License: MIT.
 * QUICK START: import { createAsset } from './bivalve-oyster-mussel.mjs';
 * scene.add(createAsset({ cragginess: 0.7, mergeForProduction: true }));
 * SPECS: nominal 0.14 x 0.046 x 0.23 m; approximately 8,000 triangles.
 * OPTIONS: cragginess, elongation, nacreIridescence, showPearl.
 * RIG / DETACH: pearl, byssalThreads, shell. Hollow irregular bowl.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const BASE = { shell: '#a7a99a', ridge: '#dad5bf', interior: '#f0dfd4', accent: '#797c6d' };
export const COLORWAYS = { default: { ...BASE }, gothic: { shell: '#53586d', ridge: '#9d9caa', interior: '#ded6db', accent: '#343442' }, pacific: { shell: '#665d75', ridge: '#9c8f9d', interior: '#d1c3ce', accent: '#424351' }, bioluminescent: { shell: '#726693', ridge: '#a998c8', interior: '#bbe7dd', accent: '#524c7a' } };
export const presets = COLORWAYS;
export const params = { mergeForProduction: { type: 'toggle', default: false, label: 'Merge for production', affects: 'geometry', describe: 'Bake shell, pearl, and threads by material.' }, colorway: { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Colorway', affects: 'colors', describe: 'Curated coastal palette.' }, cragginess: { type: 'range', default: 0.72, min: 0, max: 1, step: 0.01, label: 'Cragginess', affects: 'geometry', describe: 'Magnitude of layered shell-edge weathering.' }, elongation: { type: 'range', default: 1.05, min: 0.7, max: 1.7, step: 0.01, label: 'Elongation', affects: 'geometry', describe: 'Rebuild the oval profile into a narrow mussel.' }, nacreIridescence: { type: 'range', default: 0.65, min: 0, max: 1, step: 0.01, label: 'Nacre iridescence', affects: 'colors', describe: 'Physical, angle-dependent inner-shell iridescence.' }, showPearl: { type: 'toggle', default: true, label: 'Hidden pearl', affects: 'geometry', describe: 'Include a removable pearl inside the bowl.' }, shell: { type: 'color', default: BASE.shell, label: 'Shell', affects: 'colors', describe: 'Outer shell.' }, ridge: { type: 'color', default: BASE.ridge, label: 'Flakes', affects: 'colors', describe: 'Growth layers.' }, interior: { type: 'color', default: BASE.interior, label: 'Nacre', affects: 'colors', describe: 'Mother-of-pearl.' }, accent: { type: 'color', default: BASE.accent, label: 'Threads', affects: 'colors', describe: 'Fibrous beard.' } };
export const rig = { pearl: { axis: 'y', range: [0, 0.07], describe: 'Lift the pearl from its mantle, in meters.' }, byssalThreads: { axis: 'z', range: [-8, 8], describe: 'Coastal breeze sway, degrees.' } };
export const detach = ['shell', 'nacre', 'pearl', 'byssalThreads'];
export const night = { nacre: { color: '#bcd7ee', intensity: 0.45, distance: 0.15, describe: 'Pearlescent inner glow.' } };
const hexOf = v => typeof v === 'number' && Number.isFinite(v) ? v & 0xffffff : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : null;
function zonesFor(name, o = {}) { const cw = COLORWAYS[name] || COLORWAYS.default, used = new Set(), out = {}; for (const k of Object.keys(BASE)) { let h = hexOf(o[k]) ?? hexOf(cw[k]); while (used.has(h)) h = (h + 1) & 0xffffff; used.add(h); out[k] = h; } return out; }
function prep(g, hex) { if (g.index) { const old = g; g = g.toNonIndexed(); old.dispose(); } g.deleteAttribute('uv'); g.deleteAttribute('normal'); const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, side: THREE.DoubleSide });
function finish(list, material = MAT, name = 'solid', merge = true) { if (!list.length) return null; if (merge) { const src = list.map(p => prep(p.g, p.c)), geo = mergeGeometries(src); src.forEach(g => g.dispose()); if (!geo) return null; geo.computeVertexNormals(); const m = new THREE.Mesh(geo, material); m.name = name; m.castShadow = m.receiveShadow = true; return m; } const root = new THREE.Group(); root.name = name; const groups = {}; list.forEach((p, i) => { const geo = prep(p.g, p.c); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, material); m.name = `${p.n || name}_part_${i + 1}`; m.castShadow = m.receiveShadow = true; if (p.n) { if (!groups[p.n]) { groups[p.n] = new THREE.Group(); groups[p.n].name = p.n; root.add(groups[p.n]); } groups[p.n].add(m); } else root.add(m); }); return root; }
export function createAsset(userParams = {}) {
  const p = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.default])); Object.assign(p, userParams); const C = zonesFor(p.colorway, userParams), root = new THREE.Group(), parts = [], inner = []; root.name = 'bivalve-oyster-mussel';
  // A true bivalve needs two genuinely different valve surfaces sharing one
  // horizontal footprint so their rims line up exactly: a deep craggy bottom
  // bowl (cemented, cupped) and a much shallower top lid, hinged at the back
  // (a = PI) and gently gaping open toward the front so the nacre and pearl
  // read clearly instead of collapsing into one flat, single-sided leaf.
  const hinge = Math.PI;
  const footprint = (r, a) => {
    const crag = p.cragginess * (Math.sin(a * 7) * 0.004 + Math.sin(a * 19 + r * 12) * 0.0025);
    const width = (0.063 + crag) * r * (1 + Math.sin(a) * 0.2);
    const depth = r * (0.098 + crag) * p.elongation;
    return { x: Math.cos(a) * width, z: Math.sin(a) * depth, crag };
  };
  const point = (r, a, valve, inside) => {
    const { x, z, crag } = footprint(r, a);
    const rim = Math.pow(r, 1.55);
    // Valves meet almost flush at the back hinge (a = PI) and separate
    // increasingly toward the front (a = 0), producing a natural gape without
    // needing a rotation matrix, and guaranteeing both valves share one rim.
    const hingeFactor = 0.5 - 0.5 * Math.cos(a - hinge);
    const openness = 0.22 + 0.78 * hingeFactor;
    const bowlDepth = (valve === 0 ? 0.058 : 0.016) * rim * openness + crag * (valve === 0 ? 1.7 : 0.55) * hingeFactor;
    const ripple = Math.sin(r * 84 + a * 2) * p.cragginess * (valve === 0 ? 0.0017 : 0.0008) * r;
    const sign = valve === 0 ? -1 : 1;
    const y = sign * (bowlDepth + ripple) - (inside ? sign * 0.0024 : 0);
    return [x, y, z];
  };
  for (let valve = 0; valve < 2; valve++) for (let inside = 0; inside < 2; inside++) for (let i = 0; i < 26; i++) {
    const vertices = [];
    for (let j = 0; j < 72; j++) {
      const a = j / 72 * Math.PI * 2, b = (j + 1) / 72 * Math.PI * 2, u = i / 26, v = (i + 1) / 26;
      vertices.push(...point(u, a, valve, inside), ...point(v, a, valve, inside), ...point(v, b, valve, inside), ...point(u, a, valve, inside), ...point(v, b, valve, inside), ...point(u, b, valve, inside));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    (inside ? inner : parts).push({ g, c: inside ? C.interior : i % 4 ? C.shell : C.ridge, n: inside ? 'nacre' : 'shell' });
  }
  // A thin edge band closes the gap between the outer and inner surfaces at the rim.
  for (const valve of [0, 1]) { const vertices = []; for (let j = 0; j < 72; j++) { const a = j / 72 * Math.PI * 2, b = (j + 1) / 72 * Math.PI * 2; vertices.push(...point(1, a, valve, 0), ...point(1, b, valve, 0), ...point(1, b, valve, 1), ...point(1, a, valve, 0), ...point(1, b, valve, 1), ...point(1, a, valve, 1)); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); parts.push({ g: g, c: C.ridge, n: 'shell' }); }
  const hingeAnchor = point(0.16, hinge, 0, false);
  for (let i = 0; i < 18; i++) { const pts = []; for (let j = 0; j < 8; j++) pts.push(new THREE.Vector3(hingeAnchor[0] * (1 - j / 10) + Math.sin(j + i) * 0.003, hingeAnchor[1] - j * 0.0034, hingeAnchor[2] - j * 0.006 - i * 0.0006)); parts.push({ g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.00045, 4, false), c: C.accent, n: 'byssalThreads' }); }
  if (p.showPearl) { const bowlPoint = point(0.62, hinge + 0.55, 0, true); inner.push({ g: new THREE.SphereGeometry(0.011, 24, 16).translate(bowlPoint[0] * 0.7, bowlPoint[1] + 0.009, bowlPoint[2] * 0.7), c: C.ridge, n: 'pearl' }); }
  const nacre = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.21, iridescence: p.nacreIridescence, iridescenceIOR: 1.34, clearcoat: 0.8, metalness: 0.18, side: THREE.DoubleSide });
  const a = finish(parts, MAT, 'solid', p.mergeForProduction), b = finish(inner, nacre, 'pearl-material', p.mergeForProduction); if (a) root.add(a); if (b) root.add(b); root.userData = { params: p, zones: C, rig, detach, night, units: 'meters' }; return root;
}
export default createAsset;