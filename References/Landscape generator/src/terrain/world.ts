/**
 * WorldSampler — one continuous, world-space terrain function.
 *
 * height(x, z) = base(x, z) + Σ wᵢ(x, z) · detailᵢ(x, z)
 *
 * Every term is a pure function of world coordinates, so:
 *   • biomes fade into one another (weights are smooth gaussians),
 *   • chunks agree at every shared edge,
 *   • the same seed always produces the same landscape.
 *
 * Spikiness is controlled structurally: ridged noise crests are rounded by
 * `smoothing`, high-frequency octaves use a low gain, and the final relief is
 * soft-saturated so a single octave can never shoot into a needle.
 */

import { SimplexNoise, clamp, fbm, lerp, ridged, smoothstep } from './noise';
import { BIOMES, BIOME_INDEX, BiomeCtx } from './biomes';
import { Landmark, PALETTE_BY_ID, hexToRgb, sampleStops } from './presets';

export interface WorldConfig {
  seed: number;
  /** master wavelength in metres */
  scale: number;
  amplitude: number;
  seaLevel: number;
  baseBias: number;
  ridge: number;
  detail: number;
  warp: number;
  smoothing: number;
  forceBiome?: string;
  landmark: Landmark;
  /** metres over which temperature swings from equator to pole */
  latitude: number;
  water: boolean;
}

export const DEFAULT_WORLD: WorldConfig = {
  seed: 20260,
  scale: 1400,
  amplitude: 96,
  seaLevel: -6,
  baseBias: 0.05,
  ridge: 1.0,
  detail: 1.0,
  warp: 0.75,
  smoothing: 0.7,
  landmark: 'none',
  latitude: 9000,
  water: true,
};

const TOP_K = 3;

/** Reusable per-vertex sample state (climate + blended biome weights). */
export class SampleState {
  baseH = 0;
  elevN = 0;
  temp = 0;
  moist = 0;
  k = 0;
  order = new Int32Array(TOP_K);
  w = new Float32Array(TOP_K);
}

const scratchState = new SampleState();

export class WorldSampler {
  cfg: WorldConfig;
  n: SimplexNoise;
  n2: SimplexNoise;
  n3: SimplexNoise;
  private ctx: BiomeCtx;
  private wBuf = new Float32Array(BIOMES.length);
  private order: number[] = [];
  private rgb = new Float32Array(3);
  private acc = new Float32Array(3);

  constructor(cfg: Partial<WorldConfig> = {}) {
    this.cfg = { ...DEFAULT_WORLD, ...cfg };
    this.n = new SimplexNoise(this.cfg.seed);
    this.n2 = new SimplexNoise(this.cfg.seed * 7 + 11);
    this.n3 = new SimplexNoise(this.cfg.seed * 13 + 29);
    this.ctx = {
      n: this.n, n2: this.n2, n3: this.n3,
      scale: this.cfg.scale, amp: this.cfg.amplitude, sea: this.cfg.seaLevel,
      detail: this.cfg.detail, ridge: this.cfg.ridge, warp: this.cfg.warp,
      smoothing: this.cfg.smoothing,
      baseH: 0, elevN: 0, temp: 0.5, moist: 0.5,
    };
  }

  set(patch: Partial<WorldConfig>) {
    const reseed = patch.seed !== undefined && patch.seed !== this.cfg.seed;
    this.cfg = { ...this.cfg, ...patch };
    if (reseed) {
      this.n = new SimplexNoise(this.cfg.seed);
      this.n2 = new SimplexNoise(this.cfg.seed * 7 + 11);
      this.n3 = new SimplexNoise(this.cfg.seed * 13 + 29);
      this.ctx.n = this.n;
      this.ctx.n2 = this.n2;
      this.ctx.n3 = this.n3;
    }
    const c = this.ctx;
    c.scale = this.cfg.scale;
    c.amp = this.cfg.amplitude;
    c.sea = this.cfg.seaLevel;
    c.detail = this.cfg.detail;
    c.ridge = this.cfg.ridge;
    c.warp = this.cfg.warp;
    c.smoothing = this.cfg.smoothing;
  }

  /* ------------------------------- macro ---------------------------- */

  private warpOffset(x: number, z: number, out: [number, number]) {
    const s = this.cfg.scale;
    const w = this.cfg.warp * s * 0.22;
    if (w === 0) {
      out[0] = 0;
      out[1] = 0;
      return;
    }
    out[0] = this.n3.noise(x / (s * 1.5) + 31.7, z / (s * 1.5) - 17.3) * w;
    out[1] = this.n3.noise(x / (s * 1.5) - 53.1, z / (s * 1.5) + 29.4) * w;
  }

