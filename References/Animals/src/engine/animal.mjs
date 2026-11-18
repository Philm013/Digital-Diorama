/**
 * WILDFORM / RED FOX (High Detail)
 * Parametric wildlife for Three.js. No textures, model loaders, or shared modules.
 *
 * QUICK START
 *   import { createAsset } from './red-fox.mjs';
 *   scene.add(createAsset({ mergeForProduction: true }));
 *
 * SPECS  Default fox: approximately 1.75 x 0.86 x 0.38 m, including tail.
 *        Adaptive 3,000-18,000 triangle budget. One solid material; translucent
 *        species add one glass material. Exact bounds are in group.userData.
 * OPTIONS  See the exported params schema for dimensions, anatomy, and colors.
 * PARTS  Named, selectable meshes in edit mode; rig pivots use radians at runtime.
 * LICENSE  Generated geometry and this asset module: CC0 1.0 Universal.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ASSET_CONFIG_START */
const ASSET = { id: 'red-fox', name: 'Red fox', scientific: 'Vulpes vulpes', phylum: 'Chordata', bodyPlan: 'mammal', variant: 'fox', length: 0.72, palette: ['#bf5727', '#f1e6ce', '#302b28', '#df8650', '#c69879', '#d9cda9'] };
/* ASSET_CONFIG_END */

const ZONE_KEYS = ['skin', 'underside', 'dark', 'accent', 'detail', 'glass'];
const BASE = Object.fromEntries(ZONE_KEYS.map((key, i) => [key, ASSET.palette[i]]));
export function getColorways(config = ASSET) {
  const base = Object.fromEntries(ZONE_KEYS.map((key, i) => [key, (config.palette || ASSET.palette)[i]]));
  return {
    natural: base,
    arctic: { skin: '#d7dcd8', underside: '#f2f0e2', dark: '#39444a', accent: '#a9b6b9', detail: '#b0a49d', glass: '#d0e4e6' },
    dusk: { skin: '#737d75', underside: '#c6c5ac', dark: '#29362f', accent: '#9ca491', detail: '#ad9778', glass: '#b7ced0' },
  };
}
export const COLORWAYS = getColorways();
export const presets = COLORWAYS;

const range = (label, value, min, max, step, describe) => ({ type: 'range', default: value, min, max, step, label, affects: 'geometry', describe });
export function getSchema(config = ASSET) {
  const l = config.length || 0.72;
  const b = config.bodyPlan || 'mammal';
  const schema = {
    bodyLength: range('Body length', l, l * 0.55, l * 1.6, l * 0.025, 'Structural body length in meters. Rebuilds every coordinate at the new dimensions.'),
    bodyMass: range('Body mass', 1, 0.65, 1.4, 0.05, 'Changes the cross-sectional body profile without scaling the finished object.'),
  };
  if (['mammal', 'bird', 'reptile', 'frog', 'snake'].includes(b)) schema.headSize = range('Head size', 1, 0.7, 1.35, 0.05, 'Recalculates the head profile and placement of facial features.');
  if (['mammal', 'frog', 'spider', 'crab', 'scorpion', 'beetle', 'waterBear', 'velvetWorm'].includes(b)) schema.legLength = range('Leg length', 1, 0.65, 1.45, 0.05, 'Repositions joints and rebuilds tapered limbs and feet.');
  if (b === 'mammal') {
    schema.earSize = range('Ear size', 1, 0.6, 1.7, 0.05, 'Reconstructs the ears and their inner surfaces.');
    schema.tailLength = range('Tail length', 1, 0.5, 1.6, 0.05, 'Recalculates the continuous tail sweep and its tip.');
    if (config.variant === 'deer') schema.antlers = { type: 'toggle', default: true, label: 'Antlers', affects: 'geometry', describe: 'Generate branching antlers above the crown.' };
  }
  if (['bird', 'butterfly'].includes(b)) schema.wingSpan = range('Wing span', 1, 0.6, 1.65, 0.05, 'Rebuilds the wing outline, veins, or flight feathers.');
  if (b === 'bird') schema.wingSpread = range('Wing spread', 0.18, 0, 1, 0.02, 'Sets the rest pose of both wings from folded to extended.');
  if (b === 'fish') { schema.finSize = range('Fin size', 1, 0.6, 1.5, 0.05, 'Rebuilds the dorsal, pectoral, and tail-fin profiles.'); schema.tailLength = range('Tail length', 1, 0.7, 1.5, 0.05, 'Changes the tail stem and caudal fin.'); }
  if (['octopus', 'jellyfish', 'anemone', 'colony', 'combJelly'].includes(b)) schema.tentacleLength = range(b === 'octopus' ? 'Arm length' : 'Tentacle length', 1, 0.55, 1.6, 0.05, 'Recalculates the curved appendage paths and their taper.');
  if (['jellyfish', 'anemone', 'colony'].includes(b)) schema.tentacles = range('Tentacle count', b === 'anemone' ? 28 : 16, 8, 40, 1, 'Number of radial tentacles or feeding appendages.');
  if (b === 'starfish') schema.arms = range('Arm count', 5, 5, 12, 1, 'Rebuilds a continuous radial body with this many arms.');
  if (b === 'urchin') schema.spineLength = range('Spine length', 1, 0.5, 1.8, 0.05, 'Length of the tapered spines distributed over the test.');
  if (['worm', 'centipede', 'velvetWorm'].includes(b)) { schema.curvature = range('Body curve', 0.45, 0, 1, 0.05, 'Changes the centerline while keeping a continuous body surface.'); schema.segments = range('Segments', b === 'centipede' ? 18 : 32, 12, 60, 1, 'Controls structural segments, surface rings, or sampling density for unsegmented forms.'); }
  if (b === 'snake') schema.curvature = range('Body curve', 0.55, 0.1, 1, 0.05, 'Sets how tightly the serpentine centerline coils across the ground.');
  if (b === 'sponge') schema.poreDensity = range('Pore density', 16, 10, 26, 1, 'Rebuilds the open barrel panels or woven silica lattice.');
  if (b === 'snail') schema.shellSize = range('Shell size', 1, 0.7, 1.5, 0.05, 'Recomputes the radius and thickness of the spiral shell.');
  if (b === 'bivalve') schema.valveOpening = range('Valve opening', 0.15, 0, 0.7, 0.05, 'Changes the separation of the two articulated valves.');
  if (b === 'microscopic') schema.ciliaLength = range('Cilia length', 1, 0.5, 1.8, 0.05, 'Rebuilds the external ciliary fringe or introvert bristles.');
  schema.colorway = { type: 'choice', default: 'natural', options: Object.keys(getColorways(config)), label: 'Colorway', affects: 'colors', describe: 'A curated, collision-safe palette for every functional color zone.' };
  const palette = getColorways(config).natural;
  for (const key of ZONE_KEYS) schema[key] = { type: 'color', default: palette[key], label: { skin: 'Coat / body', underside: 'Underside', dark: 'Eyes & markings', accent: 'Accent', detail: 'Fine details', glass: 'Translucency' }[key], affects: 'colors', describe: 'Vertex color for the ' + key + ' zone. Color collisions are resolved deterministically.' };
  schema.detailLevel = { type: 'choice', default: 'Studio', options: ['Draft', 'Studio', 'High'], label: 'Geometry detail', affects: 'geometry', describe: 'Adjusts sweep and silhouette sampling. No external textures are used.' };
  schema.mergeForProduction = { type: 'toggle', default: false, label: 'Merge for production', affects: 'geometry', describe: 'Merge each material into one mesh. Turn off to retain selectable named parts and animation pivots.' };
  for (const [key, value] of Object.entries(config.defaults || {})) if (schema[key]) schema[key].default = value;
  return schema;
}
export const params = getSchema();
export function getRig(config = ASSET) {
  const b = config.bodyPlan;
  if (['butterfly', 'bird'].includes(b)) return { 'left-wing': { axis: 'x', range: [-35, 35], describe: 'Wing pivot at the body.' }, 'right-wing': { axis: 'x', range: [-35, 35], describe: 'Mirrored wing pivot.' }, head: { axis: 'y', range: [-15, 15], describe: 'Gentle head turn.' } };
  if (['mammal', 'reptile'].includes(b)) return { head: { axis: 'y', range: [-18, 18], describe: 'Turn the head at the neck.' }, tail: { axis: 'y', range: [-25, 25], describe: 'Sway the tail from its base.' } };
  if (['fish', 'scorpion'].includes(b)) return { tail: { axis: 'y', range: [-25, 25], describe: 'Sway the tail from its base.' } };
  if (b === 'snake') return { 'head-cranium': { axis: 'y', range: [-20, 20], describe: 'Turn the head at the neck.' } };
  if (b === 'snail') return { shell: { axis: 'z', range: [-5, 5], describe: 'Gently tilt the shell.' } };
  if (b === 'bivalve') return { valve: { axis: 'z', range: [0, 30], describe: 'Open the upper valve.' } };
  return { body: { axis: 'y', range: [-8, 8], describe: 'A gentle, rigid-body display motion.' } };
}
export const rig = getRig();
export const detach = [...new Set([...(ASSET.bodyPlan === 'snail' ? ['foot'] : ASSET.bodyPlan === 'bivalve' ? ['pedicle'] : ASSET.variant === 'turtle' ? ['plastron'] : ['body']), ...Object.keys(rig)])];
export const night = { glass: { color: '#9cc9e3', intensity: 0.45, distance: 3, describe: 'Soft translucent tissue illumination in the night studio.' }, dark: { color: '#9fbc86', intensity: 0.09, distance: 1, describe: 'Subtle eye catchlights.' } };

const hexOf = (v) => typeof v === 'number' && Number.isFinite(v) ? v & 0xffffff : typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v) ? parseInt(v.replace('#', ''), 16) : null;
function zonesFor(name, overrides = {}, config = ASSET) {
  const palettes = getColorways(config), cw = palettes[name] || palettes.natural;
  const used = new Set(), out = {};
  for (const k of ZONE_KEYS) {
    let hex = (hexOf(overrides[k]) ?? hexOf(cw[k]) ?? hexOf(BASE.skin)) & 0xffffff;
    while (used.has(hex)) hex = (hex + 1) & 0xffffff;
    used.add(hex); out[k] = hex;
  }
  return out;
}

function prep(geo, hex) {
  if (geo.index) { const original = geo; geo = geo.toNonIndexed(); original.dispose(); }
  geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
  const c = new THREE.Color(hex), n = geo.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.83, metalness: 0, side: THREE.DoubleSide });
const GLASS_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.46, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true });

