# Water World — parametric three.js assets about water

57 standalone, procedural, low-poly assets covering water on Earth — oceans and coasts, rivers and falls, lakes, wetlands and ice, underground and geothermal water, weather, water works, boats and water life — plus a scene that composes them and a browser lab to tweak every parameter.
Every asset animates its water on the GPU (Gerstner swell, flowing streams, falling sheets, foam, caustics, ripples, spray and mist), and floating assets ride the waves of whatever water they are placed on.

## What is in this folder

| Path | What it is |
|---|---|
| `assets/*.mjs` | 57 asset modules. Each is 100% standalone: it imports only `three` and `three/addons/utils/BufferGeometryUtils.js`; no textures, no loaders. |
| `scene.mjs` | **Scene engine**: composes the assets into continuous landscapes — one terrain, one sea, every asset embedded and chained by its ports — importing each module on demand. |
| `scenes/*.mjs` | The four scenes as data: **Source to Sea**, **Harbour Town**, **Tropical Island**, **Polar Fjord**. Between them they place every asset in the catalogue. |
| `index.html` | **Asset Lab**: browse the catalogue, change parameters live, pose rigs, hide parts, copy code — and explore the four scenes. |
| `manifest.json` | Machine-readable catalogue (title, category, blurb, specs, rigs, detachable parts). |

## Run the lab

Browsers refuse ES-module imports from `file://` pages, so serve the folder:

```sh
npx serve .            # or: python3 -m http.server
```

Open the printed address. three.js r170 is imported from cdn.jsdelivr.net at runtime, only when needed (the post-processing add-ons only when you press **Bloom**). Add `#scene/source-to-sea` (or `harbour-town`, `tropical-island`, `polar-fjord`) to the address to open a scene, or `#<asset-name>` (for example `#waterfall`) to open one asset.

## Use an asset

```html
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
} }
</script>
<script type="module">
  import * as THREE from 'three';
  import { createAsset, params, presets, rig, detach, night } from './assets/waterfall.mjs';

  const fall = createAsset({ height: 24, style: 'horsetail', colorway: 'basalt', mergeForProduction: true });
  scene.add(fall);
  renderer.setAnimationLoop((ms) => {
    fall.userData.update(ms / 1000);   // water, particles, rigs — pass absolute seconds
    renderer.render(scene, camera);
  });
</script>
```

Every module exports the same API:

| Export | Meaning |
|---|---|
| `createAsset(opts)` | Builds the asset (a `THREE.Group`) at real-world scale in metres, +Y up, sea level at y = 0, north = −Z. Omitted options take their defaults. |
| `params` | The parameter schema: `{ type: 'range' \| 'choice' \| 'toggle' \| 'color' \| 'text', default, min, max, step, unit, options, label, affects, describe }`. A UI can be generated from it (the lab does exactly that). |
| `COLORWAYS` / `presets` | At least three curated colourways. Each `color` parameter overrides one colour zone on top of the chosen colorway. |
| `rig` | Posable pivots: `{ name: { axis, range, type?, describe } }`. `asset.userData.setRig(name, value)` holds a pose; `setRig(name, null)` hands it back to the animation. |
| `detach` | Names of parts that stay separate meshes even when merged — `asset.getObjectByName(name)` to hide or replace them. |
| `night` | Light metadata (`color, intensity, distance, offset, describe`) so a scene can add point lights at night; `asset.userData.setNight(0…1)` drives the asset's own glows. |

`asset.userData` also carries `update(t)`, `setRig`, `setNight`, `params` (resolved values), `zones` (resolved colours), `triangles`, `view` (a suggested camera target and distance) and, on water assets, `surface.heightAt(x, z, t)` and `addRipple(x, z, t, amp)`.

`mergeForProduction: true` merges each material into one draw call per node; rigged and detachable parts stay separate named meshes so they still animate. Materials are named by role — `solid`, `glass`, `glow`, `water`, `foam`, `sway` — which makes shadow set-up easy: cast from `solid` and `sway`, receive on those plus `water` and `foam`.

### Put things on other water

