/**
 * TerrainField — a square heightfield in real-world metres with sculpting
 * brushes and hydraulic / thermal erosion. Pure data + math (no three.js),
 * so it can also run inside exporters and workers.
 *
 * Heights are stored in metres in a Float32Array of n*n samples, vertex
 * (i, j) maps to world (x = -half + i*step, z = -half + j*step).
 */

import { SimplexNoise, clamp, lerp, smoothstep } from './noise';
import { PALETTE_BY_ID, Palette, sampleStops } from './presets';

export type BrushMode =
  | 'raise'
  | 'lower'
  | 'smooth'
  | 'flatten'
  | 'noise'
  | 'sharpen'
  | 'erode'
  | 'plateau';

export interface BrushSettings {
  mode: BrushMode;
  radius: number; // metres
  strength: number; // 0..1
  falloff: number; // 0..1 (0 = hard edge, 1 = very soft)
  /** height the flatten brush pulls towards */
  target?: number;
  /** invert raise/lower (shift key) */
  invert?: boolean;
}

export interface ErosionParams {
  iterations: number;
  inertia: number;
  capacity: number;
  minSlope: number;
  deposition: number;
  dissolution: number;
  evaporation: number;
  erosionRadius: number;
}

export const DEFAULT_EROSION: ErosionParams = {
  iterations: 18000,
  inertia: 0.35,
  capacity: 3.2,
  minSlope: 0.012,
  deposition: 0.22,
  dissolution: 0.28,
  evaporation: 0.012,
  erosionRadius: 3,
};

export class TerrainField {
  n: number;
  size: number; // metres
  step: number;
  heights: Float32Array;
  colors: Float32Array;
  normals: Float32Array;
  slopes: Float32Array; // 0..1 cache
  amplitude: number;
  waterLevel: number;
  /** when false, submerged vertices use the land gradient instead of the water palette */
  waterTint = true;
  paletteId: string;
  colorJitter: number;
  detail: number;
  /** optional world-sourced vertex-colour function (keeps biome blending after sculpting) */
  colorFn?: (x: number, z: number, h: number, slope: number, out: Float32Array) => void;
  minH = 0;
  maxH = 1;
  private noise: SimplexNoise;
  private dirty = { i0: 0, i1: -1, j0: 0, j1: -1 };

  constructor(n: number, size: number, amplitude: number, waterLevel = 0, paletteId = 'temperate', seed = 1337) {
    this.n = n;
    this.size = size;
    this.step = size / (n - 1);
    this.heights = new Float32Array(n * n);
    this.colors = new Float32Array(n * n * 3);
    this.normals = new Float32Array(n * n * 3);
    this.slopes = new Float32Array(n * n);
    this.amplitude = amplitude;
    this.waterLevel = waterLevel;
    this.paletteId = paletteId;
    this.colorJitter = 0.5;
    this.detail = 1;
    this.noise = new SimplexNoise(seed);
  }

  get palette(): Palette {
    return PALETTE_BY_ID[this.paletteId] ?? PALETTE_BY_ID.temperate;
  }

  get vertexCount() {
    return this.n * this.n;
  }

  get triangleCount() {
    return (this.n - 1) * (this.n - 1) * 2;
  }

  /* ---------------------------- dirty rect ---------------------------- */

  markDirty(i0: number, i1: number, j0: number, j1: number) {
    if (this.dirty.i1 < this.dirty.i0) {
      this.dirty = { i0, i1, j0, j1 };
    } else {
      this.dirty.i0 = Math.min(this.dirty.i0, i0);
      this.dirty.i1 = Math.max(this.dirty.i1, i1);
      this.dirty.j0 = Math.min(this.dirty.j0, j0);
      this.dirty.j1 = Math.max(this.dirty.j1, j1);
    }
  }

  markAllDirty() {
    this.markDirty(0, this.n - 1, 0, this.n - 1);
  }

  takeDirty(): { i0: number; i1: number; j0: number; j1: number } | null {
    if (this.dirty.i1 < this.dirty.i0) return null;
    const d = { ...this.dirty };
    this.dirty = { i0: 0, i1: -1, j0: 0, j1: -1 };
    return d;
  }

  /* ---------------------------- coordinate helpers -------------------- */

