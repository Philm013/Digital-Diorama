import * as THREE from 'three';

/**
 * Procedural geometry kit shared by the built-in flora and fauna.
 *
 * Everything is vertex-coloured (no textures): parts are written straight into
 * flat arrays (`Geo`) and become one BufferGeometry per material, so a whole tree
 * is two draw calls. Smooth parts get area-weighted normals; foliage gets normals
 * bent towards the crown's outward direction so canopies shade like volumes.
 */

export type RNG = () => number;
export function mulberry(seed: number): RNG {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a || 1e-9), 0, 1); return t * t * (3 - 2 * t); };
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/* ---------------- colour ---------------- */
export type RGB = [number, number, number];
const _c = new THREE.Color();
/** sRGB hex → linear RGB triple (vertex colours are linear) */
export function rgb(hex: string | number): RGB { _c.set(hex); return [_c.r, _c.g, _c.b]; }
export function mixc(a: RGB, b: RGB, t: number): RGB { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
export function shade(a: RGB, k: number): RGB { return [a[0] * k, a[1] * k, a[2] * k]; }
export function jitter(a: RGB, R: RNG, amount = 0.12): RGB { const k = 1 + (R() - 0.5) * 2 * amount; const h = (R() - 0.5) * amount * 0.5; return [a[0] * k * (1 + h), a[1] * k, a[2] * k * (1 - h)]; }

/* ---------------- 2D value noise (cheap, seedable) ---------------- */
export function noise3(x: number, y: number, z: number, seed = 0) {
  const h = (i: number, j: number, k: number) => {
    let n = (i * 374761393 + j * 668265263 + k * 1274126177 + seed * 1442695041) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}
export function fbm3(x: number, y: number, z: number, oct = 3, seed = 0) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f, seed + i * 17); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

/* ---------------- geometry accumulator ---------------- */
export class Geo {
  p: number[] = [];
  n: number[] = [];
  c: number[] = [];
  i: number[] = [];
  get vcount() { return this.p.length / 3; }
  v(p: THREE.Vector3, n: THREE.Vector3, c: RGB) {
    this.p.push(p.x, p.y, p.z);
    this.n.push(n.x, n.y, n.z);
    this.c.push(c[0], c[1], c[2]);
    return this.p.length / 3 - 1;
  }
  tri(a: number, b: number, c: number) { this.i.push(a, b, c); }
  quad(a: number, b: number, c: number, d: number) { this.i.push(a, b, c, a, c, d); }
  /** area-weighted smooth normals for everything written since (v0, i0) */
  smooth(v0: number, i0: number) {
    const P = this.p, N = this.n, I = this.i;
    for (let k = v0 * 3; k < P.length; k++) N[k] = 0;
    const a = V(), b = V(), c = V(), ab = V(), ac = V(), f = V();
    for (let t = i0; t < I.length; t += 3) {
      const ia = I[t], ib = I[t + 1], ic = I[t + 2];
      a.fromArray(P, ia * 3); b.fromArray(P, ib * 3); c.fromArray(P, ic * 3);
      f.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
      for (const ix of [ia, ib, ic]) if (ix >= v0) { N[ix * 3] += f.x; N[ix * 3 + 1] += f.y; N[ix * 3 + 2] += f.z; }
    }
    for (let k = v0; k < P.length / 3; k++) {
      const x = N[k * 3], y = N[k * 3 + 1], z = N[k * 3 + 2], l = Math.hypot(x, y, z) || 1;
      N[k * 3] = x / l; N[k * 3 + 1] = y / l; N[k * 3 + 2] = z / l;
    }
  }
  mark() { return { v: this.vcount, i: this.i.length }; }
  /** apply a matrix to everything written since a mark */
  transformFrom(m: { v: number }, mat: THREE.Matrix4) {
    const nm = new THREE.Matrix3().getNormalMatrix(mat), t = V();
    for (let k = m.v; k < this.vcount; k++) {
      t.fromArray(this.p, k * 3).applyMatrix4(mat); this.p[k * 3] = t.x; this.p[k * 3 + 1] = t.y; this.p[k * 3 + 2] = t.z;
      t.fromArray(this.n, k * 3).applyMatrix3(nm).normalize(); this.n[k * 3] = t.x; this.n[k * 3 + 1] = t.y; this.n[k * 3 + 2] = t.z;
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (this.vcount > 65535) g.setIndex(new THREE.Uint32BufferAttribute(this.i, 1));
    else g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
  get triangles() { return this.i.length / 3; }
}

/* ---------------- materials ---------------- */
export function vcMaterial(o: { side?: THREE.Side; roughness?: number; flat?: boolean; transparent?: boolean; opacity?: number; emissive?: string; emissiveIntensity?: number; name?: string } = {}) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: o.roughness ?? 0.85, metalness: 0, side: o.side ?? THREE.FrontSide, flatShading: !!o.flat,
    transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: !o.transparent,
  });
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.emissiveIntensity ?? 0.3; }
  if (o.name) m.name = o.name;
  return m;
}
export function meshOf(geo: Geo, mat: THREE.Material, name: string, shadow = true) {
  const m = new THREE.Mesh(geo.geometry(), mat);
  m.name = name;
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/* ---------------- frames ---------------- */
/** parallel-transport frames along a polyline */
export function frames(pts: THREE.Vector3[], up0 = UP) {
  const T: THREE.Vector3[] = [], N: THREE.Vector3[] = [], B: THREE.Vector3[] = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    T.push(V().subVectors(b, a).normalize());
  }
  const n = V().crossVectors(T[0], Math.abs(T[0].dot(up0)) > 0.95 ? V(1, 0, 0) : up0).normalize();
  const q = new THREE.Quaternion();
  for (let k = 0; k < pts.length; k++) {
    if (k > 0) {
      q.setFromUnitVectors(T[k - 1], T[k]);
      n.applyQuaternion(q);
      // keep exactly perpendicular to the tangent
      n.addScaledVector(T[k], -n.dot(T[k])).normalize();
    }
    N.push(n.clone());
    B.push(V().crossVectors(T[k], n).normalize());
  }
  return { T, N, B };
}

