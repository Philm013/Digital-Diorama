/**
 * Seeded, dependency-free 2D noise utilities used by the terrain engine.
 * Simplex noise (Gustavson-style) + fractal combinators (fBm, ridged, billow)
 * + domain warping + a tiny PRNG. No external packages, deterministic by seed.
 */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

const GRAD3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1,
  0, 1, -1, 0, -1, -1,
]);

export class SimplexNoise {
  private perm = new Uint8Array(512);
  private permMod12 = new Uint8Array(512);

  constructor(seed = 1337) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    const rnd = mulberry32(seed);
    for (let i = 255; i > 0; i--) {
      const n = Math.floor(rnd() * (i + 1));
      const q = p[i];
      p[i] = p[n];
      p[n] = q;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  /** Classic 2D simplex noise, output roughly in [-1, 1]. */
  noise(xin: number, yin: number): number {
    const perm = this.perm;
    const permMod12 = this.permMod12;
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1: number, j1: number;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi0 = permMod12[ii + perm[jj]] * 3;
      t0 *= t0;
      n0 = t0 * t0 * (GRAD3[gi0] * x0 + GRAD3[gi0 + 1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi1 = permMod12[ii + i1 + perm[jj + j1]] * 3;
      t1 *= t1;
      n1 = t1 * t1 * (GRAD3[gi1] * x1 + GRAD3[gi1 + 1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi2 = permMod12[ii + 1 + perm[jj + 1]] * 3;
      t2 *= t2;
      n2 = t2 * t2 * (GRAD3[gi2] * x2 + GRAD3[gi2 + 1] * y2);
    }
    return 70 * (n0 + n1 + n2);
  }
}

export interface FractalOptions {
  octaves?: number;
  frequency?: number;
  lacunarity?: number;
  gain?: number;
}

/** Standard fractal brownian motion. */
export function fbm(n: SimplexNoise, x: number, y: number, o: FractalOptions = {}): number {
  const oct = o.octaves ?? 5;
  const freq = o.frequency ?? 1;
  const lac = o.lacunarity ?? 2.0;
  const gain = o.gain ?? 0.5;
  let amp = 1;
  let f = freq;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * n.noise(x * f, y * f);
    norm += amp;
    amp *= gain;
    f *= lac;
  }
  return sum / (norm || 1);
}

/** Ridged multifractal — sharp crests, ideal for mountains. */
export function ridged(n: SimplexNoise, x: number, y: number, o: FractalOptions = {}): number {
  const oct = o.octaves ?? 5;
  const freq = o.frequency ?? 1;
  const lac = o.lacunarity ?? 2.0;
  const gain = o.gain ?? 0.5;
  let amp = 1;
  let f = freq;
  let sum = 0;
  let norm = 0;
  let weight = 1;
  for (let i = 0; i < oct; i++) {
    let v = 1 - Math.abs(n.noise(x * f, y * f));
    v *= v;
    v *= weight;
    weight = Math.min(1, Math.max(0, v * 2));
    sum += amp * v;
    norm += amp;
    amp *= gain;
    f *= lac;
  }
  return sum / (norm || 1);
}

/** Billowy fractal — soft rounded clouds / dunes. */
export function billow(n: SimplexNoise, x: number, y: number, o: FractalOptions = {}): number {
  const oct = o.octaves ?? 5;
  const freq = o.frequency ?? 1;
  const lac = o.lacunarity ?? 2.0;
  const gain = o.gain ?? 0.5;
  let amp = 1;
  let f = freq;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * Math.abs(n.noise(x * f, y * f)) * 2 - amp;
    norm += amp;
    amp *= gain;
    f *= lac;
  }
  return sum / (norm || 1);
}

/** Domain warping: noise used to offset the sample coordinate of more noise. */
export function warp(
  n: SimplexNoise,
  x: number,
  y: number,
  strength = 0.6,
  freq = 0.35
): [number, number] {
  const wx = n.noise(x * freq + 11.3, y * freq + 4.7);
  const wy = n.noise(x * freq - 7.1, y * freq + 19.2);
  return [x + wx * strength, y + wy * strength];
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};
