/**
 * TUMBLED SEA GLASS / POTTERY (High Detail). License: MIT.
 * QUICK START: import { createAsset } from './beach-glass-and-pottery.mjs';
 * scene.add(createAsset({ materialType: 'glass', mergeForProduction: true }));
 * SPECS: nominal 0.076 x 0.012 x 0.088 m; 800 to 2,500 triangles.
 * OPTIONS: frostingLevel, shardThickness, ceramicPatternFade, shardSeed.
 * RIG: shard (Y rotation). DETACH: shard, frostedEdges, ceramicPattern.
 * Shared outline drives both the shard and its frosted edge geometry.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const BASE = { shell: '#82bbae', ridge: '#c6ded0', interior: '#eee1c9', accent: '#527c96' };
export const COLORWAYS = { default: { ...BASE }, gothic: { shell: '#a5b7bd', ridge: '#d6dcda', interior: '#d9d5cb', accent: '#575b77' }, pacific: { shell: '#b79452', ridge: '#d0b67c', interior: '#bf9278', accent: '#647b89' }, bioluminescent: { shell: '#73d8d3', ridge: '#b5f8e5', interior: '#c9ace0', accent: '#ab79cc' } };
export const presets = COLORWAYS;
export const params = { mergeForProduction: { type: 'toggle', default: false, label: 'Merge for production', affects: 'geometry', describe: 'Merge by glass and solid material or preserve editable edges.' }, colorway: { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Colorway', affects: 'colors', describe: 'Curated coastal palette.' }, materialType: { type: 'choice', default: 'glass', options: ['glass', 'delft', 'terracotta'], label: 'Material type', affects: 'geometry', describe: 'Frosted sea glass, blue-and-white Delftware, or terracotta.' }, frostingLevel: { type: 'range', default: 0.7, min: 0, max: 1, step: 0.01, label: 'Frosting', affects: 'colors', describe: 'Physical surface roughness from clear to sea-tumbled.' }, shardThickness: { type: 'range', default: 0.009, min: 0.003, max: 0.022, step: 0.001, label: 'Shard thickness', affects: 'geometry', describe: 'True bevelled glass thickness in meters.' }, ceramicPatternFade: { type: 'range', default: 0.38, min: 0, max: 1, step: 0.01, label: 'Pattern fading', affects: 'colors', describe: 'Blend geometric Delft lettering-free ornament into its ceramic base.' }, shardSeed: { type: 'range', default: 5, min: 1, max: 30, step: 1, label: 'Shard variation', affects: 'geometry', describe: 'Deterministic organic outline variation.' }, shell: { type: 'color', default: BASE.shell, label: 'Glass', affects: 'colors', describe: 'Bulk glass color.' }, ridge: { type: 'color', default: BASE.ridge, label: 'Frosted edge', affects: 'colors', describe: 'Tumbled edges.' }, interior: { type: 'color', default: BASE.interior, label: 'Ceramic', affects: 'colors', describe: 'Ceramic ground.' }, accent: { type: 'color', default: BASE.accent, label: 'Pattern', affects: 'colors', describe: 'Delft blue pigment.' } };
export const rig = { shard: { axis: 'y', range: [-180, 180], describe: 'Rotate the shard to catch the light, degrees.' } };
export const detach = ['shard', 'frostedEdges', 'ceramicPattern'];
export const night = { shard: { color: '#8ceadd', intensity: 0.55, distance: 0.1, describe: 'Sea-glass internal glow.' } };
const hexOf = v => typeof v === 'number' && Number.isFinite(v) ? v & 0xffffff : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : null;
function zonesFor(name, o = {}) { const cw = COLORWAYS[name] || COLORWAYS.default, used = new Set(), out = {}; for (const k of Object.keys(BASE)) { let h = hexOf(o[k]) ?? hexOf(cw[k]); while (used.has(h)) h = (h + 1) & 0xffffff; used.add(h); out[k] = h; } return out; }
function prep(g, hex) { if (g.index) { const old = g; g = g.toNonIndexed(); old.dispose(); } g.deleteAttribute('uv'); g.deleteAttribute('normal'); const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.77, side: THREE.DoubleSide });
function finish(list, material = MAT, name = 'solid', merge = true) { if (!list.length) return null; if (merge) { const src = list.map(p => prep(p.g, p.c)), geo = mergeGeometries(src); src.forEach(g => g.dispose()); if (!geo) return null; geo.computeVertexNormals(); const m = new THREE.Mesh(geo, material); m.name = name; m.castShadow = m.receiveShadow = true; return m; } const root = new THREE.Group(); root.name = name; const groups = {}; list.forEach((p, i) => { const geo = prep(p.g, p.c); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, material); m.name = `${p.n || name}_part_${i + 1}`; m.castShadow = m.receiveShadow = true; if (p.n) { if (!groups[p.n]) { groups[p.n] = new THREE.Group(); groups[p.n].name = p.n; root.add(groups[p.n]); } groups[p.n].add(m); } else root.add(m); }); return root; }
function box(w, h, d, x = 0, y = 0, z = 0) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }
function addCylinder(parts, rt, rb, h, seg, x, y, z, rx = 0, ry = 0, rz = 0, c = BASE.shell, n = 'shard') { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); parts.push({ g, c, n }); }
function addWire(parts, a, b, c, r = 0.001, radial = 6, n = 'shard') { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B); if (len < 1e-6) return; const g = new THREE.CylinderGeometry(r, r, len, radial); g.applyMatrix4(new THREE.Matrix4().compose(A.clone().lerp(B, 0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize()), new THREE.Vector3(1, 1, 1))); parts.push({ g, c, n }); }
function addExtrusion(parts, shape, depth, c, n = 'shard') { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.0016, bevelThickness: 0.0016, bevelSegments: 3, curveSegments: 12 }).rotateX(-Math.PI / 2).translate(0, 0.002, 0); parts.push({ g, c, n }); }
export function createAsset(userParams = {}) {
  const p = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v.default])); Object.assign(p, userParams); const C = zonesFor(p.colorway, userParams), root = new THREE.Group(), parts = [], glass = []; root.name = 'beach-glass-and-pottery';
  // A tiny seeded PRNG drives a genuinely jagged, asymmetric outline: uneven
  // angular spacing plus a squared radius distribution produces both long
  // dagger-like points and short blunt corners, unlike a smooth wobbly ring.
  let seedState = (p.shardSeed * 7919 + 1013) >>> 0;
  const rand = () => { seedState = (seedState * 1664525 + 1013904223) >>> 0; return seedState / 4294967296; };
  const segments = 10 + Math.floor(rand() * 5);
  const deltas = Array.from({ length: segments }, () => 0.35 + rand());
  const totalSweep = deltas.reduce((sum, d) => sum + d, 0);
  const squash = 0.72 + rand() * 0.5;
  let angle = rand() * Math.PI * 2;
  const outline = deltas.map(delta => {
    angle += (delta / totalSweep) * Math.PI * 2;
    const spike = Math.pow(rand(), 1.8);
    const radius = 0.013 + spike * 0.03;
    return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius * squash);
  });
  const shape = new THREE.Shape(); shape.moveTo(outline[0].x, outline[0].y); for (let i = 1; i < outline.length; i++) shape.lineTo(outline[i].x, outline[i].y); shape.closePath();
  const isGlass = p.materialType === 'glass'; addExtrusion(isGlass ? glass : parts, shape, p.shardThickness, isGlass ? C.shell : p.materialType === 'terracotta' ? new THREE.Color('#b67c5e').lerp(new THREE.Color(C.interior), 0.18).getHex() : C.interior, 'shard');
  const edgeCurve = new THREE.CatmullRomCurve3(outline.map(v => new THREE.Vector3(v.x, p.shardThickness * 0.6, -v.y)), true, 'centripetal'); parts.push({ g: new THREE.TubeGeometry(edgeCurve, 56, 0.0005 + p.frostingLevel * 0.0008, 5, true), c: isGlass ? C.ridge : C.interior, n: 'frostedEdges' });
  if (p.materialType === 'delft') { const pigment = new THREE.Color(C.accent).lerp(new THREE.Color(C.interior), p.ceramicPatternFade).getHex(); for (let petal = 0; petal < 6; petal++) { const a = petal / 6 * Math.PI * 2, points = []; for (let i = 0; i <= 20; i++) { const t = i / 20 * Math.PI * 2, r = 0.008 + Math.cos(t) * 0.006; points.push(new THREE.Vector3(Math.cos(a) * r - Math.sin(a) * Math.sin(t) * 0.004, p.shardThickness + 0.0038, Math.sin(a) * r + Math.cos(a) * Math.sin(t) * 0.004)); } parts.push({ g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.00055, 4, false), c: pigment, n: 'ceramicPattern' }); } const ring = new THREE.TorusGeometry(0.019, 0.0007, 5, 36).rotateX(Math.PI / 2).translate(0, p.shardThickness + 0.0038, 0); parts.push({ g: ring, c: pigment, n: 'ceramicPattern' }); }
  const glassMaterial = new THREE.MeshPhysicalMaterial({ vertexColors: true, flatShading: true, roughness: 0.16 + p.frostingLevel * 0.55, clearcoat: 0.7, clearcoatRoughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
  const a = finish(parts, MAT, 'solid', p.mergeForProduction), b = finish(glass, glassMaterial, 'glass', p.mergeForProduction); if (a) root.add(a); if (b) root.add(b); root.userData = { params: p, zones: C, rig, detach, night, units: 'meters' }; return root;
}
export default createAsset;