import * as THREE from 'three';
import { Noise2D, clamp, smoothstep } from './util';
import { b64ToBytes, bytesToB64, type TerrainDoc } from './types';

export interface GroundType {
  id: string;
  name: string;
  emoji: string;
  color: string;
  color2: string;
  /** groundcover densities per m² */
  grass?: number;
  grassColor?: string;
  flowers?: number;
  pebbles?: number;
  litter?: number;
}

export const GROUND_TYPES: GroundType[] = [
  { id: 'grass', name: 'Grass', emoji: '🌱', color: '#5c8a3a', color2: '#77a347', grass: 4.2, grassColor: '#79aa45' },
  { id: 'meadow', name: 'Meadow', emoji: '🌼', color: '#6a9541', color2: '#8db45a', grass: 3.4, grassColor: '#88b850', flowers: 0.8 },
  { id: 'forest', name: 'Forest floor', emoji: '🍂', color: '#4d3d25', color2: '#6a5432', grass: 0.35, grassColor: '#5e7d36', litter: 3.5, pebbles: 0.1 },
  { id: 'dry', name: 'Dry grass', emoji: '🌾', color: '#a8914f', color2: '#c4ad68', grass: 3.0, grassColor: '#c8ae5e' },
  { id: 'jungle', name: 'Jungle floor', emoji: '🌿', color: '#3c5527', color2: '#536f34', grass: 1.4, grassColor: '#3f7a32', litter: 1.5 },
  { id: 'soil', name: 'Soil', emoji: '🟫', color: '#654a32', color2: '#7a5a3c', pebbles: 0.15 },
  { id: 'mud', name: 'Mud', emoji: '🪵', color: '#47382a', color2: '#56442f', pebbles: 0.05 },
  { id: 'sand', name: 'Sand', emoji: '🏖️', color: '#d8c08b', color2: '#e8d4a2', grass: 0.06, grassColor: '#a9a35c', pebbles: 0.05 },
  { id: 'redsand', name: 'Desert sand', emoji: '🏜️', color: '#c98a54', color2: '#dba46c', grass: 0.03, grassColor: '#a6935a' },
  { id: 'rock', name: 'Rock', emoji: '🪨', color: '#78756d', color2: '#918c82', pebbles: 0.9 },
  { id: 'gravel', name: 'Gravel', emoji: '⚪', color: '#8a8378', color2: '#a39a8b', pebbles: 3 },
  { id: 'moss', name: 'Tundra moss', emoji: '🍃', color: '#6b7a4c', color2: '#8a9361', grass: 1.2, grassColor: '#7f8b52', flowers: 0.12 },
  { id: 'snow', name: 'Snow', emoji: '❄️', color: '#e9eff4', color2: '#ffffff' },
  { id: 'ice', name: 'Ice', emoji: '🧊', color: '#b6d4e2', color2: '#d3e7f0' },
];
export const GROUND_INDEX: Record<string, number> = Object.fromEntries(GROUND_TYPES.map((g, i) => [g.id, i]));

export interface StrataStyle { id: string; name: string; soil: [string, string]; layers: string[]; bottom: string }
export const STRATA: Record<string, StrataStyle> = {
  loam: { id: 'loam', name: 'Loam & limestone', soil: ['#3a2a1b', '#5e4129'], layers: ['#806043', '#94744f', '#6f5d4a', '#a08f77', '#7d7468', '#8f8a7f'], bottom: '#3d342c' },
  desert: { id: 'desert', name: 'Sandstone', soil: ['#d8bb8a', '#c49a66'], layers: ['#c98a54', '#dba46a', '#b9764a', '#e3b47e', '#a8683f', '#cf9560'], bottom: '#7a4a2e' },
  polar: { id: 'polar', name: 'Snow & permafrost', soil: ['#f0f5f8', '#cfdce5'], layers: ['#8d9399', '#6f777e', '#9ca3a8', '#5f666c', '#7c848a'], bottom: '#3e4448' },
  peat: { id: 'peat', name: 'Peat & clay', soil: ['#2a2016', '#3b2e1e'], layers: ['#5f604f', '#757260', '#565345', '#6b6a5a', '#4d4b3f'], bottom: '#2c2a24' },
  laterite: { id: 'laterite', name: 'Red laterite', soil: ['#3a2a18', '#7a4325'], layers: ['#a55a31', '#b8784a', '#8c5233', '#c48a5a', '#7a4a32'], bottom: '#4a2c1e' },
  granite: { id: 'granite', name: 'Granite', soil: ['#3e3527', '#5f5545'], layers: ['#8b8a86', '#9c9890', '#7b7a76', '#a7a39b', '#6c6b68'], bottom: '#45443f' },
};