Boats, buoys, docks, ducks, gulls, lilies and whales carry their own preview patch of sea. In a scene, switch it off and point them at the water they sit on:

```js
import * as oceanSurface from './assets/ocean-surface.mjs';
import * as sailboat from './assets/sailboat.mjs';

const sea = oceanSurface.createAsset({ size: 220, seaState: 3 });
const boat = sailboat.createAsset({ waterPatch: false });
boat.userData.waterSurface = sea.userData.surface;                                  // bob, pitch and roll on these exact waves
boat.userData.matchWaves(sea);                                                       // wakes and foam ride the same swell
boat.userData.onWaterEvent = (x, z, t, a) => sea.userData.addRipple(x, z, t, a);     // oar strokes and splashes ring the sea
```

## Scenes

```js
import { SCENES, createScene } from './scene.mjs';
const world = await createScene('harbour-town', {
  base: './assets/', scenes: './scenes/',       // where the modules live
  quality: 'high',                              // 'medium' / 'low': coarser terrain and sea grids for phones
  onProgress: (done, total, label) => console.log(done, total, label),
});
scene.add(world.root);
renderer.setAnimationLoop((ms) => world.update(ms / 1000));
world.setNight(0.8);              // lamps, windows, beams, bioluminescence
world.spots;                      // camera bookmarks [{ id, title, target, radius, az, el }] — every view clears the hills
world.items;                      // every placed asset { id, name, title, group, object, night, params, follow }
world.env;                        // suggested sky, horizon, fog and sun for the scene
world.heightAt(x, z);             // the ground anywhere (an asset's own ground first, then the terrain)
world.waterAt(x, z, t);           // the water surface anywhere — rivers, lakes, the sea — or null
```

| Scene | What happens in it |
|---|---|
| **Source to Sea** | A glacier tongue sheds meltwater into a waterfall gorge; rapids drop it to a valley where the river bends and meanders, gathering a mill stream (spring → water mill), a beaver valley (creek → beaver pond) and a warm creek from hot-spring terraces beside a geyser basin; it passes an oxbow lake and a marsh and spreads through a delta into the sea. A cave sits in the hillside, and an aquifer cut-away is let into the world's southern edge. |
| **Harbour Town** | A spring feeds a reservoir behind a gated dam; a gorge spanned by a Roman aqueduct leads to a canal lock and a stone bridge in a town of wells, pumps, a fountain square, rain-wet streets, a water tower and a villa pool; the river opens into a harbour between a beach (pier, lifeguard tower) and a sea-cliff arch with tide pools, kelp and a lighthouse islet; a whirlpool and a waterspout lie out at sea. |
| **Tropical Island** | A rainforest stream leaps a waterfall, runs past flooded rice terraces into a mangrove estuary; a palm beach and jetty face a coral lagoon; basalt cliffs with an arch and tide pools face the west; a waterspout spins offshore. |
| **Polar Fjord** | A glacier's meltwater spreads an outwash delta into the head of a fjord; icebergs calve and drift between snowy walls, a frozen tarn sits on a shelf, orcas hunt, a trawler works the water and sea smoke curls off it. |

### How the seams close

- **Chains by ports.** A scene lays an asset's port (`inlet`, `outlet`, `tributaryNorth` …) exactly onto another's — same point, same flow direction, same width — and grows a river from the sea upstream, so every water level falls out of the joins. Assets built with `chainEnds: true` share one river cross-section at their ends, so beds, banks and surfaces run straight on. River reaches can widen (`widthEnd`) and turn 90° (`bend`).
- **One terrain.** Every asset with a ground tile (`userData.ground`) is cut out of a single world heightfield. Around each tile the terrain takes the tile's own edge heights and colours, then eases back into the landscape (`fall`, `basin`), so there is no step and no overlap at any border; a short flange under each tile hides hairline cracks.
- **One sea.** A single ocean surface serves each coast. `setShore` shoals, tints and foams it by the true depth of every beach, reef and river mouth; assets that bring their own sea (delta front, iceberg, whirlpool, waterspout) cut holes in it (`setHoles`) and take its swell (`matchWaves`) and finish, so their rims can't be told apart. Coastal assets switch their own water off (`seaWater: false`) and stand in the ocean.
- **Dressing that settles.** Groves, boulders and reed beds drape onto whatever is under them (`userData.drape`); a tree that would stand in water or a reed clump on dry land is culled.
- **Things afloat** ride the water they are on (`waterSurface`, `matchWaves`) and ring it (`onWaterEvent` → `addRipple`); boats follow their courses.

