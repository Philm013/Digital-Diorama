import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  BoxSelect,
  ChevronLeft,
  ChevronRight,
  Focus,
  Grid3X3,
  Info,
  Layers2,
  Maximize2,
  MousePointer2,
  Pause,
  Play,
  Rotate3D,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { createAsset, createClips, params as assetParams, setPose, species } from "./assets/bird-rig.mjs";

type FocusArea = "body" | "wing" | "neck" | "face" | "legs";
type PoseName = "perch" | "walk" | "peck" | "glide" | "flap";
type SceneKey = "all" | "garden" | "wetlands" | "rainforest" | "ocean" | "raptors" | "ground";
type BirdConfig = Record<string, string | number | boolean>;

type StageAsset = {
  key: string;
  label: string;
  scientific: string;
  object: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  action: THREE.AnimationAction | null;
  position: THREE.Vector3;
  dimensions: { length: number; height: number; width: number };
  pad: THREE.Mesh;
  normalizationScale: number;
  configKey: string;
};

type CameraGoal = { target: THREE.Vector3; position: THREE.Vector3 };

type StageRuntime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  clock: THREE.Clock;
  animals: Map<string, StageAsset>;
  marker: THREE.Mesh;
  skeleton: THREE.SkeletonHelper | null;
  selected: string;
  focus: FocusArea;
  isolate: boolean;
  showRig: boolean;
  goal: CameraGoal | null;
  sceneKey: SceneKey;
  sceneKeys: Set<string>;
  floor: THREE.Mesh;
};

const SOURCE_LABEL = "bird-rig.mjs";
const ADDED_KEYS = new Set(["spoonbill", "stilt", "cockatoo", "hornbill", "pigeon", "woodpecker", "kingfisher", "falcon", "crane", "puffin", "kiwi", "turkey", "albatross"]);
// Must match the stacked-layout breakpoint in index.css.
const COMPACT_QUERY = "(max-width: 1100px)";
const HERD_TARGET = new THREE.Vector3(0, 0.6, 0);
const HERD_OFFSET = new THREE.Vector3(12.5, 10.5, 15.5);
const CLOSE_OFFSET = new THREE.Vector3(3.8, 2.65, 4.8);

const REVIEW_AREAS: Record<FocusArea, { label: string; short: string; copy: string; parts: string[] }> = {
  body: {
    label: "Body shape",
    short: "BODY",
    copy: "Compare the back, breast, belly, and uninterrupted neck inlet of each silhouette.",
    parts: ["body", "neck"],
  },
  wing: {
    label: "Wing root",
    short: "WING",
    copy: "Read the shoulder blend, coverts, and folded-to-spread wing swap.",
    parts: ["wings", "wings-folded"],
  },
  neck: {
    label: "Neck blend",
    short: "NECK",
    copy: "Check the continuous shoulder inlet, S-curve silhouette, and head transition.",
    parts: ["neck", "body", "head"],
  },
  legs: {
    label: "Leg attachment",
    short: "LEGS",
    copy: "Check the drumstick emerging from the belly, bare tibia, heel joint behind the foot, and toe pad.",
    parts: ["legs", "feet", "body"],
  },
  face: {
    label: "Skull and bill",
    short: "FACE",
    copy: "Check the cranium, brow, and lores, and the unbroken culmen from forehead to bill tip.",
    parts: ["head", "beak", "eyes", "crest"],
  },
};

