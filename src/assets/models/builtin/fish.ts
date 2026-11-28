import * as THREE from 'three';
import type { ParamSpec } from '../../modules';
import { Geo, V, blob, fbm3, lerp, loftZ, meshOf, mixc, rgb, sheet, sstep, vcMaterial, type RGB, type Station } from '../proc/kit';

/*
 * Fish the generic Wildform body plans drew as faceted blobs (and a brown clownfish): a great white
 * shark, a giant manta, a yellow tang, a clownfish and a red lionfish, each with its own body shape,
 * fins placed where they are on the real fish, and its colour pattern painted into the mesh.
 * All face +Z, the belly near y = 0, and carry pivots for the swim animation (tail sweep, pectoral
 * flutter, manta wingbeat). Built against reference photos in the animal workbench.
 */

const p0 = (schema: Record<string, ParamSpec>, p: Record<string, unknown>) =>
  ({ ...Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, v.default])), ...p }) as Record<string, any>;
const pivot = (name: string, at: THREE.Vector3) => { const g = new THREE.Group(); g.name = name; g.position.copy(at); return g; };
function rebase(geo: Geo, at: THREE.Vector3) { geo.transformFrom({ v: 0 }, new THREE.Matrix4().makeTranslation(-at.x, -at.y, -at.z)); }

/** a fin: u runs along its base, v from the base (0) to the edge (1); `edge(u)` is the base→edge vector */
function fin(g: Geo, base: (u: number) => THREE.Vector3, edge: (u: number) => THREE.Vector3, color: (u: number, v: number) => RGB, nu = 10, nv = 4) {
  return sheet(g, nu, nv, (u, v) => base(u).addScaledVector(edge(u), v), color, 0);
}

type Kind = 'shark' | 'manta' | 'tang' | 'clownfish' | 'lionfish';
/** real adult length (m): nose to tail, or disc width for the manta */
const SIZE: Record<Kind, number> = { shark: 3.6, manta: 4, tang: 0.13, clownfish: 0.09, lionfish: 0.3 };

export const FISH_PARAMS: Record<string, ParamSpec> = {
  kind: { type: 'choice', default: 'tang', options: Object.keys(SIZE), label: 'Species' },
  size: { type: 'range', default: 1, min: 0.6, max: 1.4, step: 0.01, label: 'Size' },
  seed: { type: 'range', default: 3, min: 1, max: 999, step: 1, label: 'Seed' },
};
export const FISH_RIG = {
  tail: { axis: 'y', range: [-16, 16], speed: 1.4 },
  flipperL: { axis: 'z', range: [-10, 10], speed: 1.1 },
  flipperR: { axis: 'z', range: [10, -10], speed: 1.1 },
  wingL: { axis: 'z', range: [-14, 14], speed: 0.45 },
  wingR: { axis: 'z', range: [14, -14], speed: 0.45 },
};

export function createFish(params: Record<string, unknown> = {}) {
  const P = p0(FISH_PARAMS, params);
  const kind = ((P.kind as string) in SIZE ? P.kind : 'tang') as Kind;
  const L = SIZE[kind] * Number(P.size), seed = Number(P.seed);
  const root = new THREE.Group();
  root.name = 'fish-' + kind;
  const body = vcMaterial({ roughness: kind === 'shark' || kind === 'manta' ? 0.55 : 0.32 });
  const finMat = vcMaterial({ roughness: 0.5, side: THREE.DoubleSide });
  const build = { shark, manta, tang, clownfish, lionfish }[kind];
  build(root, L, seed, body, finMat);
  return root;
}

const eye = (g: Geo, at: THREE.Vector3, r: number, iris: RGB, pupil = rgb('#050505')) => {
  blob(g, at, r, r, r * 0.8, (n) => (n.z > 0.35 || Math.abs(n.x) > 0.75 ? (Math.abs(n.x) > 0.93 ? pupil : iris) : iris), { w: 10, h: 8 });
};

