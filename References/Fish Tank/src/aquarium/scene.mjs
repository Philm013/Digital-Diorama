/*
 * AQUARIUM KIT — SCENE COMPOSITION (RULE 8)
 * Pure composition file: imports 15 standalone part modules, instantiates them with per-theme
 * parameters and arranges them following the layout blueprint. No part file is modified.
 * Scene-only effects live here: room shell, floor caustic spill, marine-snow particles, room lights.
 */

import * as THREE from 'three';
import { createAsset as createStand } from './chassis-base-stand.mjs';
import { createAsset as createGlass } from './chassis-glass-enclosure.mjs';
import { createAsset as createCanopy } from './chassis-lighting-canopy.mjs';
import { createAsset as createSubstrate } from './substrate-terrain.mjs';
import { createAsset as createWood } from './hardscape-wood.mjs';
import { createAsset as createStone } from './hardscape-stone.mjs';
import { createAsset as createCarpet } from './flora-carpet.mjs';
import { createAsset as createBackground } from './flora-background.mjs';
import { createAsset as createCoralSoft } from './coral-soft.mjs';
import { createAsset as createCoralSps } from './coral-sps.mjs';
import { createAsset as createHero } from './fauna-hero-fish.mjs';
import { createAsset as createSchool } from './fauna-schooling-fish.mjs';
import { createAsset as createBottom } from './fauna-bottom-dwellers.mjs';
import { createAsset as createTech } from './tech-filtration.mjs';
import { createAsset as createDecor } from './decor-artifacts.mjs';

export const MODULES = [
  { key: 'stand', file: 'chassis-base-stand.mjs', label: 'Base Stand', fixed: true },
  { key: 'glass', file: 'chassis-glass-enclosure.mjs', label: 'Glass Enclosure', fixed: true },
  { key: 'canopy', file: 'chassis-lighting-canopy.mjs', label: 'Lighting Canopy' },
  { key: 'substrate', file: 'substrate-terrain.mjs', label: 'Substrate Terrain', fixed: true },
  { key: 'wood', file: 'hardscape-wood.mjs', label: 'Driftwood' },
  { key: 'stone', file: 'hardscape-stone.mjs', label: 'Stone Hardscape' },
  { key: 'carpet', file: 'flora-carpet.mjs', label: 'Carpet Plants' },
  { key: 'background', file: 'flora-background.mjs', label: 'Background Plants' },
  { key: 'coralSoft', file: 'coral-soft.mjs', label: 'Soft Coral' },
  { key: 'coralSps', file: 'coral-sps.mjs', label: 'SPS Coral' },
  { key: 'hero', file: 'fauna-hero-fish.mjs', label: 'Hero Fish' },
  { key: 'school', file: 'fauna-schooling-fish.mjs', label: 'Schooling Fish' },
  { key: 'bottom', file: 'fauna-bottom-dwellers.mjs', label: 'Bottom Dwellers' },
  { key: 'tech', file: 'tech-filtration.mjs', label: 'Filtration' },
  { key: 'decor', file: 'decor-artifacts.mjs', label: 'Decor Artifact' }
];

const allOn = (except = []) => Object.fromEntries(MODULES.map(m => [m.key, !except.includes(m.key)]));

