import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Box, RotateCcw } from 'lucide-react';
import type { Animal, AnimalOptions } from '../data/catalog';
import { disposeObject, makeAnimal, modelStats, type ModelStats } from '../engine/studio';

export type CameraView = 'Perspective' | 'Front' | 'Side' | 'Top';
export interface ViewportHandle {
  reset: () => void;
  snapshot: () => string | null;
  fullscreen: () => void;
}
interface Props {
  animal: Animal;
  options: AnimalOptions;
  night: boolean;
  grid: boolean;
  shadows: boolean;
  wireframe: boolean;
  autoRotate: boolean;
  playing: boolean;
  environment: 'studio' | 'habitat';
  tool: 'orbit' | 'select';
  view: CameraView;
  hiddenParts: string[];
  selectedPart: string | null;
  onSelect: (name: string | null) => void;
  onStats: (stats: ModelStats) => void;
  onError: (message: string) => void;
}
interface Studio {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  platform: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  grid: THREE.GridHelper;
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  ambient: THREE.HemisphereLight;
  habitat: THREE.Group;
  model: THREE.Group | null;
  display: THREE.Group | null;
  outline: THREE.BoxHelper | null;
  animation: number;
  reveal: number;
  targetScale: number;
  calibration: { animalId: string; scale: number } | null;
  framingTarget: number;
  frameRatio: number;
  baseMaterials: Map<THREE.Mesh, THREE.MeshStandardMaterial>;
  modifiedMaterials: Set<THREE.Material>;
}

function createHabitat() {
  const group = new THREE.Group(); group.name = 'habitat';
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a9670, flatShading: true, roughness: 1 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xb0ad97, flatShading: true, roughness: 1 });
  for (let i = 0; i < 7; i++) {
    const a = i * 2.39, radius = 1.50 + Math.sin(i) * 0.18, x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    if (i % 3 === 0) { const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.10 + i * 0.012, 0), rockMat); rock.position.set(x, 0.08, z); rock.scale.set(1.3, 0.7, 1); rock.rotation.set(i, i * 0.8, 0); rock.castShadow = true; group.add(rock); }
    else for (let blade = 0; blade < 5; blade++) {
      const shape = new THREE.Shape(); shape.moveTo(-0.018, 0); shape.quadraticCurveTo(-0.045 + blade * 0.012, 0.13, (blade - 2) * 0.026, 0.20 + Math.sin(blade) * 0.04); shape.quadraticCurveTo(0.027, 0.08, 0.018, 0); shape.closePath();
      const geo = new THREE.ShapeGeometry(shape); const grassMat = mat; grassMat.side = THREE.DoubleSide;
      const grass = new THREE.Mesh(geo, grassMat); grass.position.set(x + (blade - 2) * 0.01, 0.045, z); grass.rotation.y = blade * 0.9; grass.castShadow = true; group.add(grass);
    }
  }
  return group;
}