function finish(list, material = MAT, name = 'solid', merge = true) {
  if (!list.length) return null;
  if (merge) {
    const prepared = list.map(p => prep(p.g, p.c));
    const merged = mergeGeometries(prepared);
    prepared.forEach(g => g.dispose());
    if (!merged) return null;
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = { zone: name === 'glass' ? 'glass' : 'mixed', merged: true };
    return mesh;
  }
  const group = new THREE.Group(), pivots = {}, usedNames = new Map();
  group.name = name;
  list.forEach((part, i) => {
    const geo = prep(part.g, part.c); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    const originalName = part.n || `${name}_part_${i + 1}`, occurrences = usedNames.get(originalName) || 0;
    mesh.name = originalName + (occurrences ? '-' + (occurrences + 1) : ''); usedNames.set(originalName, occurrences + 1);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = { zone: part.zone || 'skin', color: part.c };
    if (part.rig) {
      if (!pivots[part.rig]) { const pivot = new THREE.Group(); pivot.name = part.rig; pivot.position.fromArray(part.pivot || [0, 0, 0]); pivot.userData.isRig = true; pivots[part.rig] = pivot; group.add(pivot); }
      const parent = pivots[part.rig]; geo.translate(-parent.position.x, -parent.position.y, -parent.position.z); parent.add(mesh);
    } else group.add(mesh);
  });
  return group;
}
function box(w, h, d, x = 0, y = 0, z = 0) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }
function addCylinder(parts, rTop, rBot, h, segs, x, y, z, rx = 0, ry = 0, rz = 0, hex = 0x888888, n = 'cylinder') {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs); geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz); geo.translate(x, y, z); parts.push({ g: geo, c: hex, n });
}
function addWire(parts, p1, p2, hex, r = 0.01, radialSegments = 5, n = 'wire') {
  const a = new THREE.Vector3(...p1), b = new THREE.Vector3(...p2), distance = a.distanceTo(b);
  if (distance < 1e-12) return;
  const geo = new THREE.CylinderGeometry(r * 0.75, r, distance, radialSegments);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  geo.applyMatrix4(new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), q, new THREE.Vector3(1, 1, 1)));
  parts.push({ g: geo, c: hex, n });
}
function addExtrusion(parts, shape, depth, color, name, transform = {}) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10, steps: 1 });
  if (transform.rx) geo.rotateX(transform.rx);
  if (transform.ry) geo.rotateY(transform.ry);
  if (transform.rz) geo.rotateZ(transform.rz);
  if (transform.position) geo.translate(...transform.position);
  parts.push({ g: geo, c: color, n: name });
}
function addQuad(parts, a, b, c, d, color, name = 'panel', thickness = 0) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), C = new THREE.Vector3(...c), D = new THREE.Vector3(...d), vertices = [];
  const tri = (p, q, r) => vertices.push(...p.toArray(), ...q.toArray(), ...r.toArray());
  tri(A, B, C); tri(A, C, D);
  if (thickness) {
    const n = B.clone().sub(A).cross(D.clone().sub(A)).normalize().multiplyScalar(thickness);
    const aa = A.clone().add(n), bb = B.clone().add(n), cc = C.clone().add(n), dd = D.clone().add(n);
    tri(dd, cc, bb); tri(dd, bb, aa); tri(A, aa, bb); tri(A, bb, B); tri(B, bb, cc); tri(B, cc, C); tri(C, cc, dd); tri(C, dd, D); tri(D, dd, aa); tri(D, aa, A);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); parts.push({ g: geo, c: color, n: name });
}
function ellipsoid(parts, x, y, z, rx, ry, rz, color, name, segments = 12, rotation = 0, extra = {}) {
  const geo = new THREE.SphereGeometry(1, segments, Math.max(6, Math.round(segments * 0.6)));
  geo.scale(rx, ry, rz); if (rotation) geo.rotateZ(rotation); geo.translate(x, y, z);
  parts.push({ g: geo, c: color, n: name, ...extra });
}
function prism(parts, points, depthVector, color, name, extra = {}) {
  const vertices = [], offset = new THREE.Vector3(...depthVector), a = points.map(p => new THREE.Vector3(...p)), b = a.map(p => p.clone().add(offset));
  const tri = (p, q, r) => vertices.push(...p.toArray(), ...q.toArray(), ...r.toArray());
  for (let i = 1; i < a.length - 1; i++) { tri(a[0], a[i], a[i + 1]); tri(b[0], b[i + 1], b[i]); }
  for (let i = 0; i < a.length; i++) { const j = (i + 1) % a.length; tri(a[i], b[i], b[j]); tri(a[i], b[j], a[j]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); parts.push({ g: geo, c: color, n: name, ...extra });
}

// A transported frame gives every swept section the same exact shared boundary.
function sweep(parts, points, radii, color, name, options = {}) {
  const curve = options.curve || new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.45);
  const count = options.steps || 18, radial = options.radial || 9, vertices = [], indices = [];
  const from = options.from || 0, to = options.to ?? 1;
  const radiusAt = (t) => {
    const f = t * (radii.length - 1), i = Math.min(radii.length - 2, Math.floor(f)), k = f - i;
    const a = Array.isArray(radii[i]) ? radii[i] : [radii[i], radii[i]], b = Array.isArray(radii[i + 1]) ? radii[i + 1] : [radii[i + 1], radii[i + 1]];
    return [THREE.MathUtils.lerp(a[0], b[0], k), THREE.MathUtils.lerp(a[1], b[1], k)];
  };
  for (let i = 0; i <= count; i++) {
    const t = from + (to - from) * i / count, point = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
    const up = Math.abs(tangent.y) > 0.94 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const side = tangent.clone().cross(up).normalize(), normal = side.clone().cross(tangent).normalize(), radiiAt = radiusAt(t);
    for (let j = 0; j < radial; j++) { const theta = j / radial * Math.PI * 2; const v = point.clone().addScaledVector(side, Math.cos(theta) * radiiAt[0]).addScaledVector(normal, Math.sin(theta) * radiiAt[1]); vertices.push(...v.toArray()); }
  }
  for (let i = 0; i < count; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + (j + 1) % radial, c = a + radial, d = b + radial; indices.push(a, b, c, b, d, c); }
  for (let j = 1; j < radial - 1; j++) { indices.push(0, j + 1, j); const end = count * radial; indices.push(end, end + j, end + j + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setIndex(indices);
  parts.push({ g: geo, c: color, n: name, rig: options.rig, pivot: options.pivot, zone: options.zone });
  return curve;
}

function mammal(parts, glass, p, C, config) {
  // u = axial unit (spine direction): bodyLength stretches trunk, leg spread, head/tail stations.
  // v = girth unit (fixed breed size): heights, widths, head, ears, feet and all thicknesses stay put.
  const u = p.bodyLength, v = config.length || p.bodyLength, variant = config.variant, bear = variant === 'bear', deer = variant === 'deer', elephant = variant === 'elephant', lion = variant === 'lion', wolf = variant === 'wolf', panda = config.id === 'giant-panda';
  const squirrel = variant === 'squirrel', rabbit = variant === 'rabbit', raccoon = variant === 'raccoon', hedgehog = variant === 'hedgehog', opossum = variant === 'opossum';
  const tiger = config.id === 'bengal-tiger', snowLeopard = config.id === 'snow-leopard', cheetahCat = config.id === 'cheetah';
  const mass = p.bodyMass, leg = p.legLength, hs = p.headSize, seg = p.seg;
  const height = (deer ? 0.78 : elephant ? 0.49 : bear ? 0.34 : squirrel || hedgehog ? 0.24 : rabbit ? 0.30 : opossum ? 0.30 : 0.34) * leg;
  const bulk = (elephant ? 0.35 : bear ? 0.31 : tiger ? 0.27 : snowLeopard ? 0.26 : cheetahCat ? 0.20 : lion ? 0.245 : hedgehog ? 0.30 : squirrel ? 0.21 : 0.225) * mass;
  const cy = (height + bulk) * v, width = (elephant ? 0.31 : bear ? 0.27 : tiger ? 0.21 : snowLeopard ? 0.20 : cheetahCat ? 0.15 : 0.18) * mass * v;
  const headX = (elephant ? 0.53 : 0.55) * u, headY = cy + (deer ? 0.43 : elephant ? 0.17 : bear ? 0.16 : 0.29) * v;
  const hp = { rig: 'head', pivot: [0.4 * u, headY - 0.13 * v, 0] };
  const tp = { rig: 'tail', pivot: [-0.43 * u, cy + 0.01 * v, 0] };
  sweep(parts, [[-0.49 * u, cy, 0], [-0.29 * u, cy + 0.025 * v, 0], [0.1 * u, cy + 0.025 * v, 0], [0.41 * u, cy + 0.025 * v, 0]], [[width * 0.55, bulk * v * 0.66], [width, bulk * v], [width * 0.95, bulk * v * 1.02], [width * 0.68, bulk * v * 0.8]], C.skin, 'body', { steps: 16, radial: seg });
  ellipsoid(parts, 0.25 * u, cy + 0.02 * v, 0, 0.205 * v, bulk * 1.11 * v, width * 0.97, C.skin, 'shoulders', seg, -0.15);
  if (tiger) {
    // Vertical flank stripes: thin dark bands that wrap from the spine toward the belly.
    for (let i = 0; i < 9; i++) {
      const bx = (-0.40 + i * 0.085) * u, taper = 1 - Math.abs((bx / u + 0.05) / 0.48) * 0.35;
      for (const side of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 5; k++) {
          const a = (k / 5) * Math.PI * 0.58;
          pts.push([bx + Math.sin(a * 2.2 + i) * 0.014 * v, cy + Math.cos(a) * bulk * v * 1.02 * taper, side * Math.sin(a) * width * 1.02 * taper]);
        }
        sweep(parts, pts, [0.006 * v, 0.017 * v, 0.020 * v, 0.017 * v, 0.006 * v], C.dark, `stripe-${side}-${i}`, { steps: 12, radial: 5 });
      }
    }
    for (const side of [-1, 1]) ellipsoid(parts, headX - 0.02 * v, headY - 0.06 * v, side * 0.20 * hs * v, 0.075 * hs * v, 0.11 * hs * v, 0.05 * v, C.underside, `cheek-ruff-${side}`, 10, side * 0.15, hp);
  }
  if (snowLeopard || cheetahCat) {
    // Spots live on an explicit shell just outside the torso; a Fibonacci sphere gives even coverage.
    const n = snowLeopard ? 44 : 84;
    const cx = -0.02 * u, ccy = cy + 0.02 * v;
    const ax = 0.46 * u, ay = bulk * v * 1.16, az = width * 1.18;
    let placed = 0;
    for (let i = 0; i < n * 2 && placed < n; i++) {
      const t = (i + 0.5) / (n * 2), yy = 1 - 2 * t, rr = Math.sqrt(Math.max(0, 1 - yy * yy));
      const ang = i * Math.PI * (3 - Math.sqrt(5));
      const nx = Math.cos(ang) * rr, ny = yy, nz = Math.sin(ang) * rr;
      if (ny < -0.15) continue;                 // keep the belly clean
      if (Math.abs(nx) > 0.93) continue;        // skip the very nose/rump poles
      placed++;
      const rumpTaper = 1 - Math.max(0, -nx) * 0.36;
      const sx = cx + nx * ax, sy = ccy + ny * ay * rumpTaper, sz = nz * az * rumpTaper;
      const nrm = new THREE.Vector3(nx / ax, ny / ay, nz / az).normalize();
      if (cheetahCat) {
        const g = new THREE.SphereGeometry(1, 6, 4); g.scale(0.030 * v, 0.030 * v, 0.012 * v);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
        g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(sx, sy, sz), q, new THREE.Vector3(1, 1, 1)));
        parts.push({ g, c: C.dark, n: 'spot-' + placed });
      } else {
        const g = new THREE.TorusGeometry(0.050 * v, 0.013 * v, 4, 10);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
        g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(sx, sy, sz), q, new THREE.Vector3(1, 1, 1)));
        parts.push({ g, c: C.dark, n: 'rosette-' + placed });
      }
    }
  }
  if (config.id === 'dromedary-camel' || config.id === 'bactrian-camel') {
    const humpTop = cy + 0.02 * v + bulk * 1.11 * v;
    const humps = config.id === 'dromedary-camel' ? [0.22] : [0.10, 0.32];
    humps.forEach((hx, i) => ellipsoid(parts, hx * u, humpTop + 0.12 * v, 0, 0.13 * v, 0.22 * v, width * 0.62, C.skin, 'hump-' + i, seg, 0));
  }
  if (!elephant) {
    sweep(parts, [[0.27 * u, cy + 0.055 * v, 0], [0.36 * u, cy + 0.19 * v, 0], [headX - 0.035 * v, headY - 0.05 * v, 0]], [[width * 0.92, 0.2 * mass * v], [width * 0.8, 0.19 * v], [0.14 * hs * v, 0.15 * hs * v]], C.skin, 'neck', { steps: 9, radial: seg });
    if (!bear && !lion) {
      ellipsoid(parts, 0.385 * u, cy + 0.09 * v, 0, 0.12 * v, 0.24 * v, width * 0.80, C.underside, 'chest-bib', seg, -0.36);
      prism(parts, [[0.40 * u, cy + 0.20 * v, -width * 0.65], [0.49 * u, cy + 0.14 * v, 0], [0.32 * u, cy - 0.19 * v, -width * 0.45]], [0, 0, width * 0.82], C.underside, 'chest-fur');
    }
  }
  for (const side of [-1, 1]) for (const front of [false, true]) {
    const z = side * width * 0.73, x = (front ? 0.26 : -0.30) * u, label = `${front ? 'front' : 'hind'}-${side === 1 ? 'left' : 'right'}`;
    const shift = side === -1 ? (front ? -0.08 : 0.07) * v : 0;
    if (elephant) {
      sweep(parts, [[x, cy + 0.02 * v, z * 0.9], [x + 0.012 * v, cy * 0.52, z], [x + 0.045 * v + shift, 0.09 * v, z]], [0.13 * mass * v, 0.105 * v, 0.10 * v], C.skin, label + '-leg', { steps: 9, radial: 10 });
      ellipsoid(parts, x + 0.06 * v + shift, 0.07 * v, z, 0.12 * v, 0.07 * v, 0.105 * v, C.accent, label + '-foot', 10);
      for (let toe = -1; toe <= 1; toe++) ellipsoid(parts, x + 0.153 * v + shift, 0.049 * v, z + toe * 0.041 * v, 0.014 * v, 0.025 * v, 0.016 * v, C.underside, label + '-nail-' + toe, 8);
    } else {
      const kneeX = x + (front ? 0.01 : -0.10) * v, ankleX = x + (front ? 0.025 : -0.015) * v + shift;
      const kneeY = cy * (front ? 0.44 : 0.50), ankleY = 0.11 * v;
      const upper = (bear ? 0.105 : deer ? 0.06 : 0.072) * mass * v;
      if (!front) ellipsoid(parts, x - 0.012 * v, cy - 0.08 * v, z, upper * 1.7, bulk * 0.93 * v, upper * 1.18, C.skin, label + '-haunch', seg, -0.28);
      sweep(parts, [[x, cy + 0.02 * v, z * 0.9], [kneeX, kneeY + 0.04 * v, z], [ankleX, Math.max(ankleY * 1.7, kneeY * 0.69), z]], [upper * 1.05, upper * 0.68, upper * 0.52], C.skin, label + '-upper-leg', { steps: 7, radial: 8 });
      sweep(parts, [[kneeX, kneeY + 0.025 * v, z], [ankleX, ankleY, z], [ankleX + 0.033 * v, 0.053 * v, z]], [upper * 0.69, upper * 0.42, upper * 0.60], deer || bear || lion ? C.skin : C.dark, label + '-stocking', { steps: 7, radial: 8 });
      ellipsoid(parts, ankleX + 0.042 * v, 0.049 * v, z, (bear ? 0.12 : deer ? 0.066 : 0.086) * v, 0.047 * v, (bear ? 0.075 : 0.058) * v, deer ? C.dark : bear || lion ? C.accent : C.dark, label + '-paw', 10);
      if (bear) for (let toe = -1; toe <= 1; toe++) ellipsoid(parts, ankleX + 0.149 * v, 0.031 * v, z + toe * 0.031 * v, 0.031 * v, 0.014 * v, 0.01 * v, C.detail, label + '-claw-' + toe, 8);
    }
  }
  const maned = config.id === 'african-lion';
  const cheetah = config.id === 'cheetah';
  const cat = lion;
  if (maned) {
    // Layered ruff sits BEHIND the face so the head stays readable.
    ellipsoid(parts, headX - 0.16 * v, headY - 0.02 * v, 0, 0.22 * v, 0.30 * hs * v, 0.26 * v, C.accent, 'mane-halo', seg, 0.08, hp);
    ellipsoid(parts, headX - 0.08 * v, headY - 0.16 * v, 0, 0.18 * v, 0.22 * v, 0.22 * v, C.accent, 'mane-chest', seg, 0.2, hp);
    for (const side of [-1, 1]) ellipsoid(parts, headX - 0.10 * v, headY - 0.04 * v, side * 0.22 * v, 0.14 * v, 0.24 * v, 0.12 * v, C.detail, `mane-ruff-${side}`, 12, side * 0.25, hp);
  }
  const crX = (elephant ? 0.26 : deer ? 0.19 : bear ? 0.255 : cat ? 0.20 : 0.215) * hs * v;
  const crY = (elephant ? 0.30 : cat ? 0.18 : 0.195) * hs * v;
  const crZ = (elephant ? 0.245 : bear ? 0.20 : cat ? 0.175 : 0.157) * hs * v;
  ellipsoid(parts, headX + (cat ? 0.02 : 0) * v, headY, 0, crX, crY, crZ, C.skin, 'head-cranium', seg, cat ? -0.08 : -0.20, hp);
  if (elephant) {
    for (const side of [-1, 1]) {
      // Ear root sits on the skull surface (crZ) so it tracks headSize instead of floating.
      ellipsoid(parts, headX - 0.10 * v, headY - 0.02 * v, side * (crZ + 0.012 * v), 0.205 * p.earSize * v, 0.325 * p.earSize * v, 0.048 * v, C.accent, `ear-${side}`, seg, -0.17, hp);
      sweep(parts, [[headX + 0.14 * v, headY - 0.18 * v, side * 0.115 * v], [headX + 0.38 * v, headY - 0.25 * v, side * 0.15 * v], [headX + 0.51 * v, headY - 0.13 * v, side * 0.17 * v]], [0.032 * v, 0.025 * v, 0.001 * v], C.detail, `tusk-${side}`, { steps: 12, radial: 8, ...hp });
    }
    sweep(parts, [[headX + 0.19 * v, headY - 0.04 * v, 0], [headX + 0.32 * v, headY - 0.26 * v, 0], [headX + 0.31 * v, 0.23 * v, 0], [headX + 0.47 * v, 0.16 * v, 0], [headX + 0.53 * v, 0.24 * v, 0]], [0.115 * v, 0.09 * v, 0.066 * v, 0.046 * v, 0.025 * v], C.skin, 'trunk', { steps: 25, radial: 10, ...hp });
  } else {
    const muzzle = (bear ? 0.25 : cat ? 0.22 : deer ? 0.31 : wolf ? 0.39 : squirrel || rabbit ? 0.24 : raccoon ? 0.30 : hedgehog ? 0.29 : opossum ? 0.42 : 0.37) * hs * v;
    if (raccoon) {
      for (const side of [-1, 1]) ellipsoid(parts, headX + 0.085 * hs * v, headY + 0.045 * hs * v, side * 0.115 * hs * v, 0.085 * hs * v, 0.062 * hs * v, 0.055 * hs * v, C.dark, `face-mask-${side}`, 10, -0.12, hp);
      ellipsoid(parts, headX + 0.10 * hs * v, headY + 0.10 * hs * v, 0, 0.075 * hs * v, 0.045 * hs * v, 0.070 * hs * v, C.underside, 'brow-band', 10, 0, hp);
    }
    for (const side of [-1, 1]) ellipsoid(parts, headX + 0.05 * hs * v, headY - 0.06 * hs * v, side * (cat ? 0.12 : 0.106) * hs * v, (cat ? 0.11 : 0.156) * hs * v, (cat ? 0.09 : 0.106) * hs * v, (cat ? 0.07 : 0.064) * hs * v, C.underside, `cheek-${side}`, 10, -0.18, hp);
    sweep(parts, [[headX + 0.04 * hs * v, headY - 0.01 * hs * v, 0], [headX + muzzle * 0.62, headY - (cat ? 0.05 : 0.078) * hs * v, 0], [headX + muzzle, headY - (cat ? 0.06 : 0.095) * hs * v, 0]], [[(cat ? 0.10 : 0.118) * hs * v, (cat ? 0.08 : 0.09) * hs * v], [(cat ? 0.072 : 0.075) * hs * v, 0.054 * hs * v], [(cat ? 0.042 : 0.033) * hs * v, 0.026 * hs * v]], C.skin, 'muzzle', { steps: 7, radial: 8, ...hp });
    ellipsoid(parts, headX + muzzle * 0.62, headY - (cat ? 0.09 : 0.115) * hs * v, 0, muzzle * (cat ? 0.48 : 0.41), 0.036 * hs * v, muzzle * (cat ? 0.38 : 0.32), C.underside, 'lower-jaw', 10, -0.07, hp);
    ellipsoid(parts, headX + muzzle * 0.98, headY - (cat ? 0.055 : 0.089) * hs * v, 0, (cat ? 0.048 : 0.041) * hs * v, (cat ? 0.036 : 0.031) * hs * v, (cat ? 0.052 : 0.044) * hs * v, C.dark, 'nose', 10, -0.12, hp);
    if (cat) for (const side of [-1, 1]) ellipsoid(parts, headX + muzzle * 0.55, headY - 0.04 * hs * v, side * 0.055 * hs * v, 0.04 * hs * v, 0.028 * hs * v, 0.038 * hs * v, C.underside, `whisker-pad-${side}`, 8, 0, hp);
    if (cheetah) for (const side of [-1, 1]) sweep(parts, [[headX + crX * 0.55, headY + 0.01 * v, side * crZ * 0.7], [headX + muzzle * 0.55, headY - 0.04 * hs * v, side * 0.05 * hs * v], [headX + muzzle * 0.85, headY - 0.07 * hs * v, side * 0.03 * hs * v]], [0.012 * v, 0.01 * v, 0.006 * v], C.dark, `tear-mark-${side}`, { steps: 5, radial: 5, ...hp });
    for (const side of [-1, 1]) {
      const ez = side * 0.118 * hs * v, ey = headY + 0.12 * hs * v;
      if (cat) {
        // Ear root embedded in the skull: center sits at 80% of the surface radius.
        const earY = headY + crY * 0.82 + 0.030 * p.earSize * v, earZ = side * crZ * 0.80;
        ellipsoid(parts, headX - 0.02 * hs * v, earY, earZ, 0.055 * p.earSize * v, 0.078 * p.earSize * v, 0.032 * v, C.skin, `ear-${side}`, 10, side * 0.18, hp);
        ellipsoid(parts, headX + 0.01 * hs * v, earY - 0.002 * v, earZ, 0.028 * p.earSize * v, 0.048 * p.earSize * v, 0.016 * v, C.underside, `inner-ear-${side}`, 8, side * 0.18, hp);
      } else if (rabbit) {
        // Tall upright ears rooted inside the back of the skull.
        const e = p.earSize, base = [headX - 0.050 * hs * v, headY + crY * 0.45, side * crZ * 0.55];
        const tip = [headX - 0.115 * hs * v, headY + crY * 0.45 + 0.255 * e * v, side * (crZ * 0.55 + 0.045 * e * v)];
        const mid = [(base[0] + tip[0]) / 2 + 0.018 * v, (base[1] + tip[1]) / 2, (base[2] + tip[2]) / 2];
        sweep(parts, [base, mid, tip], [[0.026 * e * v, 0.016 * v], [0.032 * e * v, 0.015 * v], [0.012 * e * v, 0.007 * v]], C.skin, `ear-${side}`, { steps: 10, radial: 8, ...hp });
        sweep(parts, [base, mid, tip], [[0.014 * e * v, 0.007 * v], [0.018 * e * v, 0.006 * v], [0.006 * e * v, 0.003 * v]], C.underside, `inner-ear-${side}`, { steps: 10, radial: 7, ...hp });
      } else if (bear || squirrel || raccoon || hedgehog || opossum) {
        const round = squirrel ? 0.95 : hedgehog ? 0.62 : raccoon ? 0.86 : opossum ? 1.05 : 1;
        const earC = [headX - crX * 0.38, headY + crY * 0.72, side * crZ * 0.88];
        ellipsoid(parts, earC[0], earC[1] + 0.030 * p.earSize * v, earC[2], 0.083 * round * p.earSize * v, 0.085 * round * p.earSize * v, 0.043 * v, panda ? C.dark : C.skin, `ear-${side}`, 10, 0, hp);
        ellipsoid(parts, earC[0] + 0.049 * hs * v, earC[1] + 0.036 * p.earSize * v, earC[2], 0.019 * v, 0.052 * round * p.earSize * v, 0.038 * round * p.earSize * v, panda ? C.skin : C.dark, `inner-ear-${side}`, 8, 0, hp);
      } else {
        // Prism ears: base edge buried across the skull crown, tip rising clear.
        const e = p.earSize, tip = [headX - crX * 0.18, headY + crY * 0.72 + 0.24 * e * v, side * (crZ * 0.86 + 0.02 * e * v)];
        const a = [headX + crX * 0.55, headY + crY * 0.38, side * crZ * 0.30], b = [headX - crX * 0.52, headY + crY * 0.38, side * crZ * 0.82];
        prism(parts, [a, b, tip], [-0.045 * v, -0.009 * v, 0], C.skin, `ear-${side}`, hp);
        const mid = new THREE.Vector3(...a).add(new THREE.Vector3(...b)).add(new THREE.Vector3(...tip)).multiplyScalar(1 / 3);
        const inner = [a, b, tip].map(v3 => new THREE.Vector3(...v3).lerp(mid, 0.24).add(new THREE.Vector3(0.004 * v, 0, 0)).toArray());
        prism(parts, inner, [0.001 * v, 0, 0], C.underside, `inner-ear-${side}`, hp);
      }
    }
  }
  const headR = { x: crX, y: crY, z: crZ };
  for (const side of [-1, 1]) {
    const d = cat ? [0.72, 0.16, 0.52 * side] : [0.46, 0.14, 0.87 * side], dl = Math.hypot(d[0], d[1], d[2]);
    const ex = headX + (cat ? 0.02 * v : 0) + headR.x * (d[0] / dl) * 1.06, ey = headY + headR.y * (d[1] / dl) * 1.06, ez = headR.z * (d[2] / dl) * 1.06;
    const er = (cat ? 0.038 : 0.046) * hs * v;
    if (panda) ellipsoid(parts, ex - (d[0] / dl) * er * 1.2, ey - (d[1] / dl) * er * 1.2, ez - (d[2] / dl) * er * 1.2, er * 1.5, er * 1.8, er * 1.1, C.dark, `eye-patch-${side}`, 10, -0.19, hp);
    ellipsoid(parts, ex, ey, ez, er * 0.80, er, er * 0.62, C.dark, `eye-${side}`, 10, -0.19, hp);
    ellipsoid(parts, ex + er * 0.52, ey + er * 0.40, ez + side * er * 0.42, er * 0.30, er * 0.30, er * 0.24, C.underside, `eye-glint-${side}`, 8, 0, hp);
  }
  if (deer && p.antlers) for (const side of [-1, 1]) {
    const base = [headX - crX * 0.30, headY + crY * 0.55, side * crZ * 0.55];
    sweep(parts, [base, [headX - 0.19 * v, headY + 0.38 * v, side * 0.2 * v], [headX - 0.32 * v, headY + 0.63 * v, side * 0.31 * v], [headX - 0.24 * v, headY + 0.81 * v, side * 0.4 * v]], [0.03 * v, 0.025 * v, 0.018 * v, 0.002 * v], C.detail, `antler-${side}`, { steps: 12, radial: 6, ...hp });
    for (let i = 0; i < 3; i++) { const t = i / 3; sweep(parts, [[headX - (0.15 + t * 0.14) * v, headY + (0.30 + t * 0.40) * v, side * (0.16 + t * 0.16) * v], [headX + (0.02 - t * 0.08) * v, headY + (0.45 + t * 0.42) * v, side * (0.22 + t * 0.21) * v], [headX + (0.05 - t * 0.07) * v, headY + (0.58 + t * 0.40) * v, side * (0.25 + t * 0.23) * v]], [0.016 * v, 0.01 * v, 0.001 * v], C.detail, `antler-tine-${side}-${i}`, { steps: 6, radial: 5, ...hp }); }
  }
  const tail = p.tailLength, rumpX = -0.43 * u;
  if (hedgehog) {
    // Dense quill field over the back and flanks: the defining hedgehog read.
    // A dense mat of short cone spines reads as a spiny coat instead of scattered hairs.
    const cols = 18, rows = 13;
    for (let i = 0; i < cols * rows; i++) {
      const t = (i % cols) / (cols - 1), ring = Math.floor(i / cols) / (rows - 1);
      const jitter = ((i * 37) % 11) / 11 - 0.5;
      const bx = (-0.47 + t * 0.66 + jitter * 0.018) * u, arc = Math.sin(Math.PI * (0.22 + t * 0.70));
      const a = (ring - 0.5) * Math.PI * 0.96 + jitter * 0.10;
      const ny = Math.cos(a), nz = Math.sin(a);
      const sx = bx, sy = cy + ny * bulk * v * arc * 0.94, sz = nz * width * arc * 1.02;
      const len = (0.088 + (i % 3) * 0.016) * v;
      const cone = new THREE.ConeGeometry(0.030 * v, len, 5);
      const dir = new THREE.Vector3(-0.34, ny, nz).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      cone.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(sx + dir.x * len * 0.40, sy + dir.y * len * 0.40, sz + dir.z * len * 0.40), q, new THREE.Vector3(1, 1, 1)));
      parts.push({ g: cone, c: i % 3 ? C.detail : C.accent, n: 'quill-' + i });
    }
    ellipsoid(parts, -0.47 * u, cy - 0.02 * v, 0, 0.05 * v, 0.045 * v, 0.045 * v, C.skin, 'tail-tip', 8, 0, tp);
  } else if (squirrel) {
    // Bushy plume that hugs the back instead of towering over it.
    const path = [[rumpX, cy + 0.02 * v, 0], [rumpX - 0.18 * v, cy + 0.20 * tail * v, 0], [rumpX - 0.12 * v, cy + 0.48 * tail * v, 0], [rumpX + 0.14 * v, cy + 0.60 * tail * v, 0], [rumpX + 0.38 * v, cy + 0.58 * tail * v, 0]];
    // Thin across (Z) and broad in the plane of the curve: the classic side-on plume.
    const radii = [[0.028 * v, 0.052 * v], [0.042 * v, 0.135 * v], [0.046 * v, 0.155 * v], [0.040 * v, 0.130 * v], [0.020 * v, 0.048 * v]];
    const curve = new THREE.CatmullRomCurve3(path.map(p3 => new THREE.Vector3(...p3)), false, 'catmullrom', 0.45);
    sweep(parts, path, radii, C.skin, 'tail-plume', { curve, from: 0, to: 0.74, steps: 18, radial: 11, ...tp });
    sweep(parts, path, radii, C.underside, 'tail-tip', { curve, from: 0.74, to: 1, steps: 9, radial: 11, ...tp });

  } else if (opossum) {
    // Naked, rat-like prehensile tail that tapers to a fine point.
    sweep(parts, [[rumpX, cy + 0.02 * v, 0], [rumpX - (0.23 + 0.20 * tail) * v, cy - 0.10 * v, 0.02 * v], [rumpX - (0.43 + 0.30 * tail) * v, cy - 0.30 * v, 0.05 * v], [rumpX - (0.51 + 0.36 * tail) * v, cy - 0.44 * v, 0.07 * v]],
      [0.048 * v, 0.034 * v, 0.019 * v, 0.004 * v], C.underside, 'bare-tail', { steps: 18, radial: 8, ...tp });
  } else if (rabbit) {
    ellipsoid(parts, -0.50 * u, cy + 0.06 * v, 0, 0.070 * v, 0.070 * v, 0.065 * v, C.underside, 'cotton-tail', 10, 0, tp);
  } else if (raccoon) {
    const path = [[rumpX, cy + 0.03 * v, 0], [rumpX - (0.17 + 0.16 * tail) * v, cy - 0.06 * v, 0.02 * v], [rumpX - (0.31 + 0.24 * tail) * v, cy - 0.24 * v, 0.05 * v]];
    const radii = [[0.075 * v, 0.085 * v], [0.082 * v, 0.092 * v], [0.055 * v, 0.062 * v]];
    const curve = new THREE.CatmullRomCurve3(path.map(p3 => new THREE.Vector3(...p3)), false, 'catmullrom', 0.45);
    for (let i = 0; i < 6; i++) sweep(parts, path, radii, i % 2 ? C.dark : C.skin, 'tail-ring-' + i, { curve, from: i / 6, to: (i + 1) / 6, steps: 4, radial: 10, ...tp });
  } else if (bear || deer) ellipsoid(parts, -0.50 * u, cy + 0.04 * v, 0, 0.075 * tail * v, 0.075 * v, 0.065 * v, deer ? C.underside : C.skin, 'tail-tip', 10, 0, tp);
  else if (snowLeopard) {
    // Enormous plush tail, nearly body length, carried low and curling up at the tip.
    const path = [[rumpX, cy + 0.02 * v, 0], [rumpX - (0.19 + 0.20 * tail) * v, cy - 0.10 * v, 0.02 * v], [rumpX - (0.41 + 0.36 * tail) * v, cy - 0.20 * v, 0.06 * v], [rumpX - (0.55 + 0.46 * tail) * v, cy - 0.06 * v, 0.09 * v]];
    const radii = [0.070 * v, 0.082 * v, 0.080 * v, 0.045 * v];
    const curve = new THREE.CatmullRomCurve3(path.map(p3 => new THREE.Vector3(...p3)), false, 'catmullrom', 0.45);
    sweep(parts, path, radii, C.skin, 'plush-tail', { curve, steps: 20, radial: 10, ...tp });
    for (let i = 1; i < 9; i++) { const pt = curve.getPoint(i / 9); const g = new THREE.TorusGeometry(0.083 * v * (1 - i / 14), 0.013 * v, 4, 10); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(i / 9).normalize()); g.applyMatrix4(new THREE.Matrix4().compose(pt, q, new THREE.Vector3(1, 1, 1))); parts.push({ g, c: C.dark, n: 'tail-rosette-' + i, rig: 'tail', pivot: tp.pivot }); }
  } else if (tiger || cheetahCat) {
    const path = [[rumpX, cy + 0.03 * v, 0], [rumpX - (0.12 + 0.22 * tail) * v, cy - 0.08 * v, 0.02 * v], [rumpX - (0.25 + 0.34 * tail) * v, cy - 0.32 * v, 0.05 * v], [rumpX - (0.31 + 0.40 * tail) * v, cy - 0.40 * v, 0.08 * v]];
    const radii = tiger ? [0.046 * v, 0.040 * v, 0.030 * v, 0.012 * v] : [0.036 * v, 0.032 * v, 0.026 * v, 0.012 * v];
    const curve = new THREE.CatmullRomCurve3(path.map(p3 => new THREE.Vector3(...p3)), false, 'catmullrom', 0.45);
    const bands = tiger ? 9 : 7, start = tiger ? 0 : 0.45;
    for (let i = 0; i < bands; i++) {
      const a = start + (i / bands) * (1 - start), b = start + ((i + 1) / bands) * (1 - start);
      sweep(parts, path, radii, i % 2 ? C.dark : C.skin, 'tail-band-' + i, { curve, from: a, to: b, steps: 3, radial: 8, ...tp });
    }
    if (!tiger) sweep(parts, path, radii, C.skin, 'tail-base', { curve, from: 0, to: start, steps: 6, radial: 8, ...tp });
    if (tiger) ellipsoid(parts, rumpX - (0.31 + 0.40 * tail) * v, cy - 0.40 * v, 0.08 * v, 0.020 * v, 0.018 * v, 0.018 * v, C.dark, 'tail-tip', 8, 0, tp);
    else ellipsoid(parts, rumpX - (0.31 + 0.40 * tail) * v, cy - 0.40 * v, 0.08 * v, 0.026 * v, 0.022 * v, 0.022 * v, C.underside, 'tail-tip', 8, 0, tp);
  } else if (lion || elephant) {
    sweep(parts, [[rumpX, cy + 0.03 * v, 0], [rumpX - (0.07 + 0.2 * tail) * v, cy - 0.05 * v, 0.01 * v], [rumpX - (0.12 + 0.28 * tail) * v, cy - 0.36 * v, 0.03 * v], [rumpX - (0.17 + 0.31 * tail) * v, cy - 0.38 * v, 0.06 * v]], [0.043 * v, 0.033 * v, 0.021 * v, 0.01 * v], C.skin, 'tail-stem', { steps: 15, radial: 8, ...tp });
    ellipsoid(parts, rumpX - (0.17 + 0.31 * tail) * v, cy - 0.38 * v, 0.06 * v, 0.08 * v, 0.075 * v, 0.049 * v, C.accent, 'tail-tuft', 10, 0.5, tp);
  } else {
    const path = [[rumpX, cy + 0.05 * v, 0], [rumpX - 0.25 * tail * v, cy + 0.00 * v, 0.055 * v], [rumpX - 0.55 * tail * v, cy - 0.16 * v, 0.09 * v], [rumpX - 0.82 * tail * v, cy - 0.23 * v, 0.11 * v], [rumpX - 0.99 * tail * v, cy - 0.16 * v, 0.095 * v]];
    const radii = [[0.078 * v, 0.09 * v], [0.138 * v, 0.177 * v], [0.157 * v, 0.192 * v], [0.117 * v, 0.139 * v], [0.001 * v, 0.003 * v]];
    const curve = new THREE.CatmullRomCurve3(path.map(p3 => new THREE.Vector3(...p3)), false, 'catmullrom', 0.45);
    sweep(parts, path, radii, C.skin, 'tail-brush', { curve, from: 0, to: 0.71, steps: 15, radial: 11, ...tp });
    sweep(parts, path, radii, wolf ? C.accent : C.underside, 'tail-tip', { curve, from: 0.71, to: 1, steps: 7, radial: 11, ...tp });
  }
}