export const THEMES = {
  iwagumi: {
    label: 'Iwagumi Zen', water: 'Freshwater', accent: '#4fd070',
    blurb: 'Matte white cabinet, rimless Starphire glass, pale silica, stark Seiryu monoliths and an emerald hairgrass lawn under piercing 6500K daylight.',
    palette: { stand: 'gloss-white', glass: 'default', canopy: 'white', substrate: 'auto', stone: 'seiryu', wood: 'bleached', carpet: 'emerald', bg: 'green', soft: 'neon-green', sps: 'lime', hero: 'angel-silver', school: 'neon', bottom: 'cherry', tech: 'clear', decor: 'zen' },
    waterTint: '#cdeff2', waterOpacity: 0.08, causticColor: '#f4fdff',
    room: { floor: '#cfc6b8', wall: '#efebe5', sky: '#ffffff', ground: '#bdb3a4', key: 1.6, hemi: 1.0 },
    defaults: {
      tankShape: 'rectangle', framing: 'rimless', glassThickness: 'starphire', standStyle: 'minimalist', standHeight: 0.8, fixtureType: 'pendants', lightSpectrum: 'daylight', lightIntensity: 1.2,
      substrateType: 'silica', contour: 'rear-bank', stoneType: 'seiryu', formation: 'monoliths', woodType: 'manzanita', woodComplexity: 3,
      carpetSpecies: 'hairgrass', coverage: 0.8, bgSpecies: 'vallisneria', leafColor: 'green', coralSoftType: 'xenia', coralSpsForm: 'branching',
      heroSpecies: 'angelfish', finMorphology: 'standard', colorPattern: 'striped', heroCount: 2, schoolSpecies: 'neon', schoolSize: 40, formationBehavior: 'sphere',
      bottomSpecies: 'shrimp', population: 8, techStyle: 'glassware', flowRate: 0.4, decorType: 'pagoda', decayLevel: 'algae',
      modules: allOn(['wood', 'coralSoft', 'coralSps', 'decor'])
    }
  },
  abyssal: {
    label: 'Abyssal Reef', water: 'Saltwater', accent: '#ff4ab0',
    blurb: 'Glossy black chassis, purple coralline live rock arches and fluorescent pink, cyan and orange corals pulsing under moody actinic blue.',
    palette: { stand: 'default', glass: 'reef', canopy: 'default', substrate: 'reef', stone: 'abyssal', wood: 'neon', carpet: 'neon', bg: 'neon', soft: 'hot-pink', sps: 'cyber-cyan', hero: 'blue-tang', school: 'chromis', bottom: 'reef-hermit', tech: 'reef', decor: 'neon' },
    waterTint: '#1a4ab8', waterOpacity: 0.16, causticColor: '#5a8cff',
    room: { floor: '#16161c', wall: '#0c0d14', sky: '#2a3a7a', ground: '#0a0a10', key: 0.25, hemi: 0.35 },
    defaults: {
      tankShape: 'rectangle', framing: 'black', glassThickness: 'starphire', standStyle: 'minimalist', standHeight: 0.85, fixtureType: 'bar', lightSpectrum: 'reef-blue', lightIntensity: 1.4,
      substrateType: 'coral', contour: 'dual-mound', stoneType: 'liverock', formation: 'archway', woodType: 'spider', woodComplexity: 4,
      carpetSpecies: 'babytears', coverage: 0.5, bgSpecies: 'rotala', leafColor: 'neon', coralSoftType: 'anemone', coralSpsForm: 'branching',
      heroSpecies: 'tang', finMorphology: 'standard', colorPattern: 'solid', heroCount: 2, schoolSpecies: 'chromis', schoolSize: 24, formationBehavior: 'stream',
      bottomSpecies: 'hermit', population: 6, techStyle: 'industrial', flowRate: 0.8, decorType: 'skull', decayLevel: 'coral',
      modules: allOn(['wood', 'carpet', 'background', 'decor'])
    }
  },
  amazon: {
    label: 'Amazonian Blackwater', water: 'Freshwater', accent: '#e8902a',
    blurb: 'Dark walnut cabinetry and hood, tea-coloured tannin water, tangled spider-wood labyrinth, leaf litter and copper-gold discus in warm, dim spotlighting.',
    palette: { stand: 'walnut', glass: 'blackwater', canopy: 'walnut', substrate: 'auto', stone: 'river', wood: 'blackwater', carpet: 'deep', bg: 'bronze', soft: 'orange', sps: 'orange', hero: 'copper-gold', school: 'cardinal', bottom: 'bronze-cory', tech: 'clear', decor: 'bronze' },
    waterTint: '#a8742c', waterOpacity: 0.26, causticColor: '#ffcf8a',
    room: { floor: '#3a2a1e', wall: '#2a1e16', sky: '#ffcf9a', ground: '#2a1a10', key: 0.55, hemi: 0.45 },
    defaults: {
      tankShape: 'rectangle', framing: 'black', glassThickness: 'standard', standStyle: 'rustic', standHeight: 0.75, fixtureType: 'hood', lightSpectrum: 'warm-spot', lightIntensity: 0.9,
      substrateType: 'silica', contour: 'rear-bank', stoneType: 'river', formation: 'rubble', woodType: 'spider', woodComplexity: 8,
      carpetSpecies: 'montecarlo', coverage: 0.35, bgSpecies: 'amazon', leafColor: 'green', coralSoftType: 'toadstool', coralSpsForm: 'plating',
      heroSpecies: 'discus', finMorphology: 'standard', colorPattern: 'marbled', heroCount: 3, schoolSpecies: 'cardinal', schoolSize: 50, formationBehavior: 'stream',
      bottomSpecies: 'corydoras', population: 6, techStyle: 'glassware', flowRate: 0.25, decorType: 'buddha', decayLevel: 'algae',
      modules: allOn(['carpet', 'coralSoft', 'coralSps', 'decor'])
    }
  },
  cyberpunk: {
    label: 'Cyberpunk Aqua-Lounge', water: 'Sci-Fi', accent: '#30f0ff',
    blurb: 'Brushed-chrome cylindrical pedestal, seamless cylinder tank, neon purple & hot cyan light, black gravel, a glowing monolith and fluorescent GloFish.',
    palette: { stand: 'brushed-steel', glass: 'cyber', canopy: 'chrome', substrate: 'black', stone: 'synthetic', wood: 'neon', carpet: 'neon', bg: 'neon', soft: 'cyber-cyan', sps: 'purple', hero: 'glo-pink', school: 'glofish', bottom: 'neon', tech: 'cyber', decor: 'neon' },
    waterTint: '#4a8ae8', waterOpacity: 0.12, causticColor: '#b080ff',
    room: { floor: '#101018', wall: '#0a0a12', sky: '#6a3aff', ground: '#05050a', key: 0.2, hemi: 0.3 },
    defaults: {
      tankShape: 'cylinder', framing: 'chrome', glassThickness: 'starphire', standStyle: 'pedestal', standHeight: 0.85, fixtureType: 'pendants', lightSpectrum: 'cyber-neon', lightIntensity: 1.3,
      substrateType: 'pebbles', contour: 'dual-mound', stoneType: 'dragon', formation: 'rubble', woodType: 'spider', woodComplexity: 3,
      carpetSpecies: 'montecarlo', coverage: 0.6, bgSpecies: 'rotala', leafColor: 'neon', coralSoftType: 'zoanthid', coralSpsForm: 'encrusting',
      heroSpecies: 'betta', finMorphology: 'veiltail', colorPattern: 'marbled', heroCount: 2, schoolSpecies: 'glofish', schoolSize: 30, formationBehavior: 'scatter',
      bottomSpecies: 'shrimp', population: 6, techStyle: 'invisible', flowRate: 0.5, decorType: 'monolith', decayLevel: 'pristine',
      modules: allOn(['wood', 'coralSoft', 'coralSps'])
    }
  },
  marine: {
    label: 'Classic Marine', water: 'Saltwater', accent: '#ffb02a',
    blurb: 'A grand mahogany bow-front stand and hood, glaring white reef sand, a wall of white & purple live rock, and primary-coloured clownfish under bright white/blue.',
    palette: { stand: 'mahogany', glass: 'marine', canopy: 'mahogany', substrate: 'reef', stone: 'liverock', wood: 'bleached', carpet: 'lime', bg: 'green', soft: 'cream', sps: 'purple', hero: 'clown', school: 'chromis', bottom: 'reef-hermit', tech: 'white', decor: 'default' },
    waterTint: '#4aa0e0', waterOpacity: 0.12, causticColor: '#e6f4ff',
    room: { floor: '#5a3a28', wall: '#e8e0d4', sky: '#fff6ea', ground: '#5a4030', key: 1.2, hemi: 0.9 },
    defaults: {
      tankShape: 'bowfront', framing: 'black', glassThickness: 'standard', standStyle: 'ornate', standHeight: 0.8, fixtureType: 'hood', lightSpectrum: 'reef-blue', lightIntensity: 1.6,
      substrateType: 'coral', contour: 'rear-bank', stoneType: 'liverock', formation: 'monoliths', woodType: 'mopani', woodComplexity: 3,
      carpetSpecies: 'babytears', coverage: 0.5, bgSpecies: 'vallisneria', leafColor: 'green', coralSoftType: 'anemone', coralSpsForm: 'plating',
      heroSpecies: 'clownfish', finMorphology: 'standard', colorPattern: 'striped', heroCount: 3, schoolSpecies: 'chromis', schoolSize: 20, formationBehavior: 'sphere',
      bottomSpecies: 'hermit', population: 5, techStyle: 'industrial', flowRate: 0.6, decorType: 'shipwreck', decayLevel: 'coral',
      modules: allOn(['wood', 'carpet', 'background'])
    }
  }
};

