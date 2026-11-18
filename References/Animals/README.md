# Wildform

A responsive, model-first wildlife studio built with React, Three.js 0.180.0, Vite, and Tailwind CSS v4.

## The Collection

116 curated species represent 34 animal phyla and traditional lineages. The collection includes mammals, birds, reptiles, amphibians, fish, insects, arachnids, crustaceans, mollusks, radial marine animals, worms, and microscopic fauna.

Taxonomic scope is documented in the in-app phylum browser. Acanthocephala and Sipuncula are included as traditional lineages, while acknowledging their usual modern placement within Rotifera and Annelida. Dicyemida includes the name Rhombozoa. These are stylized body-plan studies, not anatomical or diagnostic references.

## In the Studio

- Search by animal, scientific name, habitat, or phylum.
- Rebuild anatomy through species-specific, dimension-aware controls.
- Choose curated colorways or edit individual vertex-color zones.
- Orbit, pan, zoom, choose camera views, and capture studio images.
- Switch day/night lighting, wireframe, shadows, ground grid, and habitat.
- Select and hide named parts, or play a gentle rigged idle motion.
- Undo and redo parameter changes.
- Save named variants in browser local storage.

## Portable Files

Use **Export asset** to download one of four formats:

- **Three.js module:** one self-contained `.mjs` animal with all its own helpers, geometry, parameter schema, curated palettes, rig, detach, and night metadata. Its only imports are Three.js and the official `mergeGeometries` helper. Unrelated anatomy builders are removed from each exported file.
- **Preview bundle:** the animal module, a separate `scene.mjs` composition, a responsive `preview.html`, and usage/license notes.
- **GLB:** a static snapshot of the current geometry, suitable for common 3D applications.
- **Complete collection:** 116 independent animal modules, a composed scene, and an interactive comparison preview. Every model has its own configurable controls in the preview.

No model uses image textures or model loaders. Dimensions are expressed in meters and geometry is rebuilt mathematically. The studio and comparison preview normalize display scale only; model metadata retains the actual dimensions.

`mergeForProduction: true` merges geometry into one mesh per material. With it disabled, individual meshes and named animation pivots remain editable. A translucent animal can have one additional glass material.

Unzip preview bundles and serve the folder over HTTP, for example with `npx serve .`, rather than opening it through `file://`. The standalone preview uses an import map for the Three.js 0.180.0 CDN. The main studio bundles Three.js locally.

## Project Structure

- `src/App.tsx`: studio application, history, local collections, keyboard shortcuts, and dialogs.
- `src/components/Viewport.tsx`: WebGL rendering, camera, raycasting, lighting, and animation.
- `src/components/Library.tsx`: searchable species and saved-variant browser.
- `src/components/Inspector.tsx`: metadata-driven parameter, part, and information panels.
- `src/data/catalog.ts`: species definitions and phylum coverage.
- `src/engine/animal.mjs`: self-contained procedural geometry template.
- `src/engine/exports.ts`: standalone module generation, preview/collection ZIPs, GLB export, and geometry checks.
- `src/index.css`: responsive visual system.

## Verification

The production build runs with `npm run build`.

The **About > Collection geometry check** action generates all 116 species in merged and granular form, checks finite bounds and vertices, verifies unique zone colors, compares triangle counts, and checks one production mesh per material. This is a browser-executed check, separate from the build.

## License

Generated animal geometry and exported asset modules are dedicated to the public domain under CC0 1.0 Universal. Third-party libraries retain their respective licenses.