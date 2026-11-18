/*
 * FAUNA HERO FISH (High Detail)
 * Parametric specimen fish for three.js: smooth lathe bodies laterally compressed per species
 * (Discus, Betta, Yellow Tang, Angelfish, Clownfish), shaped dorsal/anal/caudal/pectoral fins with
 * Standard / Veiltail / Crown morphologies, colour-pattern facet zones, rigged fins + gills and a
 * slow randomized patrol that weaves through supplied waypoints (hardscape gaps).
 *
 * QUICK START
 *   import { createAsset } from './fauna-hero-fish.mjs';
 *   const fish = createAsset({ species: 'discus', count: 2, bounds: { min: [-.5,.1,-.2], max: [.5,.4,.2] } });
 *   scene.add(fish); // loop: fish.userData.update(t, dt)
 *
 * PARAMS  species: discus | betta | tang | angelfish | clownfish ; finMorphology: standard | veiltail | crown
 *         colorPattern: solid | striped | marbled ; colorway ; count 1-6 ; speed ; seed
 * SPECS  ~1,200-2,000 triangles per fish, 2 materials, 0.065-0.18 m long (real-world scale).
 * PARTS  animate: caudalFin (y sweep), pectoralFins (flutter), gills (breathing), body (yaw sway)
 *        detach: caudalFin, pectoralFins, dorsalFin
 * LICENSE MIT - procedural geometry, free for commercial use.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = { body: '#2a7ad8', belly: '#a8d8ff', pattern: '#ff7a2a', stripe: '#0a2a6a', fin: '#3a9aff', finEdge: '#ff5a3a', eye: '#f2e8a0', pupil: '#0a0a0a', gill: '#1a5aa8' };

export const COLORWAYS = {
  'default':     { ...BASE },
  'royal-blue':  { ...BASE },
  'copper-gold': { body: '#c8681e', belly: '#ffd27a', pattern: '#ffb02a', stripe: '#6a2a0a', fin: '#e88a2a', finEdge: '#ffd040', eye: '#ff3a1a', pupil: '#0a0a0a', gill: '#a0501a' },
  'yellow-tang': { body: '#ffd21e', belly: '#fff07a', pattern: '#ffe24a', stripe: '#d8a800', fin: '#ffcc10', finEdge: '#ffffff', eye: '#202020', pupil: '#000000', gill: '#e8b800' },
  'blue-tang':   { body: '#1a4ae0', belly: '#3a7aff', pattern: '#0a0a3a', stripe: '#06061a', fin: '#1a3ab8', finEdge: '#ffd21e', eye: '#101010', pupil: '#000000', gill: '#1238a8' },
  'clown':       { body: '#ff6a10', belly: '#ff8a3a', pattern: '#ffffff', stripe: '#ffffff', fin: '#ff7a20', finEdge: '#101010', eye: '#ff9a3a', pupil: '#000000', gill: '#e05a08' },
  'betta-red':   { body: '#b0101e', belly: '#d82a3a', pattern: '#3a0aa8', stripe: '#5a0a1a', fin: '#d81a3a', finEdge: '#3a3aff', eye: '#d8c84a', pupil: '#000000', gill: '#800a14' },
  'angel-silver':{ body: '#d8dce0', belly: '#f4f6f8', pattern: '#1a1a1a', stripe: '#141414', fin: '#c8ccd0', finEdge: '#1a1a1a', eye: '#d82a2a', pupil: '#000000', gill: '#b8bcc0' },
  'glo-pink':    { body: '#ff3ac8', belly: '#ff9ae8', pattern: '#ffe23a', stripe: '#8a1a8a', fin: '#ff70e0', finEdge: '#30f0ff', eye: '#ffffff', pupil: '#000000', gill: '#d020a0' }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: { type: 'toggle', default: false, label: 'Merge for Production', affects: 'geometry', describe: 'Merge static parts per fish; fins stay rigged.' },
  colorway:        { type: 'choice', default: 'royal-blue', options: Object.keys(COLORWAYS), label: 'Palette', affects: 'colors', describe: 'Scale colours.' },
  species:         { type: 'choice', default: 'discus', options: ['discus', 'betta', 'tang', 'angelfish', 'clownfish'], label: 'Species', affects: 'geometry', describe: 'Body plan.' },
  finMorphology:   { type: 'choice', default: 'standard', options: ['standard', 'veiltail', 'crown'], label: 'Fins', affects: 'geometry', describe: 'Fin shape.' },
  colorPattern:    { type: 'choice', default: 'striped', options: ['solid', 'striped', 'marbled'], label: 'Pattern', affects: 'geometry', describe: 'Scale pattern zones.' },
  patternSoftness: { type: 'range', default: 0.85, min: 0.2, max: 2.0, step: 0.05, label: 'Pattern Softness', affects: 'colors', describe: 'Feathering and biological blending of markings.' },
  organicJitter:   { type: 'range', default: 0.8, min: 0.0, max: 2.0, step: 0.05, label: 'Organic Jitter', affects: 'colors', describe: 'Natural biological waviness and irregular scale margins.' },
  count:           { type: 'range', default: 2, min: 1, max: 6, step: 1, label: 'Count', affects: 'geometry', describe: 'Number of specimens.' },
  speed:           { type: 'range', default: 1, min: 0.2, max: 3, step: 0.1, label: 'Speed', affects: 'geometry', describe: 'Patrol speed multiplier.' },
  scale:           { type: 'range', default: 1, min: 0.6, max: 1.6, step: 0.05, label: 'Size', affects: 'geometry', describe: 'Specimen size (rebuilds proportions).' },
  seed:            { type: 'range', default: 17, min: 1, max: 999, step: 1, label: 'Seed', affects: 'geometry', describe: 'Path/variation seed.' }
};

export const rig = {
  caudalFin:    { axis: 'y', range: [-25, 25], describe: 'Tail sweeps.' },
  pectoralFins: { axis: 'y', range: [-35, 10], describe: 'Pectorals flutter.' },
  gills:        { axis: 'y', range: [0, 12], describe: 'Opercula breathe.' }
};
export const detach = ['caudalFin', 'pectoralFins', 'dorsalFin'];
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

const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.32, metalness: 0.22, side: THREE.DoubleSide });
const FIN_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.42, metalness: 0.08, transparent: true, opacity: 0.85, side: THREE.DoubleSide });

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise2D(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2D(x, y, oct = 3) {
  let val = 0, amp = 0.5, freq = 1.0;
  for (let i = 0; i < oct; i++) {
    val += amp * noise2D(x * freq, y * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return val;
}

function sampleHeroFishColor(u, v, w, sp, P, C, seed) {
  const cBody = new THREE.Color(C.body);
  const cBelly = new THREE.Color(C.belly);
  const cStripe = new THREE.Color(C.stripe);
  const cPattern = new THREE.Color(C.pattern);
  const cFinEdge = new THREE.Color(C.finEdge);
  const cGill = new THREE.Color(C.gill);
  const cDarkDorsal = cBody.clone().multiplyScalar(0.72);

  const bellyT = THREE.MathUtils.smoothstep(-v, 0.1, 0.95);
  const dorsalT = THREE.MathUtils.smoothstep(v, 0.2, 0.95);
  const outColor = cBody.clone();
  outColor.lerp(cBelly, bellyT * 0.85);
  outColor.lerp(cDarkDorsal, dorsalT * 0.45);

  if (u > 0.68 && u < 0.79 && Math.abs(v) < 0.55) {
    const gillDist = Math.hypot((u - 0.735) / 0.05, v / 0.5);
    if (gillDist < 1.0) {
      const gAlpha = (1.0 - gillDist * gillDist) * 0.45;
      outColor.lerp(cGill, gAlpha);
    }
  }

  const jit = (P.organicJitter ?? 0.8);
  const soft = Math.max(0.005, (P.patternSoftness ?? 0.85) * 0.02);

  if (P.species === 'clownfish') {
    const nWarp = (fbm2D(u * 14 + seed, v * 12 + seed, 2) - 0.5) * 0.025 * jit;
    const b1 = 0.73 + 0.035 * Math.cos(v * Math.PI * 0.65) + nWarp;
    const w1 = 0.032 + 0.006 * Math.cos(v * Math.PI * 0.5);
    const midPeak = Math.max(0, 1.0 - Math.abs(v) * 2.1);
    const b2 = 0.43 + 0.045 * midPeak + nWarp * 1.2;
    const w2 = 0.031 + 0.012 * midPeak;
    const b3 = 0.135 + nWarp * 0.8;
    const w3 = 0.023;

    const d1 = Math.abs(u - b1) - w1;
    const d2 = Math.abs(u - b2) - w2;
    const d3 = Math.abs(u - b3) - w3;
    const barDist = Math.min(d1, d2, d3);

    const borderThickness = 0.014;
    if (barDist < 0.0) {
      const whiteColor = cStripe.clone().lerp(new THREE.Color(0xffffff), 0.4);
      outColor.copy(whiteColor);
    } else if (barDist < borderThickness) {
      const edgeT = THREE.MathUtils.smoothstep(borderThickness, 0.0, barDist);
      outColor.lerp(cFinEdge, edgeT * 0.95);
    } else {
      const blendT = THREE.MathUtils.smoothstep(borderThickness + soft, borderThickness, barDist);
      outColor.lerp(cFinEdge, blendT * 0.35);
    }
  } else if (P.species === 'discus') {
    const vermNoise = fbm2D(u * 12 + seed, v * 10 + seed, 3) * jit;
    const verm = Math.sin(v * 34.0 + vermNoise * 5.2 + u * 12.0);

    const stress = Math.sin((u + 0.02 * Math.sin(v * 4.0)) * Math.PI * 16.0);
    if (stress > 0.45 && u > 0.12 && u < 0.82) {
      const sAlpha = THREE.MathUtils.smoothstep(0.45, 0.85, stress);
      outColor.multiplyScalar(1.0 - sAlpha * 0.22);
    }

    if (P.colorPattern !== 'solid') {
      const vMask = THREE.MathUtils.smoothstep(-0.7, -0.2, v) * THREE.MathUtils.smoothstep(0.9, 0.6, v);
      const patternStrength = THREE.MathUtils.smoothstep(0.05, 0.45, verm) * vMask;
      outColor.lerp(cPattern, patternStrength * 0.8);
    }

    if (v > 0.55 && u > 0.25) {
      const haloT = THREE.MathUtils.smoothstep(0.55, 0.95, v);
      outColor.lerp(cFinEdge, haloT * 0.65);
    }
  } else if (P.species === 'angelfish') {
    const nWarp = (noise2D(u * 16 + seed, v * 12 + seed) - 0.5) * 0.02 * jit;
    const b0 = 0.74 - 0.09 * v + nWarp;
    const b1 = 0.55 - 0.07 * v + nWarp * 1.2;
    const b2 = 0.36 - 0.11 * v + nWarp * 1.4;
    const b3 = 0.13 - 0.03 * v;

    const w0 = 0.025, w1 = 0.018, w2 = 0.032, w3 = 0.016;
    const d0 = Math.abs(u - b0) / (w0 + soft);
    const d1 = Math.abs(u - b1) / (w1 + soft);
    const d2 = Math.abs(u - b2) / (w2 + soft);
    const d3 = Math.abs(u - b3) / (w3 + soft);

    const barMin = Math.min(d0, d1, d2, d3);
    if (barMin < 1.0) {
      const barAlpha = THREE.MathUtils.smoothstep(1.0, 0.25, barMin);
      outColor.lerp(cStripe, barAlpha * 0.88);
    }
    if (u > 0.55 && v > 0.25) {
      const crownT = THREE.MathUtils.smoothstep(0.25, 0.85, v) * THREE.MathUtils.smoothstep(0.55, 0.75, u);
      outColor.lerp(new THREE.Color(0xffd260), crownT * 0.45);
    }
  } else if (P.species === 'tang') {
    const isBlueTang = C.body === '#1a4ae0' || P.colorway === 'blue-tang';
    if (isBlueTang) {
      const nWarp = (noise2D(u * 14, v * 10) - 0.5) * 0.03 * jit;
      const isTailWedge = u < 0.24 && Math.abs(v) < 0.65 * (0.24 - u) / 0.24;
      const isBlackDorsal = v > 0.35 + 0.2 * Math.sin(u * 4.0) + nWarp && u > 0.15;
      const loopCenterU = 0.48, loopCenterV = 0.08;
      const distToOval = Math.hypot((u - loopCenterU) / 0.16, (v - loopCenterV) / 0.28);
      const isOvalCenter = distToOval < 0.75;
      const isBlackLoop = (distToOval < 1.35 && distToOval >= 0.75) || isBlackDorsal;

      if (isTailWedge) {
        outColor.lerp(cFinEdge, 0.95);
      } else if (isBlackLoop && !isOvalCenter) {
        outColor.lerp(cStripe, 0.9);
      }
    } else {
      if (v > 0.45) {
        const dorsalAmber = THREE.MathUtils.smoothstep(0.45, 0.9, v);
        outColor.lerp(cStripe, dorsalAmber * 0.4);
      }
      if (u > 0.22 && u < 0.28 && Math.abs(v) < 0.2) {
        const spineDist = Math.hypot((u - 0.25) / 0.025, v / 0.12);
        if (spineDist < 1.0) {
          outColor.lerp(new THREE.Color(0xffffff), (1.0 - spineDist) * 0.95);
        }
      }
    }
  } else if (P.species === 'betta') {
    const marble1 = fbm2D(u * 14.0 + seed, v * 10.0 + seed, 3) * jit;
    const marble2 = fbm2D(u * 22.0 - seed, v * 18.0 - seed, 2) * jit;
    const scaleMesh = Math.sin(u * 55.0 + v * 35.0) * Math.sin(u * 55.0 - v * 35.0);

    if (P.colorPattern === 'marbled') {
      const mAlpha = THREE.MathUtils.smoothstep(0.35, 0.65, marble1);
      outColor.lerp(cPattern, mAlpha * 0.85);
      if (marble2 > 0.6) {
        outColor.lerp(cFinEdge, (marble2 - 0.6) / 0.4 * 0.6);
      }
    } else if (P.colorPattern === 'striped') {
      const sWave = Math.sin(u * Math.PI * 8.0 + marble1 * 3.0);
      const sAlpha = THREE.MathUtils.smoothstep(0.2, 0.7, sWave);
      outColor.lerp(cPattern, sAlpha * 0.75);
    }

    if (scaleMesh > 0.4 && v > -0.3) {
      outColor.lerp(new THREE.Color(0xffffff), 0.18 * scaleMesh);
    }

    if (u > 0.78 && v < -0.1) {
      const chinDark = THREE.MathUtils.smoothstep(0.78, 0.92, u) * THREE.MathUtils.smoothstep(-0.1, -0.6, v);
      outColor.lerp(cStripe, chinDark * 0.75);
    }
  }

  if (P.colorPattern === 'marbled' && P.species !== 'betta') {
    const m = fbm2D(u * 16.0 + seed, v * 12.0 + seed, 3) * jit;
    const mAlpha = THREE.MathUtils.smoothstep(0.4, 0.65, m);
    outColor.lerp(cPattern, mAlpha * 0.7);
  }

  return outColor;
}

function colorFinGeometry(geo, cRootHex, cFinHex, cEdgeHex, isCaudal = false) {
  if (geo.index) geo = geo.toNonIndexed();
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  if (geo.attributes.normal) geo.deleteAttribute('normal');
  const pos = geo.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const cr = new THREE.Color(cRootHex);
  const cf = new THREE.Color(cFinHex);
  const ce = new THREE.Color(cEdgeHex);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const spanX = Math.max(1e-4, maxX - minX);
  const spanY = Math.max(1e-4, maxY - minY);
  const c = new THREE.Color();

  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    let t = 0;
    if (isCaudal) {
      const d = Math.hypot(x, y);
      t = THREE.MathUtils.clamp(d / (spanX * 0.95 || 1e-4), 0, 1);
    } else {
      t = THREE.MathUtils.clamp(Math.abs(y) / (spanY || 1e-4), 0, 1);
    }

    if (t < 0.2) {
      c.copy(cr).lerp(cf, t / 0.2);
    } else if (t < 0.78) {
      c.copy(cf);
    } else {
      const edgeT = (t - 0.78) / 0.22;
      c.copy(cf).lerp(ce, edgeT);
    }

    const rayAngle = Math.atan2(y, Math.abs(x) + 0.01);
    const rayFleck = Math.sin(rayAngle * 28.0);
    if (rayFleck > 0.5) c.multiplyScalar(1.06);
    else if (rayFleck < -0.5) c.multiplyScalar(0.95);

    col[i * 3]     = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function finish(list, material = MAT, name = 'solid', merge = true) {
  if (list.length === 0) return null;
  if (merge) {
    const merged = mergeGeometries(list.map(p => prep(p.g, p.c)));
    if (!merged) return null;
    merged.computeVertexNormals();
    const m = new THREE.Mesh(merged, material);
    m.name = name; m.castShadow = true; m.receiveShadow = false;
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

const SPECIES = {
  discus:    { L: 0.15, hr: 0.92, tr: 0.2, skew: 0.95, ex: 0.55, dorsal: [0.32, -0.42, 0.12], anal: [0.18, -0.42, 0.1], caudal: 'round', cl: 0.22, ch: 0.2, speed: 0.05, freq: 3.5 },
  betta:     { L: 0.065, hr: 0.3, tr: 0.22, skew: 0.85, ex: 0.75, dorsal: [0.05, -0.4, 0.45], anal: [0.25, -0.45, 0.6], caudal: 'veil', cl: 0.7, ch: 0.55, speed: 0.04, freq: 4.5 },
  tang:      { L: 0.18, hr: 0.68, tr: 0.22, skew: 0.8, ex: 0.6, dorsal: [0.3, -0.38, 0.14], anal: [0.1, -0.38, 0.12], caudal: 'lunate', cl: 0.24, ch: 0.26, speed: 0.08, freq: 3.2 },
  angelfish: { L: 0.13, hr: 0.72, tr: 0.16, skew: 0.9, ex: 0.55, dorsal: [0.2, -0.3, 0.75], anal: [0.18, -0.3, 0.75], caudal: 'fork', cl: 0.3, ch: 0.3, speed: 0.045, freq: 2.8 },
  clownfish: { L: 0.08, hr: 0.42, tr: 0.3, skew: 0.85, ex: 0.7, dorsal: [0.25, -0.35, 0.18], anal: [0.05, -0.35, 0.15], caudal: 'round', cl: 0.22, ch: 0.2, speed: 0.06, freq: 6 }
};

function buildFish(sp, P, C, merge, rnd) {
  const L = sp.L * P.scale;
  const prof = (t) => { const s = Math.pow(THREE.MathUtils.clamp(t, 0, 1), sp.skew); const r = Math.pow(Math.max(0, Math.sin(Math.PI * (0.04 + s * 0.94))), sp.ex); return t < 0.1 ? Math.max(r, 0.14) : r; };
  const halfH = (x) => prof((x + L / 2) / L) * L * 0.5 * sp.hr;

  // ---- body (lathe along X with fine biological resolution and per-vertex organic coloration) ----
  const numRings = 36;
  const radialSegs = 26;
  const pts = [];
  for (let i = 0; i <= numRings; i++) {
    const t = i / numRings;
    pts.push(new THREE.Vector2(Math.max(0.0001, prof(t) * L * 0.5), t * L - L / 2));
  }
  pts[numRings].x = 0.0001;
  let bodyGeo = new THREE.LatheGeometry(pts, radialSegs).rotateZ(-Math.PI / 2).scale(1, sp.hr, sp.tr).toNonIndexed();

  const bPos = bodyGeo.attributes.position;
  const bCount = bPos.count;
  const bCols = new Float32Array(bCount * 3);
  const vSeed = rnd() * 100.0;

  for (let i = 0; i < bCount; i++) {
    const x = bPos.getX(i), y = bPos.getY(i), z = bPos.getZ(i);
    const u = THREE.MathUtils.clamp((x + L / 2) / L, 0, 1);
    const hh = Math.max(1e-4, halfH(x));
    const v = THREE.MathUtils.clamp(y / hh, -1, 1);
    const hw = Math.max(1e-4, (hh / sp.hr) * sp.tr);
    const w = THREE.MathUtils.clamp(z / hw, -1, 1);

    const vCol = sampleHeroFishColor(u, v, w, sp, P, C, vSeed);
    bCols[i * 3]     = vCol.r;
    bCols[i * 3 + 1] = vCol.g;
    bCols[i * 3 + 2] = vCol.b;
  }
  bodyGeo.setAttribute('color', new THREE.BufferAttribute(bCols, 3));
  bodyGeo.computeVertexNormals();

  const solid = [{ g: bodyGeo, c: C.body, n: 'body' }];
  const fins = [];

  // ---- eyes ----
  const ex = L * 0.36, eyR = L * 0.045 * (sp.L < 0.09 ? 1.3 : 1), ez = (halfH(ex) / sp.hr) * sp.tr * 0.82;
  [-1, 1].forEach(s => {
    solid.push({ g: new THREE.SphereGeometry(eyR, 12, 10).scale(1, 1, 0.5).translate(ex, halfH(ex) * 0.18, s * ez), c: C.eye, n: 'eye' });
    solid.push({ g: new THREE.SphereGeometry(eyR * 0.55, 10, 8).scale(1, 1, 0.5).translate(ex + eyR * 0.08, halfH(ex) * 0.18, s * (ez + eyR * 0.3)), c: C.pupil, n: 'pupil' });
  });
  // mouth lips
  solid.push({ g: new THREE.SphereGeometry(L * 0.025, 10, 8).scale(1.2, 0.7, 1).translate(L / 2 - L * 0.01, -halfH(L * 0.45) * 0.15, 0), c: C.gill, n: 'lips' });
  // tang scalpel
  if (P.species === 'tang') [-1, 1].forEach(s => solid.push({ g: new THREE.ConeGeometry(L * 0.012, L * 0.07, 6).rotateZ(-Math.PI / 2).translate(-L * 0.36, 0, s * halfH(-L * 0.36) / sp.hr * sp.tr * 0.9), c: C.finEdge, n: 'scalpel' }));

  // ---- dorsal / anal fins (shapes with soft biological root-to-tip gradients) ----
  const crown = P.finMorphology === 'crown', veil = P.finMorphology === 'veiltail';
  const finShape = (x1, x0, fh, sign, trail) => {
    const s = new THREE.Shape(), N = crown ? 18 : 12;
    s.moveTo(x1, sign * halfH(x1) * 0.8);
    for (let k = 0; k <= N; k++) {
      const u = k / N, x = x1 + (x0 - x1) * u - (veil ? trail * u * u * L * 0.25 : 0);
      let h = fh * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.08)), 0.6) * (0.55 + 0.45 * u);
      if (crown) h *= k % 2 ? 1.25 : 0.82;
      if (veil) h *= 1.25;
      const base = halfH(Math.max(-L / 2, Math.min(L / 2, x)));
      s.lineTo(x, sign * (base * 0.85 + h - (veil ? trail * u * u * fh * 0.4 * sign * sign : 0)));
    }
    s.lineTo(x0, sign * halfH(x0) * 0.8);
    s.closePath();
    return new THREE.ShapeGeometry(s, 6);
  };
  const dorsal = colorFinGeometry(finShape(L * sp.dorsal[0], L * sp.dorsal[1], L * sp.dorsal[2] * 0.6, 1, 1), C.body, C.fin, C.finEdge, false);
  const anal = colorFinGeometry(finShape(L * sp.anal[0], L * sp.anal[1], L * sp.anal[2] * 0.6, -1, 1), C.belly, C.fin, C.finEdge, false);
  fins.push({ g: dorsal, c: C.fin, n: 'dorsalFin' }, { g: anal, c: C.fin, n: 'analFin' });
  if (crown || veil) {
    const dEdge = colorFinGeometry(finShape(L * sp.dorsal[0] * 0.5, L * sp.dorsal[1], L * sp.dorsal[2] * 0.25, 1, 1).translate(0, L * sp.dorsal[2] * 0.42, 0.0005), C.fin, C.finEdge, C.finEdge, false);
    fins.push({ g: dEdge, c: C.finEdge, n: 'dorsalEdge' });
  }
  // angelfish ventral filaments
  if (P.species === 'angelfish') [-1, 1].forEach(s => addWire(fins, [L * 0.22, -halfH(L * 0.22) * 0.9, s * 0.002], [L * 0.05, -halfH(0) - L * 0.6, s * 0.004], C.fin, L * 0.006, 4));

  const root = new THREE.Group(); root.name = 'heroFish';
  const bodyPivot = new THREE.Group(); bodyPivot.name = 'body'; root.add(bodyPivot);
  const s1 = finish(solid, MAT, 'fishBody', merge); if (s1) bodyPivot.add(s1);
  const dg = new THREE.Group(); dg.name = 'dorsalFin';
  const s2 = finish(fins, FIN_MAT, 'fins', merge); if (s2) dg.add(s2);
  bodyPivot.add(dg);

  // ---- caudal fin (rigged pivot at peduncle with radial ray color gradient) ----
  const cl = L * sp.cl * (veil ? 1.6 : 1), ch = L * sp.ch * (veil ? 1.3 : 1), ph0 = halfH(-L / 2 + L * 0.06);
  const cs = new THREE.Shape();
  cs.moveTo(0, ph0 * 0.9);
  const type = veil ? 'veil' : sp.caudal;
  if (type === 'round') { cs.quadraticCurveTo(-cl * 0.6, ch * 1.1, -cl, ch * 0.4); cs.quadraticCurveTo(-cl * 1.12, 0, -cl, -ch * 0.4); cs.quadraticCurveTo(-cl * 0.6, -ch * 1.1, 0, -ph0 * 0.9); }
  else if (type === 'lunate') { cs.quadraticCurveTo(-cl * 0.5, ch * 0.6, -cl, ch * 1.1); cs.quadraticCurveTo(-cl * 0.55, 0, -cl, -ch * 1.1); cs.quadraticCurveTo(-cl * 0.5, -ch * 0.6, 0, -ph0 * 0.9); }
  else if (type === 'fork') { cs.lineTo(-cl, ch); cs.quadraticCurveTo(-cl * 0.6, ch * 0.2, -cl * 0.62, 0); cs.quadraticCurveTo(-cl * 0.6, -ch * 0.2, -cl, -ch); cs.lineTo(0, -ph0 * 0.9); }
  else { cs.bezierCurveTo(-cl * 0.5, ch * 0.9, -cl * 1.1, ch * 0.7, -cl * 1.15, -ch * 0.1); cs.bezierCurveTo(-cl * 1.2, -ch * 1.1, -cl * 0.6, -ch * 1.3, -cl * 0.35, -ch * 0.9); cs.quadraticCurveTo(-cl * 0.2, -ch * 0.5, 0, -ph0 * 0.9); }
  cs.closePath();
  const caudalGeo = colorFinGeometry(new THREE.ShapeGeometry(cs, 12), C.body, C.fin, C.finEdge, true);
  const tail = [{ g: caudalGeo, c: C.fin, n: 'caudal' }];
  if (crown) for (let r = 0; r < 7; r++) { const a = -0.9 + r * 0.3; addWire(tail, [0, 0, 0.0004], [-cl * 1.15 * Math.cos(a), ch * 1.1 * Math.sin(a), 0.0004], C.finEdge, L * 0.004, 3); }
  else {
    const edgeGeo = colorFinGeometry(new THREE.ShapeGeometry(cs, 10).scale(1.02, 1.02, 1).translate(-cl * 0.02, 0, -0.0004), C.fin, C.finEdge, C.finEdge, true);
    tail.push({ g: edgeGeo, c: C.finEdge, n: 'caudalEdge' });
  }
  const caudal = new THREE.Group(); caudal.name = 'caudalFin'; caudal.position.set(-L / 2 + L * 0.06, 0, 0);
  const s3 = finish(tail, FIN_MAT, 'caudal', merge); if (s3) caudal.add(s3);
  bodyPivot.add(caudal);

  // ---- pectoral fins + gill covers (rigged) ----
  const pectorals = [], gills = [];
  [-1, 1].forEach(s => {
    const px = L * 0.18, pz = (halfH(px) / sp.hr) * sp.tr * 0.95;
    const ps = new THREE.Shape(); const pl = L * (P.species === 'betta' ? 0.3 : 0.18), pw = pl * 0.45;
    ps.moveTo(0, 0); ps.quadraticCurveTo(-pl * 0.5, pw, -pl, pw * 0.2); ps.quadraticCurveTo(-pl * 0.6, -pw * 0.5, 0, 0);
    const pv = new THREE.Group(); pv.name = 'pectoralFins'; pv.position.set(px, -halfH(px) * 0.25, s * pz);
    const pectGeo = colorFinGeometry(new THREE.ShapeGeometry(ps, 8), C.body, C.fin, C.finEdge, true);
    const pm = finish([{ g: pectGeo, c: C.fin, n: 'pectoral' }], FIN_MAT, 'pectoral', merge); if (pm) pv.add(pm);
    pv.userData.side = s; pectorals.push(pv); bodyPivot.add(pv);
    const gx = L * 0.24, gz = (halfH(gx) / sp.hr) * sp.tr;
    const gv = new THREE.Group(); gv.name = 'gills'; gv.position.set(gx, 0, s * gz * 0.92);
    const gs = new THREE.SphereGeometry(halfH(gx) * 0.75, 12, 8, Math.PI * 0.5, Math.PI, Math.PI * 0.15, Math.PI * 0.7).scale(0.35, 1, 0.12);
    const gm = finish([{ g: gs, c: C.gill, n: 'operculum' }], MAT, 'gill', merge); if (gm) gv.add(gm);
    gv.userData.side = s; gills.push(gv); bodyPivot.add(gv);
  });

  return { root, bodyPivot, caudal, pectorals, gills, L };
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);
  const C = zonesFor(p.colorway, userParams);
  const merge = !!p.mergeForProduction;
  const rnd = rng(p.seed);
  const sp = SPECIES[p.species] || SPECIES.discus;
  const bounds = userParams.bounds || { min: [-0.45, 0.08, -0.15], max: [0.45, 0.4, 0.15] };
  const waypoints = (userParams.waypoints || []).map(w => new THREE.Vector3(...w));
  const heightAt = typeof userParams.heightAt === 'function' ? userParams.heightAt : null;
  const avoidFn = typeof userParams.avoid === 'function' ? userParams.avoid : null;
  const clearanceBase = 0.075;

  const g = new THREE.Group(); g.name = 'fauna-hero-fish';
  const fish = [];
  const randIn = () => new THREE.Vector3(
    THREE.MathUtils.lerp(bounds.min[0], bounds.max[0], rnd()),
    THREE.MathUtils.lerp(bounds.min[1], bounds.max[1], rnd()),
    THREE.MathUtils.lerp(bounds.min[2], bounds.max[2], rnd()));
  for (let i = 0; i < p.count; i++) {
    const f = buildFish(sp, { ...p, scale: p.scale * (0.85 + rnd() * 0.3) }, C, merge, rnd);
    f.root.rotation.order = 'YZX';
    f.pos = randIn(); f.vel = new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).multiplyScalar(0.02);
    f.target = randIn(); f.timer = 9 + rnd() * 9; f.phase = rnd() * 10; f.hover = 0;
    f.avoidRadius = f.L * 0.56;
    f.root.position.copy(f.pos);
    fish.push(f); g.add(f.root);
  }
  const tmp = new THREE.Vector3();
  const clampB = (v) => { v.x = THREE.MathUtils.clamp(v.x, bounds.min[0], bounds.max[0]); v.y = THREE.MathUtils.clamp(v.y, bounds.min[1], bounds.max[1]); v.z = THREE.MathUtils.clamp(v.z, bounds.min[2], bounds.max[2]); };

  g.userData = {
    fish: fish.map(f => f.root),
    positions: () => fish.map(f => f.pos),
    avoidanceTargets: () => fish.map(f => ({ x: f.pos.x, y: f.pos.y, z: f.pos.z, radius: f.avoidRadius, kind: 'hero' })),
    setRig(name, v) { fish.forEach(f => { if (name === 'caudalFin') f.caudal.rotation.y = THREE.MathUtils.degToRad(v); }); },
    update(t, dt = 0.016) {
      dt = Math.min(dt, 0.05);
      const threats = avoidFn ? avoidFn() : [];
      const steering = fish.map(() => new THREE.Vector3());

      // Accumulate separation before moving anyone so fish do not get order-dependent impulses.
      for (let i = 0; i < fish.length; i++) {
        const f = fish[i], force = steering[i];
        for (let j = 0; j < fish.length; j++) {
          if (i === j) continue;
          const o2 = fish[j];
          const dx = f.pos.x - o2.pos.x, dy = (f.pos.y - o2.pos.y) * 1.4, dz = f.pos.z - o2.pos.z;
          const d = Math.hypot(dx, dy, dz);
          const safe = f.avoidRadius + o2.avoidRadius + clearanceBase;
          if (d < safe && d > 1e-5) force.add(new THREE.Vector3(dx, dy, dz).multiplyScalar((safe - d) / (safe * d)));
        }
        for (const threat of threats) {
          const point = threat.position || threat;
          if (!point || !Number.isFinite(point.x + point.y + point.z)) continue;
          const dx = f.pos.x - point.x, dy = (f.pos.y - point.y) * 1.5, dz = f.pos.z - point.z;
          const d = Math.hypot(dx, dy, dz);
          const threatRadius = Number.isFinite(threat.radius) ? threat.radius : 0.035;
          // Give larger fish room equal to both body radii plus a visible buffer.
          const safe = f.avoidRadius + threatRadius + 0.09;
          const response = threat.kind === 'school' ? 0.24 : 1.8;
          if (d < safe && d > 1e-5) force.add(new THREE.Vector3(dx, dy, dz).multiplyScalar(response * (safe - d) / (safe * d)));
        }
      }

      fish.forEach((f, i) => {
        f.timer -= dt;
        if (f.pos.distanceTo(f.target) < f.L * 1.4 || f.timer < 0) {
          if (f.hover <= 0 && rnd() < 0.18) f.hover = 1.2 + rnd() * 2.0;
          f.target = waypoints.length && rnd() < 0.4 ? waypoints[Math.floor(rnd() * waypoints.length)].clone().add(new THREE.Vector3((rnd() - 0.5) * 0.02, 0, (rnd() - 0.5) * 0.02)) : randIn();
          clampB(f.target); f.timer = 9 + rnd() * 9;
        }
        const spd = sp.speed * p.speed * (f.hover > 0 ? 0.12 : 1);
        if (f.hover > 0) f.hover -= dt;
        tmp.subVectors(f.target, f.pos);
        const distance = tmp.length();
        if (distance > 1e-5) tmp.multiplyScalar(1 / distance);
        const arrival = THREE.MathUtils.clamp(distance / Math.max(f.L * 2.8, 0.05), 0.16, 1);
        tmp.multiplyScalar(spd * arrival).addScaledVector(steering[i], spd * 1.8);
        const maxSpeed = spd * 1.35;
        if (tmp.length() > maxSpeed) tmp.setLength(maxSpeed);
        f.vel.lerp(tmp, Math.min(1, dt * 1.45));
        f.pos.addScaledVector(f.vel, dt); clampB(f.pos);
        // stay clear of the terrain (never clip through hills)
        if (heightAt) {
          const floor = heightAt(f.pos.x, f.pos.z) + Math.max(0.05, f.L * 0.45);
          const safeFloor = Math.min(bounds.max[1], floor);
          if (f.pos.y < safeFloor) { f.pos.y = safeFloor; f.vel.y = Math.abs(f.vel.y) * 0.5; }
        }
        clampB(f.pos);
        f.root.position.copy(f.pos);
        f.root.position.y += Math.sin(t * 0.8 + f.phase) * 0.003;
        const hs = Math.hypot(f.vel.x, f.vel.z);
        if (hs > 1e-4) {
          const yaw = Math.atan2(-f.vel.z, f.vel.x);
          let dy = yaw - f.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          f.root.rotation.y += dy * Math.min(1, dt * 2.5);
        }
        f.root.rotation.z = THREE.MathUtils.lerp(f.root.rotation.z, Math.atan2(f.vel.y, hs + 1e-4) * 0.6, Math.min(1, dt * 2));
        const effort = 0.35 + Math.min(1, f.vel.length() / (sp.speed + 1e-4)) * 0.65;
        const fr = sp.freq * (0.6 + effort * 0.6);
        f.bodyPivot.rotation.y = Math.sin(t * fr + f.phase) * 0.06 * effort;
        f.caudal.rotation.y = Math.sin(t * fr + f.phase - 1.2) * 0.45 * effort;
        f.pectorals.forEach(pv => { pv.rotation.y = pv.userData.side * (0.35 + Math.sin(t * 7 + f.phase + pv.userData.side) * 0.35); });
        f.gills.forEach(gv => { gv.rotation.y = -gv.userData.side * (0.06 + Math.sin(t * 2.4 + f.phase) * 0.06); });
      });
    }
  };
  return g;
}

export default createAsset;
