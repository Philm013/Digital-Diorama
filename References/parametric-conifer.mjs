/*
 * PARAMETRIC SPECIES-SPECIFIC CONIFER (High Detail)
 * A botanical, stylized-natural procedural conifer for three.js with distinct
 * spruce needles, pine fascicles, fir flat sprays, cedar scales, and fantasy
 * hero foliage. One import, no loaders, no textures.
 *
 * QUICK START
 *   import { createAsset } from './parametric-conifer.mjs';
 *   scene.add(createAsset({
 *     speciesProfile: 'spruce',
 *     treeHeight: 11,
 *     canopyWidth: 6.4,
 *     needleDetailLevel: 'standard',
 *     mergeForProduction: true
 *   }));
 *
 * PARAMETERS
 *   speciesProfile, treeHeight, canopyWidth, branchDroop, foliageDensity,
 *   trunkLeanAndTwist, needleHueAndSeason, needleDetailLevel,
 *   needleLengthScale, needleStiffness, showStomatalBands, bundleCount,
 *   coneDensity, rootBaseVisible, groundDebrisVisible,
 *   fallingNeedlesVisible, seed, colorway, zone colors.
 *
 * SPECS  Approximately 6,000-25,000 triangles at standard detail,
 *        up to ~46,000 at high detail and maximum density.
 *        Default dimensions: 6.4 x 11 x 6.4 m.
 * PARTS  animate: wholeCanopy, primaryBranchWhorl_1..8, spruceNeedles,
 *                 pineNeedles, firNeedles, cedarSprays, stylizedTufts,
 *                 topLeader, cones, pollenCones, fallingNeedles
 *        detach: rootBase, mossAndGroundDebris, primaryBranchWhorls,
 *                spruce_needleCloud, pine_fascicles, fir_flatSprays,
 *                cedar_scaleSprays, stylized_tufts, topLeader, cones,
 *                pollenCones, fallingNeedles
 *
 * Coordinates use meters. Ground level is Y=0.
 * License: CC0-1.0. Commercial and personal use permitted without attribution.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BASE = {
  bark:        '#514238',
  upperBark:   '#79503a',
  barkDark:    '#302a27',
  branch:      '#45372f',
  needleDark:  '#173d31',
  needleMid:   '#286047',
  needleTip:   '#72a85b',
  needleUnder: '#c4d5c8',
  resin:       '#b98437',
  pollen:      '#c9a83e',
  cone:        '#765039',
  moss:        '#587143',
  soil:        '#493a2c',
  stone:       '#77766f',
  dryNeedle:   '#947344'
};

export const COLORWAYS = {
  alpineSpruce: {
    bark: '#4b4745', upperBark: '#655f59', barkDark: '#292d2e',
    branch: '#403d3b', needleDark: '#163942', needleMid: '#285860',
    needleTip: '#8aa99a', needleUnder: '#c4d2ca', resin: '#b57a36',
    pollen: '#cbb24f', cone: '#665044', moss: '#687b5a',
    soil: '#443d35', stone: '#888b88', dryNeedle: '#746b4b'
  },
  warmScotsPine: {
    bark: '#57382b', upperBark: '#a85d32', barkDark: '#30231e',
    branch: '#513429', needleDark: '#3b5127', needleMid: '#667b31',
    needleTip: '#a3b94b', needleUnder: '#c8d3a2', resin: '#d09135',
    pollen: '#d4b840', cone: '#98622f', moss: '#68743a',
    soil: '#55402b', stone: '#827766', dryNeedle: '#b1823e'
  },
  silverFir: {
    bark: '#67625e', upperBark: '#827b73', barkDark: '#3b3d3d',
    branch: '#565250', needleDark: '#35545a', needleMid: '#648187',
    needleTip: '#abcbb9', needleUnder: '#d8e1da', resin: '#ad824d',
    pollen: '#c7ad59', cone: '#726050', moss: '#68786b',
    soil: '#4e4841', stone: '#7c8990', dryNeedle: '#8d8066'
  },
  enchantedEvergreen: {
    bark: '#35283e', upperBark: '#523651', barkDark: '#211a2d',
    branch: '#31263c', needleDark: '#075449', needleMid: '#087e62',
    needleTip: '#a4db36', needleUnder: '#c6f2d7', resin: '#e1a643',
    pollen: '#dfd64b', cone: '#548a85', moss: '#3f9b72',
    soil: '#30273b', stone: '#657d86', dryNeedle: '#70934b'
  }
};

export const presets = COLORWAYS;

export const params = {
  mergeForProduction: {
    type: 'toggle', default: false, label: 'Merge for Production',
    affects: 'geometry',
    describe: 'Merges all vertex-colored geometry into one production mesh. Disable for selectable semantic parts.'
  },
  speciesProfile: {
    type: 'choice', default: 'spruce', label: 'Conifer Variety',
    options: ['spruce', 'pine', 'fir', 'cedar', 'stylized'],
    affects: 'geometry',
    describe: 'Selects botanical crown structure, needle primitive, attachment pattern, cones, and micro-details.'
  },
  treeHeight: {
    type: 'range', default: 11, min: 3.5, max: 20, step: 0.25,
    label: 'Tree Height', affects: 'geometry',
    describe: 'Overall tree height in meters. The trunk, tiers, roots, and crown are rebuilt.'
  },
  canopyWidth: {
    type: 'range', default: 6.4, min: 1.8, max: 11, step: 0.2,
    label: 'Canopy Width', affects: 'geometry',
    describe: 'Maximum mature crown spread in meters.'
  },
  branchDroop: {
    type: 'range', default: 0.48, min: 0, max: 1, step: 0.01,
    label: 'Branch Droop', affects: 'geometry',
    describe: 'Controls the downward curvature of primary branches and foliage tips.'
  },
  foliageDensity: {
    type: 'range', default: 0.72, min: 0.18, max: 1, step: 0.01,
    label: 'Foliage Density', affects: 'geometry',
    describe: 'Rebuilds branchlet, needle, fascicle, scale, and spray counts.'
  },
  trunkLeanAndTwist: {
    type: 'range', default: 0.28, min: 0, max: 1, step: 0.01,
    label: 'Lean and Twist', affects: 'geometry',
    describe: 'Introduces a wind-shaped trunk path and rotational drift between branch tiers.'
  },
  needleHueAndSeason: {
    type: 'choice', default: 'colorway', label: 'Needle Hue',
    options: ['colorway', 'deepBlueGreen', 'springGreen', 'silverGreen', 'mutedAutumn'],
    affects: 'colors',
    describe: 'Applies a coordinated seasonal foliage palette.'
  },
  needleDetailLevel: {
    type: 'choice', default: 'standard', label: 'Needle Detail',
    options: ['low', 'standard', 'high'],
    affects: 'geometry',
    describe: 'Low uses compact legacy tufts; standard uses species-specific needles; high adds botanical micro-details.'
  },
  needleLengthScale: {
    type: 'range', default: 1, min: 0.5, max: 1.8, step: 0.05,
    label: 'Needle Length', affects: 'geometry',
    describe: 'Global multiplier applied to species-specific needle lengths.'
  },
  needleStiffness: {
    type: 'range', default: 0.5, min: 0, max: 1, step: 0.01,
    label: 'Needle Stiffness', affects: 'geometry',
    describe: 'Controls erect versus drooping needle direction and blade curvature.'
  },
  showStomatalBands: {
    type: 'toggle', default: true, label: 'Stomatal Bands',
    affects: 'colors',
    describe: 'Adds silvery underside geometry to fir needles.'
  },
  bundleCount: {
    type: 'choice', default: 'natural', label: 'Pine Bundle Count',
    options: ['natural', '2', '3', '5'],
    affects: 'geometry',
    describe: 'Selects natural seeded fascicles or forces two, three, or five needles per pine sheath.'
  },
  coneDensity: {
    type: 'range', default: 0.38, min: 0, max: 1, step: 0.01,
    label: 'Cone Density', affects: 'geometry',
    describe: 'Controls hanging cones, erect fir cones, and high-detail pollen structures.'
  },
  rootBaseVisible: {
    type: 'toggle', default: true, label: 'Exposed Root Base',
    affects: 'geometry',
    describe: 'Includes a flared trunk foot and radial surface roots.'
  },
  groundDebrisVisible: {
    type: 'toggle', default: true, label: 'Forest Floor',
    affects: 'geometry',
    describe: 'Includes soil, moss, stones, fallen needles, and twig fragments.'
  },
  fallingNeedlesVisible: {
    type: 'toggle', default: false, label: 'Falling Needles',
    affects: 'geometry',
    describe: 'Adds a detachable layer of airborne seasonal needles.'
  },
  seed: {
    type: 'range', default: 731, min: 1, max: 9999, step: 1,
    label: 'Natural Variation Seed', affects: 'geometry',
    describe: 'Deterministically changes asymmetry, tier rotation, roots, cones, scars, and sprays.'
  },
  colorway: {
    type: 'choice', default: 'alpineSpruce', label: 'Colorway',
    options: Object.keys(COLORWAYS), affects: 'colors',
    describe: 'Curated bark, foliage, cone, moss, earth, and stone palette.'
  },
  bark: {
    type: 'color', default: BASE.bark, label: 'Lower Bark',
    affects: 'colors', describe: 'Lower trunk and root bark override.'
  },
  upperBark: {
    type: 'color', default: BASE.upperBark, label: 'Upper Bark',
    affects: 'colors', describe: 'Upper trunk bark override.'
  },
  needleDark: {
    type: 'color', default: BASE.needleDark, label: 'Shadow Needles',
    affects: 'colors', describe: 'Inner foliage and pine sheath color override.'
  },
  needleMid: {
    type: 'color', default: BASE.needleMid, label: 'Main Needles',
    affects: 'colors', describe: 'Primary needle upper-surface color override.'
  },
  needleTip: {
    type: 'color', default: BASE.needleTip, label: 'Fresh Tips',
    affects: 'colors', describe: 'Fresh growth, scale edge, and needle-tip color override.'
  },
  needleUnder: {
    type: 'color', default: BASE.needleUnder, label: 'Fir Underside',
    affects: 'colors', describe: 'Silvery fir stomatal-band color override.'
  },
  cone: {
    type: 'color', default: BASE.cone, label: 'Cones',
    affects: 'colors', describe: 'Mature seed-cone color override.'
  },
  moss: {
    type: 'color', default: BASE.moss, label: 'Moss',
    affects: 'colors', describe: 'Forest-floor moss color override.'
  }
};

export const rig = {
  wholeCanopy: { axis: 'z', range: [-3, 3], describe: 'Slow whole-crown wind sway.' },
  primaryBranchWhorl_1: { axis: 'z', range: [-2, 2], describe: 'Lower branch flex.' },
  primaryBranchWhorl_2: { axis: 'z', range: [-2.5, 2.5], describe: 'Branch flex.' },
  primaryBranchWhorl_3: { axis: 'z', range: [-3, 3], describe: 'Branch flex.' },
  primaryBranchWhorl_4: { axis: 'z', range: [-3.5, 3.5], describe: 'Branch flex.' },
  primaryBranchWhorl_5: { axis: 'z', range: [-4, 4], describe: 'Branch flex.' },
  primaryBranchWhorl_6: { axis: 'z', range: [-4.5, 4.5], describe: 'Upper branch flex.' },
  primaryBranchWhorl_7: { axis: 'z', range: [-5, 5], describe: 'Upper branch flex.' },
  primaryBranchWhorl_8: { axis: 'z', range: [-5.5, 5.5], describe: 'Upper branch flex.' },
  spruceNeedles: { axis: 'z', range: [-1.6, 1.6], describe: 'Fast, stiff needle flutter.' },
  pineNeedles: { axis: 'z', range: [-5, 5], describe: 'Slow fascicle sway with aerodynamic drag.' },
  firNeedles: { axis: 'x', range: [-2.5, 2.5], describe: 'Planar two-ranked ripple.' },
  cedarSprays: { axis: 'x', range: [-4, 4], describe: 'Whole flattened spray flutter.' },
  stylizedTufts: { axis: 'y', range: [0.94, 1.08], describe: 'Cartoon tuft bounce and squash.' },
  topLeader: { axis: 'z', range: [-8, 8], describe: 'Flexible crown leader bend.' },
  cones: { axis: 'x', range: [-7, 7], describe: 'Seed-cone pendulum motion.' },
  pollenCones: { axis: 'x', range: [-3, 3], describe: 'Small pollen structure tremble.' },
  fallingNeedles: { axis: 'y', range: [0, -2], describe: 'Looping seasonal downward drift.' }
};

export const detach = [
  'rootBase',
  'mossAndGroundDebris',
  'primaryBranchWhorls',
  'spruce_needleCloud',
  'pine_fascicles',
  'fir_flatSprays',
  'cedar_scaleSprays',
  'stylized_tufts',
  'topLeader',
  'cones',
  'pollenCones',
  'fallingNeedles'
];

export const night = {
  needleTip: {
    color: '#9fe85b', intensity: 0.13, distance: 4,
    describe: 'Subtle fresh-growth shimmer, strongest on stylized hero needles.'
  },
  moss: {
    color: '#48b98d', intensity: 0.08, distance: 2,
    describe: 'Very faint moss glow for fantasy night transitions.'
  }
};

const PROFILE = {
  spruce: {
    tiers: 8, branches: [6, 8], width: 0.91, base: 0.17, top: 0.88,
    droop: 0.72, openness: 0.96, branchlets: 0.98, crownPower: 0.72
  },
  pine: {
    tiers: 6, branches: [4, 7], width: 1.08, base: 0.25, top: 0.82,
    droop: 0.34, openness: 0.72, branchlets: 0.72, crownPower: 0.48
  },
  fir: {
    tiers: 7, branches: [6, 8], width: 1.03, base: 0.19, top: 0.87,
    droop: 0.88, openness: 1, branchlets: 1.05, crownPower: 0.68
  },
  cedar: {
    tiers: 6, branches: [5, 7], width: 1.14, base: 0.23, top: 0.82,
    droop: 0.47, openness: 0.78, branchlets: 1.12, crownPower: 0.59
  },
  stylized: {
    tiers: 5, branches: [5, 6], width: 1, base: 0.20, top: 0.86,
    droop: 0.50, openness: 0.86, branchlets: 0.62, crownPower: 0.65
  }
};

const SEASON = {
  deepBlueGreen: {
    needleDark: '#103b3d', needleMid: '#1c5c58',
    needleTip: '#5c9380', needleUnder: '#b9cfca'
  },
  springGreen: {
    needleDark: '#285126', needleMid: '#4f8435',
    needleTip: '#b2d957', needleUnder: '#d4dfb2'
  },
  silverGreen: {
    needleDark: '#3b595b', needleMid: '#69868a',
    needleTip: '#bdd1bf', needleUnder: '#dce4df'
  },
  mutedAutumn: {
    needleDark: '#47513a', needleMid: '#70774e',
    needleTip: '#9b9561', needleUnder: '#c9c7ad'
  }
};

const ZONE_KEYS = Object.keys(BASE);

const hexOf = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value & 0xFFFFFF;
  if (typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value)) {
    return parseInt(value.replace('#', ''), 16);
  }
  return null;
};

function zonesFor(name, overrides = {}) {
  const colorway = COLORWAYS[name] || COLORWAYS.alpineSpruce;
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
      colors[i * 3] = color.r;
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
  roughness: 0.91,
  metalness: 0,
  side: THREE.DoubleSide
});

const GLASS_MAT = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.12,
  metalness: 0.15,
  transparent: true,
  opacity: 0.58,
  side: THREE.DoubleSide,
  depthWrite: false
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
    group.add(mesh);
  });

  return group;
}

function box(w, h, d, x = 0, y = 0, z = 0) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

function addCylinder(
  parts, rTop, rBottom, height, segments, x, y, z,
  rx = 0, ry = 0, rz = 0, hex = '#888888', name = ''
) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, height, segments);
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z);
  parts.push({ g: geo, c: hex, name });
}

function addWire(parts, p1, p2, hex, radius = 0.01, radialSegments = 5, name = '') {
  const a = new THREE.Vector3(...p1);
  const b = new THREE.Vector3(...p2);
  const distance = a.distanceTo(b);
  if (distance < 1e-5) return;

  const geo = new THREE.CylinderGeometry(radius, radius, distance, radialSegments);
  const midpoint = a.clone().lerp(b, 0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize()
  );

  geo.applyMatrix4(new THREE.Matrix4().compose(
    midpoint,
    quaternion,
    new THREE.Vector3(1, 1, 1)
  ));

  parts.push({ g: geo, c: hex, name });
}

function addExtrusion(
  parts, shape, depth, hex,
  x = 0, y = 0, z = 0,
  rx = 0, ry = 0, rz = 0,
  bevel = 0.01, name = ''
) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: bevel > 0,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 4
  });
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z);
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

function transformed(geometry, position, direction, scale = [1, 1, 1], roll = 0) {
  const dir = direction.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir
  );

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

function sweptTube(points, radii, radialSegments = 7, colors = null) {
  const vertices = [];
  const vertexColors = [];
  const indices = [];
  const frames = [];
  const worldUp = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < points.length; i++) {
    let tangent;
    if (i === 0) tangent = points[1].clone().sub(points[0]).normalize();
    else if (i === points.length - 1) {
      tangent = points[i].clone().sub(points[i - 1]).normalize();
    } else {
      tangent = points[i + 1].clone().sub(points[i - 1]).normalize();
    }

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
      const angle = j / radialSegments * Math.PI * 2;
      const offset = frames[i].side.clone()
        .multiplyScalar(Math.cos(angle) * radii[i])
        .add(frames[i].normal.clone().multiplyScalar(Math.sin(angle) * radii[i]));
      const vertex = points[i].clone().add(offset);
      vertices.push(vertex.x, vertex.y, vertex.z);
      if (hasColors) {
        vertexColors.push(c.r, c.g, c.b);
      }
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
  if (hasColors) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  }
  geo.setIndex(indices);
  return geo;
}

function addPath(parts, points, radii, hex, radialSegments = 7, name = '') {
  parts.push({
    g: sweptTube(points, radii, radialSegments),
    c: hex,
    name
  });
}

function irregularIsland(radius, height, segments, random) {
  const vertices = [0, height, 0, 0, -0.015, 0];
  const indices = [];
  const edge = [];

  for (let i = 0; i < segments; i++) {
    const angle = i / segments * Math.PI * 2;
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

function addBlob(
  parts, radius, detail, x, y, z, hex,
  sx = 1, sy = 1, sz = 1, name = ''
) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  geo.scale(sx, sy, sz);
  geo.translate(x, y, z);
  parts.push({ g: geo, c: hex, name });
}

function coloredGeometry(triangles, species = '') {
  const positions = [];
  const colors = [];

  for (const triangle of triangles) {
    for (const vertex of triangle) {
      positions.push(vertex.p[0], vertex.p[1], vertex.p[2]);
      const color = new THREE.Color(vertex.c);
      colors.push(color.r, color.g, color.b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.userData.species = species;
  return geo;
}

function vertex(p, c) {
  return { p, c };
}

/**
 * Low-detail legacy pointed tuft used for backward compatibility.
 */
