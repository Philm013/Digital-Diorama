import type { GridRect, Terrain } from './Terrain';
import { clamp } from './util';

/**
 * Selected areas for the Area land tool: a box or oval dragged across the land, or a free shape
 * drawn with the lasso or painted with the selection brush. Free shapes are stored as coverage
 * over the terrain grid (0…255 per vertex, softened across the outline so its 50% contour is a
 * smooth curve rather than a staircase). Every shape answers one question — how far a point is
 * from its outline, negative inside — and the landform generators, the outline the ground shader
 * draws and the plant scatter all work from that distance.
 */

export interface AreaRect { minX: number; minZ: number; maxX: number; maxZ: number }
export type AreaShapeKind = 'box' | 'oval' | 'free';
export interface AreaShape {
  kind: AreaShapeKind;
  /** box & oval: the shape as dragged (it may reach past the diorama's edge); free: the bounds of the selected land */
  rect: AreaRect;
  /** free shapes: how much of each terrain vertex is selected (0…255) */
  cover?: Uint8Array;
}

/** a selection ready for the generators */
export interface AreaField {
  /** signed distance to the outline (m): negative inside */
  sd(x: number, z: number): number;
  /** bounds of the selected land, inside the diorama */
  rect: AreaRect;
  /** radius of the biggest circle that fits in the area (and the diorama): half the width of its widest part */
  depth: number;
  /** selected land (m²) */
  size: number;
  /** a box or oval (convex) rather than a free shape */
  convex: boolean;
}

type Grid = Pick<Terrain, 'nx' | 'nz' | 'dx' | 'dz' | 'width' | 'depth'>;

/** coverage ramps from 0 to 1 over this many metres across an outline, centred on it */
export const rampOf = (t: Pick<Terrain, 'dx' | 'dz'>) => 2 * Math.max(t.dx, t.dz);
const covOf = (sd: number, ramp: number) => clamp(0.5 - sd / ramp, 0, 1);

/** signed distance (m) to a box or oval outline, negative inside (an oval's is approximate) */
export function boxOvalSd(oval: boolean, r: AreaRect, x: number, z: number) {
  const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
  const hw = Math.max(0.05, (r.maxX - r.minX) / 2), hd = Math.max(0.05, (r.maxZ - r.minZ) / 2);
  if (oval) return (Math.hypot((x - cx) / hw, (z - cz) / hd) - 1) * Math.min(hw, hd);
  const qx = Math.abs(x - cx) - hw, qz = Math.abs(z - cz) - hd;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
}

