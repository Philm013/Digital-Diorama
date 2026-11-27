import * as THREE from 'three';
import type { ParamSpec } from '../modules';
import { Geo, V, blob, fbm3, lerp, loftZ, meshOf, mixc, rgb, sheet, sstep, sweep, vcMaterial, type RGB } from '../proc/kit';

/*
 * Marine animals the generic Wildform body plans could not represent:
 * a true seal (no dorsal fin, paired hind flippers), toothed and baleen whales
 * with horizontal flukes, the Portuguese man o' war's gas float and sail, and
 * the soft, "eared" sea hare. All face +Z, sit on y = 0 and carry named pivots
 * for the procedural idle / swim animation.
 */

const p0 = (schema: Record<string, ParamSpec>, p: Record<string, unknown>) =>
  ({ ...Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, v.default])), ...p }) as Record<string, any>;
const pivot = (name: string, at: THREE.Vector3) => { const g = new THREE.Group(); g.name = name; g.position.copy(at); return g; };
/** move geometry written since `mark` so it is relative to a pivot */
function rebase(geo: Geo, at: THREE.Vector3) { geo.transformFrom({ v: 0 }, new THREE.Matrix4().makeTranslation(-at.x, -at.y, -at.z)); }

/* =============================== harp seal =============================== */
export const SEAL_PARAMS: Record<string, ParamSpec> = {
  length: { type: 'range', default: 1.75, min: 1.2, max: 2.1, step: 0.05, unit: 'm', label: 'Length' },
  harp: { type: 'range', default: 1, min: 0, max: 1, step: 0.05, label: 'Harp marking', describe: 'Adults wear a dark horseshoe "harp" on the back; pups are white.' },
  coat: { type: 'color', default: '#c8cac3', label: 'Coat' },
  markings: { type: 'color', default: '#24272a', label: 'Face & harp' },
  seed: { type: 'range', default: 3, min: 1, max: 999, step: 1, label: 'Seed' },
};
/*
 * Digital Diorama revision 9: the seal was an egg twice as wide as a real one (0.9 m across a 1.75 m body) with its
 * face on the end of it. A harp seal is a spindle about a quarter as wide as it is long, widest at the chest, lying on
 * its belly with the neck and the small, round, dog-like head lifted; big dark eyes, a short broad muzzle with
 * whiskers, no ear flaps. Fore flippers short, clawed and held against the chest; the hind flippers trail as a pair of
 * fans whose outer toes are longest.
 */