function bird(parts, glass, p, C, config) {
  // u = stature (length slider makes the bird taller); v = girth unit (depth/width stay put).
  const u = p.bodyLength, v = config.length || p.bodyLength, owl = config.variant === 'owl', puffin = config.variant === 'puffin', hs = p.headSize, w = p.bodyMass;
  const crested = config.variant === 'crested', woodpecker = config.variant === 'woodpecker';
  const bodyY = 0.51 * u, bodyRy = 0.38 * w * u, bodyRz = 0.215 * w * v;
  ellipsoid(parts, 0, bodyY, 0, 0.265 * v, bodyRy, bodyRz, C.skin, 'body', p.seg, -0.2);
  ellipsoid(parts, 0.15 * v, 0.52 * u, 0, 0.19 * v, 0.3 * u, 0.19 * w * v, C.underside, 'breast', p.seg, -0.25);
  const headX = 0.14 * v, headY = 0.91 * u;
  const hp = { rig: 'head', pivot: [0.13 * v, 0.79 * u, 0] };
  const hrx = (owl ? 0.25 : 0.18) * hs * v, hry = (owl ? 0.255 : 0.21) * hs * v, hrz = (owl ? 0.24 : 0.17) * hs * v;
  ellipsoid(parts, headX, headY, 0, hrx, hry, hrz, puffin || crested || woodpecker ? C.skin : C.underside, 'head-cranium', p.seg, 0, hp);
  for (const s of [-1, 1]) {
    if (owl) {
      // The owl's facial disk is the outermost feature, so eyes sit ON its front face and bulge out.
      const diskX = headX + 0.105 * v, diskY = headY + 0.030 * v, diskZ = s * 0.124 * v;
      const dr = { x: 0.132 * hs * v, y: 0.173 * hs * v, z: 0.129 * hs * v };
      ellipsoid(parts, diskX, diskY, diskZ, dr.x, dr.y, dr.z, C.underside, `facial-disk-${s}`, 12, -0.16, hp);
      const ey = headY + 0.045 * v, ez = s * 0.150 * v;
      const ny = (ey - diskY) / dr.y, nz = (Math.abs(ez) - Math.abs(diskZ)) / dr.z;
      const front = Math.sqrt(Math.max(0.02, 1 - ny * ny - nz * nz));
      const ex = diskX + dr.x * front * 0.92;
      ellipsoid(parts, ex, ey, ez, 0.050 * hs * v, 0.056 * hs * v, 0.043 * hs * v, C.dark, `eye-${s}`, 12, 0, hp);
      ellipsoid(parts, ex + 0.036 * v, ey + 0.029 * v, ez + s * 0.025 * v, 0.013 * v, 0.014 * v, 0.011 * v, C.underside, `eye-glint-${s}`, 8, 0, hp);
      if (config.id === 'great-horned-owl') ellipsoid(parts, headX - 0.06 * v, headY + 0.21 * v, s * 0.16 * v, 0.04 * v, 0.09 * v, 0.032 * v, C.skin, `ear-tuft-${s}`, 8, s * 0.32, hp);
    } else {
      // Eye placed on the head ellipsoid surface (unit direction x radii) so it always protrudes.
      const hr = { x: 0.18 * hs * v, y: 0.21 * hs * v, z: 0.17 * hs * v };
      const d = [0.48, 0.20, 0.85 * s], dl = Math.hypot(d[0], d[1], d[2]);
      const ex = headX + hr.x * (d[0] / dl) * 1.06, ey = headY + hr.y * (d[1] / dl) * 1.06, ez = hr.z * (d[2] / dl) * 1.06;
      ellipsoid(parts, ex, ey, ez, 0.040 * hs * v, 0.043 * hs * v, 0.030 * hs * v, C.dark, `eye-${s}`, 10, 0, hp);
      ellipsoid(parts, ex + 0.024 * v, ey + 0.023 * v, ez + s * 0.018 * v, 0.011 * v, 0.012 * v, 0.008 * v, C.underside, `eye-glint-${s}`, 8, 0, hp);
    }
    // Legs root inside the belly (tracking body surface) and reach fixed-size feet on the ground.
    const z = s * 0.13 * w * v, legTopY = bodyY - bodyRy * 0.55, legBotY = 0.04 * v;
    const legMidY = legBotY + (legTopY - legBotY) * 0.42;
    sweep(parts, [[0.045 * v, legTopY, z], [0.015 * v, legMidY, z], [0.10 * v, legBotY, z]], [0.033 * v, 0.023 * v, 0.014 * v], C.detail, `leg-${s}`, { steps: 6, radial: 7 });
    for (let toe = -1; toe <= 1; toe++) sweep(parts, [[0.08 * v, 0.044 * v, z], [0.18 * v, 0.025 * v, z + toe * 0.035 * v], [0.22 * v, 0.013 * v, z + toe * 0.052 * v]], [0.014 * v, 0.01 * v, 0.002 * v], C.detail, `toe-${s}-${toe}`, { steps: 5, radial: 5 });
    // Wing pivot buried in the body flank so wings never float off at low body mass.
    const pivot = [-0.01 * v, bodyY + bodyRy * 0.45, s * 0.14 * w * v], wp = { rig: s === 1 ? 'left-wing' : 'right-wing', pivot };
    const span = p.wingSpan, spread = p.wingSpread;
    const endZ = s * (0.23 + spread * 0.63 * span) * u;
    sweep(parts, [pivot, [-0.16 * u, 0.46 * u, s * (0.23 + spread * 0.34 * span) * u], [-0.32 * span * u, (0.20 + spread * 0.20) * u, endZ]], [[0.1 * u, 0.15 * u], [0.105 * span * u, 0.17 * u], [0.025 * u, 0.06 * u]], C.skin, `wing-coverts-${s}`, { steps: 9, radial: 8, ...wp });
    for (let f = 0; f < 8; f++) {
      const t = f / 7, z1 = s * (0.20 + spread * 0.44 * t * span) * u;
      sweep(parts, [[(-0.035 - t * 0.20) * u, (0.59 - t * 0.20) * u, z1], [(-0.15 - t * 0.22 * span) * u, (0.37 - t * 0.07 + spread * 0.17) * u, z1 + s * 0.065 * u], [(-0.26 - t * 0.27 * span) * u, (0.14 + spread * 0.25) * u, endZ + s * t * 0.14 * span * u]], [[0.047 * u, 0.022 * u], [0.044 * u, 0.019 * u], [0.006 * u, 0.004 * u]], f % 3 === 0 ? C.accent : C.skin, `flight-feather-${s}-${f}`, { steps: 7, radial: 6, ...wp });
    }
  }
  if (woodpecker) {
    // Straight chisel bill plus a stiff prop tail: the two reads that say "woodpecker".
    sweep(parts, [[headX + 0.13 * v, headY - 0.005 * v, 0], [headX + 0.30 * hs * v, headY - 0.010 * v, 0], [headX + 0.44 * hs * v, headY - 0.017 * v, 0]], [[0.052 * v, 0.048 * v], [0.032 * v, 0.030 * v], [0.006 * v, 0.010 * v]], C.dark, 'chisel-bill', { steps: 7, radial: 7, ...hp });
    for (let i = 0; i < 5; i++) sweep(parts, [[-0.20 * v, 0.30 * u, (i - 2) * 0.030 * v], [-0.40 * v, 0.13 * u, (i - 2) * 0.036 * v], [-0.50 * v, 0.01 * v, (i - 2) * 0.040 * v]], [[0.040 * v, 0.018 * v], [0.038 * v, 0.014 * v], [0.014 * v, 0.005 * v]], i % 2 ? C.dark : C.skin, 'stiff-tail-' + i, { steps: 6, radial: 6 });
  } else {
    sweep(parts, [[headX + 0.135 * v, headY - 0.014 * v, 0], [headX + (puffin ? 0.31 : 0.28) * hs * v, headY - 0.036 * v, 0], [headX + (puffin ? 0.32 : 0.27) * hs * v, headY - 0.12 * v, 0]], [[0.060 * v, (puffin ? 0.12 : 0.053) * v], [0.035 * v, 0.043 * v], [0.003 * v, 0.002 * v]], C.detail, 'beak', { steps: 6, radial: 7, ...hp });
  }
  if (crested) {
    // A single swept-back crest wedge in the body colour, not a fan of pale spikes.
    prism(parts, [[headX + 0.06 * v, headY + 0.14 * v, 0], [headX - 0.12 * v, headY + 0.33 * v, 0], [headX - 0.28 * v, headY + 0.23 * v, 0], [headX - 0.16 * v, headY + 0.11 * v, 0]], [0, 0, 0.030 * v], C.skin, 'crest', hp);
    prism(parts, [[headX + 0.06 * v, headY + 0.14 * v, -0.030 * v], [headX - 0.12 * v, headY + 0.33 * v, -0.030 * v], [headX - 0.28 * v, headY + 0.23 * v, -0.030 * v], [headX - 0.16 * v, headY + 0.11 * v, -0.030 * v]], [0, 0, 0.030 * v], C.skin, 'crest-b', hp);
    if (config.id === 'northern-cardinal') {
      // Black face mask wrapping the bill base and throat.
      ellipsoid(parts, headX + 0.15 * v, headY - 0.05 * v, 0, 0.11 * hs * v, 0.10 * hs * v, 0.13 * hs * v, C.dark, 'face-mask', 10, 0, hp);
    }
    if (config.id === 'blue-jay') {
      // Black necklace and white face patch.
      const g = new THREE.TorusGeometry(0.19 * v, 0.020 * v, 5, 20); g.rotateX(Math.PI / 2 + 0.35); g.translate(0.12 * v, 0.75 * u, 0); parts.push({ g, c: C.dark, n: 'necklace', ...hp });
      ellipsoid(parts, headX + 0.14 * v, headY - 0.01 * v, 0, 0.10 * hs * v, 0.09 * hs * v, 0.12 * hs * v, C.underside, 'face-patch', 10, 0, hp);
    }
  }
  if (woodpecker) ellipsoid(parts, headX - 0.12 * v, headY + 0.15 * v, 0, 0.055 * v, 0.030 * v, 0.060 * v, C.detail, 'red-nape', 8, 0, hp);
  for (let i = 0; i < 5; i++) sweep(parts, [[-0.21 * v, 0.34 * u, (i - 2) * 0.034 * v], [-0.43 * v, 0.24 * u, (i - 2) * 0.043 * v], [-0.56 * v, 0.20 * u, (i - 2) * 0.055 * v]], [[0.042 * v, 0.021 * v], [0.045 * v, 0.017 * v], [0.018 * v, 0.005 * v]], i % 2 ? C.accent : C.underside, 'tail-feather-' + i, { steps: 6, radial: 6 });
}

function fish(parts, glass, p, C, config) {
  // u = axial (nose-to-tail stations stretch); v = girth unit (depth/height/fins stay put).
  const u = p.bodyLength, v = config.length || p.bodyLength, shark = config.variant === 'shark', y = 0.42 * v, mass = p.bodyMass, fin = p.finSize, tail = p.tailLength;
  const seal = config.id === 'harp-seal', dolphin = config.id === 'bottlenose-dolphin', whale = config.id === 'humpback-whale', manta = config.id === 'manta-ray', tang = config.id === 'yellow-tang', lionfish = config.id === 'lionfish', marineMammal = seal || dolphin || whale;
  const noseX = 0.52 * u, rumpX = -0.43 * u;
  const path = [[-0.49 * u, y, 0], [-0.26 * u, y, 0], [0.1 * u, y + 0.02 * v, 0], [0.36 * u, y, 0], [0.52 * u, y - 0.035 * v, 0]];
  const radii = manta
    ? [[0.020 * v, 0.020 * v], [0.30 * mass * v, 0.065 * mass * v], [0.44 * mass * v, 0.085 * mass * v], [0.30 * mass * v, 0.060 * mass * v], [0.10 * mass * v, 0.045 * mass * v]]
    : [[0.025 * v, 0.032 * v], [0.11 * mass * v, (shark ? 0.15 : 0.24) * mass * v], [0.155 * mass * v, (shark ? 0.19 : 0.31) * mass * v], [0.11 * mass * v, (shark ? 0.13 : 0.21) * mass * v], [0.008 * v, 0.021 * v]];
  if (config.variant === 'seahorse') {
    // Upright animal: stature (Y) follows length, cross-sections stay fixed.
    const m = mass;
    sweep(parts, [[0.02 * v, 0.86 * u, 0], [-0.06 * v, 0.72 * u, 0], [-0.04 * v, 0.58 * u, 0], [-0.08 * v, 0.42 * u, 0], [-0.02 * v, 0.24 * u, 0], [0.02 * v, 0.12 * u, 0], [0.10 * v, 0.06 * u, 0], [0.10 * v, 0.13 * u, 0]], [0.075 * m * v, 0.085 * m * v, 0.070 * m * v, 0.095 * m * v, 0.060 * m * v, 0.035 * v, 0.018 * v, 0.004 * v], C.skin, 'body', { steps: 30, radial: p.seg });
    sweep(parts, [[0.06 * v, 0.82 * u, 0], [0.16 * v, 0.80 * u, 0], [0.20 * v, 0.79 * u, 0]], [0.035 * v, 0.022 * v, 0.012 * v], C.skin, 'snout', { steps: 6, radial: 8 });
    ellipsoid(parts, 0.205 * v, 0.79 * u, 0, 0.010 * v, 0.012 * v, 0.011 * v, C.dark, 'mouth', 8);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ellipsoid(parts, Math.cos(a) * 0.030 * v, 0.935 * u + (i === 0 ? 0.012 : 0) * v, Math.sin(a) * 0.030 * v, 0.011 * v, 0.016 * v, 0.011 * v, C.detail, 'coronet-' + i, 6); }
    for (const s of [-1, 1]) {
      ellipsoid(parts, 0.05 * v, 0.86 * u, s * 0.070 * v, 0.020 * v, 0.024 * v, 0.018 * v, C.dark, 'eye-' + s, 10);
      ellipsoid(parts, 0.062 * v, 0.872 * u, s * 0.082 * v, 0.007 * v, 0.008 * v, 0.006 * v, C.underside, 'eye-glint-' + s, 8);
      ellipsoid(parts, -0.06 * v, 0.68 * u, s * 0.095 * v, 0.050 * v, 0.040 * v, 0.008 * v, C.accent, 'pectoral-fin-' + s, 8);
    }
    prism(parts, [[-0.13 * v, 0.56 * u, -0.006 * v], [-0.27 * v, 0.45 * u, -0.006 * v], [-0.13 * v, 0.34 * u, -0.006 * v]], [0, 0, 0.012 * v], C.accent, 'dorsal-fin');
    for (const ty of [0.55, 0.45, 0.35, 0.25]) addWire(parts, [-0.13 * v, ty * u, 0], [-0.21 * v, (ty + 0.02) * u, 0], C.detail, 0.008 * v, 5, 'dorsal-spine-' + ty);
    return;
  }
  if (manta) {
    // A manta is a flying diamond, not a flattened shark. Build a broad continuous wing plane.
    const t = 0.040 * v, wing = 0.88 * p.finSize * v;
    prism(parts, [[0.52 * u, y + 0.01 * v, 0], [0.28 * u, y + 0.05 * v, wing * 0.35], [-0.12 * u, y + 0.02 * v, wing], [-0.57 * u, y, wing * 0.40], [-0.69 * u, y - 0.01 * v, 0], [-0.57 * u, y, -wing * 0.40], [-0.12 * u, y + 0.02 * v, -wing], [0.28 * u, y + 0.05 * v, -wing * 0.35]], [0, -t, 0], C.skin, 'wing-disc');
    prism(parts, [[noseX - 0.02 * v, y + 0.02 * v, 0], [noseX + 0.09 * v, y + 0.035 * v, 0.14 * v], [noseX + 0.15 * v, y - 0.02 * v, 0], [noseX + 0.09 * v, y + 0.035 * v, -0.14 * v]], [0, -t * 0.8, 0], C.underside, 'mouth-lobes');
    for (const side of [-1, 1]) {
      sweep(parts, [[noseX - 0.09 * v, y, side * 0.12 * v], [noseX + 0.01 * v, y - 0.01 * v, side * 0.17 * v], [noseX + 0.06 * v, y - 0.06 * v, side * 0.08 * v]], [0.035 * v, 0.022 * v, 0.004 * v], C.skin, 'cephalic-fin-' + side, { steps: 8, radial: 6 });
      ellipsoid(parts, noseX - 0.14 * v, y + 0.047 * v, side * 0.105 * v, 0.024 * v, 0.018 * v, 0.018 * v, C.dark, 'eye-' + side, 8);
      ellipsoid(parts, noseX - 0.125 * v, y + 0.060 * v, side * 0.118 * v, 0.008 * v, 0.007 * v, 0.006 * v, C.underside, 'eye-glint-' + side, 6);
    }
    sweep(parts, [[-0.66 * u, y - 0.015 * v, 0], [-0.66 * u - 0.31 * v, y - 0.06 * v, 0.03 * v], [-0.66 * u - 0.69 * v, y - 0.10 * v, 0.08 * v]], [0.020 * v, 0.009 * v, 0.001 * v], C.skin, 'whip-tail', { steps: 16, radial: 6, rig: 'tail', pivot: [-0.66 * u, y, 0] });
    return;
  }
  if (tang) {
    // Laterally compressed reef fish: deep, almost disc-shaped body and tall continuous fins.
    ellipsoid(parts, -0.02 * u, y, 0, 0.34 * u, 0.31 * mass * v, 0.115 * mass * v, C.skin, 'deep-body', p.seg, 0.04);
    ellipsoid(parts, 0.05 * u, y - 0.105 * v, 0, 0.25 * u, 0.18 * mass * v, 0.119 * mass * v, C.underside, 'belly', p.seg);
    prism(parts, [[-0.27 * u, y + 0.17 * v, 0], [-0.05 * u, y + 0.39 * p.finSize * v, 0], [0.24 * u, y + 0.19 * v, 0]], [0, 0, 0.016 * v], C.accent, 'sail-dorsal');
    prism(parts, [[-0.26 * u, y - 0.14 * v, 0], [-0.02 * u, y - 0.30 * p.finSize * v, 0], [0.23 * u, y - 0.13 * v, 0]], [0, 0, 0.016 * v], C.accent, 'sail-anal');
    prism(parts, [[-0.30 * u, y, -0.015 * v], [-0.30 * u - 0.27 * v, y + 0.22 * v, -0.008 * v], [-0.30 * u - 0.18 * v, y, 0], [-0.30 * u - 0.27 * v, y - 0.22 * v, -0.008 * v]], [0, 0, 0.016 * v], C.accent, 'crescent-tail', { rig: 'tail', pivot: [-0.28 * u, y, 0] });
    for (const side of [-1, 1]) {
      const tangFront = -0.02 * u + 0.34 * u;
      ellipsoid(parts, tangFront - 0.075 * v, y + 0.085 * v, side * 0.105 * mass * v, 0.032 * v, 0.034 * v, 0.018 * v, C.dark, 'eye-' + side, 10);
      ellipsoid(parts, tangFront - 0.054 * v, y + 0.103 * v, side * 0.118 * mass * v, 0.010 * v, 0.010 * v, 0.006 * v, C.underside, 'eye-glint-' + side, 7);
      prism(parts, [[0.05 * u, y, side * 0.09 * mass * v], [-0.11 * u, y - 0.05 * v, side * 0.31 * v], [-0.16 * u, y + 0.04 * v, side * 0.10 * mass * v]], [0, 0.012 * v, 0], C.accent, 'pectoral-fin-' + side);
    }
    return;
  }
  const curve = sweep(parts, path, radii, C.skin, 'body', { steps: 28, radial: p.seg });
  if (!shark && !marineMammal && !lionfish) for (const [a, b] of [[0.18, 0.26], [0.48, 0.57], [0.74, 0.82]]) sweep(parts, path, radii.map(r => r.map(x => x * 1.008)), C.underside, 'body-band-' + a, { curve, from: a, to: b, steps: 4, radial: p.seg });
  else ellipsoid(parts, 0.04 * u, y - 0.087 * mass * v, 0, 0.38 * u, 0.105 * mass * v, 0.12 * mass * v, C.underside, 'belly', p.seg);
  const tp = { rig: 'tail', pivot: [rumpX, y, 0] };
  if (dolphin || whale) prism(parts, [[-0.44 * u, y, 0], [-0.44 * u - 0.34 * tail * v, y, -0.30 * fin * v], [-0.44 * u - 0.18 * tail * v, y, 0], [-0.44 * u - 0.34 * tail * v, y, 0.30 * fin * v]], [0, 0.02 * v, 0], C.accent, 'flukes', tp);
  else prism(parts, [[-0.45 * u, y, -0.018 * v], [-0.45 * u - (0.05 + 0.28 * tail) * v, y + (shark ? 0.35 : 0.26) * fin * v, -0.008 * v], [-0.45 * u - (0.05 + 0.20 * tail) * v, y + 0.025 * v, -0.004 * v], [-0.45 * u - (0.05 + 0.27 * tail) * v, y - 0.25 * fin * v, -0.008 * v]], [0, 0, 0.02 * v], C.accent, 'caudal-fin', tp);
  if (!seal && !manta) { const dfin = whale ? 0.3 : fin; prism(parts, [[-0.24 * u, y + 0.18 * mass * v, -0.009 * v], [-0.075 * u, y + (shark ? 0.48 : 0.40) * dfin * v, -0.009 * v], [0.17 * u, y + 0.19 * mass * v, -0.009 * v]], [0, 0, 0.018 * v], C.accent, 'dorsal-fin'); }
  if (dolphin) sweep(parts, [[noseX - 0.06 * v, y - 0.03 * v, 0], [noseX + 0.06 * v, y - 0.045 * v, 0], [noseX + 0.14 * v, y - 0.05 * v, 0]], [0.035 * v, 0.020 * v, 0.008 * v], C.skin, 'beak', { steps: 6, radial: 8 });
  if (lionfish) {
    // Tall venomous dorsal spines and a fan of striped pectoral rays are the lionfish signature.
    for (let i = 0; i < 7; i++) {
      const a = 0.16 + i * 0.095;
      sweep(parts, path, radii.map(r => r.map(x => x * 1.012)), i % 2 ? C.dark : C.underside, 'body-stripe-' + i, { curve, from: a, to: a + 0.032, steps: 3, radial: p.seg });
    }
    for (let i = 0; i < 13; i++) {
      const x = (-0.27 + i * 0.042) * u, height = (0.19 + 0.15 * Math.sin(i / 12 * Math.PI)) * p.finSize * v;
      sweep(parts, [[x, y + 0.18 * mass * v, 0], [x - 0.025 * v, y + height * 0.72, 0], [x - 0.040 * v, y + height, 0]], [0.010 * v, 0.005 * v, 0.001 * v], i % 2 ? C.accent : C.detail, 'dorsal-spine-' + i, { steps: 5, radial: 5 });
    }
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
      const a = -0.95 + i * 0.24, baseX = 0.06 * u;
      const end = [baseX + (-0.08 + Math.cos(a) * 0.34) * v, y - 0.05 * v + Math.sin(a) * 0.20 * v, side * (0.11 + i * 0.030) * v];
      sweep(parts, [[baseX, y, side * 0.13 * mass * v], [(baseX + end[0]) / 2, (y + end[1]) / 2, side * 0.28 * v], end], [0.012 * v, 0.007 * v, 0.002 * v], i % 2 ? C.detail : C.accent, `pectoral-ray-${side}-${i}`, { steps: 7, radial: 5 });
    }
  }
  for (const s of [-1, 1]) {
    prism(parts, [[0.16 * u, y - 0.07 * v, s * 0.10 * mass * v], [-0.16 * u, y - 0.17 * fin * v, s * 0.40 * fin * v], [-0.08 * u, y + 0.01 * v, s * 0.11 * mass * v]], [0, 0.011 * v, 0], C.accent, 'pectoral-fin-' + s);
    // Eye pushed out onto the flank so it reads clearly against the swept body.
    ellipsoid(parts, noseX - 0.155 * v, y + 0.075 * v, s * 0.120 * mass * v, 0.034 * v, 0.037 * v, 0.022 * v, C.dark, 'eye-' + s, 10);
    ellipsoid(parts, noseX - 0.134 * v, y + 0.095 * v, s * 0.133 * mass * v, 0.012 * v, 0.013 * v, 0.008 * v, C.underside, 'eye-glint-' + s, 8);
    for (let i = 0; i < (marineMammal ? 0 : shark ? 5 : 1); i++) sweep(parts, [[noseX - (0.31 + i * 0.027) * v, y + 0.085 * v, s * 0.13 * mass * v], [noseX - (0.34 + i * 0.027) * v, y, s * 0.145 * mass * v], [noseX - (0.30 + i * 0.027) * v, y - 0.065 * v, s * 0.12 * mass * v]], [0.0035 * v, 0.004 * v, 0.002 * v], C.dark, `gill-${s}-${i}`, { steps: 5, radial: 4 });
  }
}