### Write your own scene

A scene is a plain module (see `scenes/*.mjs`): world `bounds`, a `terrain` (`height(x, z, N)` and `color(x, y, z, slope, N)`, with the noise helpers in `N`), an optional `sea` rectangle, a `palette` applied to every asset's colour zones, and `items`:

```js
{ id: 'mill', asset: 'water-mill', params: { wheelType: 'undershot' },
  attach: { to: 'river.tributaryNorth', port: 'outlet' } }          // or after: 'id' (inlet onto its outlet), at: [x, y, z], on: 'id' + local: [x, z]
{ id: 'pool', asset: 'swimming-pool', at: [-150, 0, 112], y: 'fit' }  // y: number | 'fit' (sit on the landscape) | 'ground' | 'water'
{ id: 'boat', asset: 'sailboat', at: [0, 0, 200], float: 'sea', course: { cx: 0, cz: 260, rx: 120, rz: 30, knots: 5 } }
{ id: 'pines', asset: 'tree-grove', at: [70, 0, -150], params: { showGround: false }, drape: true }
```

## Catalogue

57 assets, 905,689 triangles in total at default settings.

### Oceans & Coasts

| Module | Asset | Triangles | Size W × H × D (m) | Rigs | Detachable parts |
|---|---|---:|---|---|---|
| `ocean-surface.mjs` | Ocean Surface | 12,035 | 160 × 0 × 160 | surface | surface, sides, seabed |
| `beach-shore.mjs` | Beach & Surf | 24,507 | 60 × 20 × 64 |  | vegetation, props |
| `sea-cliff-arch.mjs` | Sea Cliff & Arch | 28,000 | 70 × 31 × 64 |  | arch, stack, spray, mist, vegetation |
| `tide-pool.mjs` | Tide Pools | 10,351 | 24 × 5.75 × 18 | crab | life, seaweed, crab |
| `coral-reef.mjs` | Coral Reef | 26,151 | 30 × 11 × 30 |  | corals, fish-a, fish-b, clownfish, bubbles, surface, caustics |
| `kelp-forest.mjs` | Kelp Forest | 29,703 | 31 × 18 × 32 |  | kelp, fish-a, fish-b, surface, caustics, otter-1, otter-2, otter-3 |
| `iceberg.mjs` | Iceberg & Floes | 16,900 | 104 × 66 × 104 | berg | berg, floes, calf, drips, splash |

### Rivers & Falls

| Module | Asset | Triangles | Size W × H × D (m) | Rigs | Detachable parts |
|---|---|---:|---|---|---|
| `river-channel.mjs` | River Channel | 19,348 | 80 × 23 × 60 |  | vegetation, boulders, debris, twigs |
| `waterfall.mjs` | Waterfall | 15,356 | 64 × 37 × 50 |  | falls, spray, mist, vegetation |
| `rapids-cascade.mjs` | Rapids & Cascade | 13,890 | 50 × 22 × 40 |  | boulders, spray, vegetation |
| `mountain-brook.mjs` | Mountain Brook | 18,032 | 26 × 16 × 18 |  | bridge, vegetation, stones, debris |
| `river-delta.mjs` | River Delta | 35,078 | 100 × 8.9 × 100 |  | vegetation |
| `whirlpool.mjs` | Whirlpool | 5,471 | 86 × 15 × 86 | swirl-1, swirl-5 | swirl-1, swirl-2, swirl-3, swirl-4, swirl-5, flotsam, seabed |
| `beaver-dam.mjs` | Beaver Dam & Pond | 24,817 | 50 × 10 × 40 | beaver | dam, lodge, beaver, snags, vegetation |

### Lakes, Wetlands & Ice

