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
export function createSeal(params: Record<string, unknown> = {}) {
  const P = p0(SEAL_PARAMS, params);
  const L = Number(P.length), seed = Number(P.seed);
  const coat = rgb(P.coat), dark = rgb(P.markings), belly = mixc(coat, rgb('#f2f1ea'), 0.6);
  const root = new THREE.Group();
  root.name = 'harp-seal';
  const mat = vcMaterial({ roughness: 0.55 });
  const S = (t: number, y: number, w: number, h: number, flat = 0.5) => ({ t, y: y * L, w: w * L, h: h * L, flat });
  const body = new Geo();
  const paint = (t: number, a: number, p: THREE.Vector3): RGB => {
    const top = Math.sin(a), n = fbm3(p.x * 9, p.y * 9, p.z * 9, 3, seed);
    let c = mixc(belly, coat, sstep(-0.55, 0.1, top));
    // speckles
    if (n > 0.66) c = mixc(c, dark, 0.35);
    // black face from the eyes forward
    if (t > 0.8 + (n - 0.5) * 0.04) c = mixc(c, dark, sstep(0.8, 0.86, t) * (top > -0.4 ? 1 : 0.6));
    // the "harp": a dark horseshoe joined over the shoulders, arms running back along the upper flanks
    // (Digital Diorama revision 8: soft edges, so it reads as a horseshoe rather than a blocky belt across the back)
    const ang = Math.abs(Math.atan2(Math.cos(a), Math.sin(a))); // 0 at the dorsal line
    const lo = 0.55 + (t - 0.4) * 0.4, hi = 1.25 + (n - 0.5) * 0.3;
    const arm = sstep(0.2, 0.28, t) * (1 - sstep(0.58, 0.64, t)) * sstep(lo - 0.12, lo + 0.06, ang) * (1 - sstep(hi - 0.06, hi + 0.12, ang));
    const yoke = sstep(0.54, 0.58, t) * (1 - sstep(0.62, 0.66, t)) * (1 - sstep(1.05, 1.25, ang));
    if (P.harp > 0) c = mixc(c, dark, 0.9 * Number(P.harp) * Math.max(arm, yoke));
    return c;
  };
  loftZ(body, [
    S(0, 0.17, 0.035, 0.03), S(0.08, 0.18, 0.1, 0.09), S(0.28, 0.21, 0.2, 0.18), S(0.45, 0.24, 0.255, 0.225),
    S(0.6, 0.255, 0.24, 0.225), S(0.72, 0.27, 0.17, 0.17), S(0.79, 0.3, 0.12, 0.125), S(0.86, 0.32, 0.115, 0.11),
    S(0.93, 0.315, 0.075, 0.07, 0.2), S(1, 0.305, 0.03, 0.035, 0),
  ], -L * 0.5, L * 0.5, 46, 24, paint);
  // eyes and nose
  for (const sx of [-1, 1]) blob(body, V(sx * 0.072 * L, 0.355 * L, 0.36 * L), 0.022 * L, 0.024 * L, 0.02 * L, () => rgb('#0b0b0c'), { w: 8, h: 6 });
  blob(body, V(0, 0.315 * L, 0.497 * L), 0.022 * L, 0.016 * L, 0.012 * L, () => rgb('#151414'));
  // whiskers
  for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) {
    const a = V(sx * 0.035 * L, (0.305 - k * 0.006) * L, 0.47 * L);
    sweep(body, [a, a.clone().add(V(sx * 0.11 * L, (0.01 - k * 0.012) * L, -0.02 * L))], (t) => 0.0018 * L * (1 - t * 0.7), { sides: 3, color: () => rgb('#e8e2d2') });
  }
  root.add(meshOf(body, mat, 'body'));
  // fore flippers (Digital Diorama revision 8: held back along the flanks, as a resting seal holds them; they reached
  // straight down to the ground and read as a pair of stilts)
  for (const sx of [-1, 1]) {
    const at = V(sx * 0.2 * L, 0.13 * L, 0.2 * L);
    const fg = new Geo();
    sheet(fg, 6, 3, (u, v) => V(at.x + sx * (0.02 + u * 0.035) * L, at.y - u * 0.07 * L, at.z - u * 0.13 * L + (v - 0.5) * (0.07 - u * 0.02) * L), (u) => mixc(coat, dark, u * 0.7), 0.012 * L);
    rebase(fg, at);
    const piv = pivot(sx < 0 ? 'flipperR' : 'flipperL', at);
    piv.add(meshOf(fg, mat, 'fore-flipper'));
    root.add(piv);
  }
  // hind flippers held together behind the body, palms facing each other
  const hipAt = V(0, 0.17 * L, -0.48 * L);
  const hg = new Geo();
  for (const sx of [-1, 1]) {
    sheet(hg, 6, 5, (u, v) => {
      const spread = (v - 0.5) * (0.05 + u * 0.13) * L;
      return V(sx * (0.025 * L + u * 0.02 * L), hipAt.y + spread * 0.9 + u * 0.01 * L, hipAt.z - u * 0.3 * L - Math.abs(v - 0.5) * u * 0.06 * L);
    }, (u, v) => mixc(coat, dark, 0.35 + 0.4 * u + (Math.abs(v - 0.5) < 0.08 ? 0.1 : 0)), 0.015 * L);
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
const CETACEANS = {
  dolphin: { L: 2.6, back: '#5c6d76', flank: '#93a6ae', belly: '#e6e4de', fin: 0.11, finAt: 0.5, finSweep: 0.75, flipper: 0.15, flukes: 0.24 },
  orca: { L: 7, back: '#121416', flank: '#16191b', belly: '#f2f1ec', fin: 0.24, finAt: 0.52, finSweep: 0.15, flipper: 0.16, flukes: 0.26 },
  humpback: { L: 13.5, back: '#262e33', flank: '#3a4449', belly: '#d9dcd8', fin: 0.035, finAt: 0.34, finSweep: 0.5, flipper: 0.31, flukes: 0.33 },
} as const;
export const CETACEAN_PARAMS: Record<string, ParamSpec> = {
  kind: { type: 'choice', default: 'dolphin', options: Object.keys(CETACEANS), label: 'Species' },
  size: { type: 'range', default: 1, min: 0.6, max: 1.3, step: 0.01, label: 'Size' },
  seed: { type: 'range', default: 5, min: 1, max: 999, step: 1, label: 'Seed' },
};
export function createCetacean(params: Record<string, unknown> = {}) {
  const P = p0(CETACEAN_PARAMS, params);
  const kind = (P.kind in CETACEANS ? P.kind : 'dolphin') as keyof typeof CETACEANS;
  const D = CETACEANS[kind];
  const L = D.L * Number(P.size), seed = Number(P.seed);
  const back = rgb(D.back), flank = rgb(D.flank), belly = rgb(D.belly), white = rgb('#f1f0ea'), grey = rgb('#9aa1a3');
  const root = new THREE.Group();
  root.name = kind;
  const mat = vcMaterial({ roughness: kind === 'humpback' ? 0.7 : 0.42 });
  const S = (t: number, y: number, w: number, h: number, e = 2) => ({ t, y: y * L, w: w * L, h: h * L, e });
  const st = kind === 'dolphin'
    ? [S(0, 0.1, 0.012, 0.03), S(0.12, 0.1, 0.035, 0.07), S(0.3, 0.11, 0.1, 0.14), S(0.5, 0.115, 0.12, 0.15), S(0.68, 0.11, 0.105, 0.13), S(0.8, 0.105, 0.08, 0.1), S(0.88, 0.11, 0.06, 0.075), S(0.91, 0.095, 0.035, 0.035), S(1, 0.09, 0.016, 0.016)]
    : kind === 'orca'
      ? [S(0, 0.1, 0.014, 0.034), S(0.12, 0.1, 0.045, 0.08), S(0.3, 0.11, 0.11, 0.15), S(0.52, 0.12, 0.13, 0.16), S(0.7, 0.115, 0.12, 0.14), S(0.85, 0.105, 0.09, 0.105), S(0.95, 0.1, 0.055, 0.06), S(1, 0.095, 0.02, 0.025)]
      : [S(0, 0.09, 0.012, 0.025), S(0.1, 0.09, 0.03, 0.06), S(0.28, 0.1, 0.085, 0.105), S(0.48, 0.11, 0.12, 0.13), S(0.64, 0.11, 0.125, 0.13), S(0.78, 0.1, 0.11, 0.1), S(0.9, 0.085, 0.075, 0.065), S(1, 0.075, 0.03, 0.025)];
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
    c = mixc(c, back, sstep(0.1 + (n - 0.5) * 0.4, 0.55, top));
    if (kind === 'humpback') {
      // throat pleats on the underside of the head and chest
      if (t > 0.55 && top < -0.35 && Math.sin(a * 46) > 0.55) c = mixc(c, rgb('#9ea6a6'), 0.7);
      if (n > 0.66 && top < -0.1) c = mixc(c, white, 0.4);
    } else if (top < -0.2) c = mixc(c, rgb('#efd9d3'), 0.2);
    return c;
  };
  const bump = kind === 'humpback' ? (t: number, a: number) => (t > 0.84 && Math.sin(a) > 0.2 && Math.sin(t * 160) > 0.82 && Math.cos(a * 5) > 0.3 ? 0.035 : 0) : undefined;
  loftZ(geo, st, -L / 2, L / 2, kind === 'humpback' ? 48 : 36, 20, paint, bump);
  // eyes
  const eyeT = kind === 'humpback' ? 0.82 : kind === 'orca' ? 0.87 : 0.87;
  for (const sx of [-1, 1]) blob(geo, V(sx * (kind === 'humpback' ? 0.1 : kind === 'orca' ? 0.085 : 0.07) * L, (kind === 'humpback' ? 0.085 : 0.11) * L, (eyeT - 0.5) * L), 0.008 * L, 0.008 * L, 0.006 * L, () => rgb('#08090a'), { w: 6, h: 5 });
  // dorsal fin: falcate sheet (a hump plus small fin on a humpback)
  const finZ = (D.finAt - 0.5) * L, finY = (kind === 'dolphin' ? 0.255 : kind === 'orca' ? 0.27 : 0.235) * L;
  sheet(geo, 6, 4, (u, v) => {
    const base = (1 - u) * (kind === 'orca' ? 0.09 : 0.12) * L;
    const zz = finZ + (v - 0.5) * base - u * u * D.finSweep * D.fin * L;
    return V(0, finY - 0.01 * L + u * D.fin * L, zz);
  }, (u) => mixc(back, back, u), 0.012 * L);
  root.add(meshOf(geo, mat, 'body'));
  // pectoral flippers
  for (const sx of [-1, 1]) {
    const at = V(sx * (kind === 'humpback' ? 0.1 : 0.09) * L, (kind === 'humpback' ? 0.04 : 0.06) * L, (kind === 'humpback' ? 0.16 : 0.2) * L);
    const fg = new Geo();
    const len = D.flipper * L;
    sheet(fg, 8, 3, (u, v) => {
      const chord = (kind === 'humpback' ? 0.075 : kind === 'orca' ? 0.09 : 0.06) * L * (1 - u * (kind === 'orca' ? 0.25 : 0.65)) * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.12)));
      const knob = kind === 'humpback' && v < 0.15 ? 0.006 * L * Math.max(0, Math.sin(u * 40)) : 0;
      return V(at.x + sx * u * len * 0.82, at.y - u * len * 0.45, at.z - u * len * 0.3 + (v - 0.5) * chord + knob);
    }, (u, v) => kind === 'humpback' ? mixc(white, grey, (1 - v) * 0.3 + u * 0.1) : kind === 'orca' ? back : mixc(flank, back, u * 0.5), 0.008 * L);
    rebase(fg, at);
    const piv = pivot(sx < 0 ? 'flipperR' : 'flipperL', at);
    piv.add(meshOf(fg, mat, 'flipper'));
    root.add(piv);
  }
  // flukes: two swept lobes with a central notch
  const flukeAt = V(0, st[0].y, -L / 2 + 0.01 * L);
  const fk = new Geo();
  const span = D.flukes * L;
  for (const sx of [-1, 1]) {
    sheet(fk, 8, 4, (u, v) => {
      const chord = span * (kind === 'humpback' ? 0.28 : 0.32) * (1 - u * 0.8);
      const sweepBack = u * u * span * 0.32;
      const serr = kind === 'humpback' && v > 0.85 ? Math.max(0, Math.sin(u * 30)) * 0.012 * L : 0;
      return V(sx * u * span * 0.5, flukeAt.y + u * u * 0.01 * L, flukeAt.z - sweepBack - v * chord - serr);
    }, (_u, v) => kind === 'humpback' ? mixc(back, white, v > 0.5 ? 0.25 : 0) : back, 0.01 * L);
  }
  rebase(fk, flukeAt);
  const tail = pivot('tail', flukeAt);
  tail.add(meshOf(fk, mat, 'flukes'));
  root.add(tail);
  return root;
}
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