/* ───────────── great white shark ───────────── */
function shark(root: THREE.Group, L: number, seed: number, mat: THREE.Material, finMat: THREE.Material) {
  const back = rgb('#5b666e'), belly = rgb('#f1f1ec'), dark = rgb('#1d2023'), gill = rgb('#3c444a');
  const S = (t: number, w: number, h: number, y = 0.13): Station => ({ t, y: y * L, w: w * L, h: h * L, e: 2.1 });
  // peduncle (t = 0, with its lateral keels) to the conical snout (t = 1)
  const st = [S(0, 0.036, 0.024), S(0.12, 0.05, 0.055), S(0.32, 0.082, 0.1), S(0.52, 0.095, 0.115), S(0.7, 0.088, 0.104), S(0.84, 0.066, 0.08, 0.133), S(0.94, 0.036, 0.046, 0.137), S(1, 0.006, 0.008, 0.14)];
  const z0 = -0.36 * L, z1 = 0.5 * L;
  const zt = (t: number) => lerp(z0, z1, t);
  const g = new Geo();
  const paint = (t: number, a: number, p: THREE.Vector3): RGB => {
    const sa = Math.sin(a), ca = Math.abs(Math.cos(a));
    // sharp countershading: the grey back meets the white belly along a ragged line low on the flank
    const n = fbm3(p.x / L * 14, p.y / L * 14, p.z / L * 14, 3, seed) - 0.5;
    const line = -0.12 + n * 0.35 + (t > 0.78 ? 0.25 * sstep(0.78, 0.95, t) : 0);
    let c = sa > line ? back : belly;
    // five gill slits on each side
    if (t > 0.69 && t < 0.79 && ca > 0.45 && sa > -0.45 && sa < 0.45 && Math.cos((t - 0.69) / 0.1 * 5 * Math.PI * 2) > 0.78) c = gill;
    // mouth: a dark crescent under the snout
    if (t > 0.86 && t < 0.92 && sa < -0.55 && Math.abs((t - 0.89) * 40) + ca * 0.3 < 1) c = rgb('#2a2124');
    return c;
  };
  loftZ(g, st, z0, z1, 56, 28, paint);
  for (const sx of [-1, 1]) eye(g, V(sx * 0.058 * L, 0.152 * L, zt(0.875)), 0.008 * L, rgb('#0a0c0e'));
  // first dorsal fin: tall, triangular, its trailing edge a little concave
  const fz = zt(0.5);
  fin(g, (u) => V(0, 0.235 * L, fz + 0.06 * L - u * 0.13 * L), (u) => V(0, (0.14 - 0.14 * u) * L, (-0.05 - 0.04 * (1 - u)) * L + 0.012 * L * Math.sin(Math.PI * u)), () => back, 8, 5);
  // second dorsal and anal fins (tiny)
  fin(g, (u) => V(0, 0.155 * L, zt(0.12) + 0.015 * L - u * 0.03 * L), (u) => V(0, 0.025 * L * (1 - u), -0.01 * L), () => back, 3, 2);
  fin(g, (u) => V(0, 0.105 * L, zt(0.1) + 0.015 * L - u * 0.03 * L), (u) => V(0, -0.022 * L * (1 - u), -0.012 * L), () => belly, 3, 2);
  // pelvic fins
  for (const sx of [-1, 1]) fin(g, (u) => V(sx * 0.03 * L, 0.05 * L, zt(0.3) + 0.02 * L - u * 0.05 * L), (u) => V(sx * 0.04 * L * (1 - u * 0.6), -0.02 * L, -0.03 * L), (_u, v) => mixc(belly, back, v * 0.5), 4, 2);
  root.add(meshOf(g, mat, 'body'));
  const fins = new Geo();
  root.add(meshOf(fins, finMat, 'fins'));
  // pectoral fins: long, swept back and angled down, black tips underneath
  for (const sx of [-1, 1]) {
    const at = V(sx * 0.08 * L, 0.085 * L, zt(0.66));
    const pg = new Geo();
    fin(pg, (u) => at.clone().add(V(0, 0, 0.05 * L - u * 0.1 * L)), (u) => V(sx * 0.21 * L * (1 - u * 0.75), -0.075 * L * (1 - u * 0.6), -0.11 * L * (1 - u * 0.4)),
      (_u, v) => (v > 0.85 ? dark : v > 0.6 ? mixc(back, dark, (v - 0.6) * 2) : back), 6, 6);
    rebase(pg, at);
    const piv = pivot(sx < 0 ? 'flipperR' : 'flipperL', at);
    piv.add(meshOf(pg, finMat, 'pectoral'));
    root.add(piv);
  }
  // crescent (lunate) tail: two nearly equal lobes, the upper slightly longer
  const tailAt = V(0, 0.13 * L, z0);
  const tg = new Geo();
  for (const up of [1, -1]) {
    const span = (up > 0 ? 0.2 : 0.16) * L;
    fin(tg, (u) => V(0, tailAt.y + up * u * 0.02 * L, z0 + 0.01 * L - u * 0.035 * L), (u) => V(0, up * span * (1 - u * 0.25), -span * 0.55 * (1 - u * 0.5) - 0.02 * L), () => back, 4, 6);
  }
  rebase(tg, tailAt);
  const tail = pivot('tail', tailAt);
  tail.add(meshOf(tg, finMat, 'caudal'));
  root.add(tail);
}