function reptile(parts, glass, p, C, config) {
  // u = axial stations along the spine; v = girth unit for heights, widths and thicknesses.
  const u = p.bodyLength, v = config.length || p.bodyLength, mass = p.bodyMass, turtle = config.variant === 'turtle', y = (turtle ? 0.20 : 0.13) * v;
  const alligator = config.id === 'american-alligator', iguana = config.id === 'green-iguana', chameleon = config.id === 'panther-chameleon', komodo = config.id === 'komodo-dragon', axolotl = config.id === 'axolotl', salamander = config.id === 'fire-salamander', newt = config.id === 'alpine-newt';
  const hp = { rig: 'head', pivot: [0.38 * u, y, 0] };
  if (turtle) {
    const boxTurtle = config.id === 'eastern-box-turtle', domeH = boxTurtle ? 0.44 : 0.25, domeW = boxTurtle ? 0.42 : 0.36;
    const rings = 7, segments = 20, point = (r, j) => { const theta = j / segments * Math.PI * 2, phi = r / rings * Math.PI / 2; return [Math.sin(phi) * Math.cos(theta) * 0.48 * u, y + Math.cos(phi) * domeH * mass * v, Math.sin(phi) * Math.sin(theta) * domeW * mass * v]; };
    for (let r = 0; r < rings; r++) for (let j = 0; j < segments; j++) addQuad(parts, point(r, j), point(r + 1, j), point(r + 1, j + 1), point(r, j + 1), (Math.floor(j / 4) + Math.floor(r / 2)) % 3 === 0 ? C.accent : C.skin, `shell-panel-${r}-${j}`, 0.006 * v);
    ellipsoid(parts, 0, y - 0.012 * v, 0, 0.47 * u, 0.045 * v, 0.35 * mass * v, C.underside, 'plastron', p.seg);
    for (let j = 0; j < segments; j += 4) for (let r = 1; r < rings; r++) addWire(parts, point(r, j).map((w, i) => i === 1 ? w + 0.002 * v : w), point(r + 1, j).map((w, i) => i === 1 ? w + 0.002 * v : w), C.dark, 0.0025 * v, 4, `scute-seam-${j}-${r}`);
    for (const r of [3, 5]) for (let j = 0; j < segments; j++) addWire(parts, point(r, j), point(r, j + 1), C.dark, 0.002 * v, 4, `shell-ring-${r}-${j}`);
    sweep(parts, [[-0.41 * u, y - 0.025 * v, 0], [-0.41 * u - 0.12 * v, y - 0.055 * v, 0], [-0.41 * u - 0.19 * v, y - 0.068 * v, 0]], [0.042 * v, 0.022 * v, 0.002 * v], C.skin, 'tail-tip', { steps: 8, radial: 7, rig: 'tail', pivot: [-0.41 * u, y - 0.025 * v, 0] });
  } else {
    const bodyProfile = alligator ? [[0.070 * v, 0.058 * v], [0.205 * mass * v, 0.115 * mass * v], [0.155 * mass * v, 0.090 * mass * v]]
      : komodo ? [[0.050 * v, 0.060 * v], [0.165 * mass * v, 0.125 * mass * v], [0.090 * mass * v, 0.075 * mass * v]]
      : axolotl || salamander || newt ? [[0.075 * v, 0.062 * v], [0.215 * mass * v, 0.150 * mass * v], [0.125 * mass * v, 0.105 * mass * v]]
      : [[0.04 * v, 0.05 * v], [0.13 * mass * v, 0.1 * mass * v], [0.07 * v, 0.065 * v]];
    sweep(parts, [[-0.44 * u, y, 0], [-0.1 * u, y + 0.02 * v, 0], [0.37 * u, y, 0]], bodyProfile, C.skin, 'body', { steps: 18, radial: p.seg });
    const amphibian = axolotl || salamander || newt;
    const tailProfile = alligator ? [0.090 * v, 0.070 * v, 0.035 * v, 0.001 * v] : amphibian ? [0.115 * mass * v, 0.085 * v, 0.045 * v, 0.004 * v] : [0.06 * v, 0.045 * v, 0.02 * v, 0.001 * v];
    const rumpX = -0.38 * u;
    const tailPath = chameleon
      ? [[rumpX, y, 0], [rumpX - 0.26 * v, y * 0.9, 0.05 * v], [rumpX - 0.45 * v, y + 0.02 * v, 0.16 * v], [rumpX - 0.38 * v, y + 0.14 * v, 0.25 * v], [rumpX - 0.20 * v, y + 0.20 * v, 0.18 * v], [rumpX - 0.14 * v, y + 0.15 * v, 0.065 * v]]
      : amphibian
      ? [[rumpX, y, 0], [rumpX - 0.22 * v, y * 0.96, 0.02 * v], [rumpX - 0.44 * v, y * 0.90, 0.05 * v], [rumpX - 0.60 * v, y * 0.86, 0.03 * v]]
      : [[rumpX, y, 0], [rumpX - 0.32 * v, y * 0.8, 0.035 * v], [rumpX - 0.75 * v, 0.065 * v, 0.16 * v], [rumpX - 0.97 * v, 0.06 * v, 0.06 * v]];
    sweep(parts, tailPath, tailProfile, C.skin, chameleon ? 'curled-tail' : 'tail-tip', { steps: chameleon ? 30 : 24, radial: 9, rig: 'tail', pivot: [rumpX, y, 0] });
    if (alligator) {
      // A low saw of scutes is the landmark silhouette that keeps an alligator from reading as a rounded lizard.
      for (let i = 0; i < 15; i++) {
        const x = (-0.54 - i * 0.055) * u, h = (0.065 - i * 0.0032) * v;
        prism(parts, [[x - 0.035 * v, y + 0.055 * v, 0], [x, y + 0.055 * v + Math.max(0.010 * v, h), 0], [x + 0.040 * v, y + 0.055 * v, 0]], [0, 0, 0.032 * v], C.accent, 'tail-scute-' + i);
      }
      for (let i = 0; i < 7; i++) for (const side of [-1, 1]) ellipsoid(parts, (-0.20 + i * 0.075) * u, y + 0.112 * mass * v, side * 0.115 * mass * v, 0.032 * v, 0.021 * v, 0.025 * v, C.accent, `back-scute-${side}-${i}`, 6);
    } else if (iguana) {
      for (let i = 0; i < 13; i++) {
        const x = (-0.36 + i * 0.065) * u, h = (0.035 + Math.sin(i / 12 * Math.PI) * 0.060) * v;
        prism(parts, [[x - 0.025 * v, y + 0.090 * mass * v, 0], [x, y + 0.090 * mass * v + h, 0], [x + 0.025 * v, y + 0.090 * mass * v, 0]], [0, 0, 0.014 * v], C.accent, 'dorsal-crest-' + i);
      }
    } else if (!axolotl && !salamander && !newt) {
      for (let i = 0; i < 9; i++) ellipsoid(parts, (-0.3 + i * 0.07) * u, y + 0.087 * mass * v, 0, 0.02 * v, 0.018 * v, 0.023 * v, C.accent, 'dorsal-scale-' + i, 6);
    }
    if (axolotl || newt) {
      // A modest paddle fin follows the shortened amphibian tail instead of a big angular wing.
      const fh = axolotl ? 0.115 : 0.085, tbX = -0.38 * u;
      const tailFin = new THREE.Shape();
      tailFin.moveTo(tbX + 0.04 * v, y + 0.05 * v);
      tailFin.quadraticCurveTo(tbX - 0.28 * v, y + fh * v, tbX - 0.59 * v, y * 0.88);
      tailFin.quadraticCurveTo(tbX - 0.28 * v, y + 0.02 * v, tbX + 0.04 * v, y + 0.05 * v);
      addExtrusion(parts, tailFin, 0.012 * v, C.accent, 'tail-fin', { position: [0, 0, -0.006 * v] });
      const bellyFin = new THREE.Shape();
      bellyFin.moveTo(tbX + 0.02 * v, y - 0.03 * v);
      bellyFin.quadraticCurveTo(tbX - 0.28 * v, y - fh * 0.7 * v, tbX - 0.57 * v, y * 0.84);
      bellyFin.quadraticCurveTo(tbX - 0.28 * v, y - 0.01 * v, tbX + 0.02 * v, y - 0.03 * v);
      addExtrusion(parts, bellyFin, 0.012 * v, C.accent, 'ventral-fin', { position: [0, 0, -0.006 * v] });
    }
    if (salamander) {
      for (let i = 0; i < 12; i++) {
        const x = (-0.35 + (i % 6) * 0.14) * u, z = (i < 6 ? -1 : 1) * (0.035 + (i % 3) * 0.035) * v;
        ellipsoid(parts, x, y + 0.085 * v, z, 0.035 * v, 0.015 * v, 0.027 * v, C.underside, 'warning-spot-' + i, 6);
      }
    }
  }
  const reptileHead = turtle ? { x: 0.52, rx: 0.145, ry: 0.085, rz: 0.125, snout: 0.16, wide: 0.090, tall: 0.052 }
    : alligator ? { x: 0.61, rx: 0.190, ry: 0.078, rz: 0.145, snout: 0.46, wide: 0.155, tall: 0.050 }
    : komodo ? { x: 0.61, rx: 0.180, ry: 0.095, rz: 0.105, snout: 0.34, wide: 0.105, tall: 0.060 }
    : chameleon ? { x: 0.60, rx: 0.150, ry: 0.100, rz: 0.105, snout: 0.19, wide: 0.080, tall: 0.052 }
    : axolotl || salamander || newt ? { x: 0.58, rx: 0.180, ry: 0.090, rz: 0.145, snout: salamander || newt ? 0.20 : 0.16, wide: 0.130, tall: 0.052 }
    : { x: 0.60, rx: 0.155, ry: 0.085, rz: 0.085, snout: 0.23, wide: 0.080, tall: 0.050 };
  const headStaX = reptileHead.x * u;
  sweep(parts, [[0.32 * u, y, 0], [(reptileHead.x - 0.12) * u, y + 0.01 * v, 0], [headStaX, y + 0.025 * v, 0]], [0.068 * v, reptileHead.rz * 0.85 * p.headSize * v, reptileHead.rz * 0.60 * p.headSize * v], C.skin, 'neck', { steps: 7, radial: 9 });
  ellipsoid(parts, headStaX, y + 0.02 * v, 0, reptileHead.rx * p.headSize * v, reptileHead.ry * p.headSize * v, reptileHead.rz * p.headSize * v, C.skin, 'head-cranium', p.seg, 0, hp);
  const snoutStart = headStaX + reptileHead.rx * 0.35 * v, snoutEnd = headStaX + reptileHead.snout * v;
  sweep(parts, [[snoutStart, y + 0.012 * v, 0], [snoutEnd - 0.075 * v, y + 0.004 * v, 0], [snoutEnd, y - 0.002 * v, 0]], [[reptileHead.wide * p.headSize * v, reptileHead.tall * p.headSize * v], [reptileHead.wide * 0.92 * p.headSize * v, reptileHead.tall * 0.84 * p.headSize * v], [reptileHead.wide * 0.68 * p.headSize * v, reptileHead.tall * 0.55 * p.headSize * v]], C.skin, 'elongated-snout', { steps: alligator ? 12 : 8, radial: 9, ...hp });
  sweep(parts, [[snoutStart + 0.025 * v, y - 0.032 * v, 0], [snoutEnd - 0.065 * v, y - 0.037 * v, 0], [snoutEnd + 0.01 * v, y - 0.030 * v, 0]], [[reptileHead.wide * 0.86 * p.headSize * v, 0.027 * v], [reptileHead.wide * 0.77 * p.headSize * v, 0.023 * v], [reptileHead.wide * 0.58 * p.headSize * v, 0.014 * v]], C.underside, 'lower-jaw', { steps: 8, radial: 8, ...hp });
  for (const side of [-1, 1]) ellipsoid(parts, snoutEnd - 0.035 * v, y + reptileHead.tall * 0.58 * v, side * reptileHead.wide * 0.52 * v, 0.015 * v, 0.010 * v, 0.014 * v, C.dark, 'nostril-' + side, 8, 0, hp);
  if (alligator) {
    for (const side of [-1, 1]) for (let tooth = 0; tooth < 9; tooth++) {
      const tx = snoutStart + (0.06 + tooth * 0.037) * v, tz = side * (reptileHead.wide * 0.88 - tooth * 0.004) * v;
      addCylinder(parts, 0.004 * v, 0.001 * v, (0.020 + (tooth % 3) * 0.004) * v, 5, tx, y - 0.038 * v, tz, 0, 0, 0, C.underside, `tooth-${side}-${tooth}`);
    }
  }
  if (iguana) {
    ellipsoid(parts, headStaX + 0.09 * v, y - 0.08 * v, 0, 0.13 * v, 0.14 * v, 0.015 * v, C.accent, 'dewlap', 10, 0, hp);
  }
  if (chameleon) {
    ellipsoid(parts, headStaX - 0.10 * v, y + 0.15 * v, 0, 0.065 * v, 0.11 * v, 0.060 * v, C.accent, 'casque', 8, 0, hp);
  }
  if (axolotl) for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    // Three feathery stalks per side, each fringed with fine filaments.
    const root = [headStaX - 0.11 * v, y + (0.035 - i * 0.022) * v, side * 0.115 * v];
    const tip = [headStaX - (0.22 + i * 0.035) * v, y + (0.115 + i * 0.030) * v, side * (0.215 + i * 0.022) * v];
    const mid = [(root[0] + tip[0]) / 2, (root[1] + tip[1]) / 2 + 0.012 * v, (root[2] + tip[2]) / 2];
    sweep(parts, [root, mid, tip], [0.014 * v, 0.010 * v, 0.004 * v], C.detail, `gill-stalk-${side}-${i}`, { steps: 8, radial: 6, ...hp });
    for (let f = 1; f <= 5; f++) {
      const t = f / 6;
      const bx = root[0] + (tip[0] - root[0]) * t, by = root[1] + (tip[1] - root[1]) * t, bz = root[2] + (tip[2] - root[2]) * t;
      for (const dir of [-1, 1]) sweep(parts, [[bx, by, bz], [bx - 0.018 * v, by + dir * 0.026 * v, bz + side * 0.020 * v]], [0.005 * v, 0.001 * v], C.accent, `gill-filament-${side}-${i}-${f}-${dir}`, { steps: 3, radial: 4, ...hp });
    }
  }
  if (newt) ellipsoid(parts, 0.08 * u, y - 0.045 * v, 0, 0.22 * v, 0.032 * v, 0.09 * v, C.underside, 'orange-belly', 8);
  for (const s of [-1, 1]) {
    // Eyes follow each skull surface. Crocodilian eyes sit high and lateral; chameleon eyes are turreted.
    const hrR = { x: reptileHead.rx * p.headSize * v, y: reptileHead.ry * p.headSize * v, z: reptileHead.rz * p.headSize * v };
    const dR = alligator ? [0.20, 0.82, 0.78 * s] : chameleon ? [0.02, 0.48, 0.94 * s] : [0.42, 0.34, 0.84 * s];
    const dlR = Math.hypot(dR[0], dR[1], dR[2]);
    const exR = headStaX + hrR.x * (dR[0] / dlR) * 1.06, eyR = y + 0.02 * v + hrR.y * (dR[1] / dlR) * 1.06, ezR = hrR.z * (dR[2] / dlR) * 1.06;
    if (chameleon) ellipsoid(parts, exR - 0.006 * v, eyR, ezR, 0.052 * v, 0.050 * v, 0.047 * v, C.skin, 'eye-turret-' + s, 10, 0, hp);
    ellipsoid(parts, exR + (alligator ? 0.010 : 0) * v, eyR, ezR, chameleon ? 0.025 * v : alligator ? 0.026 * v : 0.030 * v, chameleon ? 0.025 * v : alligator ? 0.022 * v : 0.027 * v, chameleon ? 0.018 * v : alligator ? 0.018 * v : 0.020 * v, C.dark, 'eye-' + s, 10, 0, hp);
    ellipsoid(parts, exR + 0.019 * v, eyR + 0.015 * v, ezR + s * 0.012 * v, 0.010 * v, 0.010 * v, 0.008 * v, C.underside, 'eye-glint-' + s, 8, 0, hp);
    for (const front of [false, true]) {
      const x = (front ? 0.26 : -0.29) * u;
      if (turtle && config.id === 'eastern-box-turtle') {
        // Short columnar legs tucked under the dome, ending in a clawed pad.
        const lx = (front ? 0.22 : -0.26) * u, lz = s * 0.30 * mass * v;
        sweep(parts, [[lx, y - 0.02 * v, lz * 0.9], [lx + (front ? 0.04 : -0.03) * v, 0.09 * v, lz + s * 0.04 * v], [lx + (front ? 0.06 : -0.04) * v, 0.03 * v, lz + s * 0.06 * v]], [0.075 * v, 0.062 * v, 0.058 * v], C.skin, `leg-${s}-${front}`, { steps: 6, radial: 8 });
        ellipsoid(parts, lx + (front ? 0.07 : -0.05) * v, 0.022 * v, lz + s * 0.06 * v, 0.072 * v, 0.024 * v, 0.062 * v, C.accent, `foot-${s}-${front}`, 8);
        for (let claw = -1; claw <= 1; claw++) ellipsoid(parts, lx + (front ? 0.13 : -0.11) * v, 0.016 * v, lz + s * 0.06 * v + claw * 0.026 * v, 0.020 * v, 0.008 * v, 0.008 * v, C.dark, `claw-${s}-${front}-${claw}`, 6);
      } else if (turtle) sweep(parts, [[x, y - 0.025 * v, s * 0.22 * mass * v], [x - 0.07 * v, 0.10 * v, s * 0.44 * v], [x - (front ? 0.25 : 0.13) * v, 0.045 * v, s * (front ? 0.67 : 0.50) * v]], [[0.105 * v, 0.04 * v], [0.12 * v, 0.025 * v], [0.005 * v, 0.004 * v]], C.accent, `flipper-${s}-${front}`, { steps: 12, radial: 8 });
      else {
        sweep(parts, [[x, y, s * 0.06 * v], [x - 0.08 * v, 0.10 * v, s * 0.21 * v], [x + 0.02 * v, 0.025 * v, s * 0.31 * v]], [0.045 * v, 0.027 * v, 0.012 * v], C.skin, `leg-${s}-${front}`, { steps: 8, radial: 7 });
        for (let toe = 0; toe < 5; toe++) sweep(parts, [[x + 0.02 * v, 0.027 * v, s * 0.31 * v], [x + (toe - 2) * 0.03 * v, 0.015 * v, s * 0.38 * v], [x + (toe - 2) * 0.042 * v, 0.009 * v, s * 0.42 * v]], [0.008 * v, 0.005 * v, 0.001 * v], C.accent, `toe-${s}-${front}-${toe}`, { steps: 5, radial: 5 });
      }
    }
  }
}

function frog(parts, glass, p, C, config) {
  const u = p.bodyLength, v = config.length || p.bodyLength, mass = p.bodyMass, leg = p.legLength, hs = p.headSize;
  const toad = config.id === 'common-toad', bullfrog = config.id === 'american-bullfrog', glassfrog = config.id === 'glass-frog', dart = config.id === 'poison-dart-frog';
  const bodyY = toad ? 0.22 * v : 0.24 * v;
  // One continuous rump-to-snout sweep keeps the frog from reading as stacked balls.
  const wide = (toad ? 0.30 : bullfrog ? 0.31 : 0.27) * mass * v;
  const tall = (toad ? 0.20 : bullfrog ? 0.23 : 0.21) * mass * v;
  sweep(parts, [[-0.42 * u, bodyY, 0], [-0.16 * u, bodyY + 0.03 * v, 0], [0.14 * u, bodyY + 0.05 * v, 0], [0.36 * u, bodyY + 0.02 * v, 0], [0.50 * u, bodyY - 0.02 * v, 0]],
    [[wide * 0.42, tall * 0.42], [wide, tall], [wide * 0.98, tall * 1.02], [wide * 0.74 * hs, tall * 0.80 * hs], [wide * 0.30 * hs, tall * 0.36 * hs]],
    C.skin, 'body', { steps: 22, radial: p.seg });
  ellipsoid(parts, 0.10 * u, bodyY - tall * 0.72, 0, 0.30 * v, tall * 0.52, wide * 0.86, glassfrog ? C.glass : C.underside, 'throat', p.seg);
  if (glassfrog) ellipsoid(glass, 0.02 * u, bodyY - tall * 0.55, 0, 0.21 * v, 0.055 * v, 0.18 * v, C.glass, 'translucent-belly', p.seg, 0, { zone: 'glass' });
  if (bullfrog) ellipsoid(parts, 0.30 * u, bodyY - tall * 0.55, 0, 0.13 * v, 0.065 * v, 0.13 * v, C.underside, 'vocal-sac', 12);
  for (const s of [-1, 1]) {
    // Eyes ride on the skull dome: a small skin bulge, then iris and pupil pushed along the same outward normal.
    const headX = 0.30 * u, headY = bodyY + tall * 0.55;
    const hr = { x: wide * 0.80 * hs, y: tall * 0.92 * hs, z: wide * 0.80 * hs };
    const d = [0.42, 0.74, 0.52 * s], dl = Math.hypot(d[0], d[1], d[2]);
    const nx = d[0] / dl, ny = d[1] / dl, nz = d[2] / dl;
    const ex = headX + hr.x * nx * 0.86, ey = headY + hr.y * ny * 0.86, ez = hr.z * nz * 0.86;
    const er = (toad ? 0.055 : bullfrog ? 0.062 : 0.058) * hs * v;
    ellipsoid(parts, ex, ey, ez, er * 1.12, er * 1.10, er * 1.12, C.skin, 'eye-socket-' + s, 12);
    ellipsoid(parts, ex + nx * er * 0.52, ey + ny * er * 0.52, ez + nz * er * 0.52, er * 0.82, er * 0.82, er * 0.82, toad ? C.dark : C.detail, 'iris-' + s, 12);
    ellipsoid(parts, ex + nx * er * 0.95, ey + ny * er * 0.95, ez + nz * er * 0.95, er * 0.42, er * 0.50, er * 0.42, C.dark, 'pupil-' + s, 10);
    ellipsoid(parts, ex + nx * er * 1.05 + 0.008 * v, ey + ny * er * 1.05 + 0.010 * v, ez + nz * er * 1.05, er * 0.20, er * 0.20, er * 0.20, C.underside, 'glint-' + s, 8);
    if (toad) for (let w = 0; w < 9; w++) {
      const t = w / 8, bx = (-0.34 + t * 0.62) * u, ring = Math.sqrt(Math.max(0.08, 1 - ((bx / u + 0.02) / 0.42) ** 2));
      ellipsoid(parts, bx, bodyY + tall * ring * (0.62 + (w % 3) * 0.14), s * wide * ring * (0.42 + (w % 4) * 0.16), 0.016 * v, 0.011 * v, 0.014 * v, C.accent, `wart-${s}-${w}`, 6);
    }
    if (dart) for (let stripe = 0; stripe < 2; stripe++) sweep(parts, [[-0.30 * u, bodyY + tall * (0.70 - stripe * 0.5), s * wide * (0.45 + stripe * 0.35)], [0.02 * u, bodyY + tall * (0.92 - stripe * 0.5), s * wide * (0.52 + stripe * 0.3)], [0.30 * u, bodyY + tall * (0.60 - stripe * 0.4), s * wide * (0.40 + stripe * 0.25)]], [0.010 * v, 0.011 * v, 0.003 * v], C.underside, `dart-stripe-${s}-${stripe}`, { steps: 7, radial: 4 });
    const hindScale = toad ? 0.70 : bullfrog ? 1.22 : 1.0;
    // Limb roots track body width (mass) so legs stay attached from skinny to stocky.
    ellipsoid(parts, -0.25 * u, 0.185 * v, s * 0.31 * mass * v, 0.235 * leg * hindScale * v, 0.15 * v, 0.16 * v, C.skin, 'hind-thigh-' + s, 12, -0.2);
    sweep(parts, [[-0.30 * u, 0.17 * v, s * 0.30 * mass * v], [-0.30 * u - 0.14 * leg * hindScale * v, 0.07 * v, s * 0.43 * mass * v], [-0.17 * u, 0.025 * v, s * 0.54 * leg * hindScale * mass * v]], [0.08 * v, 0.05 * v, 0.02 * v], C.accent, 'hind-leg-' + s, { steps: 10, radial: 8 });
    sweep(parts, [[0.18 * u, 0.24 * v, s * 0.17 * mass * v], [0.28 * u, 0.10 * v, s * 0.34 * leg * mass * v], [0.46 * u, 0.03 * v, s * 0.35 * leg * mass * v]], [0.05 * v, 0.031 * v, 0.018 * v], C.skin, 'foreleg-' + s, { steps: 10, radial: 8 });
    for (const front of [false, true]) for (let i = -1; i <= 1; i++) {
      const x = (front ? 0.46 : -0.17) * u, z = s * (front ? 0.35 : 0.54) * leg * mass * v, end = [x + (front ? 0.12 : 0.07) * v + i * 0.03 * v, 0.018 * v, z + s * (0.07 + i * 0.038) * v];
      sweep(parts, [[x, 0.03 * v, z], [x + 0.05 * v, 0.021 * v, z + s * 0.03 * v], end], [0.012 * v, 0.01 * v, 0.008 * v], C.detail, `finger-${s}-${front}-${i}`, { steps: 6, radial: 5 });
      ellipsoid(parts, ...end, 0.024 * v, 0.012 * v, 0.023 * v, C.detail, `toe-pad-${s}-${front}-${i}`, 8);
    }
  }
}

