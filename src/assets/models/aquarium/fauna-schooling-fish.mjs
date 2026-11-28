/*
 * FAUNA SCHOOLING FISH (High Detail)
 * Parametric shoal for three.js: Neon Tetra, Cardinal, Harlequin Rasbora, Guppy, Chromis and GloFish
 * built from smooth lathe bodies with lateral-line colour zones, rigged flicking tails, travelling
 * a closed figure-eight Catmull-Rom (B-spline) path in tight-sphere, loose-stream or chaotic formations.
 *
 * QUICK START
 *   import { createAsset } from './fauna-schooling-fish.mjs';
 *   const school = createAsset({ species: 'neon', schoolSize: 40, center: [0, 0.25, 0] });
 *   scene.add(school); // loop: school.userData.update(t, dt)
 *
 * PARAMS  species: neon | cardinal | harlequin | guppy | chromis | glofish ; schoolSize 10-120
 *         formationBehavior: sphere | stream | scatter ; speed ; pathWidth/Height/Depth ; glow ; seed
 * SPECS  ~180-260 triangles per fish, 2 materials, 0.035-0.06 m per fish.
 * PARTS  animate: tails (y flick), school (spline travel)
 *        detach: tails
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = { back: '#8aa0a8', stripe: '#20c8ff', belly: '#ff2a3a', under: '#e8eef0', fin: '#e8f0f0', accent: '#101010', eye: '#c0c8d0' };

export const COLORWAYS = {
  'default':   { ...BASE },
  'neon':      { ...BASE },
  'cardinal':  { back: '#6a8a9a', stripe: '#30d8ff', belly: '#ff1a2a', under: '#ff3a3a', fin: '#f0e8e8', accent: '#1a1a1a', eye: '#d0d8e0' },
  'harlequin': { back: '#d87a5a', stripe: '#ffb08a', belly: '#ff9a6a', under: '#f0c8b0', fin: '#ff8a5a', accent: '#141018', eye: '#d0b0a0' },
  'guppy':     { back: '#7a9a6a', stripe: '#40e0ff', belly: '#ff8a2a', under: '#e8e0c8', fin: '#ff4a8a', accent: '#3a3aff', eye: '#d0d0b0' },
  'chromis':   { back: '#2ab0a8', stripe: '#6af0e0', belly: '#a8f0e8', under: '#d0fff8', fin: '#40c8c0', accent: '#1a6a8a', eye: '#202020' },
  'glofish':   { back: '#ff3ac8', stripe: '#ffe82a', belly: '#ff7ae0', under: '#ffb0f0', fin: '#ff60d8', accent: '#30f0ff', eye: '#ffffff' },
  'copper':    { back: '#b8682a', stripe: '#ffcf5a', belly: '#ff8a2a', under: '#f0d0a0', fin: '#e8a050', accent: '#3a1a0a', eye: '#ffd080' }
};

export const presets = COLORWAYS;

const SPEC = {
  neon:      { L: 0.034, hr: 0.26, tr: 0.15, tail: 'fork', cw: 'neon' },
  cardinal:  { L: 0.038, hr: 0.27, tr: 0.15, tail: 'fork', cw: 'cardinal' },
  harlequin: { L: 0.042, hr: 0.33, tr: 0.15, tail: 'fork', cw: 'harlequin' },
  guppy:     { L: 0.035, hr: 0.25, tr: 0.17, tail: 'fan', cw: 'guppy' },
  chromis:   { L: 0.06, hr: 0.45, tr: 0.18, tail: 'fork', cw: 'chromis' },
  glofish:   { L: 0.04, hr: 0.3, tr: 0.16, tail: 'fork', cw: 'glofish' }
};

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge each fish body into one mesh; tails stay rigged.' },
  colorway:          { type: 'choice', default: 'auto', options: ['auto', ...Object.keys(COLORWAYS)], label: 'Palette', affects: 'colors', describe: 'auto follows species.' },
  species:           { type: 'choice', default: 'neon', options: Object.keys(SPEC), label: 'Species', affects: 'geometry', describe: 'Shoaling species.' },
  schoolSize:        { type: 'range', default: 36, min: 10, max: 120, step: 1, label: 'School Size', affects: 'geometry', describe: 'Number of fish.' },
  formationBehavior: { type: 'choice', default: 'sphere', options: ['sphere', 'stream', 'scatter'], label: 'Formation', affects: 'geometry', describe: 'Tight sphere, loose stream, chaotic scatter.' },
  speed:             { type: 'range', default: 1, min: 0.2, max: 3, step: 0.1, label: 'Speed', affects: 'geometry', describe: 'Travel speed.' },
  pathWidth:         { type: 'range', default: 0.38, min: 0.1, max: 1.2, step: 0.01, label: 'Path Width', affects: 'geometry', describe: 'Figure-eight X half-extent (m).' },
  pathDepth:         { type: 'range', default: 0.12, min: 0.03, max: 0.5, step: 0.01, label: 'Path Depth', affects: 'geometry', describe: 'Figure-eight Z extent (m).' },
  pathHeight:        { type: 'range', default: 0.06, min: 0, max: 0.3, step: 0.01, label: 'Path Height', affects: 'geometry', describe: 'Vertical undulation (m).' },
  glow:              { type: 'range', default: 0.25, min: 0, max: 1.5, step: 0.05, label: 'Iridescence', affects: 'colors', describe: 'Emissive stripe glow.' },
  seed:              { type: 'range', default: 23, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Formation seed.' }
};

export const rig = { tails: { axis: 'y', range: [-30, 30], describe: 'Tails flick rapidly.' } };
export const detach = ['tails'];
export const night = { stripe: { color: '#20c8ff', intensity: 0.3, distance: 0.1, describe: 'Iridescent stripe.' } };

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

function glowMat(glow, fin) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: false,
    roughness: 0.3,
    metalness: 0.22,
    side: THREE.DoubleSide,
    transparent: !!fin,
    opacity: fin ? 0.8 : 1
  });
  const u = { uGlow: { value: glow } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = u.uGlow;
    sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * uGlow;');
  };
  mat.customProgramCacheKey = () => 'school-glow-' + (fin ? 'f' : 'b');
  mat.userData.uniforms = u;
  return mat;
}
const MAT = glowMat(0.2, false);

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

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function colorSchoolFin(geo, cRootHex, cTipHex) {
  if (geo.index) geo = geo.toNonIndexed();
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (geo.attributes.normal) geo.deleteAttribute('normal');
  const pos = geo.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const cr = new THREE.Color(cRootHex);
  const ct = new THREE.Color(cTipHex);
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < n; i++) { const x = pos.getX(i); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  const span = Math.max(1e-4, maxX - minX);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const t = THREE.MathUtils.clamp((pos.getX(i) - minX) / span, 0, 1);
    c.copy(cr).lerp(ct, t * 0.85);
    col[i * 3]     = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Body template geometry with continuous organic per-vertex coloration
function bodyTemplate(sp, species, C) {
  const L = sp.L, prof = (t) => { const r = Math.pow(Math.max(0, Math.sin(Math.PI * (0.05 + Math.pow(t, 0.85) * 0.93))), 0.7); return t < 0.12 ? Math.max(r, 0.18) : r; };
  const halfH = (x) => prof((x + L / 2) / L) * L * 0.5 * sp.hr;

  const numRings = 26;
  const radialSegs = 18;
  const pts = [];
  for (let i = 0; i <= numRings; i++) {
    const t = i / numRings;
    pts.push(new THREE.Vector2(Math.max(0.0001, prof(t) * L * 0.5), t * L - L / 2));
  }
  pts[numRings].x = 0.0001;

  const bodyGeo = new THREE.LatheGeometry(pts, radialSegs).rotateZ(-Math.PI / 2).scale(1, sp.hr, sp.tr).toNonIndexed();
  const bPos = bodyGeo.attributes.position;
  const bCount = bPos.count;
  const bCols = new Float32Array(bCount * 3);

  const cBack = new THREE.Color(C.back);
  const cStripe = new THREE.Color(C.stripe);
  const cBelly = new THREE.Color(C.belly);
  const cUnder = new THREE.Color(C.under);
  const cAccent = new THREE.Color(C.accent);
  const cTemp = new THREE.Color();

  for (let i = 0; i < bCount; i++) {
    const x = bPos.getX(i), y = bPos.getY(i);
    const u = THREE.MathUtils.clamp((x + L / 2) / L, 0, 1);
    const hh = Math.max(1e-4, halfH(x));
    const v = THREE.MathUtils.clamp(y / hh, -1, 1);

    // Natural biological counter-shading
    const vNorm = THREE.MathUtils.clamp((v + 1) * 0.5, 0, 1);
    cTemp.copy(cUnder).lerp(cBack, Math.pow(vNorm, 1.2));

    if (species === 'neon' || species === 'cardinal') {
      // Electric neon-cyan lateral stripe (curved, tapered, glowing)
      const stripeCenterV = 0.12 - 0.04 * (1.0 - u);
      const distV = Math.abs(v - stripeCenterV);
      const isLength = u >= 0.16 && u <= 0.86;
      if (isLength) {
        const sFalloff = THREE.MathUtils.smoothstep(0.24, 0.02, distV) * THREE.MathUtils.smoothstep(0.16, 0.26, u) * THREE.MathUtils.smoothstep(0.86, 0.76, u);
        const glowCyan = cStripe.clone().lerp(new THREE.Color('#ffffff'), 0.28);
        cTemp.lerp(glowCyan, sFalloff * 0.95);
      }

      // Brilliant crimson-red belly
      const redFrontLimit = species === 'cardinal' ? 0.86 : 0.62;
      const redStartU = 0.12;
      if (u >= redStartU && u <= redFrontLimit && v < 0.08) {
        const rFalloff = THREE.MathUtils.smoothstep(0.08, -0.26, v) * THREE.MathUtils.smoothstep(redStartU, redStartU + 0.08, u) * THREE.MathUtils.smoothstep(redFrontLimit, redFrontLimit - 0.1, u);
        cTemp.lerp(cBelly, rFalloff * 0.92);
      }
    } else if (species === 'harlequin') {
      // Harlequin Rasbora: characteristic organic black triangular patch on posterior flank
      const inWedgeU = u >= 0.14 && u <= 0.58;
      if (inWedgeU) {
        const maxV = (0.58 - u) * 1.55;
        const distToWedge = Math.abs(v + 0.08) - maxV;
        if (distToWedge < 0.0) {
          const wAlpha = THREE.MathUtils.smoothstep(0.0, -0.07, distToWedge);
          cTemp.lerp(cAccent, wAlpha * 0.92);
        } else if (distToWedge < 0.12) {
          // Coppery-orange glow halo bordering the black wedge
          const glowAlpha = THREE.MathUtils.smoothstep(0.12, 0.0, distToWedge);
          cTemp.lerp(cStripe, glowAlpha * 0.7);
        }
      }
    } else if (species === 'glofish') {
      // GloFish: intense fluorescent lateral sheen with countershading
      const glowLine = THREE.MathUtils.smoothstep(0.32, 0.0, Math.abs(v));
      cTemp.copy(cBack).lerp(cStripe, glowLine * 0.88).lerp(cBelly, THREE.MathUtils.smoothstep(0.0, -0.7, v) * 0.7);
    } else if (species === 'guppy') {
      // Guppy: iridescent flank with soft counter-shading
      if (u < 0.52 && v < 0.1) cTemp.lerp(cBelly, 0.8);
      if (u > 0.22 && u < 0.78 && Math.abs(v) < 0.3) cTemp.lerp(cStripe, 0.55);
    } else if (species === 'chromis') {
      // Chromis: shimmering blue-green metallic dorsal with silvery belly
      cTemp.copy(cUnder).lerp(cBack, Math.pow(vNorm, 1.4));
      if (Math.abs(v) < 0.25 && u > 0.18 && u < 0.82) cTemp.lerp(cStripe, 0.45);
    }

    bCols[i * 3]     = cTemp.r;
    bCols[i * 3 + 1] = cTemp.g;
    bCols[i * 3 + 2] = cTemp.b;
  }
  bodyGeo.setAttribute('color', new THREE.BufferAttribute(bCols, 3));
  bodyGeo.computeVertexNormals();

  const list = [{ g: bodyGeo, c: C.back, n: 'body' }];

  const ex = L * 0.34, ez = (halfH(ex) / sp.hr) * sp.tr * 0.85;
  [-1, 1].forEach(s => list.push({ g: new THREE.SphereGeometry(L * 0.06, 8, 6).scale(1, 1, 0.5).translate(ex, halfH(ex) * 0.2, s * ez), c: C.eye, n: 'eye' }));

  // dorsal + anal fins with soft root-to-tip gradients
  const fins = [];
  const df = new THREE.Shape(); df.moveTo(L * 0.05, halfH(L * 0.05) * 0.85); df.lineTo(-L * 0.05, halfH(0) + L * 0.12); df.lineTo(-L * 0.12, halfH(-L * 0.12) * 0.85); df.closePath();
  const af = new THREE.Shape(); af.moveTo(L * 0.0, -halfH(0) * 0.85); af.lineTo(-L * 0.1, -halfH(0) - L * 0.09); af.lineTo(-L * 0.22, -halfH(-L * 0.22) * 0.85); af.closePath();
  fins.push({ g: colorSchoolFin(new THREE.ShapeGeometry(df, 6), C.back, C.fin), c: C.fin, n: 'dorsal' }, { g: colorSchoolFin(new THREE.ShapeGeometry(af, 6), C.under, C.fin), c: C.fin, n: 'anal' });

  // tail with soft root-to-fan gradient
  const tl = sp.tail === 'fan' ? L * 0.55 : L * 0.28, th = sp.tail === 'fan' ? L * 0.32 : L * 0.2, p0 = halfH(-L / 2 + L * 0.06);
  const ts = new THREE.Shape(); ts.moveTo(0, p0 * 0.9);
  if (sp.tail === 'fan') { ts.quadraticCurveTo(-tl * 0.6, th * 1.2, -tl, th * 0.6); ts.quadraticCurveTo(-tl * 1.1, 0, -tl, -th * 0.6); ts.quadraticCurveTo(-tl * 0.6, -th * 1.2, 0, -p0 * 0.9); }
  else { ts.lineTo(-tl, th); ts.quadraticCurveTo(-tl * 0.55, 0, -tl, -th); ts.lineTo(0, -p0 * 0.9); }
  ts.closePath();
  const tailBaseColor = species === 'guppy' || species === 'harlequin' ? C.fin : species === 'chromis' ? C.back : C.fin;
  const tailGeo = colorSchoolFin(new THREE.ShapeGeometry(ts, 8), C.back, tailBaseColor);
  const tail = [{ g: tailGeo, c: tailBaseColor, n: 'caudal' }];
  if (species === 'guppy') tail.push({ g: new THREE.ShapeGeometry(ts, 6).scale(0.6, 0.6, 1).translate(-tl * 0.35, 0, 0.0003), c: C.accent, n: 'tailSpot' });

  return { list, fins, tail, tailX: -L / 2 + L * 0.06, L };
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const sp = SPEC[p.species] || SPEC.neon;
  const C = zonesFor(p.colorway === 'auto' ? sp.cw : p.colorway, userParams);
  const merge = !!p.mergeForProduction;
  const rnd = rng(p.seed);
  const center = userParams.center || [0, 0.25, 0];
  const heightAt = typeof userParams.heightAt === 'function' ? userParams.heightAt : null;
  const bounds = userParams.bounds || null;
  const contains = typeof userParams.contains === 'function' ? userParams.contains : null;
  const avoidFn = typeof userParams.avoid === 'function' ? userParams.avoid : null;
  const glow = p.species === 'glofish' ? Math.max(p.glow, 0.6) : p.glow;
  const bodyMat = glowMat(glow * 0.5, false), finMat = glowMat(glow * 0.3, true);

  // closed figure-eight spline
  const ctrl = [];
  for (let i = 0; i < 16; i++) {
    const s = i / 16 * Math.PI * 2;
    ctrl.push(new THREE.Vector3(center[0] + Math.sin(s) * p.pathWidth, center[1] + Math.sin(s * 2 + 0.7) * p.pathHeight * 0.5 + Math.sin(s) * p.pathHeight * 0.3, center[2] + Math.sin(s) * Math.cos(s) * p.pathDepth * 2));
  }
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
  const len = curve.getLength();

  const T = bodyTemplate(sp, p.species, C);
  const g = new THREE.Group(); g.name = 'fauna-schooling-fish';
  const fish = [];
  const N = Math.round(p.schoolSize);
  const beh = p.formationBehavior;
  for (let i = 0; i < N; i++) {
    const root = new THREE.Group(); root.name = 'schoolFish'; root.rotation.order = 'YZX';
    const sc = 0.85 + rnd() * 0.3;
    const b = finish(T.list.map(q => ({ g: q.g.clone(), c: q.c, n: q.n })), bodyMat, 'body', merge); if (b) root.add(b);
    const f = finish(T.fins.map(q => ({ g: q.g.clone(), c: q.c, n: q.n })), finMat, 'fins', merge); if (f) root.add(f);
    const tail = new THREE.Group(); tail.name = 'tails'; tail.position.x = T.tailX;
    const tm = finish(T.tail.map(q => ({ g: q.g.clone(), c: q.c, n: q.n })), finMat, 'tail', merge); if (tm) tail.add(tm);
    root.add(tail);
    root.scale.setScalar(sc);
    const dirR = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    const rad = beh === 'sphere' ? 0.035 + Math.cbrt(rnd()) * 0.065 : beh === 'stream' ? 0.014 + rnd() * 0.035 : 0.06 + rnd() * 0.1;
    const off = dirR.multiplyScalar(rad); off.y *= 0.6;
    const lag = beh === 'stream' ? rnd() * 0.58 : beh === 'scatter' ? rnd() * 0.3 : rnd() * 0.08;
    fish.push({ root, tail, off, lag, ph: rnd() * 100, wob: beh === 'scatter' ? 0.025 : beh === 'stream' ? 0.008 : 0.006, spd: 0.92 + rnd() * 0.16, pos: new THREE.Vector3(...center), vel: new THREE.Vector3(), avoidOffset: new THREE.Vector3(), radius: sp.L * sc * 0.5, initialized: false });
    g.add(root);
  }

  const P = new THREE.Vector3(), Q = new THREE.Vector3();
  const posAt = (f, time, out) => {
    const u = (((time * 0.035 * p.speed * f.spd) / len * 3 - f.lag) % 1 + 1) % 1;
    curve.getPointAt(u, out);
    out.add(f.off);
    out.x += Math.sin(time * 0.55 + f.ph) * f.wob; out.y += Math.sin(time * 0.8 + f.ph * 1.7) * f.wob * 0.45; out.z += Math.cos(time * 0.47 + f.ph * 0.6) * f.wob;
    return out;
  };

  const projectInside = (x, z) => {
    if (!contains || contains(x, z)) return [x, z];
    let ax = center[0], az = center[2], lo = 0, hi = 1;
    if (!contains(ax, az)) { ax = center[0] * 0.8; az = center[2] * 0.8; }
    for (let i = 0; i < 14; i++) {
      const t = (lo + hi) * 0.5;
      if (contains(ax + (x - ax) * t, az + (z - az) * t)) lo = t;
      else hi = t;
    }
    return [ax + (x - ax) * lo, az + (z - az) * lo];
  };

  g.userData = {
    curve,
    positions: () => fish.map(f => f.root.position),
    avoidanceTargets: () => fish.map(f => ({ x: f.pos.x, y: f.pos.y, z: f.pos.z, radius: f.radius, kind: 'school' })),
    avoid: avoidFn,
    setRig(name, v) { if (name === 'tails') fish.forEach(f => { f.tail.rotation.y = THREE.MathUtils.degToRad(v); }); },
    update(t, dt = 0.016) {
      dt = Math.min(dt, 0.05);
      const fn = (typeof g.userData.avoid === 'function') ? g.userData.avoid : avoidFn;
      const others = fn ? fn() : null;
      const goals = [];
      for (const f of fish) {
        posAt(f, t, P);
        goals.push(P.clone());
      }
      const separation = fish.map(() => new THREE.Vector3());
      for (let i = 0; i < goals.length; i++) {
        for (let j = i + 1; j < goals.length; j++) {
          const dx = goals[i].x - goals[j].x, dy = (goals[i].y - goals[j].y) * 1.4, dz = goals[i].z - goals[j].z;
          const d = Math.hypot(dx, dy, dz), safe = fish[i].radius + fish[j].radius + 0.012;
          if (d < safe && d > 1e-5) {
            const push = (safe - d) * 0.5 / d;
            separation[i].add(new THREE.Vector3(dx, dy, dz).multiplyScalar(push));
            separation[j].add(new THREE.Vector3(-dx, -dy, -dz).multiplyScalar(push));
          }
        }
      }
      for (let i = 0; i < fish.length; i++) {
        const f = fish[i], goal = goals[i].add(separation[i]);
        const flee = new THREE.Vector3();
        if (others) for (const threat of others) {
          const point = threat.position || threat;
          if (!point || !Number.isFinite(point.x + point.y + point.z)) continue;
          const dx = goal.x - point.x, dy = (goal.y - point.y) * 1.25, dz = goal.z - point.z;
          const d = Math.hypot(dx, dy, dz);
          const threatRadius = Number.isFinite(threat.radius) ? threat.radius : 0.035;
          const safe = f.radius + threatRadius + 0.085;
          if (d < safe && d > 1e-5) flee.add(new THREE.Vector3(dx, dy, dz).multiplyScalar((safe - d + 0.018) / (safe * d)));
        }
        if (flee.length() > 1) flee.setLength(1);
        flee.multiplyScalar(0.18);
        f.avoidOffset.lerp(flee, 1 - Math.exp(-dt * (flee.lengthSq() > 0 ? 4.5 : 1.5)));
        goal.add(f.avoidOffset);
        let px = goal.x, py = goal.y, pz = goal.z;
        if (bounds) {
          px = THREE.MathUtils.clamp(px, bounds.min[0], bounds.max[0]);
          py = THREE.MathUtils.clamp(py, bounds.min[1], bounds.max[1]);
          pz = THREE.MathUtils.clamp(pz, bounds.min[2], bounds.max[2]);
        }
        [px, pz] = projectInside(px, pz);
        if (heightAt) py = Math.max(py, heightAt(px, pz) + Math.max(0.045, f.radius * 1.4));
        if (bounds) py = Math.min(py, bounds.max[1]);
        if (!f.initialized) { f.pos.set(px, py, pz); f.initialized = true; }
        const goalPoint = new THREE.Vector3(px, py, pz);
        const travel = goalPoint.sub(f.pos), dGoal = travel.length();
        const cruise = 0.105 * p.speed * f.spd;
        if (dGoal > 1e-5) travel.multiplyScalar(1 / dGoal).multiplyScalar(Math.min(cruise, dGoal * 1.7));
        else travel.set(0, 0, 0);
        f.vel.lerp(travel, 1 - Math.exp(-dt * 2.8));
        f.pos.addScaledVector(f.vel, dt);
        if (bounds) {
          f.pos.x = THREE.MathUtils.clamp(f.pos.x, bounds.min[0], bounds.max[0]);
          f.pos.y = THREE.MathUtils.clamp(f.pos.y, bounds.min[1], bounds.max[1]);
          f.pos.z = THREE.MathUtils.clamp(f.pos.z, bounds.min[2], bounds.max[2]);
        }
        [f.pos.x, f.pos.z] = projectInside(f.pos.x, f.pos.z);
        if (heightAt) {
          const floor = heightAt(f.pos.x, f.pos.z) + Math.max(0.045, f.radius * 1.4);
          f.pos.y = Math.min(bounds ? bounds.max[1] : Infinity, Math.max(f.pos.y, floor));
        }
        f.root.position.copy(f.pos);
        f.root.position.y += Math.sin(t * 0.45 + f.ph) * 0.002;
        posAt(f, t + 0.08, Q);
        const pathDx = Q.x - goals[i].x, pathDy = Q.y - goals[i].y, pathDz = Q.z - goals[i].z;
        const dx = f.vel.x * 0.72 + pathDx * 0.28, dy = f.vel.y * 0.72 + pathDy * 0.28, dz = f.vel.z * 0.72 + pathDz * 0.28;
        const hs = Math.hypot(dx, dz);
        const yaw = Math.atan2(-dz, dx);
        let yawDelta = yaw - f.root.rotation.y; yawDelta = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta));
        f.root.rotation.y += yawDelta * (1 - Math.exp(-dt * 2.2));
        f.root.rotation.z = THREE.MathUtils.lerp(f.root.rotation.z, Math.atan2(dy, hs + 1e-6) * 0.5, 1 - Math.exp(-dt * 1.7));
        f.tail.rotation.y = Math.sin(t * 22 * f.spd + f.ph) * 0.5;
      }
    }
  };
  g.userData.update(0);
  return g;
}

export default createAsset;