function legacyTuftGeometry(length, width, thickness, dark, mid, tip) {
  const triangles = [];
  const ringA = [];
  const ringB = [];
  const segments = 6;

  for (let i = 0; i < segments; i++) {
    const angle = i / segments * Math.PI * 2;
    ringA.push([
      Math.cos(angle) * width * 0.82,
      -length * 0.17,
      Math.sin(angle) * thickness * 0.82
    ]);
    ringB.push([
      Math.cos(angle) * width,
      length * 0.19,
      Math.sin(angle) * thickness
    ]);
  }

  const bottom = [0, -length * 0.52, 0];
  const top = [0, length * 0.58, 0];

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    triangles.push([
      vertex(bottom, dark), vertex(ringA[next], dark), vertex(ringA[i], mid)
    ]);
    triangles.push([
      vertex(ringA[i], mid), vertex(ringA[next], mid), vertex(ringB[i], mid)
    ]);
    triangles.push([
      vertex(ringA[next], mid), vertex(ringB[next], tip), vertex(ringB[i], mid)
    ]);
    triangles.push([
      vertex(top, tip), vertex(ringB[i], mid), vertex(ringB[next], tip)
    ]);
  }

  return coloredGeometry(triangles, 'legacy');
}

/**
 * Species-specific needle primitive factory.
 * Geometry is authored along local +Y and carries baked vertex colors.
 */
