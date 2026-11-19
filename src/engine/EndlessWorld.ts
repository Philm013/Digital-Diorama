import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Engine } from './Engine';
import type { Terrain } from './Terrain';
import { Actor, type WorldQuery } from './Actor';
import { GROUND_INDEX as G, GROUND_TYPES, createGroundMaterial, createPaintTexture, groundScores, type PaintGrid } from './ground';
import { styleForBiome, type GroundStyle } from './landforms';
import { CoverKit, Groundcover } from './Groundcover';
import { WATER_FRAG, WATER_VERT } from './Water';
import { applyWind } from './wind';
import { Noise2D, clamp, disposeObject, lerp, rng, smoothstep, uid } from './util';
import { buildModel } from '../assets/builder';
import { CATALOG } from '../assets/catalog';
import type { AssetDef } from '../assets/types';

/**
 * The endless world around a diorama, for Explore → Roam. Terrain is streamed in square chunks
 * around the walker (finer close by, coarser far away), continuing the diorama's habitat: its
 * edges flow out into rolling land, with lakes, rivers and — further off — big mountains. Plants
 * from the diorama grow across it (instanced, swaying in the wind), its animals roam it, and
 * grass, flowers and pebbles carpet the ground near the walker. Nothing here is saved.
 */

const CHUNK = 32;
/** how far (m) past the diorama's edge its own ground flows into the world */
const SKIRT = 16;

interface Profile { relief: number; scale: number; ridges: number; mountains: number; dunes: number; lakes: number }
const PROFILES: Record<string, Partial<Profile>> = {
  forest: { relief: 2.6, ridges: 1.6, mountains: 16, lakes: 0.35 },
  taiga: { relief: 3, ridges: 3, mountains: 22, lakes: 0.55 },
  grassland: { relief: 1.6, scale: 1 / 70, ridges: 0.6, mountains: 8, lakes: 0.25 },
  savanna: { relief: 1.3, scale: 1 / 70, ridges: 0.8, mountains: 9, lakes: 0.2 },
  rainforest: { relief: 4, ridges: 3, mountains: 20, lakes: 0.4 },
  desert: { relief: 1.2, dunes: 3.2, ridges: 1, mountains: 12, lakes: 0.03 },
  tundra: { relief: 1.6, ridges: 1.2, mountains: 10, lakes: 0.6 },
  wetland: { relief: 0.7, ridges: 0.2, mountains: 5, lakes: 0.9 },
  mountain: { relief: 5, ridges: 7, mountains: 34, lakes: 0.3 },
  garden: { relief: 1.2, ridges: 0.4, mountains: 6, lakes: 0.25 },
  shore: { relief: 1.6, ridges: 0.6, mountains: 8, lakes: 0.75 },
};
const BIOME_OF_STYLE: Record<string, string> = { meadow: 'grassland', beach: 'shore', arctic: 'tundra', badlands: 'desert', volcanic: 'mountain', heath: 'tundra' };
/** grounds plants don't grow on */
const BARE = new Set([G.rock, G.cliff, G.snow, G.ice, G.salt, G.ash, G.scree, G.gravel, G.shingle]);