function butterfly(parts, glass, p, C, config) {
  const u = p.bodyLength, v = config.length || p.bodyLength, w = p.wingSpan, y = 0.26 * v;
  const dragonfly = config.id === 'dragonfly';
  if (dragonfly) {
    // Dragonflies read from their long abdomen and four independent glass wings, not a butterfly silhouette.
    sweep(parts, [[-0.62 * u, y, 0], [-0.24 * u, y + 0.015 * v, 0], [0.10 * u, y + 0.025 * v, 0]], [0.012 * v, 0.032 * p.bodyMass * v, 0.026 * v], C.skin, 'segmented-abdomen', { steps: 24, radial: 8 });
    for (let i = 0; i < 11; i++) addWire(parts, [(-0.55 + i * 0.050) * u, y, -0.023 * v], [(-0.55 + i * 0.050) * u, y, 0.023 * v], i % 2 ? C.dark : C.accent, 0.003 * v, 4, 'abdomen-ring-' + i);
    ellipsoid(parts, 0.16 * u, y + 0.03 * v, 0, 0.105 * u, 0.090 * v, 0.090 * v, C.accent, 'thorax', p.seg);
    ellipsoid(parts, 0.31 * u, y + 0.04 * v, 0, 0.095 * u, 0.080 * v, 0.10 * v, C.skin, 'head', p.seg);
    for (const s of [-1, 1]) {
      ellipsoid(parts, 0.31 * u + 0.05 * v, y + 0.06 * v, s * 0.085 * v, 0.060 * v, 0.065 * v, 0.045 * v, C.dark, 'compound-eye-' + s, 10);
      const wingRoot = [0.08 * u, y + 0.045 * v, s * 0.04 * v];
      for (const pair of [0, 1]) {
        const fore = pair === 0, xEnd = 0.08 * u + (fore ? -0.46 : 0.23) * v, zEnd = s * (0.76 + fore * 0.10) * w * v, tipX = 0.08 * u + (fore ? -0.62 : 0.04) * v;
        addQuad(glass, wingRoot, [xEnd, y + (fore ? 0.040 : 0.028) * v, zEnd], [tipX, y + 0.020 * v, zEnd + s * 0.05 * v], [0.08 * u + (fore ? -0.12 : 0.09) * v, y + 0.040 * v, s * 0.10 * v], C.glass, `wing-${s}-${pair}`, 0.002 * v);
        glass[glass.length - 1].zone = 'glass';
        for (let q = 0; q < 5; q++) addWire(parts, wingRoot, [THREE.MathUtils.lerp(xEnd, tipX, q / 4), y + 0.028 * v, THREE.MathUtils.lerp(zEnd, zEnd + s * 0.05 * v, q / 4)], C.detail, 0.0018 * v, 4, `wing-vein-${s}-${pair}-${q}`);
      }
      for (let i = 0; i < 3; i++) sweep(parts, [[(0.16 - i * 0.07) * u, y, s * 0.05 * v], [(0.23 - i * 0.12) * u, y - 0.10 * v, s * 0.14 * v], [(0.31 - i * 0.16) * u, 0.015 * v, s * 0.22 * v]], [0.010 * v, 0.007 * v, 0.002 * v], C.dark, `leg-${s}-${i}`, { steps: 6, radial: 5 });
    }
    return;
  }
  sweep(parts, [[-0.42 * u, y, 0], [-0.13 * u, y + 0.025 * v, 0], [0.29 * u, y + 0.01 * v, 0]], [0.018 * v, 0.065 * p.bodyMass * v, 0.046 * v], C.dark, 'body', { steps: 15, radial: p.seg });
  ellipsoid(parts, 0.32 * u, y + 0.01 * v, 0, 0.085 * v, 0.076 * v, 0.075 * v, C.dark, 'head-cranium', p.seg, 0, { rig: 'head', pivot: [0.27 * u, y, 0] });
  for (const s of [-1, 1]) {
    // Butterfly eyes: a light eye with a dark pupil, set on the head surface.
    const hrB = { x: 0.085 * v, y: 0.076 * v, z: 0.075 * v };
    const dB = [0.30, 0.20, 0.93 * s], dlB = Math.hypot(dB[0], dB[1], dB[2]);
    const bx = 0.32 * u + hrB.x * (dB[0] / dlB) * 1.02, by = y + 0.01 * v + hrB.y * (dB[1] / dlB) * 1.02, bz = hrB.z * (dB[2] / dlB) * 1.02;
    ellipsoid(parts, bx, by, bz, 0.028 * v, 0.030 * v, 0.022 * v, C.underside, `eye-${s}`, 8);
    ellipsoid(parts, bx + 0.017 * v, by + 0.014 * v, bz + s * 0.013 * v, 0.013 * v, 0.014 * v, 0.010 * v, C.dark, `eye-pupil-${s}`, 8);
    const extra = { rig: s === 1 ? 'left-wing' : 'right-wing', pivot: [0, y, s * 0.04 * v] };
    for (const fore of [true, false]) {
      const anchor = fore ? 0.10 : -0.13, anchorX = anchor * u;
      const makeWing = (inset) => {
        const shape = new THREE.Shape(), sc = inset ? 0.88 : 1, wing = fore ? 1 : 0.78;
        const coords = (x, z) => [anchorX + (x - anchor) * v * sc * wing, z * v * w * sc * wing];
        shape.moveTo(...coords(fore ? 0.17 : -0.03, 0.035));
        if (fore) { shape.bezierCurveTo(...coords(0.50, 0.33), ...coords(0.99, 0.99), ...coords(0.53, 1.13)); shape.bezierCurveTo(...coords(0.20, 1.22), ...coords(-0.20, 0.84), ...coords(-0.14, 0.39)); }
        else { shape.bezierCurveTo(...coords(-0.17, 0.45), ...coords(-0.18, 1.09), ...coords(-0.63, 0.96)); shape.bezierCurveTo(...coords(-1.00, 0.86), ...coords(-0.77, 0.30), ...coords(-0.22, 0.04)); }
        shape.closePath(); return shape;
      };
      for (const inset of [false, true]) {
        const g = new THREE.ShapeGeometry(makeWing(inset), p.seg); g.rotateX(s * Math.PI / 2); g.translate(0, y + (inset ? 0.004 : 0) * v, 0);
        parts.push({ g, c: inset ? C.skin : C.dark, n: `${fore ? 'fore' : 'hind'}wing-${s}-${inset ? 'panel' : 'border'}`, ...extra });
      }
      for (let vein = 0; vein < 6; vein++) {
        const t = vein / 5, endX = anchorX + (fore ? 0.44 - t * 0.70 : -0.09 - t * 0.34) * v, endZ = s * (fore ? 0.98 - Math.abs(t - 0.4) * 0.42 : 0.63 - Math.abs(t - 0.5) * 0.3) * w * v;
        const rootX = anchorX + (fore ? 0.02 : 0.01) * v;
        sweep(parts, [[rootX, y + 0.008 * v, s * 0.055 * v], [(rootX + endX) / 2, y + 0.008 * v, endZ * 0.65], [endX, y + 0.008 * v, endZ]], [0.009 * v, 0.006 * v, 0.004 * v], C.dark, `wing-vein-${s}-${fore}-${vein}`, { steps: 7, radial: 4, ...extra });
        ellipsoid(parts, endX + (endX >= anchorX ? 0.05 : -0.05) * v, y + 0.011 * v, endZ + s * 0.03 * v, 0.017 * v, 0.005 * v, 0.023 * v, C.underside, `wing-spot-${s}-${fore}-${vein}`, 8, 0, extra);
      }
    }
    sweep(parts, [[0.32 * u + 0.03 * v, y + 0.04 * v, s * 0.033 * v], [0.32 * u + 0.23 * v, y + 0.18 * v, s * 0.13 * v], [0.32 * u + 0.33 * v, y + 0.19 * v, s * 0.20 * v]], [0.008 * v, 0.006 * v, 0.011 * v], C.dark, 'antenna-' + s, { steps: 10, radial: 5 });
    for (let i = 0; i < 3; i++) sweep(parts, [[(0.2 - i * 0.11) * u, y, s * 0.04 * v], [(0.24 - i * 0.15) * u, y * 0.6, s * 0.10 * v], [(0.26 - i * 0.20) * u, 0.015 * v, s * 0.19 * v]], [0.011 * v, 0.008 * v, 0.003 * v], C.dark, `leg-${s}-${i}`, { steps: 6, radial: 5 });
  }
}

