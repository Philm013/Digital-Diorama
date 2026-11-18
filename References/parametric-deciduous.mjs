/*
 * PARAMETRIC SPECIES-SPECIFIC DECIDUOUS TREE (High Detail & Full Crown)
 * A botanical, stylized-natural procedural broadleaf tree for three.js with
 * multi-tier ramified branching, full canopy foliage coverage, and species profiles:
 * gnarled oak, slender aspen, domed maple, weeping willow, and stylized hero tree.
 * One import, no loaders, no external textures, one draw call option.
 *
 * QUICK START
 *   import { createAsset } from './parametric-deciduous.mjs';
 *   scene.add(createAsset({
 *     speciesProfile: 'oak',
 *     treeHeight: 12,
 *     canopyWidth: 11,
 *     foliageDensity: 0.8,
 *     mergeForProduction: true
 *   }));
 *
 * SPECS  ~18,000 - 65,000 tris (optimized multi-tier branching + lush foliage).
 *        Default dimensions: ~10.5 x 12.0 x 10.5 m (real-world scale).
 * PARTS  animate: wholeCanopy, scaffoldBranch_1..12, oakLeaves, aspenLeaves,
 *                 mapleLeaves, willowWithes, stylizedCanopy, seeds, fallingLeaves
 *        detach: rootBase, forestFloor, scaffoldBranches, speciesFoliage, seeds, fallingLeaves
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  bark:      '#534336',
  upperBark: '#786652',
  barkDark:  '#2f251c',
  branch:    '#4a3c30',
  twig:      '#63513f',
  leafDark:  '#1b4122',
  leafMid:   '#367831',
  leafLight: '#78af45',
  leafUnder: '#b5caa0',
  autumn:    '#be7228',
  blossom:   '#e6cee0',
  samara:    '#b49852',
  fruit:     '#866731',
  moss:      '#597743',
  soil:      '#46382a',
  stone:     '#75746e',
  litter:    '#8a673a'
};

export const COLORWAYS = {
  verdantSummer: {
    bark: '#544436', upperBark: '#7a6854', barkDark: '#2c2318',
    branch: '#483a2e', twig: '#68543f',
    leafDark: '#1a3e22', leafMid: '#34732f', leafLight: '#7bb045',
    leafUnder: '#b4caa0', autumn: '#a78832', blossom: '#e6dec5',
    samara: '#b09754', fruit: '#7d612e',
    moss: '#577641', soil: '#47392b', stone: '#77766f', litter: '#84663b'
  },
  goldenAutumn: {
    bark: '#524031', upperBark: '#856f52', barkDark: '#281f15',
    branch: '#493a2a', twig: '#71583d',
    leafDark: '#85561a', leafMid: '#ca8f24', leafLight: '#edc84b',
    leafUnder: '#e3d2a0', autumn: '#bd571d', blossom: '#edd9ad',
    samara: '#bf9649', fruit: '#8c6126',
    moss: '#68703d', soil: '#4a3928', stone: '#7c7970', litter: '#ac7531'
  },
  sugarMapleScarlet: {
    bark: '#4a3c35', upperBark: '#725b51', barkDark: '#251d19',
    branch: '#42342c', twig: '#664d3f',
    leafDark: '#751919', leafMid: '#bd371d', leafLight: '#eb862a',
    leafUnder: '#e3bca0', autumn: '#9d2215', blossom: '#efc3bd',
    samara: '#c18647', fruit: '#894c26',
    moss: '#5a6d45', soil: '#423326', stone: '#787671', litter: '#9f4924'
  },
  enchantedSpring: {
    bark: '#44384d', upperBark: '#695a72', barkDark: '#251c2d',
    branch: '#3d3247', twig: '#64546b',
    leafDark: '#16644f', leafMid: '#2d9964', leafLight: '#a3db56',
    leafUnder: '#ceecd4', autumn: '#d495cb', blossom: '#f2c3e4',
    samara: '#d4c566', fruit: '#ab6aa4',
    moss: '#3c956d', soil: '#372d40', stone: '#687783', litter: '#8a7a9b'
  }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: {
    type: 'toggle', default: false, label: 'Merge for Production',
    affects: 'geometry',
    describe: 'Merges all vertex-colored geometry into 1 draw call. Disable for selectable semantic parts.'
  },
  speciesProfile: {
    type: 'choice', default: 'oak', label: 'Broadleaf Species',
    options: ['oak', 'aspen', 'maple', 'willow', 'stylized'],
    affects: 'geometry',
    describe: 'Selects crown ramification, trunk flare, branch habit, foliage primitive and seeds.'
  },
  treeHeight: {
    type: 'range', default: 12, min: 4, max: 24, step: 0.25,
    label: 'Tree Height', affects: 'geometry',
    describe: 'Overall tree height in meters. Trunk, scaffolds and crown are recalculated.'
  },
  canopyWidth: {
    type: 'range', default: 11, min: 3, max: 20, step: 0.25,
    label: 'Canopy Width', affects: 'geometry',
    describe: 'Maximum mature crown spread in meters.'
  },
  crownSpread: {
    type: 'range', default: 0.6, min: 0, max: 1, step: 0.01,
    label: 'Crown Spread', affects: 'geometry',
    describe: 'Blends between a narrow upright crown and a broad sprawling crown.'
  },
  branchGnarl: {
    type: 'range', default: 0.5, min: 0, max: 1, step: 0.01,
    label: 'Branch Gnarl', affects: 'geometry',
    describe: 'Angular per-segment deflection producing crooked, botanical limbs.'
  },
  branchDroop: {
    type: 'range', default: 0.42, min: 0, max: 1, step: 0.01,
    label: 'Branch Droop', affects: 'geometry',
    describe: 'Gravitational bend along limbs and length of pendulous willow withes.'
  },
  foliageDensity: {
    type: 'range', default: 0.75, min: 0.2, max: 1.0, step: 0.01,
    label: 'Foliage Density', affects: 'geometry',
    describe: 'Controls branching ramification depth and leaf count per cluster across all branches.'
  },
  trunkLeanAndTwist: {
    type: 'range', default: 0.25, min: 0, max: 1, step: 0.01,
    label: 'Lean & Twist', affects: 'geometry',
    describe: 'Wind-shaped trunk spline curve and rotational drift of scaffolds.'
  },
  trunkFlare: {
    type: 'range', default: 0.6, min: 0, max: 1, step: 0.01,
    label: 'Trunk Flare', affects: 'geometry',
    describe: 'Strength of the buttressed root collar where trunk meets ground.'
  },
  leafHueAndSeason: {
    type: 'choice', default: 'colorway', label: 'Leaf Season Hue',
    options: ['colorway', 'freshSpring', 'deepSummer', 'earlyAutumn', 'peakAutumn', 'moonlit'],
    affects: 'colors',
    describe: 'Applies a coordinated seasonal foliage palette.'
  },
  leafDetailLevel: {
    type: 'choice', default: 'standard', label: 'Leaf Detail',
    options: ['low', 'standard', 'high'],
    affects: 'geometry',
    describe: 'Low uses simple folded blades; standard uses species lobes; high adds veins and petioles.'
  },
  leafSizeScale: {
    type: 'range', default: 1.0, min: 0.5, max: 2.0, step: 0.05,
    label: 'Leaf Size', affects: 'geometry',
    describe: 'Global scale multiplier applied to leaf blade dimensions.'
  },
  leafDroop: {
    type: 'range', default: 0.38, min: 0, max: 1, step: 0.01,
    label: 'Leaf Droop', affects: 'geometry',
    describe: 'Hangs leaf blades downward from petioles.'
  },
  showLeafUndersides: {
    type: 'toggle', default: true, label: 'Pale Undersides',
    affects: 'colors',
    describe: 'Generates two-sided blades with paler undersides.'
  },
  seedDensity: {
    type: 'range', default: 0.35, min: 0, max: 1, step: 0.01,
    label: 'Seed Density', affects: 'geometry',
    describe: 'Controls acorns, catkins, samaras and blossoms.'
  },
  rootBaseVisible: {
    type: 'toggle', default: true, label: 'Exposed Root Base',
    affects: 'geometry',
    describe: 'Includes buttress flares and radial surface roots.'
  },
  groundDebrisVisible: {
    type: 'toggle', default: true, label: 'Forest Floor',
    affects: 'geometry',
    describe: 'Includes soil base, moss patches, stones, and fallen leaf litter.'
  },
  fallingLeavesVisible: {
    type: 'toggle', default: false, label: 'Falling Leaves',
    affects: 'geometry',
    describe: 'Adds a seasonal cloud of falling leaves beneath the canopy.'
  },
  seed: {
    type: 'range', default: 419, min: 1, max: 9999, step: 1,
    label: 'Natural Variation Seed', affects: 'geometry',
    describe: 'Deterministic pseudo-random seed for branching variation.'
  },
  colorway: {
    type: 'choice', default: 'verdantSummer', label: 'Colorway',
    options: Object.keys(COLORWAYS), affects: 'colors',
    describe: 'Curated bark, foliage, seed, earth and stone palette.'
  },
  bark: {
    type: 'color', default: BASE.bark, label: 'Lower Bark',
    affects: 'colors', describe: 'Trunk and root bark color.'
  },
  upperBark: {
    type: 'color', default: BASE.upperBark, label: 'Upper Bark',
    affects: 'colors', describe: 'Upper trunk and primary limb bark color.'
  },
  branch: {
    type: 'color', default: BASE.branch, label: 'Limbs',
    affects: 'colors', describe: 'Scaffold branch color.'
  },
  leafDark: {
    type: 'color', default: BASE.leafDark, label: 'Shadow Leaves',
    affects: 'colors', describe: 'Inner leaf and shadow canopy color.'
  },
  leafMid: {
    type: 'color', default: BASE.leafMid, label: 'Main Leaves',
    affects: 'colors', describe: 'Primary leaf blade color.'
  },
  leafLight: {
    type: 'color', default: BASE.leafLight, label: 'Sunlit Tips',
    affects: 'colors', describe: 'Sunlit outer foliage tip color.'
  },
  leafUnder: {
    type: 'color', default: BASE.leafUnder, label: 'Leaf Underside',
    affects: 'colors', describe: 'Pale underside blade color.'
  },
  autumn: {
    type: 'color', default: BASE.autumn, label: 'Autumn Accent',
    affects: 'colors', describe: 'Turning foliage and leaf litter color.'
  },
  samara: {
    type: 'color', default: BASE.samara, label: 'Seeds & Caps',
    affects: 'colors', describe: 'Samara wing, catkin, and acorn cap color.'
  },
  moss: {
    type: 'color', default: BASE.moss, label: 'Moss',
    affects: 'colors', describe: 'Bark base and soil moss color.'
  }
};

export const rig = {
  wholeCanopy: { axis: 'z', range: [-3.5, 3.5], describe: 'Gentle whole-crown wind sway.' },
  scaffoldBranch_1: { axis: 'z', range: [-2, 2], describe: 'Heavy limb flex.' },
  scaffoldBranch_2: { axis: 'z', range: [-2.2, 2.2], describe: 'Heavy limb flex.' },
  scaffoldBranch_3: { axis: 'z', range: [-2.4, 2.4], describe: 'Limb flex.' },
  scaffoldBranch_4: { axis: 'z', range: [-2.6, 2.6], describe: 'Limb flex.' },
  scaffoldBranch_5: { axis: 'z', range: [-2.8, 2.8], describe: 'Limb flex.' },
  scaffoldBranch_6: { axis: 'z', range: [-3, 3], describe: 'Limb flex.' },
  scaffoldBranch_7: { axis: 'z', range: [-3.2, 3.2], describe: 'Upper limb flex.' },
  scaffoldBranch_8: { axis: 'z', range: [-3.4, 3.4], describe: 'Upper limb flex.' },
  scaffoldBranch_9: { axis: 'z', range: [-3.6, 3.6], describe: 'Upper limb flex.' },
  scaffoldBranch_10: { axis: 'z', range: [-3.8, 3.8], describe: 'Upper limb flex.' },
  scaffoldBranch_11: { axis: 'z', range: [-4, 4], describe: 'Upper limb flex.' },
  scaffoldBranch_12: { axis: 'z', range: [-4.2, 4.2], describe: 'Upper limb flex.' },
  oakLeaves: { axis: 'z', range: [-2.5, 2.5], describe: 'Broad leaf rustle.' },
  aspenLeaves: { axis: 'y', range: [-14, 14], describe: 'Fast quaking flutter around petiole.' },
  mapleLeaves: { axis: 'x', range: [-4, 4], describe: 'Palmate blade tilt.' },
  willowWithes: { axis: 'z', range: [-9, 9], describe: 'Long pendulous withe sway.' },
  stylizedCanopy: { axis: 'y', range: [0.94, 1.08], describe: 'Stylized canopy squash & stretch.' },
  seeds: { axis: 'x', range: [-6, 6], describe: 'Seed swing.' },
  fallingLeaves: { axis: 'y', range: [0, -2.5], describe: 'Downward drift loop.' }
};

export const detach = [
  'rootBase',
  'forestFloor',
  'scaffoldBranches',
  'speciesFoliage',
  'seeds',
  'fallingLeaves'
];

export const night = {
  leafLight: {
    color: '#a3db56', intensity: 0.12, distance: 5,
    describe: 'Subtle canopy luminescence.'
  },
  blossom: {
    color: '#f2c3e4', intensity: 0.18, distance: 4,
    describe: 'Blossom night glow.'
  },
  moss: {
    color: '#3c956d', intensity: 0.08, distance: 2,
    describe: 'Faint root collar moss glow.'
  }
};

/*
 * Botanical species profiles:
 * maxDepth: 4 levels of recursive branching (0: Scaffold -> 1: Major Limb -> 2: Branchlet -> 3: Fine Twig)
 * scaffoldStart/scaffoldEnd: range of trunk height where main limbs attach
 */
