/**
 * Endless chunk streaming.
 *
 * • Chunks are generated from the continuous WorldSampler, so every edge
 *   matches its neighbour exactly — no stitching, no seams.
 * • Each chunk is rendered as one merged surface + skirt mesh with baked
 *   vertex colours, plus one instanced vegetation mesh.
 * • Generated chunks are persisted to IndexedDB under a key derived from the
 *   world config, so revisiting a place is instant and edits to parameters
 *   cleanly invalidate the cache.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SampleState, WorldSampler } from './world';
import { BIOMES } from './biomes';
import { clamp } from './noise';

export const CHUNK_M = 160; // metres per chunk (all LODs)
export const LOD_VERTS = [49, 25, 13, 7];
export const LOD_MAX_R = [1, 2, 5, 8];
const GEN_VERSION = 4;

/* ------------------------------------------------------------------ */
/* IndexedDB                                                           */
/* ------------------------------------------------------------------ */

const DB_NAME = 'terraformer-worlds';
const DB_VERSION = 1;
const STORE = 'chunks';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export interface ChunkData {
  h: Float32Array;
  c: Uint8Array;
  b: Uint8Array;
  /** analytic normals from the padded grid — identical at shared edges */
  nm?: Float32Array;
  t: number;
}

export async function idbGet(key: string): Promise<ChunkData | undefined> {
  const db = await openDB();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as ChunkData | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function idbPut(key: string, data: ChunkData): Promise<void> {
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(data, key);
  } catch {
    /* storage full or unavailable — generation still works in-memory */
  }
}

export async function idbClear(prefix?: string): Promise<number> {
  const db = await openDB();
  if (!db) return 0;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.openKeyCursor();
      let removed = 0;
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) {
          resolve(removed);
          return;
        }
        const k = String(cur.key);
        if (!prefix || k.startsWith(prefix)) {
          store.delete(cur.key);
          removed++;
        }
        cur.continue();
      };
      req.onerror = () => resolve(removed);
    } catch {
      resolve(0);
    }
  });
}

export async function idbCount(): Promise<number> {
  const db = await openDB();
  if (!db) return 0;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

/* ------------------------------------------------------------------ */
/* vegetation                                                          */
/* ------------------------------------------------------------------ */

function buildTreeGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.22, 0.34, 2.2, 6);
  trunk.translate(0, 1.1, 0);
  const c1 = new THREE.ConeGeometry(1.5, 3.4, 7);
  c1.translate(0, 3.0, 0);
  const c2 = new THREE.ConeGeometry(1.15, 2.8, 7);
  c2.translate(0, 4.4, 0);
  const merged = mergeGeometries([trunk, c1, c2], true) as THREE.BufferGeometry;
  if (!merged) return c1;
  const colors = new Float32Array(merged.attributes.position.count * 3);
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return merged;
}

function buildRockGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) * (0.8 + Math.random() * 0.4),
      pos.getY(i) * (0.55 + Math.random() * 0.4),
      pos.getZ(i) * (0.8 + Math.random() * 0.4)
    );
  }
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ */
/* chunk manager                                                       */
/* ------------------------------------------------------------------ */

export interface ChunkStats {
  loaded: number;
  pending: number;
  generated: number;
  cached: number;
  tris: number;
  saved: number;
}

export class ChunkManager {
  group = new THREE.Group();
  world: WorldSampler;
  prefix = '';
  private material: THREE.MeshStandardMaterial;
  private treeMat: THREE.MeshStandardMaterial;
  private rockMat: THREE.MeshStandardMaterial;
  private treeGeo: THREE.BufferGeometry;
  private rockGeo: THREE.BufferGeometry;

  private live = new Map<string, { mesh: THREE.Mesh; props: THREE.InstancedMesh | null; key: string; lod: number }>();
  private dataCache = new Map<string, ChunkData>();
  private queue: { key: string; cx: number; cz: number; lod: number; d: number }[] = [];
  /** items handed to an in-flight IndexedDB read (or its generation task) */
  private waiting = new Map<string, { key: string; cx: number; cz: number; lod: number; d: number }>();
  private inQueue = new Set<string>();

