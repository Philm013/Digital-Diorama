# CLAUDE.md

Digital Diorama is a browser app (React 19 + three.js + Blockly, built with Vite) where students build, explore, code
and present 3D habitat dioramas. Every 3D model is procedural code; there are no model files. The README describes the
features for teachers and students; this file is for working on the code.

## Commands

```bash
npm install                 # once
npm run dev                 # dev server (also on the LAN); the app is index.html
npm run workbench           # dev server opening workbench.html, the animal workbench
npm run typecheck           # tsc --noEmit (strict, noUnusedLocals/Parameters)
npm run build               # typecheck + production build into dist/ (static, relative paths)
```

There is no unit-test runner; the checks are scripts in `tools/` (see Verification). Pushes to `main` deploy to GitHub
Pages (`.github/workflows/pages.yml`); pull requests run the same build as a check.

## Layout

```
src/assets/            what the library holds and how it is built (TypeScript)
  catalog.ts           every library entry (AssetDef): id, module path, params, biomes, taxonomy, diet, food tags
  data-*.ts            species tables (mammals, birds, reptiles, Wildform), diets and body masses, remaps
  foodweb.ts           who eats whom; used by the food web, health score, quests, tours and code blocks
  modules.ts           lazy loaders (import.meta.glob) and MODULE_PATHS for the model modules
  builder.ts           quality tiers, prototype cache and cloning, exhibit scale, consolidation, rig discovery
  tuning.json          per-asset param overrides written by the workbench
src/assets/models/     the procedural generators, grouped by the engine they are built on
  rigs/                mammal-rig, bird-rig, herp-rig + kit.mjs (the shared sweep engine)
  wildform/            wildform.mjs (body-plan engine) + species.ts (its species plans)
  water/               water-world tiles, props, flocks, weather + kit.mjs (the shared library)
  beach/ aquarium/ plants/ rocks/   self-contained modules
  flora/ builtin/ proc/             the app's own TypeScript models on a vertex-coloured geometry kit (proc/kit.ts)
src/engine/            three.js world (Engine, Terrain, terrain generation, water, sky, weather, Actor, walk, XR, roam)
src/biomes/            the 14 habitat templates and the factory that turns one into a document
src/code/              Blockly blocks, compiler, runtime, sound
src/game/ src/learn/   progress, quests, unlocks; Ranger training lessons
src/storage/           projects in IndexedDB
src/ui/                React UI (home, studio, panels, journal, coach)
src/workbench/         the animal workbench (dev only) and its Vite plugin (devServer.ts)
src/review/            review.html, the asset review harness
tools/                 checks and scripts
public/species/        photos, range maps, media.json and CREDITS.md (written by tools/fetch-species-media.mjs)
```

The split: anything under `src/assets/models/` builds a 3D object; everything else in `src/assets/` describes the
library and assembles models for the app. Model modules are plain three.js (no DOM), so they also run in Node, which
the rig checks and the fingerprint check rely on.

## How models plug in