export function createSeal(params: Record<string, unknown> = {}) {
  const P = p0(SEAL_PARAMS, params);
  const L = Number(P.length), seed = Number(P.seed);
  const coat = rgb(P.coat), dark = rgb(P.markings), belly = mixc(coat, rgb('#f2f1ea'), 0.6);
  const root = new THREE.Group();
  root.name = 'harp-seal';
  const mat = vcMaterial({ roughness: 0.55 });
  const S = (t: number, y: number, w: number, h: number, flat = 0.5) => ({ t, y: y * L, w: w * L, h: h * L, flat });
  const body = new Geo();
  const HEAD = 0.85;
  const paint = (t: number, a: number, p: THREE.Vector3): RGB => {
    const top = Math.sin(a), n = fbm3(p.x * 9, p.y * 9, p.z * 9, 3, seed);
    let c = mixc(belly, coat, sstep(-0.55, 0.1, top));
    // speckles
    if (n > 0.66) c = mixc(c, dark, 0.35);
    // black face from behind the eyes forward, paler under the chin
    if (t > HEAD + (n - 0.5) * 0.04) c = mixc(c, dark, sstep(HEAD, HEAD + 0.05, t) * (top > -0.4 ? 1 : 0.6));
    // the "harp": a dark horseshoe joined over the shoulders, arms running back along the upper flanks
    const ang = Math.abs(Math.atan2(Math.cos(a), Math.sin(a))); // 0 at the dorsal line
    // the arms leave the yoke high on the back and run down the flanks toward the hips, widening a little
    const lo = 0.3 + (0.64 - t) * 1.25 + (n - 0.5) * 0.15, hi = lo + 0.5 + (0.64 - t) * 0.35;
    const arm = sstep(0.14, 0.22, t) * (1 - sstep(0.62, 0.66, t)) * sstep(lo - 0.08, lo + 0.06, ang) * (1 - sstep(hi - 0.06, hi + 0.1, ang));
    const yoke = sstep(0.58, 0.62, t) * (1 - sstep(0.68, 0.72, t)) * (1 - sstep(0.75, 0.95, ang));
    if (P.harp > 0) c = mixc(c, dark, 0.9 * Number(P.harp) * Math.max(arm, yoke));
    return c;
  };
  // tail (t = 0) to nose (t = 1): the belly on the ground, chest the deepest, neck and head raised
  const st = [
    S(0, 0.05, 0.035, 0.03, 0.3), S(0.08, 0.055, 0.055, 0.05), S(0.2, 0.07, 0.09, 0.085), S(0.35, 0.082, 0.12, 0.11),
    S(0.5, 0.09, 0.13, 0.12), S(0.62, 0.096, 0.125, 0.118), S(0.72, 0.112, 0.1, 0.095), S(0.8, 0.142, 0.075, 0.074, 0.3),
    S(0.86, 0.168, 0.074, 0.071, 0.2), S(0.91, 0.178, 0.067, 0.063, 0.2), S(0.95, 0.176, 0.047, 0.045, 0.1), S(0.98, 0.171, 0.031, 0.03, 0), S(1, 0.167, 0.012, 0.013, 0),
  ];
  loftZ(body, st, -L * 0.5, L * 0.5, 56, 24, paint);
  // big dark eyes, nostrils and whiskers
  for (const sx of [-1, 1]) blob(body, V(sx * 0.055 * L, 0.205 * L, 0.41 * L), 0.016 * L, 0.017 * L, 0.013 * L, () => rgb('#0b0b0c'), { w: 8, h: 6 });
  for (const sx of [-1, 1]) blob(body, V(sx * 0.008 * L, 0.183 * L, 0.497 * L), 0.006 * L, 0.004 * L, 0.004 * L, () => rgb('#101010'), { w: 6, h: 4 });
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) {
    const a = V(sx * 0.024 * L, (0.17 - k * 0.004) * L, 0.48 * L);
    sweep(body, [a, a.clone().add(V(sx * 0.1 * L, (0.01 - k * 0.01) * L, -0.03 * L))], (t) => 0.0016 * L * (1 - t * 0.7), { sides: 3, color: () => rgb('#e8e2d2') });
  }
  root.add(meshOf(body, mat, 'body'));
  // fore flippers: short clawed paddles under the chest, lying back along the flanks
  for (const sx of [-1, 1]) {
    const at = V(sx * 0.1 * L, 0.05 * L, 0.2 * L);
    const fg = new Geo();
    sheet(fg, 6, 3, (u, v) => V(at.x + sx * (0.025 + u * 0.03) * L, at.y - u * 0.035 * L, at.z - u * 0.12 * L + (v - 0.5) * (0.06 - u * 0.025) * L), (u) => mixc(coat, dark, 0.2 + u * 0.6), 0.012 * L);
    for (let k = 0; k < 4; k++) sweep(fg, [V(at.x + sx * 0.055 * L, at.y - 0.035 * L, at.z - (0.105 + 0.006 * (k - 1.5)) * L + (k - 1.5) * 0.008 * L), V(at.x + sx * 0.058 * L, at.y - 0.038 * L, at.z - 0.13 * L + (k - 1.5) * 0.008 * L)], (t) => 0.002 * L * (1 - t), { sides: 3, color: () => rgb('#2a2622') });
    rebase(fg, at);
    const piv = pivot(sx < 0 ? 'flipperR' : 'flipperL', at);
    piv.add(meshOf(fg, mat, 'fore-flipper'));
    root.add(piv);
  }
  // hind flippers: a pair of fans trailing behind, palms together, the outer toes longest (a concave trailing edge)
  const hipAt = V(0, 0.05 * L, -0.48 * L);
  const hg = new Geo();
  for (const sx of [-1, 1]) {
    sheet(hg, 7, 5, (u, v) => {
      const spread = (v - 0.5) * (0.045 + u * 0.11) * L, toe = 0.03 * L * u * (Math.abs(v - 0.5) * 2) ** 1.5;
      return V(sx * (0.022 * L + u * 0.012 * L), hipAt.y + spread * 0.9 + u * 0.012 * L, hipAt.z - u * 0.19 * L - toe);
    }, (u, v) => mixc(coat, dark, 0.35 + 0.4 * u + (Math.abs(v - 0.5) < 0.08 ? 0.1 : 0)), 0.012 * L);
  }
  rebase(hg, hipAt);
  const tail = pivot('tail', hipAt);
  tail.add(meshOf(hg, mat, 'hind-flippers'));
  root.add(tail);
  return root;
}
export const SEAL_RIG = {
  tail: { axis: 'y', range: [-12, 12], speed: 1.1 },
  flipperL: { axis: 'z', range: [-8, 14], speed: 0.8 },
  flipperR: { axis: 'z', range: [8, -14], speed: 0.8, phase: 1.2 },
};