  stats: ChunkStats = { loaded: 0, pending: 0, generated: 0, cached: 0, tris: 0, saved: 0 };
  maxRadius = 6;
  budgetMs = 9;
  propsEnabled = true;
  propDensity = 0.6;
  onStats?: (s: ChunkStats) => void;

  constructor(world: WorldSampler) {
    this.world = world;
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: false,
      roughness: 0.94,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    this.rockMat = new THREE.MeshStandardMaterial({ color: '#7d7268', roughness: 0.95, flatShading: true });
    this.treeGeo = buildTreeGeometry();
    this.rockGeo = buildRockGeometry();
    this.group.name = 'chunks';
  }

  /** Rebuild the cache key; call whenever the world config changes. */
  setPrefix(cfg: Record<string, unknown>) {
    const c = cfg as Required<WorldSampler['cfg']>;
    this.prefix = [
      GEN_VERSION, c.seed, Math.round(c.scale), Math.round(c.amplitude), Math.round(c.seaLevel * 100),
      c.baseBias.toFixed(3), c.ridge.toFixed(2), c.detail.toFixed(2), c.warp.toFixed(2),
      c.smoothing.toFixed(2), c.forceBiome ?? 'all', c.landmark, Math.round(c.latitude), c.water ? 1 : 0,
    ].join('|');
  }

  clearAll() {
    for (const c of this.live.values()) {
      this.group.remove(c.mesh);
      c.mesh.geometry.dispose();
      if (c.props) {
        this.group.remove(c.props);
        c.props.dispose();
      }
    }
    this.live.clear();
    this.dataCache.clear();
    this.queue.length = 0;
    this.waiting.clear();
    this.inQueue.clear();
    this.stats = { loaded: 0, pending: 0, generated: 0, cached: 0, tris: 0, saved: 0 };
  }

  setFlatShading(v: boolean) {
    this.material.flatShading = v;
    this.material.needsUpdate = true;
  }

  setWireframe(v: boolean) {
    this.material.wireframe = v;
  }

  dispose() {
    this.clearAll();
    this.material.dispose();
    this.treeMat.dispose();
    this.rockMat.dispose();
    this.treeGeo.dispose();
    this.rockGeo.dispose();
  }

  /* ------------------------------ streaming -------------------------- */