/** smooth a control polyline into many points (Catmull-Rom) */
export function spline(ctrl: THREE.Vector3[], n: number) {
  if (ctrl.length < 2) return ctrl.map((p) => p.clone());
  const c = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  return c.getPoints(Math.max(2, n));
}

/* ---------------- primitives ---------------- */
export interface SweepOpts {
  sides?: number;
  color: (t: number, a: number, p: THREE.Vector3) => RGB;
  /** radius multiplier around the ring (e.g. ribs, buttresses) */
  radial?: (t: number, a: number) => number;
  /** squash the section: width (N) vs height (B) */
  aspect?: number;
  capStart?: boolean;
  capEnd?: boolean;
  up?: THREE.Vector3;
  twist?: number;
  smooth?: boolean;
}
/** tube swept along points with per-point radius */
export function sweep(g: Geo, pts: THREE.Vector3[], radius: (t: number) => number, o: SweepOpts) {
  const sides = o.sides ?? 8;
  const m = g.mark();
  const { N, B } = frames(pts, o.up);
  const L = pts.length;
  const ring: number[][] = [];
  const tmp = V(), off = V();
  for (let k = 0; k < L; k++) {
    const t = k / (L - 1);
    const r = Math.max(1e-5, radius(t));
    const row: number[] = [];
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * TAU + (o.twist ?? 0) * t;
      const rr = r * (o.radial ? o.radial(t, a) : 1);
      off.copy(N[k]).multiplyScalar(Math.cos(a) * rr).addScaledVector(B[k], Math.sin(a) * rr * (o.aspect ?? 1));
      tmp.copy(pts[k]).add(off);
      row.push(g.v(tmp, off.clone().normalize(), o.color(t, a, tmp)));
    }
    ring.push(row);
  }
  for (let k = 0; k < L - 1; k++) for (let s = 0; s < sides; s++) g.quad(ring[k][s], ring[k][s + 1], ring[k + 1][s + 1], ring[k + 1][s]);
  if (o.capEnd !== false) {
    const tip = g.v(pts[L - 1], V(), o.color(1, 0, pts[L - 1]));
    for (let s = 0; s < sides; s++) g.tri(ring[L - 1][s], ring[L - 1][s + 1], tip);
  }
  if (o.capStart) {
    const base = g.v(pts[0], V(), o.color(0, 0, pts[0]));
    for (let s = 0; s < sides; s++) g.tri(ring[0][s + 1], ring[0][s], base);
  }
  if (o.smooth !== false) g.smooth(m.v, m.i);
  return m;
}