| Module | Asset | Triangles | Size W × H × D (m) | Rigs | Detachable parts |
|---|---|---:|---|---|---|
| `lake-pond.mjs` | Lake & Pond | 33,381 | 80 × 19 × 80 | jumper | jetty, lilies, vegetation, jumper |
| `marsh-wetland.mjs` | Marsh & Wetland | 33,173 | 40 × 4.33 × 40 | neck | boardwalk, heron, vegetation, gas |
| `mangrove-swamp.mjs` | Mangrove Swamp | 26,971 | 36 × 13 × 36 |  | trees, pneumatophores, fish, debris |
| `frozen-lake.mjs` | Frozen Lake | 33,551 | 75 × 17 × 75 |  | ice, snowdrifts, shelter, snowfall, trees |
| `glacier-tongue.mjs` | Glacier Tongue | 20,103 | 140 × 48 × 70 |  | glacier, bergs, meltstream |

### Underground & Geothermal

| Module | Asset | Triangles | Size W × H × D (m) | Rigs | Detachable parts |
|---|---|---:|---|---|---|
| `cave-pool.mjs` | Cave & Drip Pool | 9,513 | 18 × 9.36 × 18 |  | vault, formations, crystals, glowworms, drips |
| `groundwater-cutaway.mjs` | Groundwater Cut-away | 15,570 | 40 × 30 × 18 |  | labels, pumphouse, cloud, flow |
| `geyser.mjs` | Geyser Basin | 22,749 | 36 × 6.16 × 36 | vent | column, steam, fumaroles, splash |
| `hot-spring-terraces.mjs` | Hot Spring Terraces | 21,178 | 24 × 9.31 × 24 |  | cascades, steam |

### Weather & Sky

| Module | Asset | Triangles | Size W × H × D (m) | Rigs | Detachable parts |
|---|---|---:|---|---|---|
| `rain-cloud.mjs` | Rain Cloud & Precipitation | 36,558 | 39 × 11 × 29 | cloud | cloud, precipitation, splashes, splash-drops, bolt-1, bolt-2, bolt-3 |
| `fog-bank.mjs` | Fog Bank & Mist | 9,122 | 0.01 × 0 × 0.01 |  | fog |
| `waterspout.mjs` | Waterspout | 11,371 | 66 × 90 × 61 | funnel | funnel, cloud, spray, sea |
| `rainbow.mjs` | Rainbow | 1,792 | 99 × 44 × 0 |  | primary, secondary |
| `puddles.mjs` | Rain Puddles | 27,356 | 12 × 5.2 × 12 |  | lamp, drain, rainfall |

### Water Works & Buildings

| Module | Asset | Triangles | Size W × H × D (m) | Rigs | Detachable parts |
|---|---|---:|---|---|---|
| `water-mill.mjs` | Water Mill | 14,048 | 20 × 13 × 25 | wheel, door, sluice | wheel, door, flume, roof, interior, sluice, spill |
| `dam-spillway.mjs` | Dam & Spillway | 43,330 | 174 × 43 × 110 | gate-1, gate-2, gate-3, door | gate-1, gate-2, gate-3, gate-4, gate-5, gate-6, powerhouse, door, spillway-flow |
| `canal-lock.mjs` | Canal Lock | 17,274 | 44 × 11 × 28 | chamber, gate-upper-left, gate-upper-right, gate-lower-left, gate-lower-right, hut-door | chamber, gate-upper-left, gate-upper-right, gate-lower-left, gate-lower-right, hut, hut-door |
| `stone-aqueduct.mjs` | Stone Aqueduct | 9,840 | 60 × 32 × 30 |  | channel, rubble, spill |
| `stone-bridge.mjs` | Stone Arch Bridge | 19,442 | 40 × 18 × 64 |  | parapets, lamps, cutwaters |
| `water-well.mjs` | Village Well | 5,092 | 6 × 9.62 × 6 | windlass, bucket, rope | roof, windlass, bucket, rope |
| `hand-pump-trough.mjs` | Hand Pump & Trough | 4,224 | 4.55 × 2.08 × 4.5 | lever, rod | lever, rod, stream, trough |
| `fountain-plaza.mjs` | Fountain Plaza | 10,295 | 18 × 6.41 × 18 |  | curtains, arcs, jet, plaza-props, coins |
| `water-tower.mjs` | Water Tower | 7,555 | 22 × 34 × 22 |  | tank, ladder, catwalk, overflow, beacon-light |
| `rice-terraces.mjs` | Rice Terraces | 42,055 | 40 × 15 × 37 |  | rice, trickles, flume |
| `lighthouse.mjs` | Lighthouse | 12,046 | 161 × 38 × 40 | lamp, door | lamp, door, interior, islet, lantern-room |
| `wooden-pier.mjs` | Wooden Pier | 16,450 | 30 × 12 × 62 |  | railing, lamps, ladder, props |
| `lifeguard-tower.mjs` | Lifeguard Tower | 6,018 | 14 × 7.6 × 15 | door | door, flags, gear, ramp |
| `swimming-pool.mjs` | Swimming Pool | 6,462 | 18 × 5.65 × 13 | board | board, spa, ladder, floaty, furniture, lane-ropes |