const QA_NOTES: Record<string, string> = {
  pigeon: "New dove/pigeon family: deep keel-like breast, compact rounded skull, iridescent neck zone, and short cere-based bill.",
  woodpecker: "New climbing family: upright trunk posture, zygodactyl feet, stiff wedge tail, and a long straight chisel bill.",
  kingfisher: "New kingfisher family: compact body, oversized skull, tiny feet, and a long straight dagger bill.",
  falcon: "New pursuit-raptor family: narrow torso, pointed high-aspect wings, compact hooked bill, and dark malar mask.",
  crane: "New crane family: taller upright neck than the heron, long bare legs, compact tail, and straight probing bill.",
  puffin: "New alcid family: upright seabird torso, webbed feet, short pointed wings, and a deep laterally compressed display bill.",
  kiwi: "New flightless nocturnal family: vestigial wings, no visible tail, heavy legs, and a very long slender probing bill.",
  turkey: "New heavy galliform: broad body, bare coloured neck, wattles, and a large display tail fan.",
  albatross: "New ocean-soarer family: long narrow pointed wings, compact webbed legs, and a long tube-like bill with a hooked nail.",
  hornbill: "New. Decurved yellow bill with a casque riding the culmen; its base is buried in the upper mandible so it reads as part of the bill.",
  cockatoo: "New. Flat crest feathers lie back along the crown with up-curled yellow tips, and fan forward as Crest raise increases. Dark hooked bill over a broad scoop lower mandible.",
  hummingbird: "Smaller head and a bill trimmed to its real length, about 1.8 cm. The head sits directly on the body, with the gorget under the chin.",
  robin: "Slender insect-eater's bill. The orange runs unbroken from forehead through throat to breast, with no white collar.",
  cardinal: "Solid swept crest replaces the separate quills; it rises with Crest raise. Massive conical bill; the black mask wraps the bill base and chin.",
  sparrow: "Head reduced to real proportion and set straight onto the shoulders with no visible neck. Conical seed-eater's bill, black lores and bib, pale cheek, chestnut nape.",
  swan: "Neck rebuilt as a curvature-driven S, with a flat-crowned skull whose face carries straight into the bill.",
  crow: "Long corvid face with a shallow crown and a slightly hooked bill continuing the culmen line.",
  toucan: "Keeled, laterally compressed bill, longer and deeper, with a 60/40 split between the mandibles. The black tip is on the upper mandible only, and the forehead rises into the culmen without a notch.",
  macaw: "Black scoop lower mandible now visible under the pale hook. Thick waist-free neck, with no collar crease at the throat.",
  flamingo: "Compact torso and a long S-neck sharing one continuous surface. The heel joint reads at mid-leg, and the filter bill droops at its midpoint.",
  heron: "Retracted S-neck with a flared breast inlet. Plumes now trail from the nape, and the bare yellow tibia ends at a readable heel.",
  spoonbill: "The bill broadens into a rounded spatula, widest just before the tip and flatter than the shaft, instead of flaring like a fishtail.",
  stilt: "Rescaled to real size. Very long bare tibia and tarsus with a slim heel knob for checking the joints.",
  ostrich: "Bare, muscular pink thighs emerge from the body. The neck is a near-vertical column with a slight forward head carriage.",
  penguin: "The body now rests on its feet instead of sinking through the ground, and the flipper ends mid-flank.",
  eagle: "Heavy brow over the orbit, with the yellow hook growing straight out of the face; the neck is now narrower than the skull.",
  owl: "Broad facial disc kept full so the small hooked bill emerges from it rather than pinching the face to a cone.",
  rooster: "Short feathered thigh over a yellow shank. The sickle tail is lifted so it no longer clips the ground.",
  pelican: "Bill lengthened to about three head lengths, with a hooked nail at the tip. The pouch hangs deepest near the base and tapers away.",
  duck: "Neck leaves the breast low and curves forward into the head instead of rising as a pipe elbow.",
};

const POSES: Array<{ key: PoseName; label: string }> = [
  { key: "perch", label: "Perch" },
  { key: "walk", label: "Walk" },
  { key: "peck", label: "Forage" },
  { key: "glide", label: "Glide" },
  { key: "flap", label: "Flap" },
];

const SCENES: Record<SceneKey, { label: string; copy: string; birds: string[] | "all"; sky: string; ground: string }> = {
  all: { label: "Family atlas", copy: "All species arranged as a normalized reference collection.", birds: "all", sky: "#d7e8e3", ground: "#7aa9a0" },
  garden: { label: "Garden birds", copy: "Small perching, climbing, and urban birds.", birds: ["sparrow", "robin", "cardinal", "pigeon", "woodpecker", "crow", "kingfisher"], sky: "#dfe9d7", ground: "#82a878" },
  wetlands: { label: "Wetland edge", copy: "Long-necked waders and waterbirds together.", birds: ["flamingo", "heron", "crane", "spoonbill", "stilt", "swan", "duck", "pelican", "kingfisher"], sky: "#cfdee0", ground: "#669d99" },
  rainforest: { label: "Rainforest canopy", copy: "Parrots, toucans, hornbills, and display birds.", birds: ["macaw", "cockatoo", "toucan", "hornbill", "kingfisher", "peacock"], sky: "#b9d5c2", ground: "#3f8065" },
  ocean: { label: "Open ocean", copy: "Alcids, penguins, gulls, pelicans, and soaring albatross.", birds: ["puffin", "penguin", "albatross", "seagull", "pelican"], sky: "#cbdde8", ground: "#5789a0" },
  raptors: { label: "Raptors", copy: "Contrasting soaring, pursuit, and nocturnal predators.", birds: ["eagle", "falcon", "owl", "crow"], sky: "#d9d5ca", ground: "#8d8877" },
  ground: { label: "Ground birds", copy: "Ratites and heavy terrestrial galliforms.", birds: ["ostrich", "kiwi", "turkey", "rooster", "peacock"], sky: "#eadfc7", ground: "#aa8e65" },
};