/* =============================== whales & dolphins =============================== */
/*
 * Digital Diorama revision 9: bodies from real proportions. The dolphin was a football 0.78 m deep on a 2.6 m body (a
 * real one is about 0.47 m) with no forehead; the humpback a fat cigar with a pointed nose. Now: tail stocks that are
 * tall and narrow (keeled) behind a spindle body; the dolphin's rounded melon dropping at a crease to its short beak;
 * the humpback's broad, flat-topped, knobbly rostrum, deep pleated throat and long white flippers; falcate dorsal fins
 * and swept, notched flukes. Stations: t from the fluke insertion (0) to the snout (1); y, w, h as fractions of L.
 */
type CetKind = 'dolphin' | 'orca' | 'humpback';
const CETACEANS: Record<CetKind, { L: number; back: string; flank: string; belly: string; fin: number; finAt: number; finChord: number; finSweep: number; flipper: number; flipperAt: number; flukes: number; eyeT: number }> = {
  dolphin: { L: 2.6, back: '#5c6d76', flank: '#8fa3ab', belly: '#e6e4de', fin: 0.095, finAt: 0.5, finChord: 0.15, finSweep: 0.09, flipper: 0.15, flipperAt: 0.73, flukes: 0.25, eyeT: 0.888 },
  orca: { L: 7, back: '#121416', flank: '#16191b', belly: '#f2f1ec', fin: 0.2, finAt: 0.52, finChord: 0.13, finSweep: 0.02, flipper: 0.16, flipperAt: 0.74, flukes: 0.26, eyeT: 0.9 },
  humpback: { L: 13.5, back: '#262e33', flank: '#3a4449', belly: '#d9dcd8', fin: 0.03, finAt: 0.34, finChord: 0.07, finSweep: 0.03, flipper: 0.31, flipperAt: 0.68, flukes: 0.33, eyeT: 0.79 },
};
export const CETACEAN_PARAMS: Record<string, ParamSpec> = {
  kind: { type: 'choice', default: 'dolphin', options: Object.keys(CETACEANS), label: 'Species' },
  size: { type: 'range', default: 1, min: 0.6, max: 1.3, step: 0.01, label: 'Size' },
  seed: { type: 'range', default: 5, min: 1, max: 999, step: 1, label: 'Seed' },
};
export function createCetacean(params: Record<string, unknown> = {}) {
  const P = p0(CETACEAN_PARAMS, params);
  const kind = (P.kind in CETACEANS ? P.kind : 'dolphin') as CetKind;
  const D = CETACEANS[kind];
  const L = D.L * Number(P.size), seed = Number(P.seed);
  const back = rgb(D.back), flank = rgb(D.flank), belly = rgb(D.belly), white = rgb('#f1f0ea'), grey = rgb('#9aa1a3');
  const root = new THREE.Group();
  root.name = kind;
  const mat = vcMaterial({ roughness: kind === 'humpback' ? 0.7 : 0.42 });
  const S = (t: number, y: number, w: number, h: number, e = 2, flat = 0) => ({ t, y: y * L, w: w * L, h: h * L, e, flat });
  const st = kind === 'dolphin'
    ? [S(0, 0.1, 0.007, 0.02, 1.6), S(0.06, 0.1, 0.012, 0.032, 1.6), S(0.16, 0.1, 0.022, 0.048, 1.8), S(0.3, 0.1, 0.042, 0.068), S(0.45, 0.1, 0.065, 0.085), S(0.6, 0.1, 0.08, 0.094),
      S(0.72, 0.099, 0.078, 0.088), S(0.82, 0.099, 0.066, 0.074), S(0.89, 0.103, 0.052, 0.061), S(0.93, 0.101, 0.037, 0.045), S(0.952, 0.094, 0.022, 0.022), S(0.975, 0.092, 0.017, 0.016), S(1, 0.091, 0.009, 0.009)]
    : kind === 'orca'
      ? [S(0, 0.1, 0.01, 0.026, 1.6), S(0.07, 0.1, 0.018, 0.045, 1.7), S(0.18, 0.1, 0.036, 0.068, 1.9), S(0.32, 0.1, 0.065, 0.09), S(0.5, 0.1, 0.085, 0.1), S(0.66, 0.1, 0.088, 0.098),
        S(0.8, 0.099, 0.078, 0.084), S(0.9, 0.097, 0.058, 0.062), S(0.96, 0.094, 0.036, 0.038), S(1, 0.09, 0.012, 0.014)]
      : [S(0, 0.08, 0.008, 0.02, 1.6), S(0.06, 0.083, 0.016, 0.036, 1.6), S(0.16, 0.088, 0.034, 0.058, 1.8), S(0.3, 0.095, 0.066, 0.08), S(0.45, 0.1, 0.09, 0.094), S(0.6, 0.1, 0.1, 0.1),
        S(0.7, 0.098, 0.102, 0.1), S(0.8, 0.094, 0.098, 0.09, 2.3), S(0.88, 0.088, 0.09, 0.076, 2.5), S(0.94, 0.082, 0.074, 0.058, 2.6), S(0.98, 0.077, 0.052, 0.038, 2.4), S(1, 0.074, 0.028, 0.02)];
  // the station values at t (for placing the eyes, fins and flippers on the surface)
  const at = (t: number, key: 'y' | 'w' | 'h') => { let k = 0; while (k < st.length - 2 && st[k + 1].t < t) k++; const a = st[k], b = st[k + 1]; return lerp(a[key], b[key], clamp01((t - a.t) / (b.t - a.t))); };
  const geo = new Geo();
  const paint = (t: number, a: number, p: THREE.Vector3): RGB => {
    const top = Math.sin(a), n = fbm3(p.x * 6 / L * 3, p.y * 6 / L * 3, p.z * 6 / L * 3, 3, seed);
    if (kind === 'orca') {
      let c = back;
      // white belly lobe and flank flash
      if (top < -0.35 + (t > 0.25 && t < 0.42 ? 0.55 : 0) * sstep(0.2, 0.3, t) * (1 - sstep(0.4, 0.46, t))) c = belly;
      // white eye patch above and behind the eye
      const eye = Math.hypot((t - 0.86) * 5, (top - 0.05) * 1.6);
      if (eye < 0.32 && Math.abs(Math.cos(a)) > 0.45) c = white;
      // grey saddle behind the dorsal fin
      if (t > 0.38 && t < 0.48 && top > 0.82) c = mixc(back, grey, 0.75);
      return c;
    }
    let c = mixc(belly, flank, sstep(-0.6, -0.1, top));
    // the dark cape: a band down the back, dipping lower behind the dorsal fin
    c = mixc(c, back, sstep(0.1 + (n - 0.5) * 0.4 - (kind === 'dolphin' ? 0.25 * Math.max(0, Math.sin(Math.PI * (t - 0.15) / 0.5)) : 0), 0.55, top));
    if (kind === 'humpback') {
      // throat pleats from the chin to the navel
      if (t > 0.5 && top < -0.35 && Math.sin(a * 46) > 0.55) c = mixc(c, rgb('#9ea6a6'), 0.7);
      if (n > 0.66 && top < -0.1) c = mixc(c, white, 0.4);
    } else {
      if (top < -0.2) c = mixc(c, rgb('#efd9d3'), 0.2);
      // the mouth line: from the tip of the beak back to below the eye, curving up a little (the "smile")
      const ml = -0.05 + 0.3 * sstep(0.9, 0.96, t);
      if (t > 0.885 && t < 0.998 && Math.abs(Math.cos(a)) > 0.3 && Math.abs(top + ml) < 0.05) c = mixc(c, rgb('#2d3438'), 0.8);
    }
    return c;
  };
  // the humpback's flat-topped rostrum with rows of knobs (tubercles) on it and on the lower jaw
  const bump = kind === 'humpback'
    ? (t: number, a: number) => -0.16 * sstep(0.82, 0.97, t) * Math.max(0, Math.sin(a)) ** 2 + (t > 0.86 && Math.abs(Math.cos(a)) < 0.85 && Math.sin(t * 160) > 0.82 && Math.cos(a * 7) > 0.4 ? 0.03 : 0)
    : kind === 'dolphin'
      // the melon: the forehead bulges forward over the beak
      ? (t: number, a: number) => 0.14 * Math.exp(-(((t - 0.925) / 0.018) ** 2)) * Math.max(0, Math.sin(a))
      : undefined;
  loftZ(geo, st, -L / 2, L / 2, kind === 'humpback' ? 64 : 60, 24, paint, bump);
  // eyes: just behind and above the corner of the mouth
  for (const sx of [-1, 1]) {
    const ey = at(D.eyeT, 'y') - 0.15 * at(D.eyeT, 'h'), ex = sx * at(D.eyeT, 'w') * 0.93;
    blob(geo, V(ex, ey, (D.eyeT - 0.5) * L), 0.008 * L, 0.007 * L, 0.006 * L, () => rgb('#08090a'), { w: 6, h: 5 });
  }
  // blowhole(s)
  const bhT = kind === 'humpback' ? 0.84 : 0.875;
  for (const sx of kind === 'humpback' ? [-1, 1] : [0]) blob(geo, V(sx * 0.008 * L, at(bhT, 'y') + at(bhT, 'h') * 0.97, (bhT - 0.5) * L), 0.006 * L, 0.003 * L, 0.004 * L, () => rgb('#1a1d1f'), { w: 6, h: 4 });
  // dorsal fin: a falcate blade, convex in front, concave behind, its tip swept back
  {
    const fz = (D.finAt - 0.5) * L, fy = at(D.finAt, 'y') + at(D.finAt, 'h') * 0.9, H = D.fin * L, C = D.finChord * L, Sw = D.finSweep * L;
    sheet(geo, 8, 4, (u, v) => {
      const zl = lerp(fz + C / 2, fz - Sw, Math.pow(u, 1.5)), zt = lerp(fz - C / 2, fz - Sw, u) + 0.22 * C * Math.sin(Math.PI * u) * (1 - u * 0.3);
      return V(0, fy + u * H * (1 - 0.12 * (v - 0.5) ** 2), lerp(zl, zt, v));
    }, () => back, 0.01 * L);
  }
  root.add(meshOf(geo, mat, 'body'));
  // pectoral flippers: low on the sides behind the head, angled down and back
  for (const sx of [-1, 1]) {
    const ft = D.flipperAt, fat = V(sx * at(ft, 'w') * 0.8, at(ft, 'y') - at(ft, 'h') * 0.55, (ft - 0.5) * L);
    const fg = new Geo();
    const len = D.flipper * L, hump = kind === 'humpback';
    sheet(fg, hump ? 12 : 8, 3, (u, v) => {
      const chord = (hump ? 0.07 : kind === 'orca' ? 0.09 : 0.065) * L * (1 - u * (kind === 'orca' ? 0.25 : 0.7)) * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.15)));
      const knob = hump && v < 0.2 ? 0.006 * L * Math.max(0, Math.sin(u * 38)) : 0;
      const drop = hump ? 0.22 : 0.5, out = hump ? 0.85 : 0.78, bk = hump ? 0.45 : 0.38;
      return V(fat.x + sx * u * len * out, fat.y - u * len * drop, fat.z - u * len * bk + (v - 0.5) * chord + knob);
    }, (u, v) => hump ? mixc(white, grey, (1 - v) * 0.3 + u * 0.1) : kind === 'orca' ? back : mixc(flank, back, u * 0.5), 0.008 * L);
    rebase(fg, fat);
    const piv = pivot(sx < 0 ? 'flipperR' : 'flipperL', fat);
    piv.add(meshOf(fg, mat, 'flipper'));
    root.add(piv);
  }
  // flukes: two swept lobes with a median notch, the trailing edge concave toward the tips (serrated on a humpback)
  const flukeAt = V(0, st[0].y, -L / 2 + 0.005 * L);
  const fk = new Geo();
  const span = D.flukes * L;
  for (const sx of [-1, 1]) {
    sheet(fk, 10, 4, (u, v) => {
      const zl = flukeAt.z - span * 0.3 * Math.pow(u, 1.5);
      const chord = span * (kind === 'humpback' ? 0.26 : 0.3) * (1 - 0.85 * Math.pow(u, 1.3));
      const notch = span * 0.05 * (1 - sstep(0, 0.12, u));
      const serr = kind === 'humpback' && v > 0.85 ? Math.max(0, Math.sin(u * 30)) * 0.01 * L : 0;
      return V(sx * u * span * 0.5, flukeAt.y + u * u * 0.008 * L, lerp(zl, zl - chord + notch, v) - serr);
    }, (_u, v) => kind === 'humpback' ? mixc(back, white, v > 0.5 ? 0.25 : 0) : back, 0.009 * L);
  }
  rebase(fk, flukeAt);
  const tail = pivot('tail', flukeAt);
  tail.add(meshOf(fk, mat, 'flukes'));
  root.add(tail);
  return root;
}
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const CETACEAN_RIG = {
  tail: { axis: 'x', range: [-11, 11], speed: 0.9 },
  flipperL: { axis: 'z', range: [-6, 6], speed: 0.6 },
  flipperR: { axis: 'z', range: [6, -6], speed: 0.6 },
};