interface Plants { x: number; y: number; z: number; rot: number; scale: number }
interface Chunk {
  key: string; cx: number; cz: number; segs: number;
  mesh: THREE.Mesh; water: THREE.Mesh | null; cover: Groundcover | null;
  paint: Uint8Array; grid: PaintGrid;
  /** plant placements per species */
  plants: Plants[][];
}
interface Species {
  def: AssetDef;
  /** instances per m² */
  density: number;
  /** how far away it is still drawn (m) */
  reach: number;
  cap: number;
  parts: { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[] }[];
  meshes: THREE.InstancedMesh[];
  shadow: boolean;
}
interface Roamer { actor: Actor; home: THREE.Vector3 }

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export class EndlessWorld {
  active = false;
  group = new THREE.Group();
  /** water level of the world (null: dry), base ground level and its ground style */
  waterLevel: number | null = null;
  base = 0;
  style!: GroundStyle;
  biome = 'grassland';
  /** view radius in chunks */
  private radius = 5;
  private chunks = new Map<string, Chunk>();
  private building = new Set<string>();
  private centre = { cx: 1e9, cz: 1e9 };
  private profile!: Profile;
  private N = new Noise2D(1);
  private terrain!: Terrain;
  private near = 40;
  private waterMat: THREE.ShaderMaterial | null = null;
  private kit: CoverKit | null = null;
  private species: Species[] = [];
  private speciesReady = false;
  private instancesDirty = true;
  private instancesAt = 0;
  private roamers: Roamer[] = [];
  private animalDefs: AssetDef[] = [];
  private spawnTimer = 0;
  private spawning = false;
  private runId = 0;
  private lastPos = new THREE.Vector3();

  constructor(private e: Engine) {
    this.group.name = 'endless-world';
  }

  /* ======================= the shape of the world ======================= */
  private inDiorama(x: number, z: number, pad = 0) {
    const t = this.terrain;
    return Math.abs(x) < t.width / 2 + pad && Math.abs(z) < t.depth / 2 + pad;
  }

  /** the endless landscape alone, without the diorama */
  worldHeight(x: number, z: number) {
    const P = this.profile, N = this.N;
    const s = P.scale;
    let h = this.base + P.relief * N.fbm(x * s, z * s, 4);
    const far = smoothstep(this.near, this.near + 150, Math.hypot(x, z));
    if (P.ridges) h += P.ridges * (N.ridged(x * s * 0.7 + 17, z * s * 0.7 - 9, 4) - 0.3) * (0.35 + 0.65 * far);
    if (P.mountains) h += P.mountains * Math.pow(N.ridged(x / 240 + 3.3, z / 240 - 1.7, 5), 2.2) * far;
    if (P.dunes) {
      const w = x * 0.12 + N.fbm(x * 0.02, z * 0.02, 2) * 3;
      const crest = Math.pow(0.5 + 0.5 * Math.sin(w + z * 0.04), 2.2);
      h += P.dunes * (crest * (0.7 + 0.3 * N.noise(x * 0.04, z * 0.06)) - 0.3);
    }
    const wl = this.waterLevel;
    if (wl !== null && P.lakes > 0) {
      // lakes fill the lowest basins; rivers wind between them
      const l = N.fbm(x / 110 + 40, z / 110 - 20, 3);
      const q = -0.38 + P.lakes * 0.42;
      const lake = smoothstep(q + 0.09, q - 0.05, l);
      if (lake > 0) h = lerp(h, wl - 0.4 - 1.6 * lake, lake);
      if (P.lakes >= 0.25) {
        const r = Math.abs(N.fbm(x / 160 - 70, z / 160 + 30, 3));
        const bank = smoothstep(0.05, 0.022, r), bed = smoothstep(0.022, 0.008, r);
        if (bank > 0) h = lerp(h, Math.min(h, wl + 0.25), bank);
        if (bed > 0) h = lerp(h, wl - 0.7, bed);
      }
    }
    return h;
  }

  /** ground height anywhere: the diorama inside its box, flowing out into the world around it */
  heightAt = (x: number, z: number) => {
    const t = this.terrain;
    const hw = t.width / 2, hd = t.depth / 2;
    const cx = x < -hw ? -hw : x > hw ? hw : x, cz = z < -hd ? -hd : z > hd ? hd : z;
    const dx = x - cx, dz = z - cz;
    if (dx === 0 && dz === 0) return t.heightAt(x, z);
    const edge = t.heightAt(cx, cz);
    return edge + (this.worldHeight(x, z) - edge) * smoothstep(0, SKIRT, Math.sqrt(dx * dx + dz * dz));
  };

  waterAt = (x: number, z: number): number | null => {
    if (this.inDiorama(x, z)) {
      const wl = this.terrain.waterLevel;
      return wl !== null && this.terrain.heightAt(x, z) < wl ? wl : null;
    }
    const wl = this.waterLevel;
    return wl !== null && this.heightAt(x, z) < wl ? wl : null;
  };

  /** the kind of ground at a point of the world (outside the diorama) */
  private groundFor(x: number, z: number, h: number, slope: number, N: Noise2D) {
    const t = this.terrain;
    const hw = t.width / 2, hd = t.depth / 2;
    const out = Math.hypot(x - clamp(x, -hw, hw), z - clamp(z, -hd, hd));
    // close to the box, its own ground carries on outward with a wandering edge
    if (out < SKIRT * 0.75 + N.noise(x * 0.15, z * 0.15) * 3) {
      const g = t.paintGrid;
      const i = Math.round((clamp(x, -hw, hw) + hw) / g.dx), j = Math.round((clamp(z, -hd, hd) + hd) / g.dz);
      const edgeType = t.paint[clamp(j, 0, t.nz - 1) * t.nx + clamp(i, 0, t.nx - 1)];
      if (slope < 0.8 || edgeType === G.rock || edgeType === G.cliff) return edgeType;
    }
    const wl = this.waterLevel;
    const above = h - this.base;
    return this.style.pick({
      x, z, h, above, rel: clamp(above / Math.max(4, this.profile.mountains * 0.6), 0, 1), slope,
      wet: wl === null ? 99 : h < wl ? h - wl : (h - wl) * 0.45,
      n1: N.fbm(x * 0.08, z * 0.08, 3), n2: N.noise(x * 0.3, z * 0.3),
    });
  }

  /* ======================= start / stop ======================= */
  start() {
    const e = this.e, t = e.terrain;
    if (!t || this.active) return;
    this.terrain = t;
    this.runId++;
    const biome = e.doc.biome;
    this.style = styleForBiome(biome);
    this.biome = biome === 'blank' ? 'grassland' : (PROFILES[biome] ? biome : BIOME_OF_STYLE[this.style.id] ?? 'grassland');
    this.profile = { relief: 1.6, scale: 1 / 45, ridges: 0.8, mountains: 12, dunes: 0, lakes: 0.3, ...PROFILES[this.biome] } as Profile;
    this.N = new Noise2D(t.seed * 7 + 101);
    // settle the world at the height of the diorama's edges
    const edge: number[] = [];
    for (let i = 0; i < t.nx; i += 2) edge.push(t.h(i, 0), t.h(i, t.nz - 1));
    for (let j = 0; j < t.nz; j += 2) edge.push(t.h(0, j), t.h(t.nx - 1, j));
    edge.sort((a, b) => a - b);
    this.base = edge[Math.floor(edge.length / 2)] ?? 0;
    this.waterLevel = t.waterLevel ?? (this.profile.lakes > 0.05 ? this.base - 0.5 : null);
    this.near = Math.max(t.width, t.depth) * 0.6 + SKIRT;
    this.radius = e.quality === 'high' ? 6 : e.quality === 'medium' ? 5 : 4;
    this.waterMat = e.water ? new THREE.ShaderMaterial({ vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, uniforms: e.water.material.uniforms, defines: { DEPTH_ATTR: 1 }, transparent: true, depthWrite: false, fog: true }) : null;
    const snowy = e.env.season === 'winter' || e.env.weather === 'snow';
    this.kit = new CoverKit(e.quality, snowy ? 'winter' : e.env.season, t.seed + 5);
    this.active = true;
    this.centre = { cx: 1e9, cz: 1e9 };
    e.scene.add(this.group);
    void this.prepareSpecies(this.runId);
    this.prepareAnimals();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.runId++;
    for (const c of this.chunks.values()) this.disposeChunk(c);
    this.chunks.clear();
    this.building.clear();
    for (const s of this.species) for (const m of s.meshes) { this.group.remove(m); m.dispose(); }
    for (const s of this.species) for (const p of s.parts) { p.geo.dispose(); for (const m of Array.isArray(p.mat) ? p.mat : [p.mat]) m.dispose(); }
    this.species = [];
    this.speciesReady = false;
    for (const r of this.roamers) this.dropRoamer(r);
    this.roamers = [];
    this.kit?.dispose();
    this.kit = null;
    this.waterMat?.dispose();
    this.waterMat = null;
    this.e.scene.remove(this.group);
  }

  /** how far the walker can see (m), for fog */
  get viewDistance() { return (this.radius + 0.5) * CHUNK; }

  /* ======================= per frame ======================= */
  update(dt: number, pos: THREE.Vector3) {
    if (!this.active) return;
    const cx = Math.floor(pos.x / CHUNK), cz = Math.floor(pos.z / CHUNK);
    if (cx !== this.centre.cx || cz !== this.centre.cz) {
      const first = this.centre.cx === 1e9;
      this.centre = { cx, cz };
      this.refreshChunks(first);
    }
    // build what is missing, nearest first, within a few milliseconds a frame
    const t0 = performance.now();
    const budget = this.e.quality === 'low' ? 5 : 7;
    while (performance.now() - t0 < budget) {
      const job = this.nextJob();
      if (!job) break;
      job();
    }
    if (this.instancesDirty && this.speciesReady && performance.now() - this.instancesAt > 400) this.layoutPlants(pos);
    else if (this.speciesReady && pos.distanceToSquared(this.lastPos) > 64) this.layoutPlants(pos);
    this.updateRoamers(dt, pos);
  }

  /** chunks wanted around the walker and the detail each needs */
  private wanted() {
    const out: { key: string; cx: number; cz: number; segs: number; ring: number }[] = [];
    const R = this.radius, { cx, cz } = this.centre;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const ring = Math.max(Math.abs(dx), Math.abs(dz));
      if (Math.hypot(dx, dz) > R + 0.5) continue;
      const segs = ring <= 1 ? 32 : ring <= 3 ? 16 : 8;
      out.push({ key: `${cx + dx},${cz + dz}`, cx: cx + dx, cz: cz + dz, segs, ring });
    }
    return out.sort((a, b) => a.ring - b.ring);
  }

  private queue: { key: string; cx: number; cz: number; segs: number; ring: number }[] = [];
  private refreshChunks(first: boolean) {
    const want = this.wanted();
    const keep = new Set(want.map((w) => w.key));
    for (const [k, c] of this.chunks) if (!keep.has(k)) { this.disposeChunk(c); this.chunks.delete(k); this.instancesDirty = true; }
    this.queue = want.filter((w) => { const c = this.chunks.get(w.key); return !c || c.segs !== w.segs || (!c.cover && w.ring <= 1) || (c.cover && w.ring > 1); });
    // the ground under the walker's feet is built straight away
    if (first) for (const w of this.queue.filter((q) => q.ring === 0)) this.buildChunk(w);
  }

  private nextJob(): (() => void) | null {
    while (this.queue.length) {
      const w = this.queue.shift()!;
      const c = this.chunks.get(w.key);
      if (c && c.segs === w.segs) {
        // only its groundcover changes
        if (w.ring <= 1 && !c.cover) return () => this.coverChunk(c);
        if (w.ring > 1 && c.cover) return () => { this.group.remove(c.cover!.group); c.cover!.clear(); c.cover = null; };
        continue;
      }
      return () => this.buildChunk(w);
    }
    return null;
  }

  /* ======================= chunks ======================= */
  private buildChunk(w: { key: string; cx: number; cz: number; segs: number; ring: number }) {
    const t = this.terrain;
    const segs = w.segs, n = segs + 1, step = CHUNK / segs;
    const x0 = w.cx * CHUNK, z0 = w.cz * CHUNK;
    // heights on a grid one vertex wider all round (for normals and the paint border)
    const P = n + 2;
    const H = new Float32Array(P * P);
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) H[j * P + i] = this.heightAt(x0 + (i - 1) * step, z0 + (j - 1) * step);
    const hw = t.width / 2 - 1e-3, hd = t.depth / 2 - 1e-3;
    const inside = (x: number, z: number) => Math.abs(x) < hw && Math.abs(z) < hd;
    const N = this.N;
    // ground types, one texel per vertex plus a border so edges match the next chunk
    const paint = new Uint8Array(P * P);
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
      const x = x0 + (i - 1) * step, z = z0 + (j - 1) * step;
      const hx = (H[j * P + Math.min(P - 1, i + 1)] - H[j * P + Math.max(0, i - 1)]) / (2 * step);
      const hz = (H[Math.min(P - 1, j + 1) * P + i] - H[Math.max(0, j - 1) * P + i]) / (2 * step);
      paint[j * P + i] = this.groundFor(x, z, H[j * P + i], Math.hypot(hx, hz), N);
    }
    const skirt = n * 4;
    const pos = new Float32Array((n * n + skirt) * 3), nor = new Float32Array((n * n + skirt) * 3), col = new Float32Array((n * n + skirt) * 3);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i, g = (j + 1) * P + (i + 1);
      const x = x0 + i * step, z = z0 + j * step;
      let y = H[g];
      if (inside(x, z)) y -= 0.08; // tucked under the diorama's own surface
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      const hx = H[g - 1] - H[g + 1], hz = H[g - P] - H[g + P];
      const l = Math.hypot(hx, 2 * step, hz);
      nor[k * 3] = hx / l; nor[k * 3 + 1] = (2 * step) / l; nor[k * 3 + 2] = hz / l;
      const cav = (H[g - 1] + H[g + 1] + H[g - P] + H[g + P]) / 4 - H[g];
      const ao = cav > 0 ? 1 - 0.3 * Math.tanh(cav * 1.8) : 1 + 0.07 * Math.tanh(-cav * 2);
      col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = ao;
    }
    // skirts hang down from every edge so neighbours of a different detail never show a gap
    const drop = step * 1.5 + 0.6;
    const edges: number[][] = [[], [], [], []];
    for (let q = 0; q < n; q++) { edges[0].push(q); edges[1].push((n - 1) * n + q); edges[2].push(q * n); edges[3].push(q * n + n - 1); }
    let sv = n * n;
    const idx: number[] = [];
    for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      // the diorama draws its own ground: leave a hole under it
      if (inside(pos[a * 3], pos[a * 3 + 2]) && inside(pos[d * 3], pos[d * 3 + 2]) && inside(pos[b * 3], pos[b * 3 + 2]) && inside(pos[c * 3], pos[c * 3 + 2])) continue;
      idx.push(a, c, b, b, c, d);
    }
    for (let e = 0; e < 4; e++) {
      const list = edges[e], start = sv;
      for (const k of list) {
        pos[sv * 3] = pos[k * 3]; pos[sv * 3 + 1] = pos[k * 3 + 1] - drop; pos[sv * 3 + 2] = pos[k * 3 + 2];
        nor[sv * 3] = nor[k * 3]; nor[sv * 3 + 1] = nor[k * 3 + 1]; nor[sv * 3 + 2] = nor[k * 3 + 2];
        col[sv * 3] = col[sv * 3 + 1] = col[sv * 3 + 2] = 0.8;
        sv++;
      }
      for (let q = 0; q < list.length - 1; q++) {
        const a = list[q], b = list[q + 1], a2 = start + q, b2 = start + q + 1;
        idx.push(a, b, a2, b, b2, a2, a, a2, b, b, a2, b2); // both windings: seen from either side
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const tex = createPaintTexture(paint, P, P);
    const mat = createGroundMaterial({ paint: tex, x0: x0 - step, z0: z0 - step, dx: step, dz: step, nx: P, nz: P, waterY: this.waterLevel, overlay: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = w.ring <= 2;
    mesh.name = 'endless-chunk';
    const water = this.buildWater(x0, z0, segs, step, H, P);
    const old = this.chunks.get(w.key);
    const chunk: Chunk = {
      key: w.key, cx: w.cx, cz: w.cz, segs, mesh, water, cover: null, paint,
      grid: { paint, nx: P, nz: P, x0: x0 - step, z0: z0 - step, dx: step, dz: step },
      plants: old?.plants ?? this.placePlants(w.cx, w.cz),
    };
    if (old) { old.plants = []; this.disposeChunk(old); }
    this.chunks.set(w.key, chunk);
    this.group.add(mesh);
    if (water) this.group.add(water);
    if (w.ring <= 1) this.coverChunk(chunk);
    this.instancesDirty = true;
  }

  /** water over the cells of a chunk that dip below the water level (not over the diorama: it has its own) */
  private buildWater(x0: number, z0: number, segs: number, step: number, H: Float32Array, P: number) {
    const wl = this.waterLevel;
    if (wl === null || !this.waterMat) return null;
    const t = this.terrain, hw = t.width / 2, hd = t.depth / 2;
    const pos: number[] = [], dep: number[] = [], idx: number[] = [];
    const quad = (ax: number, az: number, bx: number, bz: number) => {
      if (bx - ax < 1e-4 || bz - az < 1e-4) return;
      const v = pos.length / 3;
      for (const [x, z] of [[ax, az], [bx, az], [ax, bz], [bx, bz]]) { pos.push(x, wl, z); dep.push(wl - this.heightAt(x, z)); }
      idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
    };
    for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) {
      const g = (j + 1) * P + (i + 1);
      const lo = Math.min(H[g], H[g + 1], H[g + P], H[g + P + 1]);
      if (lo > wl + 0.02) continue;
      const ax = x0 + i * step, az = z0 + j * step, bx = ax + step, bz = az + step;
      // cut the diorama's box out of the cell: up to four strips around it
      if (bx <= -hw || ax >= hw || bz <= -hd || az >= hd) { quad(ax, az, bx, bz); continue; }
      quad(ax, az, Math.min(bx, -hw), bz);
      quad(Math.max(ax, hw), az, bx, bz);
      const mx0 = Math.max(ax, -hw), mx1 = Math.min(bx, hw);
      quad(mx0, az, mx1, Math.min(bz, -hd));
      quad(mx0, Math.max(az, hd), mx1, bz);
    }
    if (!pos.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, this.waterMat);
    m.renderOrder = 1;
    m.name = 'endless-water';
    return m;
  }

  /** grass, flowers and pebbles on a chunk near the walker */
  private coverChunk(c: Chunk) {
    if (!this.kit || c.cover) return;
    const t = this.terrain;
    const x0 = c.cx * CHUNK, z0 = c.cz * CHUNK;
    const cover = new Groundcover();
    cover.buildPatch({
      heightAt: this.heightAt,
      groundAt: (x, z) => {
        if (this.inDiorama(x, z)) return GROUND_TYPES[G.salt];
        return GROUND_TYPES[dominant(c.grid, x, z)] ?? GROUND_TYPES[0];
      },
      slopeAt: (x, z) => { const e = 0.5; return Math.hypot(this.heightAt(x + e, z) - this.heightAt(x - e, z), this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e); },
      waterLevel: this.waterLevel,
    }, this.kit, x0, x0 + CHUNK, z0, z0 + CHUNK, this.e.env.grass * 0.75, t.seed + c.cx * 7919 + c.cz * 104729);
    c.cover = cover;
    this.group.add(cover.group);
  }

  private disposeChunk(c: Chunk) {
    this.group.remove(c.mesh);
    c.mesh.geometry.dispose();
    const mat = c.mesh.material as THREE.MeshStandardMaterial;
    (mat.userData.ground?.uPaint.value as THREE.Texture | undefined)?.dispose();
    mat.dispose();
    if (c.water) { this.group.remove(c.water); c.water.geometry.dispose(); }
    if (c.cover) { this.group.remove(c.cover.group); c.cover.clear(); }
  }

  /* ======================= plants ======================= */
  /** the diorama's plants (and its habitat's, if it has few) as instanced meshes */
  private async prepareSpecies(run: number) {
    const e = this.e;
    const counts = new Map<string, { def: AssetDef; n: number }>();
    for (const a of e.actorList) {
      const d = a.def;
      if (a.isClone || d.water || !['plants', 'fungi', 'land'].includes(d.category)) continue;
      if (!['flora', 'conifer', 'deciduous', 'terraTree', 'rock', 'plant'].includes(d.family)) continue;
      const c = counts.get(d.id) ?? { def: d, n: 0 };
      c.n++;
      counts.set(d.id, c);
    }
    // too few to make a landscape: borrow plants of the habitat
    if ([...counts.values()].filter((c) => c.def.category === 'plants').length < 3) {
      const pool = CATALOG.filter((d) => d.category === 'plants' && ['flora', 'conifer', 'deciduous', 'terraTree'].includes(d.family) && !d.water && d.biomes.includes(this.biome));
      const R = rng(this.terrain.seed * 13 + 1);
      for (let k = 0; k < 5 && pool.length; k++) {
        const d = pool.splice(Math.floor(R() * pool.length), 1)[0];
        if (!counts.has(d.id)) counts.set(d.id, { def: d, n: d.group === 'Trees' ? 3 : 4 });
      }
    }
    const area = Math.max(200, this.terrain.width * this.terrain.depth);
    const budget = e.quality === 'high' ? 1_400_000 : e.quality === 'medium' ? 700_000 : 300_000;
    const list = [...counts.values()].slice(0, 10);
    const perSpecies = budget / Math.max(1, list.length);
    for (const { def, n } of list) {
      if (run !== this.runId) return;
      try {
        const model = await buildModel(def, {}, 'low', e.env.trueScale, true);
        if (run !== this.runId) return;
        const sp = this.speciesFrom(def, model, Math.min(0.03, (n / area) * 0.9), perSpecies);
        if (sp) { this.species.push(sp); for (const m of sp.meshes) this.group.add(m); }
      } catch (err) { console.warn('endless: could not build', def.id, err); }
      await new Promise((r) => requestAnimationFrame(r));
    }
    if (run !== this.runId) return;
    // chunks built before the species were known get their plants now
    for (const c of this.chunks.values()) c.plants = this.placePlants(c.cx, c.cz);
    this.speciesReady = true;
    this.instancesDirty = true;
  }

  private speciesFrom(def: AssetDef, model: Awaited<ReturnType<typeof buildModel>>, density: number, triBudget: number): Species | null {
    model.object.position.set(0, 0, 0);
    model.object.updateMatrixWorld(true);
    const byMat = new Map<THREE.Material | THREE.Material[], THREE.BufferGeometry[]>();
    let tris = 0;
    model.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || !m.visible) return;
      const g = m.geometry.clone();
      for (const k of Object.keys(g.morphAttributes)) delete (g.morphAttributes as Record<string, unknown>)[k];
      g.applyMatrix4(m.matrixWorld);
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      const list = byMat.get(m.material) ?? [];
      list.push(g);
      byMat.set(m.material, list);
    });
    if (!byMat.size) return null;
    const h = model.height / (model.exhibitScale || 1);
    const parts: Species['parts'] = [];
    for (const [mat, geos] of byMat) {
      let geo: THREE.BufferGeometry | null = null;
      if (geos.length > 1 && !Array.isArray(mat)) {
        const names = Object.keys(geos[0].attributes).filter((k) => geos.every((g) => k in g.attributes));
        const ok = geos.every((g) => !!g.index) || geos.every((g) => !g.index);
        if (ok) {
          for (const g of geos) for (const k of Object.keys(g.attributes)) if (!names.includes(k)) g.deleteAttribute(k);
          geo = mergeGeometries(geos, false);
        }
      }
      if (geo) { for (const g of geos) g.dispose(); parts.push({ geo, mat: this.windMaterial(mat, h, def) }); }
      else for (const g of geos) parts.push({ geo: g, mat: this.windMaterial(mat, h, def) });
    }
    const big = h > 2.5;
    const cap = Math.max(4, Math.min(big ? 220 : 420, Math.floor(triBudget / Math.max(50, tris))));
    const meshes = parts.map((p) => {
      const im = new THREE.InstancedMesh(p.geo, p.mat, cap);
      im.count = 0;
      im.castShadow = big;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.name = 'endless-' + def.id;
      return im;
    });
    return { def, density, reach: big ? Math.min(this.viewDistance * 0.9, 150) : h > 0.8 ? 70 : 42, cap, parts, meshes, shadow: big };
  }

  private windMaterial(mat: THREE.Material | THREE.Material[], h: number, def: AssetDef): THREE.Material | THREE.Material[] {
    const one = (m: THREE.Material) => {
      const c = m.clone();
      c.userData = { ...c.userData, wind: false };
      if (def.category === 'plants') applyWind(c, h, def.family === 'plant' ? 0.6 : 0.35, true);
      return c;
    };
    return Array.isArray(mat) ? mat.map(one) : one(mat);
  }

  /** where each species grows in a chunk (seeded, so a chunk always looks the same) */
  private placePlants(cx: number, cz: number): Plants[][] {
    if (!this.species.length) return [];
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    const N = this.N, wl = this.waterLevel;
    return this.species.map((sp, si) => {
      const R = rng((cx * 73856093) ^ (cz * 19349663) ^ (si * 83492791) ^ this.terrain.seed);
      const out: Plants[] = [];
      const expect = sp.density * CHUNK * CHUNK * 1.6;
      let n = Math.floor(expect) + (R() < expect % 1 ? 1 : 0);
      while (n-- > 0) {
        const x = x0 + R() * CHUNK, z = z0 + R() * CHUNK;
        if (this.inDiorama(x, z, 1.5)) continue;
        // plants grow in patches: groves and clearings
        if (N.fbm(x * 0.025 + si * 3.1, z * 0.025 - si, 2) < -0.15 + (R() - 0.5) * 0.5) continue;
        const y = this.heightAt(x, z);
        if (wl !== null && y < wl + 0.15) continue;
        const e = 0.6;
        const slope = Math.hypot(this.heightAt(x + e, z) - this.heightAt(x - e, z), this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
        if (slope > 0.65) continue;
        const c = this.chunks.get(`${cx},${cz}`);
        const ground = c ? dominant(c.grid, x, z) : this.groundFor(x, z, y, slope, N);
        if (BARE.has(ground) && sp.def.category === 'plants') continue;
        out.push({ x, y: y - 0.04, z, rot: R() * Math.PI * 2, scale: 0.75 + R() * 0.5 });
      }
      return out;
    });
  }

  /** fill the instanced meshes with the plants nearest the walker */
  private layoutPlants(pos: THREE.Vector3) {
    this.instancesDirty = false;
    this.instancesAt = performance.now();
    this.lastPos.copy(pos);
    const chunks = [...this.chunks.values()].sort((a, b) => dist2(a, pos) - dist2(b, pos));
    this.species.forEach((sp, si) => {
      let n = 0;
      const r2 = sp.reach * sp.reach;
      for (const c of chunks) {
        if (n >= sp.cap) break;
        if (Math.sqrt(dist2(c, pos)) - CHUNK * 0.72 > sp.reach) break;
        for (const p of c.plants[si] ?? []) {
          if (n >= sp.cap) break;
          const dx = p.x - pos.x, dz = p.z - pos.z;
          if (dx * dx + dz * dz > r2) continue;
          tmpP.set(p.x, p.y, p.z);
          tmpQ.setFromAxisAngle(UP, p.rot);
          tmpS.setScalar(p.scale);
          tmpM.compose(tmpP, tmpQ, tmpS);
          for (const m of sp.meshes) m.setMatrixAt(n, tmpM);
          n++;
        }
      }
      for (const m of sp.meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; }
    });
  }

  /* ======================= animals ======================= */
  private prepareAnimals() {
    const e = this.e;
    const seen = new Map<string, AssetDef>();
    for (const a of e.actorList) {
      const d = a.def;
      if (a.isClone || d.category !== 'animals' || d.loco === 'sessile' || d.loco === 'scenery' || d.family === 'water' || d.family === 'aquarium') continue;
      if ((d.loco === 'swim' || d.water) && this.waterLevel === null) continue;
      seen.set(d.id, d);
    }
    let defs = [...seen.values()];
    if (defs.length < 2) {
      const pool = CATALOG.filter((d) => d.category === 'animals' && d.biomes.includes(this.biome) && (d.family === 'mammal' || d.family === 'bird') && d.loco !== 'swim');
      const R = rng(this.terrain.seed * 5 + 3);
      while (defs.length < 3 && pool.length) defs.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
    }
    this.animalDefs = defs;
    this.spawnTimer = 1;
  }

  private get roamTarget() { return this.animalDefs.length ? (this.e.quality === 'high' ? 12 : this.e.quality === 'medium' ? 8 : 5) : 0; }

  private worldQuery(home: THREE.Vector3): WorldQuery {
    return {
      groundAt: this.heightAt, waterAt: this.waterAt, time: this.e.time, night: this.e.skyState.night,
      bounds: { minX: home.x - 60, maxX: home.x + 60, minZ: home.z - 60, maxZ: home.z + 60 },
    };
  }

  private updateRoamers(dt: number, pos: THREE.Vector3) {
    for (const r of [...this.roamers]) {
      if (r.actor.root.position.distanceTo(pos) > 120) { this.dropRoamer(r); this.roamers.splice(this.roamers.indexOf(r), 1); continue; }
      r.actor.update(dt, this.e.time, this.worldQuery(r.home), true);
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && !this.spawning && this.roamers.length < this.roamTarget) {
      this.spawnTimer = 1.5;
      void this.spawnRoamer(pos.clone(), this.runId);
    }
  }

  private async spawnRoamer(near: THREE.Vector3, run: number) {
    const defs = this.animalDefs;
    if (!defs.length) return;
    this.spawning = true;
    try {
      const R = Math.random;
      const def = defs[Math.floor(R() * defs.length)];
      const swims = def.loco === 'swim' || !!def.water;
      let spot: THREE.Vector3 | null = null;
      for (let k = 0; k < 24 && !spot; k++) {
        const a = R() * Math.PI * 2, d = 22 + R() * 55;
        const x = near.x + Math.cos(a) * d, z = near.z + Math.sin(a) * d;
        if (this.inDiorama(x, z, 2)) continue;
        const wet = this.waterAt(x, z) !== null;
        if (wet !== swims) continue;
        spot = new THREE.Vector3(x, this.heightAt(x, z), z);
      }
      if (!spot) return;
      const model = await buildModel(def, {}, this.e.quality, this.e.env.trueScale);
      if (run !== this.runId || !this.active) return;
      const lift = def.loco === 'fly' ? 3 + R() * 5 : swims ? 1 : 0;
      const actor = new Actor({ id: uid('roam'), asset: def.id, name: def.name, params: {}, pos: [spot.x, spot.y, spot.z], rotY: R() * Math.PI * 2, scale: 1, lift, grounded: true }, def);
      actor.setModel(model);
      model.setNight?.(this.e.skyState.night);
      this.group.add(actor.root);
      actor.followGround(this.worldQuery(spot));
      actor.setHome();
      this.roamers.push({ actor, home: spot });
    } catch (err) {
      console.warn('endless: could not add an animal', err);
    } finally {
      this.spawning = false;
    }
  }

  private dropRoamer(r: Roamer) {
    r.actor.dispose();
    this.group.remove(r.actor.root);
    disposeObject(r.actor.root, false);
  }

  /** nights light up fireflies and glowing fungi out here too */
  setNight(v: number) { for (const r of this.roamers) r.actor.model?.setNight?.(v); }
}

function dist2(c: { cx: number; cz: number }, p: THREE.Vector3) {
  const x = (c.cx + 0.5) * CHUNK - p.x, z = (c.cz + 0.5) * CHUNK - p.z;
  return x * x + z * z;
}
const _types = [0, 0, 0, 0], _scores = [0, 0, 0, 0];
function dominant(g: PaintGrid, x: number, z: number) {
  const n = groundScores(g, x, z, _types, _scores);
  let best = 0;
  for (let k = 1; k < n; k++) if (_scores[k] > _scores[best]) best = k;
  return _types[best];
}