export const COMMON_DEFAULTS = {
  merge: true, night: false, doorsOpen: 0, lidOpen: 0.25, waterLevel: 0.9, godRays: true, caustics: true, particles: true, underglow: true,
  tankWidth: 1.2, tankDepth: 0.5, tankHeight: 0.55,
  algaeLevel: 0.2, coralGlow: 0.35, plantSway: 1.0, waterDensity: 1.0,
  patternSoftness: 0.85, organicJitter: 0.8
};

const THEME_TUNING = {
  iwagumi:   { algaeLevel: 0.08, coralGlow: 0.3, plantSway: 1.0, waterDensity: 0.8, patternSoftness: 0.85, organicJitter: 0.7 },
  abyssal:   { algaeLevel: 0.15, coralGlow: 0.55, plantSway: 1.2, waterDensity: 1.0, patternSoftness: 0.75, organicJitter: 0.9 },
  amazon:    { algaeLevel: 0.3, coralGlow: 0.25, plantSway: 0.8, waterDensity: 1.3, patternSoftness: 1.0, organicJitter: 1.0 },
  cyberpunk: { algaeLevel: 0.1, coralGlow: 0.6, plantSway: 1.1, waterDensity: 0.9, patternSoftness: 0.7, organicJitter: 0.6 },
  marine:    { algaeLevel: 0.2, coralGlow: 0.45, plantSway: 1.0, waterDensity: 1.0, patternSoftness: 0.9, organicJitter: 0.85 }
};