  worldX(i: number) {
    return -this.size / 2 + i * this.step;
  }

  worldZ(j: number) {
    return -this.size / 2 + j * this.step;
  }

  gridX(x: number) {
    return (x + this.size / 2) / this.step;
  }

  gridZ(z: number) {
    return (z + this.size / 2) / this.step;
  }

  at(i: number, j: number) {
    const n = this.n;
    const ci = clamp(i, 0, n - 1) | 0;
    const cj = clamp(j, 0, n - 1) | 0;
    return this.heights[cj * n + ci];
  }

  /** bilinear height sample in world space */
  heightAt(x: number, z: number) {
    const gx = clamp(this.gridX(x), 0, this.n - 1);
    const gz = clamp(this.gridZ(z), 0, this.n - 1);
    const i0 = Math.floor(gx);
    const j0 = Math.floor(gz);
    const i1 = Math.min(i0 + 1, this.n - 1);
    const j1 = Math.min(j0 + 1, this.n - 1);
    const fx = gx - i0;
    const fz = gz - j0;
    const h00 = this.at(i0, j0);
    const h10 = this.at(i1, j0);
    const h01 = this.at(i0, j1);
    const h11 = this.at(i1, j1);
    return lerp(lerp(h00, h10, fx), lerp(h01, h11, fx), fz);
  }

  /* ---------------------------- brushes ------------------------------- */

