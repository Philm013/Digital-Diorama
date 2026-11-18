/**
 * TIDELINE / THE WRACK LINE. Procedural scene composition. License: MIT.
 * Imports independent asset files without modifying or coupling them.
 * QUICK START: import { createScene } from './scene.mjs'; createScene(scene);
 * Assets are authored in meters. This exhibition uses 10:1 magnification.
 * Anchor display coordinates: driftwood (-4, -3), queen conch (3, 4).
 * Deterministic seeded placement follows a sinusoidal high-water ridge.
 * Every specimen is rested on the sand using its own live bounding box, so
 * no asset ever floats or clips regardless of its live parameters. A simple
 * minimum-spacing check keeps the wrack line legible instead of crowding
 * specimens on top of one another. A self-contained ocean, sky, and distant
 * shoreline are included so the diorama reads as one immersive place.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createAsset as conch } from './gastropod-spiral.mjs';
import { createAsset as cowrie } from './gastropod-cowrie.mjs';
import { createAsset as auger } from './gastropod-auger.mjs';
import { createAsset as scallop } from './bivalve-scallop-cockle.mjs';
import { createAsset as oyster } from './bivalve-oyster-mussel.mjs';
import { createAsset as razor } from './bivalve-razor-clam.mjs';
import { createAsset as urchin } from './echinoderm-urchin-test.mjs';
import { createAsset as starfish } from './echinoderm-starfish.mjs';
import { createAsset as remnant } from './cephalopod-remnants.mjs';
import { createAsset as crab } from './crustacean-carapace.mjs';
import { createAsset as artifact } from './elasmobranch-artifacts.mjs';
import { createAsset as flora } from './marine-flora-sponges.mjs';
import { createAsset as glass } from './beach-glass-and-pottery.mjs';
import { createAsset as driftwood } from './nautical-debris.mjs';

const factories = { 'gastropod-spiral': conch, 'gastropod-cowrie': cowrie, 'gastropod-auger': auger, 'bivalve-scallop-cockle': scallop, 'bivalve-oyster-mussel': oyster, 'bivalve-razor-clam': razor, 'echinoderm-urchin-test': urchin, 'echinoderm-starfish': starfish, 'cephalopod-remnants': remnant, 'crustacean-carapace': crab, 'elasmobranch-artifacts': artifact, 'marine-flora-sponges': flora, 'beach-glass-and-pottery': glass, 'nautical-debris': driftwood };
// Approximate footprint radii (meters) used only for spacing decisions, not rendering.
const FOOTPRINT = { 'gastropod-spiral': 0.16, 'gastropod-cowrie': 0.06, 'gastropod-auger': 0.05, 'bivalve-scallop-cockle': 0.11, 'bivalve-oyster-mussel': 0.09, 'bivalve-razor-clam': 0.09, 'echinoderm-urchin-test': 0.1, 'echinoderm-starfish': 0.14, 'cephalopod-remnants': 0.1, 'crustacean-carapace': 0.14, 'elasmobranch-artifacts': 0.05, 'marine-flora-sponges': 0.13, 'beach-glass-and-pottery': 0.035, 'nautical-debris': 0.42 };

export function createScene(scene, options = {}) {
  const { colorway = 'default', paramsByAsset = {}, selectedId = '', hiddenAssets = [], hiddenParts = {}, density = 1, wetness = 0.45, seed = 42, magnification = 10, editable = false, editAll = false, additionalAssets = [] } = options;
  const root = new THREE.Group(); root.name = 'tideline'; root.scale.setScalar(magnification);
  let randomState = seed >>> 0;
  const random = () => { randomState = (randomState * 1664525 + 1013904223) >>> 0; return randomState / 4294967296; };

  // The wrack line follows a gentle S-curve; the sand pad is generously sized
  // (padRadius) so the composition has real breathing room around its edges.
  const padRadius = 1.05;
  const ridge = z => Math.sin(z * 4.2 + 0.65) * 0.28;
  const sandHeight = (x, z) => {
    const r = Math.min(1, Math.hypot(x, z) / padRadius);
    return 0.0035 * Math.exp(-Math.pow((x - ridge(z)) / 0.34, 2)) + Math.sin(z * 90 + Math.sin(x * 13)) * 0.0006 * (1 - r) - Math.pow(r, 16) * 0.03;
  };

  const counts = {}, instances = [], placedFootprints = [], hidden = new Set(hiddenAssets);
  const coastalMaterials = new Map();
  const coastalMaterial = source => {
    if (coastalMaterials.has(source)) return coastalMaterials.get(source);
    const material = source.clone();
    if (material.emissive && colorway === 'bioluminescent') { material.emissive.set('#715c9c'); material.emissiveIntensity = 0.15; }
    // World-height shading keeps the original, collision-free zone colors intact.
    material.onBeforeCompile = shader => {
      shader.uniforms.tidelineWetness = { value: wetness };
      shader.uniforms.tidelineScale = { value: magnification };
      shader.vertexShader = 'varying float vTidelineHeight;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTidelineHeight = (modelMatrix * vec4(transformed, 1.0)).y;');
      shader.fragmentShader = 'varying float vTidelineHeight;\nuniform float tidelineWetness;\nuniform float tidelineScale;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat tideWetMask = (1.0 - smoothstep(0.006 * tidelineScale, 0.032 * tidelineScale, vTidelineHeight)) * tidelineWetness;\ndiffuseColor.rgb *= mix(1.0, 0.67, tideWetMask);');
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.18, tideWetMask);');
    };
    material.customProgramCacheKey = () => 'tideline-height-wetness-v1';
    coastalMaterials.set(source, material); return material;
  };

  // Rejection-sampled spacing keeps the wrack line legible: a candidate spot
  // is nudged away from anything already placed instead of stacking on it.
  const keepClear = (x, z, radius) => {
    for (const other of placedFootprints) {
      const minDist = (radius + other.r) * 0.86;
      const dx = x - other.x, dz = z - other.z, dist = Math.hypot(dx, dz);
      if (dist < minDist && dist > 1e-5) { const push = (minDist - dist); x += (dx / dist) * push; z += (dz / dist) * push; }
    }
    return [x, z];
  };

  const place = (id, x, z, rotation = 0, variation = {}, burial = 0.1, tilt = 0, skipSpacing = false) => {
    const index = counts[id] || 0; counts[id] = index + 1;
    const production = !(editable && (!selectedId || selectedId === id) && (index === 0 || editAll) && !paramsByAsset[id]?.mergeForProduction);
    const settings = { colorway, ...variation, ...paramsByAsset[id], mergeForProduction: production && !(hiddenParts[id]?.length) };
    const asset = factories[id](settings);
    asset.rotation.set(tilt, rotation, 0);
    asset.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(asset);
    const footprint = Math.max((box.max.x - box.min.x), (box.max.z - box.min.z)) * 0.5 || FOOTPRINT[id] || 0.08;
    let px = x, pz = z;
    if (!skipSpacing) { [px, pz] = keepClear(x, z, footprint); placedFootprints.push({ x: px, z: pz, r: footprint }); }
    const groundY = sandHeight(px, pz);
    const sinkable = Math.max(0, box.max.y - box.min.y);
    asset.position.set(px, groundY - box.min.y - sinkable * burial, pz);
    asset.name = `${id}-${index + 1}`; asset.visible = !hidden.has(id);
    asset.traverse(object => { if (object.isMesh) object.material = Array.isArray(object.material) ? object.material.map(coastalMaterial) : coastalMaterial(object.material); });
    Object.assign(asset.userData, { assetId: id, instanceIndex: index, primary: index === 0 });
    for (const name of hiddenParts[id] || []) { const part = asset.getObjectByName(name); if (part) part.visible = false; }
    if (production && hiddenParts[id]?.length) {
      asset.updateMatrixWorld(true);
      const inverse = asset.matrixWorld.clone().invert(), batches = new Map(), originalGeometries = new Set();
      asset.traverse(object => { if (object.isMesh) originalGeometries.add(object.geometry); });
      const familyVisibility = asset.visible; asset.visible = true;
      asset.traverseVisible(object => {
        if (!object.isMesh) return;
        const geometry = object.geometry.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld));
        if (!batches.has(object.material)) batches.set(object.material, []);
        batches.get(object.material).push(geometry);
      });
      asset.clear();
      for (const [material, geometries] of batches) { const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose()); if (geometry) { const mesh = new THREE.Mesh(geometry, material); mesh.name = `production_${asset.children.length + 1}`; mesh.castShadow = mesh.receiveShadow = true; asset.add(mesh); } }
      originalGeometries.forEach(geometry => geometry.dispose());
      asset.visible = familyVisibility; asset.userData.params.mergeForProduction = true;
    }
    root.add(asset); instances.push(asset); return asset;
  };

  // The large specimens establish the ends of the S-shaped tideline, spaced
  // well apart so each silhouette reads clearly against open sand.
  place('nautical-debris', -0.58, -0.42, -0.34, {}, 0.16);
  place('gastropod-spiral', 0.46, 0.56, 2.12, {}, 0.1);
  place('bivalve-scallop-cockle', -0.24, 0.42, -0.9, { openingAngle: 10 }, 0.1);
  place('echinoderm-urchin-test', 0.46, 0.1, 0.4, {}, 0.16);
  place('echinoderm-starfish', -0.02, 0.09, 0.8, {}, 0.05);
  place('gastropod-cowrie', -0.02, -0.28, -0.65, {}, 0.1);
  place('gastropod-auger', 0.14, 0.36, -0.58, {}, 0.14);
  place('bivalve-oyster-mussel', -0.48, 0.05, -0.4, {}, 0.14);
  place('bivalve-razor-clam', -0.6, 0.4, -0.4, {}, 0.14);
  place('cephalopod-remnants', 0.5, -0.24, -0.5, {}, 0.08);
  place('crustacean-carapace', -0.1, -0.08, 0.8, {}, 0.05);
  place('elasmobranch-artifacts', -0.02, 0.68, 0.42, {}, 0.05);
  place('marine-flora-sponges', 0.08, -0.5, 0.8, {}, 0.02);
  place('beach-glass-and-pottery', -0.44, 0.26, 0.4, {}, 0.02);

  // Bed layers follow the waterline rather than a uniform random scatter.
  const bedCount = Math.round(9 * density);
  for (let i = 0; i < bedCount; i++) {
    const z = -0.66 + i / Math.max(1, bedCount - 1) * 1.36, x = ridge(z) + (random() - 0.5) * 0.34;
    place('marine-flora-sponges', x, z, random() * Math.PI * 2, { floraType: i === 1 ? 'fan' : i === 7 ? 'sponge' : 'kelp', branchingComplexity: i === 1 ? 3 : 2, frondCurl: 0.35 + random() * 0.5 }, 0.02);
  }
  place('bivalve-scallop-cockle', -0.36, -0.38, 2.1, { openingAngle: 28, ridgeCount: 22 }, 0.14, -0.27);
  place('bivalve-scallop-cockle', 0.18, -0.32, 2.75, { openingAngle: 7, shell: colorway === 'default' ? '#c7b1bf' : undefined }, 0.1);
  place('echinoderm-starfish', -0.42, 0.66, 1.8, { armThickness: 0.014 }, 0.03);
  place('echinoderm-starfish', 0.44, -0.54, 0.3, { armThickness: 0.018 }, 0.03);
  place('echinoderm-urchin-test', -0.05, 0.48, 1.2, { domeHeight: 0.009 }, 0.1);
  place('echinoderm-urchin-test', 0.23, -0.56, 0.2, { domeHeight: 0.032 }, 0.16);
  place('bivalve-oyster-mussel', 0.58, 0.38, 1.2, { elongation: 1.5, cragginess: 0.2, showPearl: false }, 0.12);
  place('cephalopod-remnants', -0.3, -0.04, -0.9, { remnantType: 'nautilus', chamberExposure: 0.65 }, 0.06);
  place('marine-flora-sponges', -0.6, 0.6, 0.4, { floraType: 'sponge', poreDensity: 24 }, 0.03);
  place('elasmobranch-artifacts', 0.33, -0.02, -0.65, { artifactType: 'purse' }, 0.02);
  const fillers = ['beach-glass-and-pottery', 'gastropod-auger', 'gastropod-cowrie', 'beach-glass-and-pottery', 'elasmobranch-artifacts', 'bivalve-scallop-cockle'];
  const fillerCount = Math.round(28 * density);
  for (let i = 0; i < fillerCount; i++) {
    const z = -0.75 + random() * 1.55, x = ridge(z) + (random() - 0.5) * 1.1, id = fillers[i % fillers.length];
    const variation = id === 'beach-glass-and-pottery' ? { shardSeed: 1 + i, materialType: i % 5 === 0 ? 'delft' : i % 7 === 0 ? 'terracotta' : 'glass' } : id === 'gastropod-auger' ? { taperLength: 0.13 + random() * 0.08, whorlCount: 7 } : id === 'bivalve-scallop-cockle' ? { ridgeCount: 13, cuppingDepth: 0.015, openingAngle: 5 } : {};
    const burial = id === 'beach-glass-and-pottery' ? 0.02 : id === 'gastropod-auger' ? 0.14 : 0.08;
    place(id, x, z, random() * Math.PI * 2, variation, burial);
  }
  additionalAssets.forEach((id, index) => { if (factories[id]) { const z = -0.5 + (index % 7) * 0.17; place(id, ridge(z) + (index % 2 ? -0.4 : 0.4), z, index * 2.4, {}, 0.08); } });

  const sandColors = { default: ['#e2d5bc', '#c6bba5', '#f0e7d3'], gothic: ['#77777a', '#55565c', '#bab6b2'], pacific: ['#b5b0a0', '#858b7e', '#d6cdbb'], bioluminescent: ['#6b617d', '#4c4965', '#a496b0'] };
  const oceanColors = { default: ['#8fbdb2', '#3f6d6c'], gothic: ['#6c7679', '#33393e'], pacific: ['#4f7c86', '#274453'], bioluminescent: ['#4f6f9e', '#241f4a'] };
  const skyColors = { default: ['#fdf1d6', '#bcd7db'], gothic: ['#cfd0c8', '#8f9498'], pacific: ['#e8dcc4', '#7c9aa6'], bioluminescent: ['#4a3c6b', '#0f0c26'] };
  const palette = sandColors[colorway] || sandColors.default;
  const ocean = oceanColors[colorway] || oceanColors.default;
  const sky = skyColors[colorway] || skyColors.default;

  const terrain = new THREE.Group(); terrain.name = 'shell-hash-sand';
  const vertices = [], colors = [], dry = new THREE.Color(palette[0]), damp = new THREE.Color(palette[1]), rows = 44, sides = 160;
  const point = (i, j) => { const r = i / rows, a = j / sides * Math.PI * 2, edge = padRadius * (0.94 + Math.sin(a * 3 + 0.8) * 0.03 + Math.sin(a * 7) * 0.012), x = Math.cos(a) * r * edge, z = Math.sin(a) * r * edge * 1.05; return [x, sandHeight(x, z), z]; };
  const add = v => { vertices.push(...v); const wet = Math.max(0, Math.min(0.7, (v[2] + 0.6) * wetness * 0.45)), color = dry.clone().lerp(damp, wet + random() * 0.035); colors.push(color.r, color.g, color.b); };
  for (let i = 0; i < rows; i++) for (let j = 0; j < sides; j++) { const a = point(i, j), b = point(i + 1, j), c = point(i + 1, j + 1), d = point(i, j + 1); [a, b, c, a, c, d].forEach(add); }
  const groundGeo = new THREE.BufferGeometry(); groundGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 - wetness * 0.34, metalness: wetness * 0.06, side: THREE.DoubleSide })); ground.name = 'sand'; ground.receiveShadow = true; terrain.add(ground);
  const grainGeo = new THREE.TetrahedronGeometry(0.00085), grainMat = new THREE.MeshStandardMaterial({ roughness: 0.86, color: palette[2] }), grains = new THREE.InstancedMesh(grainGeo, grainMat, 7000), matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
  for (let i = 0; i < 7000; i++) { const a = random() * Math.PI * 2, r = Math.sqrt(random()) * padRadius * 0.97, x = Math.cos(a) * r, z = Math.sin(a) * r; quaternion.setFromEuler(new THREE.Euler(random() * 6, random() * 6, random() * 6)); const s = 0.6 + random() * 1.3; scale.set(s, s * 0.65, s); matrix.compose(new THREE.Vector3(x, sandHeight(x, z) + 0.0008, z), quaternion, scale); grains.setMatrixAt(i, matrix); grains.setColorAt(i, new THREE.Color(i % 6 === 0 ? palette[1] : palette[i % 2 ? 2 : 0])); }
  grains.name = 'sand-grains'; grains.receiveShadow = true; terrain.add(grains);
  const fragments = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.0022, 0), grainMat, 560);
  for (let i = 0; i < 560; i++) { const z = random() * 1.8 - 0.9, x = ridge(z) + (random() - 0.5) * 1.4; quaternion.setFromEuler(new THREE.Euler(random() * 6, random() * 6, random() * 6)); const s = 0.5 + random() * 1.8; matrix.compose(new THREE.Vector3(x, 0.002, z), quaternion, new THREE.Vector3(s, s * 0.2, s * 0.7)); fragments.setMatrixAt(i, matrix); fragments.setColorAt(i, new THREE.Color(i % 7 === 0 ? '#c8a691' : palette[2])); } fragments.castShadow = fragments.receiveShadow = true; fragments.name = 'shell-hash'; terrain.add(fragments);
  root.add(terrain);

  // A self-contained backdrop -- gentle waves, a soft gradient sky, and a
  // hazy dune line -- so the diorama reads as an immersive place rather than
  // a specimen tray floating in empty space. Sized in local units and scaled
  // down by 1/magnification so it reads at true world scale once the root's
  // 10x magnification is applied.
  const world = 1 / magnification;
  const backdrop = new THREE.Group(); backdrop.name = 'shoreline-backdrop';
  const waterInner = padRadius * 1.06, waterOuter = 46 * world;
  const waterRows = 26, waterSides = 96, waterVerts = [], waterColors = [];
  const nearC = new THREE.Color(ocean[0]), farC = new THREE.Color(ocean[1]);
  const wavePoint = (i, j) => { const t = i / waterRows, a = j / waterSides * Math.PI * 2, r = waterInner + t * (waterOuter - waterInner), wob = Math.sin(a * 5 + t * 9) * 0.01 * (1 - t) * world * 10; return [Math.cos(a) * r, -0.004 * magnification * world + Math.sin(r * 4 + a * 3) * 0.0025 * magnification * world * (1 - t) + wob, Math.sin(a) * r]; };
  const addWater = v => { waterVerts.push(...v); const t = THREE.MathUtils.clamp((Math.hypot(v[0], v[2]) - waterInner) / (waterOuter - waterInner), 0, 1); const c = nearC.clone().lerp(farC, Math.pow(t, 0.6)); waterColors.push(c.r, c.g, c.b); };
  for (let i = 0; i < waterRows; i++) for (let j = 0; j < waterSides; j++) { const a = wavePoint(i, j), b = wavePoint(i + 1, j), c = wavePoint(i + 1, j + 1), d = wavePoint(i, j + 1); [a, b, c, a, c, d].forEach(addWater); }
  const waterGeo = new THREE.BufferGeometry(); waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(waterVerts, 3)); waterGeo.setAttribute('color', new THREE.Float32BufferAttribute(waterColors, 3)); waterGeo.computeVertexNormals();
  const waterMesh = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.35, side: THREE.DoubleSide })); waterMesh.name = 'ocean'; waterMesh.receiveShadow = true; backdrop.add(waterMesh);

  // A handful of low, soft foam-line arcs mark where the last waves receded.
  for (let ring = 0; ring < 3; ring++) { const r = waterInner + 0.02 + ring * 0.05, pts = []; for (let j = 0; j <= 48; j++) { const a = -1.15 + (j / 48) * 2.3, rr = r + Math.sin(j * 0.7 + ring) * 0.01; pts.push(new THREE.Vector3(Math.cos(a) * rr, sandHeight(Math.cos(a) * rr, Math.sin(a) * rr) + 0.0012, Math.sin(a) * rr)); } const foam = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0035 - ring * 0.0008, 5, false); const foamMesh = new THREE.Mesh(foam, new THREE.MeshStandardMaterial({ color: '#f4f2e6', roughness: 0.9, transparent: true, opacity: 0.55 - ring * 0.14 })); foamMesh.name = 'foam-line'; backdrop.add(foamMesh); }

  // Sky: a large gradient dome behind the horizon, plus a soft sun glow disc.
  const skyGeo = new THREE.SphereGeometry(waterOuter * 0.98, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const skyPos = skyGeo.attributes.position, skyCol = new Float32Array(skyPos.count * 3), topC = new THREE.Color(sky[1]), horizonC = new THREE.Color(sky[0]);
  for (let i = 0; i < skyPos.count; i++) { const yFrac = THREE.MathUtils.clamp((skyPos.getY(i) / (waterOuter * 0.98) + 0.05) / 0.5, 0, 1); const c = horizonC.clone().lerp(topC, Math.pow(yFrac, 0.85)); skyCol[i * 3] = c.r; skyCol[i * 3 + 1] = c.g; skyCol[i * 3 + 2] = c.b; }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCol, 3));
  const skyMesh = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })); skyMesh.name = 'sky'; skyMesh.position.y = 0.01; backdrop.add(skyMesh);
  const sunGeo = new THREE.CircleGeometry(waterOuter * 0.05, 32), sunMat = new THREE.MeshBasicMaterial({ color: colorway === 'bioluminescent' ? '#cdb8ff' : '#fff3d6', transparent: true, opacity: 0.55 });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat); sunMesh.position.set(-waterOuter * 0.55, waterOuter * 0.16, -waterOuter * 0.78); sunMesh.lookAt(0, sunMesh.position.y, 0); sunMesh.name = 'sun-glow'; backdrop.add(sunMesh);

  // A hazy, low-poly dune silhouette along the far shore adds depth without
  // competing for attention with the specimens in the foreground.
  const duneMat = new THREE.MeshStandardMaterial({ color: sky[0], roughness: 1, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 6; i++) { const a = -1.3 + i * 0.5 + random() * 0.15, r = waterOuter * (0.62 + random() * 0.1), duneGeo = new THREE.SphereGeometry(waterOuter * (0.09 + random() * 0.05), 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); const dune = new THREE.Mesh(duneGeo, duneMat); dune.position.set(Math.cos(a) * r, -waterOuter * 0.02, Math.sin(a) * r); dune.scale.set(1, 0.32, 1); dune.name = 'distant-dune'; backdrop.add(dune); }

  backdrop.scale.setScalar(world); root.add(backdrop);

  root.userData = { counts, specimenCount: instances.length, magnification, colorway, seed, padRadius }; scene.add(root); return root;
}
export default createScene;