/* ───────────── giant manta ───────────── */
function manta(root: THREE.Group, W: number, seed: number, mat: THREE.Material, finMat: THREE.Material) {
  const top = rgb('#202427'), belly = rgb('#eef0ec'), patch = rgb('#cfd3d0'), spot = rgb('#3a3d40');
  const Lb = W * 0.42; // head-to-tail-base length of the central body
  const S = (t: number, w: number, h: number): Station => ({ t, y: 0.06 * Lb, w: w * Lb, h: h * Lb, e: 2.4, flat: 0.3 });
  const st = [S(0, 0.06, 0.035), S(0.25, 0.2, 0.08), S(0.55, 0.26, 0.1), S(0.8, 0.24, 0.085), S(0.95, 0.2, 0.06), S(1, 0.16, 0.04)];
  const z0 = -0.45 * Lb, z1 = 0.5 * Lb;
  const g = new Geo();
  const paint = (t: number, a: number, p: THREE.Vector3): RGB => {
    const sa = Math.sin(a);
    if (sa < -0.1) {
      // white belly with a few dark spots between the gill slits
      const n = fbm3(p.x / Lb * 18, 0, p.z / Lb * 18, 2, seed);
      return n > 0.7 ? spot : belly;
    }
    // pale "shoulder" chevrons behind the head
    const sh = t > 0.62 && t < 0.86 && Math.abs(p.x) > 0.08 * Lb && Math.abs(p.x) < 0.24 * Lb && sa > 0.2;
    return sh ? patch : top;
  };
  loftZ(g, st, z0, z1, 30, 28, paint);
  // terminal mouth across the front, flanked by the two cephalic fins ("horns")
  for (const sx of [-1, 1]) {
    fin(g, (u) => V(sx * (0.1 + u * 0.06) * Lb, 0.06 * Lb, z1 - 0.02 * Lb), (u) => V(sx * 0.02 * Lb, -0.01 * Lb, 0.2 * Lb * (1 - u * 0.4)), (u, v) => (v > 0.8 ? top : mixc(top, belly, 0.15 * u)), 3, 4);
    eye(g, V(sx * 0.17 * Lb, 0.08 * Lb, z1 - 0.06 * Lb), 0.012 * Lb, rgb('#0b0c0d'));
  }
  root.add(meshOf(g, mat, 'body'));
  // the wings: broad triangles sweeping back to pointed tips, thick at the root
  for (const sx of [-1, 1]) {
    const at = V(sx * 0.22 * Lb, 0.06 * Lb, 0.05 * Lb);
    const wg = new Geo();
    const half = W / 2 - 0.22 * Lb;
    sheet(wg, 10, 6, (u, v) => {
      // u: root → tip; v: leading (0) → trailing (1) edge
      const chord = lerp(0.85 * Lb, 0.04 * Lb, Math.pow(u, 0.85));
      const lead = at.z + 0.3 * Lb - u * u * 0.55 * Lb;
      return V(at.x + sx * u * half, at.y + Math.sin(Math.PI * u) * 0.04 * Lb - u * 0.02 * Lb, lead - v * chord);
    }, (u, v) => mixc(top, rgb('#2c3134'), v * 0.4 + u * 0.1), 0.02 * Lb * 0.5);
    // the underside is white: a second, lower sheet facing down
    sheet(wg, 10, 6, (u, v) => {
      const chord = lerp(0.85 * Lb, 0.04 * Lb, Math.pow(u, 0.85));
      const lead = at.z + 0.3 * Lb - u * u * 0.55 * Lb;
      return V(at.x + sx * u * half, at.y + Math.sin(Math.PI * u) * 0.04 * Lb - u * 0.02 * Lb - 0.012 * Lb * (1 - u), lead - (1 - v) * chord);
    }, () => belly);
    rebase(wg, at);
    const piv = pivot(sx < 0 ? 'wingR' : 'wingL', at);
    piv.add(meshOf(wg, finMat, 'wing'));
    root.add(piv);
  }
  // short whip tail and small dorsal fin at its base
  const tg = new Geo();
  loftZ(tg, [{ t: 0, y: 0.06 * Lb, w: 0.006 * Lb, h: 0.006 * Lb }, { t: 1, y: 0.06 * Lb, w: 0.025 * Lb, h: 0.022 * Lb }], z0 - 0.5 * Lb, z0 + 0.02 * Lb, 8, 8, () => top);
  fin(tg, (u) => V(0, 0.09 * Lb, z0 + 0.03 * Lb - u * 0.08 * Lb), (u) => V(0, 0.06 * Lb * (1 - u), -0.03 * Lb), () => top, 3, 2);
  const tailAt = V(0, 0.06 * Lb, z0);
  rebase(tg, tailAt);
  const tail = pivot('tail', tailAt);
  tail.add(meshOf(tg, mat, 'tail'));
  root.add(tail);
}