- A model module exports `createAsset(params)` and a `params` schema (the inspector's controls are generated from it);
  most also export `rig`, `COLORWAYS`, and rigs `createClips` / `setPose`. Water-world and aquarium objects carry
  `userData.update(t)` and `userData.setNight(k)`, which the engine calls every frame.
- A catalog entry points at a module with `path` (from `MODULE_PATHS`, e.g. `P.water('lighthouse')`) and gives its
  params. `modules.ts` globs the model folders, so a new file in one of them is loadable at once; a family's
  `kit.mjs` is excluded from the globs because it is a library, not a model.
- Shared code lives in the family's `kit.mjs`; a module imports only what it uses. Helpers that read a module's own
  tables (its BASE colour zones, COLORWAYS, params schema, rig) come from `bindModule({...})`, which the module calls
  once with its tables; `params` and `rig` are passed as getters (`params: () => params`) so they can be defined
  further down the file.
- Asset ids (`mammal/lion`, `water/fish-school`, …) are stored in saved dioramas, journals and tuning.json: never
  rename one. Paths and file names can change freely.
- Species presets: the mammal rig lays every animal out from a measured reference table (`REF`); the bird rig from
  field-guide measurements (`M`); the herp rig from measured tables per body plan. `specOverride` deep-merges changes
  onto a preset, which is how related species share a rig (data-remap.ts, catalog.ts, tuning.json).

## Conventions

- **Comments describe the code as it is.** No changelogs, no "revision N", no "it was X, now Y", no "used to" or
  "no longer". Git holds the history; put the story of a change in its commit message. Do explain why the code is
  the way it is when that is not obvious (a measurement, a constraint, a failure the design avoids), in the present
  tense: "the curl is built in world axes, so it wraps the ear however the head is pitched".
- **Edit values in place.** Never tune a preset by appending a second `headLen:` (or any key) to the same object
  literal; an object literal sets each key once. Remove settings nothing reads instead of leaving them.
- **Delete dead code.** Unused modules, branches and helpers go; git keeps them (see Removed material).
- Model code is deterministic where it can be: use the seeded generators in the kits (`rng`, `mulberry`, `hash*`),
  not `Math.random`, for geometry.
- Keep each family's shared code in its `kit.mjs`; do not copy helpers into modules.
- Style: match the surrounding code (dense, long lines up to about 120 columns, two-space indent, single quotes).
  There is no formatter or linter; `npm run typecheck` is the gate for TypeScript.
- When a model's shape changes, bump `VERSION` in `src/ui/thumbs3d.ts` so cached library thumbnails re-render.
- The workbench's dev server writes only under `src/assets/` and only for requests from this machine. Saving a model
  module there hot-swaps it; saving a `kit.mjs` reloads the page (every module of the family imports it).

## Verification

Run the checks that match the change; every browser-based tool starts its own Vite server and uses the Playwright
Chromium installed on the machine.

| Change | Run |
|---|---|
| anything | `npm run typecheck`, `npm run build` |
| a refactor of models, kits or the builder that should change nothing | `node tools/fingerprint-check.mjs --save /tmp/before.json` before, `--compare /tmp/before.json` after |
| a model change meant to change shapes | the fingerprint compare (it lists what changed), then look: `node tools/review-assets.mjs --query "ids=<id>,<id>" --out shots/check` or workbench sheets (`node tools/workbench.mjs sheet --ids <id> --out shots/wb`); bump the thumbnail `VERSION` |
| mammal rig | `node tools/gait-check.mjs --save /tmp/gait.json` before, `--compare` after (≈4 min; `--only horse,lion` for a few) |
| herp rig | `node tools/herp-gait-check.mjs` (same flags) |
| bird rig | `node tools/bird-check.mjs` |
| catalog diets, food tags, foodweb.ts | `node tools/foodweb-check.mjs` |
| UI, panels, navigation | `node tools/ui-check.mjs --out shots/ui-check`, `node tools/home-check.mjs --out shots/home-check` |
| lessons, coach, anything a lesson drives | `node tools/learn-check.mjs --out shots/learn-check --suite first,tips,more` |

The fingerprint check builds all ~350 catalog assets at three tiers in about 35 s and hashes geometry, materials,
textures, skeletons, clips, rig pivots, schema and userData (Math.random is seeded per build). `userData.params`
echoes the input params, so dropping a no-op key from a `specOverride` changes `ud` there but nothing else; check
which parts differ before deciding a difference matters. Screenshots go to `shots/` (git-ignored). The gait checks
print depth and slip in cm to 0.01, so small animals that plant their feet exactly (a tuatara, a sand lizard) and the
legless snakes read 0; the saved JSON has every measure, including lift.

## Adding things

- **A species on an existing module:** a row in the matching `src/assets/data-*.ts` table, or an `add({...})` in
  `catalog.ts`: module path, params, biomes, taxonomy, diet, food tags (`tags` it is, `eats` it eats) and a fact.
  Then run the food-web check. Photos and range maps: `node tools/fetch-species-media.mjs --only <id>`.
- **A tree or herb:** a species in `src/assets/models/flora/trees.ts` or `herbs.ts` plus an `FL(...)` / `HB(...)`
  line in `catalog.ts`.
- **A rigged mammal:** a preset in the mammal rig's `SPECIES_DEFS` with `ref: REF.<table>` (tune it with `refLen`,
  `refDepth`, `refW`, `refNeck`, `foreBulkR`, `hindBulkR`, or add a measured `REF` table); a row in `data-mammals.ts`.
- **A model module:** put it in the folder of the engine it is built on, import what it needs from that family's
  `kit.mjs` (or keep it self-contained in beach/, aquarium/, plants/, rocks/), and add a catalog entry with its path.
- **A biome:** a template in `src/biomes/templates.ts` (terrain recipe or habitat tile, environment, placements, guide).

## Removed material

The standalone reference studios the models came from, and every module the app did not use, were removed from the
tree. The last commit that has them is `f73ad3b`, under `References/`:

- water-world: beaver-dam, canal-lock, channel-buoy, dam-spillway, fishing-boat, floating-dock, fountain-plaza,
  glacier-tongue, lifeguard-tower, mountain-brook, ocean-surface, puddles, rapids-cascade, rice-terraces,
  river-channel, river-delta, sailboat, sea-cliff-arch, stone-aqueduct, stone-bridge, swimming-pool, terrain-tile,
  water-tower, waterfall, waterspout, whirlpool, and the scene composer with four scenes
- Beach: gastropod-auger, bivalve-razor-clam, marine-flora-sponges; Fish Tank: hardscape, flora-carpet, chassis,
  decor, filtration and substrate modules
- parametric-conifer.mjs and the Terra Former tree (superseded by `models/flora`), the Terra Former and Landscape
  generator terrain engines, the 20 per-species reptile models (superseded by the herp rig)

A removed water-world module is self-contained (it carries its own copy of the library), so it works as it is:

```bash
git show f73ad3b:"References/water-world/assets/sailboat.mjs" > src/assets/models/water/sailboat.mjs
```

Then add a catalog entry (`path: P.water('sailboat')`) and, to keep one copy of the library, replace its inline
helpers with imports from `./kit.mjs` (they are identical).

## Licences

Model modules keep the licence in their headers: the rigs and their kit, Wildform, Worldflora and the flora library
are CC0; the water-world modules and their kit, beach, aquarium and rock modules are MIT. Other code in `src/` is MIT.
`plants/deciduous.mjs` states no licence in its header. Species photos and descriptions carry their own licences
(`public/species/CREDITS.md`).