const CONFIG_KEYS = [
  "size", "girth", "bodyLength", "headSize", "neckLength", "neckCurve", "beakLength", "beakDepth",
  "eyeSize", "legLength", "wingspan", "wingChord", "tailLength", "tailSpread", "crestSize", "crestRaise", "variation",
] as const;

const isCompactViewport = () => typeof window !== "undefined" && window.matchMedia(COMPACT_QUERY).matches;

function formatMeters(value: number) {
  if (value < 1) return `${Math.round(value * 100)} cm`;
  return `${value.toFixed(2)} m`;
}

/** Herd camera offset widened on narrow (portrait) stages so the whole family stays in frame. */
function overviewOffset(aspect: number) {
  return HERD_OFFSET.clone().multiplyScalar(Math.max(1, 1.24 / Math.max(aspect, 0.2)));
}

/** Glides the camera to the herd overview or to a close inspection view of one specimen. */
function flyTo(runtime: StageRuntime, key: string | null, close: boolean, snap = false) {
  const asset = key ? runtime.animals.get(key) : undefined;
  const useClose = Boolean(asset && close);
  const target = useClose && asset ? asset.position.clone().add(new THREE.Vector3(0, 0.5, 0)) : HERD_TARGET.clone();
  // On phones the close view sits nearer so the specimen fills the smaller stage.
  const subsetScale = Math.min(1, Math.max(0.58, Math.sqrt(runtime.sceneKeys.size / 32)));
  const offset = useClose ? CLOSE_OFFSET.clone().multiplyScalar(isCompactViewport() ? 0.6 : 1) : overviewOffset(runtime.camera.aspect).multiplyScalar(subsetScale);
  const goal: CameraGoal = { target, position: target.clone().add(offset) };
  if (snap) {
    runtime.controls.target.copy(goal.target);
    runtime.camera.position.copy(goal.position);
    runtime.goal = null;
    runtime.controls.update();
  } else {
    runtime.goal = goal;
  }
}

function disposeObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    meshMaterials.forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function setMaterialFocus(asset: StageAsset, focus: FocusArea, active: boolean) {
  const parts = REVIEW_AREAS[focus].parts;
  asset.object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const isFocusPart = active && parts.includes(String(mesh.userData.part));
    materials.forEach((material) => {
      const standard = material as THREE.MeshStandardMaterial;
      if (!standard.emissive) return;
      standard.emissive.set(isFocusPart ? "#46e0bc" : "#000000");
      standard.emissiveIntensity = isFocusPart ? 0.42 : 0;
    });
  });
}

function updateStageSelection(runtime: StageRuntime, key: string, focus: FocusArea, isolate: boolean, showRig: boolean) {
  runtime.selected = key;
  runtime.focus = focus;
  runtime.isolate = isolate;
  runtime.showRig = showRig;

  runtime.animals.forEach((asset, assetKey) => {
    const inScene = runtime.sceneKeys.has(assetKey);
    asset.object.visible = inScene && (!isolate || assetKey === key);
    asset.pad.visible = inScene && !isolate;
    setMaterialFocus(asset, focus, assetKey === key);
  });

  const selected = runtime.animals.get(key);
  if (!selected) return;
  runtime.marker.position.copy(selected.position);
  runtime.marker.visible = true;

  if (runtime.skeleton) {
    runtime.scene.remove(runtime.skeleton);
    runtime.skeleton.dispose();
    runtime.skeleton = null;
  }
  if (showRig) {
    const skeleton = new THREE.SkeletonHelper(selected.object);
    skeleton.material = new THREE.LineBasicMaterial({ color: "#f4d46b", transparent: true, opacity: 0.92 });
    skeleton.name = "review-skeleton";
    runtime.skeleton = skeleton;
    runtime.scene.add(skeleton);
  }
}