export function themeDefaults(key) {
  const T = THEMES[key] || THEMES.iwagumi;
  return { ...COMMON_DEFAULTS, ...(THEME_TUNING[key] || {}), ...T.defaults, modules: { ...T.defaults.modules } };
}

const CAUSTIC_FLOOR_GLSL = `
float causticAt(vec2 uv, float t){
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0; vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++) { float tt = t * (1.0 - (3.5 / float(n + 1))); i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x)); c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten))); }
  c /= 4.0; c = 1.17 - pow(c, 1.4); return clamp(pow(abs(c), 8.0), 0.0, 2.0);
}`;

export function buildAquarium(themeKey, opts) {
  const T = THEMES[themeKey] || THEMES.iwagumi;
  const o = { ...themeDefaults(themeKey), ...opts };
  const M = o.modules;
  const merge = !!o.merge;
  const P = T.palette;
  const root = new THREE.Group(); root.name = 'aquarium-kit';
  const updaters = [];
  const plantAudits = [];
  const reg = (obj) => { if (obj?.userData?.update) updaters.push(obj.userData.update); return obj; };

  // ---------- room shell ----------
  const room = new THREE.Group(); room.name = 'room';
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: T.room.floor, roughness: 0.8 }));
  floor.receiveShadow = true; floor.name = 'roomFloor';
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4).translate(0, 2, 0), new THREE.MeshStandardMaterial({ color: T.room.wall, roughness: 0.95 }));
  wall.position.z = -0.75; wall.receiveShadow = true; wall.name = 'roomWall';
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 0.02).translate(0, 0.04, -0.74), new THREE.MeshStandardMaterial({ color: T.room.floor, roughness: 0.6 }));
  room.add(floor, wall, skirting); root.add(room);

  // ---------- glass enclosure (built first: defines the canvas) ----------
  const tannin = M.wood && (themeKey === 'amazon');
  const density = THREE.MathUtils.clamp(o.waterDensity ?? 1, 0.3, 2.2);
  const glass = reg(createGlass({
    mergeForProduction: merge, colorway: P.glass, tankShape: o.tankShape, width: o.tankWidth, depth: o.tankDepth, height: o.tankHeight,
    glassThickness: o.glassThickness, framing: o.framing, waterLevel: o.waterLevel, lidOpen: o.lidOpen, showLid: !(o.fixtureType === 'hood' && M.canopy),
    water: tannin ? '#9a6224' : T.waterTint,
    waterOpacity: THREE.MathUtils.clamp((tannin ? Math.max(0.24, T.waterOpacity) : T.waterOpacity) * density, 0.04, 0.5)
  }));
  const GD = glass.userData, ob = GD.outerBounds, ib = GD.innerBounds;
  const outerW = ob.maxX - ob.minX, outerD = ob.maxZ - ob.minZ, tankZ = -(ob.minZ + ob.maxZ) / 2;

  // ---------- stand ----------
  const stand = reg(createStand({ mergeForProduction: merge, colorway: P.stand, standStyle: o.standStyle, width: outerW + 0.06, depth: outerD + 0.06, height: o.standHeight, doorsOpen: o.doorsOpen, underglow: o.underglow }));
  root.add(stand);
  const topY = stand.userData.topY;

  const tank = new THREE.Group(); tank.name = 'tank'; tank.position.set(0, topY, tankZ);
  tank.add(glass); root.add(tank);
  const floorY = GD.floorY, waterY = GD.waterY, H = GD.height;

  // ---------- canopy ----------
  let canopy = null;
  if (M.canopy) {
    canopy = reg(createCanopy({ mergeForProduction: merge, colorway: P.canopy, fixtureType: o.fixtureType, lightSpectrum: o.lightSpectrum, intensity: o.lightIntensity, width: outerW, depth: outerD, godRays: o.godRays, rayLength: (waterY - floorY) * 0.9, cableLength: Math.max(0.2, 2.6 - topY - H - 0.3) }));
    canopy.position.set(0, H, 0);
    canopy.userData.lights.forEach(l => {
      l.intensity *= 1.8;
      if (o.night) { l.intensity *= 0.12; l.color.set('#5a8cff'); }
    });
    tank.add(canopy);
  }

  // ---------- substrate ----------
  const sub = reg(createSubstrate({ mergeForProduction: merge, colorway: P.substrate, substrateType: o.substrateType, contour: o.contour, tankShape: o.tankShape, width: o.tankWidth, depth: o.tankDepth, glassInset: GD.glassT + 0.0015, slopeHeight: Math.min(0.16, (waterY - floorY) * 0.32), caustics: o.caustics, causticColor: T.causticColor, causticStrength: themeKey === 'amazon' ? 0.35 : 0.55 }));
  sub.position.y = floorY; tank.add(sub);
  if (o.night && sub.userData.causticMaterial) sub.userData.causticMaterial.uniforms.uStrength.value *= 0.3;
  const SB = sub.userData.bounds, bw = SB.maxX - SB.minX, bd = SB.maxZ - SB.minZ;
  const Hy = (x, z) => floorY + sub.userData.heightAt(x, z);
  const inside = sub.userData.inside;
  const safeInside = (x, z, margin = 0.018) => {
    if (!inside(x, z)) return false;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      if (!inside(x + Math.cos(a) * margin, z + Math.sin(a) * margin)) return false;
    }
    return true;
  };
  const sf = Math.min(1.25, Math.max(0.6, Math.min(bw / 1.15, bd / 0.46)));
  const curved = o.tankShape === 'cylinder' || o.tankShape === 'hexagon';
  const cx = SB.minX + bw * (curved ? 0.33 : 0.27), cz = SB.minZ + bd * 0.33;

  // ---------- hardscape (size clamped so tall pieces stay submerged) ----------
  const swimDepth0 = waterY - floorY;
  const sizeScale = THREE.MathUtils.clamp((swimDepth0 - 0.06) / 0.38, 0.45, 1);
  const coralGlow = o.night ? 0.9 : THREE.MathUtils.clamp(o.coralGlow ?? 0.35, 0, 1.2);
  const swayMul = THREE.MathUtils.clamp(o.plantSway ?? 1, 0, 2);
  let stone = null, wood = null;
  const gaps = [];
  if (M.stone) {
    stone = reg(createStone({ mergeForProduction: merge, colorway: P.stone, stoneType: o.stoneType, formation: o.formation, size: sf * sizeScale * (o.stoneType === 'liverock' && themeKey === 'marine' ? 1.25 : 1), algaeLevel: THREE.MathUtils.clamp(o.algaeLevel ?? 0.2, 0, 1), groundFn: (x, z) => Hy(cx + x, cz + z) }));
    stone.position.set(cx, 0, cz); tank.add(stone);
    stone.userData.gaps.forEach(g => gaps.push([g[0] + cx, g[1], g[2] + cz]));
  }
  if (M.wood) {
    const wx = cx + 0.05 * sf, wz = cz + 0.01;
    wood = reg(createWood({ mergeForProduction: merge, colorway: P.wood, woodType: o.woodType, complexity: o.woodComplexity, weathering: themeKey === 'amazon' ? 'tannin' : themeKey === 'iwagumi' ? 'moss' : 'clean', tanninLeach: tannin, size: sf * sizeScale * (o.woodType === 'spider' ? 1.1 : 1), groundFn: (x, z) => Hy(wx + x, wz + z) }));
    wood.position.set(wx, 0, wz); tank.add(wood);
    wood.userData.gaps.slice(0, 6).forEach(g => gaps.push([g.x + wx, Math.min(g.y, waterY - 0.08), g.z + wz]));
  }

  // ---------- flora ----------
  const swimDepth = waterY - floorY;
  if (M.background) {
    const plantMargin = 0.02 + 0.03 * swayMul;
    const backBand = Math.min(0.16, bd * 0.32);
    const edgeAtX = (x) => {
      if (x < SB.minX || x > SB.maxX) return null;
      const steps = 128;
      for (let i = 0; i <= steps; i++) {
        const z = THREE.MathUtils.lerp(SB.minZ, SB.maxZ, i / steps);
        if (inside(x, z)) return z;
      }
      return null;
    };
    const rootPosition = (x, rand) => {
      const edge = edgeAtX(x);
      if (edge == null) return null;
      for (let attempt = 0; attempt < 18; attempt++) {
        const z = edge + plantMargin + rand() * backBand;
        if (safeInside(x, z, plantMargin)) return [x, z];
      }
      for (let d = plantMargin; d < Math.min(bd * 0.45, backBand + 0.04); d += 0.003) {
        const z = edge + d;
        if (safeInside(x, z, plantMargin)) return [x, z];
      }
      return null;
    };
    const bg = reg(createBackground({
      mergeForProduction: merge, leafColor: o.leafColor, plantSpecies: o.bgSpecies,
      width: bw * 0.98, depth: bd * 0.5, height: swimDepth * 0.68,
      maxHeight: swimDepth - 0.04, surfaceY: waterY - 0.018,
      density: o.bgSpecies === 'amazon' ? 1.2 : 1, swayStrength: 0.02 * swayMul,
      heightAt: Hy, mask: (x, z) => safeInside(x, z, plantMargin), rootPosition
    }));
    plantAudits.push({ part: 'background', ...bg.userData.audit });
    tank.add(bg);
  }
  if (M.carpet) {
    const ccx = (SB.minX + SB.maxX) / 2, ccz = (SB.minZ + SB.maxZ) / 2;
    const carpet = reg(createCarpet({
      mergeForProduction: merge, colorway: P.carpet, plantSpecies: o.carpetSpecies, coverage: o.coverage, width: bw, depth: bd, density: o.carpetSpecies === 'hairgrass' ? 1 : 0.8, swayStrength: 0.006 * swayMul,
      heightAt: (x, z) => Hy(x + ccx, z + ccz),
       mask: (x, z) => { const X = x + ccx, Z = z + ccz; return safeInside(X, Z, 0.024 + 0.01 * swayMul) && Math.hypot((X - cx) / 1.4, Z - cz) > 0.13 * sf && Z > SB.minZ + 0.12; }
    }));
    plantAudits.push({ part: 'carpet', ...carpet.userData.audit });
    carpet.position.set(ccx, 0, ccz); tank.add(carpet);
  }

  // ---------- corals ----------
  let sps = null;
  if (M.coralSps) {
    const anchors = stone ? stone.userData.peaks.slice(0, 5).map(q => [q[0] + cx, q[1] - 0.004, q[2] + cz]) : [[cx, Hy(cx, cz), cz]];
    sps = reg(createCoralSps({ mergeForProduction: merge, colorway: P.sps, growthForm: o.coralSpsForm, size: 0.8 * sf * sizeScale, glow: coralGlow, anchors, heightAt: Hy }));
    tank.add(sps);
  }
  if (M.coralSoft) {
    const anchors = [];
    for (let i = 0; i < 4; i++) { const a = -0.3 + i * 0.5, r = 0.2 * sf; const x = cx + Math.cos(a) * r * 1.3, z = cz + Math.sin(a) * r * 0.8 + 0.05; if (inside(x, z)) anchors.push([x, Hy(x, z) - 0.002, z]); }
    if (!anchors.length) anchors.push([cx + 0.12 * sf, Hy(cx + 0.12 * sf, cz + 0.08), cz + 0.08]);
    const soft = reg(createCoralSoft({ mergeForProduction: merge, colorway: P.soft, coralType: o.coralSoftType, size: sf * sizeScale, glow: coralGlow, anchors, heightAt: Hy }));
    tank.add(soft);
  }

  // ---------- decor ----------
  if (M.decor) {
    const dx = SB.minX + bw * (curved ? 0.6 : 0.56), dz = SB.minZ + bd * 0.4;
    const decor = reg(createDecor({ mergeForProduction: merge, colorway: P.decor, artifactType: o.decorType, decayLevel: o.decayLevel, size: sf * 0.95 }));
    decor.position.set(dx, Hy(dx, dz) - 0.004, dz); decor.rotation.y = -0.35; tank.add(decor);
  }

  // ---------- tech (hidden behind tallest hardscape, snapped to rear glass) ----------
  let tech = null;
  if (M.tech) {
    let rz = SB.minZ; for (let z = SB.minZ; z < 0; z += 0.002) { if (inside(cx, z)) { rz = z; break; } }
    tech = reg(createTech({ mergeForProduction: merge, colorway: P.tech, techStyle: o.techStyle, flowRate: o.flowRate, waterDepth: waterY - floorY, tankHeight: H - floorY, glassT: GD.glassT, span: Math.min(0.34, bw * 0.3), co2Bubbles: T.water !== 'Saltwater' || o.techStyle === 'industrial' }));
    tech.position.set(cx, floorY, rz - 0.001); tank.add(tech);
    const out = tech.userData.outlet;
    GD.setRipple(cx + out[0], rz + out[2], 0.4 + o.flowRate);
  }

  // ---------- fauna (school built first so heroes can avoid it and vice versa) ----------
  const kf = curved ? 0.62 : 1;
  const midX = (SB.minX + SB.maxX) / 2, midZ = (SB.minZ + SB.maxZ) / 2;
  const floorClear = Math.min(0.09, swimDepth * 0.26);
  const surfaceClear = Math.min(0.055, swimDepth * 0.17);
  const swimMinY = floorY + floorClear;
  const swimMaxY = Math.max(swimMinY + 0.025, waterY - surfaceClear);
  const heroBounds = { min: [midX - bw * 0.39 * kf, swimMinY, midZ - bd * 0.3 * kf], max: [midX + bw * 0.39 * kf, swimMaxY, midZ + bd * 0.31 * kf] };
  const schoolBounds = { min: [SB.minX + bw * 0.09, swimMinY, SB.minZ + bd * 0.11], max: [SB.maxX - bw * 0.08, swimMaxY, SB.maxZ - bd * 0.08] };
  let hero = null, school = null;
  if (M.school) {
    school = reg(createSchool({ mergeForProduction: merge, colorway: P.school === 'neon' ? 'auto' : P.school, species: o.schoolSpecies, schoolSize: o.schoolSize, formationBehavior: o.formationBehavior, center: [midX + bw * 0.06, floorY + swimDepth * 0.58, midZ + bd * 0.06], pathWidth: bw * 0.3 * kf, pathDepth: bd * 0.2 * kf, pathHeight: swimDepth * 0.18, heightAt: Hy, contains: (x, z) => safeInside(x, z, 0.026), bounds: schoolBounds, avoid: hero ? () => hero.userData.avoidanceTargets() : undefined }));
    tank.add(school);
  }
  if (M.hero) {
    hero = reg(createHero({
      mergeForProduction: merge, colorway: P.hero, species: o.heroSpecies, finMorphology: o.finMorphology, colorPattern: o.colorPattern, count: o.heroCount,
      patternSoftness: o.patternSoftness, organicJitter: o.organicJitter,
      bounds: heroBounds, waypoints: gaps, heightAt: Hy, avoid: school ? () => school.userData.avoidanceTargets() : undefined
    }));
    tank.add(hero);
    // now that heroes exist, let the school avoid them too
    if (school) school.userData.avoid = () => hero.userData.avoidanceTargets();
  }
  if (M.bottom) {
    const area = { minX: SB.minX + bw * 0.38, maxX: SB.maxX - 0.04, minZ: SB.minZ + bd * 0.4, maxZ: SB.maxZ - 0.03 };
    const bottom = reg(createBottom({ mergeForProduction: merge, colorway: P.bottom, species: o.bottomSpecies, population: o.population, heightAt: Hy, area, mask: (x, z) => inside(x, z) && inside(x * 1.04, z * 1.04) }));
    tank.add(bottom);
  }

  // ---------- marine snow (scene particles, drift with filter current) ----------
  let snow = null; const snowData = [];
  if (o.particles) {
    const N = 700, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = SB.minX + Math.random() * bw; pos[i * 3 + 1] = floorY + 0.02 + Math.random() * (waterY - floorY - 0.03); pos[i * 3 + 2] = SB.minZ + Math.random() * bd; snowData.push(Math.random() * 6.28); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(T.water === 'Saltwater' ? '#dfe8ff' : '#fff8ea') }, uSize: { value: 0.0028 } },
      vertexShader: 'uniform float uSize; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(uSize * 900.0 / -mv.z, 1.0, 6.0); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uColor, (0.5 - d) * 0.9); }',
      transparent: true, depthWrite: false
    });
    snow = new THREE.Points(geo, mat); snow.name = 'marineSnow'; snow.renderOrder = 4; tank.add(snow);
  }
  const flow = tech ? tech.userData.flowDir : [1, 0, 0];

  // ---------- floor caustic spill (light through water onto the room floor) ----------
  const fcMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(canopy ? canopy.userData.lightColor : '#ffffff') }, uStrength: { value: o.caustics && canopy ? 0.12 * o.lightIntensity * (o.night ? 0.25 : 1) : 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: CAUSTIC_FLOOR_GLSL + 'uniform float uTime; uniform vec3 uColor; uniform float uStrength; varying vec2 vUv; varying vec3 vW; void main(){ vec2 d = (vUv - 0.5) * 2.0; float fall = pow(max(0.0, 1.0 - length(d * vec2(1.0, 1.3))), 1.6); float c = causticAt(vW.xz * 0.9, uTime * 0.4); gl_FragColor = vec4(uColor * c * fall * uStrength, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const fc = new THREE.Mesh(new THREE.PlaneGeometry(outerW * 2.2, 1.6).rotateX(-Math.PI / 2), fcMat);
  fc.position.set(0, 0.003, tankZ + outerD / 2 + 0.55); fc.name = 'floorCaustics'; fc.renderOrder = 6;
  root.add(fc);

  // ---------- room lighting ----------
  const nightK = o.night ? 0.12 : 1;
  const hemi = new THREE.HemisphereLight(T.room.sky, T.room.ground, T.room.hemi * nightK); hemi.name = 'roomHemi';
  const key = new THREE.DirectionalLight('#fff4e6', T.room.key * nightK); key.position.set(2.5, 3.5, 3); key.name = 'roomKey';
  key.castShadow = !o.night; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 2; key.shadow.camera.bottom = -1; key.shadow.bias = -0.0004;
  root.add(hemi, key);
  if (o.night) {
    // moonlit tank glow: faint blue point light + coral fluorescence already boosted via coralGlow
    const moon = new THREE.PointLight('#5a8cff', 0.6, 3.0, 1.6);
    moon.position.set(0, topY + H * 0.7, tankZ);
    moon.name = 'nightGlow'; root.add(moon);
  }
  if (stand.userData.setRig) stand.userData.setRig('ambientUnderglow', o.underglow);

  // ---------- update loop ----------
  let startleT = 0;
  const update = (t, dt) => {
    for (const u of updaters) u(t, dt);
    fcMat.uniforms.uTime.value = t;
    if (snow) {
      const a = snow.geometry.attributes.position.array, fr = 0.004 + 0.012 * o.flowRate;
      for (let i = 0, k = 0; i < a.length; i += 3, k++) {
        a[i] += (flow[0] * fr + Math.sin(t * 0.3 + snowData[k]) * 0.002) * dt;
        a[i + 1] += (-0.002 + Math.sin(t * 0.5 + snowData[k] * 2) * 0.0015) * dt;
        a[i + 2] += (flow[2] * fr * 0.5 + Math.cos(t * 0.27 + snowData[k]) * 0.002) * dt;
        if (a[i] > SB.maxX) a[i] = SB.minX; if (a[i] < SB.minX) a[i] = SB.maxX;
        if (a[i + 2] > SB.maxZ) a[i + 2] = SB.minZ; if (a[i + 2] < SB.minZ) a[i + 2] = SB.maxZ;
        if (a[i + 1] < floorY + 0.02) a[i + 1] = waterY - 0.01;
      }
      snow.geometry.attributes.position.needsUpdate = true;
    }
    // hero fish startle SPS polyps when passing close
    startleT += dt;
    if (sps && hero && startleT > 0.4) {
      startleT = 0;
      const fp = hero.userData.positions();
      if (sps.userData.anchors.some(a => fp.some(f => Math.hypot(f.x - a[0], f.y - a[1], f.z - a[2]) < 0.07))) sps.userData.startle();
    }
  };

  // ---------- stats ----------
  let tris = 0, meshes = 0;
  root.traverse(ob2 => { if (ob2.isMesh && ob2.geometry) { meshes++; const g = ob2.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * (ob2.isInstancedMesh ? ob2.count : 1); } });
  const audit = plantAudits.reduce((a, part) => ({
    vertices: a.vertices + part.vertices,
    outsideFootprint: a.outsideFootprint + part.outsideFootprint,
    aboveSurface: a.aboveSurface + (part.aboveSurface || 0),
    parts: a.parts + 1
  }), { vertices: 0, outsideFootprint: 0, aboveSurface: 0, parts: 0 });

  const dispose = () => {
    const mats = new Set();
    root.traverse(ob2 => { if (ob2.geometry) ob2.geometry.dispose(); if (ob2.material) (Array.isArray(ob2.material) ? ob2.material : [ob2.material]).forEach(m => mats.add(m)); if (ob2.isLight && ob2.shadow?.map) ob2.shadow.map.dispose(); });
    mats.forEach(m => m.dispose());
  };

  const focus = new THREE.Vector3(0, topY + H * 0.45, tankZ);
  return { root, update, dispose, focus, stats: { tris: Math.round(tris), meshes }, audit, dims: { outerW, outerD, height: H, topY } };
}