const PROFILE = {
  oak: {
    trunkTop: 0.48, trunkTipRatio: 0.60, trunkTaper: 0.85, flare: 1.0,
    scaffolds: [5, 7], scaffoldStart: 0.30, scaffoldEnd: 0.48,
    pitch: [0.65, 1.15], maxDepth: 4, children: [2, 3], childAngle: 0.68,
    gnarl: 1.0, upBias: 0.38, gravity: 0.18,
    lengthRatio: 0.70, radiusRatio: 0.62,
    crownWidth: 1.05, crownLift: 0.95,
    leaves: 9, leafLength: 0.14, leafWidth: 0.62, petiole: 0.22,
    phyllotaxy: 'alternate', seedType: 'acorn', foliage: 'oakLeaves',
    lengthTune: 0.82
  },
  aspen: {
    trunkTop: 0.82, trunkTipRatio: 0.22, trunkTaper: 1.05, flare: 0.35,
    scaffolds: [9, 14], scaffoldStart: 0.38, scaffoldEnd: 0.84,
    pitch: [0.45, 0.88], maxDepth: 3, children: [2, 3], childAngle: 0.46,
    gnarl: 0.28, upBias: 0.62, gravity: 0.08,
    lengthRatio: 0.62, radiusRatio: 0.56,
    crownWidth: 0.65, crownLift: 1.25,
    leaves: 10, leafLength: 0.11, leafWidth: 0.96, petiole: 0.60,
    phyllotaxy: 'alternate', seedType: 'catkin', foliage: 'aspenLeaves',
    lengthTune: 0.75
  },
  maple: {
    trunkTop: 0.46, trunkTipRatio: 0.52, trunkTaper: 0.92, flare: 0.75,
    scaffolds: [5, 7], scaffoldStart: 0.32, scaffoldEnd: 0.48,
    pitch: [0.52, 0.98], maxDepth: 4, children: [2, 3], childAngle: 0.58,
    gnarl: 0.48, upBias: 0.48, gravity: 0.14,
    lengthRatio: 0.68, radiusRatio: 0.60,
    crownWidth: 1.0, crownLift: 1.05,
    leaves: 8, leafLength: 0.16, leafWidth: 1.15, petiole: 0.42,
    phyllotaxy: 'opposite', seedType: 'samara', foliage: 'mapleLeaves',
    lengthTune: 0.85
  },
  willow: {
    trunkTop: 0.44, trunkTipRatio: 0.64, trunkTaper: 0.80, flare: 1.1,
    scaffolds: [6, 8], scaffoldStart: 0.28, scaffoldEnd: 0.44,
    pitch: [0.58, 1.05], maxDepth: 3, children: [2, 3], childAngle: 0.54,
    gnarl: 0.55, upBias: 0.72, gravity: 0.06,
    lengthRatio: 0.65, radiusRatio: 0.58,
    crownWidth: 1.1, crownLift: 1.12,
    leaves: 14, leafLength: 0.12, leafWidth: 0.22, petiole: 0.12,
    phyllotaxy: 'alternate', seedType: 'catkin', foliage: 'willowWithes',
    lengthTune: 0.78,
    weeping: true, withes: [4, 7], witheLength: 0.38
  },
  stylized: {
    trunkTop: 0.48, trunkTipRatio: 0.56, trunkTaper: 0.90, flare: 0.85,
    scaffolds: [4, 6], scaffoldStart: 0.30, scaffoldEnd: 0.46,
    pitch: [0.50, 0.94], maxDepth: 3, children: [2, 3], childAngle: 0.60,
    gnarl: 0.35, upBias: 0.54, gravity: 0.12,
    lengthRatio: 0.68, radiusRatio: 0.62,
    crownWidth: 0.95, crownLift: 1.1,
    leaves: 7, leafLength: 0.25, leafWidth: 0.88, petiole: 0.26,
    phyllotaxy: 'alternate', seedType: 'blossom', foliage: 'stylizedCanopy',
    lengthTune: 0.92,
    puffs: true
  }
};