/* ───────────── reef fish: tall, laterally compressed bodies ───────────── */
interface Reef {
  st: Station[]; z0: number; z1: number;
  paint: (t: number, a: number, p: THREE.Vector3) => RGB;
  dorsal: { t0: number; t1: number; h: (u: number) => number; color: (u: number, v: number) => RGB };
  anal: { t0: number; t1: number; h: (u: number) => number; color: (u: number, v: number) => RGB };
  caudal: { len: number; span: number; fork: number; color: (u: number, v: number) => RGB };
  pect: { at: number; len: number; color: (u: number, v: number) => RGB };
  eye: { t: number; up: number; r: number; iris: RGB };
}
function reef(root: THREE.Group, L: number, R: Reef, mat: THREE.Material, finMat: THREE.Material) {
  const g = new Geo();
  loftZ(g, R.st, R.z0, R.z1, 48, 24, R.paint);
  // top and bottom profile of the body at t, for rooting the fins on it
  const prof = (t: number) => {
    const k = R.st.slice().sort((a, b) => a.t - b.t);
    let i = 0; while (i < k.length - 2 && k[i + 1].t < t) i++;
    const f = Math.min(1, Math.max(0, (t - k[i].t) / (k[i + 1].t - k[i].t || 1)));
    const y = lerp(k[i].y, k[i + 1].y, f), h = lerp(k[i].h, k[i + 1].h, f), w = lerp(k[i].w, k[i + 1].w, f);
    return { y, h, w, z: lerp(R.z0, R.z1, t) };
  };
  const e = prof(R.eye.t);
  for (const sx of [-1, 1]) eye(g, V(sx * e.w * 0.82, e.y + e.h * R.eye.up, e.z), R.eye.r * L, R.eye.iris);
  root.add(meshOf(g, mat, 'body'));
  const fins = new Geo();
  const D = R.dorsal, A = R.anal;
  fin(fins, (u) => { const q = prof(lerp(D.t1, D.t0, u)); return V(0, q.y + q.h * 0.94, q.z); }, (u) => V(0, D.h(u) * L, -D.h(u) * L * 0.35), D.color, 14, 5);
  fin(fins, (u) => { const q = prof(lerp(A.t1, A.t0, u)); return V(0, q.y - q.h * 0.94, q.z); }, (u) => V(0, -A.h(u) * L, -A.h(u) * L * 0.35), A.color, 10, 5);
  // pelvic fins under the chest
  const pq = prof(R.pect.at - 0.04);
  for (const sx of [-1, 1]) fin(fins, (u) => V(sx * pq.w * 0.3, pq.y - pq.h * 0.85, pq.z + 0.02 * L - u * 0.04 * L), (u) => V(sx * 0.02 * L, -0.08 * L * (1 - u * 0.5), -0.06 * L), R.anal.color, 3, 3);
  root.add(meshOf(fins, finMat, 'fins'));
  // pectorals: flutter on pivots
  const q = prof(R.pect.at);
  for (const sx of [-1, 1]) {
    const at = V(sx * q.w * 0.9, q.y - q.h * 0.2, q.z);
    const pg = new Geo();
    fin(pg, (u) => at.clone().add(V(0, (0.5 - u) * 0.05 * L, 0)), (u) => V(sx * 0.03 * L, -0.01 * L, -R.pect.len * L * (0.7 + 0.3 * Math.sin(Math.PI * u))), R.pect.color, 5, 4);
    rebase(pg, at);
    const piv = pivot(sx < 0 ? 'flipperR' : 'flipperL', at);
    piv.add(meshOf(pg, finMat, 'pectoral'));
    root.add(piv);
  }
  // caudal fin on the tail pivot
  const c0 = prof(0);
  const tailAt = V(0, c0.y, R.z0 + 0.005 * L);
  const tg = new Geo();
  const C = R.caudal;
  fin(tg, (u) => V(0, c0.y + (u - 0.5) * c0.h * 1.6, R.z0 + 0.01 * L), (u) => {
    const x = 2 * u - 1;
    return V(0, x * C.span * L * 0.5, -C.len * L * (1 - C.fork * (1 - x * x)));
  }, C.color, 10, 5);
  rebase(tg, tailAt);
  const tail = pivot('tail', tailAt);
  tail.add(meshOf(tg, finMat, 'caudal'));
  root.add(tail);
}

