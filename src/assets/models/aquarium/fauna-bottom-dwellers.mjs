/*
 * FAUNA BOTTOM DWELLERS (High Detail)
 * Parametric clean-up crew for three.js: Cherry Shrimp (single continuous lathe body bent along an
 * arc), Corydoras catfish (armoured flat-bellied lathe), Hermit Crabs (tapered helical swept shell).
 * They wander, pause and forage across any terrain (heightAt), aligned to the surface normal, with
 * twitching antennae/barbels and scuttling legs.
 *
 * QUICK START
 *   import { createAsset } from './fauna-bottom-dwellers.mjs';
 *   const crew = createAsset({ species: 'shrimp', population: 8, heightAt, area: { minX:-.5, maxX:.5, minZ:-.2, maxZ:.2 } });
 *   scene.add(crew); // loop: crew.userData.update(t, dt)
 *
 * PARAMS  species: shrimp | corydoras | hermit ; population 1-20 ; speed ; colorway ; seed
 * SPECS  ~400-1,400 triangles per critter, 1 material, 0.025-0.05 m (real-world scale).
 * PARTS  animate: antennae (twitch), legs (scuttle), tail
 *        detach: antennae, legs
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = { shell: '#d8202a', shellDark: '#8a0a14', belly: '#ff6a5a', limb: '#e04a4a', eye: '#0a0a0a', accent: '#f0e0d0', spiral: '#c8a878' };

export const COLORWAYS = {
  'default':    { ...BASE },
  'cherry':     { ...BASE },
  'blue-dream': { shell: '#1a4ad8', shellDark: '#0a1a6a', belly: '#4a8aff', limb: '#3a6ae0', eye: '#0a0a0a', accent: '#c0d8ff', spiral: '#8aa0c8' },
  'bronze-cory':{ shell: '#8a7a5a', shellDark: '#3a5a4a', belly: '#e8dcc8', limb: '#b0a080', eye: '#1a1a1a', accent: '#2a4a3a', spiral: '#a89070' },
  'albino':     { shell: '#f0d8c8', shellDark: '#d8b8a8', belly: '#fff0e8', limb: '#f0c8b8', eye: '#d01a1a', accent: '#ffffff', spiral: '#e8d8c0' },
  'reef-hermit':{ shell: '#d83a1a', shellDark: '#6a1a0a', belly: '#ff9a5a', limb: '#e85a2a', eye: '#101010', accent: '#ffffff', spiral: '#8a6a9a' },
  'neon':       { shell: '#30f0ff', shellDark: '#a040ff', belly: '#ff40c8', limb: '#40c0ff', eye: '#ffffff', accent: '#ffe040', spiral: '#c040ff' }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge each critter body; limbs stay rigged.' },
  colorway:   { type: 'choice', default: 'auto', options: ['auto', ...Object.keys(COLORWAYS)], label: 'Palette', affects: 'colors', describe: 'auto follows species.' },
  species:    { type: 'choice', default: 'shrimp', options: ['shrimp', 'corydoras', 'hermit'], label: 'Species', affects: 'geometry', describe: 'Cherry Shrimp, Corydoras, Hermit Crab.' },
  population: { type: 'range', default: 8, min: 1, max: 20, step: 1, label: 'Population', affects: 'geometry', describe: 'Number of critters.' },
  speed:      { type: 'range', default: 1, min: 0.2, max: 3, step: 0.1, label: 'Speed', affects: 'geometry', describe: 'Wander speed.' },
  scale:      { type: 'range', default: 1, min: 0.6, max: 1.8, step: 0.05, label: 'Size', affects: 'geometry', describe: 'Critter size.' },
  seed:       { type: 'range', default: 29, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Wander seed.' }
};

export const rig = {
  antennae: { axis: 'z', range: [-15, 15], describe: 'Antennae / barbels twitch.' },
  legs:     { axis: 'x', range: [-25, 25], describe: 'Legs scuttle along the surface normal.' }
};
export const detach = ['antennae', 'legs'];
export const night = {};

const ZONE_KEYS = Object.keys(BASE);
const hexOf = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v & 0xFFFFFF;
  if (typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v)) return parseInt(v.replace('#', ''), 16);
  return null;
};

function zonesFor(name, o = {}) {
  const cw = COLORWAYS[name] || COLORWAYS['default'];
  const used = new Set(), out = {};
  for (const k of ZONE_KEYS) {
    let hex = (hexOf(o[k]) ?? hexOf(cw[k]) ?? hexOf(BASE[k])) & 0xFFFFFF;
    while (used.has(hex)) hex = (hex + 1) & 0xFFFFFF;
    used.add(hex); out[k] = hex;
  }
  return out;
}

function prep(geo, hex) {
  if (geo.index) geo = geo.toNonIndexed();
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (geo.attributes.normal) geo.deleteAttribute('normal');
  if (!geo.attributes.color) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  return geo;
}

const MAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: false,
  roughness: 0.35,
  metalness: 0.18,
  side: THREE.DoubleSide
});

function finish(list, material = MAT, name = 'solid', merge = true) {
  if (list.length === 0) return null;
  if (merge) {
    const merged = mergeGeometries(list.map(p => prep(p.g, p.c)));
    if (!merged) return null;
    merged.computeVertexNormals();
    const m = new THREE.Mesh(merged, material);
    m.name = name; m.castShadow = true;
    return m;
  }
  const g = new THREE.Group();
  g.name = name;
  list.forEach((p, i) => {
    const geo = prep(p.g, p.c);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.name = p.n ? `${name}_${p.n}_${i + 1}` : `${name}_part_${i + 1}`;
    m.castShadow = true;
    g.add(m);
  });
  return g;
}

function box(w, h, d, x = 0, y = 0, z = 0) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }

function addCylinder(parts, rTop, rBot, h, segs, x, y, z, rx = 0, ry = 0, rz = 0, hex = '#888888') {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z); parts.push({ g: geo, c: hex });
}

function addWire(parts, p1, p2, hex, r = 0.01, radialSegments = 5) {
  const v1 = new THREE.Vector3(...p1), v2 = new THREE.Vector3(...p2);
  const dist = v1.distanceTo(v2); if (dist < 1e-5) return;
  const geo = new THREE.CylinderGeometry(r, r, dist, radialSegments);
  const mid = v1.clone().lerp(v2, 0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v2.clone().sub(v1).normalize());
  geo.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  parts.push({ g: geo, c: hex });
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function addTube(parts, pts, r0, r1, hex, radial = 4, segs = 8) {
  const curve = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)));
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) { const c = curve.getPointAt(i / segs), r = r0 + (r1 - r0) * i / segs; for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c); pos.setXYZ(k, v.x, v.y, v.z); } }
  parts.push({ g: geo, c: hex });
}

function pivotFrom(list, name, merge, x, y, z) {
  const pv = new THREE.Group(); pv.name = name; pv.position.set(x, y, z);
  list.forEach(q => q.g.translate(-x, -y, -z));
  const m = finish(list, MAT, name + 'Mesh', merge); if (m) pv.add(m);
  return pv;
}

function buildCritter(species, C, merge, S, rnd) {
  const root = new THREE.Group(); root.name = species;
  const body = [], antennae = [], legs = [];
  const legPivots = [];
  let antPivot = null;
  if (species === 'shrimp') {
    const L = 0.026 * S;
    const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; const r = Math.pow(Math.sin(Math.PI * (0.06 + t * 0.9)), 0.6) * (0.35 + 0.65 * Math.pow(t, 0.4)); pts.push(new THREE.Vector2(Math.max(0.0001, r * L * 0.17), t * L - L / 2)); }
    pts[14].x = 0.0001;
    const g = new THREE.LatheGeometry(pts, 10).rotateZ(-Math.PI / 2).scale(1, 1.1, 0.8).toNonIndexed();
    // bend along a hunched arc
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); pa.setY(i, pa.getY(i) - (x * x) * 9 / S + L * 0.12); }
    const bCols = new Float32Array(pa.count * 3);
    const cShell = new THREE.Color(C.shell);
    const cDark = new THREE.Color(C.shellDark);
    const cBelly = new THREE.Color(C.belly);
    const cAccent = new THREE.Color(C.accent);
    const tmp = new THREE.Color();
    for (let i = 0; i < pa.count; i++) {
      const cx = pa.getX(i), cy = pa.getY(i), cz = pa.getZ(i);
      const u = (cx + L / 2) / L;
      const segT = Math.sin(u * Math.PI * 7.0);
      tmp.copy(cShell).lerp(cDark, THREE.MathUtils.smoothstep(0.2, 0.8, segT) * 0.4);
      if (cy < L * 0.07) tmp.lerp(cBelly, THREE.MathUtils.smoothstep(L * 0.07, 0.0, cy) * 0.7);
      // Dorsal racing stripe (classic golden-back on Neocaridina)
      if (Math.abs(cz) < L * 0.022 && cy > L * 0.08) {
        const stripeAlpha = THREE.MathUtils.smoothstep(L * 0.022, 0.0, Math.abs(cz));
        tmp.lerp(cAccent, stripeAlpha * 0.65);
      }
      bCols[i * 3]     = tmp.r;
      bCols[i * 3 + 1] = tmp.g;
      bCols[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(bCols, 3));
    g.computeVertexNormals();
    body.push({ g, c: C.shell, n: 'shrimpCarapace' });
    body.push({ g: new THREE.ConeGeometry(L * 0.025, L * 0.25, 4).rotateZ(-Math.PI / 2).translate(L * 0.58, L * 0.08, 0), c: C.shell }); // rostrum
    [-1, 1].forEach(s => body.push({ g: new THREE.SphereGeometry(L * 0.04, 6, 5).translate(L * 0.4, L * 0.1, s * L * 0.07), c: C.eye }));
    // tail fan
    for (let k = 0; k < 5; k++) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(-L * 0.12, L * 0.05, -L * 0.2, 0); sh.quadraticCurveTo(-L * 0.12, -L * 0.03, 0, 0); body.push({ g: new THREE.ShapeGeometry(sh, 3).rotateX(Math.PI / 2).rotateY((k - 2) * 0.35).translate(-L * 0.5, L * 0.02 - (L * L * 0.25) * 9 / S + L * 0.12 - L * 0.12, 0), c: C.shellDark }); }
    // antennae
    [-1, 1].forEach(s => addTube(antennae, [[L * 0.45, L * 0.12, s * L * 0.04], [L * 0.8, L * 0.35, s * L * 0.2], [L * 1.2, L * 0.3, s * L * 0.4], [L * 1.5, L * 0.05, s * L * 0.5]], L * 0.012, L * 0.004, C.limb, 3, 10));
    [-1, 1].forEach(s => addTube(antennae, [[L * 0.45, L * 0.1, s * L * 0.03], [L * 0.7, L * 0.2, s * L * 0.12], [L * 0.9, L * 0.15, s * L * 0.2]], L * 0.01, L * 0.004, C.limb, 3, 6));
    antPivot = pivotFrom(antennae, 'antennae', merge, L * 0.45, L * 0.1, 0);
    // 5 pairs of walking legs
    for (let k = 0; k < 5; k++) [-1, 1].forEach(s => {
      const lx = L * (0.25 - k * 0.09), ll = [];
      addTube(ll, [[lx, L * 0.04, s * L * 0.05], [lx + L * 0.02, -L * 0.02, s * L * 0.14], [lx + L * 0.03, -L * 0.1, s * L * 0.17]], L * 0.009, L * 0.004, C.limb, 3, 5);
      const pv = pivotFrom(ll, 'legs', merge, lx, L * 0.04, s * L * 0.05); pv.userData.k = k; pv.userData.s = s; legPivots.push(pv);
    });
    root.userData.lift = L * 0.1;
  } else if (species === 'corydoras') {
    const L = 0.048 * S;
    const numRings = 24, radialSegs = 18;
    const pts = []; for (let i = 0; i <= numRings; i++) { const t = i / numRings; const r = Math.pow(Math.sin(Math.PI * (0.05 + Math.pow(t, 0.8) * 0.93)), 0.6); pts.push(new THREE.Vector2(Math.max(0.0001, (t < 0.1 ? Math.max(r, 0.25) : r) * L * 0.17), t * L - L / 2)); }
    pts[numRings].x = 0.0001;
    const g = new THREE.LatheGeometry(pts, radialSegs).rotateZ(-Math.PI / 2).scale(1, 1.25, 0.9).toNonIndexed();
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); if (y < 0) pa.setY(i, y * 0.45); }
    g.translate(0, L * 0.09, 0);

    const bCols = new Float32Array(pa.count * 3);
    const cShell = new THREE.Color(C.shell);
    const cDark = new THREE.Color(C.shellDark);
    const cBelly = new THREE.Color(C.belly);
    const cAccent = new THREE.Color(C.accent);
    const tmp = new THREE.Color();

    for (let i = 0; i < pa.count; i++) {
      const cx = pa.getX(i), cy = pa.getY(i);
      const u = (cx + L / 2) / L;

      // Creamy ventral belly
      tmp.copy(cBelly).lerp(cShell, THREE.MathUtils.smoothstep(cy, L * 0.04, L * 0.11));

      // Overlapping armored scute chevron pattern along flanks
      const chevron = Math.abs(Math.sin((cx / L) * 22.0 + (cy / L) * 11.0));
      if (chevron > 0.62 && cy > L * 0.06) {
        tmp.lerp(cDark, 0.38);
      }

      // Bandit mask across eye (characteristic dark slant across the head)
      const eyeBandDist = Math.abs((cx - L * 0.3) + (cy - L * 0.14) * 0.75);
      if (eyeBandDist < L * 0.052) {
        const maskAlpha = THREE.MathUtils.smoothstep(L * 0.052, 0.0, eyeBandDist);
        tmp.lerp(cAccent, maskAlpha * 0.85);
      }

      bCols[i * 3]     = tmp.r;
      bCols[i * 3 + 1] = tmp.g;
      bCols[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(bCols, 3));
    g.computeVertexNormals();
    body.push({ g, c: C.shell, n: 'coryBody' });
    [-1, 1].forEach(s => body.push({ g: new THREE.SphereGeometry(L * 0.04, 7, 5).translate(L * 0.3, L * 0.15, s * L * 0.075), c: C.eye }));
    const df = new THREE.Shape(); df.moveTo(L * 0.12, 0); df.lineTo(L * 0.06, L * 0.3); df.lineTo(-L * 0.08, 0.0); df.closePath();
    body.push({ g: new THREE.ShapeGeometry(df).translate(0, L * 0.2, 0), c: C.limb });
    const tf = new THREE.Shape(); tf.moveTo(0, 0); tf.lineTo(-L * 0.22, L * 0.13); tf.quadraticCurveTo(-L * 0.14, 0, -L * 0.22, -L * 0.13); tf.closePath();
    body.push({ g: new THREE.ShapeGeometry(tf, 4).translate(-L * 0.47, L * 0.1, 0), c: C.limb });
    [-1, 1].forEach(s => { const pf = new THREE.Shape(); pf.moveTo(0, 0); pf.lineTo(-L * 0.18, L * 0.04); pf.lineTo(-L * 0.12, -L * 0.04); pf.closePath(); const ll = [{ g: new THREE.ShapeGeometry(pf).rotateX(Math.PI / 2).rotateY(-s * 0.5).translate(L * 0.2, L * 0.05, s * L * 0.08), c: C.limb }]; const pv = pivotFrom(ll, 'legs', merge, L * 0.2, L * 0.05, s * L * 0.08); pv.userData.k = 0; pv.userData.s = s; legPivots.push(pv); });
    [-1, 1].forEach(s => { addTube(antennae, [[L * 0.48, L * 0.04, s * L * 0.02], [L * 0.55, L * 0.0, s * L * 0.05], [L * 0.6, -L * 0.02, s * L * 0.06]], L * 0.008, L * 0.003, C.accent, 3, 4); addTube(antennae, [[L * 0.47, L * 0.03, s * L * 0.03], [L * 0.52, -L * 0.02, s * L * 0.07]], L * 0.007, L * 0.003, C.accent, 3, 3); });
    antPivot = pivotFrom(antennae, 'antennae', merge, L * 0.47, L * 0.04, 0);
    root.userData.lift = L * 0.02;
  } else {
    // HERMIT CRAB: tapered conical helix shell (one continuous swept tube) + crab
    const R = 0.016 * S, turns = 3.2, Np = 40, pts = [];
    for (let i = 0; i <= Np; i++) { const t = i / Np, a = t * turns * Math.PI * 2, rr = R * (1 - t * 0.85); pts.push(new THREE.Vector3(Math.cos(a) * rr * 0.7 - R * 0.3, R * 0.9 + t * R * 1.6, Math.sin(a) * rr * 0.7)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const sg = new THREE.TubeGeometry(curve, 60, 1, 10, false), sp = sg.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i <= 60; i++) { const c = curve.getPointAt(i / 60), r = R * 0.62 * Math.pow(1 - i / 60, 1.25) + 0.0006; for (let j = 0; j <= 10; j++) { const k = i * 11 + j; v.fromBufferAttribute(sp, k).sub(c).multiplyScalar(r).add(c); sp.setXYZ(k, v.x, v.y, v.z); } }
    sg.rotateZ(-0.5);
    const a = sg.toNonIndexed().attributes.position.array, B = {};
    for (let i = 0; i < a.length; i += 9) { const cy = (a[i + 1] + a[i + 4] + a[i + 7]) / 3, cx = a[i]; const k = Math.sin(cy * 900 / S + cx * 300) > 0.4 ? 'spiral' : 'accent'; (B[k] ||= []).push(...a.slice(i, i + 9)); }
    for (const [k, arr] of Object.entries(B)) { const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3)); body.push({ g: bg, c: C[k] }); }
    // crab front: cephalothorax + claws
    body.push({ g: new THREE.SphereGeometry(R * 0.4, 8, 6).scale(1.2, 0.8, 1).translate(R * 0.55, R * 0.6, 0), c: C.shell });
    body.push({ g: new THREE.SphereGeometry(R * 0.38, 8, 6).scale(1.4, 0.8, 0.9).translate(R * 1.05, R * 0.45, R * 0.35), c: C.shell }); // major claw
    body.push({ g: new THREE.ConeGeometry(R * 0.12, R * 0.5, 5).rotateZ(-Math.PI / 2).translate(R * 1.55, R * 0.5, R * 0.35), c: C.shellDark });
    body.push({ g: new THREE.SphereGeometry(R * 0.25, 7, 5).scale(1.4, 0.8, 0.9).translate(R * 0.95, R * 0.4, -R * 0.3), c: C.shell });
    [-1, 1].forEach(s => { addTube(antennae, [[R * 0.7, R * 0.75, s * R * 0.12], [R * 0.85, R * 1.05, s * R * 0.18]], R * 0.04, R * 0.035, C.limb, 4, 3); antennae.push({ g: new THREE.SphereGeometry(R * 0.07, 6, 5).translate(R * 0.86, R * 1.08, s * R * 0.18), c: C.eye }); addTube(antennae, [[R * 0.75, R * 0.7, s * R * 0.05], [R * 1.2, R * 1.1, s * R * 0.3], [R * 1.7, R * 0.9, s * R * 0.5]], R * 0.02, R * 0.01, C.limb, 3, 6); });
    antPivot = pivotFrom(antennae, 'antennae', merge, R * 0.7, R * 0.75, 0);
    for (let k = 0; k < 2; k++) [-1, 1].forEach(s => { const lx = R * (0.55 - k * 0.25), ll = []; addTube(ll, [[lx, R * 0.5, s * R * 0.3], [lx + R * 0.2, R * 0.6, s * R * 0.75], [lx + R * 0.35, 0.0, s * R * 0.95]], R * 0.07, R * 0.03, k ? C.limb : C.belly, 4, 6); const pv = pivotFrom(ll, 'legs', merge, lx, R * 0.5, s * R * 0.3); pv.userData.k = k; pv.userData.s = s; legPivots.push(pv); });
    root.userData.lift = 0;
  }
  const bm = finish(body, MAT, 'body', merge); if (bm) root.add(bm);
  if (antPivot) root.add(antPivot);
  const lg = new THREE.Group(); lg.name = 'legs'; legPivots.forEach(pv => lg.add(pv)); root.add(lg);
  return { root, antPivot, legPivots };
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const cw = p.colorway === 'auto' ? ({ shrimp: 'cherry', corydoras: 'bronze-cory', hermit: 'reef-hermit' }[p.species]) : p.colorway;
  const C = zonesFor(cw, userParams);
  const merge = !!p.mergeForProduction;
  const rnd = rng(p.seed);
  const heightAt = typeof userParams.heightAt === 'function' ? userParams.heightAt : () => 0;
  const mask = typeof userParams.mask === 'function' ? userParams.mask : () => true;
  const area = userParams.area || { minX: -0.4, maxX: 0.4, minZ: -0.15, maxZ: 0.15 };
  const baseSpeed = { shrimp: 0.012, corydoras: 0.03, hermit: 0.008 }[p.species] || 0.015;

  const g = new THREE.Group(); g.name = 'fauna-bottom-dwellers';
  const crew = [];
  const randPt = () => { for (let k = 0; k < 20; k++) { const x = THREE.MathUtils.lerp(area.minX, area.maxX, rnd()), z = THREE.MathUtils.lerp(area.minZ, area.maxZ, rnd()); if (mask(x, z)) return [x, z]; } return [(area.minX + area.maxX) / 2, (area.minZ + area.maxZ) / 2]; };
  for (let i = 0; i < p.population; i++) {
    const c = buildCritter(p.species, C, merge, p.scale * (0.8 + rnd() * 0.4), rnd);
    const [x, z] = randPt();
    Object.assign(c, { x, z, heading: rnd() * 6.28, target: randPt(), pause: rnd() * 2, ph: rnd() * 10, moving: 0 });
    crew.push(c); g.add(c.root);
  }
  const n = new THREE.Vector3(), f = new THREE.Vector3(), sd = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const place = (c) => {
    const e = 0.01, y = heightAt(c.x, c.z);
    n.set(heightAt(c.x - e, c.z) - heightAt(c.x + e, c.z), 2 * e, heightAt(c.x, c.z - e) - heightAt(c.x, c.z + e)).normalize();
    f.set(Math.cos(c.heading), 0, -Math.sin(c.heading)); f.addScaledVector(n, -f.dot(n)).normalize();
    sd.crossVectors(f, n).normalize();
    m4.makeBasis(f, n, sd); q.setFromRotationMatrix(m4);
    c.root.quaternion.slerp(q, 0.25);
    c.root.position.set(c.x, y + (c.root.userData.lift || 0) * 0.2, c.z);
  };
  crew.forEach(c => { place(c); c.root.quaternion.copy(q); });

  g.userData = {
    positions: () => crew.map(c => c.root.position),
    setRig(name, v) { crew.forEach(c => { if (name === 'antennae' && c.antPivot) c.antPivot.rotation.z = THREE.MathUtils.degToRad(v); if (name === 'legs') c.legPivots.forEach(pv => { pv.rotation.x = THREE.MathUtils.degToRad(v); }); }); },
    update(t, dt = 0.016) {
      dt = Math.min(dt, 0.05);
      for (const c of crew) {
        if (c.pause > 0) { c.pause -= dt; c.moving = Math.max(0, c.moving - dt * 3); }
        else {
          const dx = c.target[0] - c.x, dz = c.target[1] - c.z, d = Math.hypot(dx, dz);
          if (d < 0.01) { c.target = randPt(); c.pause = 0.5 + rnd() * (p.species === 'corydoras' ? 1.5 : 4); }
          else {
            const want = Math.atan2(-dz, dx); let dh = want - c.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
            c.heading += dh * Math.min(1, dt * 3);
            const sp = baseSpeed * p.speed * (Math.abs(dh) < 0.8 ? 1 : 0.3);
            const nx = c.x + Math.cos(c.heading) * sp * dt, nz = c.z - Math.sin(c.heading) * sp * dt;
            if (mask(nx, nz)) { c.x = nx; c.z = nz; } else { c.target = randPt(); }
            c.moving = Math.min(1, c.moving + dt * 3);
          }
        }
        // separation: never pile onto a neighbour
        for (const o2 of crew) {
          if (o2 === c) continue;
          const dx = c.x - o2.x, dz = c.z - o2.z, d2 = dx * dx + dz * dz;
          if (d2 < 0.0012 && d2 > 1e-10) {
            const d = Math.sqrt(d2), push = (0.035 - d) * Math.min(1, dt * 5);
            const nx = c.x + dx / d * push, nz = c.z - dz / d * push;
            if (mask(nx, nz)) { c.x = nx; c.z = nz; }
          }
        }
        place(c);
        if (c.antPivot) { c.antPivot.rotation.z = Math.sin(t * 9 + c.ph) * 0.12 + (Math.sin(t * 23 + c.ph * 3) > 0.92 ? 0.25 : 0); c.antPivot.rotation.y = Math.sin(t * 3.1 + c.ph) * 0.15; }
        c.legPivots.forEach(pv => { pv.rotation.x = pv.userData.s * Math.sin(t * 16 + pv.userData.k * 1.3 + (pv.userData.s > 0 ? 0 : Math.PI)) * 0.35 * (0.15 + c.moving); });
      }
    }
  };
  return g;
}

export default createAsset;
