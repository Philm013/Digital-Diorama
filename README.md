# Digital Diorama

**The classroom shoebox diorama, reimagined as a living 3D habitat you can build, explore, code and present.**

Students pick a biome, sculpt the land, fill it with real species from a library of 250+ procedural plants, animals, fungi and habitat features, label what they learned on toothpick flags, then bring it to life with Scratch-style block code — and finally present it with a narrated guided tour. Runs in any modern desktop or mobile browser; projects save on the device, with no accounts.

Everything 3D is built from the procedural three.js assets already in [`References/`](References) — they are imported in place, untouched, and code-split so each one only loads when used.

---

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Open the printed address. The dev server listens on your network too, so a phone or tablet on the same Wi-Fi can open the *Network* address. For a production build:

```bash
npm run build
```

```bash
npm run preview
```

The build in `dist/` is a static site (relative paths), so it can be hosted on GitHub Pages, Netlify, a school server, or opened from any static file host.

Deep links: `#new=savanna` opens a fresh diorama of a biome (`forest`, `taiga`, `grassland`, `savanna`, `rainforest`, `desert`, `tundra`, `wetland`, `mountain`, `reef`, `kelp`, `shore`, `garden`, `blank`); `#open=<project id>` reopens a saved one.

### Publishing on GitHub Pages

Every push to `main` builds the app and publishes it with GitHub Pages ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)). Pull requests run the same build as a check, without publishing.

- **Turn it on once:** Settings → Pages → Build and deployment → Source: **GitHub Actions**. The site then lives at `https://<owner>.github.io/<repo>/`, and Actions → *Deploy to GitHub Pages* → **Run workflow** republishes it at any time.
- **Private repositories:** Pages for a private repository needs a paid GitHub plan (Pro, Team or Enterprise), and the published site is public on the internet either way.
- **Saved projects stay with the address:** dioramas are stored in each browser for the site they were made on, so ones saved on `localhost` won't appear on the Pages site. Move them with *Download project file* and *Open a file*.

---

## What students can do

### 🧭 Explore
- Orbit, pinch-zoom and pan around a diorama that sits in a cardboard **shoebox** (or a **museum case** with a brass name plate, or a **floating island**). Walls fade away from any angle so nothing blocks the view.
- **Tap any organism** for an info card: common & scientific name, Kingdom › Phylum › Class › Order › Family, producer/consumer/decomposer role, diet, IUCN status, a fact, real size and how much it is magnified, what it eats here and what eats it — plus the student's own research notes. *Read* speaks it aloud.
- **Labels** puts paper flags on toothpicks next to every species (on by default, one flag per species; students can rewrite the text).
- **Food web** draws the energy flow between the organisms actually in the diorama, by trophic level.
- **Guide** gives the habitat's climate, location, adaptations, threats, vocabulary and discussion questions, plus a live **diorama checklist** (producers, consumers, a decomposer, a 3-link food chain, water, abiotic features, labels, notes, code) — a ready-made rubric.
- **Walk in** drops you inside the diorama at the eye level of a person, fox, frog or ant (WASD / joystick on touch). Underwater habitats let you swim.
- **AR table** (phones/tablets with WebXR AR) places the diorama on a real table through the camera; **VR** (WebXR headsets) shows it at table height in front of you. These buttons only appear on devices that support them.
- **Time of day**, a day–night cycle, **weather** (clear, cloudy, rain, storm with lightning, snow, fog), **seasons** (trees and grass change colour; winter brings snow cover) and **wind**.
- Animals live on their own: they wander, graze, peck, circle overhead or swim in loops; fireflies and glowing fungi light up at night.

### 🔨 Build
- **Library** of 250+ things, filtered to fit the current habitat, searchable by name, scientific name, class or phylum. Tap to add near the centre of the view, or drag onto the diorama (drop an animal onto a plant or rock to perch it there).
- Drag objects to move them; the inspector sets direction, size, flying/swimming height, label text, research notes, animation, and every shape/colour parameter the original asset module exposes (generated from its `params` schema).
- **Land tools**: raise, dig, smooth, flatten, roughen, and paint 14 ground types (grass, meadow, forest floor, dry grass, jungle, soil, mud, sand, desert sand, rock, gravel, tundra moss, snow, ice); water level; grass density. The front of the base is a cut-away showing soil horizons and rock strata, with a water cross-section where ponds meet the edge.
- Swap the whole base for a habitat tile (coral reef, kelp forest, tide pools, beach, marsh, mangroves, frozen lake, lake, cave, groundwater cut-away).
- Undo/redo, duplicate, delete, autosave, download/open `.diorama.json` files, save a picture.