/** surface of revolution: profile is [radius, y] from bottom to top */
export function lathe(g: Geo, profile: [number, number][], center: THREE.Vector3, segs: number, color: (t: number, a: number, p: THREE.Vector3) => RGB, radial?: (t: number, a: number) => number, capTop = true) {
  const m = g.mark();
  const rows: number[][] = [];
  const p = V();
  for (let k = 0; k < profile.length; k++) {
    const t = k / (profile.length - 1);
    const row: number[] = [];
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * TAU;
      const r = profile[k][0] * (radial ? radial(t, a) : 1);
      p.set(center.x + Math.cos(a) * r, center.y + profile[k][1], center.z + Math.sin(a) * r);
      row.push(g.v(p, V(Math.cos(a), 0, Math.sin(a)), color(t, a, p)));
    }
    rows.push(row);
  }
  for (let k = 0; k < rows.length - 1; k++) for (let s = 0; s < segs; s++) g.quad(rows[k][s], rows[k + 1][s], rows[k + 1][s + 1], rows[k][s + 1]);
  if (capTop && profile[profile.length - 1][0] > 1e-4) {
    const top = profile[profile.length - 1];
    const c = g.v(V(center.x, center.y + top[1], center.z), UP, color(1, 0, center));
    const last = rows[rows.length - 1];
    for (let s = 0; s < segs; s++) g.tri(last[s + 1], last[s], c);
  }
  g.smooth(m.v, m.i);
  return m;
}