function createNeedlePrimitive(
  species, detailLevel, p, C, random,
  length = 0.22, width = 0.025
) {
  if (detailLevel === 'low') {
    return legacyTuftGeometry(
      length, width * 2.5, width,
      C.needleDark, C.needleMid, C.needleTip
    );
  }

  const triangles = [];

  if (species === 'spruce') {
    const half = width;
    const baseY = -length * 0.16;
    const tipY = length * 0.84;
    const base = [
      [-half, baseY, 0],
      [0, baseY, half * 0.72],
      [half, baseY, 0],
      [0, baseY, -half * 0.72]
    ];
    const tip = [0, tipY, 0];

    for (let i = 0; i < 4; i++) {
      triangles.push([
        vertex(base[i], C.needleDark),
        vertex(base[(i + 1) % 4], C.needleMid),
        vertex(tip, C.needleTip)
      ]);
    }
  } else if (species === 'pine') {
    let count;
    if (p.bundleCount !== 'natural') count = Number(p.bundleCount);
    else {
      const choices = [2, 2, 3, 3, 5];
      count = choices[Math.floor(random() * choices.length)];
    }

    const curve = (1 - p.needleStiffness) * length * 0.24;
    for (let i = 0; i < count; i++) {
      const angle = count === 1 ? 0 : (i / count - 0.5) * 1.05;
      const x = Math.sin(angle) * width * 1.8;
      const z = Math.cos(angle) * width * 0.55;
      const mid = [
        x * 0.55,
        length * 0.43,
        z + curve * 0.38
      ];
      const tip = [
        x * 1.65,
        length,
        z + curve
      ];
      const left = [-width * 0.20, 0, 0];
      const right = [width * 0.20, 0, 0];

      triangles.push([
        vertex(left, C.needleDark),
        vertex(right, C.needleDark),
        vertex(mid, C.needleMid)
      ]);
      triangles.push([
        vertex(left, C.needleDark),
        vertex(mid, C.needleMid),
        vertex(tip, C.needleTip)
      ]);
    }
  } else if (species === 'fir') {
    const half = width;
    const y0 = 0;
    const y1 = length * 0.78;
    const y2 = length;
    const notch = width * 0.24;
    const ridge = width * (detailLevel === 'high' ? 0.18 : 0.08);

    triangles.push(
      [
        vertex([-half, y0, 0], C.needleDark),
        vertex([half, y0, 0], C.needleMid),
        vertex([0, y1, ridge], C.needleMid)
      ],
      [
        vertex([-half, y0, 0], C.needleDark),
        vertex([0, y1, ridge], C.needleMid),
        vertex([-notch, y2, 0], C.needleTip)
      ],
      [
        vertex([half, y0, 0], C.needleMid),
        vertex([notch, y2, 0], C.needleTip),
        vertex([0, y1, ridge], C.needleMid)
      ],
      [
        vertex([-notch, y2, 0], C.needleTip),
        vertex([0, y1, ridge], C.needleTip),
        vertex([notch, y2, 0], C.needleTip)
      ]
    );

    if (p.showStomatalBands) {
      const under = -width * 0.035;
      triangles.push(
        [
          vertex([half * 0.82, y0, under], C.needleUnder),
          vertex([-half * 0.82, y0, under], C.needleUnder),
          vertex([-notch, y2, under], C.needleUnder)
        ],
        [
          vertex([half * 0.82, y0, under], C.needleUnder),
          vertex([-notch, y2, under], C.needleUnder),
          vertex([notch, y2, under], C.needleUnder)
        ]
      );
    }
  } else if (species === 'cedar') {
    triangles.push(
      [
        vertex([0, -length * 0.08, 0], C.needleDark),
        vertex([-width, length * 0.42, width * 0.10], C.needleMid),
        vertex([0, length, 0], C.needleTip)
      ],
      [
        vertex([0, -length * 0.08, 0], C.needleDark),
        vertex([0, length, 0], C.needleTip),
        vertex([width, length * 0.42, width * 0.10], C.needleMid)
      ]
    );
  } else {
    const ridge = width * 0.32;
    const p0 = [0, 0, 0];
    const l1 = [-width, length * 0.30, 0];
    const r1 = [width, length * 0.30, 0];
    const l2 = [-width * 0.58, length * 0.72, ridge * 0.35];
    const r2 = [width * 0.58, length * 0.72, ridge * 0.35];
    const center = [0, length * 0.53, ridge];
    const tip = [0, length, width * (1 - p.needleStiffness) * 0.55];

    triangles.push(
      [vertex(p0, C.needleDark), vertex(l1, C.needleMid), vertex(center, C.needleMid)],
      [vertex(p0, C.needleDark), vertex(center, C.needleMid), vertex(r1, C.needleMid)],
      [vertex(l1, C.needleMid), vertex(l2, C.needleTip), vertex(center, C.needleMid)],
      [vertex(center, C.needleMid), vertex(l2, C.needleTip), vertex(tip, C.needleTip)],
      [vertex(center, C.needleMid), vertex(tip, C.needleTip), vertex(r2, C.needleTip)],
      [vertex(r1, C.needleMid), vertex(center, C.needleMid), vertex(r2, C.needleTip)]
    );
  }

  return coloredGeometry(triangles, species);
}