### 🧩 Code
A Blockly workspace with the Scratch-like *Zelos* renderer. Every object has its own scripts (like Scratch sprites) and there is a **World** stage for weather, time and camera. Press **Play** (green) to run everything; **Stop** puts every object back exactly as it was built. Click any stack to try just that stack. Running blocks glow. Each object offers one-tap **starter ideas** (wander, say hello when tapped, find food, run from predators, fly in circles, sleep at night, camouflage, quiz question, have a baby; for the World: day–night cycle, storm show, seasons, narrated intro). Biome templates come with a few scripts already — e.g. on the savanna the lioness hunts while zebras and gazelles flee.

| Category | Blocks |
|---|---|
| **Events** | when ▶ clicked · when this is tapped · when key pressed · every N seconds · when it becomes night/day · when I touch … · when I receive · broadcast (and wait) |
| **Motion** | move N m · turn ↻/↺ · walk/run to … · wander · follow · run away from · circle around · point in direction / towards · go to · go to x y · glide · fly to height · change height · jump · spin · if on edge, bounce · x, y, height, direction |
| **Looks** | say / think (for N s) · play animation (walk, trot, gallop, graze, flap, glide…) · animate automatically · turn joint (head, jaw, tail, wings…) · set/clear colour · glow · see-through · size · show/hide · set label · set any design parameter (e.g. coral *bleaching*) |
| **Sound** | make my animal sound · play sound (26 synthesised sounds) · speak text · volume |
| **Control** | wait · repeat · forever · if / if-else · wait until · repeat until · stop · clones |
| **Sensing** | touching? · distance to · in water? · nearest animal/plant/food/predator · *property* of … · ask & answer · key pressed? · is it night? · time of day · timer |
| **Ecosystem** | eat … · nearest food · nearest predator · predator within N m? · energy · grow · have a baby · sleep |
| **World** | time of day · day–night speed · weather · season · fog · wind · water level · captions · camera look/follow/overview · add a new species · shared values |
| **Operators / Variables / My Blocks** | maths, comparisons, logic, text, variables, and custom blocks (functions) |

Food relations come from a species database, so *nearest food* for a lion finds a zebra, and *nearest predator* for a zebra finds the lion.

Teachers will find ready-made **coding challenges** in *More → How to use* (predator–prey chase, nocturnal owl, chameleon camouflage, water-cycle story, quiz, population model).

### 🎤 Present
**Tour** visits each species (the ones with research notes first) in food-chain order — producers, plant-eaters, predators, decomposers — flying the camera to each and optionally narrating the student's notes.

---

## The habitats

