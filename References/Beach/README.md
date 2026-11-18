# Tideline

An interactive cabinet of coastal curiosities, built with React, TypeScript,
Three.js, Vite, and Tailwind CSS. All three-dimensional content is procedural.
No image textures, external model files, or model loaders are used.

## Studio

- Select specimens in the collection or directly in the 3D viewport.
- Rebuild their geometry with the inspector's schema-driven controls.
- Explore four curated colorways, or edit individual material-zone colors.
- Isolate a specimen, reveal its components, and animate its available rig.
- Change lighting, wetness, debris density, and the deterministic tide seed.
- Add repeat specimens from the asset library and hide entire asset families.
- Export an individual `.mjs`, a complete scene ZIP, or a PNG viewport snapshot.
- Edits are saved locally in the browser. No account or server is required.

Keyboard shortcuts: `F` isolates the selected specimen, `W` toggles wireframe,
`Space` toggles the slow orbit, `0` resets the camera, and `/` focuses search.
The interface includes reduced-motion behavior and an illustrated WebGL fallback.

## Asset Modules

The fourteen reusable assets are in `src/assets/`. Each `.mjs` specimen:

- Imports only `three` and `three/addons/utils/BufferGeometryUtils.js`.
- Includes its own geometry, color resolution, and seven inline helper functions.
- Exports `createAsset`, `params`, `presets`, `COLORWAYS`, `rig`, `detach`, and `night`.
- Defaults to editable named components with `mergeForProduction: false`.
- Supports one merged mesh per material with `mergeForProduction: true`.
- Uses collision-free integer color zones and texture-free vertex colors.
- Recalculates geometry from parameters instead of scaling the asset's root.

Install Three.js in a consuming project, import `createAsset` from the desired
file, and add the returned `THREE.Group` to your scene. No Tideline application
code is required by a specimen. The root's `userData` records its resolved
parameters, color zones, units, rig, detachable components, and night metadata.

Actual dimensions and triangle counts vary with the parameters. Dimensions in
module headers are nominal default footprints; the studio reports live triangle
counts. Rotational rig ranges are in degrees; translational ranges explicitly
state meters in their descriptions. Animation is intended for editable mode.

Some detachable names belong to alternate model variants. The live inspector
only displays components applicable to the selected variant. A starfish exports
metadata for up to twenty arms, but constructs only the requested arm count.

## Scene Composition

`src/assets/scene.mjs` composes the independent modules along a seeded S-curve.
The specimens are modeled in meters and displayed at 10:1 exhibition magnification.
Set `magnification: 1` for life size. At display scale, the two primary anchors are
the driftwood at X -4 / Z -3 and the conch at X 3 / Z 4.

The procedural terrain includes shell fragments, instanced sand grains, and
a wet/dry gradient. A world-height material shader darkens and smooths the wet
bottoms of specimens without changing their collision-free vertex-color zones.

Scene options include `colorway`, `paramsByAsset`, `hiddenAssets`, `hiddenParts`,
`density`, `wetness`, `seed`, `additionalAssets`, `magnification`, and `editable`.
Use `editAll: true` with editable mode to keep every instance granular; the studio
normally keeps only the primary selected specimen granular for rendering efficiency.

## Exports

The scene ZIP contains all fourteen standalone modules, `scene.mjs`, a runnable
`preview.html`, the serialized scene settings, a README, and the MIT license.
Serve the extracted folder over HTTP rather than opening it with a `file:` URL.
The preview obtains Three.js itself through a pinned CDN import map; it never
loads external textures or models. An internet connection is needed for that CDN.

Single-asset exports embed the current inspector settings as `studioPreset` and
component visibility as `studioHiddenParts`. Hidden parts are omitted when baking
production meshes. The exported file remains entirely self-contained.

## Development

Use the existing `npm run dev` and `npm run build` scripts. The Vite build produces
the application in `dist/`. `src/App.tsx` is the application entry component;
`src/components/SceneViewport.tsx` owns rendering and interaction, and
`src/lib/export.ts` assembles the downloadable artifacts.

The production build verifies module parsing and bundling. Browser/WebGL rendering
and input-device behavior should additionally be tested on the intended deployment
devices. A fallback illustration is shown when WebGL cannot be initialized.