function arthropod(parts, glass, p, C, config) {
  // u = axial stations (segments spread); v = girth unit (heights, widths, thicknesses fixed).
  const u = p.bodyLength, v = config.length || p.bodyLength, b = config.bodyPlan, mass = p.bodyMass, leg = p.legLength || 1, spider = b === 'spider', crab = b === 'crab', scorpion = b === 'scorpion', lady = config.variant === 'ladybird', bee = config.id === 'honeybee' || config.id === 'bumblebee', horseshoe = config.id === 'horseshoe-crab', lobster = config.id === 'american-lobster';
  const y = (crab ? 0.25 : spider ? 0.27 : lobster ? 0.16 : 0.19) * leg * v;
  if (config.id === 'pill-bug') {
    // Overlapping dorsal plates over a low domed body, legs hidden underneath.
    for (let i = 0; i < 9; i++) {
      const t = i / 8, bx = (0.36 - t * 0.74) * u, arc = Math.sin(Math.PI * (0.16 + t * 0.74));
      const g = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52);
      g.scale(0.075 * v, 0.20 * arc * mass * v, 0.26 * arc * mass * v);
      g.translate(bx, y * 0.30, 0);
      parts.push({ g, c: i % 2 ? C.skin : C.accent, n: 'plate-' + i });
    }
    for (const s of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const bx = (0.28 - i * 0.09) * u;
        sweep(parts, [[bx, y * 0.22, s * 0.13 * mass * v], [bx - 0.02 * v, y * 0.10, s * 0.20 * mass * v], [bx + 0.01 * v, 0.008 * v, s * 0.23 * mass * v]], [0.011 * v, 0.007 * v, 0.002 * v], C.detail, `leg-${s}-${i}`, { steps: 5, radial: 4 });
      }
      sweep(parts, [[0.36 * u, y * 0.30, s * 0.05 * v], [0.48 * u, y * 0.22, s * 0.09 * v], [0.54 * u, y * 0.16, s * 0.11 * v]], [0.010 * v, 0.006 * v, 0.001 * v], C.dark, 'antenna-' + s, { steps: 6, radial: 4 });
      ellipsoid(parts, 0.37 * u, y * 0.42, s * 0.085 * v, 0.018 * v, 0.016 * v, 0.015 * v, C.dark, 'eye-' + s, 8);
    }
    ellipsoid(parts, -0.40 * u, y * 0.26, 0, 0.070 * v, 0.10 * mass * v, 0.14 * mass * v, C.accent, 'telson', 10);
    return;
  }
  if (bee && config.id === 'bumblebee') {
    // Rounder and furrier than a honeybee, with a wide banded abdomen.
    ellipsoid(parts, -0.16 * u, y + 0.08 * v, 0, 0.30 * u, 0.22 * mass * v, 0.21 * mass * v, C.skin, 'furry-abdomen', p.seg);
    for (const bx of [-0.30, -0.14, 0.01]) {
      const g = new THREE.TorusGeometry(0.205 * mass * v, 0.034 * v, 7, 20);
      g.rotateY(Math.PI / 2); g.translate(bx * u, y + 0.08 * v, 0);
      parts.push({ g, c: bx === -0.14 ? C.underside : C.dark, n: 'band-' + bx });
    }
    ellipsoid(parts, 0.19 * u, y + 0.09 * v, 0, 0.20 * u, 0.20 * v, 0.20 * v, C.accent, 'fuzzy-thorax', p.seg);
    ellipsoid(parts, 0.38 * u, y + 0.075 * v, 0, 0.12 * v, 0.11 * v, 0.12 * v, C.dark, 'head', 10);
    for (const s of [-1, 1]) {
      ellipsoid(parts, 0.38 * u + 0.05 * v, y + 0.085 * v, s * 0.095 * v, 0.045 * v, 0.058 * v, 0.032 * v, C.dark, 'compound-eye-' + s, 10);
      sweep(parts, [[0.38 * u + 0.05 * v, y + 0.11 * v, s * 0.05 * v], [0.38 * u + 0.15 * v, y + 0.19 * v, s * 0.12 * v], [0.38 * u + 0.19 * v, y + 0.20 * v, s * 0.16 * v]], [0.006 * v, 0.004 * v, 0.001 * v], C.dark, 'antenna-' + s, { steps: 7, radial: 5 });
      for (let wing = 0; wing < 2; wing++) {
        const rootX = 0.10 * u - wing * 0.10 * v;
        addQuad(glass, [rootX, y + 0.24 * v, s * 0.05 * v], [rootX - (0.16 + wing * 0.04) * v, y + (0.30 - wing * 0.04) * v, s * 0.32 * v], [rootX - (0.50 - wing * 0.04) * v, y + (0.22 - wing * 0.03) * v, s * 0.36 * v], [rootX - (0.26 + wing * 0.0) * v, y + (0.21 - wing * 0.02) * v, s * 0.07 * v], C.glass, `wing-${s}-${wing}`, 0.002 * v);
        glass[glass.length - 1].zone = 'glass';
      }
      for (let i = 0; i < 3; i++) sweep(parts, [[(0.19 - i * 0.13) * u, y + 0.02 * v, s * 0.09 * v], [(0.27 - i * 0.17) * u, y - 0.10 * v, s * 0.18 * v], [(0.30 - i * 0.21) * u, 0.014 * v, s * 0.26 * v], [(0.26 - i * 0.21) * u, 0.010 * v, s * 0.28 * v]], [0.019 * v, 0.014 * v, 0.011 * v, 0.003 * v], i === 2 ? C.detail : C.dark, `leg-${s}-${i}`, { steps: 8, radial: 5 });
    }
    return;
  }
  if (bee) {
    // A bee has a compact thorax, striped tapering abdomen, big compound eyes, and two clear wing pairs.
    ellipsoid(parts, -0.18 * u, y + 0.06 * v, 0, 0.29 * u, 0.16 * mass * v, 0.15 * mass * v, C.skin, 'striped-abdomen', p.seg);
    for (const x of [-0.33, -0.20, -0.07]) { const g = new THREE.TorusGeometry(0.145 * mass * v, 0.022 * v, 6, 18); g.rotateY(Math.PI / 2); g.translate(x * u, y + 0.06 * v, 0); parts.push({ g, c: C.dark, n: 'abdomen-band' }); }
    ellipsoid(parts, 0.16 * u, y + 0.075 * v, 0, 0.17 * u, 0.17 * v, 0.17 * v, C.accent, 'thorax', p.seg);
    ellipsoid(parts, 0.36 * u, y + 0.075 * v, 0, 0.12 * v, 0.11 * v, 0.13 * v, C.dark, 'head', 10);
    for (const s of [-1, 1]) {
      ellipsoid(parts, 0.36 * u + 0.06 * v, y + 0.09 * v, s * 0.10 * v, 0.050 * v, 0.060 * v, 0.036 * v, C.dark, 'compound-eye-' + s, 10);
      sweep(parts, [[0.36 * u + 0.06 * v, y + 0.10 * v, s * 0.06 * v], [0.36 * u + 0.17 * v, y + 0.19 * v, s * 0.16 * v], [0.36 * u + 0.22 * v, y + 0.20 * v, s * 0.20 * v]], [0.006 * v, 0.004 * v, 0.001 * v], C.dark, 'antenna-' + s, { steps: 8, radial: 5 });
      for (let wing = 0; wing < 2; wing++) {
        const back = wing === 1, rootX = 0.08 * u - wing * 0.12 * v, root = [rootX, y + 0.18 * v, s * 0.05 * v];
        addQuad(glass, root, [rootX - (0.12 + wing * 0.05) * v, y + (0.26 - wing * 0.04) * v, s * 0.36 * v], [rootX - (0.52 - wing * 0.04) * v, y + (0.18 - wing * 0.03) * v, s * 0.42 * v], [rootX - (0.26 + wing * 0.01) * v, y + (0.16 - wing * 0.03) * v, s * 0.08 * v], C.glass, `wing-${s}-${back ? 'hind' : 'fore'}`, 0.002 * v);
        glass[glass.length - 1].zone = 'glass';
      }
      for (let i = 0; i < 3; i++) sweep(parts, [[(0.16 - i * 0.12) * u, y + 0.02 * v, s * 0.08 * v], [(0.26 - i * 0.16) * u, y - 0.10 * v, s * 0.16 * v], [(0.30 - i * 0.20) * u, 0.015 * v, s * 0.25 * v]], [0.016 * v, 0.010 * v, 0.003 * v], C.dark, `leg-${s}-${i}`, { steps: 7, radial: 5 });
    }
    return;
  }
  if (config.id === 'praying-mantis') {
    // Long prothorax, triangular head, and folded raptorial forelegs create the unmistakeable mantis profile.
    sweep(parts, [[-0.56 * u, y, 0], [-0.20 * u, y + 0.01 * v, 0], [0.02 * u, y + 0.03 * v, 0]], [0.025 * v, 0.058 * mass * v, 0.045 * mass * v], C.skin, 'long-abdomen', { steps: 18, radial: 9 });
    sweep(parts, [[0.00 * u, y + 0.02 * v, 0], [0.18 * u, y + 0.16 * v, 0], [0.27 * u, y + 0.24 * v, 0]], [0.042 * v, 0.040 * v, 0.052 * v], C.skin, 'prothorax', { steps: 12, radial: 8 });
    prism(parts, [[0.22 * u, y + 0.22 * v, -0.13 * v], [0.37 * u, y + 0.22 * v, 0], [0.22 * u, y + 0.22 * v, 0.13 * v]], [0, 0.09 * v, 0], C.skin, 'triangular-head');
    for (const s of [-1, 1]) {
      ellipsoid(parts, 0.22 * u + 0.10 * v, y + 0.28 * v, s * 0.090 * v, 0.050 * v, 0.050 * v, 0.030 * v, C.detail, 'compound-eye-' + s, 10);
      sweep(parts, [[0.20 * u, y + 0.15 * v, s * 0.06 * v], [0.38 * u, y + 0.05 * v, s * 0.16 * v], [0.44 * u, y + 0.17 * v, s * 0.20 * v], [0.28 * u, y + 0.25 * v, s * 0.13 * v]], [0.020 * v, 0.014 * v, 0.010 * v, 0.003 * v], C.accent, `raptorial-leg-${s}`, { steps: 14, radial: 6 });
      for (let i = 0; i < 2; i++) sweep(parts, [[(-0.02 - i * 0.16) * u, y, s * 0.06 * v], [(-0.08 - i * 0.20) * u, y - 0.08 * v, s * 0.18 * v], [(0.02 - i * 0.27) * u, 0.015 * v, s * 0.30 * v]], [0.014 * v, 0.009 * v, 0.002 * v], C.skin, `walking-leg-${s}-${i}`, { steps: 7, radial: 5 });
      sweep(parts, [[0.22 * u + 0.10 * v, y + 0.30 * v, s * 0.045 * v], [0.22 * u + 0.18 * v, y + 0.39 * v, s * 0.10 * v], [0.22 * u + 0.20 * v, y + 0.41 * v, s * 0.14 * v]], [0.005 * v, 0.003 * v, 0.001 * v], C.dark, 'antenna-' + s, { steps: 7, radial: 5 });
    }
    return;
  }
  if (crab && !horseshoe && !lobster) ellipsoid(parts, -0.04 * u, y, 0, 0.29 * u, 0.16 * mass * v, 0.40 * mass * v, C.skin, 'carapace', p.seg);
  if (horseshoe) {
    ellipsoid(parts, -0.05 * u, y, 0, 0.32 * u, 0.11 * mass * v, 0.38 * mass * v, C.skin, 'prosoma', p.seg);
    ellipsoid(parts, -0.32 * u, y + 0.02 * v, 0, 0.15 * u, 0.08 * mass * v, 0.22 * mass * v, C.accent, 'opisthosoma', 10);
    sweep(parts, [[-0.45 * u, y + 0.02 * v, 0], [-0.45 * u - 0.25 * v, y - 0.02 * v, 0], [-0.45 * u - 0.60 * v, y - 0.12 * v, 0]], [0.035 * v, 0.020 * v, 0.002 * v], C.skin, 'telson', { steps: 12, radial: 4 });
  } else if (lobster) {
    ellipsoid(parts, 0.08 * u, y + 0.02 * v, 0, 0.22 * u, 0.14 * mass * v, 0.15 * mass * v, C.skin, 'cephalothorax', p.seg);
    const abdomenCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.12 * u, y + 0.02 * v, 0), new THREE.Vector3(-0.35 * u, y, 0), new THREE.Vector3(-0.55 * u, y - 0.06 * v, 0)]);
    sweep(parts, [[-0.12 * u, y + 0.02 * v, 0], [-0.35 * u, y, 0], [-0.55 * u, y - 0.06 * v, 0]], [0.12 * mass * v, 0.10 * mass * v, 0.08 * mass * v], C.accent, 'abdomen', { curve: abdomenCurve, steps: 12, radial: 10 });
    for (const s of [-1, 0, 1]) prism(parts, [[-0.52 * u, y - 0.05 * v, s * 0.04 * v], [-0.52 * u - 0.18 * v, y - 0.08 * v, s * 0.12 * v], [-0.52 * u - 0.20 * v, y - 0.08 * v, s * 0.04 * v]], [0, 0.015 * v, 0], C.detail, `tail-fan-${s}`);
  }
  else if (spider) { ellipsoid(parts, -0.24 * u, y + 0.035 * v, 0, 0.31 * u, 0.25 * mass * v, 0.25 * mass * v, C.skin, 'abdomen', p.seg); ellipsoid(parts, 0.18 * u, y + 0.025 * v, 0, 0.22 * u, 0.18 * v, 0.21 * v, C.accent, 'cephalothorax', p.seg); }
  else if (scorpion) {
    sweep(parts, [[-0.40 * u, y, 0], [-0.05 * u, y, 0], [0.32 * u, y, 0]], [[0.14 * mass * v, 0.105 * v], [0.21 * mass * v, 0.125 * v], [0.14 * v, 0.11 * v]], C.skin, 'body', { steps: 14, radial: 10 });
    for (let i = 0; i < 6; i++) ellipsoid(parts, (-0.36 + i * 0.082) * u, y + 0.075 * v, 0, 0.05 * v, 0.075 * v, (0.15 + Math.sin(i / 6 * Math.PI) * 0.04) * v, C.accent, 'dorsal-plate-' + i, 8);
    const sBaseX = -0.41 * u, path = [[sBaseX, y, 0], [sBaseX - 0.27 * v, y + 0.28 * v, 0], [sBaseX - 0.25 * v, y + 0.67 * v, 0], [sBaseX + 0.07 * v, y + 0.80 * v, 0], [sBaseX + 0.25 * v, y + 0.63 * v, 0]], radii = [0.07 * v, 0.068 * v, 0.062 * v, 0.045 * v, 0.004 * v], curve = new THREE.CatmullRomCurve3(path.map(q => new THREE.Vector3(...q)));
    for (let i = 0; i < 7; i++) sweep(parts, path, radii, i === 6 ? C.dark : i % 2 ? C.accent : C.skin, 'tail-segment-' + i, { curve, from: i / 7, to: (i + 1) / 7, steps: 4, radial: 8, rig: 'tail', pivot: path[0] });
  } else {
    ellipsoid(parts, -0.13 * u, y + 0.06 * v, 0, 0.39 * u, (lady ? 0.28 : 0.20) * mass * v, 0.28 * mass * v, C.skin, 'elytra', p.seg);
    sweep(parts, [[-0.49 * u, y + 0.08 * v, 0], [-0.12 * u, y + (lady ? 0.339 : 0.259) * mass * v, 0], [0.23 * u, y + 0.09 * v, 0]], [0.007 * v, 0.008 * v, 0.007 * v], C.dark, 'wing-case-seam', { steps: 12, radial: 4 });
    ellipsoid(parts, 0.28 * u, y, 0, 0.17 * u, 0.13 * v, 0.18 * v, C.dark, 'thorax', p.seg);
    ellipsoid(parts, 0.44 * u, y - 0.01 * v, 0, 0.135 * v, 0.09 * v, 0.135 * v, C.dark, 'head', 12);
    if (config.id === 'firefly') {
      // Pale pronotal shield over the head and a glowing lantern at the abdomen tip.
      ellipsoid(parts, 0.30 * u, y + 0.05 * v, 0, 0.17 * v, 0.055 * v, 0.19 * v, C.accent, 'pronotum', 12);
      ellipsoid(parts, -0.44 * u, y + 0.04 * v, 0, 0.16 * v, 0.17 * mass * v, 0.24 * mass * v, C.detail, 'lantern', 14);
    }
    if (config.id === 'field-cricket') {
      // Big folded jumping legs and long whip antennae define a cricket.
      for (const s of [-1, 1]) {
        sweep(parts, [[-0.16 * u, y + 0.03 * v, s * 0.16 * v], [-0.34 * u, y + 0.30 * leg * v, s * 0.26 * v], [-0.30 * u, y + 0.10 * v, s * 0.30 * v]], [0.055 * v, 0.036 * v, 0.018 * v], C.accent, 'femur-' + s, { steps: 9, radial: 7 });
        sweep(parts, [[-0.30 * u, y + 0.12 * v, s * 0.30 * v], [-0.16 * u, y * 0.5, s * 0.34 * v], [-0.02 * u, 0.012 * v, s * 0.36 * v]], [0.017 * v, 0.011 * v, 0.003 * v], C.skin, 'tibia-' + s, { steps: 8, radial: 5 });
        sweep(parts, [[0.44 * u + 0.06 * v, y + 0.02 * v, s * 0.07 * v], [0.44 * u + 0.42 * v, y + 0.16 * v, s * 0.20 * v], [0.44 * u + 0.68 * v, y + 0.20 * v, s * 0.30 * v]], [0.007 * v, 0.004 * v, 0.001 * v], C.dark, 'long-antenna-' + s, { steps: 12, radial: 4 });
        sweep(parts, [[-0.48 * u, y + 0.05 * v, s * 0.05 * v], [-0.48 * u - 0.14 * v, y + 0.04 * v, s * 0.09 * v], [-0.48 * u - 0.24 * v, y + 0.03 * v, s * 0.11 * v]], [0.008 * v, 0.005 * v, 0.001 * v], C.detail, 'cercus-' + s, { steps: 6, radial: 4 });
      }
    }
    if (lady && !bee) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const x = (-0.34 + i * 0.18) * u, z = s * (i === 1 ? 0.17 : 0.12) * mass * v, h = Math.sqrt(Math.max(0, 1 - ((x + 0.13 * u) / (0.39 * u)) ** 2 - (z / (0.28 * mass * v)) ** 2)); ellipsoid(parts, x, y + 0.06 * v + h * 0.283 * mass * v, z, 0.056 * v, 0.013 * v, 0.052 * v, C.dark, `spot-${s}-${i}`, 10); }
    if (bee) {
      for (const dx of [-0.19, -0.05, 0.09]) {
        const r = 0.28 * mass * v * Math.sqrt(Math.max(0.05, 1 - (dx / 0.39) ** 2));
        const g = new THREE.TorusGeometry(r, 0.030 * v, 6, 22);
        g.rotateY(Math.PI / 2); g.translate((-0.13 + dx) * u, y + 0.06 * v, 0);
        parts.push({ g, c: C.dark, n: 'abdomen-stripe' });
      }
      for (const s of [-1, 1]) {
        addQuad(glass, [0.16 * u, y + 0.30 * mass * v, s * 0.05 * v], [-0.02 * u, y + 0.33 * mass * v, s * 0.30 * v], [-0.44 * u, y + 0.27 * mass * v, s * 0.24 * v], [-0.18 * u, y + 0.27 * mass * v, s * 0.04 * v], C.glass, 'wing-' + s, 0.004 * v);
        glass[glass.length - 1].zone = 'glass';
      }
    }
  }
  const pairs = spider || scorpion || crab || lobster ? 4 : 3;
  for (const s of [-1, 1]) {
    for (let i = 0; i < pairs; i++) {
      const t = i / Math.max(1, pairs - 1);
      const x = (lobster ? 0.15 - t * 0.30 : 0.23 - t * 0.43) * u;
      const reach = (spider ? 0.64 : crab ? (horseshoe ? 0.30 : 0.66) : lobster ? 0.40 : 0.46) * leg * v;
      const drift = (0.25 - t * 0.5) * u;
      if (horseshoe) {
        // Limulus legs stay tucked beneath the shield, only the tips peek past the rim.
        const lx = (0.10 - t * 0.34) * u;
        sweep(parts, [[lx, y * 0.75, s * 0.06 * v], [lx - 0.02 * v, y * 0.42, s * 0.16 * v], [lx + 0.03 * v, 0.014 * v, s * 0.25 * v]], [0.020 * v, 0.013 * v, 0.003 * v], i % 2 ? C.accent : C.detail, `walking-leg-${s}-${i + 1}`, { steps: 7, radial: 5 });
        continue;
      }
      if (lobster) {
        // Slim legs angled down and back, close to the body, not splayed like a spider.
        const lx = (0.16 - t * 0.26) * u;
        sweep(parts, [[lx, y - 0.02 * v, s * 0.09 * v], [lx - 0.05 * v, y * 0.55, s * 0.19 * v], [lx - 0.02 * v, 0.014 * v, s * 0.25 * v]], [0.020 * v, 0.013 * v, 0.004 * v], i % 2 ? C.accent : C.skin, `walking-leg-${s}-${i + 1}`, { steps: 8, radial: 5 });
        continue;
      }
      sweep(parts, [[x, y, s * (crab ? 0.26 : 0.11) * mass * v], [x + drift * 0.7, y + (spider ? 0.13 : 0.035) * v, s * reach * 0.61], [x + drift, 0.11 * v, s * reach], [x + drift * 1.25, 0.016 * v, s * reach * 1.12]], [0.042 * v, 0.033 * v, 0.021 * v, 0.002 * v], i % 2 ? C.accent : C.skin, `walking-leg-${s}-${i + 1}`, { steps: 10, radial: 6 });
    }
    if ((crab && !horseshoe) || scorpion || lobster) {
      const z = s * (lobster ? 0.22 : 0.48) * v;
      if (lobster) {
        sweep(parts, [[0.15 * u, y - 0.02 * v, s * 0.15 * v], [0.30 * u, y + 0.04 * v, s * 0.28 * v], [0.45 * u, y + 0.08 * v, s * 0.20 * v]], [0.03 * v, 0.04 * v, 0.06 * v], C.accent, 'cheliped-arm-' + s, { steps: 8, radial: 6 });
        ellipsoid(parts, 0.45 * u + 0.07 * v, y + 0.09 * v, s * 0.18 * v, 0.14 * v, 0.07 * v, 0.10 * v, C.skin, 'claw-palm-' + s, 10);
        for (const jaw of [-1, 1]) sweep(parts, [[0.45 * u + 0.15 * v, y + 0.09 * v, s * (0.18 + jaw * 0.04) * v], [0.45 * u + 0.27 * v, y + 0.09 * v, s * (0.18 + jaw * 0.05) * v], [0.45 * u + 0.35 * v, y + 0.09 * v, s * (0.18 + jaw * 0.01) * v]], [0.04 * v, 0.02 * v, 0.002 * v], C.detail, `claw-finger-${s}-${jaw}`, { steps: 6, radial: 5 });
        sweep(parts, [[0.28 * u, y + 0.05 * v, s * 0.06 * v], [0.28 * u + 0.22 * v, y + 0.2 * v, s * 0.18 * v], [0.28 * u + 0.52 * v, y + 0.4 * v, s * 0.3 * v], [0.28 * u + 0.82 * v, y + 0.3 * v, s * 0.5 * v]], [0.012 * v, 0.008 * v, 0.004 * v, 0.001 * v], C.dark, 'antenna-' + s, { steps: 12, radial: 4 });
      } else {
        sweep(parts, [[0.2 * u, y, s * 0.20 * mass * v], [0.44 * u, y + 0.06 * v, s * 0.4 * v], [0.64 * u, y + 0.12 * v, z]], [0.061 * v, 0.052 * v, 0.065 * v], C.accent, 'pincer-arm-' + s, { steps: 10, radial: 8 });
        ellipsoid(parts, 0.64 * u + 0.04 * v, y + 0.13 * v, z, 0.18 * v, 0.11 * v, 0.12 * v, C.skin, 'pincer-palm-' + s, 12);
        for (const jaw of [-1, 1]) sweep(parts, [[0.64 * u + 0.09 * v, y + 0.13 * v, z + jaw * 0.065 * v], [0.64 * u + 0.27 * v, y + 0.14 * v, z + jaw * 0.09 * v], [0.64 * u + 0.37 * v, y + 0.14 * v, z + jaw * 0.018 * v]], [0.067 * v, 0.035 * v, 0.003 * v], C.detail, `pincer-finger-${s}-${jaw}`, { steps: 9, radial: 7 });
      }
    }
    if (!spider && !crab && !scorpion && !lobster && config.id !== 'praying-mantis') {
      sweep(parts, [[0.44 * u + 0.03 * v, y + 0.02 * v, s * 0.10 * v], [0.44 * u + 0.21 * v, y + 0.04 * v, s * 0.25 * v], [0.44 * u + 0.30 * v, y + 0.14 * v, s * 0.26 * v]], [0.014 * v, 0.011 * v, 0.023 * v], C.dark, 'antenna-' + s, { steps: 10, radial: 6 });
      if (!lady && config.variant === 'stag' && config.id === 'stag-beetle') sweep(parts, [[0.44 * u + 0.05 * v, y - 0.01 * v, s * 0.068 * v], [0.44 * u + 0.33 * v, y + 0.02 * v, s * 0.17 * v], [0.44 * u + 0.48 * v, y + 0.055 * v, s * 0.13 * v], [0.44 * u + 0.41 * v, y + 0.06 * v, s * 0.03 * v]], [0.05 * v, 0.045 * v, 0.025 * v, 0.002 * v], C.accent, 'mandible-' + s, { steps: 12, radial: 7 });
    }
    // Spider eyes sit on the cephalothorax surface; crab/beetle eyes already clear the body.
    // Scorpions have no separate head mesh, so eyes sit ON the front carapace (dorso-lateral, still embedded).
    let eyeX = (lobster ? 0.25 : crab ? (horseshoe ? 0.02 : 0.24) : scorpion ? 0.28 : 0.43) * u;
    let eyeY = y + (lobster ? 0.13 : crab ? (horseshoe ? 0.205 * mass : 0.22) : scorpion ? 0.095 : 0.06) * v;
    let eyeZ = s * (lobster ? 0.10 : crab ? (horseshoe ? 0.09 : 0.19) : scorpion ? 0.095 : 0.12) * v;
    let erX = 0.029 * v, erY = 0.032 * v, erZ = 0.026 * v;
    if (horseshoe) { erX = 0.022 * v; erY = 0.020 * v; erZ = 0.020 * v; }
    if (spider) {
      const cr = { x: 0.22 * u, y: 0.18 * v, z: 0.21 * v };
      const dS = [0.75, 0.42, 0.51 * s], dlS = Math.hypot(dS[0], dS[1], dS[2]);
      eyeX = 0.18 * u + cr.x * (dS[0] / dlS) * 1.02;
      eyeY = y + 0.025 * v + cr.y * (dS[1] / dlS) * 1.02;
      eyeZ = cr.z * (dS[2] / dlS) * 1.02;
      erX = 0.064 * v; erY = 0.074 * v; erZ = 0.059 * v;
    }
    if (crab && !horseshoe && !lobster) addWire(parts, [0.19 * u, y + 0.06 * v, s * 0.17 * mass * v], [eyeX, eyeY, eyeZ], C.accent, 0.017 * v, 6, 'eyestalk-' + s);
    if (lobster) addWire(parts, [0.18 * u, y + 0.06 * v, s * 0.07 * v], [eyeX, eyeY, eyeZ], C.accent, 0.010 * v, 5, 'short-eyestalk-' + s);
    ellipsoid(parts, eyeX, eyeY, eyeZ, erX, erY, erZ, C.dark, 'eye-' + s, 12);
    // Highlight sits ON the eye surface: not buried inside it, and not floating away.
    ellipsoid(parts, eyeX + erX * 0.62, eyeY + erY * 0.55, eyeZ + s * erZ * 0.58, erX * 0.34, erY * 0.34, erZ * 0.34, C.underside, 'eye-glint-' + s, 8);
    if (spider) { ellipsoid(parts, 0.18 * u + 0.137 * v, y + 0.1 * v, s * 0.177 * v, 0.027 * v, 0.032 * v, 0.026 * v, C.dark, 'secondary-eye-' + s, 8); sweep(parts, [[0.18 * u + 0.17 * v, y - 0.05 * v, s * 0.08 * v], [0.18 * u + 0.25 * v, y - 0.085 * v, s * 0.13 * v], [0.18 * u + 0.25 * v, y - 0.14 * v, s * 0.15 * v]], [0.041 * v, 0.028 * v, 0.004 * v], C.detail, 'palp-' + s, { steps: 6, radial: 7 }); }
  }
}

function mollusk(parts, glass, p, C, config) {
  const u = p.bodyLength, v = config.length || p.bodyLength, b = config.bodyPlan, mass = p.bodyMass, nautilus = config.id === 'nautilus', cuttlefish = config.id === 'cuttlefish';
  if (cuttlefish) {
    // Flattened mantle with a thin fin skirt, 8 short arms, and 2 long feeding tentacles
    ellipsoid(parts, -0.05 * u, 0.40 * u, 0, 0.30 * mass * u, 0.14 * mass * u, 0.26 * mass * u, C.skin, 'mantle', p.seg, -0.1);
    ellipsoid(parts, -0.05 * u, 0.40 * u, 0, 0.34 * mass * u, 0.015 * u, 0.31 * mass * u, C.accent, 'fin-skirt', p.seg, -0.1);
    ellipsoid(parts, 0.22 * u, 0.34 * u, 0, 0.12 * u, 0.12 * u, 0.16 * u, C.skin, 'head', p.seg);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, x = 0.3 * u + Math.cos(a) * 0.05 * u, z = Math.sin(a) * 0.08 * u;
      sweep(parts, [[0.28 * u, 0.34 * u, z * 0.5], [x, 0.30 * u, z], [x + 0.12 * u, 0.20 * u, z * 1.2]], [0.03 * u, 0.02 * u, 0.002 * u], C.skin, 'short-arm-' + i, { steps: 5, radial: 4 });
    }
    for (const s of [-1, 1]) {
      sweep(parts, [[0.28 * u, 0.32 * u, s * 0.06 * u], [0.45 * u, 0.28 * u, s * 0.15 * u], [0.65 * u, 0.32 * u, s * 0.12 * u]], [0.015 * u, 0.012 * u, 0.018 * u], C.accent, 'feeding-tentacle-' + s, { steps: 8, radial: 5 });
      ellipsoid(parts, 0.18 * u, 0.40 * u, s * 0.14 * u, 0.05 * u, 0.04 * u, 0.03 * u, C.dark, 'eye-' + s, 10);
      ellipsoid(parts, 0.19 * u, 0.41 * u, s * 0.16 * u, 0.012 * u, 0.012 * u, 0.010 * u, C.underside, 'eye-glint-' + s, 8);
    }
    return;
  }
  if (b === 'octopus') {
    ellipsoid(parts, -0.06 * u, 0.48 * u, 0, 0.24 * mass * u, 0.32 * mass * u, 0.24 * mass * u, C.skin, 'mantle', p.seg, -0.2);
    ellipsoid(parts, 0.03 * u, 0.28 * u, 0, 0.23 * u, 0.15 * u, 0.22 * u, C.skin, 'head', p.seg);
    for (let arm = 0; arm < 8; arm++) {
      const a = arm / 8 * Math.PI * 2, len = p.tentacleLength, point = (r, h, offset = 0) => [Math.cos(a + offset) * r * u, h * u, Math.sin(a + offset) * r * u];
      const path = [point(0.13, 0.25), point(0.36 * len, 0.12, 0.12), point(0.58 * len, 0.055, -0.10), point(0.72 * len, 0.08, 0.09), point(0.71 * len, 0.16, 0.27), point(0.61 * len, 0.19, 0.30)];
      const curve = sweep(parts, path, [0.092 * u, 0.075 * u, 0.045 * u, 0.027 * u, 0.013 * u, 0.002 * u], arm % 3 === 0 ? C.accent : C.skin, 'arm-' + (arm + 1), { steps: 25, radial: 9 });
      for (let i = 1; i < 13; i++) { const t = i / 15, v = curve.getPoint(t), radius = (0.030 - t * 0.023) * u; ellipsoid(parts, v.x, v.y + 0.025 * (1 - t) * u, v.z, radius, 0.008 * u, radius, C.underside, `sucker-${arm}-${i}`, 7); }
    }
    for (const s of [-1, 1]) {
      // Light rim with a dark pupil set into it and pushed outward, so both stay visible.
      const rimX = 0.16 * u, rimY = 0.34 * u, rimZ = s * 0.16 * u;
      const rr = { x: 0.07 * u, y: 0.067 * u, z: 0.051 * u };
      ellipsoid(parts, rimX, rimY, rimZ, rr.x, rr.y, rr.z, C.detail, 'eye-rim-' + s, 12);
      const dO = [0.45, 0.20, 0.87 * s], dlO = Math.hypot(dO[0], dO[1], dO[2]);
      const pX = rimX + rr.x * (dO[0] / dlO) * 0.85, pY = rimY + rr.y * (dO[1] / dlO) * 0.85, pZ = rimZ + rr.z * (dO[2] / dlO) * 0.85;
      ellipsoid(parts, pX, pY, pZ, 0.026 * u, 0.030 * u, 0.022 * u, C.dark, 'eye-' + s, 10);
      ellipsoid(parts, pX + 0.016 * u, pY + 0.016 * u, pZ + s * 0.013 * u, 0.008 * u, 0.008 * u, 0.006 * u, C.underside, 'eye-glint-' + s, 8);
    }
  } else {
    if (nautilus) {
      // Symmetrical planispiral shell with many short tentacles protruding from a hood
      // Tight planispiral sized so the whole animal stays near its catalogue length,
      // with the aperture swung round to face forward rather than gaping upward.
      // Logarithmic spiral that triples each turn, exactly like a nautilus whorl,
      // with the tube thickness locked to a fraction of the local whorl radius.
      const shell = p.shellSize, points = [], radii = [];
      const turns = Math.PI * 6, phase = turns - 0.18, k = 0.175;
      for (let i = 0; i <= 200; i++) {
        const t = i / 200 * turns, r = 0.0165 * Math.exp(k * t) * shell * u;
        points.push([Math.cos(phase - t) * r, 0.46 * u + Math.sin(phase - t) * r, 0]);
        const rad = r * 0.40;
        radii.push([rad, rad * 1.06]);
      }
      sweep(parts, points, radii, C.accent, 'chambered-shell', { steps: 200, radial: 16 });
      for (let i = 150; i < 196; i += 4) {
        const a = points[i], b2 = points[Math.min(i + 2, 200)], rr = radii[i][1] * 0.92;
        addWire(parts, [a[0], a[1], a[2] + rr], [b2[0], b2[1], b2[2] + rr], C.dark, radii[i][0] * 0.16, 5, 'stripe-f-' + i);
        addWire(parts, [a[0], a[1], a[2] - rr], [b2[0], b2[1], b2[2] - rr], C.dark, radii[i][0] * 0.16, 5, 'stripe-b-' + i);
      }
      const mouth = points[points.length - 1], mr = radii[radii.length - 1][0];
      // Plug the aperture with the soft body so the shell never reads as a hollow pipe.
      ellipsoid(parts, mouth[0], mouth[1], 0, mr * 1.02, mr * 1.02, mr * 1.08, C.skin, 'body-plug', p.seg);
      const hoodX = mouth[0] + mr * 0.34, hoodY = mouth[1] + mr * 0.30;
      ellipsoid(parts, hoodX, hoodY, 0, mr * 0.66, mr * 0.50, mr * 0.94, C.detail, 'hood', p.seg);
      for (let i = 0; i < 24; i++) {
        const a = (i / 23 - 0.5) * Math.PI * 1.05;
        const tz = Math.sin(a) * mr * 0.82, ty = mouth[1] - Math.abs(Math.cos(a)) * mr * 0.30;
        sweep(parts, [[mouth[0] + mr * 0.55, ty, tz], [mouth[0] + mr * 1.35, ty - mr * 0.30, tz * 1.08], [mouth[0] + mr * 1.95, ty - mr * 0.58, tz * 1.02]], [mr * 0.13, mr * 0.09, mr * 0.015], i % 2 === 0 ? C.underside : C.skin, 'cirrus-' + i, { steps: 5, radial: 4 });
      }
      for (const s of [-1, 1]) ellipsoid(parts, mouth[0] + mr * 0.60, mouth[1] + mr * 0.10, s * mr * 0.86, mr * 0.17, mr * 0.17, mr * 0.10, C.dark, 'pinhole-eye-' + s, 8);
      return;
    }
    const footFrontX = 0.55 * u;
    sweep(parts, [[-0.56 * u, 0.055 * v, 0], [-0.17 * u, 0.095 * v, 0], [0.35 * u, 0.13 * v, 0], [footFrontX, 0.16 * v, 0]], [[0.003 * v, 0.007 * v], [0.16 * mass * v, 0.065 * v], [0.13 * mass * v, 0.08 * v], [0.065 * v, 0.06 * v]], C.skin, 'foot', { steps: 25, radial: p.seg });
    if (b === 'snail') {
      const shell = p.shellSize, points = [], radii = [];
      for (let i = 0; i <= 100; i++) { const t = i / 100 * Math.PI * 5.2, r = 0.37 * Math.exp(-0.16 * t) * shell * v; points.push([-0.09 * u + Math.cos(t + 0.5) * r, (0.36 * shell + 0.03) * v + Math.sin(t + 0.5) * r, -0.016 * v + i / 100 * 0.06 * v]); radii.push([0.125 * Math.exp(-0.11 * t) * shell * v, 0.11 * Math.exp(-0.11 * t) * shell * v]); }
      sweep(parts, points, radii, C.accent, 'shell', { steps: p.seg * 7, radial: Math.max(8, p.seg - 3) });
      const seam = points.map((q, i) => [q[0], q[1], q[2] + radii[i][0] * 0.9]);
      sweep(parts, seam, [0.006 * v, 0.003 * v], C.detail, 'shell-spiral-ridge', { steps: 95, radial: 5 });
    } else {
      for (const s of [-1, 1]) for (let row = 0; row < 3; row++) for (let j = 0; j < 5; j++) {
        const x = (-0.26 + row * 0.21) * u, reach = (0.22 + (2 - Math.abs(j - 2)) * 0.07) * v, angle = (j - 2) * 0.20;
        sweep(parts, [[x, 0.12 * v, s * 0.09 * v], [x + angle * v, 0.22 * v, s * reach * 0.7], [x + angle * 1.6 * v, 0.26 * v, s * reach]], [0.025 * v, 0.020 * v, 0.001 * v], j % 2 ? C.accent : C.skin, `ceras-${s}-${row}-${j}`, { steps: 10, radial: 6 });
      }
    }
    for (const s of [-1, 1]) {
      const end = [footFrontX + 0.01 * v, (b === 'snail' ? 0.40 : 0.31) * v, s * 0.15 * v];
      sweep(parts, [[footFrontX - 0.11 * v, 0.18 * v, s * 0.045 * v], [footFrontX - 0.05 * v, 0.28 * v, s * 0.09 * v], end], [0.018 * v, 0.014 * v, 0.009 * v], C.skin, 'sensory-tentacle-' + s, { steps: 9, radial: 7 });
      ellipsoid(parts, ...end, 0.023 * v, 0.025 * v, 0.021 * v, b === 'snail' ? C.dark : C.detail, 'tentacle-tip-' + s, 8);
      if (b === 'snail') sweep(parts, [[footFrontX - 0.05 * v, 0.13 * v, s * 0.04 * v], [footFrontX + 0.08 * v, 0.16 * v, s * 0.10 * v], [footFrontX + 0.11 * v, 0.15 * v, s * 0.14 * v]], [0.01 * v, 0.008 * v, 0.002 * v], C.accent, 'oral-tentacle-' + s, { steps: 7, radial: 5 });
    }
  }
}