function tang(root: THREE.Group, L: number, seed: number, mat: THREE.Material, finMat: THREE.Material) {
  const yellow = rgb('#f6d21a'), pale = rgb('#fbe25a'), white = rgb('#f7f6ef');
  const Y = 0.36 * L;
  const S = (t: number, w: number, h: number, dy = 0): Station => ({ t, y: Y + dy * L, w: w * L, h: h * L, e: 2.2 });
  // a tall disc from the peduncle to the pointed, protruding snout
  const st = [S(0, 0.022, 0.045), S(0.14, 0.04, 0.12), S(0.36, 0.068, 0.25), S(0.56, 0.072, 0.27, 0.01), S(0.76, 0.06, 0.21, 0.02), S(0.9, 0.035, 0.1, -0.01), S(1, 0.01, 0.025, -0.03)];
  reef(root, L, {
    st, z0: -0.32 * L, z1: 0.42 * L,
    paint: (t, a, p) => {
      // a white scalpel at the base of the tail; a faint pale lateral band
      if (t > 0.03 && t < 0.11 && Math.abs(p.y - Y) < 0.02 * L && Math.abs(Math.cos(a)) > 0.8) return white;
      const n = fbm3(p.x / L * 30, p.y / L * 30, p.z / L * 30, 2, seed);
      return mixc(yellow, pale, Math.max(0, 0.25 - Math.abs(Math.sin(a) + 0.15)) * 2 + (n - 0.5) * 0.15);
    },
    dorsal: { t0: 0.18, t1: 0.82, h: (u) => 0.13 * Math.sin(Math.PI * Math.min(1, u * 1.05)) ** 0.7, color: () => yellow },
    anal: { t0: 0.18, t1: 0.6, h: (u) => 0.12 * Math.sin(Math.PI * u) ** 0.7, color: () => yellow },
    caudal: { len: 0.16, span: 0.3, fork: 0.15, color: () => yellow },
    pect: { at: 0.72, len: 0.13, color: () => pale },
    eye: { t: 0.84, up: 0.25, r: 0.04, iris: rgb('#151313') },
  }, mat, finMat);
}

function clownfish(root: THREE.Group, L: number, _seed: number, mat: THREE.Material, finMat: THREE.Material) {
  const orange = rgb('#f2711c'), white = rgb('#fbfaf6'), black = rgb('#151413');
  const Y = 0.26 * L;
  const S = (t: number, w: number, h: number): Station => ({ t, y: Y, w: w * L, h: h * L, e: 2 });
  const st = [S(0, 0.035, 0.05), S(0.15, 0.06, 0.1), S(0.4, 0.1, 0.17), S(0.6, 0.11, 0.18), S(0.8, 0.095, 0.15), S(0.93, 0.06, 0.09), S(1, 0.02, 0.03)];
  // three white bands with thin black edges: behind the eye, mid-body (bulging forward) and at the tail
  const band = (t: number, a: number): RGB => {
    const sa = Math.sin(a);
    const bands = [{ c: 0.76, w: 0.055 }, { c: 0.47 + 0.05 * Math.max(0, sa), w: 0.05 }, { c: 0.1, w: 0.035 }];
    for (const b of bands) {
      const d = Math.abs(t - b.c);
      if (d < b.w) return white;
      if (d < b.w + 0.016) return black;
    }
    return orange;
  };
  const edge = (_u: number, v: number): RGB => (v > 0.82 ? black : v > 0.72 ? mixc(orange, black, (v - 0.72) * 10) : orange);
  reef(root, L, {
    st, z0: -0.36 * L, z1: 0.44 * L,
    paint: (t, a) => band(t, a),
    dorsal: { t0: 0.18, t1: 0.74, h: (u) => 0.09 * (0.6 + 0.4 * Math.sin(Math.PI * u)) * (u < 0.45 ? 1 : 0.85 + 0.15 * Math.cos((u - 0.45) * 7)), color: (u, v) => (Math.abs(u - 0.18) < 0.05 && v < 0.75 ? white : edge(u, v)) },
    anal: { t0: 0.18, t1: 0.42, h: (u) => 0.08 * Math.sin(Math.PI * u) ** 0.6, color: edge },
    caudal: { len: 0.15, span: 0.24, fork: -0.2, color: (_u, v) => (v > 0.84 ? black : orange) },
    pect: { at: 0.68, len: 0.12, color: () => orange },
    eye: { t: 0.85, up: 0.2, r: 0.05, iris: rgb('#e88a2a') },
  }, mat, finMat);
}