  update(focusX: number, focusZ: number) {
    const fx = Math.round(focusX / CHUNK_M);
    const fz = Math.round(focusZ / CHUNK_M);
    const desired = new Set<string>();
    const R = Math.max(1, Math.min(LOD_MAX_R[LOD_MAX_R.length - 1], this.maxRadius));
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const r = Math.max(Math.abs(dx), Math.abs(dz));
        let lod = 0;
        while (lod < LOD_MAX_R.length - 1 && r > LOD_MAX_R[lod]) lod++;
        if (r > LOD_MAX_R[LOD_MAX_R.length - 1]) continue;
        const cx = fx + dx;
        const cz = fz + dz;
        const key = `${this.prefix}:${lod}:${cx}:${cz}`;
        desired.add(key);
        if (!this.live.has(key) && !this.inQueue.has(key)) {
          this.inQueue.add(key);
          this.queue.push({ key, cx, cz, lod, d: r });
        }
      }
    }

    // unload
    for (const [key, c] of this.live) {
      if (!desired.has(key)) {
        this.group.remove(c.mesh);
        c.mesh.geometry.dispose();
        if (c.props) {
          this.group.remove(c.props);
          c.props.dispose();
        }
        this.live.delete(key);
        this.stats.tris -= (c.mesh.geometry.index?.count ?? 0) / 3;
      }
    }

    // drop queue entries that are no longer desired
    if (this.queue.length) {
      this.queue = this.queue.filter((q) => {
        if (desired.has(q.key)) return true;
        this.inQueue.delete(q.key);
        return false;
      });
      this.queue.sort((a, b) => a.lod - b.lod || a.d - b.d);
    }

    // process within a frame budget
    const t0 = performance.now();
    let processed = 0;
    while (this.queue.length && processed < 3) {
      if (performance.now() - t0 > this.budgetMs) break;
      const item = this.queue.shift()!;
      this.inQueue.delete(item.key);
      if (this.live.has(item.key)) continue;

      const data = this.dataCache.get(item.key);
      if (data) {
        this.build(item.key, item.cx, item.cz, item.lod, data, false);
        processed++;
        continue;
      }

      // not cached in memory: ask IndexedDB, then generate if it is missing
      if (this.waiting.has(item.key)) continue;
      this.waiting.set(item.key, item);
      void idbGet(item.key).then((d) => {
        const it = this.waiting.get(item.key);
        this.waiting.delete(item.key);
        if (!it) return;
        if (d) {
          this.dataCache.set(item.key, d);
          this.touch(item.key);
          this.stats.cached++;
        } else {
          const gen = this.generate(it.cx, it.cz, it.lod);
          this.dataCache.set(item.key, gen);
          this.touch(item.key);
          void idbPut(item.key, gen);
          this.stats.generated++;
          this.stats.saved++;
        }
        if (!this.live.has(item.key) && !this.inQueue.has(item.key)) {
          this.queue.push(it);
          this.inQueue.add(item.key);
        }
      });
    }

    this.stats.loaded = this.live.size;
    this.stats.pending = this.queue.length + this.waiting.size;
  }

  private touch(key: string) {
    const d = this.dataCache.get(key);
    if (!d) return;
    this.dataCache.delete(key);
    this.dataCache.set(key, d);
    if (this.dataCache.size > 900) {
      const first = this.dataCache.keys().next().value;
      if (first !== undefined) this.dataCache.delete(first);
    }
  }

  /* ------------------------------ geometry --------------------------- */

  private generate(cx: number, cz: number, lod: number): ChunkData {
    const V = LOD_VERTS[lod];
    const P = V + 2;
    const step = CHUNK_M / (V - 1);
    const half = CHUNK_M / 2;
    // padded grid starts one cell outside the chunk on every side so border
    // normals match the neighbouring chunk exactly
    const x0 = cx * CHUNK_M - half - step;
    const z0 = cz * CHUNK_M - half - step;
    const w = this.world;
    const pad = new Float32Array(P * P);
    const rgb = new Float32Array(3);
    const h = new Float32Array(V * V);
    const c = new Uint8Array(V * V * 3);
    const b = new Uint8Array(V * V);
    const nrm = new Float32Array(V * V * 3);
    const states: SampleState[] = new Array(P * P);
    for (let i = 0; i < P * P; i++) states[i] = new SampleState();

    for (let j = 0; j < P; j++) {
      const z = z0 + j * step;
      for (let i = 0; i < P; i++) {
        const pi = j * P + i;
        pad[pi] = w.prepare(x0 + i * step, z, states[pi]);
      }
    }

    const inv2 = 1 / (2 * step);
    for (let j = 0; j < V; j++) {
      for (let i = 0; i < V; i++) {
        const pi = i + 1;
        const pj = j + 1;
        const k = j * V + i;
        h[k] = pad[pj * P + pi];
        const gx = (pad[pj * P + pi + 1] - pad[pj * P + pi - 1]) * inv2;
        const gz = (pad[(pj + 1) * P + pi] - pad[(pj - 1) * P + pi]) * inv2;
        let nx = -gx;
        let ny = 1;
        let nz = -gz;
        const len = Math.hypot(nx, ny, nz) || 1;
        nrm[k * 3] = nx / len;
        nrm[k * 3 + 1] = ny / len;
        nrm[k * 3 + 2] = nz / len;
        const slope = clamp(Math.hypot(gx, gz) / 2.2, 0, 1);
        b[k] = w.shade(states[pj * P + pi], h[k], slope, rgb);
        c[k * 3] = Math.round(rgb[0] * 255);
        c[k * 3 + 1] = Math.round(rgb[1] * 255);
        c[k * 3 + 2] = Math.round(rgb[2] * 255);
      }
    }
    return { h, c, b, nm: nrm, t: Date.now() };
  }

  private build(key: string, cx: number, cz: number, lod: number, d: ChunkData, isNew: boolean) {
    const V = LOD_VERTS[lod];
    const step = CHUNK_M / (V - 1);
    const ox = cx * CHUNK_M - CHUNK_M / 2;
    const oz = cz * CHUNK_M - CHUNK_M / 2;
    const h = d.h;
    const c = d.c;

    const perimeter: number[] = [];
    for (let i = 0; i < V; i++) perimeter.push(i);
    for (let j = 1; j < V; j++) perimeter.push(j * V + (V - 1));
    for (let i = V - 2; i >= 0; i--) perimeter.push((V - 1) * V + i);
    for (let j = V - 2; j >= 1; j--) perimeter.push(j * V);

    const vCount = V * V + perimeter.length;
    const pos = new Float32Array(vCount * 3);
    const col = new Float32Array(vCount * 3);
    const nrm = new Float32Array(vCount * 3);

    let minH = Infinity;
    for (let i = 0; i < h.length; i++) if (h[i] < minH) minH = h[i];
    const skirtY = minH - Math.max(14, CHUNK_M * 0.12);

    for (let k = 0; k < V * V; k++) {
      const i = k % V;
      const j = (k / V) | 0;
      pos[k * 3] = ox + i * step;
      pos[k * 3 + 1] = h[k];
      pos[k * 3 + 2] = oz + j * step;
      col[k * 3] = c[k * 3] / 255;
      col[k * 3 + 1] = c[k * 3 + 1] / 255;
      col[k * 3 + 2] = c[k * 3 + 2] / 255;
    }
    if (d.nm && d.nm.length === V * V * 3) {
      nrm.set(d.nm);
    } else {
      for (let k = 0; k < V * V; k++) {
        nrm[k * 3] = 0;
        nrm[k * 3 + 1] = 1;
        nrm[k * 3 + 2] = 0;
      }
    }
    for (let p = 0; p < perimeter.length; p++) {
      const src = perimeter[p];
      const v = V * V + p;
      pos[v * 3] = pos[src * 3];
      pos[v * 3 + 1] = skirtY;
      pos[v * 3 + 2] = pos[src * 3 + 2];
      col[v * 3] = col[src * 3] * 0.55;
      col[v * 3 + 1] = col[src * 3 + 1] * 0.55;
      col[v * 3 + 2] = col[src * 3 + 2] * 0.55;
      nrm[v * 3] = 0;
      nrm[v * 3 + 1] = 1;
      nrm[v * 3 + 2] = 0;
    }

    const idx = new Uint32Array((V - 1) * (V - 1) * 6 + perimeter.length * 6);
    let t = 0;
    for (let j = 0; j < V - 1; j++) {
      for (let i = 0; i < V - 1; i++) {
        const a = j * V + i;
        const bb = a + 1;
        const cc = a + V;
        const dd = cc + 1;
        idx[t++] = a; idx[t++] = cc; idx[t++] = bb;
        idx[t++] = bb; idx[t++] = cc; idx[t++] = dd;
      }
    }
    for (let p = 0; p < perimeter.length; p++) {
      const p2 = (p + 1) % perimeter.length;
      const a = perimeter[p];
      const b2 = perimeter[p2];
      const at = V * V + p;
      const bt = V * V + p2;
      idx[t++] = a; idx[t++] = b2; idx[t++] = at;
      idx[t++] = at; idx[t++] = b2; idx[t++] = bt;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    if (!d.nm || d.nm.length !== V * V * 3) geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, this.material);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = key;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);

    const props = this.propsEnabled && lod <= 1 ? this.buildProps(cx, cz, lod, d) : null;
    if (props) this.group.add(props);

    this.live.set(key, { mesh, props, key, lod });
    this.stats.tris += idx.length / 3;
    void isNew;
  }

  private buildProps(cx: number, cz: number, lod: number, d: ChunkData): THREE.InstancedMesh | null {
    const V = LOD_VERTS[lod];
    const ox = cx * CHUNK_M - CHUNK_M / 2;
    const oz = cz * CHUNK_M - CHUNK_M / 2;
    const sea = this.world.cfg.seaLevel;
    const amp = this.world.cfg.amplitude;
    const want = Math.round((lod === 0 ? 90 : 30) * this.propDensity);
    if (want <= 0) return null;

    const mats: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const tmp = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    let rnd = (cx * 73856093) ^ (cz * 19349663) ^ 0x5f3759df;

    for (let a = 0; a < want * 3 && mats.length < want; a++) {
      rnd = (rnd * 1664525 + 1013904223) | 0;
      const fx = ((rnd >>> 8) & 0xffff) / 0xffff;
      rnd = (rnd * 1664525 + 1013904223) | 0;
      const fz = ((rnd >>> 8) & 0xffff) / 0xffff;
      rnd = (rnd * 1664525 + 1013904223) | 0;
      const fr = ((rnd >>> 8) & 0xffff) / 0xffff;
      const gi = Math.min(V - 1, Math.floor(fx * V));
      const gj = Math.min(V - 1, Math.floor(fz * V));
      const k = gj * V + gi;
      const hh = d.h[k];
      if (hh < sea + 1.2) continue;
      if (hh > sea + amp * 0.62) continue;
      const biome = BIOMES[d.b[k]] ?? BIOMES[0];
      const density = biome.trees + biome.rocks;
      if (fr > density * 0.9) continue;
      const x = ox + fx * CHUNK_M;
      const z = oz + fz * CHUNK_M;
      const isTree = fr < biome.trees * 0.9 && biome.trees > 0.12;
      const scale = isTree ? 0.8 + ((rnd >>> 3) & 0xff) / 255 * 0.7 : 0.5 + ((rnd >>> 5) & 0xff) / 255 * 1.1;
      q.setFromAxisAngle(up, ((rnd >>> 7) & 0xff) / 255 * Math.PI * 2);
      s.set(scale, scale * (isTree ? 0.9 + ((rnd >>> 9) & 0xff) / 510 : 0.6), scale);
      p.set(x, hh - 0.3 * scale, z);
      const m = new THREE.Matrix4().compose(p, q, s);
      mats.push(m);
      if (isTree) {
        tmp.setHSL(0.28 + ((rnd >>> 11) & 0xff) / 255 * 0.06, 0.42, 0.26 + ((rnd >>> 13) & 0xff) / 255 * 0.12);
      } else {
        tmp.setHSL(0.08, 0.08, 0.34 + ((rnd >>> 15) & 0xff) / 255 * 0.16);
      }
      colors.push(tmp.clone());
    }
    if (!mats.length) return null;

    // trees and rocks share one instanced mesh by merging geometries is not
    // possible per-instance, so we emit the dominant type per chunk
    const treeCount = colors.filter((c2) => c2.g > c2.b).length;
    const useTree = treeCount >= colors.length / 2;
    const im = new THREE.InstancedMesh(useTree ? this.treeGeo : this.rockGeo, useTree ? this.treeMat : this.rockMat, mats.length);
    for (let i = 0; i < mats.length; i++) {
      im.setMatrixAt(i, mats[i]);
      im.setColorAt(i, colors[i]);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = true;
    im.computeBoundingSphere();
    return im;
  }

  /** Height lookup that falls back to the sampler (used by the camera rig). */
  heightAt(x: number, z: number) {
    return this.world.heightAt(x, z);
  }
}
