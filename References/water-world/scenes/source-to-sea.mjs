/*
 * SOURCE TO SEA — one river from a glacier to its delta, every reach an asset chained by its ports.
 * The chain is anchored at the delta (sea level) and grows upstream, so every level falls out of the joins.
 * +X east, +Z south, y up, sea level 0.
 */
const coastX = (z) => 168 + 22 * Math.sin(z / 95) + 9 * Math.sin(z / 37 + 1.3);
export default {
  id: 'source-to-sea',
  title: 'Source to Sea',
  blurb: 'A glacier calves meltwater into a gorge; a waterfall and rapids drop it to the valley floor, where a meandering river gathers a mill stream, a beaver valley and a hot-spring creek, passes an oxbow lake and a marsh and spreads into a delta on the sea. A cave, a geyser field and an aquifer cut-away sit along the way.',
  bounds: [-420, -262, 420, 214],
  baseY: -24,
  palette: {
    land: { grass: '#7fa75a', grassDark: '#5f8a45', meadow: '#7fa75a', meadowDark: '#5f8a45', ground: '#7fa75a', groundDark: '#5f8a45', hill: '#7fa75a', hillDark: '#5f8a45', floor: '#6f9a50', floorDark: '#5f8a45', moss: '#6b8f45', plain: '#86a862', levee: '#7a9a55', soil: '#7a5c3e', rock: '#8a8478', rockDark: '#6e6a62', gravel: '#a49a86', sand: '#d8c79b', mud: '#6a5440' },
    fresh: { water: '#3f8fa0', deep: '#24606f' },
    sea: { water: '#2f7fa5', deep: '#18506e', shallow: '#56b3b5' },
  },
  env: { sky: '#a9cde6', horizon: '#dfeef3', fog: '#cfe2ea', fogNear: 420, fogFar: 2600, sun: [0.55, 0.8, 0.3] },
  skirt: ['#6e5236', '#5e4632', '#5a524a'],
  terrain: {
    res: 3,
    height(x, z, N) {
      const xc = coastX(z);
      let land = 2.2 + 9 * (N.fbm(x / 170, z / 170, 3, 4) - 0.35) + 2.5 * (N.fbm(x / 45, z / 45, 9, 3) - 0.5);
      // mountains rise to the north-west, foothills along the north
      const mtn = 95 * N.smooth(-90, -400, x) + 38 * N.smooth(-120, -262, z) * N.smooth(120, -60, x);
      land += mtn * (0.45 + 0.75 * N.ridged(x / 150, z / 150, 5, 5));
      // the coast: land dips under the sea along a wavy shoreline
      const sea = N.smooth(xc - 34, xc + 30, x);
      return N.lerp(land, -5 - 11 * N.smooth(xc, xc + 220, x) + 2 * (N.fbm(x / 60, z / 60, 4, 3) - 0.5), sea);
    },
    color(x, y, z, slope, N) {
      if (y < 0.25 && x > coastX(z) - 60) return y < -0.4 ? N.mix('#c9b98c', '#3b5a5e', N.smooth(-2, -12, y)) : '#e0cf9f';
      if (slope > 0.62) return N.noise2(x * 0.08, z * 0.08, 2) > 0.5 ? '#8a8478' : '#77736b';
      if (y > 62) return slope > 0.35 ? '#9a958c' : '#eef3f5';
      if (y > 40 && slope > 0.3) return '#8f8a80';
      return N.mix('#82a95c', '#5f8a45', N.smooth(0.3, 0.7, N.fbm(x / 34, z / 34, 7, 3)) * 0.85 + N.hash2(x, z, 3) * 0.15);
    },
  },
  sea: {
    rect: [70, -262, 420, 214],
    cell: 2.4,
    calm: [{ x: 124, z: 40, r: 60, tint: 0.35 }],
    item: { params: { seaState: 3, swellDir: 200, wavelength: 34, choppiness: 0.5, colorway: 'default', water: '#2f7fa5', deep: '#18506e', shallow: '#56b3b5' }, title: 'The Sea', group: 'Coast' },
  },
  roads: [],
  items: [
    // ── Main river, anchored at the delta and grown upstream ───────────────────────────────────────────
    { id: 'delta', asset: 'river-delta', title: 'River Delta', group: 'Coast', at: [110, 0, 40], params: { chainEnds: true, mainWidth: 12, branches: 5, vegetation: 0.7, seaWater: false }, seaHole: 'auto', basin: 60 },
    { id: 'lower', asset: 'river-channel', title: 'Lower River', group: 'River', attach: { to: 'delta.inlet', port: 'outlet' }, params: { length: 100, valleyWidth: 70, width: 9, widthEnd: 12, tributary: 'north', tributaryWidth: 3, meander: 0.5, trees: 0.35, reeds: 0.7, depth: 1.8 }, basin: 70 },
    { id: 'bend2', asset: 'river-channel', title: 'River Bend', group: 'River', attach: { to: 'lower.inlet', port: 'outlet' }, params: { length: 80, valleyWidth: 80, width: 8, widthEnd: 9, bend: 'left', trees: 0.4, reeds: 0.6, depth: 1.6 }, basin: 70 },
    { id: 'middle', asset: 'river-channel', title: 'Middle River', group: 'River', attach: { to: 'bend2.inlet', port: 'outlet' }, params: { length: 110, valleyWidth: 70, width: 6, widthEnd: 8, tributary: 'both', tributaryWidth: 3, meander: 0.6, trees: 0.4, depth: 1.4 }, basin: 70 },
    { id: 'bend1', asset: 'river-channel', title: 'Upper Bend', group: 'River', attach: { to: 'middle.inlet', port: 'outlet' }, params: { length: 80, valleyWidth: 80, width: 4.8, widthEnd: 6, bend: 'right', trees: 0.45, depth: 1.2, boulders: 8 }, basin: 70 },
    { id: 'rapids', asset: 'rapids-cascade', title: 'Rapids', group: 'Highlands', attach: { to: 'bend1.inlet', port: 'outlet' }, params: { width: 4.8, drop: 3, length: 50, valleyWidth: 44, steps: 3, boulders: 18 }, basin: 60 },
    { id: 'falls', asset: 'waterfall', title: 'Waterfall', group: 'Highlands', attach: { to: 'rapids.inlet', port: 'outlet' }, params: { width: 4, height: 16, length: 64, valleyWidth: 50, style: 'plunge', mistAmount: 0.8 }, basin: 60 },
    { id: 'glacier', asset: 'glacier-tongue', title: 'Glacier Tongue', group: 'Highlands', attach: { to: 'falls.inlet', port: 'outlet' }, params: { meltwater: 0.9, lake: true, length: 140, width: 70 }, fall: 40 },
    // ── Mill stream (joins the middle river from the east) ─────────────────────────────────────────────
    { id: 'mill', asset: 'water-mill', title: 'Water Mill', group: 'Mill Stream', attach: { to: 'middle.tributaryNorth', port: 'outlet' }, params: { wheelType: 'undershot', signText: 'OLD MILL' } },
    { id: 'millbrook', asset: 'mountain-brook', title: 'Mill Stream', group: 'Mill Stream', attach: { to: 'mill.inlet', port: 'outlet' }, params: { source: true, width: 3, length: 40, breadth: 22, slope: 0.05, cascades: 1, bridge: true }, basin: 36 },
    { id: 'farm', asset: 'terrain-tile', title: 'Farmland', group: 'Mill Stream', at: [-8, 0, -132], params: { style: 'farmland', width: 64, depth: 44, relief: 2, showWater: false, showPath: true, edgeBlend: 1 }, y: 2.6 },
    // ── Beaver valley (joins from the west) ────────────────────────────────────────────────────────────
    { id: 'beaver', asset: 'beaver-dam', title: 'Beaver Dam & Pond', group: 'Beaver Valley', attach: { to: 'middle.tributarySouth', port: 'outlet' }, params: { lilies: 16, valleyWidth: 48 } },
    { id: 'beaverbrook', asset: 'mountain-brook', title: 'Beaver Creek', group: 'Beaver Valley', attach: { to: 'beaver.inlet', port: 'outlet' }, params: { source: true, width: 3, length: 40, breadth: 22, slope: 0.06, cascades: 2, bridge: false }, basin: 40 },
    // ── Hot-spring creek (joins the lower river from the north) ────────────────────────────────────────
    { id: 'hotcreek', asset: 'mountain-brook', title: 'Warm Creek', group: 'Geothermal', attach: { to: 'lower.tributaryNorth', port: 'outlet' }, params: { width: 3, length: 30, breadth: 20, slope: 0.04, cascades: 1, bridge: false, ferns: 0.3 }, basin: 30 },
    { id: 'springs', asset: 'hot-spring-terraces', title: 'Hot Spring Terraces', group: 'Geothermal', attach: { to: 'hotcreek.inlet', port: 'outlet' }, params: { tiers: 6 }, colorFall: 6 },
    { id: 'geyser', asset: 'geyser', title: 'Geyser Basin', group: 'Geothermal', at: [30, 0, -52], params: { size: 36, height: 24, interval: 32 }, y: 1.4, colorFall: 5 },
    // ── Lowland water ─────────────────────────────────────────────────────────────────────────────────
    { id: 'oxbow', asset: 'lake-pond', title: 'Oxbow Lake', group: 'Lowlands', at: [-22, 0, 130], params: { size: 60, irregularity: 0.6, lilies: 10, jetty: true, trees: 0.4, depth: 4 }, y: 0.6, basin: 50 },
    { id: 'marsh', asset: 'marsh-wetland', title: 'Marsh', group: 'Lowlands', at: [64, 0, 128], params: { size: 50, boardwalk: true, showHeron: true }, y: 0.35, basin: 40 },
    // ── Underground ───────────────────────────────────────────────────────────────────────────────────
    { id: 'cave', asset: 'cave-pool', title: 'Cave & Drip Pool', group: 'Highlands', at: [-196, 0, -230], yaw: 0, params: { size: 16, height: 7, glowworms: true, opening: 0.2 }, y: 'fit', fitSide: '+z', dy: -0.4, fall: 22 },
    { id: 'aquifer', asset: 'groundwater-cutaway', title: 'Aquifer Cut-away', group: 'Lowlands', at: [-150, 0, 205], params: { chainEnds: true, width: 40, depth: 18 }, y: 2.2, edgeGap: { bottom: -14 } },
    { id: 'aqbrook', asset: 'mountain-brook', title: 'Spring Brook', group: 'Lowlands', attach: { to: 'aquifer.inlet', port: 'outlet' }, params: { source: true, width: 4, length: 36, breadth: 20, slope: 0.03, cascades: 0, bridge: false }, basin: 34 },
    // ── Dressing ──────────────────────────────────────────────────────────────────────────────────────
    { id: 'pines1', asset: 'tree-grove', title: 'Pine Wood', group: 'Highlands', at: [-160, 0, -205], params: { species: 'pine', count: 22, radius: 22, height: 13, showGround: false }, drape: true },
    { id: 'pines2', asset: 'tree-grove', title: 'Spruce Stand', group: 'Highlands', at: [-120, 0, -100], params: { species: 'pine', count: 14, radius: 16, height: 12, showGround: false, seed: 4 }, drape: true },
    { id: 'wood1', asset: 'tree-grove', title: 'Mixed Wood', group: 'River', at: [-10, 0, -10], params: { species: 'mixed', count: 16, radius: 18, height: 11, showGround: false, seed: 12 }, drape: true },
    { id: 'birches', asset: 'tree-grove', title: 'Birch Copse', group: 'Mill Stream', at: [40, 0, -100], params: { species: 'birch', count: 12, radius: 14, height: 10, showGround: false, seed: 7 }, drape: true },
    { id: 'willows', asset: 'tree-grove', title: 'Willows', group: 'Lowlands', at: [24, 0, 100], params: { species: 'willow', count: 7, radius: 12, height: 9, showGround: false, seed: 3 }, drape: true },
    { id: 'wood2', asset: 'tree-grove', title: 'Oak Wood', group: 'Lowlands', at: [-90, 0, 110], params: { species: 'broadleaf', count: 18, radius: 24, height: 12, showGround: false, seed: 21 }, drape: true },
    { id: 'rocks1', asset: 'boulder-cluster', title: 'Moraine Boulders', group: 'Highlands', at: [-250, 0, -110], params: { count: 14, size: 2.2, spread: 12, base: false, colorway: 'glacial' }, drape: true },
    { id: 'rocks2', asset: 'boulder-cluster', title: 'Erratics', group: 'River', at: [-170, 0, -128], params: { count: 7, size: 1.6, spread: 8, base: false, seed: 5 }, drape: true },
    { id: 'reeds1', asset: 'reed-bed', title: 'Lake Reeds', group: 'Lowlands', at: [-50, 0, 112], params: { base: false, width: 22, depth: 18, density: 1.2 }, drape: true, reedDepth: 0.9 },
    { id: 'reeds2', asset: 'reed-bed', title: 'Delta Reeds', group: 'Coast', at: [100, 0, 52], params: { base: false, width: 26, depth: 18, density: 1, mix: 'phragmites' }, drape: true },
    // ── Life and weather ──────────────────────────────────────────────────────────────────────────────
    { id: 'lilies', asset: 'water-lilies', title: 'Water Lilies', group: 'Lowlands', at: [-12, 0, 142], params: { pads: 60, spread: 6, flowers: 0.4 }, float: 'oxbow' },
    { id: 'ducks', asset: 'duck-family', title: 'Duck Family', group: 'Lowlands', at: [-30, 0, 122], params: { pathRadius: 6 }, float: 'oxbow' },
    { id: 'trout', asset: 'fish-school', title: 'Trout', group: 'Lowlands', at: [-20, 0, 135], params: { species: 'trout', tank: false, count: 40, radius: 6, depth: 1.8 }, y: 'water' },
    { id: 'rowboat', asset: 'rowboat', title: 'Rowing Boat', group: 'Lowlands', at: [-10, 0, 128], params: { colorway: 'varnished' }, float: 'oxbow', course: { cx: -18, cz: 132, rx: 13, rz: 9, speed: 1.1, dir: 1 } },
    { id: 'kayak', asset: 'kayak', title: 'Kayak', group: 'River', at: [0, 0, 40], params: { colorway: 'redWhite' }, float: 'auto', course: { along: 'lower', from: 0.08, to: 0.85, speed: 1.4 } },
    { id: 'gulls', asset: 'seagull-flock', title: 'Gulls', group: 'Coast', at: [190, 0, 30], params: { flying: 14, floating: 6, posts: 0, radius: 40, height: 18 }, float: 'sea' },
    { id: 'whale', asset: 'whale', title: 'Humpback', group: 'Coast', at: [330, 0, -60], params: { behaviour: 'breach', pathRadius: 26 }, float: 'sea' },
    { id: 'sloop', asset: 'sailboat', title: 'Sloop', group: 'Coast', at: [290, 0, 90], params: { speed: 5, pointOfSail: 'beam-reach' }, float: 'sea', course: { cx: 300, cz: 60, rx: 60, rz: 90, knots: 5, dir: -1, phase: 1.2 } },
    { id: 'cloud', asset: 'rain-cloud', title: 'Mountain Shower', group: 'Highlands', at: [-300, 0, -60], params: { size: 70, altitude: 70, thickness: 20, precipitation: 'rain', intensity: 0.5 }, y: 'ground' },
    { id: 'mist', asset: 'fog-bank', title: 'Marsh Mist', group: 'Lowlands', at: [40, 0, 130], params: { width: 140, depth: 90, height: 5, density: 0.5, colorway: 'dawn' }, y: 'ground' },
    { id: 'rainbow', asset: 'rainbow', title: 'Rainbow', group: 'Highlands', at: [-196, 0, -163], params: { radius: 12, arc: 0.6, bandWidth: 0.08 }, y: 'ground' },
  ],
  spots: [
    { id: 'source', title: 'Source: glacier & falls', at: [-270, 30, -165], radius: 230 },
    { id: 'valley', title: 'Middle valley', at: [-80, 4, -70], radius: 240 },
    { id: 'lowlands', title: 'Lowlands & lake', at: [10, 2, 90], radius: 210 },
    { id: 'mouth', title: 'Delta & sea', at: [150, 0, 40], radius: 220 },
  ],
};