  private wo: [number, number] = [0, 0];

  /** Continent + hill + mountain-belt relief, in metres. */
  baseHeight(x: number, z: number): number {
    const c = this.cfg;
    const s = c.scale;
    this.warpOffset(x, z, this.wo);
    const wx = this.wo[0];
    const wz = this.wo[1];

    const cont = fbm(this.n, (x + wx) / s, (z + wz) / s, { octaves: 4, gain: 0.5 }) + c.baseBias;
    const hills = fbm(this.n, (x + wx) / (s * 0.28), (z + wz) / (s * 0.28), { octaves: 5, gain: 0.45 });
    const soft = c.smoothing;

    // mountain belts: broad, rounded, only on positive ground
    const beltNoise = ridged(this.n2, (x + wx) / (s * 1.7), (z + wz) / (s * 1.7), { octaves: 4, gain: 0.45 });
    const belt = smoothstep(0.14, 0.72, beltNoise) * smoothstep(-0.18, 0.42, cont) * c.ridge;

    let e = cont * 0.6 + hills * 0.26 * c.detail;
    // shoreline break: gentler submarine slopes than subaerial ones
    const k = lerp(0.62, 1, smoothstep(-0.22, 0.16, e));
    let h = c.seaLevel + e * c.amplitude * k;
    h += belt * c.amplitude * 0.55 * smoothstep(-0.12, 0.3, e);
    // fine grain, scaled by detail and damped by smoothing
    const grain = fbm(this.n2, x / (s * 0.055), z / (s * 0.055), { octaves: 3, gain: 0.42 });
    h += grain * c.amplitude * 0.016 * c.detail * (1 - soft * 0.45);
    return softSat(h - c.seaLevel, c.amplitude * 1.15) + c.seaLevel;
  }

  /** Climate fields derived from the base relief — smooth everywhere. */
  private climate(x: number, z: number, baseH: number) {
    const c = this.cfg;
    const elevN = clamp((baseH - c.seaLevel) / (c.amplitude * 0.85), -1, 1);
    const lat = clamp(z / Math.max(500, c.latitude), -1, 1);
    // wide-spread noise so hot/cold and wet/dry regions genuinely occur
    const tNoise = clamp(fbm(this.n3, x / (c.scale * 3) + 71, z / (c.scale * 3) - 19, { octaves: 2 }) * 1.7, -0.5, 0.5);
    const temp = clamp(0.5 + tNoise - Math.abs(lat) * 0.3 - Math.max(0, elevN) * 0.22, 0, 1);
    const mNoise = clamp(fbm(this.n3, x / (c.scale * 2.2) + 100, z / (c.scale * 2.2) - 50, { octaves: 3, gain: 0.5 }) * 0.95, -0.48, 0.48);
    const moist = clamp(0.5 + mNoise - Math.max(0, elevN) * 0.12, 0, 1);
    return { elevN, temp, moist };
  }

  /* ------------------------------ biomes ---------------------------- */

  /** Fills this.wBuf with normalized biome weights; returns the count above threshold. */
  private weights(x: number, z: number, elevN: number, temp: number, moist: number): number {
    const w = this.wBuf;
    let sum = 0;
    let count = 0;
    if (this.cfg.forceBiome) {
      w.fill(0);
      const idx = BIOME_INDEX[this.cfg.forceBiome];
      if (idx !== undefined) {
        w[idx] = 1;
        this.order = [idx];
        return 1;
      }
    }
    for (let i = 0; i < BIOMES.length; i++) {
      const b = BIOMES[i];
      const dt = (temp - b.niche.t) / b.niche.tw;
      const dm = (moist - b.niche.m) / b.niche.mw;
      const de = (elevN - b.niche.e) / b.niche.ew;
      const d2 = dt * dt + dm * dm + de * de;
      if (d2 > 9) {
        w[i] = 0;
        continue;
      }
      let v = Math.exp(-d2);
      if (v > 0.06 && b.gate) v *= b.gate(this.ctx, x, z);
      w[i] = v > 0.004 ? v : 0;
      if (w[i] > 0) {
        sum += w[i];
        count++;
      }
    }
    if (sum <= 0) {
      w.fill(0);
      w[BIOME_INDEX.plains] = 1;
      this.order = [BIOME_INDEX.plains];
      return 1;
    }
    // keep the strongest contributors
    const idxs: number[] = [];
    for (let i = 0; i < BIOMES.length; i++) if (w[i] > 0) idxs.push(i);
    idxs.sort((a, b) => w[b] - w[a]);
    const top = idxs.slice(0, TOP_K);
    let ts = 0;
    for (const i of top) ts += w[i];
    for (const i of top) w[i] /= ts;
    this.order = top;
    return top.length;
  }

