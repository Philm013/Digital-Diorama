import { Noise2D, clamp, smoothstep, rng } from './util';
import { GROUND_INDEX, Terrain } from './Terrain';

export interface TerrainRecipe {
  width?: number;
  depth?: number;
  cell?: number;
  seed?: number;
  relief?: number;
  scale?: number;
  backRise?: number;
  ridges?: number;
  dunes?: number;
  ponds?: { x: number; z: number; r: number; depth: number }[];
  river?: { points: [number, number][]; width: number; depth: number };
  flats?: { x: number; z: number; r: number; h?: number }[];
  hills?: { x: number; z: number; r: number; h: number }[];
  waterLevel?: number | null;
  strata?: string;
  paint?: PaintPreset;
}

export type PaintPreset = 'forest' | 'taiga' | 'savanna' | 'rainforest' | 'desert' | 'arctic' | 'wetland' | 'mountain' | 'meadow' | 'garden' | 'beach' | 'blank';

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
  const t = clamp((wx * vx + wz * vz) / (vx * vx + vz * vz || 1), 0, 1);
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
}

/** Catmull-Rom resample of a control polyline for smooth river beds. */
function smoothPath(pts: [number, number][], steps = 10): [number, number][] {
  if (pts.length < 3) return pts;
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function generateTerrain(r: TerrainRecipe): Terrain {
  const width = r.width ?? 40, depth = r.depth ?? 28, cell = r.cell ?? 0.25;
  const nx = Math.round(width / cell) + 1, nz = Math.round(depth / cell) + 1;
  const seed = r.seed ?? 7;
  const N = new Noise2D(seed);
  const heights = new Float32Array(nx * nz);
  const paint = new Uint8Array(nx * nz);
  const relief = r.relief ?? 1.2, scale = r.scale ?? 0.06;
  const river = r.river ? smoothPath(r.river.points) : null;
  const xOf = (i: number) => -width / 2 + (i * width) / (nx - 1);
  const zOf = (j: number) => -depth / 2 + (j * depth) / (nz - 1);

  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = xOf(i), z = zOf(j);
      let h = relief * N.fbm(x * scale, z * scale, 4);
      h += relief * 0.15 * N.noise(x * scale * 5, z * scale * 5);
      if (r.backRise) {
        const t = smoothstep(depth * 0.1, -depth / 2, z);
        h += r.backRise * t * t * (0.65 + 0.35 * N.ridged(x * 0.05 + 3, z * 0.05, 4) + 0.25 * N.noise(x * 0.12, 7));
      }
      if (r.ridges) h += r.ridges * (N.ridged(x * 0.045, z * 0.045, 5) - 0.35);
      if (r.dunes) {
        const w = x * 0.16 + N.fbm(x * 0.03, z * 0.03, 2) * 3.2;
        const crest = Math.pow(0.5 + 0.5 * Math.sin(w + z * 0.05), 2.2);
        h += r.dunes * (crest * (0.7 + 0.3 * N.noise(x * 0.05, z * 0.09)) - 0.3);
      }
      if (r.hills) for (const hl of r.hills) {
        const d = Math.hypot(x - hl.x, z - hl.z) / hl.r;
        if (d < 1) h += hl.h * Math.pow(Math.cos(d * Math.PI * 0.5), 2) * (0.85 + 0.15 * N.noise(x * 0.3, z * 0.3));
      }
      if (r.ponds) for (const p of r.ponds) {
        const wob = 1 + 0.18 * N.noise(x * 0.25 + p.x, z * 0.25 + p.z);
        const d = Math.hypot(x - p.x, z - p.z) / (p.r * wob);
        if (d < 1.6) {
          const bowl = d < 1 ? (1 - d * d) : 0;
          const rim = smoothstep(1.6, 0.9, d);
          h = h * (1 - rim * 0.85) - p.depth * bowl - 0.05 * rim;
        }
      }
      if (river && r.river) {
        let dmin = Infinity;
        for (let k = 0; k < river.length - 1; k++) dmin = Math.min(dmin, distToSegment(x, z, river[k][0], river[k][1], river[k + 1][0], river[k + 1][1]));
        const hw = r.river.width / 2 * (1 + 0.15 * N.noise(x * 0.2, z * 0.2));
        if (dmin < hw * 2.4) {
          const bank = smoothstep(hw * 2.4, hw, dmin);
          const bed = dmin < hw ? 1 - (dmin / hw) * (dmin / hw) : 0;
          h = h * (1 - bank * 0.8) - r.river.depth * bed - 0.12 * bank;
        }
      }
      if (r.flats) for (const f of r.flats) {
        const d = Math.hypot(x - f.x, z - f.z);
        const t = smoothstep(f.r, f.r * 0.5, d);
        h = h + ((f.h ?? 0) - h) * t;
      }
      // soften the outermost rim slightly so the diorama edge reads cleanly
      heights[j * nx + i] = h;
    }
  }
  // normalise: put the median front-half height near 0
  const sample: number[] = [];
  for (let j = Math.floor(nz * 0.5); j < nz; j += 3) for (let i = 0; i < nx; i += 3) sample.push(heights[j * nx + i]);
  sample.sort((a, b) => a - b);
  const median = sample[Math.floor(sample.length / 2)] ?? 0;
  const keepLevel = r.ponds?.length || r.river;
  for (let k = 0; k < heights.length; k++) heights[k] -= keepLevel ? Math.max(0, median) * 0.5 : median;

  const waterLevel = r.waterLevel === undefined ? (r.ponds || r.river ? -0.25 : null) : r.waterLevel;
  // Only the carved ponds/rivers should hold water: lift every other low spot just above the waterline
  if (waterLevel !== null && (r.ponds?.length || river)) {
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = xOf(i), z = zOf(j);
      let w = 0; // 1 inside a water feature, falling to 0 at its banks
      if (r.ponds) for (const p of r.ponds) w = Math.max(w, smoothstep(p.r * 1.25, p.r * 0.75, Math.hypot(x - p.x, z - p.z)));
      if (river && r.river) {
        let dmin = Infinity;
        for (let k = 0; k < river.length - 1; k++) dmin = Math.min(dmin, distToSegment(x, z, river[k][0], river[k][1], river[k + 1][0], river[k + 1][1]));
        w = Math.max(w, smoothstep(r.river.width * 0.95, r.river.width * 0.45, dmin));
      }
      const k = j * nx + i;
      const floor = waterLevel + 0.18 + 0.12 * N.noise(x * 0.4, z * 0.4);
      if (w < 1 && heights[k] < floor) heights[k] = heights[k] * w + floor * (1 - w);
    }
  }
  const t = new Terrain({ width, depth, nx, nz, heights, paint, waterLevel, strata: r.strata ?? 'loam', seed });
  applyPaint(t, r.paint ?? 'meadow', seed);
  t.rebuild();
  return t;
}