function addPrimitive(
  parts, geometry, position, direction, roll, name,
  scale = [1, 1, 1], fallbackColor = '#ffffff'
) {
  transformed(geometry, position, direction, scale, roll);
  parts.push({ g: geometry, c: fallbackColor, name });
}

function coneGeometry(radius, height, segments = 7) {
  const points = [
    new THREE.Vector2(radius * 0.08, -height * 0.52),
    new THREE.Vector2(radius * 0.58, -height * 0.43),
    new THREE.Vector2(radius * 0.78, -height * 0.30),
    new THREE.Vector2(radius * 0.62, -height * 0.20),
    new THREE.Vector2(radius, -height * 0.06),
    new THREE.Vector2(radius * 0.72, height * 0.05),
    new THREE.Vector2(radius * 0.91, height * 0.18),
    new THREE.Vector2(radius * 0.56, height * 0.30),
    new THREE.Vector2(radius * 0.62, height * 0.40),
    new THREE.Vector2(radius * 0.18, height * 0.50)
  ];
  return new THREE.LatheGeometry(points, segments);
}

function addCone(parts, position, direction, radius, height, hex, name = '') {
  const geo = coneGeometry(radius, height, 7);
  transformed(geo, position, direction);
  parts.push({ g: geo, c: hex, name });
}