/** Reflows a scene subset into centred rows and updates every selectable pad. */
function applyScene(runtime: StageRuntime, sceneKey: SceneKey, selected: string, isolate: boolean) {
  const definition = SCENES[sceneKey];
  const keys = definition.birds === "all" ? [...runtime.animals.keys()] : definition.birds.filter((key) => runtime.animals.has(key));
  runtime.sceneKey = sceneKey;
  runtime.sceneKeys = new Set(keys);
  runtime.scene.background = new THREE.Color(definition.sky);
  if (runtime.scene.fog instanceof THREE.Fog) runtime.scene.fog.color.set(definition.sky);
  (runtime.floor.material as THREE.MeshStandardMaterial).color.set(definition.ground);
  const columns = Math.min(sceneKey === "all" ? 8 : 5, keys.length);
  const rows = Math.ceil(keys.length / columns);
  keys.forEach((key, index) => {
    const asset = runtime.animals.get(key)!;
    const row = Math.floor(index / columns);
    const col = index % columns;
    const inRow = Math.min(columns, keys.length - row * columns);
    const x = (col - (inRow - 1) / 2) * (sceneKey === "all" ? 2.85 : 3.3) + (row % 2 ? 0.28 : -0.14);
    const z = (row - (rows - 1) / 2) * 4.2;
    asset.position.set(x, 0.045, z);
    asset.object.position.x = x;
    asset.object.position.z = z;
    asset.pad.position.set(x, 0.025, z);
  });
  updateStageSelection(runtime, selected, runtime.focus, runtime.sceneKeys.has(selected) ? isolate : false, runtime.showRig);
}

function cloneEditableMaterials(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((material) => material.clone());
    else mesh.material = mesh.material.clone();
  });
}

/** Rebuilds one procedural bird while preserving its scene slot and normalization reference. */
function rebuildStageAsset(runtime: StageRuntime, key: string, config: BirdConfig, pose: PoseName, playing: boolean) {
  const asset = runtime.animals.get(key);
  if (!asset) return;
  const configKey = JSON.stringify(config);
  if (asset.configKey === configKey) return;
  if (runtime.skeleton) {
    runtime.scene.remove(runtime.skeleton);
    runtime.skeleton.dispose();
    runtime.skeleton = null;
  }
  asset.action?.stop();
  asset.mixer?.stopAllAction();
  const old = asset.object;
  const object = createAsset({ species: key, detail: "draft", rigMode: "skinned", mergeForProduction: false, pose, ...config }) as THREE.Group;
  cloneEditableMaterials(object);
  object.scale.setScalar(asset.normalizationScale);
  object.rotation.copy(old.rotation);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  object.position.set(asset.position.x, -box.min.y + 0.07, asset.position.z);
  object.userData.stageKey = key;
  runtime.scene.remove(old);
  runtime.scene.add(object);
  disposeObject(old);
  asset.object = object;
  asset.dimensions = object.userData.dimensions;
  asset.mixer = null;
  asset.action = null;
  asset.configKey = configKey;
  updateStageSelection(runtime, runtime.selected, runtime.focus, runtime.isolate, runtime.showRig);
  setStagePose(runtime, key, pose, playing);
}

function setStagePose(runtime: StageRuntime, key: string, pose: PoseName, playing: boolean) {
  runtime.animals.forEach((asset, assetKey) => {
    if (assetKey === key) return;
    if (asset.action) asset.action.stop();
    asset.action = null;
  });

  const asset = runtime.animals.get(key);
  if (!asset) return;
  if (asset.action) asset.action.stop();
  asset.action = null;

  if (playing) {
    const clip = createClips(asset.object).find((candidate: THREE.AnimationClip) => candidate.name === pose);
    if (clip) {
      if (!asset.mixer) asset.mixer = new THREE.AnimationMixer(asset.object);
      asset.action = asset.mixer.clipAction(clip);
      asset.action.reset().play();
    }
  } else {
    setPose(asset.object, pose, pose === "peck" ? 0.15 : 0.25);
  }
}

