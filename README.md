# Digital Diorama

**The classroom shoebox diorama, reimagined as a living 3D habitat you can build, explore, code and present.**

Students pick a biome, shape the land with landforms, sculpting and painting, fill it with real species from a library of nearly 350 procedural plants, animals, fungi and habitat features, label what they learned on toothpick flags, then bring it to life with Scratch-style block code — and finally present it with a narrated guided tour. Along the way they earn XP and badges, fill a field journal with the species they discover, and complete habitat quests for up to three stars. Runs in any modern desktop or mobile browser, and feels like an app on phones (top bar, bottom tab bar, pull-out trays; it can be added to the home screen to run full screen). Projects and progress save on the device, with no accounts.

Most 3D models come from the procedural three.js assets in [`References/`](References), imported in place and code-split so each one only loads when used. Trees, wildflowers, grasses and a few marine animals and fungi come from the app's own procedural generators in `src/assets/flora` and `src/assets/builtin`. The reference modules are unchanged except for a small `specOverride` hook in the mammal and bird rigs (marked *Digital Diorama extension*), which lets related species such as a Bactrian camel or a blue jay share one rig.

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

Deep links: `#new=savanna` opens a new (starter) diorama of a biome (`forest`, `taiga`, `grassland`, `savanna`, `rainforest`, `desert`, `tundra`, `wetland`, `mountain`, `reef`, `kelp`, `shore`, `garden`, `blank`); add `&size=small|medium|large|huge` to pick its size, or `&model=1` for the finished example instead; `#open=<project id>` reopens a saved one. A diorama opened from the home screen shows its `#open=` address, so reloading the page reopens it.

### Publishing on GitHub Pages

Every push to `main` builds the app and publishes it with GitHub Pages ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)). Pull requests run the same build as a check, without publishing.

- **Turn it on once:** Settings → Pages → Build and deployment → Source: **GitHub Actions**. The site then lives at `https://<owner>.github.io/<repo>/`, and Actions → *Deploy to GitHub Pages* → **Run workflow** republishes it at any time.
- **Private repositories:** Pages for a private repository needs a paid GitHub plan (Pro, Team or Enterprise), and the published site is public on the internet either way.
- **Saved projects stay with the address:** dioramas are stored in each browser for the site they were made on, so ones saved on `localhost` won't appear on the Pages site. Move them with *Download project file* and *Open a file*.

---

## What students can do