function tangentFrame(direction) {
  const tangent = direction.clone().normalize();
  const helper = Math.abs(tangent.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(tangent, helper).normalize();
  const normal = new THREE.Vector3().crossVectors(side, tangent).normalize();
  return { tangent, side, normal };
}

function addSpeciesFoliage({
  species, detail, p, C, random, parts, microParts, pollenParts,
  base, tip, primaryDirection, H, outer, label
}) {
  const axis = tip.clone().sub(base);
  const length = axis.length();
  if (length < 1e-5) return;

  const frame = tangentFrame(axis);
  const needleScale = p.needleLengthScale;
  const density = p.foliageDensity;
  const stiffness = p.needleStiffness;
  const detailFactor = detail === 'high' ? 1.28 : 1;
  const colorFallback = outer > 0.72 ? C.needleTip : C.needleMid;

  if (detail === 'low') {
    const count = Math.max(2, Math.round(2 + density * 3));
    for (let i = 0; i < count; i++) {
      const u = (i + 0.45) / count;
      const position = base.clone().lerp(tip, u);
      const direction = frame.tangent.clone()
        .add(frame.normal.clone().multiplyScalar(0.18 + random() * 0.16))
        .normalize();
      const needleLength = H * 0.027 * needleScale;
      const geo = createNeedlePrimitive(
        species, 'low', p, C, random,
        needleLength, needleLength * 0.14
      );
      addPrimitive(
        parts, geo, position, direction, random() * Math.PI,
        `${label}_legacy_tuft_${i + 1}`, [1, 1, 1], colorFallback
      );
    }
    return;
  }

  if (species === 'spruce') {
    const nodes = Math.max(4, Math.round((4 + density * 6) * detailFactor));
    for (let i = 0; i < nodes; i++) {
      const u = (i + 0.35) / nodes;
      const position = base.clone().lerp(tip, u);
      const radialCount = detail === 'high' ? 4 : 3;

      for (let j = 0; j < radialCount; j++) {
        const angle = i * 2.39996 + j / radialCount * Math.PI * 2;
        const radial = frame.side.clone().multiplyScalar(Math.cos(angle))
          .add(frame.normal.clone().multiplyScalar(Math.sin(angle)));

        const direction = frame.tangent.clone().multiplyScalar(0.58 + u * 0.24)
          .add(radial.multiplyScalar(0.92))
          .add(new THREE.Vector3(0, 0.16 + stiffness * 0.20, 0))
          .normalize();

        const needleLength = H * (0.0105 + u * 0.004) * needleScale;
        const geo = createNeedlePrimitive(
          species, detail, p, C, random,
          needleLength, needleLength * 0.095
        );
        addPrimitive(
          parts, geo, position, direction, angle,
          `${label}_quadNeedle_${i + 1}_${j + 1}`,
          [1, 1, 1], colorFallback
        );
      }

      if (detail === 'high' && i % 3 === 0) {
        const pegPosition = position.clone().add(
          frame.normal.clone().multiplyScalar(H * 0.0013)
        );
        addWire(
          microParts,
          [position.x, position.y, position.z],
          [pegPosition.x, pegPosition.y, pegPosition.z],
          C.upperBark,
          H * 0.00055,
          4,
          `${label}_sterigma_${i + 1}`
        );
      }

      if (detail === 'high' && i === Math.floor(nodes * 0.62) && random() < 0.34) {
        const resinPosition = position.clone().add(
          frame.side.clone().multiplyScalar(H * 0.002)
        );
        addBlob(
          microParts, H * 0.0018, 0,
          resinPosition.x, resinPosition.y, resinPosition.z,
          C.resin, 1.2, 1.8, 1.2,
          `${label}_resin_duct_hint`
        );
      }
    }
  } else if (species === 'pine') {
    const nodes = Math.max(2, Math.round((2 + density * 3.5) * detailFactor));
    for (let i = 0; i < nodes; i++) {
      const u = (i + 0.55) / (nodes + 0.15);
      const position = base.clone().lerp(tip, u);
      const alternating = i % 2 === 0 ? 1 : -1;
      const droop = (1 - stiffness) * 0.72 + p.branchDroop * 0.25;

      const direction = frame.tangent.clone().multiplyScalar(0.48)
        .add(frame.side.clone().multiplyScalar(alternating * 0.38))
        .add(new THREE.Vector3(0, -droop, 0))
        .normalize();

      const needleLength = H * (0.025 + random() * 0.008) * needleScale;
      const geo = createNeedlePrimitive(
        species, detail, p, C, random,
        needleLength, needleLength * 0.026
      );
      addPrimitive(
        parts, geo, position, direction,
        random() * Math.PI * 2,
        `${label}_bundleNeedle_${i + 1}`,
        [1, 1, 1], colorFallback
      );

      if (detail === 'high') {
        const sheathHeight = needleLength * 0.12;
        const sheath = new THREE.CylinderGeometry(
          needleLength * 0.026,
          needleLength * 0.038,
          sheathHeight,
          5
        );
        transformed(sheath, position, direction);
        microParts.push({
          g: sheath,
          c: C.barkDark,
          name: `${label}_fascicle_sheath_${i + 1}`
        });
      }
    }

    if (
      detail === 'high' &&
      outer > 0.70 &&
      random() < p.coneDensity * 0.34
    ) {
      const count = 2 + Math.floor(random() * 3);
      for (let i = 0; i < count; i++) {
        const position = tip.clone()
          .add(frame.side.clone().multiplyScalar((i - (count - 1) / 2) * H * 0.004))
          .add(new THREE.Vector3(0, H * 0.004, 0));
        const geo = new THREE.CylinderGeometry(
          H * 0.006, H * 0.008, H * 0.025, 6
        );
        transformed(geo, position, frame.tangent.clone().add(new THREE.Vector3(0, 0.25, 0)));
        pollenParts.push({
          g: geo,
          c: C.pollen,
          name: `${label}_pine_pollen_cone_${i + 1}`
        });
      }
    }
  } else if (species === 'fir') {
    const pairs = Math.max(3, Math.round((3 + density * 5) * detailFactor));
    for (let i = 0; i < pairs; i++) {
      const u = (i + 0.35) / pairs;
      const position = base.clone().lerp(tip, u);
      const needleLength = H * (0.014 + random() * 0.004) * needleScale;

      for (const sign of [-1, 1]) {
        const direction = frame.side.clone().multiplyScalar(sign * 0.96)
          .add(frame.tangent.clone().multiplyScalar(0.22 + u * 0.12))
          .add(new THREE.Vector3(0, 0.08 + stiffness * 0.12, 0))
          .normalize();

        const geo = createNeedlePrimitive(
          species, detail, p, C, random,
          needleLength, needleLength * 0.16
        );
        addPrimitive(
          parts, geo, position, direction,
          sign < 0 ? Math.PI : 0,
          `${label}_flatNeedle_${i + 1}_${sign < 0 ? 'left' : 'right'}`,
          [1, 1, 1], colorFallback
        );
      }

      if (detail === 'high' && i % 4 === 1) {
        const scarPosition = position.clone().add(
          frame.normal.clone().multiplyScalar(H * 0.0012)
        );
        const scar = new THREE.TorusGeometry(H * 0.0015, H * 0.00042, 3, 6);
        transformed(scar, scarPosition, frame.normal);
        microParts.push({
          g: scar,
          c: C.upperBark,
          name: `${label}_fir_leaf_scar_${i + 1}`
        });
      }
    }
  } else if (species === 'cedar') {
    const spineCount = detail === 'high' ? 3 : 2;
    for (let spineIndex = 0; spineIndex < spineCount; spineIndex++) {
      const sideOffset = (spineIndex - (spineCount - 1) / 2) * length * 0.16;
      const spineBase = base.clone().add(frame.side.clone().multiplyScalar(sideOffset * 0.35));
      const spineTip = tip.clone().add(frame.side.clone().multiplyScalar(sideOffset));
      const scaleNodes = Math.max(4, Math.round((4 + density * 6) * detailFactor));

      for (let i = 0; i < scaleNodes; i++) {
        const u = (i + 0.22) / scaleNodes;
        const position = spineBase.clone().lerp(spineTip, u);
        const decussate = (i + spineIndex) % 2;
        const lateral = decussate
          ? frame.normal.clone()
          : frame.side.clone();
        const sign = i % 4 < 2 ? 1 : -1;

        const direction = frame.tangent.clone().multiplyScalar(0.88)
          .add(lateral.multiplyScalar(sign * 0.28))
          .add(new THREE.Vector3(0, 0.04, 0))
          .normalize();

        const scaleLength = H * (0.0068 + u * 0.0018) * needleScale;
        const geo = createNeedlePrimitive(
          species, detail, p, C, random,
          scaleLength, scaleLength * 0.40
        );
        addPrimitive(
          parts, geo, position, direction,
          decussate ? Math.PI * 0.5 : 0,
          `${label}_scaleLeaf_${spineIndex + 1}_${i + 1}`,
          [1, 1, 1], colorFallback
        );

        if (detail === 'high' && i > scaleNodes * 0.45 && i % 4 === 0) {
          const sacPosition = position.clone()
            .add(frame.normal.clone().multiplyScalar(-H * 0.002));
          addBlob(
            pollenParts, H * 0.0018, 0,
            sacPosition.x, sacPosition.y, sacPosition.z,
            C.pollen, 1, 1.35, 1,
            `${label}_cedar_pollen_sac_${spineIndex + 1}_${i + 1}`
          );
        }
      }

      if (detail === 'high') {
        const nodePosition = spineBase.clone().lerp(spineTip, 0.42);
        addBlob(
          microParts, H * 0.0022, 0,
          nodePosition.x, nodePosition.y, nodePosition.z,
          C.upperBark, 1.4, 0.55, 1.1,
          `${label}_cedar_articulation_${spineIndex + 1}`
        );
      }
    }
  } else {
    const clusterCount = Math.max(3, Math.round(3 + density * 3));
    const anchor = tip.clone().lerp(base, 0.12);

    for (let i = 0; i < clusterCount; i++) {
      const angle = i / clusterCount * Math.PI * 2;
      const radial = frame.side.clone().multiplyScalar(Math.cos(angle))
        .add(frame.normal.clone().multiplyScalar(Math.sin(angle)));

      const position = anchor.clone().add(radial.clone().multiplyScalar(H * 0.004));
      const direction = frame.tangent.clone().multiplyScalar(0.62)
        .add(radial.multiplyScalar(0.72))
        .add(new THREE.Vector3(0, 0.16, 0))
        .normalize();

      const needleLength = H * (0.027 + random() * 0.009) * needleScale;
      const geo = createNeedlePrimitive(
        species, detail, p, C, random,
        needleLength, needleLength * 0.21
      );
      addPrimitive(
        parts, geo, position, direction, angle,
        `${label}_heroNeedle_${i + 1}`,
        [1, 1, 1], colorFallback
      );

      if (detail === 'high' && i % 2 === 0) {
        const particle = position.clone().add(direction.clone().multiplyScalar(needleLength));
        addBlob(
          microParts, H * 0.0022, 0,
          particle.x, particle.y, particle.z,
          C.needleTip, 1, 1, 1,
          `${label}_magical_tip_particle_${i + 1}`
        );
      }
    }
  }
}

function collectLists(...lists) {
  return lists.flatMap((list) => list);
}

function addSemanticGroup(parent, name, animatedName, list) {
  const detachable = new THREE.Group();
  detachable.name = name;

  const animated = new THREE.Group();
  animated.name = animatedName;

  const mesh = finish(list, MAT, `${animatedName}_geometry`, false);
  if (mesh) animated.add(mesh);

  detachable.add(animated);
  parent.add(detachable);
  return detachable;
}

export function createAsset(userParams = {}) {
  const p = {};
  for (const key of Object.keys(params)) p[key] = params[key].default;
  Object.assign(p, userParams);

  p.treeHeight = clamp(Number(p.treeHeight), 3.5, 20);
  p.canopyWidth = clamp(Number(p.canopyWidth), 1.8, 11);
  p.branchDroop = clamp(Number(p.branchDroop), 0, 1);
  p.foliageDensity = clamp(Number(p.foliageDensity), 0.18, 1);
  p.trunkLeanAndTwist = clamp(Number(p.trunkLeanAndTwist), 0, 1);
  p.needleLengthScale = clamp(Number(p.needleLengthScale), 0.5, 1.8);
  p.needleStiffness = clamp(Number(p.needleStiffness), 0, 1);
  p.coneDensity = clamp(Number(p.coneDensity), 0, 1);

  const explicitOverrides = {};
  for (const key of ZONE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(userParams, key)) {
      explicitOverrides[key] = userParams[key];
    }
  }

  if (p.needleHueAndSeason !== 'colorway' && SEASON[p.needleHueAndSeason]) {
    Object.assign(explicitOverrides, SEASON[p.needleHueAndSeason]);
  }

  const C = zonesFor(p.colorway, explicitOverrides);
  const profile = PROFILE[p.speciesProfile] || PROFILE.spruce;
  const random = mulberry32(Math.floor(Number(p.seed)) || 731);

  const H = p.treeHeight;
  const W = Math.min(p.canopyWidth, H * 0.86);
  const trunkBaseRadius = clamp(H * 0.035, 0.16, 0.55);
  const groundRadius = Math.max(trunkBaseRadius * 3.4, W * 0.18);

  const rootParts = [];
  const groundParts = [];
  const trunkParts = [];
  const barkDetailParts = [];
  const coneParts = [];
  const pollenParts = [];
  const leaderWoodParts = [];
  const leaderFoliageParts = [];
  const foliageParts = [];
  const foliageMicroParts = [];
  const fallingParts = [];
  const whorlBranchLists = Array.from({ length: profile.tiers }, () => []);

  // Single source of truth for the trunk: one smooth spline axis plus one
  // continuous radius profile. Trunk geometry, roots, bark details, branch
  // attachment points and the crown all sample these same functions, so every
  // attachment lands exactly on the contoured swept surface.
  const lean = p.trunkLeanAndTwist;
  const axisControls = [];
  const AXIS_CONTROLS = 9;

  for (let i = 0; i < AXIS_CONTROLS; i++) {
    const t = i / (AXIS_CONTROLS - 1);
    const leaderDrift = t > 0.82 ? (t - 0.82) / 0.18 : 0;
    axisControls.push(new THREE.Vector3(
      H * lean * (0.038 * t * t + 0.009 * Math.sin(t * 8.1) + 0.018 * leaderDrift),
      H * t,
      H * lean * (0.018 * Math.sin(t * 4.4 + 0.7) + 0.013 * t - 0.012 * leaderDrift)
    ));
  }

  const trunkCurve = new THREE.CatmullRomCurve3(
    axisControls, false, 'catmullrom', 0.5
  );

  const centerAt = (y) => {
    const t = clamp(y / H, 0, 1);
    const point = trunkCurve.getPoint(t);
    point.y = y;
    return point;
  };

  const trunkRadiusAt = (t) => {
    const tc = clamp(t, 0, 1);
    let r = trunkBaseRadius * Math.pow(1 - tc * 0.98, 0.72);
    const flare = p.rootBaseVisible ? 0.45 : 0.16;
    if (tc < 0.12) {
      const f = 1 - tc / 0.12;
      r += trunkBaseRadius * flare * f * f;
    }
    r *= 1 + Math.sin(tc * 29 + Number(p.seed)) * 0.025;
    return Math.max(H * 0.0016, r);
  };

  const trunkRadiusAtY = (y) => trunkRadiusAt(clamp(y / H, 0, 1));

  if (p.groundDebrisVisible) {
    groundParts.push({
      g: irregularIsland(groundRadius, 0.055, 15, random),
      c: C.soil,
      name: 'irregular_soil_island'
    });

    const mossCount = 5 + Math.round(p.foliageDensity * 5);
    for (let i = 0; i < mossCount; i++) {
      const angle = random() * Math.PI * 2;
      const radius = groundRadius * (0.18 + random() * 0.66);
      const patchRadius = groundRadius * (0.08 + random() * 0.09);
      addBlob(
        groundParts, patchRadius, 0,
        Math.cos(angle) * radius,
        0.065 + random() * 0.025,
        Math.sin(angle) * radius,
        C.moss,
        1.45, 0.17, 0.86 + random() * 0.6,
        `moss_patch_${i + 1}`
      );
    }

    const stoneCount = 4 + Math.floor(random() * 4);
    for (let i = 0; i < stoneCount; i++) {
      const angle = random() * Math.PI * 2;
      const radius = groundRadius * (0.48 + random() * 0.48);
      const stoneRadius = groundRadius * (0.035 + random() * 0.04);
      addBlob(
        groundParts, stoneRadius, 0,
        Math.cos(angle) * radius,
        stoneRadius * 0.35,
        Math.sin(angle) * radius,
        C.stone,
        1.1 + random() * 0.9,
        0.45 + random() * 0.4,
        0.85 + random() * 0.7,
        `forest_stone_${i + 1}`
      );
    }

    const fallenCount = 12 + Math.round(p.foliageDensity * 12);
    for (let i = 0; i < fallenCount; i++) {
      const angle = random() * Math.PI * 2;
      const radius = groundRadius * (0.25 + random() * 0.72);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const length = 0.13 + random() * 0.22;
      const heading = random() * Math.PI * 2;
      addWire(
        groundParts,
        [x, 0.078, z],
        [x + Math.cos(heading) * length, 0.08, z + Math.sin(heading) * length],
        C.dryNeedle,
        0.0055,
        4,
        `fallen_needle_${i + 1}`
      );
    }

    for (let i = 0; i < 4; i++) {
      const angle = random() * Math.PI * 2;
      const radius = groundRadius * (0.38 + random() * 0.48);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const length = 0.22 + random() * 0.34;
      const heading = angle + (random() - 0.5) * 1.8;
      addWire(
        groundParts,
        [x, 0.09, z],
        [x + Math.cos(heading) * length, 0.10, z + Math.sin(heading) * length],
        C.branch,
        0.012,
        5,
        `fallen_twig_${i + 1}`
      );
    }
  }

  if (p.rootBaseVisible) {
    const rootCount = 5 + Math.floor(random() * 2);
    for (let i = 0; i < rootCount; i++) {
      const angle = i / rootCount * Math.PI * 2 + (random() - 0.5) * 0.35;
      const length = groundRadius * (0.60 + random() * 0.34);
      const side = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

      const footRadius = trunkRadiusAtY(0.13);
      const points = [
        side.clone().multiplyScalar(footRadius * 0.45)
          .add(centerAt(0.13)).setY(0.13),
        side.clone().multiplyScalar(length * 0.42).setY(0.10),
        side.clone().multiplyScalar(length).setY(0.035)
      ];

      points[1].x += (random() - 0.5) * length * 0.16;
      points[1].z += (random() - 0.5) * length * 0.16;

      addPath(
        rootParts,
        points,
        [
          trunkBaseRadius * (0.45 + random() * 0.14),
          trunkBaseRadius * 0.20,
          trunkBaseRadius * 0.035
        ],
        i % 3 === 0 ? C.upperBark : C.bark,
        6,
        `surface_root_${i + 1}`
      );

      if (i % 2 === 0) {
        addBlob(
          rootParts, trunkBaseRadius * 0.11, 0,
          points[1].x,
          points[1].y + trunkBaseRadius * 0.06,
          points[1].z,
          C.moss,
          1.8, 0.28, 1,
          `root_moss_${i + 1}`
        );
      }
    }
  }

  // One unified swept extrusion: base flare through the crown leader tip.
  const trunkPoints = [];
  const trunkRadii = [];
  const trunkColors = [];
  const trunkRings = 32;
  const lowerBark = new THREE.Color(C.bark);
  const upperBark = new THREE.Color(C.upperBark);

  for (let i = 0; i <= trunkRings; i++) {
    const u = i / trunkRings;
    // Eased station distribution: dense at the flare and again at the leader.
    const t = clamp(u * u * 0.32 + u * 0.68, 0, 1);

    trunkPoints.push(centerAt(H * t));
    trunkRadii.push(trunkRadiusAt(t));

    const mix = clamp((t - 0.28) / 0.72, 0, 1);
    trunkColors.push(
      lowerBark.clone().lerp(upperBark, mix * mix * (3 - 2 * mix)).getHex()
    );
  }

  trunkParts.push({
    g: sweptTube(trunkPoints, trunkRadii, 9, trunkColors),
    c: C.bark, // fallback
    name: 'swept_continuous_trunk'
  });

  const ridgeCount = 14 + Math.round(H * 0.65);
  for (let i = 0; i < ridgeCount; i++) {
    const t = 0.07 + random() * 0.72;
    const y = H * t;
    const center = centerAt(y);
    const radius = trunkRadiusAtY(y);
    const angle = random() * Math.PI * 2;
    const length = H * (0.035 + random() * 0.07);
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const start = center.clone().add(radial.clone().multiplyScalar(radius * 0.97));
    const endY = Math.min(H * 0.9, y + length);
    const endCenter = centerAt(endY);
    const end = endCenter.clone().add(
      radial.multiplyScalar(trunkRadiusAtY(endY) * 0.93)
    );

    addWire(
      barkDetailParts,
      [start.x, start.y, start.z],
      [end.x, end.y, end.z],
      i % 4 === 0 ? C.barkDark : C.upperBark,
      radius * (0.022 + random() * 0.022),
      4,
      `bark_ridge_${i + 1}`
    );
  }

  const knotCount = 5 + Math.floor(H / 4);
  for (let i = 0; i < knotCount; i++) {
    const t = 0.13 + random() * 0.62;
    const center = centerAt(H * t);
    const radius = trunkRadiusAt(t);
    const angle = random() * Math.PI * 2;
    const radial = new THREE.Vector3(Math.cos(angle), 0.12, Math.sin(angle)).normalize();
    const start = center.clone().add(radial.clone().multiplyScalar(radius * 0.8));
    const end = center.clone().add(
      radial.clone().multiplyScalar(radius * (1.35 + random() * 0.75))
    );

    addWire(
      barkDetailParts,
      [start.x, start.y, start.z],
      [end.x, end.y, end.z],
      C.barkDark,
      radius * (0.16 + random() * 0.08),
      6,
      `broken_branch_stub_${i + 1}`
    );

    const knot = new THREE.TorusGeometry(radius * 0.21, radius * 0.055, 4, 8);
    transformed(
      knot,
      start.clone().add(radial.clone().multiplyScalar(radius * 0.21)),
      radial
    );
    barkDetailParts.push({
      g: knot,
      c: C.upperBark,
      name: `bark_knot_${i + 1}`
    });
  }

  for (let tier = 0; tier < profile.tiers; tier++) {
    const tierT = tier / Math.max(1, profile.tiers - 1);
    let normalizedHeight = lerp(profile.base, profile.top, tierT);
    normalizedHeight +=
      (random() - 0.5) *
      (profile.top - profile.base) /
      profile.tiers *
      (p.speciesProfile === 'pine' ? 0.55 : 0.22);

    const tierY = H * normalizedHeight;
    const silhouette = Math.pow(1 - tierT, profile.crownPower);
    const shoulder = p.speciesProfile === 'cedar'
      ? 0.84 + Math.sin(tierT * Math.PI) * 0.19
      : 0.93 + Math.sin(tierT * Math.PI) * 0.08;

    const tierRadius =
      W * 0.5 *
      profile.width *
      silhouette *
      shoulder *
      (0.84 + random() * 0.22);

    const branchCount = Math.max(
      3,
      Math.round(lerp(profile.branches[0], profile.branches[1], p.foliageDensity) - tierT)
    );

    const tierRotation =
      random() * Math.PI * 2 +
      tier * (1.68 + p.trunkLeanAndTwist * 0.48);

    for (let branchIndex = 0; branchIndex < branchCount; branchIndex++) {
      if (random() > profile.openness + p.foliageDensity * 0.10) continue;

      const angle =
        tierRotation +
        branchIndex / branchCount * Math.PI * 2 +
        (random() - 0.5) * 0.38;

      const radialDirection = new THREE.Vector3(
        Math.cos(angle), 0, Math.sin(angle)
      );

      const asymmetry =
        0.76 + random() * 0.31 +
        Math.sin(angle * 2.3 + Number(p.seed)) * 0.07;

      const branchLength = Math.max(H * 0.055, tierRadius * asymmetry);
      const droop =
        p.branchDroop *
        profile.droop *
        branchLength *
        (0.12 + 0.23 * (1 - tierT));

      // Break the perfectly planar whorl: a deterministic helical wave plus a
      // seeded random offset lifts or drops each branch origin independently.
      const whorlWave =
        Math.sin(angle * 1.7 + tier * 2.13 + Number(p.seed) * 0.017) *
        H * 0.017;
      const verticalJitter =
        whorlWave +
        (random() - 0.5) * H * 0.032 * (0.65 + p.trunkLeanAndTwist * 0.7);

      const branchY = clamp(
        tierY + verticalJitter,
        H * profile.base * 0.6,
        H * 0.955
      );
      const branchCenter = centerAt(branchY);

      // Sample the real swept-trunk radius so the base is embedded in the bark.
      const trunkRadiusAtBranch = trunkRadiusAtY(branchY);

      const branchRadius = clamp(
        trunkRadiusAtBranch * (0.20 + branchLength / W * 0.15),
        0.018,
        trunkBaseRadius * 0.29
      );

      // Seat the branch start well inside the contoured surface so the swept
      // tube physically overlaps the trunk instead of merely touching it.
      const seatRadius = Math.max(
        trunkRadiusAtBranch * 0.15,
        trunkRadiusAtBranch * 0.72 - branchRadius * 1.15
      );

      const start = branchCenter.clone().add(
        radialDirection.clone().multiplyScalar(seatRadius)
      );
      start.y += whorlWave * 0.18;

      const mid = branchCenter.clone()
        .add(radialDirection.clone().multiplyScalar(branchLength * 0.52))
        .add(new THREE.Vector3(
          Math.cos(angle + 1.3) * branchLength * 0.045,
          branchLength * (0.055 + random() * 0.06) - droop * 0.22,
          Math.sin(angle + 1.3) * branchLength * 0.045
        ));

      const branchTip = branchCenter.clone()
        .add(radialDirection.clone().multiplyScalar(branchLength))
        .add(new THREE.Vector3(
          Math.cos(angle + 0.75) * branchLength * (random() - 0.5) * 0.12,
          -droop,
          Math.sin(angle + 0.75) * branchLength * (random() - 0.5) * 0.12
        ));

      addPath(
        whorlBranchLists[tier],
        [start, mid, branchTip],
        [branchRadius, branchRadius * 0.58, branchRadius * 0.055],
        C.branch,
        6,
        `tier_${tier + 1}_primary_branch_${branchIndex + 1}`
      );

      const secondaryCount = Math.max(
        2,
        Math.round(
          (2 + p.foliageDensity * 3.1) *
          profile.branchlets *
          (0.90 + random() * 0.20)
        )
      );

      for (let secondaryIndex = 0; secondaryIndex < secondaryCount; secondaryIndex++) {
        const along = (secondaryIndex + 0.72) / (secondaryCount + 0.55);
        const oneMinus = 1 - along;

        const base = start.clone().multiplyScalar(oneMinus * oneMinus)
          .add(mid.clone().multiplyScalar(2 * oneMinus * along))
          .add(branchTip.clone().multiplyScalar(along * along));

        const sideSign = secondaryIndex % 2 === 0 ? 1 : -1;
        const side = new THREE.Vector3(
          -radialDirection.z * sideSign,
          0,
          radialDirection.x * sideSign
        );

        const branchletLength =
          branchLength *
          (0.13 + random() * 0.12) *
          (1 - along * 0.26);

        const verticalBias = p.speciesProfile === 'fir'
          ? 0.08
          : p.speciesProfile === 'cedar'
            ? 0.14
            : 0.25 + tierT * 0.14;

        const branchletDirection = radialDirection.clone().multiplyScalar(0.30)
          .add(side.multiplyScalar(0.72))
          .add(new THREE.Vector3(0, verticalBias, 0))
          .normalize();

        const branchletTip = base.clone().add(
          branchletDirection.clone().multiplyScalar(branchletLength)
        );
        branchletTip.y -= droop * along * 0.10;

        addPath(
          whorlBranchLists[tier],
          [base, branchletTip],
          [branchRadius * 0.31, branchRadius * 0.055],
          C.branch,
          5,
          `tier_${tier + 1}_branchlet_${branchIndex + 1}_${secondaryIndex + 1}`
        );

        addSpeciesFoliage({
          species: p.speciesProfile,
          detail: p.needleDetailLevel,
          p,
          C,
          random,
          parts: foliageParts,
          microParts: foliageMicroParts,
          pollenParts,
          base,
          tip: branchletTip,
          primaryDirection: radialDirection,
          H,
          outer: along,
          label: `tier_${tier + 1}_${branchIndex + 1}_${secondaryIndex + 1}`
        });
      }

      const coneChance =
        p.coneDensity *
        (tierT < 0.74 ? 0.45 : 0.18) *
        (0.66 + p.foliageDensity * 0.34);

      if (random() < coneChance) {
        const conePosition = mid.clone().lerp(branchTip, 0.48 + random() * 0.34);
        const coneHeight = clamp(H * (0.025 + random() * 0.013), 0.12, 0.48);

        let coneDirection = new THREE.Vector3(
          (random() - 0.5) * 0.16,
          -1,
          (random() - 0.5) * 0.16
        );

        if (p.speciesProfile === 'fir' && tierT > 0.42) {
          coneDirection = new THREE.Vector3(
            (random() - 0.5) * 0.08,
            1,
            (random() - 0.5) * 0.08
          );
          conePosition.y += coneHeight * 0.48;
        } else {
          conePosition.y -= coneHeight * 0.48;
        }

        addCone(
          coneParts,
          conePosition,
          coneDirection,
          coneHeight * (p.speciesProfile === 'fir' ? 0.34 : 0.29),
          coneHeight,
          C.cone,
          p.speciesProfile === 'fir'
            ? `erect_fir_cone_${tier + 1}_${branchIndex + 1}`
            : `hanging_cone_${tier + 1}_${branchIndex + 1}`
        );
      }
    }
  }

  const leaderTip = centerAt(H);
  leaderTip.x += H * p.trunkLeanAndTwist * 0.018;
  leaderTip.z -= H * p.trunkLeanAndTwist * 0.012;

  // The crown leader stem is now perfectly integrated into the main trunk, so we only need crown branches here
  const crownBranchCount = p.speciesProfile === 'stylized' ? 5 : 7;
  for (let i = 0; i < crownBranchCount; i++) {
    const angle = i / crownBranchCount * Math.PI * 2 + random() * 0.4;
    const base = centerAt(H * (0.87 + random() * 0.06));
    const radialLength = H * (0.035 + random() * 0.025);
    const crownTip = base.clone().add(new THREE.Vector3(
      Math.cos(angle) * radialLength,
      H * (0.035 + random() * 0.025),
      Math.sin(angle) * radialLength
    ));

    addPath(
      leaderWoodParts,
      [base, crownTip],
      [trunkBaseRadius * 0.065, trunkBaseRadius * 0.012],
      C.branch,
      5,
      `crown_branch_${i + 1}`
    );

    addSpeciesFoliage({
      species: p.speciesProfile,
      detail: p.needleDetailLevel,
      p,
      C,
      random,
      parts: leaderFoliageParts,
      microParts: foliageMicroParts,
      pollenParts,
      base,
      tip: crownTip,
      primaryDirection: crownTip.clone().sub(base).normalize(),
      H,
      outer: 1,
      label: `crown_${i + 1}`
    });
  }

  const terminalLength =
    H *
    (p.speciesProfile === 'pine' ? 0.045 : 0.032) *
    p.needleLengthScale;

  const terminalGeo = createNeedlePrimitive(
    p.speciesProfile,
    p.needleDetailLevel,
    p,
    C,
    random,
    terminalLength,
    terminalLength * (p.speciesProfile === 'stylized' ? 0.20 : 0.10)
  );

  addPrimitive(
    leaderFoliageParts,
    terminalGeo,
    leaderTip,
    new THREE.Vector3(
      p.trunkLeanAndTwist * 0.05,
      1,
      -p.trunkLeanAndTwist * 0.03
    ).normalize(),
    0,
    'top_leader_fresh_shoot',
    [1, 1, 1],
    C.needleTip
  );

  if (p.fallingNeedlesVisible) {
    const fallingCount = 9 + Math.round(p.foliageDensity * 9);
    for (let i = 0; i < fallingCount; i++) {
      const angle = random() * Math.PI * 2;
      const radius = W * (0.12 + random() * 0.48);
      const y = H * (0.18 + random() * 0.60);
      const length = H * (0.009 + random() * 0.007);
      const center = centerAt(y);

      const start = new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        y,
        center.z + Math.sin(angle) * radius
      );

      const end = start.clone().add(new THREE.Vector3(
        Math.cos(angle + 1.1) * length * 0.35,
        -length,
        Math.sin(angle + 1.1) * length * 0.35
      ));

      addWire(
        fallingParts,
        [start.x, start.y, start.z],
        [end.x, end.y, end.z],
        i % 3 === 0 ? C.needleTip : C.dryNeedle,
        H * 0.00055,
        4,
        `falling_needle_${i + 1}`
      );
    }
  }

  const asset = new THREE.Group();
  asset.name = 'parametricConifer';

  const allGeometry = collectLists(
    rootParts,
    groundParts,
    trunkParts,
    barkDetailParts,
    ...whorlBranchLists,
    foliageParts,
    foliageMicroParts,
    coneParts,
    pollenParts,
    leaderWoodParts,
    leaderFoliageParts,
    fallingParts
  );

  let triangleCount = 0;
  for (const part of allGeometry) {
    const positionCount = part.g.getAttribute('position')?.count || 0;
    triangleCount += part.g.index
      ? part.g.index.count / 3
      : positionCount / 3;
  }

  if (p.mergeForProduction) {
    const solid = finish(allGeometry, MAT, 'parametricConifer_solid', true);
    if (solid) asset.add(solid);
  } else {
    const rootBase = new THREE.Group();
    rootBase.name = 'rootBase';
    const rootMesh = finish(rootParts, MAT, 'rootBase_geometry', false);
    if (rootMesh) rootBase.add(rootMesh);
    asset.add(rootBase);

    const ground = new THREE.Group();
    ground.name = 'mossAndGroundDebris';
    const groundMesh = finish(groundParts, MAT, 'forestFloor_geometry', false);
    if (groundMesh) ground.add(groundMesh);
    asset.add(ground);

    const trunk = new THREE.Group();
    trunk.name = 'trunk';
    const trunkMesh = finish(trunkParts, MAT, 'trunk_geometry', false);
    const barkMesh = finish(barkDetailParts, MAT, 'barkDetails', false);
    if (trunkMesh) trunk.add(trunkMesh);
    if (barkMesh) trunk.add(barkMesh);
    asset.add(trunk);

    const wholeCanopy = new THREE.Group();
    wholeCanopy.name = 'wholeCanopy';

    const primaryWhorls = new THREE.Group();
    primaryWhorls.name = 'primaryBranchWhorls';

    for (let i = 0; i < whorlBranchLists.length; i++) {
      const whorl = new THREE.Group();
      whorl.name = `primaryBranchWhorl_${i + 1}`;
      const mesh = finish(
        whorlBranchLists[i],
        MAT,
        `primaryBranchWhorl_${i + 1}_geometry`,
        false
      );
      if (mesh) whorl.add(mesh);
      primaryWhorls.add(whorl);
    }

    wholeCanopy.add(primaryWhorls);

    const speciesGroupNames = {
      spruce: ['spruce_needleCloud', 'spruceNeedles'],
      pine: ['pine_fascicles', 'pineNeedles'],
      fir: ['fir_flatSprays', 'firNeedles'],
      cedar: ['cedar_scaleSprays', 'cedarSprays'],
      stylized: ['stylized_tufts', 'stylizedTufts']
    };

    const activeNames = speciesGroupNames[p.speciesProfile] || speciesGroupNames.spruce;
    const activeFoliage = new THREE.Group();
    activeFoliage.name = activeNames[0];

    const animatedFoliage = new THREE.Group();
    animatedFoliage.name = activeNames[1];

    const foliageMesh = finish(
      foliageParts,
      MAT,
      `${activeNames[1]}_geometry`,
      false
    );
    const microMesh = finish(
      foliageMicroParts,
      MAT,
      `${activeNames[1]}_microDetails`,
      false
    );

    if (foliageMesh) animatedFoliage.add(foliageMesh);
    if (microMesh) animatedFoliage.add(microMesh);
    activeFoliage.add(animatedFoliage);
    wholeCanopy.add(activeFoliage);

    const topLeader = new THREE.Group();
    topLeader.name = 'topLeader';

    const leaderWoodMesh = finish(
      leaderWoodParts,
      MAT,
      'topLeader_wood',
      false
    );
    const leaderFoliageMesh = finish(
      leaderFoliageParts,
      MAT,
      'topLeader_foliage',
      false
    );

    if (leaderWoodMesh) topLeader.add(leaderWoodMesh);
    if (leaderFoliageMesh) topLeader.add(leaderFoliageMesh);
    wholeCanopy.add(topLeader);

    asset.add(wholeCanopy);

    const cones = new THREE.Group();
    cones.name = 'cones';
    const coneMesh = finish(coneParts, MAT, 'cones_geometry', false);
    if (coneMesh) cones.add(coneMesh);
    asset.add(cones);

    const pollenCones = new THREE.Group();
    pollenCones.name = 'pollenCones';
    const pollenMesh = finish(pollenParts, MAT, 'pollenCones_geometry', false);
    if (pollenMesh) pollenCones.add(pollenMesh);
    asset.add(pollenCones);

    const fallingNeedles = new THREE.Group();
    fallingNeedles.name = 'fallingNeedles';
    const fallingMesh = finish(
      fallingParts,
      MAT,
      'fallingNeedles_geometry',
      false
    );
    if (fallingMesh) fallingNeedles.add(fallingMesh);
    asset.add(fallingNeedles);
  }

  asset.userData.assetType = 'parametric-conifer';
  asset.userData.speciesProfile = p.speciesProfile;
  asset.userData.needlePrimitive = {
    spruce: 'quadNeedle',
    pine: 'bundleNeedle',
    fir: 'flatNeedle',
    cedar: 'scaleLeaf',
    stylized: 'heroNeedle'
  }[p.speciesProfile];
  asset.userData.needleDetailLevel = p.needleDetailLevel;
  asset.userData.estimatedTriangles = Math.round(triangleCount);
  asset.userData.dimensions = {
    width: Math.max(W, groundRadius * 2),
    height: H,
    depth: Math.max(W, groundRadius * 2),
    units: 'meters'
  };

  return asset;
}

export default createAsset;