  applyBrush(wx: number, wz: number, s: BrushSettings, dtScale = 1) {
    const n = this.n;
    const gx = this.gridX(wx);
    const gz = this.gridZ(wz);
    const gr = Math.max(0.75, s.radius / this.step);
    const i0 = Math.max(0, Math.floor(gx - gr));
    const i1 = Math.min(n - 1, Math.ceil(gx + gr));
    const j0 = Math.max(0, Math.floor(gz - gr));
    const j1 = Math.min(n - 1, Math.ceil(gz + gr));
    if (i1 < i0 || j1 < j0) return;

    const amp = this.amplitude;
    const strength = s.strength * dtScale * (s.invert ? -1 : 1);
    const soft = lerp(0.35, 3.2, clamp(s.falloff, 0, 1));
    const mode = s.mode;
    const h = this.heights;

    // scratch buffers for neighbourhood ops
    let blurred: Float32Array | null = null;
    if (mode === 'smooth' || mode === 'sharpen') {
      blurred = new Float32Array((i1 - i0 + 1) * (j1 - j0 + 1));
    }
    if (blurred) {
      const w = i1 - i0 + 1;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i0 + w - 1; i++) {
          const avg =
            (this.at(i - 1, j) + this.at(i + 1, j) + this.at(i, j - 1) + this.at(i, j + 1)) * 0.2 +
            (this.at(i - 1, j - 1) + this.at(i + 1, j - 1) + this.at(i - 1, j + 1) + this.at(i + 1, j + 1)) * 0.05;
          blurred[(j - j0) * w + (i - i0)] = avg;
        }
      }
    }

    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const di = (i - gx) / gr;
        const dj = (j - gz) / gr;
        const d = Math.sqrt(di * di + dj * dj);
        if (d > 1) continue;
        const t = 1 - d;
        const w = Math.pow(t, soft);
        const k = j * n + i;
        const cur = h[k];

        switch (mode) {
          case 'raise':
          case 'lower': {
            const dir = mode === 'lower' ? -1 : 1;
            h[k] = cur + dir * strength * amp * 0.06 * w;
            break;
          }
          case 'smooth': {
            const avg = blurred![(j - j0) * (i1 - i0 + 1) + (i - i0)];
            h[k] = lerp(cur, avg, clamp(strength * w * 0.9, 0, 1));
            break;
          }
          case 'sharpen': {
            const avg = blurred![(j - j0) * (i1 - i0 + 1) + (i - i0)];
            h[k] = cur + (cur - avg) * strength * w * 1.6;
            break;
          }
          case 'flatten': {
            const target = s.target ?? cur;
            h[k] = lerp(cur, target, clamp(strength * w * 0.75, 0, 1));
            break;
          }
          case 'noise': {
            const f = 1.6 * this.detail;
            const v =
              this.noise.noise(i * this.step * 0.16 * f, j * this.step * 0.16 * f) * 0.6 +
              this.noise.noise(i * this.step * 0.45 * f + 40, j * this.step * 0.45 * f - 12) * 0.3;
            h[k] = cur + v * strength * amp * 0.05 * w;
            break;
          }
          case 'erode': {
            // local thermal creep: push material from steep faces downslope
            let lowest = cur;
            let li = i;
            let lj = j;
            for (let o = 0; o < 4; o++) {
              const oi = i + (o === 0 ? -1 : o === 1 ? 1 : 0);
              const oj = j + (o === 2 ? -1 : o === 3 ? 1 : 0);
              const hv = this.at(oi, oj);
              if (hv < lowest) {
                lowest = hv;
                li = oi;
                lj = oj;
              }
            }
            if (lowest < cur) {
              const diff = Math.min((cur - lowest) * 0.5, strength * amp * 0.05 * w);
              h[k] = cur - diff;
              h[lj * n + li] = lowest + diff * 0.85;
            }
            break;
          }
          case 'plateau': {
            const stepSize = Math.max(0.6, amp * 0.055);
            const terr = Math.round(cur / stepSize) * stepSize;
            h[k] = lerp(cur, terr, clamp(strength * w, 0, 1));
            break;
          }
        }
      }
    }

    this.markDirty(i0, i1, j0, j1);
    if (mode === 'erode') this.markDirty(i0 - 1, i1 + 1, j0 - 1, j1 + 1);
  }

  /** Stamp several brush dabs along a segment so fast strokes stay continuous. */
  stroke(x0: number, z0: number, x1: number, z1: number, s: BrushSettings) {
    const dist = Math.hypot(x1 - x0, z1 - z0);
    const spacing = Math.max(this.step * 0.6, s.radius * 0.22);
    const steps = Math.max(1, Math.ceil(dist / spacing));
    const scale = 1 / Math.max(1, steps * 0.55);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.applyBrush(lerp(x0, x1, t), lerp(z0, z1, t), s, scale);
    }
  }

  /* ---------------------------- global processes ---------------------- */

  recomputeRange() {
    let mn = Infinity;
    let mx = -Infinity;
    const h = this.heights;
    for (let i = 0; i < h.length; i++) {
      if (h[i] < mn) mn = h[i];
      if (h[i] > mx) mx = h[i];
    }
    this.minH = mn;
    this.maxH = mx;
  }

  normalize(targetLow = -this.amplitude * 0.35, targetHigh = this.amplitude * 0.9) {
    this.recomputeRange();
    const span = this.maxH - this.minH || 1;
    const h = this.heights;
    const s = (targetHigh - targetLow) / span;
    for (let i = 0; i < h.length; i++) h[i] = (h[i] - this.minH) * s + targetLow;
    this.recomputeRange();
    this.markAllDirty();
  }

  clampToAmplitude() {
    const lo = -this.amplitude * 0.6;
    const hi = this.amplitude * 1.35;
    const h = this.heights;
    for (let i = 0; i < h.length; i++) h[i] = clamp(h[i], lo, hi);
    this.markAllDirty();
  }

  smoothAll(passes = 1, amount = 0.5) {
    const n = this.n;
    const h = this.heights;
    for (let p = 0; p < passes; p++) {
      const copy = h.slice();
      const g = (i: number, j: number) => copy[clamp(j, 0, n - 1) * n + clamp(i, 0, n - 1)];
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const k = j * n + i;
          const avg =
            (g(i - 1, j) + g(i + 1, j) + g(i, j - 1) + g(i, j + 1)) * 0.2 +
            (g(i - 1, j - 1) + g(i + 1, j - 1) + g(i - 1, j + 1) + g(i + 1, j + 1)) * 0.05;
          h[k] = lerp(copy[k], avg, amount);
        }
      }
    }
    this.markAllDirty();
  }

  terraceAll(steps = 8, blend = 0.6) {
    const h = this.heights;
    this.recomputeRange();
    const span = (this.maxH - this.minH) || 1;
    for (let i = 0; i < h.length; i++) {
      const t = (h[i] - this.minH) / span;
      const stepped = Math.round(t * steps) / steps;
      h[i] = lerp(t, stepped, blend) * span + this.minH;
    }
    this.markAllDirty();
  }

  invert() {
    const h = this.heights;
    this.recomputeRange();
    const mid = (this.minH + this.maxH) * 0.5;
    for (let i = 0; i < h.length; i++) h[i] = mid - (h[i] - mid);
    this.recomputeRange();
    this.markAllDirty();
  }

  /** Thermal / talus relaxation — collapses slopes steeper than the talus angle. */
  thermalErosion(iterations = 6, talus = 0.55, amount = 0.35) {
    const n = this.n;
    const h = this.heights;
    const maxDrop = talus * this.step;
    for (let it = 0; it < iterations; it++) {
      for (let j = 1; j < n - 1; j++) {
        for (let i = 1; i < n - 1; i++) {
          const k = j * n + i;
          const hc = h[k];
          let total = 0;
          let moved = 0;
          for (let o = 0; o < 4; o++) {
            const ok = o === 0 ? k - 1 : o === 1 ? k + 1 : o === 2 ? k - n : k + n;
            const diff = hc - h[ok];
            if (diff > maxDrop) {
              const move = (diff - maxDrop) * 0.25 * amount;
              h[ok] += move;
              moved += move;
              total++;
            }
          }
          if (total) h[k] -= moved / total;
        }
      }
    }
    this.markAllDirty();
  }

  /** Particle based hydraulic erosion (droplets carrying sediment downhill). */
  hydraulicErosion(params: Partial<ErosionParams> = {}, onProgress?: (t: number) => void) {
    const p: ErosionParams = { ...DEFAULT_EROSION, ...params };
    const n = this.n;
    const h = this.heights;
    const step = this.step;
    const its = Math.max(0, Math.floor(p.iterations));
    const chunk = Math.max(1, Math.floor(its / 60));

    for (let it = 0; it < its; it++) {
      // random droplet inside the map
      let px = 1 + Math.random() * (n - 3);
      let pz = 1 + Math.random() * (n - 3);
      let dx = 0;
      let dz = 0;
      let water = 1;
      let sediment = 0;
      let speed = 1;

      for (let life = 0; life < 48; life++) {
        const gi = px | 0;
        const gj = pz | 0;
        const fi = px - gi;
        const fj = pz - gj;
        const k = gj * n + gi;

        // bilinear height + gradient
        const h00 = h[k];
        const h10 = h[k + 1];
        const h01 = h[k + n];
        const h11 = h[k + n + 1];
        const gx = (h10 - h00) * (1 - fj) + (h11 - h01) * fj;
        const gz = (h01 - h00) * (1 - fi) + (h11 - h10) * fi;
        const height = h00 * (1 - fi) * (1 - fj) + h10 * fi * (1 - fj) + h01 * (1 - fi) * fj + h11 * fi * fj;

        dx = dx * p.inertia - gx * (1 - p.inertia);
        dz = dz * p.inertia - gz * (1 - p.inertia);
        const len = Math.hypot(dx, dz);
        if (len < 1e-5) break;
        dx /= len;
        dz /= len;
        px += dx;
        pz += dz;
        if (px < 1 || px > n - 2 || pz < 1 || pz > n - 2) break;

        const newHeight = this.bilinear(px, pz);
        const dh = newHeight - height;
        const slope = Math.max(p.minSlope, -dh / step);
        const capacity = Math.max(0, slope * speed * water * p.capacity * step * 0.35);

        if (sediment > capacity || dh > 0) {
          const drop = dh > 0 ? Math.min(dh, sediment) : (sediment - capacity) * p.deposition;
          sediment -= drop;
          this.deposit(px, pz, drop, p.erosionRadius);
        } else {
          const want = Math.min((capacity - sediment) * p.dissolution, Math.max(0, -dh) * 0.9);
          if (want > 0) {
            this.dissolve(px, pz, want, p.erosionRadius);
            sediment += want;
          }
        }
        speed = Math.sqrt(Math.max(0, speed * speed - dh * 4.0));
        water *= 1 - p.evaporation;
        if (water < 0.01) break;
      }
      if (onProgress && chunk > 0 && it % chunk === 0) onProgress(it / its);
    }
    if (onProgress) onProgress(1);
    this.markAllDirty();
  }

  private bilinear(px: number, pz: number) {
    const n = this.n;
    const gi = clamp(px | 0, 0, n - 2);
    const gj = clamp(pz | 0, 0, n - 2);
    const fi = clamp(px - gi, 0, 1);
    const fj = clamp(pz - gj, 0, 1);
    const k = gj * n + gi;
    const h = this.heights;
    return (
      h[k] * (1 - fi) * (1 - fj) + h[k + 1] * fi * (1 - fj) + h[k + n] * (1 - fi) * fj + h[k + n + 1] * fi * fj
    );
  }

  private weightCache = new Map<number, number[]>();
  private erosionBrush(radius: number) {
    const r = Math.max(1, Math.round(radius));
    const cached = this.weightCache.get(r);
    if (cached) return cached;
    const size = r * 2 + 1;
    const w = new Array<number>(size * size).fill(0);
    let sum = 0;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = Math.hypot(x, y) / (r + 0.5);
        if (d > 1) continue;
        const v = 1 - d;
        w[(y + r) * size + (x + r)] = v;
        sum += v;
      }
    }
    for (let i = 0; i < w.length; i++) w[i] /= sum || 1;
    this.weightCache.set(r, w);
    return w;
  }

  private deposit(px: number, pz: number, amount: number, radius: number) {
    const w = this.erosionBrush(radius);
    const r = Math.round(radius);
    const n = this.n;
    const gi = px | 0;
    const gj = pz | 0;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const wv = w[(y + r) * (r * 2 + 1) + (x + r)];
        if (wv <= 0) continue;
        const i = clamp(gi + x, 0, n - 1);
        const j = clamp(gj + y, 0, n - 1);
        this.heights[j * n + i] += amount * wv;
      }
    }
  }

  private dissolve(px: number, pz: number, amount: number, radius: number) {
    const w = this.erosionBrush(radius);
    const r = Math.round(radius);
    const n = this.n;
    const gi = px | 0;
    const gj = pz | 0;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const wv = w[(y + r) * (r * 2 + 1) + (x + r)];
        if (wv <= 0) continue;
        const i = clamp(gi + x, 0, n - 1);
        const j = clamp(gj + y, 0, n - 1);
        const k = j * n + i;
        this.heights[k] -= Math.min(amount * wv, Math.max(0.0001, this.heights[k] + this.amplitude));
      }
    }
  }

  /* ---------------------------- shading data -------------------------- */

  /** Recompute normals + slopes + vertex colours for a rect (defaults to all). */
  recomputeShading(rect?: { i0: number; i1: number; j0: number; j1: number }) {
    const n = this.n;
    const i0 = Math.max(0, rect?.i0 ?? 0);
    const i1 = Math.min(n - 1, rect?.i1 ?? n - 1);
    const j0 = Math.max(0, rect?.j0 ?? 0);
    const j1 = Math.min(n - 1, rect?.j1 ?? n - 1);
    if (i1 < i0 || j1 < j0) return;
    const nrm = this.normals;
    const slp = this.slopes;
    const inv2s = 1 / (2 * this.step);

    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * n + i;
        const dhdx = (this.at(i + 1, j) - this.at(i - 1, j)) * inv2s;
        const dhdz = (this.at(i, j + 1) - this.at(i, j - 1)) * inv2s;
        let nx = -dhdx;
        let ny = 1;
        let nz = -dhdz;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;
        nrm[k * 3] = nx;
        nrm[k * 3 + 1] = ny;
        nrm[k * 3 + 2] = nz;
        slp[k] = clamp(1 - ny, 0, 1);
      }
    }
    this.writeColors(i0, i1, j0, j1);
  }

  private writeColors(i0: number, i1: number, j0: number, j1: number) {
    const n = this.n;
    const pal = this.palette;
    const col = this.colors;
    const h = this.heights;
    const slp = this.slopes;

    if (this.colorFn) {
      const out = new Float32Array(3);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = j * n + i;
          this.colorFn(this.worldX(i), this.worldZ(j), h[k], slp[k], out);
          col[k * 3] = out[0];
          col[k * 3 + 1] = out[1];
          col[k * 3 + 2] = out[2];
        }
      }
      return;
    }
    const sea = this.waterTint ? this.waterLevel : this.minH - 1e-3;
    const rgb = new Float32Array(3);
    const rgb2 = new Float32Array(3);
    const deep = hexToTriplet(pal.deep);
    const shallow = hexToTriplet(pal.shallow);
    const rock = hexToTriplet(pal.rock);
    const snow = hexToTriplet(pal.snow);
    const spanUp = Math.max(0.5, this.maxH - sea);
    const spanDown = Math.max(0.5, sea - this.minH);
    const jitter = this.colorJitter;

    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * n + i;
        const hgt = h[k];
        const slope = slp[k];
        if (hgt < sea) {
          const t = clamp((hgt - this.minH) / spanDown, 0, 1);
          rgb[0] = lerp(deep[0], shallow[0], Math.pow(t, 0.7));
          rgb[1] = lerp(deep[1], shallow[1], Math.pow(t, 0.7));
          rgb[2] = lerp(deep[2], shallow[2], Math.pow(t, 0.7));
        } else {
          const t = clamp((hgt - sea) / spanUp, 0, 1);
          sampleStops(pal.stops, t, rgb);
          // rock on steep faces
          const rockMix = smoothstep(pal.rockSlope * 0.55, pal.rockSlope * 1.05, slope);
          rgb[0] = lerp(rgb[0], rock[0], rockMix);
          rgb[1] = lerp(rgb[1], rock[1], rockMix);
          rgb[2] = lerp(rgb[2], rock[2], rockMix);
          // snow cap
          const snowMix = smoothstep(pal.snowLine, pal.snowLine + 0.14, t) * (1 - rockMix * 0.65);
          rgb[0] = lerp(rgb[0], snow[0], snowMix);
          rgb[1] = lerp(rgb[1], snow[1], snowMix);
          rgb[2] = lerp(rgb[2], snow[2], snowMix);
        }
        // subtle mottling so large flats do not read as flat plastic
        const m =
          1 +
          jitter * 0.06 * this.noise.noise(i * this.step * 0.42, j * this.step * 0.42) +
          jitter * 0.03 * this.noise.noise(i * this.step * 1.7 + 21, j * this.step * 1.7 - 9);
        rgb2[0] = clamp(rgb[0] * m, 0, 1);
        rgb2[1] = clamp(rgb[1] * m, 0, 1);
        rgb2[2] = clamp(rgb[2] * m, 0, 1);
        col[k * 3] = rgb2[0];
        col[k * 3 + 1] = rgb2[1];
        col[k * 3 + 2] = rgb2[2];
      }
    }
  }

  refreshColors() {
    this.recomputeRange();
    this.recomputeShading();
  }

  /* ---------------------------- state --------------------------------- */

  snapshot(): Float32Array {
    return this.heights.slice();
  }

  restore(data: Float32Array) {
    if (data.length !== this.heights.length) return;
    this.heights.set(data);
    this.recomputeRange();
    this.markAllDirty();
  }

  /** Resample into a different grid resolution (bilinear). */
  resample(newN: number) {
    if (newN === this.n) return;
    const old = this.heights;
    const oldN = this.n;
    const nh = new Float32Array(newN * newN);
    for (let j = 0; j < newN; j++) {
      for (let i = 0; i < newN; i++) {
        const gx = (i / (newN - 1)) * (oldN - 1);
        const gz = (j / (newN - 1)) * (oldN - 1);
        const i0 = Math.floor(gx);
        const j0 = Math.floor(gz);
        const i1 = Math.min(i0 + 1, oldN - 1);
        const j1 = Math.min(j0 + 1, oldN - 1);
        const fx = gx - i0;
        const fz = gz - j0;
        const a = old[j0 * oldN + i0];
        const b = old[j0 * oldN + i1];
        const c = old[j1 * oldN + i0];
        const d = old[j1 * oldN + i1];
        nh[j * newN + i] = lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
      }
    }
    this.n = newN;
    this.step = this.size / (newN - 1);
    this.heights = nh;
    this.colors = new Float32Array(newN * newN * 3);
    this.normals = new Float32Array(newN * newN * 3);
    this.slopes = new Float32Array(newN * newN);
    this.markAllDirty();
    this.refreshColors();
  }
}

function hexToTriplet(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
