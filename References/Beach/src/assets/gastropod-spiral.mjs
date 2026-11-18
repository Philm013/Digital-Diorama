/**
 * QUEEN CONCH / GASTROPOD SPIRAL (High Detail)
 * Standalone, texture-free, parametric specimen. License: MIT.
 * QUICK START: import { createAsset } from './gastropod-spiral.mjs';
 * scene.add(createAsset({ mergeForProduction: true }));
 * SPECS: nominal 0.36 x 0.25 x 0.32 m; approximately 14,000 triangles.
 * OPTIONS: spireHeight, crownSpikes, lipFlareWidth, apertureCurve, colorway.
 * MATERIALS: exterior, iridescent nacre; at most two production draw calls.
 * RIG: hermitCrab (Z emergence). DETACH: shell, crown, lip, hermitCrab.
 * Dimensions are recalculated from a logarithmic sweep, never object scaling.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = { shell: '#e7bd9e', ridge: '#fae3ca', interior: '#f4c9ba', accent: '#bc8064', organic: '#a26349', glass: '#b8dbd2' };
export const COLORWAYS = { default: { ...BASE }, gothic: { shell: '#d9d6cb', ridge: '#f7f1df', interior: '#b0a9be', accent: '#55525a', organic: '#454250', glass: '#9dabb6' }, pacific: { shell: '#b99580', ridge: '#dfccb0', interior: '#bb8f9d', accent: '#665149', organic: '#ad6148', glass: '#75a99a' }, bioluminescent: { shell: '#8172a8', ridge: '#85eee0', interior: '#eaa7dd', accent: '#bc68cc', organic: '#6771b0', glass: '#73e0e8' } };
export const presets = COLORWAYS;
export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for production', affects: 'geometry', describe: 'One mesh per material, or named editable mesh groups.' },
  colorway: { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Colorway', affects: 'colors', describe: 'Curated coastal palette.' },
  spireHeight: { type: 'range', default: 0.12, min: 0.04, max: 0.22, step: 0.005, label: 'Spire height', affects: 'geometry', describe: 'Height of the logarithmic spire, in meters.' },
  crownSpikes: { type: 'range', default: 9, min: 0, max: 16, step: 1, label: 'Crown spikes', affects: 'geometry', describe: 'Number of swept crown spines.' },
  lipFlareWidth: { type: 'range', default: 0.035, min: 0.005, max: 0.065, step: 0.002, label: 'Lip flare', affects: 'geometry', describe: 'Flare of the open nacre lip, in meters.' },
  apertureCurve: { type: 'range', default: 0.72, min: 0.35, max: 1, step: 0.01, label: 'Aperture curve', affects: 'geometry', describe: 'Cross-section roundness of the final whorl.' },
  showHermitCrab: { type: 'toggle', default: false, label: 'Show hermit crab', affects: 'geometry', describe: 'Reveal the segmented inhabitant inside the aperture.' },
  shell: { type: 'color', default: BASE.shell, label: 'Shell', affects: 'colors', describe: 'Exterior calcium color.' },
  ridge: { type: 'color', default: BASE.ridge, label: 'Ridges', affects: 'colors', describe: 'Raised growth lines.' },
  interior: { type: 'color', default: BASE.interior, label: 'Nacre', affects: 'colors', describe: 'Pearlescent inner lip.' },
  accent: { type: 'color', default: BASE.accent, label: 'Accents', affects: 'colors', describe: 'Weathered groove pigment.' }
};
export const rig = { hermitCrab: { axis: 'z', range: [0, 0.045], describe: 'Cautious emergence from the open aperture; meters.' }, antennaLeft: { axis: 'y', range: [-15, 15], describe: 'Left antenna twitch, degrees.' }, antennaRight: { axis: 'y', range: [-15, 15], describe: 'Right antenna twitch, degrees.' } };
export const detach = ['shell', 'crown', 'lip', 'hermitCrab', 'encrustations'];
export const night = { lip: { color: '#85eee0', intensity: 0.45, distance: 0.3, describe: 'Subtle bioluminescent nacre.' } };
const hexOf = v => typeof v === 'number' && Number.isFinite(v) ? v & 0xffffff : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : null;
function zonesFor(name, overrides = {}) { const cw = COLORWAYS[name] || COLORWAYS.default, used = new Set(), out = {}; for (const k of Object.keys(BASE)) { let h = hexOf(overrides[k]) ?? hexOf(cw[k]) ?? hexOf(BASE[k]); while (used.has(h)) h = (h + 1) & 0xffffff; used.add(h); out[k] = h; } return out; }
function prep(geo, hex) { if (geo.index) { const old = geo; geo = geo.toNonIndexed(); old.dispose(); } geo.deleteAttribute('uv'); geo.deleteAttribute('normal'); const c = new THREE.Color(hex), colors = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); return geo; }
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.72, side: THREE.DoubleSide });
const NACRE = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.24, metalness: 0.12, iridescence: 0.55, iridescenceIOR: 1.32, clearcoat: 0.5, side: THREE.DoubleSide });
function finish(list, material = MAT, name = 'solid', merge = true) { if (!list.length) return null; if (merge) { const sources = list.map(p => prep(p.g, p.c)), geo = mergeGeometries(sources); sources.forEach(g => g.dispose()); if (!geo) return null; geo.computeVertexNormals(); const m = new THREE.Mesh(geo, material); m.name = name; m.castShadow = m.receiveShadow = true; return m; } const root = new THREE.Group(); root.name = name; const groups = {}; list.forEach((p, i) => { const geo = prep(p.g, p.c); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, material); m.name = `${p.n || name}_part_${i + 1}`; m.castShadow = m.receiveShadow = true; if (p.n) { if (!groups[p.n]) { groups[p.n] = new THREE.Group(); groups[p.n].name = p.n; root.add(groups[p.n]); } groups[p.n].add(m); } else root.add(m); }); return root; }
function box(w, h, d, x = 0, y = 0, z = 0) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }
function addCylinder(parts, rt, rb, h, seg, x, y, z, rx = 0, ry = 0, rz = 0, c = BASE.shell, n = 'shell') { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); parts.push({ g, c, n }); }
function addWire(parts, a, b, c, r = 0.001, radial = 6, n = 'shell') { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B); if (len < 1e-6) return; const g = new THREE.CylinderGeometry(r, r, len, radial), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); g.applyMatrix4(new THREE.Matrix4().compose(A.lerp(B, 0.5), q, new THREE.Vector3(1, 1, 1))); parts.push({ g, c, n }); }
function addExtrusion(parts, shape, depth, c, n = 'shell', matrix = null) { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 20 }); if (matrix) g.applyMatrix4(matrix); parts.push({ g, c, n }); }
function strip(parts, a, b, c, n) { const vertices = []; for (let j = 0; j < a.length - 1; j++) vertices.push(...a[j], ...b[j], ...b[j + 1], ...a[j], ...b[j + 1], ...a[j + 1]); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); parts.push({ g, c, n }); }
export function createAsset(userParams = {}) {
  const p = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.default])); Object.assign(p, userParams);
  const C = zonesFor(p.colorway, userParams), group = new THREE.Group(), parts = [], nacre = [];
  group.name = 'gastropod-spiral';
  const T = Math.PI * 5.4, rings = 164, sides = 32;
  // Tube radius stays a small fraction of the whorl centerline radius so successive
  // turns nest against each other without ever overlapping or self-intersecting.
  // The lip flare is weighted by the outward-facing side only (cos(v) > 0), so the
  // wing extends away from the columella instead of ballooning into a full disk.
  const point = (u, v, inner = false) => {
    const a = u * T - T + Math.PI / 2;
    const r = 0.0095 * Math.pow(14, u);
    const outward = Math.max(0, Math.cos(v));
    const flareReach = Math.pow(Math.max(0, (u - 0.9) / 0.1), 1.5);
    const flare = flareReach * p.lipFlareWidth * Math.pow(outward, 1.6);
    const tubeBase = r * 0.3;
    const tube = tubeBase + flare - (inner ? 0.0026 : 0);
    const rib = inner ? 0 : Math.sin(u * T * 15) * 0.0009 * u;
    return [
      (r + (tube + rib) * Math.cos(v)) * Math.cos(a),
      0.032 + p.spireHeight * Math.pow(1 - u, 1.3) + tube * Math.sin(v) * p.apertureCurve * (1 - flareReach * 0.4),
      (r + (tube + rib) * Math.cos(v)) * Math.sin(a)
    ];
  };
  let previous = Array.from({ length: sides + 1 }, (_, j) => point(0, j / sides * Math.PI * 2));
  for (let i = 1; i <= rings; i++) { const u = i / rings, row = Array.from({ length: sides + 1 }, (_, j) => point(u, j / sides * Math.PI * 2)); strip(parts, previous, row, i % 11 === 0 ? C.accent : i % 3 === 0 ? C.ridge : C.shell, 'shell'); previous = row; }
  let innerPrevious = Array.from({ length: sides + 1 }, (_, j) => point(0.82, j / sides * Math.PI * 2, true));
  for (let i = 1; i <= 32; i++) { const row = Array.from({ length: sides + 1 }, (_, j) => point(0.82 + i / 32 * 0.18, j / sides * Math.PI * 2, true)); strip(nacre, innerPrevious, row, C.interior, 'lip'); innerPrevious = row; }
  strip(nacre, previous, innerPrevious, C.ridge, 'lip');
  for (let i = 0; i < Math.round(p.crownSpikes); i++) { const u = 0.7 + i / Math.max(1, p.crownSpikes - 1) * 0.22, a = u * T - T + Math.PI / 2, origin = new THREE.Vector3(...point(u, 0.7)), direction = new THREE.Vector3(Math.cos(a) * 0.7, 1, Math.sin(a) * 0.7).normalize(); const h = 0.016 + u * 0.019, geo = new THREE.ConeGeometry(0.008 * u, h, 8); geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)); geo.translate(...origin.addScaledVector(direction, h * 0.3).toArray()); parts.push({ g: geo, c: C.ridge, n: 'crown' }); }
  const crab = new THREE.SphereGeometry(0.018, 12, 8).scale(1, 0.6, 1).translate(0, 0.048, 0.122); parts.push({ g: crab, c: C.organic, n: 'hermitCrab' });
  for (let s of [-1, 1]) for (let i = 0; i < 3; i++) { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.008, 0.05, 0.12), new THREE.Vector3(s * (0.022 + i * 0.003), 0.04, 0.13 + i * 0.008), new THREE.Vector3(s * 0.026, 0.025, 0.15 + i * 0.009)]); parts.push({ g: new THREE.TubeGeometry(curve, 10, 0.0022, 5, false), c: C.organic, n: 'hermitCrab' }); }
  for (let s of [-1, 1]) addWire(parts, [s * 0.006, 0.058, 0.13], [s * 0.014, 0.078, 0.156], C.accent, 0.0009, 5, s < 0 ? 'antennaLeft' : 'antennaRight');
  for (let i = 0; i < 7; i++) {
    const u = 0.7 + (i % 3) * 0.012, v = 1.1 + Math.floor(i / 3) * 0.17, position = new THREE.Vector3(...point(u, v));
    const tangent = new THREE.Vector3(...point(u + 0.0001, v)).sub(position), across = new THREE.Vector3(...point(u, v + 0.0001)).sub(position), normal = across.cross(tangent).normalize();
    if (normal.y < 0) normal.negate();
    const profile = [[0.0036, 0], [0.003, 0.003], [0.0023, 0.0045], [0.0013, 0.0045], [0.0011, 0.002]].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(profile, 7).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)).translate(...position.toArray()); parts.push({ g, c: C.ridge, n: 'encrustations' });
  }
  for (let i = 0; i < 3; i++) { const pts = Array.from({ length: 18 }, (_, j) => new THREE.Vector3(...point(0.76 + j * 0.002, 0.95 + i * 0.14 + Math.sin(j * 0.6) * 0.045)).add(new THREE.Vector3(0, 0.0007, 0))); parts.push({ g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.00065, 5, false), c: C.ridge, n: 'encrustations' }); }
  const visibleParts = p.mergeForProduction && !p.showHermitCrab ? parts.filter(part => !['hermitCrab', 'antennaLeft', 'antennaRight'].includes(part.n)) : parts;
  const solid = finish(visibleParts, MAT, 'solid', p.mergeForProduction), lip = finish(nacre, NACRE, 'nacre', p.mergeForProduction); if (solid) group.add(solid); if (lip) group.add(lip);
  const hermit = group.getObjectByName('hermitCrab');
  if (hermit) { for (const s of [-1, 1]) { const antenna = group.getObjectByName(s < 0 ? 'antennaLeft' : 'antennaRight'); if (antenna) { antenna.position.set(s * 0.006, 0.058, 0.13); antenna.children.forEach(mesh => mesh.geometry.translate(-s * 0.006, -0.058, -0.13)); hermit.add(antenna); } } hermit.visible = p.showHermitCrab; }
  group.userData = { params: p, zones: C, rig, detach, night, units: 'meters' }; return group;
}
export default createAsset;