/** a field over the terrain grid, sampled bilinearly (beyond the grid it carries on from the edge) */
export function sampleGrid(t: Grid, g: Float32Array, x: number, z: number) {
  const fx = clamp((x + t.width / 2) / t.dx, 0, t.nx - 1.0001), fz = clamp((z + t.depth / 2) / t.dz, 0, t.nz - 1.0001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * t.nx + i;
  return (g[k] * (1 - u) + g[k + 1] * u) * (1 - v) + (g[k + t.nx] * (1 - u) + g[k + t.nx + 1] * u) * v;
}

/** any selection as coverage over the terrain grid (a free shape's is copied) */
export function toCover(t: Terrain, s: AreaShape): Uint8Array {
  const n = t.nx * t.nz;
  if (s.kind === 'free') return s.cover && s.cover.length === n ? s.cover.slice() : new Uint8Array(n);
  const c = new Uint8Array(n);
  const ramp = rampOf(t), oval = s.kind === 'oval';
  for (let j = 0; j < t.nz; j++) for (let i = 0; i < t.nx; i++) c[j * t.nx + i] = Math.round(255 * covOf(boxOvalSd(oval, s.rect, t.xOf(i), t.zOf(j)), ramp));
  return c;
}

/** paint a round dab of selection (or take it away); returns the grid rectangle it touched */
export function brushCover(t: Terrain, cover: Uint8Array, x: number, z: number, r: number, erase: boolean): GridRect {
  const ramp = rampOf(t), R = r + ramp;
  const rect = t.rectFor(x - R, z - R, x + R, z + R);
  for (let j = rect.j0; j <= rect.j1; j++) {
    const dz = t.zOf(j) - z;
    for (let i = rect.i0; i <= rect.i1; i++) {
      const k = j * t.nx + i;
      const f = Math.round(255 * covOf(Math.hypot(t.xOf(i) - x, dz) - r, ramp));
      cover[k] = erase ? Math.min(cover[k], 255 - f) : Math.max(cover[k], f);
    }
  }
  return rect;
}

let nearBuf: Float32Array | null = null;
/**
 * Fill a closed outline drawn with the lasso (the last point joins the first). Loops count as
 * inside (non-zero winding), so a scribble that crosses itself still selects everything it encloses.
 */
export function lassoCover(t: Terrain, pts: readonly (readonly [number, number])[]): Uint8Array {
  const { nx, nz, dx, dz } = t;
  const cover = new Uint8Array(nx * nz);
  const n = pts.length;
  if (n < 3) return cover;
  const x0 = -t.width / 2, z0 = -t.depth / 2;
  const xs: { x: number; w: number }[] = [];
  for (let j = 0; j < nz; j++) {
    const z = z0 + j * dz;
    xs.length = 0;
    for (let a = 0; a < n; a++) {
      const p = pts[a], q = pts[(a + 1) % n];
      if ((p[1] <= z) !== (q[1] <= z)) xs.push({ x: p[0] + ((z - p[1]) / (q[1] - p[1])) * (q[0] - p[0]), w: q[1] > p[1] ? 1 : -1 });
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a.x - b.x);
    let w = 0;
    for (let s = 0; s < xs.length - 1; s++) {
      w += xs[s].w;
      if (!w) continue;
      const i0 = Math.max(0, Math.ceil((xs[s].x - x0) / dx)), i1 = Math.min(nx - 1, Math.floor((xs[s + 1].x - x0) / dx));
      for (let i = i0; i <= i1; i++) cover[j * nx + i] = 255;
    }
  }
  // soften the rim with the exact distance to the outline, so it is a smooth curve
  const ramp = rampOf(t), half = ramp / 2;
  if (!nearBuf || nearBuf.length !== nx * nz) nearBuf = new Float32Array(nx * nz);
  const near = nearBuf.fill(Infinity);
  for (let a = 0; a < n; a++) {
    const p = pts[a], q = pts[(a + 1) % n];
    const r = t.rectFor(Math.min(p[0], q[0]) - half, Math.min(p[1], q[1]) - half, Math.max(p[0], q[0]) + half, Math.max(p[1], q[1]) + half);
    const ex = q[0] - p[0], ez = q[1] - p[1], el = ex * ex + ez * ez || 1e-9;
    for (let j = r.j0; j <= r.j1; j++) for (let i = r.i0; i <= r.i1; i++) {
      const x = x0 + i * dx, z = z0 + j * dz;
      const s = clamp(((x - p[0]) * ex + (z - p[1]) * ez) / el, 0, 1);
      const d = Math.hypot(x - p[0] - ex * s, z - p[1] - ez * s);
      const k = j * nx + i;
      if (d < near[k]) near[k] = d;
    }
  }
  for (let k = 0; k < cover.length; k++) {
    if (near[k] >= half) continue;
    cover[k] = Math.round(255 * clamp(cover[k] === 255 ? 0.5 + near[k] / ramp : 0.5 - near[k] / ramp, 0, 1));
  }
  return cover;
}

/**
 * Signed distance (m, negative inside) to the outline of a coverage mask, over the whole grid.
 * Vertices on the softened rim know their distance to the outline to a fraction of a cell; a
 * two-pass chamfer (with knight's moves, within about 2% of true distance) carries that inward
 * and outward. The edge of the diorama is not an outline: land selected up to it carries on.
 */
export function coverSdf(t: Grid, cover: Uint8Array, out?: Float32Array): Float32Array {
  const { nx, nz, dx, dz } = t;
  const n = nx * nz, ramp = rampOf(t);
  const BIG = (t.width + t.depth) * 4;
  const d = out && out.length === n ? out : new Float32Array(n);
  for (let k = 0; k < n; k++) { const c = cover[k]; d[k] = c > 0 && c < 255 ? Math.abs(c / 255 - 0.5) * ramp : BIG; }
  // a hard step between neighbours (neither of them softened) still marks the outline
  const hard = (c: number) => c === 0 || c === 255;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, c = cover[k];
    if (!hard(c)) continue;
    if (i < nx - 1 && hard(cover[k + 1]) && c !== cover[k + 1]) { d[k] = Math.min(d[k], dx / 2); d[k + 1] = Math.min(d[k + 1], dx / 2); }
    if (j < nz - 1 && hard(cover[k + nx]) && c !== cover[k + nx]) { d[k] = Math.min(d[k], dz / 2); d[k + nx] = Math.min(d[k + nx], dz / 2); }
  }
  const dg = Math.hypot(dx, dz), k1 = Math.hypot(2 * dx, dz), k2 = Math.hypot(dx, 2 * dz);
  // forward pass: neighbours above and to the left
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    let v = d[k];
    if (i > 0 && d[k - 1] + dx < v) v = d[k - 1] + dx;
    if (j > 0) {
      const u = k - nx;
      if (d[u] + dz < v) v = d[u] + dz;
      if (i > 0 && d[u - 1] + dg < v) v = d[u - 1] + dg;
      if (i < nx - 1 && d[u + 1] + dg < v) v = d[u + 1] + dg;
      if (i > 1 && d[u - 2] + k1 < v) v = d[u - 2] + k1;
      if (i < nx - 2 && d[u + 2] + k1 < v) v = d[u + 2] + k1;
      if (j > 1) {
        const u2 = u - nx;
        if (i > 0 && d[u2 - 1] + k2 < v) v = d[u2 - 1] + k2;
        if (i < nx - 1 && d[u2 + 1] + k2 < v) v = d[u2 + 1] + k2;
      }
    }
    d[k] = v;
  }
  // backward pass: neighbours below and to the right
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i;
    let v = d[k];
    if (i < nx - 1 && d[k + 1] + dx < v) v = d[k + 1] + dx;
    if (j < nz - 1) {
      const b = k + nx;
      if (d[b] + dz < v) v = d[b] + dz;
      if (i < nx - 1 && d[b + 1] + dg < v) v = d[b + 1] + dg;
      if (i > 0 && d[b - 1] + dg < v) v = d[b - 1] + dg;
      if (i < nx - 2 && d[b + 2] + k1 < v) v = d[b + 2] + k1;
      if (i > 1 && d[b - 2] + k1 < v) v = d[b - 2] + k1;
      if (j < nz - 2) {
        const b2 = b + nx;
        if (i < nx - 1 && d[b2 + 1] + k2 < v) v = d[b2 + 1] + k2;
        if (i > 0 && d[b2 - 1] + k2 < v) v = d[b2 - 1] + k2;
      }
    }
    d[k] = v;
  }
  for (let k = 0; k < n; k++) if (cover[k] >= 128) d[k] = -d[k];
  return d;
}