function lionfish(root: THREE.Group, L: number, seed: number, mat: THREE.Material, finMat: THREE.Material) {
  const maroon = rgb('#7c2b1d'), cream = rgb('#f1e5d2'), ray = rgb('#9a3a26');
  const Y = 0.2 * L;
  const S = (t: number, w: number, h: number): Station => ({ t, y: Y, w: w * L, h: h * L, e: 2.1 });
  const st = [S(0, 0.02, 0.035), S(0.15, 0.04, 0.07), S(0.4, 0.07, 0.11), S(0.62, 0.075, 0.12), S(0.82, 0.065, 0.1), S(0.95, 0.04, 0.06), S(1, 0.015, 0.025)];
  // vertical maroon bars of uneven width on cream, narrower toward the tail
  const bars = (t: number, p: THREE.Vector3): RGB => {
    const n = fbm3(p.x / L * 6, p.y / L * 6, p.z / L * 6, 2, seed) - 0.5;
    const ph = t * 11 + n * 0.8 + (p.y - Y) / L * 2;
    return Math.cos(ph * Math.PI * 2) > -0.1 ? maroon : cream;
  };
  const striped = (u: number, v: number): RGB => (Math.cos((v * 6 + u * 0.5) * Math.PI * 2) > 0.2 ? ray : cream);
  reef(root, L, {
    st, z0: -0.3 * L, z1: 0.36 * L,
    paint: (t, _a, p) => bars(t, p),
    dorsal: { t0: 0.2, t1: 0.85, h: (u) => (u > 0.35 ? 0.34 * (0.55 + 0.45 * Math.cos(u * 40)) : 0.1), color: striped },
    anal: { t0: 0.22, t1: 0.42, h: (u) => 0.08 * Math.sin(Math.PI * u), color: striped },
    caudal: { len: 0.13, span: 0.18, fork: -0.15, color: (_u, v) => (Math.cos(v * 7 * Math.PI * 2) > 0.3 ? ray : cream) },
    pect: { at: 0.66, len: 0.05, color: striped },
    eye: { t: 0.86, up: 0.35, r: 0.045, iris: rgb('#a8402a') },
  }, mat, finMat);
  // the long, fan-like pectoral fins: a wing of membrane spread from just behind the head, its rays
  // banded maroon and cream and standing out past a scalloped edge
  const q = { y: Y - 0.01 * L, z: lerp(-0.3 * L, 0.36 * L, 0.66) };
  const fins = new Geo();
  const rays = 11;
  for (const sx of [-1, 1]) {
    sheet(fins, rays * 4, 28, (u, v) => {
      const th = lerp(0.15, 2.5, u); // from up-and-back round to down-and-back
      const d = V(sx * 1.05, Math.cos(th) * 0.9, -0.7 - 0.25 * Math.sin(th)).normalize();
      const scallop = 1 - 0.22 * (1 - Math.abs(Math.cos(u * rays * Math.PI)));
      const len = 0.46 * L * (0.7 + 0.3 * Math.sin(Math.PI * u)) * (v < 0.7 ? 1 : lerp(1, scallop, (v - 0.7) / 0.3));
      return V(sx * 0.06 * L, q.y, q.z).addScaledVector(d, v * len);
    }, (u, v) => {
      const onRay = Math.abs(Math.cos(u * rays * Math.PI)) > 0.55;
      const band = Math.cos(v * 6.5 * Math.PI * 2) > -0.1;
      return onRay ? (band ? ray : cream) : mixc(band ? ray : cream, maroon, 0.25);
    });
  }
  root.add(meshOf(fins, finMat, 'pectoral-fans'));
}