### Boats & Floating

| Module | Asset | Triangles | Size W × H × D (m) | Rigs | Detachable parts |
|---|---|---:|---|---|---|
| `rowboat.mjs` | Rowboat | 6,286 | 16 × 3.73 × 19 | oar-port, oar-port-dip, oar-starboard, oar-starboard-dip, rower | oar-port, oar-starboard, rower, wake, water-patch |
| `sailboat.mjs` | Sailboat | 7,973 | 37 × 15 × 50 | boom, rudder, hatch | mainsail, jib, boom, rigging, rudder, cabin, wake, water-patch |
| `kayak.mjs` | Sea Kayak | 5,072 | 15 × 3.18 × 22 | paddle-yaw, paddle, paddler | paddler, paddle-yaw, wake, water-patch |
| `fishing-boat.mjs` | Fishing Boat | 13,758 | 48 × 9.94 × 76 | door, outrigger-port, outrigger-starboard, net-drum, propeller, radar, rudder | house, outrigger-port, outrigger-starboard, gear, net-drum, wake, water-patch |
| `channel-buoy.mjs` | Navigation Buoy | 1,973 | 13 × 9.57 × 13 |  | buoy, chain, water-patch |
| `floating-dock.mjs` | Floating Dock | 7,063 | 25 × 6.79 × 25 | gangway | gangway, piles, water-patch |

### Water Life

| Module | Asset | Triangles | Size W × H × D (m) | Rigs | Detachable parts |
|---|---|---:|---|---|---|
| `fish-school.mjs` | Fish School | 8,848 | 14 × 6.35 × 11 |  | school, tank |
| `water-lilies.mjs` | Water Lilies | 4,658 | 12 × 1.51 × 12 |  | lily-pads, lily-flowers, lily-stems, frog, dragonflies, water-patch |
| `reed-bed.mjs` | Reed Bed | 5,386 | 10 × 4.45 × 7.24 |  | reeds, irises |
| `duck-family.mjs` | Duck Family | 3,254 | 12 × 1.53 × 12 |  | mother, mate, water-patch |
| `whale.mjs` | Whale | 20,715 | 70 × 16 × 70 | tail, flukes, flipper-l, flipper-r | whale-body, water-patch |
| `seagull-flock.mjs` | Seagulls | 7,004 | 30 × 6.1 × 30 |  | flock, posts, water-patch |

### Land & Dressing

| Module | Asset | Triangles | Size W × H × D (m) | Rigs | Detachable parts |
|---|---|---:|---|---|---|
| `terrain-tile.mjs` | Terrain Tile | 6,924 | 40 × 7.12 × 40 |  | scatter, hedges |
| `tree-grove.mjs` | Tree Grove | 6,075 | 24 × 11 × 24 |  | trees, undergrowth, ground |
| `boulder-cluster.mjs` | Boulder Cluster | 4,542 | 16 × 3.36 × 16 |  | rocks, pebbles, base |

## Licence

MIT — free for personal and commercial use, modification and redistribution; keep the header comment in each module.