/** deformable ellipsoid (fruit, buds, cones, bodies) */
export function blob(g: Geo, c: THREE.Vector3, rx: number, ry: number, rz: number, color: (n: THREE.Vector3, p: THREE.Vector3) => RGB, o: { w?: number; h?: number; bump?: (n: THREE.Vector3) => number; rot?: THREE.Quaternion } = {}) {
  const W = o.w ?? 8, H = o.h ?? 6;
  const m = g.mark();
  const rows: number[][] = [];
  const n = V(), p = V();
  for (let y = 0; y <= H; y++) {
    const v = y / H, phi = v * Math.PI;
    const row: number[] = [];
    for (let x = 0; x <= W; x++) {
      const th = (x / W) * TAU;
      n.set(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
      const k = 1 + (o.bump ? o.bump(n) : 0);
      p.set(n.x * rx * k, n.y * ry * k, n.z * rz * k);
      if (o.rot) p.applyQuaternion(o.rot);
      p.add(c);
      const nn = V(n.x / rx, n.y / ry, n.z / rz).normalize();
      if (o.rot) nn.applyQuaternion(o.rot);
      row.push(g.v(p, nn, color(n, p)));
    }
    rows.push(row);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g.quad(rows[y][x], rows[y][x + 1], rows[y + 1][x + 1], rows[y + 1][x]);
  if (o.bump) g.smooth(m.v, m.i);
  return m;
}

export interface LeafOpts {
  /** width profile along the blade, t in 0..1 */
  shape?: (t: number) => number;
  segs?: number;
  /** lengthwise curl: positive bends the tip down (towards -side×dir normal) */
  curl?: number;
  /** V-fold across the midrib (0 flat .. 1 strong) */
  fold?: number;
  color: RGB;
  tip?: RGB;
  edge?: RGB;
  /** bend normals towards this direction (crown outward) */
  bias?: THREE.Vector3;
  biasAmt?: number;
  /** lateral twist along the blade */
  twist?: number;
  /** skip the midrib vertex column (2 tris per segment instead of 4) */
  flat?: boolean;
}
const leafShapes = {
  ellipse: (t: number) => Math.sin(Math.PI * Math.min(1, t * 1.02)) ** 0.8,
  lance: (t: number) => Math.sin(Math.PI * t) * (1 - 0.35 * t),
  oval: (t: number) => Math.sin(Math.PI * Math.pow(t, 0.8)),
  heart: (t: number) => Math.sin(Math.PI * Math.pow(t, 0.6)) * (1.15 - 0.3 * t),
  strap: (t: number) => Math.min(1, t * 6) * (1 - Math.pow(t, 6)),
  needle: (t: number) => (1 - t) * Math.min(1, t * 8),
};
export const LEAF = leafShapes;

/**
 * A leaf blade from `base` along `dir`, width across `side`. Returns nothing;
 * normals face `cross(side, dir)` bent towards `bias`.
 */
export function leaf(g: Geo, base: THREE.Vector3, dir: THREE.Vector3, side: THREE.Vector3, len: number, width: number, o: LeafOpts) {
  const segs = o.segs ?? 3;
  const shape = o.shape ?? leafShapes.ellipse;
  const d = dir.clone().normalize();
  const s = side.clone().sub(d.clone().multiplyScalar(side.dot(d))).normalize();
  const nrm = V().crossVectors(s, d).normalize();
  const bias = o.bias ? o.bias.clone().normalize() : null;
  // face the blade's front towards the bias so lit sides look outwards
  if (bias && nrm.dot(bias) < 0) { s.negate(); nrm.negate(); }
  const bn = (n0: THREE.Vector3) => (bias ? n0.clone().lerp(bias, o.biasAmt ?? 0.55).normalize() : n0);
  const curl = o.curl ?? 0.25, fold = o.fold ?? 0.2;
  const cols: number[][] = [];
  const p = V(), mid = V();
  let prev = base.clone(), heading = d.clone();
  for (let k = 0; k <= segs; k++) {
    const t = k / segs;
    if (k > 0) {
      heading.addScaledVector(nrm, -curl * (1 / segs)).normalize();
      prev = prev.clone().addScaledVector(heading, len / segs);
    }
    mid.copy(prev);
    const w = width * 0.5 * shape(t);
    const tw = (o.twist ?? 0) * t;
    const sd = s.clone().applyAxisAngle(heading, tw);
    const c = o.tip ? mixc(o.color, o.tip, t * t) : o.color;
    const row: number[] = [];
    if (o.flat) {
      for (const sg of [-1, 1]) { p.copy(mid).addScaledVector(sd, w * sg).addScaledVector(nrm, -fold * w * 0.6); row.push(g.v(p, bn(nrm), o.edge ? mixc(c, o.edge, 0.5) : c)); }
    } else {
      p.copy(mid).addScaledVector(sd, -w).addScaledVector(nrm, -fold * w * 0.6); row.push(g.v(p, bn(nrm), o.edge ?? c));
      row.push(g.v(mid, bn(nrm), shade(c, 1.06)));
      p.copy(mid).addScaledVector(sd, w).addScaledVector(nrm, -fold * w * 0.6); row.push(g.v(p, bn(nrm), o.edge ?? c));
    }
    cols.push(row);
  }
  for (let k = 0; k < segs; k++) {
    const a = cols[k], b = cols[k + 1];
    if (o.flat) g.quad(a[0], a[1], b[1], b[0]);
    else { g.quad(a[0], a[1], b[1], b[0]); g.quad(a[1], a[2], b[2], b[1]); }
  }
}

/** flat ring of petals around `c` facing `n` */
export function petals(g: Geo, c: THREE.Vector3, n: THREE.Vector3, count: number, len: number, width: number, color: RGB, o: { cup?: number; droop?: number; tip?: RGB; R?: RNG; shape?: (t: number) => number; phase?: number; segs?: number } = {}) {
  const nn = n.clone().normalize();
  const ref = Math.abs(nn.y) > 0.9 ? V(1, 0, 0) : UP;
  const e1 = V().crossVectors(nn, ref).normalize(), e2 = V().crossVectors(nn, e1).normalize();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + (o.phase ?? 0) + (o.R ? (o.R() - 0.5) * 0.25 : 0);
    const out = e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a));
    const dir = out.clone().multiplyScalar(Math.cos(o.cup ?? 0.2)).addScaledVector(nn, Math.sin(o.cup ?? 0.2)).normalize();
    const side = V().crossVectors(out, nn);
    leaf(g, c, dir, side, len, width, { color: o.R ? jitter(color, o.R, 0.06) : color, tip: o.tip, curl: o.droop ?? 0.15, fold: 0.1, shape: o.shape ?? leafShapes.oval, segs: o.segs ?? 3, bias: nn, biasAmt: 0.5 });
  }
}

