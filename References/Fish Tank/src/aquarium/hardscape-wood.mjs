/*
 * HARDSCAPE WOOD (High Detail)
 * Parametric sunken driftwood for three.js: smooth tapered swept-tube branches grown recursively
 * (spider roots, chunky mopani, elegant manzanita), moss cushions, catappa leaf litter.
 * Exposes userData.tips / userData.gaps for coral, moss and fish routing.
 *
 * QUICK START
 *   import { createAsset } from './hardscape-wood.mjs';
 *   scene.add(createAsset({ woodType: 'spider', complexity: 6, weathering: 'moss' }));
 *
 * PARAMS  woodType: spider | mopani | manzanita ; complexity 1-10 ; weathering: clean | tannin | moss
 *         size 0.4-1.6, tanninLeach toggle, seed
 * SPECS  ~2,000-9,000 triangles, 1 material, ~0.45 x 0.35 x 0.3 m default.
 * PARTS  animate: none (static)
 *        detach: moss, leafLitter
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  wood: '#6b4a32', woodLight: '#9a7350', woodDark: '#3e2a1c', moss: '#3f7a2a',
  mossLight: '#6aa83a', leaf: '#8a4a22', leafDark: '#5a2e14', knot: '#2e1e14'
};

export const COLORWAYS = {
  'default':    { ...BASE },
  'blackwater': { wood: '#3a2416', woodLight: '#5c3a22', woodDark: '#22140c', moss: '#355e22', mossLight: '#4f7f2c', leaf: '#7a3c18', leafDark: '#4a220e', knot: '#180e08' },
  'bleached':   { wood: '#cbbfae', woodLight: '#e4dccf', woodDark: '#9c8f7e', moss: '#5a8a3a', mossLight: '#82b050', leaf: '#a86a3a', leafDark: '#7a4a22', knot: '#6e6254' },
  'manzanita':  { wood: '#7a3a26', woodLight: '#a85a3a', woodDark: '#4a2014', moss: '#3e7a2a', mossLight: '#68a83c', leaf: '#8a4a22', leafDark: '#5a2e14', knot: '#2a120a' },
  'neon':       { wood: '#2a2a34', woodLight: '#40404e', woodDark: '#18181e', moss: '#30ffb0', mossLight: '#a0ff40', leaf: '#ff40c0', leafDark: '#8020a0', knot: '#101014' }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge per material or keep selectable branches.' },
  colorway:    { type: 'choice', default: 'default', options: Object.keys(COLORWAYS), label: 'Palette', affects: 'colors', describe: 'Wood tone.' },
  woodType:    { type: 'choice', default: 'spider', options: ['spider', 'mopani', 'manzanita'], label: 'Wood Type', affects: 'geometry', describe: 'Spider roots, Mopani stumps, Manzanita branches.' },
  complexity:  { type: 'range', default: 5, min: 1, max: 10, step: 1, label: 'Complexity', affects: 'geometry', describe: 'Single stump to tangled labyrinth.' },
  weathering:  { type: 'choice', default: 'clean', options: ['clean', 'tannin', 'moss'], label: 'Weathering', affects: 'geometry', describe: 'Clean, tannin-stained or moss-covered.' },
  size:        { type: 'range', default: 1, min: 0.4, max: 1.6, step: 0.05, label: 'Size', affects: 'geometry', describe: 'Overall spread multiplier (rebuilds lengths, not scaling).' },
  tanninLeach: { type: 'toggle', default: false, label: 'Tannin Leach', affects: 'colors', describe: 'Signals amber water tint (userData.tannin) and adds leaf litter.' },
  seed:        { type: 'range', default: 11, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Growth seed.' }
};

export const rig = {};
export const detach = ['moss', 'leafLitter'];
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
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });

function finish(list, material = MAT, name = 'solid', merge = true) {
  if (list.length === 0) return null;
  if (merge) {
    const merged = mergeGeometries(list.map(p => prep(p.g, p.c)));
    if (!merged) return null;
    merged.computeVertexNormals();
    const m = new THREE.Mesh(merged, material);
    m.name = name; m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  const g = new THREE.Group();
  g.name = name;
  list.forEach((p, i) => {
    const geo = prep(p.g, p.c);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.name = p.n ? `${name}_${p.n}_${i + 1}` : `${name}_part_${i + 1}`;
    m.castShadow = true; m.receiveShadow = true;
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

// Smooth tapered swept branch: TubeGeometry with per-ring radius rewritten (shared ring vertices = watertight)
function addBranch(list, pts, r0, r1, hex, radial = 6, segs = 12, gnarl = 0, rnd = Math.random) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  const bumps = Array.from({ length: segs + 1 }, () => 1 + (rnd() - 0.5) * gnarl);
  for (let i = 0; i <= segs; i++) {
    const c = curve.getPointAt(i / segs);
    const t = i / segs, r = (r0 + (r1 - r0) * Math.pow(t, 0.8)) * bumps[i];
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r * (1 + gnarl * 0.3 * Math.sin(j * 2.1 + i))).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  list.push({ g: geo, c: hex, n: 'branch' });
  const tip = curve.getPointAt(1);
  list.push({ g: new THREE.IcosahedronGeometry(Math.max(r1, 0.0012), 0).translate(tip.x, tip.y, tip.z), c: hex, n: 'tipCap' });
  return curve;
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const cwName = userParams.colorway || (p.weathering === 'tannin' ? 'blackwater' : p.woodType === 'manzanita' ? 'manzanita' : 'default');
  const C = zonesFor(cwName, userParams);
  const merge = !!p.mergeForProduction;
  const rnd = rng(p.seed);
  const S = p.size;
  const groundFn = typeof userParams.groundFn === 'function' ? userParams.groundFn : () => 0;

  const g = new THREE.Group(); g.name = 'hardscape-wood';
  const wood = [], moss = [], litter = [];
  const tips = [], gaps = [], mossSpots = [];
  const tone = () => { const r = rnd(); return r < 0.5 ? C.wood : r < 0.8 ? C.woodLight : C.woodDark; };
  const rv = () => new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);

  const cfg = {
    spider:    { roots: 3 + p.complexity * 2, len: 0.2, r: 0.009, depth: 2, twist: 0.9, up: 0.25, child: 2, radial: 5, gnarl: 0.15 },
    mopani:    { roots: 1 + Math.ceil(p.complexity * 0.6), len: 0.15, r: 0.032, depth: 1, twist: 0.5, up: 0.4, child: 2, radial: 8, gnarl: 0.35 },
    manzanita: { roots: 1 + Math.ceil(p.complexity * 0.4), len: 0.26, r: 0.016, depth: 3, twist: 0.35, up: 0.7, child: 2, radial: 6, gnarl: 0.08 }
  }[p.woodType] || null;

  const grow = (start, dir, len, r, depth, hex) => {
    const n = 4, pts = [start.clone()];
    let pp = start.clone(); const d = dir.clone();
    for (let k = 1; k <= n; k++) {
      d.addScaledVector(rv(), cfg.twist).normalize();
      d.y += cfg.up * 0.35; d.normalize();
      pp = pp.clone().addScaledVector(d, len / n);
      const gy = groundFn(pp.x, pp.z) + r * 0.6;
      if (pp.y < gy) pp.y = gy; // never sink below the substrate
      pts.push(pp);
    }
    const rEnd = depth > 0 ? r * 0.55 : Math.max(0.0015, r * 0.25);
    const curve = addBranch(wood, pts, r, rEnd, hex, depth > 1 ? cfg.radial : Math.max(4, cfg.radial - 1), 12, cfg.gnarl, rnd);
    tips.push(pp.clone());
    // moss on upper side
    if (p.weathering === 'moss') for (let k = 0; k < 3; k++) { const q = curve.getPointAt(0.2 + rnd() * 0.7); mossSpots.push([q, r * (1.2 + rnd())]); }
    if (p.woodType === 'mopani' && rnd() > 0.3) { const q = curve.getPointAt(0.3 + rnd() * 0.4); wood.push({ g: new THREE.IcosahedronGeometry(r * 0.8, 1).scale(1, 0.8, 1.1).translate(q.x, q.y, q.z), c: C.knot, n: 'knot' }); }
    if (pp.y > 0.08) { const mid = curve.getPointAt(0.5); gaps.push(mid.clone().add(new THREE.Vector3(0, 0.04, 0.03))); }
    if (depth > 0) {
      const kids = cfg.child + (rnd() > 0.6 ? 1 : 0);
      for (let c = 0; c < kids; c++) {
        const at = curve.getPointAt(0.45 + rnd() * 0.5);
        const nd = d.clone().addScaledVector(rv(), 1.4).normalize(); nd.y = Math.abs(nd.y) * 0.7 + 0.2; nd.normalize();
        grow(at, nd, len * (0.55 + rnd() * 0.2), rEnd * (0.85 + rnd() * 0.2), depth - 1, rnd() > 0.7 ? tone() : hex);
      }
    }
  };

  // central crown for spider wood (where the roots knot together)
  if (p.woodType === 'spider') {
    const cy = 0.06 * S + groundFn(0, 0);
    wood.push({ g: new THREE.IcosahedronGeometry(0.022 * S, 1).scale(1.3, 0.8, 1).translate(0, cy, 0), c: C.woodDark, n: 'crown' });
    for (let i = 0; i < cfg.roots; i++) {
      const a = (i / cfg.roots) * Math.PI * 2 + rnd() * 0.5;
      const down = i % 3 === 0;
      const dir = new THREE.Vector3(Math.cos(a), down ? -0.5 : 0.35 + rnd() * 0.6, Math.sin(a) * 0.8).normalize();
      grow(new THREE.Vector3(0, cy, 0), dir, cfg.len * S * (0.8 + rnd() * 0.6), cfg.r * S * (0.8 + rnd() * 0.5), down ? 1 : cfg.depth, tone());
    }
  } else if (p.woodType === 'mopani') {
    for (let i = 0; i < cfg.roots; i++) {
      const a = rnd() * Math.PI * 2, rr = i === 0 ? 0 : 0.06 * S * (0.5 + rnd());
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr * 0.7;
      const base = new THREE.Vector3(x, groundFn(x, z) - 0.01, z);
      const dir = new THREE.Vector3((rnd() - 0.5) * 0.9, 1, (rnd() - 0.5) * 0.6).normalize();
      grow(base, dir, cfg.len * S * (0.8 + rnd() * 0.7), cfg.r * S * (0.7 + rnd() * 0.5), cfg.depth, tone());
      // buttress root flare (smooth lathe)
      const prof = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6; prof.push(new THREE.Vector2(cfg.r * S * (1.9 - t * 0.95), t * 0.035 * S)); }
      prof.push(new THREE.Vector2(0, 0.035 * S));
      wood.push({ g: new THREE.LatheGeometry(prof, 9).translate(x, base.y, z), c: C.woodDark, n: 'rootFlare' });
    }
  } else {
    for (let i = 0; i < cfg.roots; i++) {
      const x = (rnd() - 0.5) * 0.1 * S, z = (rnd() - 0.5) * 0.06 * S;
      const base = new THREE.Vector3(x, groundFn(x, z) - 0.008, z);
      const dir = new THREE.Vector3((rnd() - 0.5) * 0.5, 1, (rnd() - 0.5) * 0.4).normalize();
      grow(base, dir, cfg.len * S * (0.8 + rnd() * 0.4), cfg.r * S * (0.85 + rnd() * 0.3), cfg.depth, tone());
    }
  }

  // moss cushions (soft icosa blobs hugging the branch tops)
  mossSpots.forEach(([q, r], i) => {
    const geo = new THREE.IcosahedronGeometry(r * 1.4, 1).scale(1.4, 0.55, 1.2).translate(q.x, q.y + r * 0.7, q.z);
    moss.push({ g: geo, c: i % 3 ? C.moss : C.mossLight, n: 'mossCushion' });
  });

  // catappa leaf litter
  if (p.tanninLeach || p.weathering === 'tannin') {
    for (let i = 0; i < 14; i++) {
      const L = 0.04 + rnd() * 0.04, Wd = L * 0.45;
      const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(Wd, L * 0.4, 0, L); s.quadraticCurveTo(-Wd, L * 0.4, 0, 0);
      const geo = new THREE.ShapeGeometry(s, 6).rotateX(-Math.PI / 2 + (rnd() - 0.5) * 0.3).rotateY(rnd() * 6.28);
      const x = (rnd() - 0.5) * 0.35 * S, z = (rnd() - 0.5) * 0.25 * S;
      geo.translate(x, groundFn(x, z) + 0.002, z);
      litter.push({ g: geo, c: rnd() > 0.5 ? C.leaf : C.leafDark, n: 'catappaLeaf' });
      addWire(litter, [x, groundFn(x, z) + 0.002, z], [x + 0.004, groundFn(x, z) + 0.003, z + 0.006], C.leafDark, 0.0008, 3);
    }
  }

  const w = finish(wood, MAT, 'driftwood', merge); if (w) g.add(w);
  const mg = new THREE.Group(); mg.name = 'moss'; const mm = finish(moss, MAT, 'moss', merge); if (mm) mg.add(mm); g.add(mg);
  const lg = new THREE.Group(); lg.name = 'leafLitter'; const lm = finish(litter, MAT, 'leaves', merge); if (lm) lg.add(lm); g.add(lg);

  let top = 0; tips.forEach(t => { top = Math.max(top, t.y); });
  g.userData = {
    tips, gaps, top,
    tannin: (p.tanninLeach || p.weathering === 'tannin') ? '#9a6224' : null,
    setRig(name, v) { if (name === 'moss') mg.visible = !!v; if (name === 'leafLitter') lg.visible = !!v; },
    update() {}
  };
  return g;
}

export default createAsset;