const SEASON = {
  freshSpring: {
    leafDark: '#28662e', leafMid: '#549c3b', leafLight: '#b2d456',
    leafUnder: '#d5e4b2', autumn: '#c5ce66'
  },
  deepSummer: {
    leafDark: '#11361c', leafMid: '#286328', leafLight: '#579237',
    leafUnder: '#a4be8f', autumn: '#888531'
  },
  earlyAutumn: {
    leafDark: '#565c1d', leafMid: '#9e8421', leafLight: '#d5b63a',
    leafUnder: '#d9cd9c', autumn: '#b97421'
  },
  peakAutumn: {
    leafDark: '#722811', leafMid: '#b95b19', leafLight: '#e69f2e',
    leafUnder: '#dfbe94', autumn: '#a03713'
  },
  moonlit: {
    leafDark: '#142b39', leafMid: '#285159', leafLight: '#799f98',
    leafUnder: '#bcd0ce', autumn: '#687783'
  }
};

const ZONE_KEYS = Object.keys(BASE);
const YAXIS = new THREE.Vector3(0, 1, 0);

const hexOf = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value & 0xFFFFFF;
  if (typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value)) {
    return parseInt(value.replace('#', ''), 16);
  }
  return null;
};

function zonesFor(name, overrides = {}) {
  const colorway = COLORWAYS[name] || COLORWAYS.verdantSummer;
  const used = new Set();
  const out = {};

  for (const key of ZONE_KEYS) {
    let hex = (
      hexOf(overrides[key]) ??
      hexOf(colorway[key]) ??
      hexOf(BASE[key]) ??
      hexOf(BASE.bark)
    ) & 0xFFFFFF;

    while (used.has(hex)) hex = (hex + 1) & 0xFFFFFF;
    used.add(hex);
    out[key] = hex;
  }
  return out;
}

function prep(geometry, hex) {
  let geo = geometry;
  if (geo.index) geo = geo.toNonIndexed();
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');

  if (!geo.getAttribute('color')) {
    const color = new THREE.Color(hex);
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3]     = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  return geo;
}

const MAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.88,
  metalness: 0.02,
  side: THREE.DoubleSide
});