const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(props, ref) {
  const mount = useRef<HTMLDivElement>(null);
  const studio = useRef<Studio | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [modelVersion, setModelVersion] = useState(0);
  const optionsKey = JSON.stringify(props.options);

  useImperativeHandle(ref, () => ({
    reset: () => {
      const s = studio.current; if (!s) return;
      s.camera.position.set(3.6 * s.frameRatio, s.framingTarget + 2.05 * s.frameRatio, 6.6 * s.frameRatio); s.controls.target.set(0, s.framingTarget, 0); s.camera.zoom = 1; s.camera.updateProjectionMatrix(); s.controls.update();
    },
    snapshot: () => {
      const s = studio.current; if (!s) return null;
      s.renderer.render(s.scene, s.camera); return s.renderer.domElement.toDataURL('image/png');
    },
    fullscreen: () => {
      const target = mount.current?.closest('.scene-panel') as HTMLElement | null;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      else if (target?.requestFullscreen) void target.requestFullscreen().catch(() => latest.current.onError('Fullscreen is not available in this browser.'));
      else latest.current.onError('Fullscreen is not supported in this browser.');
    },
  }), []);

  useEffect(() => {
    const element = mount.current; if (!element) return;
    let s: Studio;
    let resize: ResizeObserver;
    let pointerStart = [0, 0];
    try {
      const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.28;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional animal. Drag to orbit, scroll to zoom.');
      renderer.domElement.setAttribute('role', 'img');
      element.appendChild(renderer.domElement);
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#f0f0e9'); scene.fog = new THREE.Fog('#f0f0e9', 11, 24);
      const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100); camera.position.set(3.6, 2.65, 6.6);
      const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.065; controls.target.set(0, 0.60, 0); controls.minDistance = 2.8; controls.maxDistance = 22; controls.maxPolarAngle = Math.PI / 2 - 0.035; controls.minPolarAngle = 0.08; controls.autoRotateSpeed = 0.7; controls.enablePan = true; controls.update();
      const ambient = new THREE.HemisphereLight(0xffffff, 0x8d8c75, 2.4); scene.add(ambient);
      const key = new THREE.DirectionalLight(0xfff4df, 3.0); key.position.set(-3.5, 7, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4; key.shadow.camera.near = 0.1; key.shadow.camera.far = 20; key.shadow.normalBias = 0.017; key.shadow.bias = -0.00015; key.shadow.radius = 4; scene.add(key);
      const fill = new THREE.DirectionalLight(0xdfeafa, 0.9); fill.position.set(4, 4, -5); scene.add(fill);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: '#efefe8', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.062; ground.receiveShadow = true; scene.add(ground);
      const grid = new THREE.GridHelper(28, 56, 0xc6c9b9, 0xd0d1c5); grid.position.y = -0.060; (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.33; scene.add(grid);
      const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.82, 1.84, 0.11, 96), new THREE.MeshStandardMaterial({ color: '#dfc9a6', roughness: 0.98 })); platform.position.y = -0.002; platform.receiveShadow = true; platform.castShadow = true; scene.add(platform);
      const habitat = createHabitat(); habitat.visible = false; scene.add(habitat);
      s = { renderer, scene, camera, controls, ground, platform, grid, key, fill, ambient, habitat, model: null, display: null, outline: null, animation: 0, reveal: 0, targetScale: 1, calibration: null, framingTarget: 0.6, frameRatio: 1, baseMaterials: new Map(), modifiedMaterials: new Set() };
      studio.current = s;
      resize = new ResizeObserver(() => {
        const width = element.clientWidth, height = element.clientHeight; if (!width || !height) return;
        renderer.setSize(width, height); const aspect = width / height, half = Math.max(1.93, 2.08 / aspect);
        camera.aspect = aspect; camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(half / 7.791)); camera.updateProjectionMatrix();
      }); resize.observe(element);
      const clock = new THREE.Clock();
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const animate = () => {
        s.animation = requestAnimationFrame(animate);
        const delta = Math.min(clock.getDelta(), 0.05), elapsed = clock.elapsedTime, current = latest.current;
        s.controls.autoRotate = current.autoRotate && !reducedMotion; s.controls.update();
        if (s.display && s.reveal < 1) { s.reveal = Math.min(1, s.reveal + delta * (reducedMotion ? 100 : 2.0)); const ease = 1 - (1 - s.reveal) ** 3; s.display.scale.setScalar(s.targetScale * (0.92 + ease * 0.08)); }
        if (s.model) {
          const rig = s.model.userData.rig as Record<string, { axis: 'x' | 'y' | 'z'; range: number[] }>;
          for (const [name, metadata] of Object.entries(rig)) {
            const pivot = s.model.getObjectByName(name);
            if (!pivot || !pivot.userData.isRig) continue;
            const amplitude = name.includes('wing') ? 0.13 : name === 'tail' ? 0.09 : 0.018;
            pivot.rotation[metadata.axis] = current.playing && !reducedMotion ? Math.sin(elapsed * (name.includes('wing') ? 2.2 : 1.4) + (name === 'right-wing' ? Math.PI : 0)) * amplitude : 0;
          }
        }
        s.outline?.update(); renderer.render(scene, camera);
      }; animate();
      setReady(true);
    } catch (failure) {
      console.error(failure); setError('The 3D studio needs WebGL. Enable hardware acceleration or try another browser.'); return;
    }
    const pointerDown = (event: PointerEvent) => { pointerStart = [event.clientX, event.clientY]; };
    const pointerUp = (event: PointerEvent) => {
      if (latest.current.tool !== 'select' || !s.model || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 5) return;
      const rect = element.getBoundingClientRect(), point = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(point, s.camera);
      const hit = ray.intersectObject(s.model, true).find(intersection => {
        let object: THREE.Object3D | null = intersection.object;
        while (object) { if (!object.visible) return false; object = object.parent; }
        return intersection.object instanceof THREE.Mesh;
      });
      latest.current.onSelect(hit?.object.name || null);
    };
    element.addEventListener('pointerdown', pointerDown); element.addEventListener('pointerup', pointerUp);
    return () => {
      setReady(false); cancelAnimationFrame(s.animation); resize.disconnect(); s.controls.dispose(); s.modifiedMaterials.forEach(mat => mat.dispose()); new Set(s.baseMaterials.values()).forEach(mat => mat.dispose()); disposeObject(s.scene); s.key.shadow.map?.dispose(); s.renderer.dispose(); s.renderer.forceContextLoss(); s.renderer.domElement.remove(); studio.current = null;
      element.removeEventListener('pointerdown', pointerDown); element.removeEventListener('pointerup', pointerUp);
    };
  }, []);

  useEffect(() => {
    const s = studio.current; if (!ready || !s) return;
    try {
      if (s.display) { s.scene.remove(s.display); disposeObject(s.display); }
      s.modifiedMaterials.forEach(material => material.dispose()); s.modifiedMaterials.clear(); new Set(s.baseMaterials.values()).forEach(material => material.dispose()); s.baseMaterials.clear();
      if (s.outline) { s.scene.remove(s.outline); disposeObject(s.outline); s.outline = null; }
      const model = makeAnimal(props.animal, JSON.parse(optionsKey));
      latest.current.onStats(modelStats(model));
      const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const isNewAnimal = s.calibration?.animalId !== props.animal.id;
      if (isNewAnimal) {
        const reference = optionsKey === '{}' ? model : makeAnimal(props.animal, { mergeForProduction: true });
        const referenceSize = new THREE.Box3().setFromObject(reference).getSize(new THREE.Vector3());
        s.calibration = { animalId: props.animal.id, scale: 3.02 / Math.max(referenceSize.x, referenceSize.y, referenceSize.z) };
        if (reference !== model) disposeObject(reference);
      }
      // Calibrate once per species, so changing body length visibly changes its size.
      const display = new THREE.Group(), scale = s.calibration!.scale;
      model.position.sub(center); display.add(model); display.scale.setScalar(scale * (isNewAnimal ? 0.92 : 1)); display.position.y = size.y * scale / 2 + 0.054; s.scene.add(display);
      s.framingTarget = Math.max(0.6, size.y * scale * 0.47);
      s.frameRatio = Math.max(1, size.y * scale / 3.05, size.x * scale / 4, size.z * scale / 3.8);
      if (isNewAnimal) { s.camera.position.y += s.framingTarget - s.controls.target.y; s.controls.target.set(0, s.framingTarget, 0); s.controls.update(); }
      model.traverse(object => { if (object instanceof THREE.Mesh) s.baseMaterials.set(object, object.material as THREE.MeshStandardMaterial); });
      s.model = model; s.display = display; s.reveal = isNewAnimal ? 0 : 1; s.targetScale = scale;
      setModelVersion(version => version + 1); setError('');
    } catch (failure) { console.error(failure); setError('This variation could not be rendered. Reset the parameters to try again.'); latest.current.onError('Unable to rebuild this variation. Try resetting its parameters.'); }
  }, [ready, props.animal, optionsKey]);

  useEffect(() => {
    const s = studio.current; if (!s) return;
    s.scene.background = new THREE.Color(props.night ? '#24332f' : '#f0f0e9');
    s.scene.fog = new THREE.Fog(props.night ? '#24332f' : '#f0f0e9', 11, 24);
    s.ground.material.color.set(props.night ? '#263730' : '#efefe8'); s.platform.material.color.set(props.night ? '#7f8069' : props.environment === 'habitat' ? '#c0bea0' : '#dfc9a6');
    s.ambient.intensity = props.night ? 0.75 : 2.4; s.key.intensity = props.night ? 1.4 : 3.0; s.key.color.set(props.night ? '#b7cce6' : '#fff4df'); s.fill.intensity = props.night ? 0.7 : 0.9;
    s.grid.visible = props.grid; s.key.castShadow = props.shadows; s.renderer.shadowMap.enabled = props.shadows; s.habitat.visible = props.environment === 'habitat';
    s.modifiedMaterials.forEach(material => material.dispose()); s.modifiedMaterials.clear();
    const variants = new Map<string, THREE.MeshStandardMaterial>();
    s.baseMaterials.forEach((base, mesh) => {
      const zone = mesh.userData.zone, key = `${base.uuid}-${props.night ? zone : 'day'}`;
      if (!variants.has(key)) {
        const material = base.clone(); material.wireframe = props.wireframe;
        const lighting = s.model?.userData.night?.[zone];
        if (props.night && lighting) { material.emissive.set(lighting.color); material.emissiveIntensity = lighting.intensity; }
        variants.set(key, material); s.modifiedMaterials.add(material);
      }
      mesh.material = variants.get(key)!;
    });
  }, [props.night, props.grid, props.shadows, props.wireframe, props.environment, modelVersion]);

  useEffect(() => {
    const s = studio.current; if (!s?.model) return;
    s.model.traverse(object => { if (object instanceof THREE.Mesh || object.userData.isRig) object.visible = !props.hiddenParts.includes(object.name); });
    if (s.outline) { s.scene.remove(s.outline); disposeObject(s.outline); s.outline = null; }
    const selected = props.selectedPart ? s.model.getObjectByName(props.selectedPart) : null;
    if (selected && selected.visible) { s.outline = new THREE.BoxHelper(selected, props.night ? 0xc6daa1 : 0x708e52); s.scene.add(s.outline); }
    if (props.selectedPart && !selected) latest.current.onSelect(null);
  }, [props.hiddenParts, props.selectedPart, props.night, modelVersion]);

  useEffect(() => {
    const s = studio.current; if (!s) return;
    const y = s.framingTarget, ratio = s.frameRatio;
    const positions: Record<CameraView, number[]> = { Perspective: [3.6 * ratio, y + 2.05 * ratio, 6.6 * ratio], Front: [7 * ratio, y + 0.05, 0.01], Side: [0.01, y + 0.05, 7 * ratio], Top: [0, y + 8 * ratio, 0.001] };
    s.camera.position.fromArray(positions[props.view]); s.controls.target.set(0, y, 0); s.controls.update();
  }, [props.view, ready]);

  return <div ref={mount} className={`three-viewport ${props.tool === 'select' ? 'selection-mode' : ''}`}>
    {error && <div className="viewport-error"><Box size={35} strokeWidth={1.2} /><h3>A little help with the view</h3><p>{error}</p><button onClick={() => window.location.reload()}><RotateCcw size={14} /> Reload studio</button></div>}
  </div>;
});

export default Viewport;