/** orthonormal side vector for a direction */
export function sideOf(d: THREE.Vector3) {
  const ref = Math.abs(d.y) > 0.92 ? V(1, 0, 0) : UP;
  return V().crossVectors(d, ref).normalize();
}
/** rotate `v` around axis by angle (returns new vector) */
export function rot(v: THREE.Vector3, axis: THREE.Vector3, a: number) { return v.clone().applyAxisAngle(axis.clone().normalize(), a); }
/** random unit vector within `spread` radians of `d` */
export function wobble(d: THREE.Vector3, spread: number, R: RNG) {
  const s = sideOf(d), b = V().crossVectors(d, s);
  const a = R() * TAU, r = spread * Math.sqrt(R());
  return d.clone().addScaledVector(s, Math.cos(a) * Math.tan(r)).addScaledVector(b, Math.sin(a) * Math.tan(r)).normalize();
}

/** polyline that bends from `dir` towards `pull` (gravity / phototropism) with wobble */
export function bentPath(start: THREE.Vector3, dir: THREE.Vector3, len: number, segs: number, o: { pull?: THREE.Vector3; pullAmt?: number; gnarl?: number; R?: RNG }) {
  const pts = [start.clone()];
  const h = dir.clone().normalize();
  const step = len / segs;
  for (let k = 0; k < segs; k++) {
    if (o.pull) h.addScaledVector(o.pull, (o.pullAmt ?? 0) / segs).normalize();
    if (o.gnarl && o.R) h.copy(wobble(h, o.gnarl, o.R));
    pts.push(pts[pts.length - 1].clone().addScaledVector(h, step));
  }
  return pts;
}

/** sample a polyline at t (0..1) by arc length */
export function along(pts: THREE.Vector3[], t: number) {
  if (pts.length < 2) return { p: pts[0].clone(), d: V(0, 1, 0) };
  let total = 0;
  const seg: number[] = [];
  for (let k = 1; k < pts.length; k++) { const l = pts[k].distanceTo(pts[k - 1]); seg.push(l); total += l; }
  let want = clamp(t, 0, 1) * total;
  for (let k = 0; k < seg.length; k++) {
    if (want <= seg[k] || k === seg.length - 1) {
      const f = seg[k] > 0 ? clamp(want / seg[k], 0, 1) : 0;
      return { p: pts[k].clone().lerp(pts[k + 1], f), d: V().subVectors(pts[k + 1], pts[k]).normalize() };
    }
    want -= seg[k];
  }
  return { p: pts[pts.length - 1].clone(), d: V().subVectors(pts[pts.length - 1], pts[pts.length - 2]).normalize() };
}

/* ---------------- lofted bodies (animals) ---------------- */
export interface Station { t: number; y: number; w: number; h: number; x?: number; /** superellipse exponent (2 = ellipse) */ e?: number; /** flatten the underside (0..1) */ flat?: number }
/**
 * Loft a body along +Z from z0 (t=0) to z1 (t=1). Stations are interpolated with
 * smooth splines; the cross-section is a superellipse. `color(t, a, p)` paints it
 * (a = angle around the section: +π/2 is the top / dorsal line).
 */