/* =============================== Portuguese man o' war =============================== */
export const MANOWAR_PARAMS: Record<string, ParamSpec> = {
  floatLength: { type: 'range', default: 0.26, min: 0.1, max: 0.3, step: 0.01, unit: 'm', label: 'Float length' },
  tentacleLength: { type: 'range', default: 0.6, min: 0.3, max: 2, step: 0.05, unit: 'm', label: 'Tentacle length (shown)', describe: 'Real tentacles can trail 10 m or more.' },
  tentacles: { type: 'range', default: 12, min: 4, max: 24, step: 1, label: 'Fishing tentacles' },
  seed: { type: 'range', default: 7, min: 1, max: 999, step: 1, label: 'Seed' },
};
export function createManOWar(params: Record<string, unknown> = {}) {
  const P = p0(MANOWAR_PARAMS, params);
  const F = Number(P.floatLength), T = Number(P.tentacleLength);
  let s = Number(P.seed) * 9301 + 49297;
  const R = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const root = new THREE.Group();
  root.name = 'man-o-war';
  // gas float: a lopsided translucent balloon, blue below shading to violet-pink at the crest
  const fl = new Geo();
  blob(fl, V(0, F * 0.22, 0), F * 0.27, F * 0.25, F * 0.5, (n) => mixc(rgb('#7fb4e6'), rgb('#c79ae0'), sstep(-0.3, 0.8, n.y)), {
    w: 18, h: 12, bump: (n) => 0.1 * Math.max(0, n.z) * (1 - Math.abs(n.y)) - 0.12 * Math.max(0, -n.z) * Math.max(0, n.y),
  });
  const floatMat = vcMaterial({ roughness: 0.15, transparent: true, opacity: 0.72, emissive: '#6c58c8', emissiveIntensity: 0.12, side: THREE.DoubleSide });
  root.add(meshOf(fl, floatMat, 'float', false));
  // the crest ("sail"), ruffled, with a magenta edge
  const sail = new Geo();
  sheet(sail, 16, 3, (u, v) => {
    const z = lerp(-F * 0.42, F * 0.36, u), hh = Math.sin(Math.PI * u) ** 0.7 * F * 0.3;
    return V(Math.sin(u * 22) * F * 0.025 * v, F * 0.42 + v * hh, z);
  }, (_u, v) => mixc(rgb('#a8c8f0'), rgb('#e46fb1'), v * v), 0.002);
  root.add(meshOf(sail, floatMat, 'sail', false));
  // polyps hanging under the float, then long beaded fishing tentacles
  const t = new Geo();
  const blue = rgb('#3c4fb8'), violet = rgb('#7a4cc0'), pink = rgb('#e08cc0');
  for (let k = 0; k < 46; k++) {
    const z = (R() - 0.5) * F * 0.7, x = (R() - 0.5) * F * 0.3;
    const len = F * (0.12 + R() * 0.3);
    const a = V(x, F * 0.06, z);
    sweep(t, [a, a.clone().add(V((R() - 0.5) * F * 0.08, -len * 0.6, (R() - 0.5) * F * 0.08)), a.clone().add(V((R() - 0.5) * F * 0.12, -len, (R() - 0.5) * F * 0.1))],
      (u) => F * 0.02 * (1 - u * 0.6), { sides: 5, color: (u) => mixc(R() > 0.6 ? pink : violet, blue, u) });
  }
  const n = Math.round(Number(P.tentacles));
  for (let k = 0; k < n; k++) {
    const z = (R() - 0.3) * F * 0.5, x = (R() - 0.5) * F * 0.2;
    const len = T * (0.55 + R() * 0.45);
    const pts: THREE.Vector3[] = [];
    const ph = R() * 6;
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      pts.push(V(x + Math.sin(u * 7 + ph) * 0.03 * u, -u * len * 0.85, z + Math.cos(u * 5 + ph) * 0.04 * u - u * u * 0.45 * len));
    }
    sweep(t, pts, (u) => 0.004 * (1 - u * 0.5) * (1 + 0.6 * Math.max(0, Math.sin(u * 60))), { sides: 4, color: (u) => mixc(blue, rgb('#6fa8e8'), Math.max(0, Math.sin(u * 60))) });
  }
  const tg = pivot('tentacles', V(0, 0, 0));
  tg.add(meshOf(t, vcMaterial({ roughness: 0.4, emissive: '#2b2a8a', emissiveIntensity: 0.15 }), 'tentacles', false));
  root.add(tg);
  // the float rides on the surface (y = 0); polyps and tentacles hang below
  return root;
}
export const MANOWAR_RIG = { tentacles: { axis: 'z', range: [-4, 4], speed: 0.5 } };

