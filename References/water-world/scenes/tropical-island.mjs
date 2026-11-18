/*
 * TROPICAL ISLAND — a volcanic island: a rainforest stream leaps a waterfall, winds past rice terraces into a
 * mangrove estuary and out to the sea; a palm beach shelters a reef lagoon; basalt cliffs and tide pools face the
 * west. The chain is anchored at the mangrove (sea level). +X east, +Z south, sea level 0.
 */
const IC = [-20, -10];
const coastR = (a) => 214 + 12 * Math.sin(a * 3 + 1.2) + 7 * Math.sin(a * 7 + 0.4);
export default {
  id: 'tropical-island',
  title: 'Tropical Island',
  blurb: 'A rainforest stream on a volcanic island leaps a waterfall, runs past flooded rice terraces into a mangrove estuary, and the sea laps a palm beach behind a coral lagoon, basalt cliffs with an arch and tide pools; a waterspout spins far out.',
  bounds: [-340, -300, 340, 320],
  baseY: -26,
  palette: {
    land: { grass: '#6fae4c', grassDark: '#4f8c3a', meadow: '#6fae4c', meadowDark: '#4f8c3a', ground: '#6fae4c', groundDark: '#4f8c3a', hill: '#6fae4c', hillDark: '#4f8c3a', floor: '#5a9a42', floorDark: '#447a33', moss: '#5f9a3f', soil: '#7a4f34', rock: '#5f5a55', rockDark: '#45413d', gravel: '#8a8072', sand: '#efe0b4', mud: '#6a5038' },
    fresh: { water: '#3aa3a8', deep: '#1f6f7a' },
    sea: { water: '#1f9fb8', deep: '#0f5f88', shallow: '#62dcd0' },
  },
  env: { sky: '#8ccbf0', horizon: '#e6f6f8', fog: '#d6eef2', fogNear: 460, fogFar: 2600, sun: [0.4, 0.88, 0.25] },
  skirt: ['#7a5236', '#5e3f2c', '#3f3a37'],
  sectionWater: '#127aa0',
  terrain: {
    res: 3,
    height(x, z, N) {
      const cx = x - IC[0], cz = z - IC[1], r = Math.hypot(cx, cz), a = Math.atan2(cz, cx), rc = coastR(a);
      let land = 3 + 4 * (N.fbm(x / 70, z / 70, 3, 4) - 0.4);
      land += 26 * N.smooth(rc - 10, rc - 120, r);                                        // the island's plateau
      land += 58 * Math.exp(-(((x + 95) ** 2 + (z + 70) ** 2) / 95 ** 2)) * (0.75 + 0.45 * N.ridged(x / 80, z / 80, 5, 4)); // volcano
      const lagoon = Math.exp(-(((a - Math.PI / 2) / 0.55) ** 2));                        // shallow lagoon to the south
      const seaFloor = -1.2 - (3.5 + 2 * lagoon) * N.smooth(rc, rc + 60, r) - (14 * (1 - 0.6 * lagoon)) * N.smooth(rc + 60, rc + 220, r) + 1.2 * (N.fbm(x / 40, z / 40, 9, 3) - 0.5);
      return N.lerp(land, seaFloor, N.smooth(rc - 12, rc + 6, r));
    },
    color(x, y, z, slope, N) {
      const r = Math.hypot(x - IC[0], z - IC[1]);
      if (y < 1.4 && r > coastR(Math.atan2(z - IC[1], x - IC[0])) - 40) return y < -0.5 ? N.mix('#e2d3a3', '#2c6f86', N.smooth(-4, -16, y)) : '#efe0b4';
      if (slope > 0.58) return N.noise2(x * 0.08, z * 0.08, 3) > 0.5 ? '#5f5a55' : '#4d4844';
      return N.mix('#72b04e', '#467f34', N.smooth(0.3, 0.7, N.fbm(x / 30, z / 30, 7, 3)) * 0.85 + N.hash2(x, z, 3) * 0.15);
    },
  },
  sea: {
    rect: [-340, -300, 340, 320],
    cell: 3,
    item: { params: { seaState: 2, swellDir: 120, wavelength: 30, choppiness: 0.45, colorway: 'tropical', opacity: 0.74 }, title: 'The Sea', group: 'Lagoon & Sea' },
    calm: [{ x: -10, z: 240, r: 90, k: 0.45 }, { x: 186, z: 6, r: 56, k: 0.08 }, { x: 148, z: 6, r: 28, tint: 0.3 }],
  },
  items: [
    // ── Stream to estuary, anchored at the mangrove and grown upstream ─────────────────────────────────
    { id: 'mangrove', asset: 'mangrove-swamp', title: 'Mangrove Estuary', group: 'Estuary', pal: 'sea', at: [176, 0, 6], params: { seaWater: false, chainEnds: true, size: 60, trees: 16, fishAmount: 24 }, basin: 50 },
    { id: 'river', asset: 'river-channel', title: 'Jungle River', group: 'Estuary', attach: { to: 'mangrove.inlet', port: 'outlet' }, params: { colorway: 'tropical', length: 70, valleyWidth: 56, width: 4.8, widthEnd: 4, meander: 0.6, trees: 0.6, reeds: 0.5, depth: 1.4, boulders: 4 }, basin: 70 },
    { id: 'falls', asset: 'waterfall', title: 'Waterfall', group: 'Rainforest', attach: { to: 'river.inlet', port: 'outlet' }, params: { colorway: 'tropical', width: 4, height: 22, length: 64, valleyWidth: 50, style: 'horsetail', mistAmount: 0.9, trees: 0.7 }, fall: 34 },
    { id: 'brook', asset: 'mountain-brook', title: 'Rainforest Stream', group: 'Rainforest', attach: { to: 'falls.inlet', port: 'outlet' }, params: { colorway: 'rainforest', source: true, width: 4, length: 40, breadth: 24, slope: 0.05, cascades: 2, ferns: 1, trees: 0.8 } },
    { id: 'terraces', asset: 'rice-terraces', title: 'Rice Terraces', group: 'Rainforest', at: [96, 0, -58], params: { tiers: 8, width: 44, depth: 38, growth: 0.7, flooded: 0.85 }, y: 'fit', fitSide: '+z', fall: 30, colorFall: 4 },
    // ── Coast ─────────────────────────────────────────────────────────────────────────────────────────
    { id: 'beach', asset: 'beach-shore', title: 'Palm Beach', group: 'Lagoon & Sea', pal: 'sea', at: [-12, 0, 198], yaw: 180, params: { seaWater: false, colorway: 'tropical', width: 130, depth: 64, vegetation: 'palms', rocks: 3, driftwood: 2, waveHeight: 0.5 }, fall: 50 },
    { id: 'reef', asset: 'coral-reef', title: 'Coral Reef', group: 'Lagoon & Sea', pal: 'sea', at: [-30, 0, 262], params: { seaWater: false, size: 50, depth: 5, fish: 90, colorway: 'caribbean' }, y: -5, fall: 40 },
    { id: 'cliff', asset: 'sea-cliff-arch', title: 'Basalt Arch', group: 'West Coast', pal: 'sea', at: [-230, 0, 34], yaw: 90, params: { seaWater: false, colorway: 'basalt', cliffHeight: 24, archSpan: 12, stackHeight: 18 }, fall: 40 },
    { id: 'pools', asset: 'tide-pool', title: 'Tide Pools', group: 'West Coast', pal: 'sea', at: [-226, 0, -42], yaw: 90, params: { seaWater: false, colorway: 'volcanic', pools: 7 }, fall: 34 },
    { id: 'pier', asset: 'wooden-pier', title: 'Jetty', group: 'Lagoon & Sea', at: [36, 0, 207], params: { site: 'structure', colorway: 'tropical', length: 40, deckHeight: 2, waterDepth: 3, lamps: 2, tHead: true }, fixedY: true, footprint: false },
    { id: 'lifeguard', asset: 'lifeguard-tower', title: 'Beach Hut Tower', group: 'Lagoon & Sea', on: 'beach', local: [-34, 4], params: { base: false, colorway: 'ocean', towerName: 'SURF' } },
    // ── Afloat and alive ──────────────────────────────────────────────────────────────────────────────
    { id: 'dock', asset: 'floating-dock', title: 'Floating Dock', group: 'Lagoon & Sea', at: [-70, 0, 222], params: { colorway: 'tropical', layout: 'T', sections: 3, waterDepth: 4 }, float: 'sea' },
    { id: 'kayak', asset: 'kayak', title: 'Sea Kayak', group: 'Lagoon & Sea', at: [-10, 0, 240], params: { colorway: 'ocean' }, float: 'sea', course: { cx: -20, cz: 246, rx: 40, rz: 14, speed: 1.6, dir: -1 } },
    { id: 'catboat', asset: 'sailboat', title: 'Sloop', group: 'Lagoon & Sea', at: [120, 0, 290], params: { speed: 5, colorway: 'seafoam', pointOfSail: 'broad-reach', boatName: 'TRADEWIND' }, float: 'sea', course: { cx: 40, cz: 284, rx: 150, rz: 22, knots: 5, dir: 1, phase: 0.6 } },
    { id: 'whale', asset: 'whale', title: 'Humpback', group: 'Lagoon & Sea', at: [-230, 0, 256], params: { behaviour: 'breach', pathRadius: 24 }, float: 'sea' },
    { id: 'clowns', asset: 'fish-school', title: 'Reef Fish', group: 'Lagoon & Sea', at: [-24, 0, 252], params: { species: 'clownfish', tank: false, count: 60, radius: 5, depth: 2.2 }, y: 'water' },
    { id: 'terns', asset: 'seagull-flock', title: 'Terns', group: 'Lagoon & Sea', at: [20, 0, 236], params: { colorway: 'tern', flying: 14, floating: 4, posts: 0, radius: 40, height: 14 }, float: 'sea' },
    { id: 'spout', asset: 'waterspout', title: 'Waterspout', group: 'Open Sea', pal: 'sea', at: [236, 0, -226], params: { colorway: 'tropical', height: 100, seaSize: 56, cloudSize: 80 }, seaHole: 'auto' },
    // ── Dressing & weather ────────────────────────────────────────────────────────────────────────────
    { id: 'palms1', asset: 'tree-grove', title: 'Palm Grove', group: 'Lagoon & Sea', at: [-70, 0, 160], params: { species: 'palm', count: 12, radius: 18, height: 11, showGround: false, colorway: 'tropical' }, drape: true },
    { id: 'palms2', asset: 'tree-grove', title: 'Palms', group: 'Estuary', at: [150, 0, 70], params: { species: 'palm', count: 9, radius: 15, height: 10, showGround: false, colorway: 'tropical', seed: 4 }, drape: true },
    { id: 'jungle1', asset: 'tree-grove', title: 'Rainforest', group: 'Rainforest', at: [-40, 0, -80], params: { species: 'broadleaf', count: 26, radius: 30, height: 15, showGround: false, colorway: 'tropical', seed: 11 }, drape: true },
    { id: 'jungle2', asset: 'tree-grove', title: 'Forest Edge', group: 'Rainforest', at: [30, 0, 60], params: { species: 'broadleaf', count: 18, radius: 24, height: 13, showGround: false, colorway: 'tropical', seed: 15 }, drape: true },
    { id: 'jungle3', asset: 'tree-grove', title: 'Cloud Forest', group: 'Rainforest', at: [-150, 0, -10], params: { species: 'mixed', count: 20, radius: 28, height: 12, showGround: false, colorway: 'tropical', seed: 19 }, drape: true },
    { id: 'lava', asset: 'boulder-cluster', title: 'Lava Boulders', group: 'West Coast', at: [-190, 0, 92], params: { count: 12, size: 1.8, spread: 10, base: false, colorway: 'basalt', style: 'boulders' }, drape: true },
    { id: 'reeds', asset: 'reed-bed', title: 'Estuary Reeds', group: 'Estuary', at: [138, 0, 4], params: { base: false, width: 22, depth: 16, colorway: 'lush' }, drape: true },
    { id: 'shower', asset: 'rain-cloud', title: 'Tropical Shower', group: 'Rainforest', at: [-90, 0, -60], params: { colorway: 'fairWeather', size: 80, altitude: 46, thickness: 18, precipitation: 'rain', intensity: 0.5 }, y: 'ground' },
    { id: 'rainbow', asset: 'rainbow', title: 'Rainbow', group: 'Rainforest', at: [70, 0, 30], params: { radius: 30, arc: 0.75, colorway: 'vivid' }, y: 'ground' },
    { id: 'mist', asset: 'fog-bank', title: 'Valley Mist', group: 'Rainforest', at: [40, 0, -10], params: { width: 140, depth: 70, height: 6, density: 0.35, colorway: 'dawn' }, y: 'ground' },
  ],
  spots: [
    { id: 'island', title: 'Island', at: [-10, 10, 0], radius: 420 },
    { id: 'falls-view', title: 'Waterfall & terraces', at: [60, 12, -20], radius: 170 },
    { id: 'lagoon', title: 'Lagoon & beach', at: [-20, 0, 230], radius: 190 },
    { id: 'estuary', title: 'Mangrove estuary', at: [170, 2, 10], radius: 130 },
    { id: 'west', title: 'West coast', at: [-230, 4, 0], radius: 150 },
  ],
};
