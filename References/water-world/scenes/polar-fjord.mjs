/*
 * POLAR FJORD — a valley glacier sheds its meltwater river across an outwash delta into the head of a fjord;
 * icebergs drift down the fjord between snowy walls, a frozen tarn sits on a shelf above, orcas hunt and a trawler
 * works the cold water. The chain is anchored at the delta (sea level). +X east (out to sea), +Z south.
 */
const zc = (x) => 12 * Math.sin(x / 110);
const halfW = (x, N) => 78 + 52 * N.smooth(-100, 340, x);
export default {
  id: 'polar-fjord',
  title: 'Polar Fjord',
  blurb: 'A glacier tongue melts into a braided river that spreads an outwash delta into the head of a fjord; icebergs calve and drift between snowy walls, a frozen tarn hangs on a shelf, orcas hunt, a trawler works the cold water and sea smoke curls off the surface.',
  bounds: [-360, -270, 360, 270],
  baseY: -40,
  palette: {
    land: { grass: '#9aa88a', grassDark: '#7d8c70', meadow: '#9aa88a', meadowDark: '#7d8c70', ground: '#a6ae98', groundDark: '#87907c', plain: '#a8ae94', levee: '#9aa287', marsh: '#8a9a78', floor: '#8c9a7c', floorDark: '#77856a', moss: '#7f8f6c', soil: '#5e5248', rock: '#6f7378', rockDark: '#53575c', gravel: '#9a968c', sand: '#b7ae98', mud: '#5e564a' },
    fresh: { water: '#5aa7b5', deep: '#2b6f82' },
    sea: { water: '#2c6f88', deep: '#123e56', shallow: '#4f9aa6' },
  },
  env: { sky: '#b9d3e4', horizon: '#eef4f7', fog: '#dde8ee', fogNear: 360, fogFar: 2200, sun: [0.65, 0.5, 0.2] },
  skirt: ['#6a5e52', '#58504a', '#4a4c50'],
  sectionWater: '#14506a',
  terrain: {
    res: 3.2,
    height(x, z, N) {
      const w = halfW(x, N), d = Math.abs(z - zc(x));
      const peaks = 46 + 82 * (0.45 + 0.75 * N.ridged(x / 130, z / 130, 2, 5));
      const fjordFloor = -5 - 34 * N.smooth(-140, 80, x) * (1 - N.smooth(w * 0.35, w * 1.02, d)) + 2 * (N.fbm(x / 50, z / 50, 5, 3) - 0.5);
      const slopes = 3 + peaks * N.smooth(w - 4, w + 150, d) ** 0.8;
      let y = N.lerp(fjordFloor, slopes, N.smooth(w - 18, w + 22, d));
      // the head of the fjord: an outwash plain climbing west into the glacier's valley
      const head = N.smooth(-95, -175, x);
      y = N.lerp(y, Math.max(y, 2.5 + 0.06 * Math.max(0, -x - 175) + peaks * N.smooth(36, 150, Math.abs(z)) ** 0.9), head);
      return y;
    },
    color(x, y, z, slope, N) {
      if (slope > 0.62) return N.noise2(x * 0.06, z * 0.06, 2) > 0.5 ? '#6f7378' : '#5c6066';
      if (y > 70) return slope > 0.38 ? '#8a8d92' : '#f4f8fb';
      if (y > 38) return slope > 0.3 ? '#7c8086' : N.mix('#e8eff4', '#c9d6de', N.noise2(x * 0.05, z * 0.05, 4));
      if (y < 1.2) return y < -0.6 ? N.mix('#8a8578', '#2f3d47', N.smooth(-2, -14, y)) : '#a39c88';
      return N.mix('#9aa88a', '#7d8c70', N.smooth(0.3, 0.7, N.fbm(x / 30, z / 30, 7, 3)));
    },
  },
  sea: {
    rect: [-205, -200, 360, 200],
    cell: 3.2,
    calm: [{ x: -136, z: 0, r: 60, tint: 0.45 }],
    item: { params: { seaState: 1, swellDir: 175, wavelength: 26, choppiness: 0.35, colorway: 'arctic' }, title: 'The Fjord', group: 'Fjord' },
  },
  items: [
    // ── Glacier to fjord, anchored at the delta ────────────────────────────────────────────────────────
    { id: 'delta', asset: 'river-delta', title: 'Outwash Delta', group: 'Fjord Head', at: [-150, 0, 0], params: { colorway: 'arctic', chainEnds: true, mainWidth: 4.2, branches: 6, vegetation: 0.15, seaWater: false, length: 100, breadth: 100 }, seaHole: 'auto', basin: 40 },
    { id: 'glacier', asset: 'glacier-tongue', title: 'Glacier Tongue', group: 'Glacier', attach: { to: 'delta.inlet', port: 'outlet' }, params: { colorway: 'polar', meltwater: 1, lake: false, length: 140, width: 70, crevasses: 0.8, retreat: 0.25 }, fall: 40 },
    { id: 'tarn', asset: 'frozen-lake', title: 'Frozen Tarn', group: 'Shelf', at: [-104, 0, -112], params: { size: 32, iceCover: 0.9, snowAmount: 0.6, fishingHole: true, ridge: true }, y: 'fit', fall: 34, basin: 70 },
    // ── The fjord ─────────────────────────────────────────────────────────────────────────────────────
    { id: 'berg1', asset: 'iceberg', title: 'Tabular Iceberg', group: 'Fjord', pal: 'sea', at: [56, 0, 14], params: { shape: 'tabular', length: 40, freeboard: 10, floes: 16, calving: true }, seaHole: 'auto' },
    { id: 'berg2', asset: 'iceberg', title: 'Pinnacle Iceberg', group: 'Fjord', pal: 'sea', at: [214, 0, -36], params: { shape: 'pinnacle', length: 28, freeboard: 18, floes: 10, calving: false, seed: 7 }, seaHole: 'auto' },
    { id: 'cliff', asset: 'sea-cliff-arch', title: 'Granite Arch', group: 'Fjord Mouth', pal: 'sea', at: [262, 0, 128], params: { seaWater: false, colorway: 'granite', cliffHeight: 30, archSpan: 12, stackHeight: 20 }, fall: 46 },
    { id: 'orca1', asset: 'whale', title: 'Orca', group: 'Fjord', at: [-10, 0, 40], params: { species: 'orca', colorway: 'orca', length: 7, behaviour: 'cruise', pathRadius: 18 }, float: 'sea' },
    { id: 'orca2', asset: 'whale', title: 'Orca Calf', group: 'Fjord', at: [6, 0, 54], params: { species: 'orca', colorway: 'orca', length: 4.5, behaviour: 'cruise', pathRadius: 16, seed: 9 }, float: 'sea' },
    { id: 'trawler', asset: 'fishing-boat', title: 'Trawler', group: 'Fjord', at: [140, 0, 30], params: { colorway: 'redTrawler', speed: 5, gear: 'trawler', boatName: 'NORDKAPP', showSmoke: true }, float: 'sea', course: { cx: 120, cz: 6, rx: 170, rz: 34, knots: 5, dir: 1, phase: 1 } },
    { id: 'dock', asset: 'floating-dock', title: 'Landing Stage', group: 'Fjord Head', at: [-60, 0, 63], yaw: 180, params: { layout: 'L', sections: 4, waterDepth: 6, colorway: 'composite' }, float: 'sea' },
    { id: 'skiff', asset: 'rowboat', title: 'Skiff', group: 'Fjord Head', at: [-49, 0, 58], params: { colorway: 'dory', rowing: false }, float: 'sea' },
    { id: 'buoy', asset: 'channel-buoy', title: 'Cardinal Buoy', group: 'Fjord', at: [120, 0, -50], params: { buoyType: 'spar', colorway: 'cardinal', showLight: true, numberText: 'N', waterDepth: 18 }, float: 'sea' },
    { id: 'kayak', asset: 'kayak', title: 'Sea Kayak', group: 'Fjord Head', at: [-70, 0, 10], params: { colorway: 'redWhite' }, float: 'sea', course: { cx: -40, cz: 10, rx: 30, rz: 16, speed: 1.4, dir: -1 } },
    { id: 'gulls', asset: 'seagull-flock', title: 'Kittiwakes', group: 'Fjord', at: [90, 0, 20], params: { colorway: 'blackBacked', flying: 14, floating: 6, posts: 0, radius: 44, height: 18 }, float: 'sea' },
    // ── Dressing & weather ────────────────────────────────────────────────────────────────────────────
    { id: 'pines1', asset: 'tree-grove', title: 'Spruce Stand', group: 'Fjord Head', at: [-90, 0, 110], params: { species: 'pine', count: 16, radius: 24, height: 11, showGround: false, colorway: 'winter' }, drape: true },
    { id: 'pines2', asset: 'tree-grove', title: 'Birch & Spruce', group: 'Fjord Head', at: [-70, 0, -100], params: { species: 'mixed', count: 14, radius: 20, height: 9, showGround: false, colorway: 'winter', seed: 6 }, drape: true },
    { id: 'moraine', asset: 'boulder-cluster', title: 'Terminal Moraine', group: 'Glacier', at: [-196, 0, 40], params: { count: 16, size: 2.2, spread: 14, base: false, colorway: 'glacial' }, drape: true },
    { id: 'erratics', asset: 'boulder-cluster', title: 'Erratics', group: 'Shelf', at: [-60, 0, -120], params: { count: 6, size: 2.6, spread: 9, base: false, colorway: 'glacial', seed: 3 }, drape: true },
    { id: 'snow', asset: 'rain-cloud', title: 'Snow Squall', group: 'Glacier', at: [-270, 0, -10], params: { colorway: 'default', size: 90, altitude: 60, thickness: 22, precipitation: 'snow', intensity: 0.55 }, y: 'ground' },
    { id: 'smoke', asset: 'fog-bank', title: 'Sea Smoke', group: 'Fjord', at: [110, 0, 10], params: { colorway: 'sea', width: 240, depth: 110, height: 6, density: 0.4, wind: 0.8, windDir: 90 }, y: 0, fixedY: true },
  ],
  spots: [
    { id: 'fjord', title: 'Fjord', at: [40, 10, 0], radius: 430 },
    { id: 'head', title: 'Glacier & delta', at: [-200, 10, 0], radius: 220 },
    { id: 'bergs', title: 'Icebergs', at: [120, 4, 0], radius: 220 },
    { id: 'shelf', title: 'Frozen tarn', item: 'tarn', radius: 110 },
  ],
};