const tmpA = new THREE.Color(), tmpB = new THREE.Color(), tmpC = new THREE.Color();

export type SculptTool = 'raise' | 'lower' | 'smooth' | 'flatten' | 'roughen';

export class Terrain {
  width: number;
  depth: number;
  nx: number;
  nz: number;
  heights: Float32Array;
  paint: Uint8Array;
  waterLevel: number | null;
  strata: StrataStyle;
  seed: number;
  /** thickness of the base below the lowest point */
  baseDepth = 3.2;
  group = new THREE.Group();
  surface: THREE.Mesh;
  sides: THREE.Mesh;
  waterSides: THREE.Mesh;
  bottom: THREE.Mesh;
  /** R channel: water depth (0..1 over DEPTH_RANGE m) for the water shader */
  depthTexture: THREE.DataTexture;
  static DEPTH_RANGE = 4;
  snow = 0;
  version = 0;
  private noise: Noise2D;
  private groundColors: THREE.Color[][];
  private surfaceMat: THREE.MeshStandardMaterial;
  private snowUniform = { value: 0 };

  constructor(opts: { width: number; depth: number; nx: number; nz: number; heights?: Float32Array; paint?: Uint8Array; waterLevel?: number | null; strata?: string; seed?: number }) {
    this.width = opts.width;
    this.depth = opts.depth;
    this.nx = opts.nx;
    this.nz = opts.nz;
    this.heights = opts.heights ?? new Float32Array(this.nx * this.nz);
    this.paint = opts.paint ?? new Uint8Array(this.nx * this.nz);
    this.waterLevel = opts.waterLevel ?? null;
    this.strata = STRATA[opts.strata ?? 'loam'] ?? STRATA.loam;
    this.seed = opts.seed ?? 1;
    this.noise = new Noise2D(this.seed * 7 + 3);
    this.groundColors = GROUND_TYPES.map((g) => [new THREE.Color(g.color), new THREE.Color(g.color2)]);
    this.group.name = 'terrain';

    // --- surface ---
    const g = new THREE.BufferGeometry();
    const n = this.nx * this.nz;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx: number[] = [];
    for (let j = 0; j < this.nz - 1; j++) {
      for (let i = 0; i < this.nx - 1; i++) {
        const a = j * this.nx + i, b = a + 1, c = a + this.nx, d = c + 1;
        if ((i + j) & 1) idx.push(a, c, b, b, c, d);
        else idx.push(a, c, d, a, d, b);
      }
    }
    g.setIndex(idx);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) {
      const k = j * this.nx + i;
      pos.setXYZ(k, this.xOf(i), 0, this.zOf(j));
    }
    this.surfaceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
    const snowU = this.snowUniform;
    this.surfaceMat.onBeforeCompile = (sh) => {
      sh.uniforms.uSnow = snowU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUp;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvUp = objectNormal.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnow;\nvarying float vUp;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n{ float s = smoothstep(0.55, 0.85, vUp) * uSnow; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93,0.96,0.99), s); }');
    };
    this.surface = new THREE.Mesh(g, this.surfaceMat);
    this.surface.name = 'terrain-surface';
    this.surface.receiveShadow = true;
    this.surface.castShadow = true;
    this.group.add(this.surface);

    // --- strata sides ---
    this.sides = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
    this.sides.name = 'terrain-sides';
    this.sides.receiveShadow = true;
    this.group.add(this.sides);
    // water cross-section: light at the surface, deepening blue toward the bed (an aquarium-style cut-away)
    this.waterSides = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72, emissive: new THREE.Color('#0b3a52'), emissiveIntensity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    this.waterSides.name = 'terrain-water-sides';
    this.waterSides.renderOrder = 2;
    this.group.add(this.waterSides);
    this.bottom = new THREE.Mesh(new THREE.PlaneGeometry(this.width, this.depth).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: this.strata.bottom, roughness: 1 }));
    this.bottom.name = 'terrain-bottom';
    this.group.add(this.bottom);

    this.depthTexture = new THREE.DataTexture(new Uint8Array(n * 4), this.nx, this.nz, THREE.RGBAFormat);
    this.depthTexture.magFilter = THREE.LinearFilter;
    this.depthTexture.minFilter = THREE.LinearFilter;
    this.depthTexture.needsUpdate = true;
    this.rebuild();
  }

  /* ---------- coordinates ---------- */
  get dx() { return this.width / (this.nx - 1); }
  get dz() { return this.depth / (this.nz - 1); }
  xOf(i: number) { return -this.width / 2 + i * this.dx; }
  zOf(j: number) { return -this.depth / 2 + j * this.dz; }
  inBounds(x: number, z: number, margin = 0) {
    return x >= -this.width / 2 + margin && x <= this.width / 2 - margin && z >= -this.depth / 2 + margin && z <= this.depth / 2 - margin;
  }
  h(i: number, j: number) {
    i = i < 0 ? 0 : i >= this.nx ? this.nx - 1 : i;
    j = j < 0 ? 0 : j >= this.nz ? this.nz - 1 : j;
    return this.heights[j * this.nx + i];
  }
  heightAt(x: number, z: number) {
    const fx = clamp((x + this.width / 2) / this.dx, 0, this.nx - 1.0001);
    const fz = clamp((z + this.depth / 2) / this.dz, 0, this.nz - 1.0001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = this.h(i, j), b = this.h(i + 1, j), c = this.h(i, j + 1), d = this.h(i + 1, j + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  normalAt(x: number, z: number, out = new THREE.Vector3()) {
    const e = this.dx;
    return out.set(this.heightAt(x - e, z) - this.heightAt(x + e, z), 2 * e, this.heightAt(x, z - e) - this.heightAt(x, z + e)).normalize();
  }
  slopeAt(x: number, z: number) { const n = this.normalAt(x, z); return Math.sqrt(1 - n.y * n.y) / Math.max(n.y, 0.05); }
  groundAt(x: number, z: number): GroundType {
    const i = Math.round(clamp((x + this.width / 2) / this.dx, 0, this.nx - 1));
    const j = Math.round(clamp((z + this.depth / 2) / this.dz, 0, this.nz - 1));
    return GROUND_TYPES[this.paint[j * this.nx + i]] ?? GROUND_TYPES[0];
  }
  isUnderwater(x: number, z: number, margin = 0) {
    return this.waterLevel !== null && this.heightAt(x, z) < this.waterLevel - margin;
  }
  minHeight() { let m = Infinity; for (const v of this.heights) if (v < m) m = v; return m; }
  maxHeight() { let m = -Infinity; for (const v of this.heights) if (v > m) m = v; return m; }
  get bottomY() { return Math.min(this.minHeight(), this.waterLevel ?? 0) - this.baseDepth; }

  setSnow(v: number) { this.snow = v; this.snowUniform.value = v; }

  /* ---------- rebuild ---------- */
  rebuild() {
    this.updateSurface();
    this.updateSides();
    this.updateDepthTexture();
    this.version++;
  }

  private updateSurface() {
    const g = this.surface.geometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute;
    const col = g.attributes.color as THREE.BufferAttribute;
    const { nx, nz, dx, dz } = this;
    const wl = this.waterLevel;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const y = this.heights[k];
        pos.setY(k, y);
        const hx = this.h(i - 1, j) - this.h(i + 1, j);
        const hz = this.h(i, j - 1) - this.h(i, j + 1);
        const nl = Math.hypot(hx, 2 * dx, hz * (dx / dz));
        nor.setXYZ(k, hx / nl, (2 * dx) / nl, (hz * (dx / dz)) / nl);
        // blended ground colour (3x3 neighbourhood) for soft transitions
        let r = 0, gg = 0, b = 0, wsum = 0;
        for (let oj = -1; oj <= 1; oj++) for (let oi = -1; oi <= 1; oi++) {
          const ii = i + oi, jj = j + oj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
          const kk = jj * nx + ii;
          const w = oi === 0 && oj === 0 ? 2 : 1;
          const pair = this.groundColors[this.paint[kk]] ?? this.groundColors[0];
          const x = this.xOf(ii), z = this.zOf(jj);
          const t = 0.5 + 0.5 * this.noise.fbm(x * 0.35, z * 0.35, 3);
          tmpA.copy(pair[0]).lerp(pair[1], t);
          r += tmpA.r * w; gg += tmpA.g * w; b += tmpA.b * w; wsum += w;
        }
        tmpC.setRGB(r / wsum, gg / wsum, b / wsum);
        // fine speckle + slope darkening
        const x = this.xOf(i), z = this.zOf(j);
        const speck = this.noise.noise(x * 2.7, z * 2.7) * 0.05;
        const ny = (2 * dx) / nl;
        const steep = smoothstep(0.92, 0.6, ny);
        tmpC.offsetHSL(0, 0, speck - steep * 0.08);
        if (steep > 0) tmpC.lerp(tmpB.set('#7d7466'), steep * 0.55);
        if (wl !== null && y < wl) {
          const d = clamp((wl - y) / 2.5, 0, 1);
          tmpC.lerp(tmpB.set('#3d5a52'), 0.25 + d * 0.45);
        } else if (wl !== null && y < wl + 0.25) {
          tmpC.multiplyScalar(0.78); // wet bank
        }
        col.setXYZ(k, tmpC.r, tmpC.g, tmpC.b);
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    col.needsUpdate = true;
    g.computeBoundingSphere();
    g.computeBoundingBox();
  }

  private strataColor(depthBelowSurface: number, y: number, s: number, out: THREE.Color) {
    const st = this.strata;
    const wob = this.noise.noise(s * 0.45, y * 0.3) * 0.18;
    if (depthBelowSurface < 0.22 + wob * 0.4) return out.set(st.soil[0]);
    if (depthBelowSurface < 0.95 + wob) {
      out.set(st.soil[0]).lerp(tmpB.set(st.soil[1]), smoothstep(0.2, 0.95, depthBelowSurface));
      return out;
    }
    // horizontal sedimentary layers below the soil
    const band = (y + 40 + wob * 1.5 + this.noise.noise(s * 0.08, 3.1) * 0.6) / 0.85;
    const li = Math.floor(band);
    const L = st.layers;
    out.set(L[((li % L.length) + L.length) % L.length]);
    const f = band - li;
    if (f < 0.12) out.lerp(tmpB.set(L[(((li - 1) % L.length) + L.length) % L.length]), (0.12 - f) * 3);
    // pebbles / fossils speckle
    const p = this.noise.noise(s * 3.3, y * 3.3);
    if (p > 0.72) out.multiplyScalar(0.82);
    return out;
  }

  private updateSides() {
    const { nx, nz } = this;
    const bottom = this.bottomY;
    const ROWS = 22;
    const pos: number[] = [], col: number[] = [], nor: number[] = [], idx: number[] = [];
    const wpos: number[] = [], widx: number[] = [], wcol: number[] = [];
    const surfaceCol = new THREE.Color('#6cc4d6'), deepCol = new THREE.Color('#164c6e'), wc = new THREE.Color();
    const wl = this.waterLevel;
    const c = new THREE.Color();
    const edges: { pts: [number, number][]; n: [number, number, number] }[] = [];
    const front: [number, number][] = [], back: [number, number][] = [], left: [number, number][] = [], right: [number, number][] = [];
    for (let i = 0; i < nx; i++) { front.push([i, nz - 1]); back.push([nx - 1 - i, 0]); }
    for (let j = 0; j < nz; j++) { left.push([0, j]); right.push([nx - 1, nz - 1 - j]); }
    edges.push({ pts: front, n: [0, 0, 1] }, { pts: back, n: [0, 0, -1] }, { pts: left, n: [-1, 0, 0] }, { pts: right, n: [1, 0, 0] });
    for (const e of edges) {
      const base = pos.length / 3;
      e.pts.forEach(([i, j], si) => {
        const top = this.h(i, j);
        const x = this.xOf(i), z = this.zOf(j);
        const s = e.n[0] !== 0 ? z * 1.3 + x : x + z * 0.7;
        for (let r = 0; r <= ROWS; r++) {
          const f = r / ROWS;
          const tt = f * f; // denser rows near the surface
          const y = top + (bottom - top) * tt;
          pos.push(x, y, z);
          nor.push(e.n[0], e.n[1], e.n[2]);
          this.strataColor(top - y, y, s, c);
          col.push(c.r, c.g, c.b);
        }
        if (si > 0) {
          const a0 = base + (si - 1) * (ROWS + 1), b0 = base + si * (ROWS + 1);
          for (let r = 0; r < ROWS; r++) idx.push(a0 + r, a0 + r + 1, b0 + r, b0 + r, a0 + r + 1, b0 + r + 1);
        }
        // water cross-section above the bed
        if (wl !== null) {
          const wb = wpos.length / 3;
          const off = 0.004;
          const bed = Math.min(top, wl);
          wpos.push(x + e.n[0] * off, bed, z + e.n[2] * off, x + e.n[0] * off, wl, z + e.n[2] * off);
          wc.copy(surfaceCol).lerp(deepCol, Math.min(1, (wl - bed) / 3));
          wcol.push(wc.r, wc.g, wc.b, surfaceCol.r, surfaceCol.g, surfaceCol.b);
          if (si > 0) { const a = wb - 2; widx.push(a, a + 1, wb, wb, a + 1, wb + 1); }
        }
      });
    }
    const g = this.sides.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const wg = this.waterSides.geometry;
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
    wg.setAttribute('color', new THREE.Float32BufferAttribute(wcol, 3));
    wg.setIndex(widx);
    wg.computeVertexNormals();
    wg.computeBoundingSphere();
    this.waterSides.visible = wl !== null && wpos.length > 0;
    this.bottom.position.y = bottom;
  }

  updateDepthTexture() {
    const data = this.depthTexture.image.data as Uint8Array;
    const wl = this.waterLevel ?? -1e9;
    for (let k = 0; k < this.heights.length; k++) {
      const d = clamp((wl - this.heights[k]) / Terrain.DEPTH_RANGE, 0, 1);
      data[k * 4] = Math.round(d * 255);
      data[k * 4 + 1] = 0; data[k * 4 + 2] = 0; data[k * 4 + 3] = 255;
    }
    this.depthTexture.needsUpdate = true;
  }

  setWaterLevel(v: number | null) {
    this.waterLevel = v;
    this.rebuild();
  }

  /* ---------- editing ---------- */
  sculpt(tool: SculptTool, x: number, z: number, radius: number, strength: number, flattenTo?: number) {
    const { nx, nz } = this;
    const i0 = Math.max(0, Math.floor((x - radius + this.width / 2) / this.dx));
    const i1 = Math.min(nx - 1, Math.ceil((x + radius + this.width / 2) / this.dx));
    const j0 = Math.max(0, Math.floor((z - radius + this.depth / 2) / this.dz));
    const j1 = Math.min(nz - 1, Math.ceil((z + radius + this.depth / 2) / this.dz));
    const src = tool === 'smooth' ? this.heights.slice() : this.heights;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(this.xOf(i) - x, this.zOf(j) - z);
      if (d > radius) continue;
      const f = smoothstep(radius, radius * 0.15, d);
      const k = j * nx + i;
      let v = this.heights[k];
      switch (tool) {
        case 'raise': v += strength * f; break;
        case 'lower': v -= strength * f; break;
        case 'flatten': v += ((flattenTo ?? v) - v) * Math.min(1, strength * 4 * f); break;
        case 'roughen': v += this.noise.noise(this.xOf(i) * 1.7 + v, this.zOf(j) * 1.7) * strength * f * 1.5; break;
        case 'smooth': {
          let s = 0, c = 0;
          for (let oj = -1; oj <= 1; oj++) for (let oi = -1; oi <= 1; oi++) {
            const ii = i + oi, jj = j + oj;
            if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
            s += src[jj * nx + ii]; c++;
          }
          v += (s / c - v) * Math.min(1, strength * 6 * f);
          break;
        }
      }
      this.heights[k] = clamp(v, -8, 14);
    }
  }

  paintAt(typeIndex: number, x: number, z: number, radius: number) {
    const { nx, nz } = this;
    const i0 = Math.max(0, Math.floor((x - radius + this.width / 2) / this.dx));
    const i1 = Math.min(nx - 1, Math.ceil((x + radius + this.width / 2) / this.dx));
    const j0 = Math.max(0, Math.floor((z - radius + this.depth / 2) / this.dz));
    const j1 = Math.min(nz - 1, Math.ceil((z + radius + this.depth / 2) / this.dz));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot(this.xOf(i) - x, this.zOf(j) - z);
      if (d > radius) continue;
      // ragged, organic rim
      const edge = d / radius;
      if (edge > 0.7 && this.noise.noise(this.xOf(i) * 2.1, this.zOf(j) * 2.1) * 0.5 + 0.5 < (edge - 0.7) * 3.3) continue;
      this.paint[j * nx + i] = typeIndex;
    }
  }

  /* ---------- persistence ---------- */
  toDoc(): TerrainDoc {
    const q = new Int16Array(this.heights.length);
    for (let k = 0; k < q.length; k++) q[k] = Math.round(clamp(this.heights[k] * 100, -32760, 32760));
    return {
      width: this.width, depth: this.depth, nx: this.nx, nz: this.nz,
      heights: bytesToB64(new Uint8Array(q.buffer)),
      paint: bytesToB64(this.paint),
      waterLevel: this.waterLevel, strata: this.strata.id, seed: this.seed,
    };
  }

  static fromDoc(d: TerrainDoc) {
    const hb = b64ToBytes(d.heights);
    const q = new Int16Array(hb.buffer, hb.byteOffset, Math.floor(hb.byteLength / 2));
    const heights = new Float32Array(d.nx * d.nz);
    for (let k = 0; k < heights.length && k < q.length; k++) heights[k] = q[k] / 100;
    const paint = b64ToBytes(d.paint);
    return new Terrain({ width: d.width, depth: d.depth, nx: d.nx, nz: d.nz, heights, paint: paint.length === d.nx * d.nz ? paint : undefined, waterLevel: d.waterLevel, strata: d.strata, seed: d.seed });
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    });
    this.depthTexture.dispose();
  }
}