export function applyPaint(t: Terrain, preset: PaintPreset, seed = 1) {
  const N = new Noise2D(seed * 13 + 1);
  const R = rng(seed);
  const G = GROUND_INDEX;
  const wl = t.waterLevel;
  for (let j = 0; j < t.nz; j++) {
    for (let i = 0; i < t.nx; i++) {
      const k = j * t.nx + i;
      const x = t.xOf(i), z = t.zOf(j), h = t.heights[k];
      const hx = t.h(i + 1, j) - t.h(i - 1, j), hz = t.h(i, j + 1) - t.h(i, j - 1);
      const slope = Math.hypot(hx, hz) / (2 * t.dx);
      const n1 = N.fbm(x * 0.08, z * 0.08, 3), n2 = N.noise(x * 0.3, z * 0.3);
      const nearWater = wl !== null ? h - wl : 99;
      let g = G.grass;
      switch (preset) {
        case 'forest':
          g = n1 > 0.12 ? G.forest : n1 > -0.25 ? G.grass : G.meadow;
          if (nearWater < 0.2) g = nearWater < -0.2 ? G.mud : G.soil;
          if (slope > 0.85) g = G.rock;
          break;
        case 'taiga':
          g = n1 > 0.0 ? G.forest : n1 > -0.3 ? G.moss : G.grass;
          if (h > 3.2 + n2) g = G.snow;
          if (nearWater < 0.25) g = nearWater < -0.15 ? G.gravel : G.soil;
          if (slope > 0.8) g = G.rock;
          break;
        case 'savanna':
          g = n1 > 0.48 ? G.soil : G.dry;
          if (n2 > 0.75) g = G.grass;
          if (nearWater < 0.3) g = nearWater < -0.1 ? G.mud : G.soil;
          if (slope > 0.9) g = G.rock;
          break;
        case 'rainforest':
          g = n1 > -0.1 ? G.jungle : G.forest;
          if (nearWater < 0.25) g = nearWater < -0.1 ? G.mud : G.soil;
          if (slope > 1.0) g = G.rock;
          break;
        case 'desert':
          g = n1 > 0.35 ? G.sand : G.redsand;
          if (slope > 0.75) g = G.rock;
          if (nearWater < 0.35) g = nearWater < -0.05 ? G.mud : (n2 > 0 ? G.grass : G.soil);
          break;
        case 'arctic':
          g = n1 > 0.3 ? G.moss : G.snow;
          if (slope > 0.9) g = G.rock;
          if (nearWater < 0.15) g = nearWater < -0.1 ? G.gravel : G.ice;
          break;
        case 'wetland':
          g = n1 > 0.15 ? G.meadow : G.grass;
          if (nearWater < 0.45) g = G.mud;
          if (nearWater < -0.1) g = G.mud;
          break;
        case 'mountain':
          g = h > 4.5 + n2 * 0.8 ? G.snow : h > 2.6 + n2 ? G.rock : n1 > 0.15 ? G.forest : G.meadow;
          if (slope > 0.75 && g !== G.snow) g = G.rock;
          if (nearWater < 0.2) g = nearWater < -0.1 ? G.gravel : G.soil;
          break;
        case 'garden':
          g = G.grass;
          if (n1 > 0.42) g = G.meadow;
          if (nearWater < 0.2) g = G.gravel;
          break;
        case 'beach':
          g = z > 2 ? G.sand : n1 > 0.2 ? G.dry : G.grass;
          if (nearWater < 0.4) g = G.sand;
          break;
        case 'blank':
          g = G.grass;
          break;
        case 'meadow':
        default:
          g = n1 > 0.2 ? G.meadow : G.grass;
          if (nearWater < 0.25) g = nearWater < -0.1 ? G.mud : G.soil;
          if (slope > 0.9) g = G.rock;
      }
      if (R() < 0.004 && g !== G.snow && g !== G.ice) g = G.gravel;
      t.paint[k] = g;
    }
  }
}
