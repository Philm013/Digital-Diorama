/*
 * HARBOUR TOWN — a river engineered from source to sea: a reservoir dam, a gorge spanned by an old aqueduct, a
 * canal lock and a stone bridge carry it through a little town to a harbour between a beach and a sea-cliff headland.
 * The chain is anchored at the bridge (sea level) and grows upstream. +X east, +Z south (the sea), sea level 0.
 */
// the coast bends in to a harbour basin at the river mouth, between the beach (west) and the tide pools (east)
const shoreZ = (x) => 198 - 56 * Math.exp(-((x / 36) ** 2)) + 4 * Math.sin(x / 41 + 1) - 6 * Math.exp(-(((x - 112) / 40) ** 2));
export default {
  id: 'harbour-town',
  title: 'Harbour Town',
  blurb: 'A reservoir dam spills into a gorge spanned by a Roman aqueduct; a canal lock and a stone bridge carry the river through a town of wells, pumps, a fountain square and rain-wet streets, out to a harbour with a beach and pier, a sea-cliff arch and tide pools, a lighthouse islet, kelp, a whirlpool and a waterspout.',
  bounds: [-330, -340, 330, 330],
  baseY: -26,
  palette: {
    land: { grass: '#86a95c', grassDark: '#668c47', meadow: '#86a95c', meadowDark: '#668c47', ground: '#86a95c', groundDark: '#668c47', floor: '#76a052', floorDark: '#668c47', moss: '#6f9548', soil: '#7a5c3e', rock: '#9a958a', rockDark: '#7a766e', gravel: '#a9a08c', sand: '#e3d3a6', mud: '#6f5a44' },
    fresh: { water: '#3f8ea2', deep: '#22607a' },
    sea: { water: '#2e86a8', deep: '#155a7a', shallow: '#5cc0bf' },
  },
  env: { sky: '#9fcbe8', horizon: '#e4f0f4', fog: '#d3e5ec', fogNear: 420, fogFar: 2400, sun: [0.5, 0.82, 0.32] },
  skirt: ['#6e5236', '#5e4632', '#5a524a'],
  sectionWater: '#1d6488',
  terrain: {
    res: 3,
    height(x, z, N) {
      let land = 5 + 1.6 * (N.fbm(x / 60, z / 60, 2, 3) - 0.5);
      // hills climb to the north; a ridge crosses the river where the aqueduct spans the gorge
      land += 36 * N.smooth(-20, -230, z) * (0.55 + 0.6 * N.ridged(x / 120, z / 120, 3, 4));
      land += 24 * Math.exp(-(((z + 85) / 26) ** 2)) * N.smooth(20, 70, Math.abs(x));
      // a low hill for the water tower and the headland behind the cliffs
      land += 9 * Math.exp(-(((x - 80) / 45) ** 2) - (((z - 30) / 40) ** 2));
      land += 14 * N.smooth(40, 120, x) * N.smooth(60, 150, z) * N.smooth(250, 160, z);
      const sz = shoreZ(x), sea = N.smooth(sz - 14, sz + 6, z);
      return N.lerp(land, -0.6 - 3.4 * N.smooth(sz, sz + 45, z) - 10 * N.smooth(sz + 30, sz + 170, z) + 1.2 * (N.fbm(x / 50, z / 50, 6, 3) - 0.5), sea);
    },
    color(x, y, z, slope, N) {
      if (y < 1.2 && z > shoreZ(x) - 30) return y < -0.6 ? N.mix('#cdbf93', '#2f5560', N.smooth(-2, -13, y)) : '#e3d3a6';
      if (slope > 0.6) return N.noise2(x * 0.08, z * 0.08, 3) > 0.5 ? '#9a958a' : '#837f76';
      return N.mix('#8aad60', '#678d48', N.smooth(0.3, 0.7, N.fbm(x / 34, z / 34, 7, 3)) * 0.85 + N.hash2(x, z, 3) * 0.15);
    },
  },
  sea: {
    rect: [-330, 118, 330, 330],
    cell: 2.6,
    item: { params: { seaState: 3, swellDir: 255, wavelength: 32, choppiness: 0.5 }, title: 'The Sea', group: 'Harbour' },
    calm: [{ x: 0, z: 146, r: 60, k: 0.12, tint: 0.2 }, { x: -20, z: 200, r: 90, k: 0.45 }],
  },
  roads: [
    { pts: [[-22, 120], [-34, 104], [-46, 84], [-52, 66]], w: 6, color: '#b9ab8e', verge: '#a5976f' },
    { pts: [[22, 120], [44, 96], [62, 64], [74, 42]], w: 6, color: '#b9ab8e', verge: '#a5976f' },
    { pts: [[-46, 60], [-70, 54], [-88, 50], [-112, 30], [-140, 18]], w: 4.5, color: '#b9ab8e' },
    { pts: [[-62, 70], [-96, 96], [-140, 108], [-150, 112]], w: 4.5, color: '#b9ab8e' },
    { pts: [[-60, 120], [-70, 140], [-82, 150]], w: 4, color: '#c8b994' },
  ],
  items: [
    // ── The river, anchored at the bridge and grown upstream ───────────────────────────────────────────
    { id: 'bridge', asset: 'stone-bridge', title: 'Stone Bridge', group: 'Town', at: [0, 0, 120], yaw: -90, params: { chainEnds: true, span: 14, arches: 2, deckWidth: 7, clearance: 2.2, lamps: true } },
    { id: 'townriver', asset: 'river-channel', title: 'Town River', group: 'Town', attach: { to: 'bridge.inlet', port: 'outlet' }, params: { length: 90, valleyWidth: 60, width: 14, meander: 0.25, trees: 0.15, reeds: 0.25, boulders: 2, depth: 2, colorway: 'default' }, basin: 40 },
    { id: 'lock', asset: 'canal-lock', title: 'Canal Lock', group: 'Town', attach: { to: 'townriver.inlet', port: 'outlet' }, params: { width: 14, rise: 3, length: 56, chamberLength: 26, cycleTime: 48 } },
    { id: 'gorge', asset: 'river-channel', title: 'Gorge Reach', group: 'Gorge', attach: { to: 'lock.inlet', port: 'outlet' }, params: { length: 70, valleyWidth: 56, width: 14, meander: 0.2, trees: 0.25, boulders: 10, depth: 1.8 } },
    { id: 'dam', asset: 'dam-spillway', title: 'Dam & Spillway', group: 'Reservoir', attach: { to: 'gorge.inlet', port: 'outlet' }, params: { height: 22, crestLength: 80, outflowWidth: 14, inletWidth: 5, gates: 3, gateOpen: 0.55, arch: 0.35 }, fall: 34 },
    { id: 'feeder', asset: 'mountain-brook', title: 'Feeder Stream', group: 'Reservoir', attach: { to: 'dam.inlet', port: 'outlet' }, params: { source: true, width: 5, length: 40, breadth: 26, slope: 0.04, cascades: 1, bridge: false } },
    { id: 'aqueduct', asset: 'stone-aqueduct', title: 'Aqueduct', group: 'Gorge', at: [0, 0, -84], params: { site: 'structure', length: 136, height: 21, tiers: 2, archSpan: 8, footing: 5, portals: true, channelWidth: 1.4, colorway: 'ancient' }, footprint: false, y: 1.6 },
    // ── Town ──────────────────────────────────────────────────────────────────────────────────────────
    { id: 'plaza', asset: 'fountain-plaza', title: 'Fountain Square', group: 'Town', at: [-55, 0, 60], params: { tiers: 2, basinRadius: 4.2, jets: 8 }, y: 'fit', colorFall: 2 },
    { id: 'street', asset: 'puddles', title: 'Rain-wet Street', group: 'Town', at: [-55, 0, 83], params: { size: 12, surface: 'cobblestone', puddles: 6, rainAmount: 0.6, showLamp: true }, y: 'fit', colorFall: 2 },
    { id: 'well', asset: 'water-well', title: 'Village Well', group: 'Town', at: [-86, 0, 46], params: { showRoof: true }, y: 'fit', colorFall: 2 },
    { id: 'pump', asset: 'hand-pump-trough', title: 'Hand Pump', group: 'Town', at: [-118, 0, 22], params: { trough: 'stone' }, y: 'fit', colorFall: 2 },
    { id: 'tower', asset: 'water-tower', title: 'Water Tower', group: 'Town', at: [82, 0, 30], params: { height: 22, townName: 'PORTHAVEN', style: 'cylinder' }, y: 'fit', colorFall: 2 },
    { id: 'pool', asset: 'swimming-pool', title: 'Villa Pool', group: 'Town', at: [-150, 0, 112], params: { shape: 'kidney', length: 11, width: 6 }, y: 'fit', colorFall: 2 },
    // ── Coast ─────────────────────────────────────────────────────────────────────────────────────────
    { id: 'beach', asset: 'beach-shore', title: 'Beach', group: 'Harbour', pal: 'sea', at: [-112, 0, 182], yaw: 180, params: { seaWater: false, width: 140, depth: 70, vegetation: 'dunegrass', rocks: 6, driftwood: 4, waveHeight: 0.8 }, fall: 50 },
    { id: 'cliff', asset: 'sea-cliff-arch', title: 'Sea Cliff & Arch', group: 'Harbour', pal: 'sea', at: [112, 0, 188], yaw: 180, params: { seaWater: false, cliffHeight: 20, archSpan: 14, stackHeight: 14 }, fall: 40 },
    { id: 'pools', asset: 'tide-pool', title: 'Tide Pools', group: 'Harbour', pal: 'sea', at: [50, 0, 198], yaw: 180, params: { seaWater: false, pools: 6 }, fall: 40 },
    { id: 'kelp', asset: 'kelp-forest', title: 'Kelp Forest', group: 'Harbour', pal: 'sea', at: [70, 0, 262], params: { seaWater: false, size: 34, depth: 10, otters: 2 }, y: -10, fall: 50 },
    { id: 'lighthouse', asset: 'lighthouse', title: 'Lighthouse', group: 'Harbour', at: [176, 0, 268], params: { islet: true, seaPatch: false, height: 24, waterDepth: 13 }, float: 'sea', fixedY: true },
    { id: 'whirl', asset: 'whirlpool', title: 'Whirlpool', group: 'Open Sea', pal: 'sea', at: [236, 0, 292], params: { radius: 16, seaScale: 2.4, spin: 1.1 }, seaHole: 'auto' },
    { id: 'spout', asset: 'waterspout', title: 'Waterspout', group: 'Open Sea', pal: 'sea', at: [-226, 0, 290], params: { height: 90, seaSize: 50, cloudSize: 70 }, seaHole: 'auto' },
    { id: 'pier', asset: 'wooden-pier', title: 'Pier', group: 'Harbour', at: [-92, 0, 192], params: { site: 'structure', length: 52, deckHeight: 2.4, waterDepth: 4, lamps: 4 }, fixedY: true, footprint: false },
    { id: 'lifeguard', asset: 'lifeguard-tower', title: 'Lifeguard Tower', group: 'Harbour', on: 'beach', local: [36, 6], yaw: 0, params: { base: false, towerName: 'TOWER 3' } },
    // ── Afloat ────────────────────────────────────────────────────────────────────────────────────────
    { id: 'dock', asset: 'floating-dock', title: 'Floating Dock', group: 'Harbour', at: [34, 0, 176], yaw: 90, params: { layout: 'L', sections: 5, waterDepth: 5 }, float: 'sea' },
    { id: 'trawler', asset: 'fishing-boat', title: 'Trawler', group: 'Harbour', at: [0, 0, 230], params: { speed: 6, outriggers: 'fishing', gear: 'trawler', boatName: 'MARY ROSE' }, float: 'sea', course: { cx: 10, cz: 262, rx: 110, rz: 34, knots: 6, dir: -1, phase: 2.2 } },
    { id: 'sloop', asset: 'sailboat', title: 'Sloop', group: 'Open Sea', at: [-100, 0, 280], params: { speed: 5, pointOfSail: 'beam-reach', tack: 'port' }, float: 'sea', course: { cx: -60, cz: 286, rx: 120, rz: 26, knots: 5, dir: 1, phase: 0.4 } },
    { id: 'dinghy', asset: 'rowboat', title: 'Dinghy', group: 'Harbour', at: [-40, 0, 200], params: { colorway: 'harbourBlue' }, float: 'sea', course: { cx: -36, cz: 204, rx: 14, rz: 10, speed: 1.2, dir: 1 } },
    { id: 'kayak', asset: 'kayak', title: 'Kayak', group: 'Town', at: [0, 0, 60], params: { colorway: 'lime' }, float: 'auto', course: { along: 'townriver', from: 0.1, to: 0.9, speed: 1.5 } },
    { id: 'green', asset: 'channel-buoy', title: 'Starboard-hand Buoy', group: 'Harbour', at: [22, 0, 246], params: { buoyType: 'lighted', numberText: '3', waterDepth: 10 }, float: 'sea' },
    { id: 'red', asset: 'channel-buoy', title: 'Port-hand Buoy', group: 'Harbour', at: [-22, 0, 246], params: { buoyType: 'nun', colorway: 'redLateral', numberText: '4', showLight: false, waterDepth: 10 }, float: 'sea' },
    { id: 'mooring', asset: 'channel-buoy', title: 'Mooring Buoy', group: 'Harbour', at: [-30, 0, 226], params: { buoyType: 'mooring', colorway: 'safeWater', showLight: false, waterDepth: 6 }, float: 'sea' },
    { id: 'whale', asset: 'whale', title: 'Humpback', group: 'Open Sea', at: [60, 0, 305], params: { behaviour: 'breach', pathRadius: 22 }, float: 'sea' },
    { id: 'gulls', asset: 'seagull-flock', title: 'Gulls', group: 'Harbour', at: [-10, 0, 200], params: { flying: 16, floating: 8, posts: 0, radius: 46, height: 16 }, float: 'sea' },
    { id: 'sardines', asset: 'fish-school', title: 'Sardine School', group: 'Harbour', at: [-60, 0, 236], params: { species: 'sardine', tank: false, count: 120, radius: 7, depth: 3 }, y: 'water' },
    { id: 'swans', asset: 'duck-family', title: 'Swans', group: 'Reservoir', on: 'dam', local: [-40, 10], params: { species: 'swan', colorway: 'swan', youngAmount: 4, pathRadius: 8 }, float: 'dam' },
    // ── Dressing & weather ────────────────────────────────────────────────────────────────────────────
    { id: 'grove1', asset: 'tree-grove', title: 'Gorge Woods', group: 'Gorge', at: [-62, 0, -30], params: { species: 'mixed', count: 18, radius: 22, height: 12, showGround: false }, drape: true },
    { id: 'grove2', asset: 'tree-grove', title: 'Hill Pines', group: 'Reservoir', at: [70, 0, -150], params: { species: 'pine', count: 22, radius: 28, height: 13, showGround: false, seed: 5 }, drape: true },
    { id: 'grove3', asset: 'tree-grove', title: 'Park Trees', group: 'Town', at: [-96, 0, 78], params: { species: 'broadleaf', count: 9, radius: 14, height: 10, showGround: false, seed: 9 }, drape: true },
    { id: 'grove4', asset: 'tree-grove', title: 'Villa Garden', group: 'Town', at: [-176, 0, 92], params: { species: 'mixed', count: 8, radius: 12, height: 9, showGround: false, seed: 17 }, drape: true },
    { id: 'grove5', asset: 'tree-grove', title: 'East Copse', group: 'Town', at: [120, 0, 70], params: { species: 'birch', count: 12, radius: 18, height: 10, showGround: false, seed: 23 }, drape: true },
    { id: 'grove6', asset: 'tree-grove', title: 'Hillside Wood', group: 'Hills', at: [190, 0, -40], params: { species: 'broadleaf', count: 22, radius: 30, height: 12, showGround: false, seed: 31 }, drape: true },
    { id: 'grove7', asset: 'tree-grove', title: 'Pine Ridge', group: 'Hills', at: [210, 0, 60], params: { species: 'pine', count: 18, radius: 26, height: 12, showGround: false, seed: 37 }, drape: true },
    { id: 'grove8', asset: 'tree-grove', title: 'West Woods', group: 'Hills', at: [-210, 0, -40], params: { species: 'mixed', count: 22, radius: 30, height: 12, showGround: false, seed: 41 }, drape: true },
    { id: 'grove9', asset: 'tree-grove', title: 'Orchard Copse', group: 'Hills', at: [-160, 0, -150], params: { species: 'broadleaf', count: 14, radius: 22, height: 10, showGround: false, seed: 43 }, drape: true },
    { id: 'tors', asset: 'boulder-cluster', title: 'Tors', group: 'Hills', at: [150, 0, -120], params: { style: 'slabs', count: 8, size: 2.4, spread: 12, base: false }, drape: true },
    { id: 'rocks', asset: 'boulder-cluster', title: 'Gorge Boulders', group: 'Gorge', at: [36, 0, -60], params: { count: 10, size: 2, spread: 10, base: false }, drape: true },
    { id: 'reeds', asset: 'reed-bed', title: 'Reservoir Reeds', group: 'Reservoir', on: 'dam', local: [-62, 26], params: { base: false, width: 20, depth: 14 }, drape: true },
    { id: 'shower', asset: 'rain-cloud', title: 'Passing Shower', group: 'Town', at: [-60, 0, 76], params: { size: 46, altitude: 34, thickness: 14, precipitation: 'rain', intensity: 0.45 }, y: 'ground' },
    { id: 'seafog', asset: 'fog-bank', title: 'Sea Fog', group: 'Open Sea', at: [-150, 0, 300], params: { width: 220, depth: 60, height: 7, density: 0.45, colorway: 'sea' }, y: 0, fixedY: true },
  ],
  spots: [
    { id: 'harbour', title: 'Harbour', at: [0, 2, 210], radius: 230 },
    { id: 'town', title: 'Town', at: [-30, 6, 80], radius: 170 },
    { id: 'gorge-view', title: 'Gorge & aqueduct', at: [0, 12, -80], radius: 170 },
    { id: 'reservoir', title: 'Reservoir', at: [0, 20, -200], radius: 230 },
    { id: 'headland', title: 'Headland & lighthouse', at: [140, 6, 230], radius: 170 },
  ],
};