  /**
   * Height + climate + biome weights in one evaluation, cached into `st`
   * so the matching colour pass needs no further noise lookups.
   */
  prepare(x: number, z: number, st: SampleState): number {
    const c = this.cfg;
    const baseH = this.baseHeight(x, z);
    const { elevN, temp, moist } = this.climate(x, z, baseH);
    const ctx = this.ctx;
    ctx.baseH = baseH;
    ctx.elevN = elevN;
    ctx.temp = temp;
    ctx.moist = moist;
    const k = this.weights(x, z, elevN, temp, moist);
    st.baseH = baseH;
    st.elevN = elevN;
    st.temp = temp;
    st.moist = moist;
    st.k = k;
    let h = baseH;
    for (let i = 0; i < k; i++) {
      const bi = this.order[i];
      st.order[i] = bi;
      st.w[i] = this.wBuf[bi];
      h += this.wBuf[bi] * BIOMES[bi].detail(ctx, x, z);
    }
    return softSat(h - c.seaLevel, c.amplitude * 1.35) + c.seaLevel;
  }

  /** Colour + dominant biome from a cached sample (no noise evaluation). */
  shade(st: SampleState, h: number, slope: number, out: Float32Array): number {
    const c = this.cfg;
    const acc = this.acc;
    acc[0] = acc[1] = acc[2] = 0;
    let wsum = 0;
    const depth = Math.max(2, c.amplitude * 0.5);
    let best = st.order[0];
    let bw = -1;
    for (let i = 0; i < st.k; i++) {
      const bi = st.order[i];
      const w = st.w[i];
      if (w > bw) {
        bw = w;
        best = bi;
      }
      const pal = PALETTE_BY_ID[BIOMES[bi].palette] ?? PALETTE_BY_ID.temperate;
      const rgb = this.rgb;
      if (h < c.seaLevel && c.water) {
        const t = clamp((h - (c.seaLevel - depth)) / depth, 0, 1);
        const a = hexToRgb(pal.deep);
        const b = hexToRgb(pal.shallow);
        const f = Math.pow(t, 0.72);
        rgb[0] = a[0] + (b[0] - a[0]) * f;
        rgb[1] = a[1] + (b[1] - a[1]) * f;
        rgb[2] = a[2] + (b[2] - a[2]) * f;
      } else {
        const t = clamp((h - c.seaLevel) / Math.max(1, c.amplitude * 0.85), 0, 1);
        sampleStops(pal.stops, t, rgb);
        const rockMix = smoothstep(pal.rockSlope * 0.5, pal.rockSlope * 1.05, slope);
        const rock = hexToRgb(pal.rock);
        rgb[0] += (rock[0] - rgb[0]) * rockMix;
        rgb[1] += (rock[1] - rgb[1]) * rockMix;
        rgb[2] += (rock[2] - rgb[2]) * rockMix;
        const snowMix = smoothstep(pal.snowLine, pal.snowLine + 0.16, t) * (1 - rockMix * 0.55);
        const snow = hexToRgb(pal.snow);
        rgb[0] += (snow[0] - rgb[0]) * snowMix;
        rgb[1] += (snow[1] - rgb[1]) * snowMix;
        rgb[2] += (snow[2] - rgb[2]) * snowMix;
      }
      acc[0] += rgb[0] * w;
      acc[1] += rgb[1] * w;
      acc[2] += rgb[2] * w;
      wsum += w;
    }
    const inv = 1 / (wsum || 1);
    out[0] = acc[0] * inv;
    out[1] = acc[1] * inv;
    out[2] = acc[2] * inv;
    return best;
  }

  /** Convenience wrapper: height only. */
  heightAt(x: number, z: number): number {
    return this.prepare(x, z, scratchState);
  }

  /** Dominant biome id at a world position (used by the compass + jump-to). */
  biomeAt(x: number, z: number): string {
    const baseH = this.baseHeight(x, z);
    const { elevN, temp, moist } = this.climate(x, z, baseH);
    this.ctx.baseH = baseH;
    this.ctx.elevN = elevN;
    this.ctx.temp = temp;
    this.ctx.moist = moist;
    const k = this.weights(x, z, elevN, temp, moist);
    let best = this.order[0];
    let bw = -1;
    for (let i = 0; i < k; i++) if (this.wBuf[this.order[i]] > bw) { bw = this.wBuf[this.order[i]]; best = this.order[i]; }
    return BIOMES[best].id;
  }

  /* ------------------------------ colour ---------------------------- */

  /** Standalone vertex colour + dominant biome (recomputes the sample state). */
  colorAndBiome(x: number, z: number, h: number, slope: number, out: Float32Array): number {
    const st = scratchState;
    this.prepare(x, z, st);
    return this.shade(st, h, slope, out);
  }