/** bounds of the selected vertices, or null when nothing is selected */
export function coverBounds(t: Terrain, cover: Uint8Array): AreaRect | null {
  const { nx, nz } = t;
  let i0 = nx, i1 = -1, j0 = nz, j1 = -1;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (cover[j * nx + i] < 128) continue;
    if (i < i0) i0 = i;
    if (i > i1) i1 = i;
    if (j < j0) j0 = j;
    if (j > j1) j1 = j;
  }
  return i1 < 0 ? null : { minX: t.xOf(i0), maxX: t.xOf(i1), minZ: t.zOf(j0), maxZ: t.zOf(j1) };
}

/** a box or oval's bounds inside the diorama */
export function clipRect(t: Pick<Terrain, 'width' | 'depth'>, r: AreaRect): AreaRect {
  const w = t.width / 2, d = t.depth / 2;
  return { minX: clamp(r.minX, -w, w), maxX: clamp(r.maxX, -w, w), minZ: clamp(r.minZ, -d, d), maxZ: clamp(r.maxZ, -d, d) };
}

/** everything the generators need to know about a selection; `sdf` is a free shape's distance grid */
export function areaField(t: Terrain, s: AreaShape, sdf?: Float32Array | null): AreaField | null {
  let sd: (x: number, z: number) => number;
  let rect: AreaRect | null;
  if (s.kind === 'free') {
    const g = sdf ?? (s.cover && s.cover.length === t.nx * t.nz ? coverSdf(t, s.cover) : null);
    if (!g) return null;
    sd = (x, z) => sampleGrid(t, g, x, z);
    rect = s.cover ? coverBounds(t, s.cover) : null;
  } else {
    const oval = s.kind === 'oval', r = s.rect;
    sd = (x, z) => boxOvalSd(oval, r, x, z);
    rect = clipRect(t, r);
  }
  if (!rect || rect.maxX - rect.minX < 0.2 || rect.maxZ - rect.minZ < 0.2) return null;
  // the biggest circle that fits both the area and the diorama, and how much land is selected
  const g = t.rectFor(rect.minX, rect.minZ, rect.maxX, rect.maxZ);
  let depth = 0, count = 0;
  for (let j = g.j0; j <= g.j1; j++) for (let i = g.i0; i <= g.i1; i++) {
    const x = t.xOf(i), z = t.zOf(j);
    const d = -sd(x, z);
    if (d <= 0) continue;
    count++;
    const room = Math.min(d, t.width / 2 - Math.abs(x) + t.dx, t.depth / 2 - Math.abs(z) + t.dz);
    if (room > depth) depth = room;
  }
  if (!count) return null;
  return { sd, rect, depth: Math.max(0.3, depth), size: count * t.dx * t.dz, convex: s.kind !== 'free' };
}