function radialAnimal(parts, glass, p, C, config) {
  const u = p.bodyLength, b = config.bodyPlan, mass = p.bodyMass;
  if (b === 'jellyfish') {
    const points = [new THREE.Vector2(0, 0.80 * u)];
    for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI / 2; points.push(new THREE.Vector2(Math.sin(a) * 0.49 * mass * u, (0.56 + Math.cos(a) * 0.24) * u)); }
    for (let i = 12; i >= 0; i--) { const a = i / 12 * Math.PI / 2; points.push(new THREE.Vector2(Math.sin(a) * 0.465 * mass * u, (0.56 + Math.cos(a) * 0.218) * u)); }
    glass.push({ g: new THREE.LatheGeometry(points, p.seg * 2 + 4), c: C.glass, n: 'bell', zone: 'glass' });
    for (let i = 0; i < p.tentacles; i++) {
      const a = i / p.tentacles * Math.PI * 2, len = p.tentacleLength, x = Math.cos(a), z = Math.sin(a);
      sweep(parts, [[x * 0.47 * mass * u, 0.56 * u, z * 0.47 * mass * u], [x * 0.43 * u, (0.56 - 0.19 * len) * u, z * 0.46 * u], [x * 0.46 * u, (0.56 - 0.36 * len) * u, z * 0.42 * u], [x * 0.39 * u, (0.56 - 0.50 * len) * u, z * 0.48 * u]], [0.005 * u, 0.004 * u, 0.003 * u, 0.0008 * u], i % 2 ? C.accent : C.skin, 'marginal-tentacle-' + i, { steps: 18, radial: 5 });
    }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, x = Math.cos(a), z = Math.sin(a); sweep(parts, [[x * 0.08 * u, 0.63 * u, z * 0.08 * u], [x * 0.13 * u, 0.40 * u, z * 0.08 * u], [x * 0.09 * u, (0.55 - 0.35 * p.tentacleLength) * u, z * 0.14 * u], [x * 0.15 * u, (0.55 - 0.51 * p.tentacleLength) * u, z * 0.10 * u]], [0.046 * u, 0.033 * u, 0.04 * u, 0.003 * u], C.accent, 'oral-arm-' + i, { steps: 22, radial: 7 }); }
  } else if (b === 'combJelly') {
    ellipsoid(glass, 0, 0.5 * u, 0, 0.29 * mass * u, 0.43 * u, 0.28 * mass * u, C.glass, 'gelatinous-body', p.seg + 4, 0, { zone: 'glass' });
    for (let row = 0; row < 8; row++) for (let i = 1; i < 16; i++) {
      const a = row / 8 * Math.PI * 2, theta = i / 16 * Math.PI, r = Math.sin(theta) * 0.294 * mass * u;
      ellipsoid(parts, Math.cos(a) * r, (0.5 + Math.cos(theta) * 0.431) * u, Math.sin(a) * r, 0.017 * u, 0.008 * u, 0.02 * u, [C.skin, C.accent, C.detail, C.underside][i % 4], `comb-${row}-${i}`, 6);
    }
    for (const s of [-1, 1]) sweep(parts, [[s * 0.10 * u, 0.34 * u, 0], [s * 0.30 * u, 0.16 * u, 0.03 * u], [s * 0.44 * p.tentacleLength * u, 0.035 * u, 0.10 * u]], [0.008 * u, 0.005 * u, 0.001 * u], C.accent, 'tentacle-' + s, { steps: 18, radial: 5 });
  } else if (b === 'anemone') {
    const profile = [[0.25, 0.01], [0.28, 0.035], [0.18, 0.15], [0.15, 0.35], [0.25, 0.43], [0.26, 0.46], [0.21, 0.465], [0.10, 0.40]].map(v => new THREE.Vector2(v[0] * mass * u, v[1] * u));
    parts.push({ g: new THREE.LatheGeometry(profile, 20), c: C.skin, n: 'column' });
    ellipsoid(parts, 0, 0.40 * u, 0, 0.08 * u, 0.018 * u, 0.08 * u, C.dark, 'mouth', 12);
    for (let i = 0; i < p.tentacles; i++) { const a = i / p.tentacles * Math.PI * 2, ring = i % 2 ? 0.17 : 0.23, len = p.tentacleLength, sin = Math.sin(a), cos = Math.cos(a); sweep(parts, [[cos * ring * u, 0.43 * u, sin * ring * u], [cos * 0.33 * mass * u, (0.44 + 0.2 * len) * u, sin * 0.33 * mass * u], [cos * (0.30 + 0.15 * len) * u, (0.44 + 0.37 * len) * u, sin * (0.30 + 0.15 * len) * u], [Math.cos(a + 0.08) * (0.31 + 0.12 * len) * u, (0.44 + 0.41 * len) * u, Math.sin(a + 0.08) * (0.31 + 0.12 * len) * u]], [0.034 * u, 0.029 * u, 0.025 * u, 0.009 * u], i % 3 ? C.accent : C.detail, 'tentacle-' + i, { steps: 13, radial: 7 }); }
  } else if (b === 'starfish') {
    const arms = Math.round(p.arms), steps = arms * (p.seg + 6), rings = Math.round(p.seg * 0.6), vertices = [], indices = [];
    for (let side = 0; side < 2; side++) for (let r = 0; r <= rings; r++) for (let i = 0; i < steps; i++) {
      const a = i / steps * Math.PI * 2, contour = 0.20 + 0.31 * ((Math.cos(a * arms) + 1) / 2) ** 2.4, t = r / rings, radius = contour * t * u;
      vertices.push(Math.cos(a) * radius, ((side === 0 ? 0.035 + 0.11 * mass * Math.sin(Math.PI * (0.16 + t * 0.84)) : 0.02) * u), Math.sin(a) * radius);
    }
    for (let side = 0; side < 2; side++) { const offset = side * (rings + 1) * steps; for (let r = 0; r < rings; r++) for (let i = 0; i < steps; i++) { const a = offset + r * steps + i, b2 = offset + r * steps + (i + 1) % steps, c = a + steps, d = b2 + steps; indices.push(a, b2, c, b2, d, c); } }
    for (let i = 0; i < steps; i++) { const a = rings * steps + i, b2 = rings * steps + (i + 1) % steps, c = a + (rings + 1) * steps, d = b2 + (rings + 1) * steps; indices.push(a, c, b2, b2, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setIndex(indices); parts.push({ g: geo, c: C.skin, n: 'body' });
    for (let a = 0; a < arms; a++) for (let i = 1; i < 8; i++) { const t = i / 9, angle = a / arms * Math.PI * 2, h = (0.038 + 0.11 * mass * Math.sin(Math.PI * (0.16 + t * 0.84))) * u; ellipsoid(parts, Math.cos(angle) * t * 0.51 * u, h, Math.sin(angle) * t * 0.51 * u, 0.012 * u, 0.012 * u, 0.012 * u, C.detail, `ossicle-${a}-${i}`, 6); }
  } else if (b === 'urchin') {
    ellipsoid(parts, 0, 0.41 * u, 0, 0.31 * mass * u, 0.29 * mass * u, 0.31 * mass * u, C.skin, 'test', p.seg);
    const total = p.seg * 12;
    for (let i = 0; i < total; i++) { const t = (i + 0.5) / total, y = 1 - 2 * t, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5)), dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), center = new THREE.Vector3(0, 0.41 * u, 0), start = center.clone().addScaledVector(dir, 0.28 * mass * u), end = center.clone().addScaledVector(dir, (0.30 * mass + (0.10 + (i % 7) * 0.011) * p.spineLength) * u); sweep(parts, [start.toArray(), start.clone().lerp(end, 0.5).toArray(), end.toArray()], [0.013 * u, 0.007 * u, 0.0005 * u], i % 3 ? C.accent : C.detail, 'spine-' + i, { steps: 2, radial: 5 }); }
  }
}

function sponge(parts, glass, p, C, config) {
  const u = p.bodyLength, density = Math.round(p.poreDensity), basket = config.variant === 'basket', mass = p.bodyMass;
  const radiusAt = y => (0.21 + Math.sin(y * Math.PI * 0.83) * 0.17) * mass * u;
  if (basket) {
    for (let i = 0; i < density; i++) for (const sign of [-1, 1]) { const points = []; for (let j = 0; j <= 24; j++) { const t = j / 24, a = (i / density + sign * t * 0.5) * Math.PI * 2, r = radiusAt(t); points.push([Math.cos(a) * r, (0.04 + t * 0.94) * u, Math.sin(a) * r]); } sweep(parts, points, [0.006 * u, 0.006 * u], i % 2 ? C.skin : C.underside, `silica-strut-${i}-${sign}`, { steps: 24, radial: 5 }); }
    for (let j = 0; j <= 10; j++) { const t = j / 10, geo = new THREE.TorusGeometry(radiusAt(t), 0.007 * u, 5, density * 2); geo.rotateX(Math.PI / 2); geo.translate(0, (0.04 + t * 0.94) * u, 0); parts.push({ g: geo, c: C.skin, n: 'lattice-ring-' + j }); }
  } else {
    const rows = 10, point = (row, i, inner = false) => { const y = row / rows, a = i / density * Math.PI * 2, r = radiusAt(y) - (inner ? 0.06 * u : 0); return [Math.cos(a) * r, (0.025 + y * 0.90) * u, Math.sin(a) * r]; };
    for (let row = 0; row < rows; row++) for (let i = 0; i < density; i++) {
      if (row > 0 && row < 9 && (i * 3 + row * 7) % 8 === 0) continue;
      addQuad(parts, point(row, i), point(row + 1, i), point(row + 1, i + 1), point(row, i + 1), (i + row) % 4 ? C.skin : C.accent, `outer-wall-${row}-${i}`);
      addQuad(parts, point(row, i, true), point(row, i + 1, true), point(row + 1, i + 1, true), point(row + 1, i, true), C.accent, `inner-wall-${row}-${i}`);
      for (const edge of [[[row, i], [row + 1, i]], [[row + 1, i], [row + 1, i + 1]], [[row + 1, i + 1], [row, i + 1]], [[row, i + 1], [row, i]]]) addQuad(parts, point(...edge[0]), point(...edge[1]), point(...edge[1], true), point(...edge[0], true), C.detail, `pore-edge-${row}-${i}`);
    }
    const rim = new THREE.TorusGeometry(radiusAt(1) - 0.03 * u, 0.03 * u, Math.max(5, Math.round(p.seg / 2)), density * 2 + p.seg); rim.rotateX(Math.PI / 2); rim.translate(0, 0.925 * u, 0); parts.push({ g: rim, c: C.detail, n: 'osculum-rim' });
    addCylinder(parts, radiusAt(0) * 0.9, radiusAt(0), 0.04 * u, density, 0, 0.024 * u, 0, 0, 0, 0, C.accent, 'base');
  }
}

function worm(parts, glass, p, C, config) {
  const u = p.bodyLength, v = config.length || p.bodyLength, variant = config.variant, mass = p.bodyMass, bend = p.curvature, segments = Math.round(p.segments);
  const cucumber = config.id === 'sea-cucumber', caecilian = config.id === 'caecilian', flat = ['flatworm', 'ribbon', 'xenacoel'].includes(variant) && !cucumber, slender = variant === 'nematode' || variant === 'horsehair', acorn = variant === 'acorn', peanut = variant === 'peanut', priapulid = variant === 'priapulid';
  let radius = (caecilian ? 0.060 : flat ? 0.085 : slender ? 0.025 : acorn ? 0.045 : peanut || priapulid ? 0.10 : 0.047) * mass * v;
  const points = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    if (variant === 'horsehair') { const a = t * Math.PI * (2.1 + bend * 2); points.push([Math.cos(a) * (0.17 + 0.10 * t) * u, 0.025 * v + t * 0.015 * v, Math.sin(a) * (0.17 + 0.10 * t) * u]); radius = 0.005 * mass * v; }
    else points.push([(t - 0.5) * u, radius * (flat ? 0.27 : 1.02), Math.sin(t * Math.PI * 2.1) * bend * 0.17 * v]);
  }
  const profile = flat ? [[radius * 0.06, radius * 0.08], [radius * 0.80, radius * 0.23], [radius, radius * 0.25], [radius * (variant === 'flatworm' ? 1.20 : 0.65), radius * 0.2], [radius * 0.09, radius * 0.07]] : [radius * 0.03, radius * 0.88, radius, radius * (acorn || peanut ? 0.60 : 0.80), radius * 0.04];
  const curve = new THREE.CatmullRomCurve3(points.map(v => new THREE.Vector3(...v)), false, 'catmullrom', 0.45);
  if (variant === 'annelid' || priapulid) {
    for (let i = 0; i < segments; i++) sweep(parts, points, profile, i % 2 ? C.skin : C.accent, 'segment-' + (i + 1), { curve, from: i / segments, to: (i + 1) / segments, steps: 2, radial: p.seg });
    if (variant === 'annelid') sweep(parts, points, profile.map(v => v * 1.19), C.detail, 'clitellum', { curve, from: 0.68, to: 0.79, steps: 7, radial: 12 });
  } else sweep(parts, points, profile, C.skin, 'body', { curve, steps: Math.max(26, segments), radial: p.seg });
  if (variant === 'flatworm') {
    const h = curve.getPoint(0.84);
    for (const s of [-1, 1]) ellipsoid(parts, h.x, h.y + radius * 0.235, h.z + s * radius * 0.33, 0.008 * v, 0.004 * v, 0.007 * v, C.dark, 'eyespot-' + s, 8);
  }
  if (variant === 'xenacoel') {
    const furrow = points.slice(2, 18).map(q => [q[0], q[1] + radius * 0.23, q[2]]);
    sweep(parts, furrow, [0.0015 * v, 0.0025 * v, 0.001 * v], C.accent, 'dorsal-furrow', { steps: 24, radial: 4 });
  }
  if (caecilian) {
    for (let i = 2; i < segments - 2; i++) {
      const t = i / segments, pt = curve.getPoint(t), r = radius * (0.65 + Math.sin(t * Math.PI) * 0.28);
      const g = new THREE.TorusGeometry(r, 0.0032 * v, 4, 14);
      g.rotateY(Math.PI / 2); g.translate(pt.x, pt.y, pt.z);
      parts.push({ g, c: i % 2 ? C.accent : C.detail, n: 'annulus-' + i });
    }
    const head = curve.getPoint(0.92);
    ellipsoid(parts, head.x + 0.018 * v, head.y + 0.012 * v, head.z, 0.072 * v, 0.052 * v, 0.050 * v, C.skin, 'blunt-head', 10);
    for (const side of [-1, 1]) ellipsoid(parts, head.x + 0.055 * v, head.y + 0.026 * v, head.z + side * 0.030 * v, 0.006 * v, 0.005 * v, 0.005 * v, C.dark, 'pin-eye-' + side, 6);
  }
  const front = curve.getPoint(0.88);
  if (acorn) {
    ellipsoid(parts, front.x + 0.015 * v, radius, front.z, 0.075 * v, 0.061 * mass * v, 0.055 * mass * v, C.detail, 'collar', 12);
    ellipsoid(parts, front.x + 0.115 * v, radius + 0.018 * v, front.z, 0.12 * v, 0.071 * mass * v, 0.065 * mass * v, C.accent, 'proboscis', 16, 0.1);
    for (let i = 0; i < 8; i++) for (const s of [-1, 1]) { const pt = curve.getPoint(0.58 + i * 0.025); ellipsoid(parts, pt.x, pt.y + radius * 0.75, pt.z + s * radius * 0.55, 0.003 * v, 0.006 * v, 0.011 * v, C.dark, `gill-pore-${s}-${i}`, 6); }
  }
  if (peanut || priapulid || variant === 'ribbon') {
    const start = curve.getPoint(0.95), length = (peanut ? 0.32 : priapulid ? 0.15 : 0.20) * v;
    sweep(parts, [start.toArray(), [start.x + length * 0.6, radius * 1.35, start.z], [start.x + length, radius * 1.8, start.z + 0.04 * v]], [radius * (peanut ? 0.45 : 0.35), radius * 0.28, radius * 0.17], C.detail, 'introvert', { steps: 16, radial: 8 });
    for (let i = 0; i < (priapulid ? 20 : 8); i++) { const a = i * Math.PI * 2 / (priapulid ? 20 : 8), x = start.x + length; sweep(parts, [[x, radius * 1.8, start.z + 0.04 * v], [x + 0.026 * v, radius * 1.8 + Math.cos(a) * 0.018 * v, start.z + 0.04 * v + Math.sin(a) * 0.018 * v], [x + 0.035 * v, radius * 1.8 + Math.cos(a) * 0.025 * v, start.z + 0.04 * v + Math.sin(a) * 0.025 * v]], [0.004 * v, 0.0025 * v, 0.0005 * v], C.accent, 'oral-appendage-' + i, { steps: 5, radial: 4 }); }
  }
  if (cucumber) for (let i = 0; i < 10; i++) for (const s of [-1, 1]) { const pt = curve.getPoint(0.12 + (i / 9) * 0.76); ellipsoid(parts, pt.x, pt.y - radius * 0.85, pt.z + s * radius * 0.55, 0.010 * v, 0.012 * v, 0.010 * v, C.detail, `tube-foot-${s}-${i}`, 6); }
}

function lobopod(parts, glass, p, C, config) {
  const u = p.bodyLength, b = config.bodyPlan, bear = b === 'waterBear', centipede = b === 'centipede', mass = p.bodyMass, leg = p.legLength || 1, count = bear ? 4 : centipede ? Math.round(p.segments) : Math.max(12, Math.round(p.segments / 2)), radius = (bear ? 0.17 : centipede ? 0.046 : 0.058) * mass * u, y = (bear ? 0.21 : 0.095) * leg * u;
  const center = t => [(t - 0.5) * u, y + Math.sin(t * Math.PI) * radius * 0.10, Math.sin(t * Math.PI * 2) * (p.curvature || 0) * 0.10 * u];
  const points = Array.from({ length: 25 }, (_, i) => center(i / 24));
  const curve = new THREE.CatmullRomCurve3(points.map(v => new THREE.Vector3(...v)));
  const profiles = [radius * 0.55, radius, radius, radius * 0.86, radius * 0.50];
  for (let i = 0; i < (bear ? 5 : count); i++) { const n = bear ? 5 : count; sweep(parts, points, profiles, i % 2 ? C.skin : C.accent, 'trunk-segment-' + (i + 1), { curve, from: i / n, to: (i + 1) / n, steps: bear ? 5 : 3, radial: bear ? 14 : 9 }); }
  for (let i = 0; i < count; i++) {
    const t = bear ? 0.13 + i * 0.235 : 0.04 + i / count * 0.89, pt = center(t);
    for (const s of [-1, 1]) {
      const length = (bear ? 0.17 : centipede ? 0.14 : 0.075) * leg * u, endpoint = [pt[0] + (bear ? 0.03 : -0.04) * u, 0.014 * u, pt[2] + s * (radius + length)];
      sweep(parts, [[pt[0], y, pt[2] + s * radius * 0.66], [pt[0] - 0.025 * u, y * 0.6, pt[2] + s * (radius + length * 0.7)], endpoint], [radius * (bear ? 0.48 : 0.30), radius * (bear ? 0.38 : 0.20), radius * (bear ? 0.23 : 0.045)], C.skin, `lobopod-${s}-${i + 1}`, { steps: 9, radial: bear ? 9 : 6 });
      if (!centipede) for (let claw = -1; claw <= 1; claw++) sweep(parts, [[endpoint[0] + claw * radius * 0.20, endpoint[1], endpoint[2]], [endpoint[0] + claw * radius * 0.23 + 0.016 * u, 0.011 * u, endpoint[2] + s * 0.020 * u], [endpoint[0] + claw * radius * 0.25 + 0.022 * u, 0.020 * u, endpoint[2] + s * 0.025 * u]], [0.006 * u, 0.004 * u, 0.0007 * u], C.detail, `claw-${s}-${i}-${claw}`, { steps: 5, radial: 4 });
    }
  }
  const front = center(0.97);
  ellipsoid(parts, front[0], y + 0.02 * u, front[2], radius * 0.90, radius * 0.83, radius * 0.88, C.skin, 'head', p.seg);
  for (const s of [-1, 1]) {
    ellipsoid(parts, front[0] + radius * 0.62, y + radius * 0.30, front[2] + s * radius * 0.47, radius * 0.13, radius * 0.14, radius * 0.10, C.dark, 'eye-' + s, 8);
    if (!bear) sweep(parts, [[front[0] + radius * 0.4, y + radius * 0.4, front[2] + s * radius * 0.4], [front[0] + 0.11 * u, y + 0.06 * u, front[2] + s * 0.075 * u], [front[0] + 0.18 * u, y + 0.05 * u, front[2] + s * 0.11 * u]], [0.012 * u, 0.008 * u, 0.002 * u], C.accent, 'antenna-' + s, { steps: 10, radial: 6 });
  }
  if (bear) { const mouth = new THREE.TorusGeometry(radius * 0.28, radius * 0.075, 6, 12); mouth.rotateY(Math.PI / 2); mouth.translate(front[0] + radius * 0.80, y - radius * 0.05, front[2]); parts.push({ g: mouth, c: C.detail, n: 'buccal-ring' }); }
}