  /* ------------------------------- grids ---------------------------- */

  /**
   * Sample a square grid. Returns heights, vertex colours, the dominant biome
   * per vertex and prop densities per vertex (packed as biome index lookup).
   */
  generateGrid(
    n: number,
    size: number,
    originX = 0,
    originZ = 0
  ): { heights: Float32Array; colors: Float32Array; biome: Uint8Array } {
    const heights = new Float32Array(n * n);
    const colors = new Float32Array(n * n * 3);
    const biome = new Uint8Array(n * n);
    const step = size / (n - 1);
    const half = size / 2;
    const rgb = new Float32Array(3);
    const states: SampleState[] = new Array(n * n);
    for (let k = 0; k < n * n; k++) states[k] = new SampleState();

    for (let j = 0; j < n; j++) {
      const z = originZ - half + j * step;
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const x = originX - half + i * step;
        heights[k] = this.prepare(x, z, states[k]);
      }
    }

    if (this.cfg.landmark !== 'none') applyLandmark(heights, n, size, this.cfg);

    // slopes from the finished grid (free, and perfectly consistent)
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const l = heights[j * n + Math.max(0, i - 1)];
        const r = heights[j * n + Math.min(n - 1, i + 1)];
        const d = heights[Math.max(0, j - 1) * n + i];
        const u = heights[Math.min(n - 1, j + 1) * n + i];
        const gx = (r - l) / (2 * step);
        const gz = (u - d) / (2 * step);
        const slope = clamp(Math.hypot(gx, gz) / 2.2, 0, 1);
        biome[k] = this.shade(states[k], heights[k], slope, rgb);
        colors[k * 3] = rgb[0];
        colors[k * 3 + 1] = rgb[1];
        colors[k * 3 + 2] = rgb[2];
      }
    }
    return { heights, colors, biome };
  }
}

/* ------------------------------------------------------------------ */
/* landmarks (tile mode focal features)                                */
/* ------------------------------------------------------------------ */

function applyLandmark(h: Float32Array, n: number, size: number, cfg: WorldConfig) {
  const half = size / 2;
  const amp = cfg.amplitude;
  const sea = cfg.seaLevel;
  const type = cfg.landmark;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const x = -half + (i / (n - 1)) * size;
      const z = -half + (j / (n - 1)) * size;
      const d = Math.hypot(x, z) / half;
      let add = 0;
      switch (type) {
        case 'volcano': {
          const cone = Math.pow(1 - clamp(d / 0.95, 0, 1), 1.7) * amp * 1.0;
          const caldera = (1 - smoothstep(0.0, 0.16, d)) * amp * 0.22;
          const mask = 1 - smoothstep(0.82, 1.05, d);
          add = (cone - caldera) * mask;
          break;
        }
        case 'craters': {
          const spots: [number, number, number][] = [
            [0, 0, 0.34], [-0.42, 0.3, 0.19], [0.4, -0.28, 0.15], [0.22, 0.48, 0.11], [-0.3, -0.45, 0.13],
          ];
          for (const [cx, cz, r] of spots) {
            const dd = Math.hypot(x / half - cx, z / half - cz) / r;
            if (dd > 1.35) continue;
            if (dd < 0.85) add -= (1 - (dd / 0.85) * (dd / 0.85)) * r * amp * 0.55;
            const rt = (dd - 0.9) / 0.35;
            if (rt > -1 && rt < 1) add += (1 - rt * rt) * r * amp * 0.24;
          }
          add *= 1 - smoothstep(0.85, 1.05, d);
          break;
        }
        case 'island': {
          const mask = 1 - smoothstep(0.15, 0.92, d);
          add = mask * amp * 0.55 - (1 - mask) * amp * 0.08;
          break;
        }
        case 'atoll': {
          const ring = Math.exp(-Math.pow((d - 0.62) / 0.16, 2));
          const lagoon = (1 - smoothstep(0.1, 0.55, d)) * -amp * 0.22;
          add = ring * amp * 0.3 + lagoon;
          break;
        }
        case 'mesacity': {
          const mask = 1 - smoothstep(0.6, 0.95, d);
          add = mask * amp * 0.1;
          break;
        }
        default:
          break;
      }
      if (add) {
        h[k] = lerp(h[k], h[k] + add, 0.9);
        if (type === 'island') h[k] = Math.max(h[k], sea - amp * 0.25);
      }
    }
  }
}

function softSat(v: number, limit: number) {
  const t = v / limit;
  const a = Math.abs(t);
  const d = Math.pow(1 + Math.pow(a, 2.6), 1 / 2.6);
  return limit * (t / d);
}