/* =============================== sea hare =============================== */
export const SEAHARE_PARAMS: Record<string, ParamSpec> = {
  length: { type: 'range', default: 0.3, min: 0.1, max: 0.45, step: 0.01, unit: 'm', label: 'Length' },
  skin: { type: 'color', default: '#7b4c3a', label: 'Skin' },
  mottling: { type: 'color', default: '#bd9478', label: 'Mottling' },
  seed: { type: 'range', default: 11, min: 1, max: 999, step: 1, label: 'Seed' },
};
export function createSeaHare(params: Record<string, unknown> = {}) {
  const P = p0(SEAHARE_PARAMS, params);
  const L = Number(P.length), seed = Number(P.seed);
  const skin = rgb(P.skin), mott = rgb(P.mottling), dark = shadeOf(skin, 0.55);
  const paint = (_t: number, _a: number, p: THREE.Vector3): RGB => {
    const n = fbm3(p.x / L * 9, p.y / L * 9, p.z / L * 9, 4, seed);
    let c = mixc(skin, mott, sstep(0.55, 0.72, n));
    if (Math.abs(n - 0.48) < 0.015) c = dark; // fine dark network
    return c;
  };
  const g = new Geo();
  const S = (t: number, y: number, w: number, h: number) => ({ t, y: y * L, w: w * L, h: h * L, flat: 1 });
  loftZ(g, [S(0, 0.02, 0.012, 0.012), S(0.14, 0.04, 0.06, 0.045), S(0.38, 0.09, 0.13, 0.1), S(0.6, 0.1, 0.13, 0.11), S(0.78, 0.075, 0.08, 0.07), S(0.9, 0.055, 0.06, 0.05), S(1, 0.04, 0.035, 0.03)], -L / 2, L / 2, 26, 16, paint);
  // parapodia: two wavy flaps folded up over the back, leaving a slit on top
  for (const sx of [-1, 1]) sheet(g, 14, 4, (u, v) => {
    const z = lerp(-0.25, 0.2, u) * L, rise = Math.sin(Math.PI * u) ** 0.8;
    const wave = Math.sin(u * 20) * 0.012 * L * v;
    return V(sx * (0.125 * L * (0.35 + 0.65 * rise) * (1 - v * 0.72) + wave), 0.15 * L + v * 0.11 * L * rise, z);
  }, (u, v) => paint(u, v, V(u * L, v * L, 0.3 * L)), 0.005 * L);
  // rhinophores ("ears") and oral tentacles
  for (const sx of [-1, 1]) {
    const a = V(sx * 0.03 * L, 0.085 * L, 0.36 * L);
    sweep(g, [a, a.clone().add(V(sx * 0.02 * L, 0.06 * L, -0.01 * L)), a.clone().add(V(sx * 0.03 * L, 0.1 * L, -0.03 * L))], (u) => 0.016 * L * (1 - u * 0.55), { sides: 7, color: (u) => mixc(skin, mott, u * 0.6), radial: (_u, aa) => (Math.cos(aa) > 0.6 ? 0.55 : 1) });
    sheet(g, 5, 2, (u, v) => V(sx * (0.02 + u * 0.07) * L, 0.035 * L - u * 0.02 * L, (0.47 + u * 0.03) * L - v * 0.04 * L), () => mixc(skin, mott, 0.3), 0.003 * L);
  }
  for (const sx of [-1, 1]) blob(g, V(sx * 0.032 * L, 0.07 * L, 0.4 * L), 0.006 * L, 0.006 * L, 0.006 * L, () => rgb('#120c0a'));
  const root = new THREE.Group();
  root.name = 'sea-hare';
  root.add(meshOf(g, vcMaterial({ roughness: 0.5 }), 'body'));
  return root;
}
function shadeOf(c: RGB, k: number): RGB { return [c[0] * k, c[1] * k, c[2] * k]; }