### 🏠 Home
- **One screen, like a phone app:** a top bar (with your level and Settings), the home itself in the middle and, on phones, a bottom tab bar: **Home · Expeditions · My dioramas · Journal**. The home picks up where you left off with a big *Continue* card, and shows your ranger profile and your **Ranger training** progress (the next lesson, or the one to carry on with). First-timers get a short introduction, *How it works* in three steps (pick a habitat → bring it to life → earn ⭐⭐ to unlock more) and a *Start your first expedition* button instead.
- **Trays instead of long lists:** Expeditions, My dioramas and the Journal pull out from behind the tab bar over the home, to browse and load from. **Expeditions** is the *ranger path*: habitats grouped by the step that opens them, as small postcards (with *New*, *Done*, stars and how many of its species you've found); locked ones say how many more expeditions they need. Tap an open one for its briefing, name the diorama, choose the **size of the box** (Small, Medium, Large, Huge — or any size once unlocked) and **Start expedition!** **My dioramas** shows your saved dioramas newest first: tap to open, or use ⋯ to download or delete one; *Open file* loads a `.diorama.json`, and a search box appears once there are more than six. Tap the open tab again, tap the dimmed home, press Escape or drag the tray down to put it away.
- On wide screens (and phones held sideways) the tabs sit in the top bar and the trays are wider, with bigger postcards.

### 🎓 Ranger training: learning by doing
New users learn the studio inside their own first diorama, one small step at a time, by doing each thing themselves rather than reading about it.
- **A welcome, not a wall of text.** The first time a diorama opens, a welcome offers **Show me around** (about 8 minutes) or *I'll explore on my own*. Either way every lesson stays under **🎓 Learn** in the top bar (or `H`).
- **20 short lessons in 6 units**, ordered like the ranger path:
  1. 🌱 *Your first habitat*: Meet your studio · Look around · Bring it to life · Move, turn & resize · Discover species
  2. 💚 *Keep it healthy*: Ecosystem health · Who eats whom? · Quests & stars
  3. 🏔️ *Shape the land*: Landforms · Paint & water
  4. 📝 *Tell its story*: Labels & notes · Day & night · Walk inside
  5. 🧩 *Bring it to life*: Your first script · Weather · Sculpt by hand
  6. 🔭 *Present and go further*: Give a guided tour · Seasons · The Area tool · Roam the wild

  Lessons about tools further along the path unlock with those tools (Code and Weather at *Trail Scout*, tours at *Explorer*…).
- **Each step points at the real control and waits for you to use it.** A lesson card says what to do; a glowing ring (dimming the rest of the screen) marks the button, panel or tab; a hand over the 3D view acts out gestures such as drag, pinch, two-finger slide, tap or press-and-hold, hovering over a real plant or animal when you need to tap one. The step moves on when the diorama shows it was done: the camera turned or zoomed, a producer or a plant-eater was added, something was moved, turned or resized, a hill was stamped, the ground painted, a label written, it became night, you walked in, a script ran… Read-only steps have *Next*.
- **No dead ends.** If the control isn't on screen, the card shows the way there instead ("👉 First, switch to 🔨 Build" with a *Go* button, "Tap 🛠️ Edit to see its tools", "Pick 🌿 Plants", "Open Land tools"), and controls scrolled out of their panel are scrolled into view. A step that was already done when it began shows ✓ with *Next*. A lesson that needs something first (living things, land rather than a habitat tile) says so and offers the lesson that helps.
- **Rewards and choice.** A finished lesson recaps what was learned, gives XP (once) and offers the next one. ✕ puts a lesson aside: the Learn button, the hub and the home screen offer to *carry on* from the same step, and a lesson in progress survives a reload.
- **Help at the moment it's needed:** quests have a **Show me how** button that starts their lesson, a completed expedition's *unlocked* card offers **Learn how** for every new tool, and the first visit to an empty box, to Build and to Code each shows a one-time tip pointing at the right place.
- **Learn & help** (the 🎓 Learn button, *More → Learn & help*, or the training card on the home screen) has the lessons by unit with progress, a searchable **How do I…?** (each answer can start its lesson), **Shortcuts** for the keyboard and touch gestures, and **Teachers**: a suggested first session, the ranger path, quests as a rubric, saving and sharing work, coding challenges, and the teacher-mode and tips switches.
- *Settings → Tips and the guided start* turns the welcome and the one-time tips off (or back on) for the device; lessons are always available.

### 🧭 The ranger path
- **Students build, not browse.** Every new diorama starts as the habitat's bare land, sky and climate — its creek, ponds and hills fitted to the chosen box size — and the student brings it to life with producers, plant-eaters, predators and decomposers.
- **An expedition is complete** when one of the student's own dioramas earns ⭐⭐ (10 quests). The quest tracker shows how many quests are left and what finishing will unlock.
- **Each completed expedition unlocks the next step:** start with the Backyard, Temperate Forest and Prairie, plus labels, landforms, painting, water, walking in, the food web and the guide; then
  1. 🥾 *Trail Scout*: Wetland & Savanna, **Code**, sculpt brushes, weather, mountain & island landforms, Large boxes;
  2. 🧭 *Explorer*: Desert, Taiga & the Blank box, guided tours, seasons, dune/mesa/canyon landforms;
  3. 🔭 *Field Naturalist*: Rainforest & Mountain Peaks, the Area tool, **Roam**, volcanoes, Huge and custom sizes;
  4. 🏅 *Habitat Expert*: Tundra & Rocky Shore, species from every habitat, habitat tiles;
  5. 🐋 *Ocean Explorer*: Coral Reef & Kelp Forest, AR/VR.
- A celebration lists everything a step unlocks. Locked tools and habitats show a padlock; tapping one explains what opens it. Quests for locked tools (code, tour) appear once they unlock.
- **Example dioramas** — the finished, fully stocked habitats — unlock per habitat once the student has completed an expedition there, to compare with their own. They don't count towards the path.
- **Teachers:** *Settings → Unlock everything (teacher mode)* on the home screen opens every habitat, tool and example on that device. Profiles from before the path count dioramas that already had ⭐⭐ as completed.

### 🏆 Play
- **Ranger profile:** pick an avatar and name; XP raises your level through ranks from *Seedling* to *Planet Keeper*. XP comes from discovering species, placing things and finishing quests.
- **Field Journal** (`J`): every species you tap in Explore is recorded with its card. Ones you haven't found yet show as silhouettes with a habitat hint, so there is always something left to find.
- **Quests & stars** (`Q`): each diorama has 16 quests (discover 5 species, plant 3 producers, build a 3-link food chain, add a decomposer, provide water, write labels and research notes, see it at night, walk inside, code something, give a tour…). 5, 10 and all 16 quests earn one, two and three stars. A tracker in the corner shows the next steps.
- **Ecosystem health** (0–100) scores variety, producer/consumer/decomposer balance, whether every animal has food here (food it can really catch), the energy pyramid, food-chain length and water. Its popover explains each part and suggests what to add next.
- **16 badges**, such as Food Chain Champ, Recycler, Night Owl, Storm Chaser, Four Seasons, Code Wrangler, Tour Guide, Ant's-Eye View and World Traveller, each celebrated with a banner, confetti and sound. Ecosystem badges come from the student's own changes: a goal that a ready-made habitat already meets counts only after it has been lost and reached again. Sounds and effects follow the Settings switches and *reduced motion*.

### 🧭 Explore
- Orbit, pinch-zoom and pan around a diorama that sits in a cardboard **shoebox** (or a **museum case** with a brass name plate, or a **floating island**). Walls fade away from any angle so nothing blocks the view.
- **Tap any organism** for an info card (the first tap adds it to the Field Journal): common & scientific name, Kingdom › Phylum › Class › Order › Family, producer/consumer/decomposer role, diet, IUCN status, a fact, real size and how much it is magnified, what it eats here and what eats it — plus the student's own research notes. *Read* speaks it aloud.
- **Labels** puts paper flags on toothpicks next to every species (on by default, one flag per species; students can rewrite the text). When flags would overlap, the nearer ones, the selected object's and the students' own labels stay; the rest fade out until you zoom in.
- **Food web** shows who eats whom among the organisms actually in the diorama, laid out by trophic level, with sunlight under the producers and a recycling band where decomposers break down dead matter and return nutrients to the plants. Tap any organism to light up what it eats and what eats it, with its trophic level; **What if…?** shows who would go hungry if it disappeared (and which prey would lose a predator). Animals with nothing to eat are flagged, with species of the habitat that would feed them and an **Add** button. **Food chains** traces the longest chains to each top predator, and *Scavenging & eggs* adds those links on request.
- **How the web is worked out:** diets name foods (“small mammals”, “fish”, “nectar”) or exact species (pandas eat bamboo, monarch caterpillars milkweed). Every animal counts as the foods its class and body size make it, and hunters only take prey they can really catch — about their own size, far bigger for pack and ambush hunters (wolves take moose, lions zebra, crocodiles wildebeest), never top predators, and not prey too tiny to bother with (eagles don't hunt hummingbirds). Scavengers eat the remains of large animals, nest raiders eat birds' and reptiles' eggs, and parasites live on hosts of any size. Some food is always there without being placed: dead matter for decomposers, aphids on land plants, and plankton and algae wherever there is water. Partners (clownfish & anemone, cleaner shrimp & fish) never eat each other. The diagram, info cards, ecosystem health, quests, the tour order and the code blocks (*nearest food*, *predator within…*) all use this one model.
- **Guide** gives the habitat's climate, location, adaptations, threats, vocabulary and discussion questions, plus the live quest checklist — a ready-made rubric.
- **Walk in** drops you inside the diorama at the eye level of a person, fox, frog or ant (WASD, Shift to run), or lets you fly over it as a 🦅 bird (Space climbs, C dives). On touch, a joystick appears wherever your thumb lands; push it to the rim to run. ⬆ jumps; underwater, hold ⬆/⬇ to swim up and down.
- **Roam** walks you out of the box into an endless landscape of the same habitat. Around the box, the land is the diorama's own habitat carried on — the same hills and ground, its creek winding away across the country — joined seamlessly to its real edges, then it opens into a wider world of foothills, a few lakes and, further off, big mountain ranges. Only lakes and rivers hold water; other hollows are dry ground; its own plants grow across the world, its animals wander it, and grass and flowers carpet the ground near you. The top bar and labels step aside, a compass shows the way back (🏠 takes you there), and on browsers that allow it the view can go full screen. Nothing out there is saved: the land is the same each visit.
- **AR table** (phones/tablets with WebXR AR) places the diorama on a real table through the camera; **VR** (WebXR headsets) shows it at table height in front of you. These buttons only appear on devices that support them.
- **Time of day**, a day–night cycle, **weather** (clear, cloudy, rain, storm with lightning, snow, fog), **seasons** (trees and grass change colour; winter brings snow cover) and **wind**.
- Animals live on their own: they wander, graze, peck, circle overhead or swim in loops; fireflies and glowing fungi light up at night.

### 🔨 Build
- **Library** of nearly 350 things with 3D thumbnails, filtered to fit the current habitat (or *All*), searchable by name, scientific name, class or phylum, and colour-coded by food-web role, with marks for what is already in the diorama and what you have discovered. Tap to add near the centre of the view, or drag onto the diorama (drop an animal onto a plant or rock to perch it there).
- Drag objects to move them. A **context bar** above the selection (on phones, at the top of the Edit panel) turns, resizes, duplicates, focuses, deletes or opens it in Code; on touch, **long-press** picks an object up and a second finger **twists** and **pinches** it. Keys: `R` / `Shift+R` turn, `+` / `−` resize, `1` `2` `3` switch Explore / Build / Code.
- The inspector (Place · Label · Look · Info) sets direction, size, flying/swimming height, label text, research notes, animation, and every shape/colour parameter the asset module exposes (generated from its `params` schema).
- **Land tools** (World & land panel), in four tabs:
  - **Landforms** — stamp a hill, mountain (snow-capped when tall), volcano, mesa, plateau, ridge, cliff, canyon, valley, crater, lake, island or sand dune. Tap the land to place one, or press and drag to size it (stretched ones point the way you drag). A see-through preview shows the new shape first; size, height and direction sliders and *Paint the ground to match* (rocky cliffs, snowy peaks, sandy shores, layered canyon walls) are in the panel. `[` `]` resize, `R` turns.
  - **Area** — select some land with a **box** or **oval** (drag across it), the **lasso** (draw a loop around it) or the selection **brush** (paint over it; *Take away*, or Alt, paints land back out, and painting on any selection adds to it; `[` `]` size the brush). Pick what grows there — mountains, hills, plains, dunes, a canyon, mesas, volcanoes, a lake, a river, marsh, islands or a coast — and its ground style (suits the landform, this habitat, or any of 15 styles), height, ruggedness and how soft its edge is, then **Generate**. Mountains, hills, volcanoes, mesas, islands and dunes are made of the same landforms as the stamps, laid out to fill the shape (a range with one main summit, a chain of buttes, crescent dunes facing one wind), so an area looks just like stamped landforms; with *Suits the landform*, mountains, hills, volcanoes, mesas and canyons paint only themselves and leave the ground around them as it was. A canyon or a river follows the middle of the shape, so a winding band painted with the brush becomes a winding gorge or river. **Try another** swaps the result for a new variation; *Plants: some / lots* also plants it with species of that habitat; *Repaint the ground only* keeps the shape. A selection that reaches past the diorama's edge carries on through it, so a lake or river can meet the cut-away.
  - **Sculpt** — raise, dig, smooth, flatten and roughen brushes. They work like an airbrush: press and hold to keep building a hill or digging a hole in one spot, or drag to shape; only the area under the brush is rebuilt, so sculpting stays smooth on phones, and the grass rides along with the ground.
  - **Paint** — 22 ground types (grass, meadow, forest floor, dry grass, jungle, soil, mud, sand, desert sand, rock, gravel, tundra moss, snow, ice, scree, cliff rock, volcanic ash, red clay, salt flat, heather, marsh reeds, pebble beach) or **✨ Auto**, which picks the ground from the shape of the land; *Auto-paint the whole diorama* repaints everything to match.

  Neighbouring grounds blend into each other along ragged, natural edges (decided per pixel by the terrain shader), and grass, flowers and pebbles stop exactly where their ground does. New landforms and areas fade into the land around them. Lakes, rivers, islands and coasts add water when the diorama has none. Plus: water level and grass density. The front of the base is a cut-away showing soil horizons and rock strata, with a water cross-section where ponds meet the edge.
- **Top view** (`T`, or the map button over the 3D view) looks straight down with a metre grid — drag to pan, pinch or scroll to zoom — which makes selecting areas and placing landforms easy. Every land tool works in it.
- **Diorama size**: Small 24 × 16, Medium 40 × 28, Large 64 × 44 or Huge 96 × 64 m, or any size from 12 to 128 m. Growing adds new land of the same habitat around the edges — its hills, ground pattern and creek carry on, joined exactly to the old edge without stretching it — and shrinking trims them (anything left outside is removed, after asking). Every habitat picks its size when it is created; Large, Huge and custom sizes unlock along the ranger path.
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

Teachers will find ready-made **coding challenges** in *🎓 Learn → Teachers* (predator–prey chase, nocturnal owl, chameleon camouflage, water-cycle story, quiz, population model).

### 🎤 Present
**Tour** visits each species (the ones with research notes first) in food-chain order — producers, plant-eaters, predators, decomposers — flying the camera to each and optionally narrating the student's notes.

---

## The habitats

| Biome | Base | Highlights |
|---|---|---|
| 🍂 Temperate Forest | sculpted land with a creek | old oak, birches, bluebells, foxgloves, bracken & moss, deer, red fox, black bear, raccoon, owl, woodpecker, fire salamander, mushrooms on a fallen log, earthworms |
| 🌲 Boreal Taiga | snowy land with a beaver pond | spruce, fir & larch, a birch grove, blueberries, reindeer lichen, moose, wolf pack, lynx, reindeer, beaver, falling snow |
| 🌾 Prairie Grassland | rolling plains, prairie pothole | big bluestem, goldenrod, milkweed, coneflowers, sunflowers, bison herd, pronghorn, coyote, badger, hawk, monarchs, bumblebees |
| 🦁 African Savanna | waterhole | umbrella acacias, a baobab, red oat grass, elephants, giraffes, zebras, gazelles, lions, cheetah, hyena, rhino, hippo, crocodile, termite mounds |
| 🦜 Tropical Rainforest | misty river valley | kapok giants with buttresses & lianas, palms, banana, tree ferns, bromeliads, heliconia, monstera, pitcher plant, jaguar, anteater, capybara, macaws, toucan, tree & dart frogs, chameleon, python, glowing fungi |
| 🌵 Desert | dunes with an oasis | saguaros, Joshua tree, prickly pear, barrel cactus, agave, creosote, date palms, camels, fennec fox, bighorn, sidewinder, gecko, scorpion |
| 🐻‍❄️ Arctic Tundra | icy coast | arctic willow, cotton grass, reindeer lichen, purple saxifrage, iceberg, polar bears, arctic fox, reindeer, seals, puffins, arctic char |
| 🦩 Wetland Marsh | ponds | bald cypress with Spanish moss, willows, reeds & cattails, water lilies, flytrap & sundew, alligator, heron, crane, spoonbills, ducks, beaver, otter, bullfrogs, dragonflies |
| 🏔️ Mountain Peaks | crags and a brook | cedar, larch, edelweiss, heather, lupines, snow leopard, mountain goats, bighorn, golden eagle, falcon, alpine newt |
| 🐠 Coral Reef | coral-reef tile | seagrass, clownfish & anemone, tangs, lionfish, seahorse, manta ray, reef shark, sea turtle, giant clam, crown-of-thorns |
| 🦦 Kelp Forest | kelp-forest tile | sea otters, urchins, sea stars, octopus, seal, shark, lobster |
| 🦀 Rocky Shore | tide-pool tile | crabs, sea stars, urchins, anemones, puffins, pelicans, and beach finds (conch, sand dollar, crab molt, mermaid's purse, sea glass, driftwood & lost net) |
| 🏡 Backyard Habitat | garden with a pond | apple & cherry trees, sunflowers, daisies, clover, dandelions, songbirds, squirrel, chipmunk, cottontail, hedgehog, box turtle, toad, bees, monarch, ladybird, fireflies, snail, earthworm |
| 📦 Blank | flat meadow | build anything |

The plant library covers conifers (Norway spruce, balsam fir, Scots pine, Atlas cedar, larch, coast redwood, bald cypress), broadleaf and flowering trees (oak, birch, cherry, apple, hawthorn, baobab, kapok, mangrove), palms, desert plants, tundra shrubs, bamboo, banana and tree fern, plus wildflowers, grasses, ferns, mosses, lichens, aquatic plants and giant kelp. Trees follow the seasons (blossom, autumn colour, bare winter branches) and are built at three detail levels.

Small creatures are shown magnified so they can be seen (an ant-sized ladybird becomes ~35 cm; microscopic water bears are magnified ~600×). The info card says how much, and **Settings → True sizes** turns magnification off.

---

## Architecture

```
src/
  engine/        three.js world: Engine (renderer, camera, loop, picking, undo), Terrain (heightfield +
                 strata + paint), terrainGen (biome recipes as fields defined everywhere, fitted to a box size; carrying land on past the box for resizing and Roam), Water (depth-aware shader), Frame (shoebox /
                 museum / island + painted backdrop with a live sky shader), backdropPainter (procedural
                 landscape painting), Sky (time-of-day palette & dome), Groundcover (instanced grass,
                 flowers, pebbles, leaf litter), Weather, wind (shared sway patch), Actor (placed object:
                 animation clips, procedural rig idle/gait, ambient behaviour, labels, speech bubbles),
                 HeightProbe (GPU top-down height maps for habitat tiles), WalkMode (first person,
                 flying, roaming), XRMode (WebXR table-top AR/VR), ground (ground types, the per-pixel
                 ground shader with editor outlines, and its CPU twin), landforms (ground styles,
                 landform stamps, area generators built from the stamps), areaShape (selected areas:
                 boxes, ovals, and lasso or brush shapes as coverage plus a distance to the outline),
                 LandEditor (stamp preview, area selection, try again, auto-paint), EndlessWorld (streamed terrain chunks with LOD and skirts, chunk
                 water, instanced plants, roaming animals), sizes (diorama size presets)
  assets/        catalog (nearly 350 entries), data-* (taxonomy, diet, status, facts, food tags; data-diet: body
                 masses, hunting reach, diet corrections, partners), foodweb (who eats whom, food webs, chains,
                 removal impact, suggestions), data-remap
                 (species rebuilt on better-matching rigs), modules (lazy loaders for References/* and
                 flora), builder (quality tiers, prototype cache & cloning, orientation, exhibit scale,
                 mesh consolidation, rig discovery), foodweb, proc/kit (vertex-coloured geometry toolkit:
                 sweeps, lathes, leaves, petals, lofts), flora/ (trees & herbs: recursive branching, bark
                 paint, crown shading, seasons, three detail tiers), builtin/ (fungi, fallen log, termite
                 mound, nest, seal, dolphin/orca/humpback, man o' war, sea hare)
  biomes/        templates (14 dioramas + guides), factory (template → document with seeded scatter)
  code/          Blockly blocks & async JS generators, toolbox, theme, compile (workspace → async
                 functions), runtime (threads, events, clones, snapshot/restore, block API), recipes,
                 sound (WebAudio synth, speech, ambience)
  storage/       IndexedDB projects (localStorage fallback), export/import, settings
  learn/         Ranger training: lessons (units, lessons and steps, each step's target and the check that
                 notices it was done, from a snapshot of the diorama, camera motion and moments), store
                 (lessons done, the one under way or put aside, tips seen; stored in localStorage), signals
                 (moments that leave no trace in the diorama: an undo, the overview, a food-web pick…), help
                 (How do I…?, shortcuts, gestures, notes for teachers)
  game/          progress (XP, levels, ranks, discoveries, badges, stars, completed expeditions; stored in
                 localStorage), ecology (ecosystem health score, quests, stars), unlocks (the ranger path)
  ui/            React UI: Welcome (the home screen) + home/ (Expeditions and My dioramas trays), shell (top bar,
                 bottom tab bar, top-bar tabs, shared breakpoints), Tray (pull-out tray), sheetDrag (drag a sheet
                 down to close it), backStack (the phone's Back button closes the top-most tray, sheet or
                 diorama), Studio, Viewport (pointer/touch gestures), BuildPanels, LandPanel (land
                 tools & diorama size), ExplorePanels,
                 CodePanel, BottomSheet (draggable phone sheet), ContextBar, AssetThumb + thumbs3d
                 (background 3D thumbnails cached in IndexedDB), feedback (haptics, UI sounds), game/
                 (HUD chips, quest tracker, journal, celebrations), learn/ (Coach: the welcome, the lesson
                 card that follows its control every frame with a spotlight ring and gesture hands, one-time
                 tips and the end of a lesson; place: where the card goes; LearnHub: lessons, How do I…?,
                 shortcuts, teachers). Controls a lesson can point at carry `data-tour` names.
  review/        asset review harness (review.html)
```

**How the reference assets are used.** Every module in `References/` exports `createAsset(params)`, a `params` schema and usually `rig`, `COLORWAYS` and `userData.update/setNight`. `src/assets/modules.ts` registers them with `import.meta.glob`, so each becomes its own chunk. `builder.ts` adds per-quality parameters (e.g. draft rigs and lighter plant foliage on phones), turns Wildform animals to face +Z, consolidates their meshes per animated joint, caches a prototype per parameter set and clones it (skinned rigs via `SkeletonUtils`), and discovers animation clips (mammal & bird rigs), rig pivots (reptiles, Wildform) and update hooks (water-world, aquarium). The inspector UI is generated from each module's own `params` schema.

**Code execution.** Each object's workspace compiles to plain async JavaScript: hats become entries in a factory, loops yield every frame (`await api.tick()`), and every block calls a thread-local API. Calling the factory creates fresh closures, which gives each object — and each clone — its own variables. Threads are cancelled cooperatively on Stop and the scene snapshot is restored.

### Adding a species or a biome
- **Species:** add a row to the matching `src/assets/data-*.ts` table (or an `add({...})` entry in `catalog.ts`) with its asset module, params, biomes, taxonomy, diet, food tags (`tags` it *is*, `eats` it eats) and a fact. A new tree or herb is a species entry in `src/assets/flora/trees.ts` or `herbs.ts` plus an `FL(...)` / `HB(...)` line in `catalog.ts`.
- **Biome:** add a template to `src/biomes/templates.ts` with a terrain recipe or a habitat tile, environment, placements (fixed `at` or scattered `count` + `area` with `where: 'dry' | 'wet'`) and a guide. Attach starter scripts with `scriptsFor(['wander', 'hello'], name)`.

### Developer tools
Run these with `npm run dev` stopped (the review and UI scripts start their own Vite server); they use the Playwright Chromium already on the machine.

- **Asset review harness** — `review.html` renders catalog assets through the app's own builder from several views (front ¾, side, top, with a marker showing which way is forward). Query parameters pick what to show: `ids=`, `cat=`, `group=`, `family=`, `match=`, `views=`, `clip=`, `season=`, `q=` (quality), or variants of one asset with `base=<id>&v=[{…},…]`. `node tools/review-assets.mjs --query "cat=animals&cols=3" --per 15 --out shots/animals` saves contact sheets.
- **App icon** — `node tools/make-icons.mjs` draws the icon (a shoebox diorama: an open cardboard box with a tree, a fox and a painted sky inside) and writes `public/favicon.svg`, `public/icons/icon.svg` and the PNG icons for the manifest and iOS, including a maskable one whose art stays inside Android's safe zone. `--out dir` writes a preview set elsewhere.
- **Screenshots** — `node tools/shoot.mjs` captures app URLs (desktop or `--device phone`) and prints triangles, draw calls and actor counts.
- **UI smoke test** — `node tools/ui-check.mjs --out shots/ui-check` taps an animal (field card + discovery), selects it in Build (context bar, resize), twists and pinches it with two fingers, resizes the phone panel by its header and taps a panel tab, on desktop and phone, and reports any page errors.
- **Food-web check** — `node tools/foodweb-check.mjs` runs the who-eats-whom cases in `tools/foodweb-cases.js` (size limits, specialists, scavenging, eggs, parasites, partners) and lists every habitat's example diorama with its longest food chain and any animal with nothing to eat. It exits non-zero if a case fails.
- **Home & Back-button check** — `node tools/home-check.mjs --out shots/home-check` opens each tray from the phone tab bar, steps back out of a habitat briefing, starts an expedition, opens and closes sheets in the studio, reloads, drags trays and sheets closed, and checks that Back always closes the top-most layer without leaving dead history entries. It exits non-zero if a check fails.
- **Ranger training check** — `node tools/learn-check.mjs --out shots/learn-check` starts a fresh device's first expedition, takes the guided start and follows the first unit by really doing each step (dragging, pinching and sliding the camera, adding a plant and a plant-eater from the inventory, moving, turning and resizing one, undoing, tapping a species, opening the journal), then checks the Learn hub, a quest's *Show me how* and the home screen's progress, on a phone and a desktop. `--suite tips` declines the guided start and checks the one-time tips; `--suite more` (teacher mode, the Forest example) starts every other lesson from the hub and completes it — stamping, painting and sculpting the land, writing labels, walking with the keyboard or the joystick, running code, touring and roaming. `--only phone|desktop` and `--lessons a,b` narrow it down. It exits non-zero if a check fails.

---

## Devices & performance

- Built on standard WebGL 2, WebAudio and Speech Synthesis, for current desktop and mobile browsers. Automated checks run in Chromium at desktop and phone sizes.
- Phones: in Build and Code the panel takes most of the screen under a smaller 3D view that always stays visible; drag the panel's header to give either more room (it snaps, and flings). Held sideways, the panel sits beside the view and the mode tabs move into the top bar. While the camera is at its overview it re-fits the diorama whenever the view changes shape. Tapping an organism in Explore glides the camera so it sits in the space left by its species card.
- App feel: every screen has the same top bar and, on phones, the same bottom tab bar. The phone's Back button (or the browser's) closes whatever is on top — a tray, a habitat briefing, a sheet — and leaves a diorama for the home screen, instead of leaving the site. Sheets and trays can be dragged down to close. *Add to Home Screen* (or *Install app*) opens it full screen with its own icon; the bars then extend under the status bar and home indicator.
- Touch: a bottom tab bar, undo/redo in the Build panel, one-finger orbit / two-finger pan-zoom, long-press to pick up, two-finger twist and pinch on a held object, forgiving taps on thin things like legs and branches, short haptic ticks where the device supports them, and safe-area padding for notched phones.
- Three graphics tiers (Fast / Balanced / Detailed) pick model detail, shadow resolution and grass density; the renderer also adapts its resolution to keep the frame rate up. Phones default to Fast. In Roam they also set how far you can see (about 145, 175 or 210 m) and how many plants and animals fill the world; its land is built a few milliseconds per frame, nearest first, coarser further away.
- Land grids are 25 cm for most dioramas and a little coarser for huge ones, so every size stays smooth to sculpt; huge dioramas keep a shorter undo history.
- All geometry is procedural and texture-free (the ground shader's speckle comes from a small noise texture generated at start-up); the only network requests are fonts (optional — system fonts are the fallback). Library thumbnails are rendered in the background on first view and cached in IndexedDB.

## Licences

The asset modules in `References/` keep their own licences (CC0 or MIT, per file header). App code in `src/` is provided under the MIT licence.