function finish(list, material = MAT, name = 'solid', merge = true) {
  if (!list || list.length === 0) return null;

  if (merge) {
    const prepared = list.map((part) => prep(part.g, part.c));
    const merged = mergeGeometries(prepared);
    if (!merged) return null;
    merged.computeVertexNormals();

    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  const group = new THREE.Group();
  group.name = name;

  list.forEach((part, index) => {
    const geo = prep(part.g, part.c);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = part.name || `${name}_part_${index + 1}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (part.accessory) mesh.userData.explodeWithParent = true;
    group.add(mesh);
  });

  return group;
}

function addWire(parts, p1, p2, hex, radius = 0.01, radialSegments = 5, name = '') {
  const a = new THREE.Vector3(...p1);
  const b = new THREE.Vector3(...p2);
  const distance = a.distanceTo(b);
  if (distance < 1e-5) return;

  const geo = new THREE.CylinderGeometry(radius, radius, distance, radialSegments);
  const midpoint = a.clone().lerp(b, 0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    YAXIS,
    b.clone().sub(a).normalize()
  );

  geo.applyMatrix4(new THREE.Matrix4().compose(
    midpoint,
    quaternion,
    new THREE.Vector3(1, 1, 1)
  ));
  parts.push({ g: geo, c: hex, name });
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const mixHex = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(t, 0, 1)).getHex();

function transformed(geometry, position, direction, scale = [1, 1, 1], roll = 0) {
  const dir = direction.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(YAXIS, dir);

  if (roll) {
    const rollQuaternion = new THREE.Quaternion().setFromAxisAngle(dir, roll);
    rollQuaternion.multiply(quaternion);
    quaternion.copy(rollQuaternion);
  }

  geometry.applyMatrix4(new THREE.Matrix4().compose(
    position,
    quaternion,
    new THREE.Vector3(...scale)
  ));
  return geometry;
}

function alignRoll(direction, up = YAXIS) {
  const dir = direction.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(YAXIS, dir);
  const n0 = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const b = dir.clone().cross(n0);
  return Math.atan2(up.dot(b), up.dot(n0));
}

function tangentFrame(direction) {
  const tangent = direction.clone().normalize();
  const helper = Math.abs(tangent.y) > 0.92
    ? new THREE.Vector3(1, 0, 0)
    : YAXIS;
  const side = new THREE.Vector3().crossVectors(tangent, helper).normalize();
  const normal = new THREE.Vector3().crossVectors(side, tangent).normalize();
  return { tangent, side, normal };
}

function sweptTube(points, radii, radialSegments = 6, colors = null) {
  const vertices = [];
  const vertexColors = [];
  const indices = [];
  const frames = [];
  const worldUp = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < points.length; i++) {
    let tangent;
    if (i === 0) tangent = points[1].clone().sub(points[0]).normalize();
    else if (i === points.length - 1) tangent = points[i].clone().sub(points[i - 1]).normalize();
    else tangent = points[i + 1].clone().sub(points[i - 1]).normalize();

    const helper = Math.abs(tangent.dot(worldUp)) > 0.92
      ? new THREE.Vector3(1, 0, 0)
      : worldUp;

    const side = new THREE.Vector3().crossVectors(tangent, helper).normalize();
    const normal = new THREE.Vector3().crossVectors(side, tangent).normalize();
    frames.push({ side, normal });
  }

  const hasColors = Array.isArray(colors) && colors.length === points.length;

  for (let i = 0; i < points.length; i++) {
    const c = hasColors ? new THREE.Color(colors[i]) : null;
    for (let j = 0; j < radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const offset = frames[i].side.clone()
        .multiplyScalar(Math.cos(angle) * radii[i])
        .add(frames[i].normal.clone().multiplyScalar(Math.sin(angle) * radii[i]));
      const vertex = points[i].clone().add(offset);
      vertices.push(vertex.x, vertex.y, vertex.z);
      if (hasColors) vertexColors.push(c.r, c.g, c.b);
    }
  }

  for (let i = 0; i < points.length - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const next = (j + 1) % radialSegments;
      const a = i * radialSegments + j;
      const b = i * radialSegments + next;
      const c = (i + 1) * radialSegments + next;
      const d = (i + 1) * radialSegments + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const bottomCenter = vertices.length / 3;
  vertices.push(points[0].x, points[0].y, points[0].z);
  if (hasColors) {
    const c0 = new THREE.Color(colors[0]);
    vertexColors.push(c0.r, c0.g, c0.b);
  }

  const topCenter = vertices.length / 3;
  const last = points[points.length - 1];
  vertices.push(last.x, last.y, last.z);
  if (hasColors) {
    const cLast = new THREE.Color(colors[colors.length - 1]);
    vertexColors.push(cLast.r, cLast.g, cLast.b);
  }

  for (let j = 0; j < radialSegments; j++) {
    const next = (j + 1) % radialSegments;
    indices.push(bottomCenter, next, j);
    const lastRing = (points.length - 1) * radialSegments;
    indices.push(topCenter, lastRing + j, lastRing + next);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  if (hasColors) geo.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  geo.setIndex(indices);
  return geo;
}

function addPath(parts, points, radii, hex, radialSegments = 5, name = '', colors = null) {
  parts.push({
    g: sweptTube(points, radii, radialSegments, colors),
    c: hex,
    name
  });
}

function irregularIsland(radius, height, segments, random) {
  const vertices = [0, height, 0, 0, -0.015, 0];
  const indices = [];
  const edge = [];

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const r = radius * (0.82 + random() * 0.23);
    edge.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
  }

  for (const point of edge) vertices.push(point.x, height, point.y);
  for (const point of edge) vertices.push(point.x * 0.94, -0.015, point.y * 0.94);

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const topA = 2 + i;
    const topB = 2 + next;
    const bottomA = 2 + segments + i;
    const bottomB = 2 + segments + next;
    indices.push(0, topA, topB);
    indices.push(1, bottomB, bottomA);
    indices.push(topA, bottomA, topB, topB, bottomA, bottomB);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  return geo;
}

function addBlob(parts, radius, detail, x, y, z, hex, sx = 1, sy = 1, sz = 1, name = '') {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  geo.scale(sx, sy, sz);
  geo.translate(x, y, z);
  parts.push({ g: geo, c: hex, name });
}

function vertex(p, c) {
  return { p, c };
}

function coloredGeometry(triangles, species = '') {
  const positions = [];
  const colors = [];

  for (const triangle of triangles) {
    for (const item of triangle) {
      positions.push(item.p[0], item.p[1], item.p[2]);
      const color = new THREE.Color(item.c);
      colors.push(color.r, color.g, color.b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.userData.species = species;
  return geo;
}

function addPrimitive(parts, geometry, position, direction, roll, name, scale = [1, 1, 1], fallbackColor = '#ffffff', accessory = false) {
  transformed(geometry, position, direction, scale, roll);
  parts.push({ g: geometry, c: fallbackColor, name, accessory });
}

/* ---------------------------------------------------------------------------
 * LEAF GEOMETRY PRIMITIVES
 * ------------------------------------------------------------------------ */

const LEAF_STATIONS = { low: 2, standard: 4, high: 6 };

function leafPalette(C) {
  const dark = new THREE.Color(C.leafDark);
  const mid = new THREE.Color(C.leafMid);
  const light = new THREE.Color(C.leafLight);
  return {
    at: (t) => (t < 0.5
      ? dark.clone().lerp(mid, clamp(t * 2, 0, 1))
      : mid.clone().lerp(light, clamp((t - 0.5) * 2, 0, 1))).getHex(),
    vein: dark.clone().lerp(mid, 0.28).getHex(),
    under: C.leafUnder
  };
}

function bladeTriangles(length, width, widthFn, palette, opts = {}) {
  const stations = Math.max(2, opts.stations || 4);
  const fold = opts.fold ?? 0.16;
  const curve = opts.curve ?? 0;
  const halfWidth = width * 0.5;
  const triangles = [];
  const L = [];
  const R = [];
  const M = [];
  const CO = [];

  for (let i = 0; i <= stations; i++) {
    const t = i / stations;
    const y = t * length;
    const w = Math.max(1e-4, widthFn(t)) * halfWidth;
    const zEdge = curve * length * t * t;
    const zMid = zEdge + fold * halfWidth * Math.sin(Math.PI * t);
    L.push([-w, y, zEdge]);
    R.push([w, y, zEdge]);
    M.push([0, y, zMid]);
    CO.push(palette.at(t));
  }

  for (let i = 0; i < stations; i++) {
    const c0 = CO[i];
    const c1 = CO[i + 1];
    const vein = palette.vein;
    triangles.push([vertex(M[i], vein), vertex(L[i], c0), vertex(L[i + 1], c1)]);
    triangles.push([vertex(M[i], vein), vertex(L[i + 1], c1), vertex(M[i + 1], vein)]);
    triangles.push([vertex(M[i], vein), vertex(M[i + 1], vein), vertex(R[i + 1], c1)]);
    triangles.push([vertex(M[i], vein), vertex(R[i + 1], c1), vertex(R[i], c0)]);
  }

  if (opts.underside) {
    const off = -halfWidth * 0.06 - length * 0.003;
    const under = palette.under;
    for (let i = 0; i < stations; i++) {
      const la = [L[i][0], L[i][1], L[i][2] + off];
      const ra = [R[i][0], R[i][1], R[i][2] + off];
      const lb = [L[i + 1][0], L[i + 1][1], L[i + 1][2] + off];
      const rb = [R[i + 1][0], R[i + 1][1], R[i + 1][2] + off];
      triangles.push([vertex(la, under), vertex(ra, under), vertex(rb, under)]);
      triangles.push([vertex(la, under), vertex(rb, under), vertex(lb, under)]);
    }
  }
  return triangles;
}

function palmateStarTriangles(length, width, palette, opts = {}) {
  const lobeAngles = [-1.30, -0.72, 0, 0.72, 1.30];
  const lobeLengths = [0.56, 0.88, 1, 0.88, 0.56];
  const sinusAngles = [-1.02, -0.36, 0.36, 1.02];
  const sinus = opts.deepSinus ? 0.30 : 0.40;

  const perimeter = [];
  const push = (angle, r) => perimeter.push([
    Math.sin(angle) * r * length,
    Math.cos(angle) * r * length,
    0
  ]);

  for (let i = 0; i < 5; i++) {
    if (i > 0) push(sinusAngles[i - 1], sinus);
    push(lobeAngles[i], lobeLengths[i]);
  }

  let maxX = 0;
  for (const point of perimeter) maxX = Math.max(maxX, Math.abs(point[0]));
  const scaleX = maxX > 1e-6 ? (width * 0.5) / maxX : 1;
  for (const point of perimeter) point[0] *= scaleX;

  const base = [0, 0, width * 0.08];
  const triangles = [];
  const colorAt = (point) => palette.at(clamp(point[1] / Math.max(length, 1e-5), 0, 1));

  for (let i = 0; i < perimeter.length - 1; i++) {
    triangles.push([
      vertex(base, palette.vein),
      vertex(perimeter[i], colorAt(perimeter[i])),
      vertex(perimeter[i + 1], colorAt(perimeter[i + 1]))
    ]);
  }

  if (opts.underside) {
    const off = -width * 0.05;
    const shift = (q) => [q[0], q[1], q[2] + off];
    for (let i = 0; i < perimeter.length - 1; i++) {
      triangles.push([
        vertex(shift(base), palette.under),
        vertex(shift(perimeter[i + 1]), palette.under),
        vertex(shift(perimeter[i]), palette.under)
      ]);
    }
  }
  return triangles;
}

function createLeafPrimitive(species, detail, p, C, length, width) {
  const palette = leafPalette(C);
  const stations = LEAF_STATIONS[detail] || 4;
  const underside = p.showLeafUndersides && detail !== 'low' &&
    (detail === 'high' || species === 'aspen' || species === 'willow');

  if (detail === 'low') {
    return coloredGeometry(bladeTriangles(
      length, width,
      (t) => Math.pow(Math.sin(Math.PI * t), 0.5),
      palette,
      { stations: 2, fold: 0.22 }
    ), species);
  }

  if (species === 'oak') {
    const lobeFrequency = detail === 'high' ? 3.5 : 2.5;
    const widthFn = (t) =>
      Math.pow(Math.sin(Math.PI * Math.pow(clamp(t, 0, 1), 0.72)), 0.5) *
      (0.58 + 0.42 * Math.abs(Math.cos(t * Math.PI * lobeFrequency - 0.55)));
    return coloredGeometry(bladeTriangles(length, width, widthFn, palette, {
      stations: stations + 1,
      fold: 0.14,
      curve: 0.06,
      underside
    }), species);
  }

  if (species === 'aspen') {
    const widthFn = (t) =>
      Math.pow(Math.sin(Math.PI * Math.pow(clamp(t, 0, 1), 0.86)), 0.42) *
      (1 + 0.22 * Math.exp(-t * 8));
    return coloredGeometry(bladeTriangles(length, width, widthFn, palette, {
      stations,
      fold: 0.26,
      curve: 0.03,
      underside
    }), species);
  }

  if (species === 'maple') {
    return coloredGeometry(palmateStarTriangles(length, width, palette, {
      deepSinus: detail === 'high',
      underside
    }), species);
  }

  if (species === 'willow') {
    const widthFn = (t) =>
      Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.6) * (1 - 0.36 * t);
    return coloredGeometry(bladeTriangles(length, width, widthFn, palette, {
      stations: Math.max(3, stations),
      fold: 0.32,
      curve: 0.12 + p.leafDroop * 0.12,
      underside
    }), species);
  }

  // Stylized hero broadleaf
  const widthFn = (t) =>
    Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.44) *
    (1 + 0.3 * Math.exp(-t * 6)) *
    (1 - 0.18 * Math.pow(Math.max(0, t - 0.86) / 0.14, 2));
  return coloredGeometry(bladeTriangles(length, width, widthFn, palette, {
    stations,
    fold: 0.30,
    curve: 0.05,
    underside
  }), species);
}

/* ---------------------------------------------------------------------------
 * SEEDS, BLOSSOMS & FRUIT
 * ------------------------------------------------------------------------ */

function addAcorn(parts, position, direction, size, C, name) {
  const nutPoints = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    nutPoints.push(new THREE.Vector2(
      Math.max(0.0006, size * 0.46 * Math.sin(Math.PI * (0.08 + t * 0.84))),
      size * (-0.5 + t * 0.66)
    ));
  }
  const nut = new THREE.LatheGeometry(nutPoints, 6);
  transformed(nut, position, direction);
  parts.push({ g: nut, c: C.fruit, name: `${name}_nut` });

  const capPoints = [];
  for (let i = 0; i <= 3; i++) {
    const t = i / 3;
    capPoints.push(new THREE.Vector2(
      Math.max(0.0006, size * 0.52 * (1 - t * t * 0.94)),
      size * (0.02 + t * 0.32)
    ));
  }
  const cap = new THREE.LatheGeometry(capPoints, 6);
  transformed(cap, position, direction);
  parts.push({ g: cap, c: C.samara, name: `${name}_cap`, accessory: true });
}

function addSamaraPair(parts, position, direction, size, C, name) {
  const frame = tangentFrame(direction);
  const wingPalette = {
    at: (t) => mixHex(C.samara, C.autumn, t * 0.55),
    vein: C.fruit,
    under: C.samara
  };

  for (const sign of [-1, 1]) {
    const wingDirection = frame.tangent.clone().multiplyScalar(0.42)
      .add(frame.side.clone().multiplyScalar(sign * 0.9))
      .add(new THREE.Vector3(0, 0.24, 0))
      .normalize();

    const geo = coloredGeometry(bladeTriangles(
      size, size * 0.36,
      (t) => Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.42) * (0.34 + 0.66 * t),
      wingPalette,
      { stations: 3, fold: 0.12, curve: 0.1 }
    ), 'samara');

    addPrimitive(
      parts, geo, position, wingDirection,
      alignRoll(wingDirection) + sign * 0.35,
      `${name}_wing_${sign < 0 ? 'left' : 'right'}`,
      [1, 1, 1], C.samara, true
    );

    const nutlet = position.clone().add(wingDirection.clone().multiplyScalar(size * 0.14));
    addBlob(
      parts, size * 0.09, 0,
      nutlet.x, nutlet.y, nutlet.z,
      C.fruit, 1, 1.35, 1,
      `${name}_nutlet_${sign < 0 ? 'left' : 'right'}`
    );
  }
}

function addCatkin(parts, position, direction, size, C, random, name) {
  const dir = direction.clone().normalize();
  const center = position.clone().add(dir.clone().multiplyScalar(size * 0.5));
  const geo = new THREE.CylinderGeometry(size * 0.14, size * 0.08, size, 5);
  transformed(geo, center, dir);
  parts.push({ g: geo, c: C.samara, name: `${name}_spike` });
}

function addBlossom(parts, position, direction, size, C, random, name) {
  const frame = tangentFrame(direction);
  const petals = 5;
  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2 + random() * 0.4;
    const offset = frame.side.clone().multiplyScalar(Math.cos(angle) * size * 0.5)
      .add(frame.normal.clone().multiplyScalar(Math.sin(angle) * size * 0.5))
      .add(frame.tangent.clone().multiplyScalar(size * 0.12));
    const at = position.clone().add(offset);
    addBlob(
      parts, size * 0.32, 0,
      at.x, at.y, at.z,
      C.blossom, 1.25, 0.55, 1,
      `${name}_petal_${i + 1}`
    );
  }
  addBlob(
    parts, size * 0.18, 0,
    position.x, position.y, position.z,
    C.samara, 1, 1, 1,
    `${name}_heart`
  );
}

function addSeedStructure(ctx, position, direction, label) {
  const { profile, C, random } = ctx;
  const size = ctx.seedSize;

  if (profile.seedType === 'acorn') {
    const at = position.clone().add(new THREE.Vector3(
      (random() - 0.5) * size,
      -size * 0.5,
      (random() - 0.5) * size
    ));
    addAcorn(ctx.seedParts, at, new THREE.Vector3(0, 1, 0), size, C, `${label}_acorn`);
  } else if (profile.seedType === 'samara') {
    addSamaraPair(
      ctx.seedParts,
      position.clone().add(new THREE.Vector3(0, -size * 0.25, 0)),
      new THREE.Vector3(0, -1, 0),
      size * 1.4, C, `${label}_samara`
    );
  } else if (profile.seedType === 'catkin') {
    addCatkin(
      ctx.seedParts, position,
      new THREE.Vector3((random() - 0.5) * 0.3, -1, (random() - 0.5) * 0.3),
      size * 2.0, C, random, `${label}_catkin`
    );
  } else {
    addBlossom(
      ctx.seedParts, position,
      new THREE.Vector3((random() - 0.5) * 0.3, 1, (random() - 0.5) * 0.3),
      size * 1.5, C, random, `${label}_blossom`
    );
  }
}

/* ---------------------------------------------------------------------------
 * ROBUST FOLIAGE PLACEMENT (GUARANTEED PER-BRANCH COVERAGE)
 * ------------------------------------------------------------------------ */

function addSpeciesFoliage(ctx, base, tip, outer, label) {
  const { species, detail, p, C, random, profile, H } = ctx;
  const axis = tip.clone().sub(base);
  const length = axis.length();
  if (length < 1e-5) return;

  const frame = tangentFrame(axis);
  const detailFactor = detail === 'high' ? 1.25 : detail === 'low' ? 0.65 : 1.0;
  
  // Guaranteed leaf clusters scaled smoothly by density
  const total = Math.max(
    3,
    Math.round(profile.leaves * (0.45 + p.foliageDensity * 0.85) * detailFactor)
  );

  const opposite = profile.phyllotaxy === 'opposite';
  const nodes = opposite ? Math.max(2, Math.ceil(total / 2)) : total;
  const sizeFactor = Math.pow(clamp(H / 12, 0.45, 2.2), 0.35);
  const nominal = profile.leafLength * p.leafSizeScale * sizeFactor;

  for (let i = 0; i < nodes; i++) {
    const u = lerp(0.12, 1.0, (i + 0.5) / nodes);
    const node = base.clone().lerp(tip, u);
    const slots = opposite ? [0, Math.PI] : [0];
    const nodeAngle = opposite
      ? i * Math.PI * 0.5 + ctx.rollSeed
      : i * 2.39996 + ctx.rollSeed;

    for (const slot of slots) {
      const angle = nodeAngle + slot;
      const radial = frame.side.clone().multiplyScalar(Math.cos(angle))
        .add(frame.normal.clone().multiplyScalar(Math.sin(angle)));

      const leafLength = nominal * (0.85 + random() * 0.3);
      const leafWidth = leafLength * profile.leafWidth;
      const petioleLength = leafLength * profile.petiole * (0.75 + random() * 0.4);
      const droop = p.leafDroop * (species === 'willow' ? 1.25 : 0.85);

      const direction = frame.tangent.clone().multiplyScalar(0.4)
        .add(radial.clone().multiplyScalar(0.8))
        .add(new THREE.Vector3(0, 0.42 - droop * 1.0, 0))
        .normalize();

      const attach = node.clone().add(direction.clone().multiplyScalar(petioleLength));

      const showPetiole = petioleLength > 1e-4 &&
        (detail === 'high' || species === 'aspen' || species === 'maple');

      if (showPetiole) {
        addWire(
          ctx.microParts,
          [node.x, node.y, node.z],
          [attach.x, attach.y, attach.z],
          species === 'aspen' ? C.leafDark : C.twig,
          Math.max(0.0012, leafLength * 0.02),
          3,
          `${label}_petiole_${i + 1}`
        );
      }

      const geo = createLeafPrimitive(
        species, detail, p, C, leafLength, leafWidth
      );

      const rollJitter = species === 'aspen'
        ? (random() - 0.5) * 1.8
        : (random() - 0.5) * 0.8;

      addPrimitive(
        ctx.leafParts, geo, attach, direction,
        alignRoll(direction) + rollJitter,
        `${label}_leaf_${i + 1}`,
        [1, 1, 1], C.leafMid
      );
    }
  }

  if (profile.puffs && detail !== 'low') {
    const puff = tip.clone().lerp(base, 0.22);
    addBlob(
      ctx.microParts, nominal * 1.15, 0,
      puff.x, puff.y, puff.z,
      mixHex(C.leafMid, C.leafDark, 0.35),
      1.25, 0.9, 1.25,
      `${label}_canopy_puff`
    );
  }

  if (outer > 0.45 && random() < p.seedDensity * 0.6) {
    addSeedStructure(ctx, tip.clone().lerp(base, 0.12), frame.tangent, label);
  }
}

/* ---------------------------------------------------------------------------
 * MULTI-TIER BRANCHING RECURSION
 * ------------------------------------------------------------------------ */

function samplePolyline(points, u) {
  const t = clamp(u, 0, 1) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(t));
  return points[i].clone().lerp(points[i + 1], t - i);
}

function addWithes(ctx, woodList, points, label) {
  const { profile, p, C, random, H } = ctx;
  const count = Math.max(
    2,
    Math.round(lerp(profile.withes[0], profile.withes[1], p.foliageDensity))
  );

  for (let i = 0; i < count; i++) {
    const u = (i + 0.3) / count;
    const anchor = samplePolyline(points, u);
    const radial = new THREE.Vector3(anchor.x, 0, anchor.z);
    if (radial.lengthSq() < 1e-6) radial.set(1, 0, 0);
    radial.normalize();

    const length = H * profile.witheLength *
      (0.55 + p.branchDroop * 0.9) * (0.75 + random() * 0.5);

    const stations = 4;
    const withePoints = [anchor.clone()];
    const witheRadii = [Math.max(ctx.minRadius, H * 0.003)];

    for (let s = 1; s <= stations; s++) {
      const t = s / stations;
      withePoints.push(anchor.clone().add(new THREE.Vector3(
        radial.x * length * 0.28 * Math.sin(t * 1.5) + (random() - 0.5) * length * 0.05,
        -length * Math.pow(t, 0.88),
        radial.z * length * 0.28 * Math.sin(t * 1.5) + (random() - 0.5) * length * 0.05
      )));
      witheRadii.push(Math.max(ctx.minRadius, H * 0.003 * (1 - t * 0.8)));
    }

    addPath(woodList, withePoints, witheRadii, C.twig, 4, `${label}_withe_${i + 1}`);

    for (let s = 0; s < stations; s++) {
      addSpeciesFoliage(
        ctx, withePoints[s], withePoints[s + 1],
        0.4 + s * 0.2,
        `${label}_withe_${i + 1}_span_${s + 1}`
      );
    }
  }
}

function growBranch(ctx, woodList, base, direction, length, radius, depth, label) {
  const { profile, p, C, random } = ctx;
  if (length < ctx.minLength || radius < ctx.minRadius * 0.9) return;

  const segments = depth === 0 ? 5 : depth === 1 ? 4 : 3;
  const points = [base.clone()];
  const radii = [radius];
  const gnarl = profile.gnarl * p.branchGnarl;
  const gravity = profile.gravity * (0.35 + p.branchDroop * 1.4);

  let current = base.clone();
  const heading = direction.clone().normalize();

  for (let s = 1; s <= segments; s++) {
    const t = s / segments;
    heading.x += (random() - 0.5) * gnarl * 0.42;
    heading.z += (random() - 0.5) * gnarl * 0.42;
    heading.y += profile.upBias * 0.12 - gravity * t * 0.55;
    heading.normalize();

    current = current.clone().add(heading.clone().multiplyScalar(length / segments));
    points.push(current);
    radii.push(Math.max(ctx.minRadius, radius * (1 - 0.72 * t)));
  }

  const woodHex = depth === 0
    ? C.branch
    : depth === 1
      ? mixHex(C.branch, C.twig, 0.4)
      : C.twig;

  addPath(
    woodList, points, radii, woodHex,
    depth <= 1 ? 5 : 4,
    `${label}_limb`
  );

  const tip = points[points.length - 1];

  // If reached maxDepth, adorn the terminal span with dense foliage and withes
  if (depth >= ctx.maxDepth) {
    if (profile.weeping) {
      addWithes(ctx, woodList, points, label);
    } else {
      const mid = points[Math.max(0, points.length - 2)];
      addSpeciesFoliage(ctx, mid, tip, 1.0, `${label}_terminal`);
      addSpeciesFoliage(ctx, points[0], mid, 0.65, `${label}_inner`);
    }
    return;
  }

  // Sub-branching: calculate child count and angles
  const frame = tangentFrame(heading);
  const isOuterLevel = depth >= ctx.maxDepth - 2;
  const childCount = Math.max(
    2,
    Math.round(lerp(
      profile.children[0], profile.children[1],
      clamp(p.foliageDensity * 0.7 + p.crownSpread * 0.3, 0, 1)
    ))
  );

  const attach = tip.clone().sub(
    heading.clone().multiplyScalar(radii[radii.length - 1] * 1.1)
  );

  for (let k = 0; k < childCount; k++) {
    const roll = (k / childCount) * Math.PI * 2 + random() * 0.8 + depth * 1.1;
    const axis = frame.side.clone().multiplyScalar(Math.cos(roll))
      .add(frame.normal.clone().multiplyScalar(Math.sin(roll)))
      .normalize();

    const forkAngle = profile.childAngle *
      (0.65 + random() * 0.65) *
      (0.55 + p.crownSpread * 0.9);

    const childDirection = heading.clone().applyAxisAngle(axis, forkAngle);
    childDirection.y += profile.upBias * 0.22 - p.branchDroop * 0.1;
    childDirection.normalize();

    growBranch(
      ctx, woodList, attach, childDirection,
      length * profile.lengthRatio * (0.82 + random() * 0.32),
      radius * profile.radiusRatio,
      depth + 1,
      `${label}_${k + 1}`
    );
  }

  // Add lateral foliage along secondary and tertiary branches so tree is fully filled
  if (isOuterLevel) {
    addSpeciesFoliage(
      ctx, samplePolyline(points, 0.35), tip, 0.55, `${label}_fill`
    );
  }
}

/* ---------------------------------------------------------------------------
 * ASSET GENERATOR
 * ------------------------------------------------------------------------ */

export function createAsset(userParams = {}) {
  const p = {};
  for (const key of Object.keys(params)) p[key] = params[key].default;
  Object.assign(p, userParams);

  p.treeHeight = clamp(Number(p.treeHeight), 4, 24);
  p.canopyWidth = clamp(Number(p.canopyWidth), 3, 20);
  p.crownSpread = clamp(Number(p.crownSpread), 0, 1);
  p.branchGnarl = clamp(Number(p.branchGnarl), 0, 1);
  p.branchDroop = clamp(Number(p.branchDroop), 0, 1);
  p.foliageDensity = clamp(Number(p.foliageDensity), 0.2, 1);
  p.trunkLeanAndTwist = clamp(Number(p.trunkLeanAndTwist), 0, 1);
  p.trunkFlare = clamp(Number(p.trunkFlare), 0, 1);
  p.leafSizeScale = clamp(Number(p.leafSizeScale), 0.5, 2);
  p.leafDroop = clamp(Number(p.leafDroop), 0, 1);
  p.seedDensity = clamp(Number(p.seedDensity), 0, 1);

  const explicitOverrides = {};
  for (const key of ZONE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(userParams, key)) {
      explicitOverrides[key] = userParams[key];
    }
  }

  if (p.leafHueAndSeason !== 'colorway' && SEASON[p.leafHueAndSeason]) {
    Object.assign(explicitOverrides, SEASON[p.leafHueAndSeason]);
  }

  const C = zonesFor(p.colorway, explicitOverrides);
  const profile = PROFILE[p.speciesProfile] || PROFILE.oak;
  const seedValue = Math.floor(Number(p.seed)) || 419;
  const random = mulberry32(seedValue);

  const H = p.treeHeight;
  const W = Math.min(p.canopyWidth, H * 1.8);
  const detail = p.leafDetailLevel;

  const trunkBaseRadius = clamp(
    H * 0.038 * (0.72 + profile.flare * 0.5 * (0.5 + p.trunkFlare * 0.9)),
    0.08, 1.2
  );
  const groundRadius = Math.max(trunkBaseRadius * 3.8, W * 0.18);

  const rootParts = [];
  const groundParts = [];
  const litterParts = [];
  const trunkParts = [];
  const barkParts = [];
  const leafParts = [];
  const microParts = [];
  const seedParts = [];
  const fallingParts = [];

  // Trunk Spline Generation
  const lean = p.trunkLeanAndTwist;
  const AXIS_CONTROLS = 9;
  const axisControls = [];

  for (let i = 0; i < AXIS_CONTROLS; i++) {
    const t = i / (AXIS_CONTROLS - 1);
    axisControls.push(new THREE.Vector3(
      H * lean * (0.04 * t * t + 0.01 * Math.sin(t * 7.3 + seedValue * 0.01)),
      H * t,
      H * lean * (0.02 * Math.sin(t * 4.1 + 0.9) + 0.012 * t)
    ));
  }

  const trunkCurve = new THREE.CatmullRomCurve3(axisControls, false, 'catmullrom', 0.5);

  const centerAt = (y) => {
    const point = trunkCurve.getPoint(clamp(y / H, 0, 1));
    point.y = y;
    return point;
  };

  const trunkRadiusAt = (t) => {
    const tc = clamp(t, 0, 1);
    const local = clamp(tc / profile.trunkTop, 0, 1);
    let r = trunkBaseRadius * lerp(
      1, profile.trunkTipRatio, Math.pow(local, profile.trunkTaper)
    );

    if (local < 0.2) {
      const f = 1 - local / 0.2;
      r += trunkBaseRadius * 0.6 * profile.flare * (0.35 + p.trunkFlare) * f * f;
    }

    r *= 1 + Math.sin(tc * 20 + seedValue * 0.1) * 0.025;
    return Math.max(H * 0.002, r);
  };

  const trunkRadiusAtY = (y) => trunkRadiusAt(clamp(y / H, 0, 1));

  /* ---------------------------------------------------------------- Ground */
  if (p.groundDebrisVisible) {
    groundParts.push({
      g: irregularIsland(groundRadius, 0.055, 14, random),
      c: C.soil,
      name: 'irregular_soil_island'
    });

    const mossCount = 4 + Math.round(p.foliageDensity * 5);
    for (let i = 0; i < mossCount; i++) {
      const angle = random() * Math.PI * 2;
      const radius = groundRadius * (0.18 + random() * 0.65);
      const patchRadius = groundRadius * (0.08 + random() * 0.09);
      addBlob(
        groundParts, patchRadius, 0,
        Math.cos(angle) * radius,
        0.06 + random() * 0.02,
        Math.sin(angle) * radius,
        C.moss,
        1.4, 0.18, 0.9 + random() * 0.5,
        `moss_patch_${i + 1}`
      );
    }

    const stoneCount = 3 + Math.floor(random() * 4);
    for (let i = 0; i < stoneCount; i++) {
      const angle = random() * Math.PI * 2;
      const radius = groundRadius * (0.45 + random() * 0.48);
      const stoneRadius = groundRadius * (0.035 + random() * 0.035);
      addBlob(
        groundParts, stoneRadius, 0,
        Math.cos(angle) * radius,
        stoneRadius * 0.35,
        Math.sin(angle) * radius,
        C.stone,
        1.1 + random() * 0.8,
        0.45 + random() * 0.4,
        0.85 + random() * 0.6,
        `forest_stone_${i + 1}`
      );
    }

    const litterCount = 8 + Math.round(p.foliageDensity * 12);
    const litterLength = profile.leafLength * p.leafSizeScale *
      Math.pow(clamp(H / 12, 0.45, 2.2), 0.35);

    for (let i = 0; i < litterCount; i++) {
      const angle = random() * Math.PI * 2;
      const radius = groundRadius * (0.2 + random() * 0.75);
      const heading = random() * Math.PI * 2;
      const litterColors = {
        leafDark: mixHex(C.litter, C.barkDark, 0.35),
        leafMid: C.litter,
        leafLight: mixHex(C.litter, C.autumn, 0.55),
        leafUnder: mixHex(C.litter, C.leafUnder, 0.4)
      };

      const geo = createLeafPrimitive(
        p.speciesProfile, 'low',
        { ...p, showLeafUndersides: false },
        litterColors,
        litterLength * (0.8 + random() * 0.4),
        litterLength * profile.leafWidth
      );

      addPrimitive(
        litterParts, geo,
        new THREE.Vector3(
          Math.cos(angle) * radius,
          0.065 + random() * 0.01,
          Math.sin(angle) * radius
        ),
        new THREE.Vector3(Math.cos(heading), 0.08, Math.sin(heading)).normalize(),
        random() * 0.6 - 0.3,
        `leaf_litter_${i + 1}`,
        [1, 1, 1], C.litter
      );
    }
  }

  /* ---------------------------------------------------------------- Roots */
  if (p.rootBaseVisible) {
    const rootCount = 4 + Math.floor(random() * 3);
    for (let i = 0; i < rootCount; i++) {
      const angle = (i / rootCount) * Math.PI * 2 + (random() - 0.5) * 0.4;
      const length = groundRadius * (0.55 + random() * 0.4) * (0.7 + profile.flare * 0.5);
      const side = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

      const collarY = H * 0.02;
      const collar = centerAt(collarY);
      const start = side.clone()
        .multiplyScalar(trunkRadiusAtY(collarY) * 0.35)
        .add(collar);
      start.y = collarY;

      const mid = side.clone().multiplyScalar(length * 0.45);
      mid.y = 0.1;
      mid.x += (random() - 0.5) * length * 0.15 + collar.x * 0.5;
      mid.z += (random() - 0.5) * length * 0.15 + collar.z * 0.5;

      const end = side.clone().multiplyScalar(length);
      end.y = 0.03;

      addPath(
        rootParts,
        [start, mid, end],
        [
          trunkBaseRadius * (0.45 + random() * 0.15) * profile.flare,
          trunkBaseRadius * 0.2,
          trunkBaseRadius * 0.04
        ],
        i % 2 === 0 ? C.upperBark : C.bark,
        5,
        `surface_root_${i + 1}`
      );
    }
  }

  /* ---------------------------------------------------------------- Trunk */
  const trunkTopY = H * profile.trunkTop;
  const trunkPoints = [];
  const trunkRadii = [];
  const trunkColors = [];
  const trunkRings = 22;
  const lowerBark = new THREE.Color(C.bark);
  const upperBark = new THREE.Color(C.upperBark);

  for (let i = 0; i <= trunkRings; i++) {
    const u = i / trunkRings;
    const local = u * u * 0.32 + u * 0.68;
    const y = lerp(-0.04, trunkTopY, local);

    trunkPoints.push(centerAt(Math.max(0, y)).setY(y));
    trunkRadii.push(trunkRadiusAt(clamp(y / H, 0, 1)));

    const mix = clamp((local - 0.25) / 0.75, 0, 1);
    trunkColors.push(
      lowerBark.clone().lerp(upperBark, mix * mix * (3 - 2 * mix)).getHex()
    );
  }

  trunkParts.push({
    g: sweptTube(trunkPoints, trunkRadii, 8, trunkColors),
    c: C.bark,
    name: 'swept_continuous_trunk'
  });

  const scarCount = 3 + Math.floor(H / 5);
  for (let i = 0; i < scarCount; i++) {
    const t = 0.12 + random() * Math.max(0.05, profile.trunkTop - 0.16);
    const y = H * t;
    const center = centerAt(y);
    const radius = trunkRadiusAtY(y);
    const angle = random() * Math.PI * 2;
    const radial = new THREE.Vector3(Math.cos(angle), 0.12, Math.sin(angle)).normalize();
    const start = center.clone().add(radial.clone().multiplyScalar(radius * 0.8));
    const end = center.clone().add(radial.clone().multiplyScalar(radius * (1.2 + random() * 0.6)));

    addWire(
      barkParts,
      [start.x, start.y, start.z],
      [end.x, end.y, end.z],
      C.barkDark,
      radius * (0.14 + random() * 0.08),
      5,
      `broken_limb_stub_${i + 1}`
    );
  }

  /* ------------------------------------------------------------ Scaffolds */
  const scaffoldCount = Math.max(
    3,
    Math.round(lerp(
      profile.scaffolds[0], profile.scaffolds[1],
      clamp(p.foliageDensity * 0.65 + p.crownSpread * 0.35, 0, 1)
    ))
  );

  const scaffoldLists = Array.from({ length: scaffoldCount + 1 }, () => []);

  let chain = 0;
  for (let d = 0; d <= profile.maxDepth; d++) chain += Math.pow(profile.lengthRatio, d);

  const crownRadius = W * 0.5 * profile.crownWidth;
  const scaffoldMidY = H * lerp(profile.scaffoldStart, profile.scaffoldEnd, 0.5);
  const crownRise = Math.max(H * 0.12, H * 0.96 - scaffoldMidY);

  const speciesPitch = lerp(profile.pitch[0], profile.pitch[1], p.crownSpread);
  const idealPitch = Math.atan2(
    crownRadius,
    crownRise * clamp(1 - profile.upBias * 0.45, 0.45, 1)
  );
  const pitchMid = clamp(
    idealPitch,
    Math.max(0.22, speciesPitch - 0.3),
    Math.min(1.45, speciesPitch + 0.3)
  );
  const pitchShift = pitchMid - speciesPitch;

  const scaffoldLength = clamp(
    Math.hypot(crownRadius, crownRise) / chain * (profile.lengthTune ?? 1),
    H * 0.06, H * 0.55
  );

  const seedSize = 0.03 *
    Math.pow(clamp(H / 12, 0.5, 2), 0.3) *
    (profile.seedType === 'blossom' ? 1.6 : 1) *
    p.leafSizeScale;

  const ctx = {
    species: p.speciesProfile,
    detail,
    p,
    C,
    random,
    profile,
    H,
    leafParts,
    microParts,
    seedParts,
    barkParts,
    minRadius: Math.max(0.003, H * 0.0007),
    minLength: H * 0.01,
    maxDepth: profile.maxDepth,
    rollSeed: seedValue * 0.017,
    seedSize
  };

  for (let i = 0; i < scaffoldCount; i++) {
    const spread = scaffoldCount > 1 ? i / (scaffoldCount - 1) : 0.5;
    const yFraction = clamp(
      lerp(profile.scaffoldStart, profile.scaffoldEnd, spread) +
      (random() - 0.5) * 0.04,
      0.14, profile.trunkTop * 0.99
    );

    const y = H * yFraction;
    const center = centerAt(y);
    const angle = i * 2.39996 + random() * 0.5 + p.trunkLeanAndTwist * spread * 3.1;

    const radialDirection = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const pitch = clamp(
      (speciesPitch + pitchShift) *
      (0.85 + random() * 0.32) *
      (1 - spread * 0.25),
      0.15, 1.48
    );

    const direction = radialDirection.clone().multiplyScalar(Math.sin(pitch))
      .add(new THREE.Vector3(0, Math.cos(pitch), 0))
      .normalize();

    const trunkR = trunkRadiusAtY(y);
    const branchRadius = clamp(
      trunkR * (0.62 - spread * 0.16),
      ctx.minRadius * 2,
      trunkBaseRadius * 0.7
    );

    const start = center.clone().add(
      radialDirection.clone().multiplyScalar(
        Math.max(trunkR * 0.2, trunkR * 0.75 - branchRadius * 1.1)
      )
    );
    start.y = y;

    growBranch(
      ctx, scaffoldLists[i], start, direction,
      scaffoldLength * (0.86 + random() * 0.32) * (1 - spread * 0.2),
      branchRadius, 0,
      `scaffold_${i + 1}`
    );
  }

  // Central leader for tall/aspen profiles
  if (profile.trunkTop > 0.6) {
    const leaderBase = centerAt(trunkTopY);
    leaderBase.y = trunkTopY;
    growBranch(
      ctx, scaffoldLists[scaffoldCount], leaderBase,
      new THREE.Vector3(
        p.trunkLeanAndTwist * 0.08, 1, -p.trunkLeanAndTwist * 0.05
      ).normalize(),
      scaffoldLength * 0.65,
      trunkRadiusAtY(trunkTopY) * 0.85, 0,
      'central_leader'
    );
  }

  /* ----------------------------------------------------- Falling Leaves */
  if (p.fallingLeavesVisible) {
    const fallingCount = 6 + Math.round(p.foliageDensity * 10);
    const fallingLength = profile.leafLength * p.leafSizeScale *
      Math.pow(clamp(H / 12, 0.45, 2.2), 0.35);

    for (let i = 0; i < fallingCount; i++) {
      const angle = random() * Math.PI * 2;
      const radius = W * (0.1 + random() * 0.5);
      const y = H * (0.18 + random() * 0.6);
      const center = centerAt(y);

      const fallingColors = {
        leafDark: mixHex(C.autumn, C.leafDark, 0.45),
        leafMid: C.autumn,
        leafLight: mixHex(C.autumn, C.leafLight, 0.4),
        leafUnder: C.leafUnder
      };

      const geo = createLeafPrimitive(
        p.speciesProfile, 'low',
        { ...p, showLeafUndersides: false },
        fallingColors,
        fallingLength * (0.75 + random() * 0.4),
        fallingLength * profile.leafWidth
      );

      addPrimitive(
        fallingParts, geo,
        new THREE.Vector3(
          center.x + Math.cos(angle) * radius,
          y,
          center.z + Math.sin(angle) * radius
        ),
        new THREE.Vector3(
          random() - 0.5, -0.4 - random() * 0.6, random() - 0.5
        ).normalize(),
        random() * Math.PI * 2,
        `falling_leaf_${i + 1}`,
        [1, 1, 1], C.autumn
      );
    }
  }

  /* ----------------------------------------------------------- Assembly */
  const asset = new THREE.Group();
  asset.name = 'parametricDeciduous';

  const scaffoldAll = scaffoldLists.flatMap((list) => list);
  const allGeometry = [
    ...rootParts, ...groundParts, ...litterParts,
    ...trunkParts, ...barkParts,
    ...scaffoldAll, ...leafParts, ...microParts,
    ...seedParts, ...fallingParts
  ];

  if (p.mergeForProduction) {
    const solid = finish(allGeometry, MAT, 'parametricDeciduous_solid', true);
    if (solid) asset.add(solid);
  } else {
    const rootBase = new THREE.Group();
    rootBase.name = 'rootBase';
    const rootMesh = finish(rootParts, MAT, 'rootBase_geometry', false);
    if (rootMesh) rootBase.add(rootMesh);
    asset.add(rootBase);

    const forestFloor = new THREE.Group();
    forestFloor.name = 'forestFloor';
    const groundMesh = finish(groundParts, MAT, 'forestFloor_geometry', false);
    const litterMesh = finish(litterParts, MAT, 'leafLitter_geometry', false);
    if (groundMesh) forestFloor.add(groundMesh);
    if (litterMesh) forestFloor.add(litterMesh);
    asset.add(forestFloor);

    const trunk = new THREE.Group();
    trunk.name = 'trunk';
    const trunkMesh = finish(trunkParts, MAT, 'trunk_geometry', false);
    const barkMesh = finish(barkParts, MAT, 'barkDetails', false);
    if (trunkMesh) trunk.add(trunkMesh);
    if (barkMesh) trunk.add(barkMesh);
    asset.add(trunk);

    const wholeCanopy = new THREE.Group();
    wholeCanopy.name = 'wholeCanopy';

    const scaffoldBranches = new THREE.Group();
    scaffoldBranches.name = 'scaffoldBranches';

    for (let i = 0; i < scaffoldLists.length; i++) {
      if (scaffoldLists[i].length === 0) continue;
      const limb = new THREE.Group();
      limb.name = i < scaffoldCount ? `scaffoldBranch_${i + 1}` : 'centralLeader';
      const mesh = finish(scaffoldLists[i], MAT, `${limb.name}_geometry`, false);
      if (mesh) limb.add(mesh);
      scaffoldBranches.add(limb);
    }
    wholeCanopy.add(scaffoldBranches);

    const speciesFoliage = new THREE.Group();
    speciesFoliage.name = 'speciesFoliage';

    const animatedFoliage = new THREE.Group();
    animatedFoliage.name = profile.foliage;

    const leafMesh = finish(leafParts, MAT, `${profile.foliage}_geometry`, false);
    const microMesh = finish(microParts, MAT, `${profile.foliage}_microDetails`, false);
    if (leafMesh) animatedFoliage.add(leafMesh);
    if (microMesh) animatedFoliage.add(microMesh);
    speciesFoliage.add(animatedFoliage);
    wholeCanopy.add(speciesFoliage);

    asset.add(wholeCanopy);

    const seeds = new THREE.Group();
    seeds.name = 'seeds';
    const seedMesh = finish(seedParts, MAT, 'seeds_geometry', false);
    if (seedMesh) seeds.add(seedMesh);
    asset.add(seeds);

    const fallingLeaves = new THREE.Group();
    fallingLeaves.name = 'fallingLeaves';
    const fallingMesh = finish(fallingParts, MAT, 'fallingLeaves_geometry', false);
    if (fallingMesh) fallingLeaves.add(fallingMesh);
    asset.add(fallingLeaves);
  }

  const crownSocket = new THREE.Object3D();
  crownSocket.name = 'socket_crownTop';
  crownSocket.position.copy(centerAt(H * 0.95));
  crownSocket.position.y = H * 0.95;
  asset.add(crownSocket);

  return asset;
}

export default createAsset;