| Biome | Base | Highlights |
|---|---|---|
| 🍂 Temperate Forest | sculpted land with a creek | old oak, deer, red fox, black bear, raccoon, owl, woodpecker, fire salamander, mushrooms on a fallen log, earthworms |
| 🌲 Boreal Taiga | snowy land with a beaver pond | spruce & fir, moose, wolf pack, lynx, reindeer, beaver, falling snow |
| 🌾 Prairie Grassland | rolling plains, prairie pothole | bison herd, pronghorn, coyote, badger, hawk, monarchs, bumblebees |
| 🦁 African Savanna | waterhole | acacias, elephants, giraffes, zebras, gazelles, lions, cheetah, hyena, rhino, hippo, crocodile, termite mounds |
| 🦜 Tropical Rainforest | misty river valley | jungle trees, monstera, pitcher plant, jaguar, anteater, capybara, macaws, toucan, tree & dart frogs, chameleon, python, glowing fungi |
| 🌵 Desert | dunes with an oasis | saguaros, barrel cactus, agave, camels, fennec fox, bighorn, sidewinder, gecko, scorpion |
| 🐻‍❄️ Arctic Tundra | icy coast | iceberg, polar bears, arctic fox, reindeer, seals, puffins, arctic char |
| 🦩 Wetland Marsh | ponds | reeds & cattails, water lilies, flytrap & sundew, alligator, heron, crane, spoonbills, ducks, beaver, otter, bullfrogs, dragonflies |
| 🏔️ Mountain Peaks | crags and a brook | snow leopard, mountain goats, bighorn, golden eagle, falcon, alpine newt |
| 🐠 Coral Reef | coral-reef tile | clownfish & anemone, tangs, lionfish, seahorse, manta ray, reef shark, sea turtle, giant clam, crown-of-thorns |
| 🦦 Kelp Forest | kelp-forest tile | sea otters, urchins, sea stars, octopus, seal, shark, lobster |
| 🦀 Rocky Shore | tide-pool tile | crabs, sea stars, urchins, anemones, puffins, pelicans, and beach finds (conch, sand dollar, crab molt, mermaid's purse, sea glass, driftwood & lost net) |
| 🏡 Backyard Habitat | garden with a pond | songbirds, squirrel, chipmunk, cottontail, hedgehog, box turtle, toad, bees, monarch, ladybird, fireflies, snail, earthworm |
| 📦 Blank | flat meadow | build anything |

Small creatures are shown magnified so they can be seen (an ant-sized ladybird becomes ~35 cm; microscopic water bears are magnified ~600×). The info card says how much, and **Settings → True sizes** turns magnification off.

---

## Architecture

```
src/
  engine/        three.js world: Engine (renderer, camera, loop, picking, undo), Terrain (heightfield +
                 strata + paint), terrainGen (biome recipes), Water (depth-aware shader), Frame (shoebox /
                 museum / island + painted backdrop with a live sky shader), backdropPainter (procedural
                 landscape painting), Sky (time-of-day palette & dome), Groundcover (instanced grass,
                 flowers, pebbles, leaf litter), Weather, wind (shared sway patch), Actor (placed object:
                 animation clips, procedural rig idle/gait, ambient behaviour, labels, speech bubbles),
                 HeightProbe (GPU top-down height maps for habitat tiles), WalkMode (first person),
                 XRMode (WebXR table-top AR/VR)
  assets/        catalog (250+ entries), data-* (taxonomy, diet, status, facts, food tags), modules
                 (lazy loaders for References/*), builder (quality tiers, prototype cache & cloning,
                 orientation, exhibit scale, mesh consolidation, rig discovery), foodweb, builtin/ (fungi,
                 fallen log, termite mound, nest)
  biomes/        templates (14 dioramas + guides), factory (template → document with seeded scatter)
  code/          Blockly blocks & async JS generators, toolbox, theme, compile (workspace → async
                 functions), runtime (threads, events, clones, snapshot/restore, block API), recipes,
                 sound (WebAudio synth, speech, ambience)
  storage/       IndexedDB projects (localStorage fallback), export/import, settings
  ui/            React UI: Welcome, Studio, Viewport (pointer/touch), BuildPanels, ExplorePanels,
                 CodePanel
```

**How the reference assets are used.** Every module in `References/` exports `createAsset(params)`, a `params` schema and usually `rig`, `COLORWAYS` and `userData.update/setNight`. `src/assets/modules.ts` registers them with `import.meta.glob`, so each becomes its own chunk. `builder.ts` adds per-quality parameters (e.g. draft rigs and lighter plant foliage on phones), turns Wildform animals to face +Z, consolidates their meshes per animated joint, caches a prototype per parameter set and clones it (skinned rigs via `SkeletonUtils`), and discovers animation clips (mammal & bird rigs), rig pivots (reptiles, Wildform) and update hooks (water-world, aquarium). The inspector UI is generated from each module's own `params` schema.

**Code execution.** Each object's workspace compiles to plain async JavaScript: hats become entries in a factory, loops yield every frame (`await api.tick()`), and every block calls a thread-local API. Calling the factory creates fresh closures, which gives each object — and each clone — its own variables. Threads are cancelled cooperatively on Stop and the scene snapshot is restored.

### Adding a species or a biome
- **Species:** add a row to the matching `src/assets/data-*.ts` table (or an `add({...})` entry in `catalog.ts`) with its asset module, params, biomes, taxonomy, diet, food tags (`tags` it *is*, `eats` it eats) and a fact.
- **Biome:** add a template to `src/biomes/templates.ts` with a terrain recipe or a habitat tile, environment, placements (fixed `at` or scattered `count` + `area` with `where: 'dry' | 'wet'`) and a guide. Attach starter scripts with `scriptsFor(['wander', 'hello'], name)`.

---

## Devices & performance

- Built on standard WebGL 2, WebAudio and Speech Synthesis, for current desktop and mobile browsers. Automated checks run in Chromium at desktop and phone sizes; the touch layout uses bottom sheets, one-finger orbit / two-finger pan-zoom and an on-screen joystick.
- Three graphics tiers (Fast / Balanced / Detailed) pick model detail, shadow resolution and grass density; the renderer also adapts its resolution to keep the frame rate up. Phones default to Fast.
- All geometry is procedural and texture-free; the only network requests are fonts (optional — system fonts are the fallback).

## Licences

The asset modules in `References/` keep their own licences (CC0 or MIT, per file header). App code in `src/` is provided under the MIT licence.