export function loftZ(g: Geo, st: Station[], z0: number, z1: number, rings: number, sides: number, color: (t: number, a: number, p: THREE.Vector3) => RGB, bump?: (t: number, a: number) => number) {
  const m = g.mark();
  const keys = st.slice().sort((a, b) => a.t - b.t);
  const sample = (t: number, f: (s: Station) => number) => {
    let k = 0;
    while (k < keys.length - 2 && keys[k + 1].t < t) k++;
    const a = keys[Math.max(0, k - 1)], b = keys[k], c = keys[k + 1], d = keys[Math.min(keys.length - 1, k + 2)];
    const u = clamp((t - b.t) / (c.t - b.t || 1), 0, 1);
    const p0 = f(a), p1 = f(b), p2 = f(c), p3 = f(d);
    // Catmull-Rom
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
  };
  const rows: number[][] = [];
  const p = V();
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const y = sample(t, (s) => s.y), w = Math.max(1e-4, sample(t, (s) => s.w)), h = Math.max(1e-4, sample(t, (s) => s.h));
    const x0 = sample(t, (s) => s.x ?? 0), e = sample(t, (s) => s.e ?? 2), fl = sample(t, (s) => s.flat ?? 0);
    const z = lerp(z0, z1, t);
    const row: number[] = [];
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      const k = 2 / e;
      const bx = Math.sign(ca) * Math.pow(Math.abs(ca), k), by = Math.sign(sa) * Math.pow(Math.abs(sa), k);
      const bb = 1 + (bump ? bump(t, a) : 0);
      const yy = by < 0 ? by * (1 - fl * 0.6) : by;
      p.set(x0 + bx * w * bb, y + yy * h * bb, z);
      row.push(g.v(p, V(bx, yy, 0).normalize(), color(t, a, p)));
    }
    rows.push(row);
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < sides; s++) g.quad(rows[r][s], rows[r][s + 1], rows[r + 1][s + 1], rows[r + 1][s]);
  // close both ends
  for (const [ri, flip] of [[0, true], [rings, false]] as const) {
    const row = rows[ri];
    const cx = V(), cnt = row.length - 1;
    for (let s = 0; s < cnt; s++) cx.add(V().fromArray(g.p, row[s] * 3));
    cx.divideScalar(cnt);
    const ci = g.v(cx, V(0, 0, flip ? -1 : 1), color(ri / rings, 0, cx));
    for (let s = 0; s < cnt; s++) flip ? g.tri(row[s], ci, row[s + 1]) : g.tri(row[s + 1], ci, row[s]);
  }
  g.smooth(m.v, m.i);
  return m;
}

/** a thin flat membrane (fins, flippers, frills) defined by an outline grid f(u, v) → point */
export function sheet(g: Geo, nu: number, nv: number, f: (u: number, v: number) => THREE.Vector3, color: (u: number, v: number) => RGB, thick = 0) {
  const m = g.mark();
  const grid: number[][] = [];
  for (let i = 0; i <= nu; i++) {
    const row: number[] = [];
    for (let j = 0; j <= nv; j++) row.push(g.v(f(i / nu, j / nv), V(0, 1, 0), color(i / nu, j / nv)));
    grid.push(row);
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) g.quad(grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]);
  g.smooth(m.v, m.i);
  if (thick > 0) {
    // a back face, offset along the normal, so fins have some body when lit from behind
    const nv0 = g.vcount, base = m.v, count = nv0 - base;
    for (let k = 0; k < count; k++) {
      const pp = V().fromArray(g.p, (base + k) * 3), nn = V().fromArray(g.n, (base + k) * 3);
      g.v(pp.addScaledVector(nn, -thick), nn.clone().negate(), [g.c[(base + k) * 3], g.c[(base + k) * 3 + 1], g.c[(base + k) * 3 + 2]]);
    }
    const i1 = g.i.length;
    for (let t = m.i; t < i1; t += 3) g.tri(g.i[t] - base + nv0, g.i[t + 2] - base + nv0, g.i[t + 1] - base + nv0);
  }
  return m;
}