function colony(parts, glass, p, C, config) {
  const u = p.bodyLength, b = config.bodyPlan, v = config.variant, mass = p.bodyMass;
  if (b === 'coral') {
    const branch = (start, end, radius, depth, index) => {
      const mid = new THREE.Vector3(...start).lerp(new THREE.Vector3(...end), 0.5); mid.x += radius * 0.3;
      sweep(parts, [start, mid.toArray(), end], [radius, radius * 0.8, radius * 0.45], depth % 2 ? C.skin : C.accent, 'branch-' + index, { steps: 8, radial: Math.max(6, Math.round(p.seg * 0.6)) });
      if (depth <= 0) { ellipsoid(parts, ...end, radius * 0.58, radius * 0.7, radius * 0.58, C.underside, 'growing-tip-' + index, 8); return; }
      for (let j = 0; j < 3; j++) { const a = index * 1.37 + j * 2.1, length = (0.15 + depth * 0.07) * u; branch(end, [end[0] + Math.cos(a) * length * 0.68, end[1] + length, end[2] + Math.sin(a) * length * 0.68], radius * 0.62, depth - 1, index * 3 + j + 1); }
    };
    branch([0, 0.02 * u, 0], [0.025 * u, 0.25 * u, 0], 0.071 * mass * u, 3, 0);
    ellipsoid(parts, 0, 0.02 * u, 0, 0.16 * u, 0.034 * u, 0.14 * u, C.accent, 'holdfast', 12);
    return;
  }
  const count = v === 'bryozoan' ? 7 : 1;
  for (let zooid = 0; zooid < count; zooid++) {
    const a = zooid * 2.4, x = count > 1 ? Math.cos(a) * (zooid ? 0.22 : 0) * u : 0, z = count > 1 ? Math.sin(a) * (zooid ? 0.22 : 0) * u : 0, height = (count > 1 ? 0.38 + (zooid % 3) * 0.12 : v === 'entoproct' ? 0.55 : 0.48) * u;
    sweep(parts, [[0, 0.025 * u, 0], [x * 0.6, height * 0.6, z * 0.6], [x, height, z]], [0.035 * mass * u, 0.026 * mass * u, 0.033 * mass * u], C.accent, 'stalk-' + zooid, { steps: 12, radial: 8 });
    const radius = (count > 1 ? 0.07 : v === 'entoproct' ? 0.11 : 0.14) * mass * u;
    const profile = [[0.026 * u, 0], [radius * 0.8, 0.07 * u], [radius, 0.13 * u], [radius * 0.86, 0.135 * u], [radius * 0.64, 0.07 * u]].map(pt => new THREE.Vector2(...pt));
    const geo = new THREE.LatheGeometry(profile, p.seg); geo.translate(x, height - 0.05 * u, z); parts.push({ g: geo, c: C.skin, n: 'calyx-' + zooid });
    const number = Math.round(p.tentacles), len = p.tentacleLength;
    for (let i = 0; i < number; i++) {
      const angle = v === 'phoronid' ? -Math.PI * 0.25 + i / (number - 1) * Math.PI * 1.5 : i / number * Math.PI * 2, cos = Math.cos(angle), sin = Math.sin(angle), spread = (v === 'fanworm' ? 0.38 : count > 1 ? 0.14 : 0.23) * len * u;
      const start = [x + cos * radius * 0.82, height + 0.074 * u, z + sin * radius * 0.82], middle = [x + cos * spread * 0.9, height + (0.12 + 0.17 * len) * u, z + sin * spread * 0.9], end = [x + cos * spread, height + (0.12 + 0.32 * len) * u, z + sin * spread];
      sweep(parts, [start, middle, end], [0.009 * u, 0.006 * u, 0.001 * u], i % 3 === 0 ? C.detail : C.skin, `lophophore-${zooid}-${i}`, { steps: 10, radial: 5 });
      if (v === 'fanworm') for (let j = 1; j < 8; j++) { const t = j / 9, center = new THREE.Vector3(...start).lerp(new THREE.Vector3(...end), t); for (const s of [-1, 1]) addWire(parts, center.toArray(), [center.x + Math.cos(angle + s * Math.PI / 2) * 0.034 * u, center.y + 0.025 * u, center.z + Math.sin(angle + s * Math.PI / 2) * 0.034 * u], C.accent, 0.002 * u, 3, `pinnule-${i}-${j}-${s}`); }
    }
  }
  ellipsoid(parts, 0, 0.025 * u, 0, 0.16 * mass * u, 0.025 * u, 0.14 * mass * u, C.detail, 'attachment-disk', 12);
}

function bivalve(parts, glass, p, C) {
  const u = p.bodyLength, mass = p.bodyMass, opening = p.valveOpening;
  for (const upper of [false, true]) {
    const extra = upper ? { rig: 'valve', pivot: [-0.39 * u, 0.17 * u, 0] } : {}, list = [], rings = Math.max(5, Math.round(p.seg * 0.6)), slices = p.seg * 2;
    const point = (r, j) => { const phi = r / rings * Math.PI / 2, theta = j / slices * Math.PI * 2, x = Math.cos(theta) * Math.sin(phi) * 0.44 * u; return [x, (0.18 + (upper ? 1 : -1) * Math.cos(phi) * 0.17 * mass + (upper ? (x / u + 0.44) * opening * 0.4 : 0)) * u, Math.sin(theta) * Math.sin(phi) * 0.36 * mass * u]; };
    for (let r = 0; r < rings; r++) for (let j = 0; j < slices; j++) addQuad(list, point(r, j), point(r + 1, j), point(r + 1, j + 1), point(r, j + 1), j % 4 === 0 ? C.accent : C.skin, `valve-panel-${upper}-${r}-${j}`, 0.003 * u);
    for (let j = 0; j < slices; j += 2) for (let r = 0; r < rings; r++) addWire(list, point(r, j), point(r + 1, j), C.detail, 0.004 * u, 5, `shell-rib-${upper}-${j}-${r}`);
    for (const part of list) parts.push({ ...part, ...extra });
  }
  sweep(parts, [[-0.3 * u, 0.17 * u, 0], [-0.53 * u, 0.11 * u, 0], [-0.57 * u, 0.03 * u, 0]], [0.038 * u, 0.029 * u, 0.021 * u], C.accent, 'pedicle', { steps: 10, radial: 8 });
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; sweep(parts, [[0.02 * u, 0.17 * u, 0], [Math.cos(a) * 0.14 * u, 0.19 * u, Math.sin(a) * 0.13 * u], [Math.cos(a) * 0.23 * u, (0.19 + opening * 0.09) * u, Math.sin(a) * 0.20 * u]], [0.007 * u, 0.005 * u, 0.001 * u], C.underside, 'lophophore-' + i, { steps: 8, radial: 5 }); }
}

function microscopic(parts, glass, p, C, config) {
  const u = p.bodyLength, mass = p.bodyMass, v = config.variant, cilia = p.ciliaLength || 1;
  const rotifer = v === 'rotifer', lorica = v === 'loriciferan', kinorhynch = v === 'kinorhynch', cyclio = v === 'cycliophoran', acantho = v === 'acanthocephalan', jaw = v === 'jaw-worm', micrognath = v === 'micrognath', gastro = v === 'gastrotrich', dicyemid = v === 'dicyemid';
  const width = (lorica || cyclio ? 0.18 : rotifer ? 0.13 : jaw || dicyemid ? 0.046 : acantho ? 0.075 : 0.09) * mass * u, y = width + 0.03 * u;
  const path = [[-0.5 * u, y, 0], [-0.23 * u, y + 0.02 * u, 0.02 * u], [0.16 * u, y + 0.02 * u, 0], [0.48 * u, y, 0]], radii = [width * 0.13, width, width * (lorica ? 0.84 : 0.85), width * (lorica || rotifer || cyclio ? 0.5 : 0.12)], curve = new THREE.CatmullRomCurve3(path.map(v => new THREE.Vector3(...v)));
  const count = kinorhynch ? 11 : v === 'orthonectid' ? 14 : micrognath ? 3 : 1;
  for (let i = 0; i < count; i++) sweep(dicyemid ? glass : parts, path, radii, dicyemid ? C.glass : i % 2 ? C.accent : C.skin, 'body-segment-' + (i + 1), { curve, from: i / count, to: (i + 1) / count, steps: count === 1 ? 25 : 4, radial: p.seg, zone: dicyemid ? 'glass' : 'skin' });
  if (dicyemid || rotifer) sweep(parts, [[-0.36 * u, y, 0], [0.04 * u, y + 0.025 * u, 0], [0.34 * u, y, 0]], [width * 0.17, width * 0.32, width * 0.13], C.detail, 'axial-cell', { steps: 20, radial: 8 });
  if (dicyemid) ellipsoid(parts, 0.47 * u, y, 0, 0.051 * u, 0.035 * u, 0.033 * u, C.accent, 'attachment-calotte', p.seg);
  if (rotifer) {
    for (const s of [-1, 1]) {
      const center = [0.47 * u, y + 0.024 * u, s * 0.094 * u], geo = new THREE.TorusGeometry(0.10 * u, 0.018 * u, 7, 18); geo.rotateY(Math.PI / 2); geo.translate(...center); parts.push({ g: geo, c: C.detail, n: 'corona-' + s });
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; addWire(parts, [center[0], center[1] + Math.cos(a) * 0.10 * u, center[2] + Math.sin(a) * 0.10 * u], [center[0] + 0.040 * cilia * u, center[1] + Math.cos(a) * 0.122 * u, center[2] + Math.sin(a) * 0.122 * u], C.underside, 0.002 * u, 4, `coronal-cilium-${s}-${i}`); }
    }
  }
  if (lorica) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; sweep(parts, [[-0.38 * u, y + Math.cos(a) * width * 0.6, Math.sin(a) * width * 0.6], [-0.1 * u, y + Math.cos(a) * width * 1.01, Math.sin(a) * width * 1.01], [0.19 * u, y + Math.cos(a) * width * 0.75, Math.sin(a) * width * 0.75]], [0.009 * u, 0.008 * u, 0.005 * u], C.detail, 'lorica-ridge-' + i, { steps: 12, radial: 5 }); }
  if (lorica || kinorhynch || acantho) {
    const neck = lorica ? 0.15 : 0.12;
    sweep(parts, [[0.34 * u, y, 0], [(0.4 + neck * 0.4) * u, y, 0], [(0.43 + neck) * u, y, 0]], [width * 0.4, width * 0.47, width * 0.29], C.accent, 'introvert', { steps: 12, radial: 10 });
    for (let row = 0; row < (acantho ? 6 : 3); row++) for (let i = 0; i < 12; i++) {
      const a = (i / 12 + row * 0.035) * Math.PI * 2, x = (0.38 + row * 0.031) * u, r = width * 0.44, reach = (lorica ? 0.10 : 0.035) * cilia * u;
      sweep(parts, [[x, y + Math.cos(a) * r, Math.sin(a) * r], [x + 0.02 * u, y + Math.cos(a) * (r + reach), Math.sin(a) * (r + reach)], [x + (acantho ? -0.014 : 0.05) * u, y + Math.cos(a) * (r + reach * 1.2), Math.sin(a) * (r + reach * 1.2)]], [0.005 * u, 0.003 * u, 0.0006 * u], C.detail, `scalid-${row}-${i}`, { steps: 6, radial: 4 });
    }
  }
  if (kinorhynch) for (let i = 0; i < 11; i++) for (const s of [-1, 1]) { const pt = curve.getPoint((i + 0.5) / 11); sweep(parts, [[pt.x, pt.y, s * width * 0.88], [pt.x - 0.025 * u, pt.y + 0.025 * u, s * width * 1.5], [pt.x - 0.055 * u, pt.y + 0.03 * u, s * width * 1.75]], [0.007 * u, 0.004 * u, 0.0006 * u], C.detail, `lateral-spine-${s}-${i}`, { steps: 6, radial: 4 }); }
  if (cyclio) {
    const rim = new THREE.TorusGeometry(width * 0.58, 0.012 * u, 6, 20); rim.rotateY(Math.PI / 2); rim.translate(0.47 * u, y, 0); parts.push({ g: rim, c: C.detail, n: 'buccal-funnel' });
    ellipsoid(parts, -0.51 * u, y, 0, 0.024 * u, 0.105 * u, 0.1 * u, C.accent, 'adhesive-disk', 12);
    ellipsoid(parts, -0.07 * u, y + width * 0.79, width * 0.61, 0.10 * u, 0.07 * u, 0.06 * u, C.detail, 'external-bud', 10);
  }
  if (rotifer || gastro) for (const s of [-1, 1]) sweep(parts, [[-0.43 * u, y, 0], [-0.57 * u, y - 0.04 * u, s * 0.035 * u], [-0.63 * u, y - 0.055 * u, s * 0.064 * u]], [0.014 * u, 0.008 * u, 0.0008 * u], C.accent, 'adhesive-toe-' + s, { steps: 8, radial: 5 });
  if (jaw || micrognath || rotifer) for (const s of [-1, 1]) { const shape = new THREE.TorusGeometry(width * 0.3, width * 0.07, 5, 12, Math.PI * 1.55); shape.rotateY(Math.PI / 2); shape.translate(0.31 * u, y + width * 0.27, s * width * 0.25); parts.push({ g: shape, c: C.dark, n: 'jaw-' + s }); }
  if (!acantho && !lorica && !kinorhynch) {
    const rows = gastro || jaw || dicyemid || v === 'orthonectid' ? 32 : 18;
    for (let i = 0; i < rows; i++) for (const s of [-1, 1]) { const t = (i + 1) / (rows + 1), pt = curve.getPoint(t), r = width * Math.sin(t * Math.PI) ** 0.5, reach = (gastro ? 0.043 : 0.025) * cilia * u; addWire(parts, [pt.x, pt.y, pt.z + s * r], [pt.x - reach * 0.5, pt.y + reach * 0.3, pt.z + s * (r + reach)], C.underside, 0.0018 * u, 4, `cilium-${s}-${i}`); }
  }
  if (gastro) for (let i = 0; i < 12; i++) for (let row = -1; row <= 1; row++) { const t = (i + 2) / 16, pt = curve.getPoint(t); ellipsoid(parts, pt.x, pt.y + width * Math.sin(t * Math.PI) ** 0.5 * 0.87, row * width * 0.4, 0.019 * u, 0.008 * u, 0.018 * u, C.detail, `scale-${i}-${row}`, 6); }
}

function arrowWorm(parts, glass, p, C) {
  const u = p.bodyLength, mass = p.bodyMass, y = 0.09 * u;
  const path = [[-0.5 * u, y, 0], [-0.20 * u, y + 0.005 * u, 0], [0.23 * u, y, 0], [0.45 * u, y, 0]], radii = [0.001 * u, 0.026 * mass * u, 0.036 * mass * u, 0.02 * u];
  sweep(glass, path, radii, C.glass, 'body', { steps: 30, radial: 12, zone: 'glass' });
  sweep(parts, path.slice(1), [0.007 * u, 0.011 * u, 0.004 * u], C.detail, 'gut', { steps: 20, radial: 7 });
  ellipsoid(parts, 0.43 * u, y, 0, 0.055 * u, 0.042 * u, 0.042 * u, C.skin, 'head', 12);
  for (const s of [-1, 1]) {
    prism(glass, [[-0.31 * u, y, 0], [0.13 * u, y, 0], [-0.08 * u, y, s * 0.12 * u]], [0, 0.002 * u, 0], C.glass, 'lateral-fin-' + s);
    prism(glass, [[-0.36 * u, y, 0], [-0.48 * u, y, s * 0.10 * u], [-0.56 * u, y, 0]], [0, 0.002 * u, 0], C.glass, 'caudal-fin-' + s);
    ellipsoid(parts, 0.443 * u, y + 0.029 * u, s * 0.022 * u, 0.008 * u, 0.006 * u, 0.007 * u, C.dark, 'eye-' + s, 8);
    for (let i = 0; i < 5; i++) sweep(parts, [[0.45 * u, y + (i - 2) * 0.011 * u, s * 0.032 * u], [0.505 * u, y + (i - 2) * 0.016 * u, s * 0.043 * u], [0.529 * u, y + (i - 2) * 0.013 * u, s * 0.009 * u]], [0.003 * u, 0.002 * u, 0.0005 * u], C.dark, `grasping-spine-${s}-${i}`, { steps: 6, radial: 4 });
  }
}

function snake(parts, glass, p, C, config) {
  // A serpentine S-curve on the ground: no limbs, a tapering tail, and a wedge head.
  const u = p.bodyLength, v = config.length || p.bodyLength, mass = p.bodyMass, bend = p.curvature ?? 0.5, seg = p.seg;
  const girth = 0.052 * mass * v;
  const y = girth * 0.92;
  const pts = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    pts.push([(t - 0.5) * 1.5 * u, y + Math.sin(t * Math.PI * 2.6) * 0.012 * v, Math.sin(t * Math.PI * 2.15 + 0.4) * bend * 0.42 * v]);
  }
  const curve = new THREE.CatmullRomCurve3(pts.map(v => new THREE.Vector3(...v)), false, 'catmullrom', 0.45);
  const radii = [girth * 0.16, girth * 0.62, girth * 0.98, girth, girth * 0.95, girth * 0.66, girth * 0.30];
  sweep(parts, pts, radii, C.skin, 'body', { curve, steps: 72, radial: seg });
  // Long lateral stripes are the classic garter-snake marking.
  for (const lane of [-1, 0, 1]) {
    const laneRadius = lane === 0 ? girth * 0.96 : girth * 0.80;
    const stripe = [];
    for (let i = 2; i <= 24; i++) {
      const t = i / 26, pt = curve.getPoint(t), tan = curve.getTangent(t).normalize();
      const side = new THREE.Vector3(0, 1, 0).cross(tan).normalize();
      const scale = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.04) / 0.92))) ** 0.35;
      stripe.push([pt.x + side.x * lane * laneRadius * 0.82, pt.y + (lane === 0 ? laneRadius * 0.82 : laneRadius * 0.18) * scale, pt.z + side.z * lane * laneRadius * 0.82]);
    }
    sweep(parts, stripe, [girth * 0.05, girth * 0.16, girth * 0.16, girth * 0.05], lane === 0 ? C.accent : C.underside, 'stripe-' + lane, { steps: 48, radial: 5 });
  }
  const head = curve.getPoint(1), neck = curve.getPoint(0.955);
  const dir = new THREE.Vector3().subVectors(head, neck).normalize();
  const hx = head.x + dir.x * girth * 0.6, hz = head.z + dir.z * girth * 0.6;
  const hs = p.headSize ?? 1;
  ellipsoid(parts, hx, y + girth * 0.16, hz, girth * 1.55 * hs, girth * 0.80 * hs, girth * 1.12 * hs, C.skin, 'head-cranium', seg, 0);
  ellipsoid(parts, hx + dir.x * girth * 1.0, y + girth * 0.02, hz + dir.z * girth * 1.0, girth * 0.72 * hs, girth * 0.42 * hs, girth * 0.62 * hs, C.underside, 'jaw', 10);
  for (const s of [-1, 1]) {
    const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    const ex = hx + dir.x * girth * 0.55 + side.x * s * girth * 0.78;
    const ez = hz + dir.z * girth * 0.55 + side.z * s * girth * 0.78;
    ellipsoid(parts, ex, y + girth * 0.60, ez, girth * 0.28, girth * 0.28, girth * 0.24, C.dark, 'eye-' + s, 8);
    ellipsoid(parts, ex + dir.x * girth * 0.12, y + girth * 0.70, ez + dir.z * girth * 0.12, girth * 0.10, girth * 0.10, girth * 0.09, C.underside, 'eye-glint-' + s, 6);
  }
  sweep(parts, [[hx + dir.x * girth * 1.5, y - girth * 0.08, hz + dir.z * girth * 1.5], [hx + dir.x * girth * 3.2, y - girth * 0.20, hz + dir.z * girth * 3.2]], [girth * 0.10, girth * 0.02], C.dark, 'tongue', { steps: 4, radial: 4 });
}

function placozoan(parts, glass, p, C) {
  const u = p.bodyLength, mass = p.bodyMass, rings = Math.max(6, Math.round(p.seg * 0.6)), segments = p.seg * 4 + 8, vertices = [], indices = [];
  const edge = a => 0.40 + 0.055 * Math.sin(a * 3 + 0.4) + 0.035 * Math.sin(a * 7) + 0.02 * Math.cos(a * 11);
  for (let ring = 0; ring <= rings; ring++) for (let i = 0; i < segments; i++) { const t = ring / rings, a = i / segments * Math.PI * 2, radius = edge(a) * t * u; vertices.push(Math.cos(a) * radius, (0.026 + Math.sin(t * Math.PI) * 0.021 * mass + Math.sin(a * 5) * 0.008 * t) * u, Math.sin(a) * radius * 0.8); }
  for (let ring = 0; ring < rings; ring++) for (let i = 0; i < segments; i++) { const a = ring * segments + i, b = ring * segments + (i + 1) % segments, c = a + segments, d = b + segments; indices.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); parts.push({ g, c: C.skin, n: 'body' });
  const lower = g.clone(); lower.translate(0, -0.012 * u, 0); parts.push({ g: lower, c: C.underside, n: 'ventral-epithelium' });
  for (let i = 0; i < 65; i++) { const a = i * 2.39996, radius = Math.sqrt((i + 0.5) / 65) * 0.32 * u; ellipsoid(parts, Math.cos(a) * radius, (0.043 + 0.01 * Math.sin(i)) * u, Math.sin(a) * radius * 0.8, 0.018 * u, 0.009 * u, 0.016 * u, i % 3 ? C.accent : C.detail, 'dorsal-cell-' + i, 7); }
  for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, r = edge(a) * u; addWire(parts, [Math.cos(a) * r, 0.025 * u, Math.sin(a) * r * 0.8], [Math.cos(a) * (r + 0.025 * u), 0.01 * u, Math.sin(a) * (r + 0.025 * u) * 0.8], C.underside, 0.0015 * u, 4, 'cilium-' + i); }
}

export function createAsset(userParams = {}) {
  const config = userParams.__animal ? { ...ASSET, ...userParams.__animal } : ASSET;
  const schema = getSchema(config), p = {};
  for (const key of Object.keys(schema)) p[key] = schema[key].default;
  Object.assign(p, userParams); delete p.__animal; delete p.__hiddenParts;
  for (const [key, param] of Object.entries(schema)) {
    if (param.type === 'range') p[key] = THREE.MathUtils.clamp(Number.isFinite(Number(p[key])) ? Number(p[key]) : param.default, param.min, param.max);
    if (param.type === 'choice' && !param.options.includes(p[key])) p[key] = param.default;
    if (param.type === 'toggle') p[key] = Boolean(p[key]);
  }
  p.seg = { Draft: 10, Studio: 14, High: 20 }[p.detailLevel];
  const C = zonesFor(p.colorway, { ...config.defaults, ...userParams }, config), group = new THREE.Group(), parts = [], glassParts = [];
  group.name = config.id;
  const builders = { mammal, bird, fish, reptile, frog, snake, butterfly, beetle: arthropod, spider: arthropod, crab: arthropod, scorpion: arthropod, octopus: mollusk, snail: mollusk, slug: mollusk, jellyfish: radialAnimal, combJelly: radialAnimal, anemone: radialAnimal, starfish: radialAnimal, urchin: radialAnimal, sponge, worm, waterBear: lobopod, velvetWorm: lobopod, centipede: lobopod, colony, coral: colony, bivalve, microscopic, arrowWorm, placozoan };
  const builder = builders[config.bodyPlan];
  if (!builder) throw new Error('Unknown animal body plan: ' + config.bodyPlan);
  builder(parts, glassParts, p, C, config);
  const modelRig = getRig(config);
  for (const part of [...parts, ...glassParts]) {
    part.zone = part.zone || ZONE_KEYS.find(key => C[key] === part.c) || 'skin';
    if (modelRig.body && !part.rig) { part.rig = 'body'; part.pivot = [0, p.bodyLength * 0.35, 0]; }
    if (part.n === 'shell' && modelRig.shell) { part.rig = 'shell'; part.pivot = [-0.09 * p.bodyLength, 0.39 * p.bodyLength, 0]; }
  }
  const hidden = userParams.__hiddenParts || config.hiddenParts || [];
  for (const list of [parts, glassParts]) {
    const names = new Map();
    for (const part of list) { const count = names.get(part.n) || 0; names.set(part.n, count + 1); if (count) part.n += '-' + (count + 1); }
    for (let i = list.length - 1; i >= 0; i--) if (hidden.includes(list[i].n) || hidden.includes(list[i].rig)) { list[i].g.dispose(); list.splice(i, 1); }
  }
  const solid = parts.length ? finish(parts, MAT.clone(), 'solid', p.mergeForProduction) : null;
  if (solid) group.add(solid);
  const transparent = glassParts.length ? finish(glassParts, GLASS_MAT.clone(), 'glass', p.mergeForProduction) : null;
  if (transparent) group.add(transparent);
  const bounds = new THREE.Box3().setFromObject(group), size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.x + size.y + size.z) || Math.max(size.x, size.y, size.z) <= 0) throw new Error('Invalid geometry for ' + config.id);
  group.position.y = -bounds.min.y;
  let triangles = 0, partCount = 0; const materials = new Set();
  group.traverse(object => { if (object.isMesh) { triangles += (object.geometry.index ? object.geometry.index.count : object.geometry.attributes.position.count) / 3; partCount++; materials.add(object.material); } });
  group.userData = { asset: config, parameters: p, zones: C, units: 'meters', dimensions: size.toArray(), triangles, partCount, materialCount: materials.size, rig: modelRig, detach: [...new Set(parts.map(part => part.rig || part.n))], night, license: 'CC0-1.0' };
  return group;
}

export default createAsset;