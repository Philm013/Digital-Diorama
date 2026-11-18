/**
 * Exporters — turn the live heightfield into:
 *  - a fully standalone three.js ES module (.mjs) with baked geometry
 *  - a Wavefront OBJ with vertex colours
 *  - an 8-bit PNG heightmap
 *  - a JSON heightfield dump
 */

import { TerrainField } from './TerrainField';
import { PALETTE_BY_ID } from './presets';

export function download(filename: string, content: string | Blob, mime = 'text/plain') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
  }
  return btoa(s);
}

/* ------------------------------------------------------------------ */
/* standalone three.js module                                          */
/* ------------------------------------------------------------------ */

export function buildStandaloneModule(field: TerrainField, name = 'terrain-tile'): string {
  const n = field.n;
  field.recomputeRange();
  field.recomputeShading();
  const minH = field.minH;
  const maxH = field.maxH;
  const span = Math.max(1e-4, maxH - minH);

  const q = new Uint16Array(n * n);
  for (let i = 0; i < n * n; i++) q[i] = Math.round(((field.heights[i] - minH) / span) * 65535);
  const c = new Uint8Array(n * n * 3);
  for (let i = 0; i < n * n * 3; i++) c[i] = Math.round(Math.min(1, Math.max(0, field.colors[i])) * 255);

  const pal = PALETTE_BY_ID[field.paletteId] ?? PALETTE_BY_ID.temperate;
  const hB64 = toBase64(new Uint8Array(q.buffer));
  const cB64 = toBase64(c);

  return `/*
 * ${name} (Baked Terrain Tile)
 * A parametric, zero-texture low-poly terrain asset for three.js.
 * One import, no loaders, no textures, no shared helper files.
 *
 * QUICK START
 *   import { createAsset } from './${name}.mjs';
 *   scene.add(createAsset({ mergeForProduction: true }));
 *
 * SPECS  ${(n - 1) * (n - 1) * 2} terrain triangles + skirt/water, 1-2 materials,
 *        ${field.size.toFixed(1)} x ${(maxH - minH).toFixed(1)} x ${field.size.toFixed(1)} m (real-world scale),
 *        grid ${n} x ${n}, height range ${minH.toFixed(2)} .. ${maxH.toFixed(2)} m.
 * PARTS  animate: water (wave bob), terrain
 *        detach: water, skirt, terrain
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------------------------------------------------------------- *
 * BAKED DATA (base64)                                               *
 * ---------------------------------------------------------------- */
const N = ${n};
const SIZE = ${field.size.toFixed(3)};
const H_MIN = ${minH.toFixed(4)};
const H_MAX = ${maxH.toFixed(4)};
const WATER_LEVEL = ${field.waterLevel.toFixed(4)};
const HEIGHTS_B64 =
  '${hB64}';
const COLORS_B64 =
  '${cB64}';

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const HEIGHTS = (function () {
  const bytes = b64ToBytes(HEIGHTS_B64);
  const u16 = new Uint16Array(bytes.buffer, 0, bytes.length >> 1);
  const out = new Float32Array(N * N);
  const span = H_MAX - H_MIN;
  for (let i = 0; i < out.length; i++) out[i] = H_MIN + (u16[i] / 65535) * span;
  return out;
})();

const COLORS = b64ToBytes(COLORS_B64);

/* ---------------------------------------------------------------- *
 * COLORWAYS + PARAMS                                                *
 * ---------------------------------------------------------------- */

const BASE = {
  terrain:  '${pal.stops[Math.floor(pal.stops.length / 2)].c}',
  skirt:    '${pal.rock}',
  water:    '${pal.water}',
  snow:     '${pal.snow}',
  deep:     '${pal.deep}'
};

export const COLORWAYS = {
  'default': { ...BASE },
  'dusk':    { terrain: '#6b5a4a', skirt: '#4a3a30', water: '#3a6f8f', snow: '#e8e0d0', deep: '#20364f' },
  'mono':    { terrain: '#9a9a9a', skirt: '#5a5a5a', water: '#4a6f8f', snow: '#f2f2f2', deep: '#2a3a4a' },
  'alien':   { terrain: '#5e4b96', skirt: '#3b2f5e', water: '#3fd0c0', snow: '#d6f0ff', deep: '#120a26' }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: { type: 'toggle', default: true, label: 'Merge for Production', affects: 'geometry', describe: 'Merge all sub-geometries into 1 solid + 1 water draw call.' },
  colorway: { type: 'choice', default: 'default', label: 'Colorway', affects: 'colors', options: Object.keys(COLORWAYS), describe: 'Curated palette scheme.' },
  heightScale: { type: 'range', default: 1, min: 0.2, max: 2.5, step: 0.05, label: 'Height Scale', affects: 'geometry', describe: 'Vertical exaggeration multiplier.' },
  water: { type: 'toggle', default: ${field.waterLevel > minH ? 'true' : 'false'}, label: 'Water Plane', affects: 'geometry', describe: 'Show the water plane at the baked sea level.' },
  skirt: { type: 'toggle', default: true, label: 'Base Skirt', affects: 'geometry', describe: 'Solid diorama sides under the terrain.' },
  terrain: { type: 'color', default: BASE.terrain, label: 'Tint', affects: 'colors', describe: 'Multiplicative tint over baked vertex colours.' }
};

export const rig = {
  'water': { axis: 'y', range: [0, 0.35], describe: 'Water bobs with the swell' }
};

export const detach = ['terrain', 'water', 'skirt'];

export const night = {
  water: { color: '#7fd8ff', intensity: 0.35, distance: ${(field.size * 0.8).toFixed(0)}, describe: 'moonlit water sheen' }
};

/* ---------------------------------------------------------------- *
 * ZONE / MATERIAL HELPERS (inlined, no shared imports)              *
 * ---------------------------------------------------------------- */

const ZONE_KEYS = Object.keys(BASE);
const hexOf = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v & 0xffffff;
  if (typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v)) return parseInt(v.replace('#', ''), 16);
  return null;
};

function zonesFor(name, o = {}) {
  const cw = COLORWAYS[name] || COLORWAYS['default'];
  const used = new Set();
  const out = {};
  for (const k of ZONE_KEYS) {
    let hex = (hexOf(o[k]) ?? hexOf(cw[k]) ?? hexOf(cw.terrain)) & 0xffffff;
    while (used.has(hex)) hex = (hex + 1) & 0xffffff;
    used.add(hex);
    out[k] = hex;
  }
  return out;
}

function prep(geo, hex) {
  if (geo.index) geo = geo.toNonIndexed();
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const MAT = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: false, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide
});
const WATER_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: false, roughness: 0.12, metalness: 0.35,
  transparent: true, opacity: 0.74, side: THREE.DoubleSide, depthWrite: false
});

function finish(list, material = MAT, name = 'solid', merge = true) {
  if (list.length === 0) return null;
  if (merge) {
    const merged = mergeGeometries(list.map((p) => prep(p.g, p.c)));
    if (!merged) return null;
    merged.computeVertexNormals();
    const m = new THREE.Mesh(merged, material);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  const g = new THREE.Group();
  g.name = name;
  list.forEach((p, i) => {
    const geo = prep(p.g, p.c);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.name = name + '_part_' + (i + 1);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  });
  return g;
}

function box(w, h, d, x = 0, y = 0, z = 0) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

function addCylinder(parts, rTop, rBot, h, segs, x, y, z, rx = 0, ry = 0, rz = 0, hex = '#888888') {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z);
  parts.push({ g: geo, c: hex });
}

function addWire(parts, p1, p2, hex, r = 0.01, radialSegments = 5) {
  const v1 = new THREE.Vector3(p1[0], p1[1], p1[2]);
  const v2 = new THREE.Vector3(p2[0], p2[1], p2[2]);
  const dist = v1.distanceTo(v2);
  if (dist < 1e-5) return;
  const geo = new THREE.CylinderGeometry(r, r, dist, radialSegments);
  const mid = v1.clone().lerp(v2, 0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    v2.clone().sub(v1).normalize()
  );
  geo.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  parts.push({ g: geo, c: hex });
}

/* ---------------------------------------------------------------- *
 * GEOMETRY                                                          *
 * ---------------------------------------------------------------- */

function terrainGeometry(scale) {
  const step = SIZE / (N - 1);
  const pos = new Float32Array(N * N * 3);
  const col = new Float32Array(N * N * 3);
  const idx = new Uint32Array((N - 1) * (N - 1) * 6);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      pos[k * 3] = -SIZE / 2 + i * step;
      pos[k * 3 + 1] = HEIGHTS[k] * scale;
      pos[k * 3 + 2] = -SIZE / 2 + j * step;
      col[k * 3] = COLORS[k * 3] / 255;
      col[k * 3 + 1] = COLORS[k * 3 + 1] / 255;
      col[k * 3 + 2] = COLORS[k * 3 + 2] / 255;
    }
  }
  let t = 0;
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i;
      const b = a + 1;
      const c = a + N;
      const d = c + 1;
      idx[t++] = a; idx[t++] = c; idx[t++] = b;
      idx[t++] = b; idx[t++] = c; idx[t++] = d;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

function skirtGeometry(scale) {
  const step = SIZE / (N - 1);
  const base = Math.min(H_MIN, WATER_LEVEL) * scale - Math.max(3, SIZE * 0.055);
  const parts = [];
  const half = SIZE / 2;
  // build the four side walls as exact-vertex quads sharing identical corners
  const quad = (a, b, c, d, hex) => {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([
      a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2],
      a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    parts.push({ g, c: hex });
  };
  for (let i = 0; i < N - 1; i++) {
    const x0 = -half + i * step;
    const x1 = -half + (i + 1) * step;
    quad([x0, HEIGHTS[i] * scale, -half], [x1, HEIGHTS[i + 1] * scale, -half],
         [x1, base, -half], [x0, base, -half], 'skirt');
    const sRow = (N - 1) * N;
    quad([x1, HEIGHTS[sRow + i + 1] * scale, half], [x0, HEIGHTS[sRow + i] * scale, half],
         [x0, base, half], [x1, base, half], 'skirt');
    const wj = i * N;
    quad([-half, HEIGHTS[wj] * scale, x1], [-half, HEIGHTS[wj + N] * scale, x0],
         [-half, base, x0], [-half, base, x1], 'skirt');
    const ej = i * N + (N - 1);
    quad([half, HEIGHTS[ej + N] * scale, x0], [half, HEIGHTS[ej] * scale, x1],
         [half, base, x1], [half, base, x0], 'skirt');
  }
  return parts;
}

/* ---------------------------------------------------------------- *
 * ASSET                                                             *
 * ---------------------------------------------------------------- */

export function createAsset(userParams = {}) {
  const p = {};
  for (const k of Object.keys(params)) p[k] = params[k].default;
  Object.assign(p, userParams);

  const C = zonesFor(p.colorway, p);
  const g = new THREE.Group();
  g.name = '${name}';

  const scale = p.heightScale;
  const tint = new THREE.Color(C.terrain);

  // TERRAIN (baked vertex colours, tinted by the active colorway)
  const tGeo = terrainGeometry(scale);
  const colAttr = tGeo.attributes.color;
  for (let i = 0; i < colAttr.count; i++) {
    colAttr.setXYZ(
      i,
      Math.min(1, colAttr.getX(i) * tint.r * 1.6),
      Math.min(1, colAttr.getY(i) * tint.g * 1.6),
      Math.min(1, colAttr.getZ(i) * tint.b * 1.6)
    );
  }
  colAttr.needsUpdate = true;
  const terrain = new THREE.Mesh(tGeo, MAT);
  terrain.name = 'terrain';
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  g.add(terrain);

  // SKIRT
  if (p.skirt) {
    const parts = skirtGeometry(scale).map((s) => ({ g: s.g, c: C.skirt }));
    const merged = mergeGeometries(parts.map((s) => prep(s.g, s.c)));
    if (merged) {
      merged.computeVertexNormals();
      const mesh = new THREE.Mesh(merged, MAT);
      mesh.name = 'skirt';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
  }

  // WATER
  if (p.water) {
    const wg = new THREE.PlaneGeometry(SIZE * 1.03, SIZE * 1.03, 1, 1);
    wg.rotateX(-Math.PI / 2);
    const wm = new THREE.Mesh(prep(wg, C.water), WATER_MAT);
    wm.name = 'water';
    wm.position.y = WATER_LEVEL * scale;
    wm.receiveShadow = true;
    g.add(wm);
  }

  // merge the solid parts into a single draw call for production
  if (p.mergeForProduction) {
    const solids = [];
    const keep = [];
    g.children.forEach((child) => {
      if (child.name === 'water') { keep.push(child); return; }
      const geo = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
      geo.deleteAttribute('uv');
      geo.deleteAttribute('normal');
      solids.push(geo);
    });
    if (solids.length) {
      const merged = mergeGeometries(solids);
      if (merged) {
        merged.computeVertexNormals();
        const mesh = new THREE.Mesh(merged, MAT);
        mesh.name = 'terrain_solid';
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.clear();
        g.add(mesh);
        keep.forEach((k) => g.add(k));
      }
    }
  }

  void addCylinder;
  void addWire;
  void box;
  void finish;

  return g;
}

export default createAsset;
`;
}

