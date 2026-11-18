# Terra

A responsive Three.js terrain studio with an expanding world, shared-edge terrain geometry, blended biome colors and ecology, and persistent world-space sculpting.

## Features

- 18 world recipes and 20 biomes.
- Chunk streaming with bounded mesh memory and floating-origin rendering.
- Raise, carve, flatten, soften, and roughen brushes. No rolling limit on stored strokes.
- IndexedDB autosave, saved worlds, named places, and position recovery.
- Keyboard, touch-dial, coordinate, and atlas navigation.
- Portable source packages, editable terrain modules, JSON backups, and bounded GLB snapshots.

The `.mjs` assets in `src/assets/` are independently importable and texture-free. `scene.mjs` composes them into a streaming world. The HTML preview is included in every source download.

## Persistence

Generated meshes are temporary. The seed, settings, complete stroke list, bookmarks, and current location are stored locally. If IndexedDB is unavailable, localStorage is used where possible. Storage failures are shown in the status bar instead of discarding older edits. Browser storage is device-local and subject to browser quotas; export a `.terra.json` backup before clearing site data.

## Checks

Regression coverage lives in `tests/terrain-regression.test.mjs`. Run it with:

```sh
node --test tests/terrain-regression.test.mjs
```

The checks cover seeded reproducibility, positive-facing geometry, exact tile-edge colors and heights, biome-weight normalization, staged rebuilds, travel/unload/revisit, history replacement, production merging, and retention beyond 200 strokes.

The world has no authored boundary. JavaScript numeric precision and available browser storage remain practical limits.

## License

The procedural asset modules and generated geometry may be used in personal or commercial projects under the MIT notice in their file headers.