export default function App() {
  const stageElement = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<StageRuntime | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [selected, setSelected] = useState("spoonbill");
  const [focus, setFocus] = useState<FocusArea>("body");
  const [pose, setPoseName] = useState<PoseName>("perch");
  const [playing, setPlaying] = useState(false);
  const [showRig, setShowRig] = useState(true);
  const [isolate, setIsolate] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [activeScene, setActiveScene] = useState<SceneKey>("all");
  const [birdConfigs, setBirdConfigs] = useState<Record<string, BirdConfig>>(() => {
    try {
      return JSON.parse(localStorage.getItem("polyforge-bird-configs") ?? "{}");
    } catch {
      return {};
    }
  });
  const [, setAssetRevision] = useState(0);

  const animalEntries = useMemo(
    () => Object.entries(species).map(([key, value]) => ({ key, label: value.label, scientific: value.scientific })),
    [],
  );
  const animalKeys = useMemo(() => animalEntries.map((animal) => animal.key), [animalEntries]);
  const selectedIndex = Math.max(0, animalKeys.indexOf(selected));
  const selectedData = animalEntries[selectedIndex] ?? animalEntries[0];
  const selectedAsset = runtimeRef.current?.animals.get(selected);
  const selectedDimensions = selectedAsset?.dimensions;
  const bodyForm = selectedAsset?.object.userData.bodyForm as string | undefined;
  const selectedConfig = birdConfigs[selected] ?? {};

  /** Selects a specimen from the UI; on compact screens the camera also glides to it. */
  const choose = useCallback((key: string) => {
    setSelected(key);
    const runtime = runtimeRef.current;
    if (runtime && !runtime.sceneKeys.has(key)) setActiveScene("all");
    if (runtime && isCompactViewport()) flyTo(runtime, key, true);
  }, []);

  const updateConfig = useCallback((key: string, value: string | number | boolean) => {
    setBirdConfigs((current) => ({ ...current, [selected]: { ...(current[selected] ?? {}), [key]: value } }));
  }, [selected]);

  const resetConfig = useCallback(() => {
    setBirdConfigs((current) => {
      const next = { ...current };
      delete next[selected];
      return next;
    });
  }, [selected]);

  const stepSpecimen = useCallback(
    (direction: number) => {
      const next = animalKeys[(selectedIndex + direction + animalKeys.length) % animalKeys.length];
      choose(next);
    },
    [animalKeys, selectedIndex, choose],
  );

  useEffect(() => {
    const host = stageElement.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#d7e8e3");
    scene.fog = new THREE.Fog("#d7e8e3", 18, 42);

    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 120);
    camera.position.copy(HERD_TARGET).add(HERD_OFFSET);

    // Touch devices skip shadow maps: they are the most expensive pass on mobile GPUs.
    const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: !coarse, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !coarse;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minDistance = 2.6;
    controls.maxDistance = 90;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.copy(HERD_TARGET);
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    controls.update();

    const hemisphere = new THREE.HemisphereLight("#f4fff8", "#355a52", 2.2);
    scene.add(hemisphere);
    const keyLight = new THREE.DirectionalLight("#fff3cf", 3.1);
    keyLight.position.set(-6, 12, 6);
    keyLight.castShadow = !coarse;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -14;
    keyLight.shadow.camera.right = 14;
    keyLight.shadow.camera.top = 14;
    keyLight.shadow.camera.bottom = -14;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight("#82c8ba", 1.45);
    fillLight.position.set(8, 5, -9);
    scene.add(fillLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(16.5, 80),
      new THREE.MeshStandardMaterial({ color: "#7aa9a0", roughness: 0.95, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(30, 30, "#50857c", "#88b9ae");
    grid.position.y = 0.011;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.38;
    scene.add(grid);

    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(1.03, 0.028, 8, 60),
      new THREE.MeshBasicMaterial({ color: "#f7c85b", transparent: true, opacity: 0.95 }),
    );
    marker.rotation.x = Math.PI / 2;
    marker.position.y = 0.045;
    scene.add(marker);

    const animalMap = new Map<string, StageAsset>();
    const speciesCount = Object.keys(species).length;
    const rowCount = Math.ceil(speciesCount / 7);
    Object.entries(species).forEach(([key, meta], index) => {
      const col = index % 7;
      const row = Math.floor(index / 7);
      const inRow = Math.min(7, speciesCount - row * 7);
      const object = createAsset({
        species: key,
        detail: "draft",
        rigMode: "skinned",
        mergeForProduction: false,
        pose: "perch",
        posePhase: (index % 5) / 5,
      }) as THREE.Group;

      // Editable part meshes get unique materials so the reviewer can light a connection zone.
      cloneEditableMaterials(object);

      object.updateMatrixWorld(true);
      const rawBox = new THREE.Box3().setFromObject(object);
      const rawSize = rawBox.getSize(new THREE.Vector3());
      const scale = 1.23 / Math.max(rawSize.x, rawSize.y, rawSize.z, 0.001);
      object.scale.setScalar(scale);
      object.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(object);
      const x = (col - (inRow - 1) / 2) * 3.05 + (row % 2 ? 0.38 : -0.18);
      const z = (row - (rowCount - 1) / 2) * 4.15;
      object.position.set(x, -scaledBox.min.y + 0.07, z);
      object.rotation.y = ((index * 31) % 38 - 19) * (Math.PI / 180);
      object.userData.stageKey = key;
      object.updateMatrixWorld(true);
      scene.add(object);

      // The pad is a larger, forgiving touch target around each specimen.
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.06, 1.15, 0.06, 48),
        new THREE.MeshStandardMaterial({ color: ADDED_KEYS.has(key) ? "#e9a6a9" : "#9cc6bb", roughness: 0.88 }),
      );
      pad.position.set(x, 0.025, z);
      pad.receiveShadow = true;
      pad.userData.stageKey = key;
      scene.add(pad);

      const dimensions = object.userData.dimensions as StageAsset["dimensions"];
      animalMap.set(key, {
        key,
        label: meta.label,
        scientific: meta.scientific,
        object,
        mixer: null,
        action: null,
        position: new THREE.Vector3(x, 0.045, z),
        dimensions,
        pad,
        normalizationScale: scale,
        configKey: "{}",
      });
    });

    const runtime: StageRuntime = {
      scene,
      camera,
      controls,
      renderer,
      clock: new THREE.Clock(),
      animals: animalMap,
      marker,
      skeleton: null,
      selected,
      focus,
      isolate,
      showRig,
      goal: null,
      sceneKey: "all",
      sceneKeys: new Set(animalMap.keys()),
      floor,
    };
    runtimeRef.current = runtime;
    applyScene(runtime, "all", selected, isolate);
    updateStageSelection(runtime, selected, focus, isolate, showRig);
    setStagePose(runtime, selected, pose, playing);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    // Phones open on a close view of the selected specimen; desktop keeps the herd overview.
    if (isCompactViewport()) flyTo(runtime, selected, true, true);

    // Any direct touch or drag cancels an in-flight camera glide.
    controls.addEventListener("start", () => {
      runtime.goal = null;
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pick = (key: string) => {
      setSelected(key);
      if (isCompactViewport()) flyTo(runtime, key, true);
    };
    const pickAt = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      for (const hit of hits) {
        let node: THREE.Object3D | null = hit.object;
        while (node && !node.userData.stageKey) node = node.parent;
        const key = node?.userData.stageKey as string | undefined;
        if (key && animalMap.has(key)) {
          pick(key);
          return;
        }
      }
    };

    // Tap detection: a short press that barely moves selects; drags and pinches only orbit.
    let press: { id: number; x: number; y: number; t: number } | null = null;
    const onDown = (event: PointerEvent) => {
      press = { id: event.pointerId, x: event.clientX, y: event.clientY, t: performance.now() };
    };
    const onUp = (event: PointerEvent) => {
      const start = press;
      press = null;
      if (!start || start.id !== event.pointerId || !event.isPrimary) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved > 10 || performance.now() - start.t > 450) return;
      pickAt(event);
    };
    const onCancel = () => {
      press = null;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onCancel);

    let frame = 0;
    const render = () => {
      frame = requestAnimationFrame(render);
      const delta = runtime.clock.getDelta();
      runtime.animals.forEach((asset) => asset.mixer?.update(delta));
      marker.rotation.z += delta * 0.45;
      const goal = runtime.goal;
      if (goal) {
        // Frame-rate independent glide: the same wall-clock time at 10 fps or 60 fps.
        const ease = 1 - Math.exp(-Math.min(delta, 0.25) * 7);
        controls.target.lerp(goal.target, ease);
        camera.position.lerp(goal.position, ease);
        if (controls.target.distanceTo(goal.target) < 0.002 && camera.position.distanceTo(goal.position) < 0.002) {
          runtime.goal = null;
        }
      }
      controls.update();
      renderer.render(scene, camera);
    };
    render();
    setIsReady(true);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onCancel);
      controls.dispose();
      if (runtime.skeleton) {
        scene.remove(runtime.skeleton);
        runtime.skeleton.dispose();
      }
      animalMap.forEach((asset) => {
        disposeObject(asset.object);
        asset.pad.geometry.dispose();
        (asset.pad.material as THREE.Material).dispose();
      });
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      runtimeRef.current = null;
      setIsReady(false);
    };
  }, []); // The scene is constructed once; the effects below update the live runtime.

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    updateStageSelection(runtime, selected, focus, isolate, showRig);
  }, [selected, focus, isolate, showRig]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    setStagePose(runtime, selected, pose, playing);
  }, [selected, pose, playing]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const definition = SCENES[activeScene];
    const keys = definition.birds === "all" ? [...runtime.animals.keys()] : definition.birds;
    const nextSelected = keys.includes(selected) ? selected : keys[0];
    if (nextSelected !== selected) setSelected(nextSelected);
    applyScene(runtime, activeScene, nextSelected, isolate);
    flyTo(runtime, null, false);
  }, [activeScene]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const config = birdConfigs[selected] ?? {};
    const timer = window.setTimeout(() => {
      rebuildStageAsset(runtime, selected, config, pose, playing);
      setAssetRevision((value) => value + 1);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [selected, birdConfigs]);

  useEffect(() => {
    localStorage.setItem("polyforge-bird-configs", JSON.stringify(birdConfigs));
  }, [birdConfigs]);

  // Keep the selected card centred in the horizontal specimen strip (compact layout only).
  useEffect(() => {
    const rail = railRef.current;
    const card = cardRefs.current[selected];
    if (!rail || !card || rail.scrollWidth <= rail.clientWidth + 2) return;
    rail.scrollTo({ left: card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2, behavior: "smooth" });
  }, [selected]);

  // Left and right arrow keys step through specimens.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepSpecimen(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        stepSpecimen(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepSpecimen]);

  const frameAll = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime) flyTo(runtime, null, false);
  }, []);

  const inspectSelected = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime) flyTo(runtime, selected, true);
  }, [selected]);

  return (
    <main className="review-app">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Waypoints size={20} strokeWidth={2.2} /></div>
          <div>
            <div className="eyebrow">PolyForge / QA</div>
            <h1>Animal Form Lab</h1>
          </div>
        </div>
        <div className="topbar-center">
          <span className="source-dot" />
          <span>{SOURCE_LABEL}</span>
          <span className="source-divider" />
          <span>{animalEntries.length} review assets</span>
        </div>
        <div className="topbar-actions">
          <button className="text-button" onClick={frameAll} aria-label="Frame all specimens">
            <Maximize2 size={15} /> <span>Frame all</span>
          </button>
          <span className="ready-pill">
            <ShieldCheck size={15} /> <span>Review set ready</span>
          </span>
        </div>
      </header>

      <div className="workspace">
        <div className="stage-column">
          <div className="stage-toolbar">
            <label className="scene-picker">
              <Grid3X3 size={15} />
              <span className="sr-only">Scene composition</span>
              <select value={activeScene} onChange={(event) => { setIsolate(false); setActiveScene(event.target.value as SceneKey); }}>
                {(Object.keys(SCENES) as SceneKey[]).map((key) => <option key={key} value={key}>{SCENES[key].label}</option>)}
              </select>
              <small>{SCENES[activeScene].copy}</small>
            </label>
            <div className="view-actions">
              <button
                className="tool-button"
                aria-pressed={isolate}
                onClick={() => setIsolate((value) => !value)}
                title="Isolate selected asset"
              >
                <BoxSelect size={17} /> <span>Isolate</span>
              </button>
              <button
                className="tool-button"
                aria-pressed={showRig}
                onClick={() => setShowRig((value) => !value)}
                title="Show selected armature"
              >
                <Waypoints size={17} /> <span>Rig</span>
              </button>
              <button className="tool-button" onClick={inspectSelected} title="Close view of selected asset">
                <Focus size={17} /> <span>Inspect</span>
              </button>
              <button className="tool-button" onClick={frameAll} title="Herd overview">
                <Maximize2 size={17} /> <span>Herd</span>
              </button>
            </div>
          </div>

          <div className="stage-host" ref={stageElement}>
            <div className="stage-scan" />
            <div className="stage-caption">
              <span className="caption-index">{String(selectedIndex + 1).padStart(2, "0")}/{animalKeys.length}</span>
              <strong>{selectedData.label}</strong>
              {ADDED_KEYS.has(selected) && <span className="added-tag">New</span>}
            </div>
            <button className="stage-nav is-prev" onClick={() => stepSpecimen(-1)} aria-label="Previous specimen">
              <ChevronLeft size={22} />
            </button>
            <button className="stage-nav is-next" onClick={() => stepSpecimen(1)} aria-label="Next specimen">
              <ChevronRight size={22} />
            </button>
            <div className="stage-hud stage-hud-bottom">
              <span className="hint-mouse"><MousePointer2 size={13} /> CLICK TO SELECT · DRAG TO ORBIT · SCROLL TO ZOOM</span>
              <span className="hint-touch"><MousePointer2 size={13} /> TAP TO SELECT · DRAG · PINCH</span>
            </div>
            {!isReady && <div className="stage-loading">Assembling review scene...</div>}
          </div>

          <div className="focus-strip" role="group" aria-label="Connection review focus">
            {(Object.keys(REVIEW_AREAS) as FocusArea[]).map((area) => (
              <button
                key={area}
                className={`focus-option ${focus === area ? "is-selected" : ""}`}
                aria-pressed={focus === area}
                onClick={() => setFocus(area)}
              >
                <span>{REVIEW_AREAS[area].short}</span>
                <strong>{REVIEW_AREAS[area].label}</strong>
              </button>
            ))}
            <p>{REVIEW_AREAS[focus].copy}</p>
          </div>
        </div>

        <aside className="asset-rail" aria-label="Animal asset library">
          <div className="rail-heading">
            <div>
              <span className="eyebrow">Asset coverage</span>
              <h2>Bird rig family</h2>
            </div>
            <span className="count-label">{animalEntries.length}</span>
          </div>
          <p className="rail-copy">One scene, normalized for silhouette and connection review.</p>
          <div className="asset-list" ref={railRef}>
            {animalEntries.map((animal, index) => (
              <button
                key={animal.key}
                ref={(element: HTMLButtonElement | null) => {
                  cardRefs.current[animal.key] = element;
                }}
                className={`asset-row ${selected === animal.key ? "is-selected" : ""}`}
                aria-current={selected === animal.key ? "true" : undefined}
                onClick={() => choose(animal.key)}
              >
                <span className="asset-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="asset-text">
                  <strong>{animal.label}</strong>
                  <small>{animal.scientific}</small>
                </span>
                {ADDED_KEYS.has(animal.key) ? <span className="added-tag">New</span> : <ChevronRight size={15} />}
              </button>
            ))}
          </div>
          <div className="rail-footer">
            <Sparkles size={16} />
            <span>{animalEntries.length} procedural species presets</span>
          </div>
        </aside>

        <aside className="inspector" aria-label="Selected animal inspector">
          <div className="inspector-kicker">
            <span className="eyebrow">Selected specimen</span>
            {ADDED_KEYS.has(selected) && <span className="revision-tag">Revised</span>}
          </div>
          <h2>{selectedData.label}</h2>
          <p className="scientific-name">{selectedData.scientific}</p>

          <div className="review-status">
            <span className="status-orb" />
            <div>
              <strong>Connection pass</strong>
              <small>{REVIEW_AREAS[focus].label} under inspection</small>
            </div>
          </div>

          <section className="inspector-section">
            <div className="section-label"><Grid3X3 size={15} /> Measured silhouette</div>
            <div className="measurements">
              <div><span>Length</span><strong>{selectedDimensions ? formatMeters(selectedDimensions.length) : "..."}</strong></div>
              <div><span>Height</span><strong>{selectedDimensions ? formatMeters(selectedDimensions.height) : "..."}</strong></div>
              <div><span>Span</span><strong>{selectedDimensions ? formatMeters(selectedDimensions.width) : "..."}</strong></div>
            </div>
            <p className="body-form-note">Torso profile <strong>{bodyForm ? bodyForm.replace(/-/g, " ") : "..."}</strong></p>
          </section>

          <details className="inspector-section config-panel" open>
            <summary>
              <span className="section-label"><SlidersHorizontal size={15} /> Bird configuration</span>
              <button type="button" className="reset-config" onClick={(event) => { event.preventDefault(); resetConfig(); }}>
                <RotateCcw size={13} /> Reset
              </button>
            </summary>
            <div className="choice-controls">
              {["colorway", "bodyForm", "wingTip", "tailStyle", "feet"].map((key) => {
                const schema = assetParams[key];
                if (!schema || schema.type !== "choice") return null;
                return (
                  <label key={key}>
                    <span>{schema.label}</span>
                    <select value={String(selectedConfig[key] ?? schema.default)} onChange={(event) => updateConfig(key, event.target.value)}>
                      {schema.options?.map((option) => <option key={option} value={option}>{option.replace(/-/g, " ")}</option>)}
                    </select>
                  </label>
                );
              })}
            </div>
            <div className="range-controls">
              {CONFIG_KEYS.map((key) => {
                const schema = assetParams[key];
                if (!schema || schema.type !== "range") return null;
                const value = Number(selectedConfig[key] ?? schema.default);
                return (
                  <label key={key} title={schema.describe}>
                    <span>{schema.label}<output>{value.toFixed(schema.step && schema.step >= 1 ? 0 : 2)}</output></span>
                    <input type="range" min={schema.min} max={schema.max} step={schema.step} value={value} onChange={(event) => updateConfig(key, Number(event.target.value))} />
                  </label>
                );
              })}
            </div>
          </details>

          <section className="inspector-section">
            <div className="section-label"><Rotate3D size={15} /> Pose check</div>
            <div className="pose-grid">
              {POSES.map((option) => (
                <button
                  key={option.key}
                  className={pose === option.key ? "is-selected" : ""}
                  aria-pressed={pose === option.key}
                  onClick={() => setPoseName(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              className={`motion-button ${playing ? "is-playing" : ""}`}
              aria-pressed={playing}
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
              {playing ? "Pause motion" : `Preview ${pose} motion`}
            </button>
          </section>

          <section className="inspector-section anatomy-notes">
            <div className="section-label"><Info size={15} /> QA notes</div>
            <p>
              {QA_NOTES[selected] ??
                "Femur and knee sit inside the body; a feathered drumstick emerges from the belly, then the heel joint, tarsus, and padded toes. Orbit to inspect the seams."}
            </p>
          </section>

          <div className="inspector-footer">
            <Layers2 size={15} />
            <span>Editable anatomical submeshes</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