/* ------------------------------------------------------------------ */
/* OBJ                                                                */
/* ------------------------------------------------------------------ */

export function buildOBJ(field: TerrainField): string {
  const f = field;
  f.recomputeShading();
  const out: string[] = [];
  out.push('# terrain.obj — generated by Terraformer');
  out.push(`# ${f.n}x${f.n} grid, ${f.size}m, ${(f.n - 1) * (f.n - 1) * 2} triangles`);
  out.push('o terrain');
  for (let j = 0; j < f.n; j++) {
    for (let i = 0; i < f.n; i++) {
      const k = j * f.n + i;
      const r = f.colors[k * 3].toFixed(4);
      const g = f.colors[k * 3 + 1].toFixed(4);
      const b = f.colors[k * 3 + 2].toFixed(4);
      out.push(`v ${f.worldX(i).toFixed(3)} ${f.heights[k].toFixed(3)} ${f.worldZ(j).toFixed(3)} ${r} ${g} ${b}`);
    }
  }
  for (let j = 0; j < f.n - 1; j++) {
    for (let i = 0; i < f.n - 1; i++) {
      const a = j * f.n + i + 1;
      const b = a + 1;
      const c = a + f.n;
      const d = c + 1;
      out.push(`f ${a} ${c} ${b}`);
      out.push(`f ${b} ${c} ${d}`);
    }
  }
  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* PNG heightmap                                                      */
/* ------------------------------------------------------------------ */

export function buildHeightmapPNG(field: TerrainField): string {
  const n = field.n;
  field.recomputeRange();
  const canvas = document.createElement('canvas');
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(n, n);
  const span = Math.max(1e-4, field.maxH - field.minH);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const v = Math.round(((field.heights[k] - field.minH) / span) * 255);
      // PNG rows are top-down: flip j so the map matches the +Z world axis
      const o = ((n - 1 - j) * n + i) * 4;
      img.data[o] = v;
      img.data[o + 1] = v;
      img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

export function buildJSON(field: TerrainField): string {
  return JSON.stringify(
    {
      format: 'terraformer.heightfield.v1',
      grid: field.n,
      sizeMeters: field.size,
      amplitude: field.amplitude,
      waterLevel: field.waterLevel,
      palette: field.paletteId,
      minHeight: field.minH,
      maxHeight: field.maxH,
      heights: Array.from(field.heights, (v) => Number(v.toFixed(4))),
    },
    null,
    0
  );
}
