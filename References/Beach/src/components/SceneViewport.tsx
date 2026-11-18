import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScene } from '../assets/scene.mjs';
import { getAsset, getPalette, type StudioSettings } from '../lib/catalog';
import { DioramaFallback } from './SpecimenArt';

export interface SceneStats {
  triangles: number;
  specimens: number;
  selectedTriangles: number;
  selectedMeshes: number;
  counts: Record<string, number>;
}

export interface ViewerHandle {
  reset: () => void;
  focus: (id: string) => void;
  view: (view: 'perspective' | 'top' | 'front') => void;
  zoom: (direction: number) => void;
  snapshot: () => string | null;
}

interface Props {
  settings: StudioSettings;
  isolated: boolean;
  wireframe: boolean;
  grid: boolean;
  autoRotate: boolean;
  animate: boolean;
  panMode: boolean;
  sunlight: number;
  selectedPart: string | null;
  onSelect: (id: string, part: string | null) => void;
  onStats: (stats: SceneStats) => void;
  onReady: () => void;
  onError: (message: string) => void;
}

interface Tween {
  start: number;
  duration: number;
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromZoom: number;
  toZoom: number;
}

interface World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  sun: THREE.DirectionalLight;
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  grid: THREE.GridHelper;
  content: THREE.Group | null;
  tween: Tween | null;
  rigs: { node: THREE.Object3D; axis: 'x' | 'y' | 'z'; base: number; amount: number; translation: boolean }[];
  aspect: number;
  active: boolean;
}

function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}

function transition(world: World, target: THREE.Vector3, position: THREE.Vector3, zoom: number, duration = 700) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  world.tween = { start: performance.now(), duration: reduced ? 1 : duration, fromPosition: world.camera.position.clone(), toPosition: position, fromTarget: world.controls.target.clone(), toTarget: target, fromZoom: world.camera.zoom, toZoom: zoom };
}

function resetWorld(world: World) {
  const zoom = world.aspect < 0.85 ? world.aspect / 0.85 : 1;
  transition(world, new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(6, 21, 28), zoom * 0.86);
}

function focusWorld(world: World, id: string) {
  const selected = world.content?.children.find(child => child.userData.assetId === id && child.userData.primary);
  if (!selected) return;
  world.content?.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(selected), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const fit = Math.max(size.y, size.z * 0.7, size.x / Math.max(world.aspect, 0.6)) * 2.3;
  const direction = new THREE.Vector3(0.7, 0.82, 1).normalize().multiplyScalar(24);
  transition(world, center, center.clone().add(direction), Math.min(8, 18 / Math.max(fit, 2.2)));
}

function applyVisibility(world: World, props: Props) {
  world.content?.children.forEach(child => {
    if (child.userData.assetId) child.visible = !props.settings.hiddenAssets.includes(child.userData.assetId) && (!props.isolated || (child.userData.assetId === props.settings.selectedId && child.userData.primary));
    if (child.name === 'shell-hash-sand') child.visible = !props.isolated;
  });
  world.controls.maxPolarAngle = props.isolated ? Math.PI - 0.001 : Math.PI * 0.485;
}

const SceneViewport = forwardRef<ViewerHandle, Props>(function SceneViewport(props, forwardedRef) {
  const mount = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const currentProps = useRef(props);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  currentProps.current = props;

  useImperativeHandle(forwardedRef, () => ({
    reset: () => { if (worldRef.current) resetWorld(worldRef.current); },
    focus: id => { if (worldRef.current) focusWorld(worldRef.current, id); },
    view: view => {
      const world = worldRef.current;
      if (!world) return;
      const target = world.controls.target.clone();
      const offset = view === 'top' ? new THREE.Vector3(0, 28, 0.001) : view === 'front' ? new THREE.Vector3(0, 5, 28) : new THREE.Vector3(4, 17, 23);
      transition(world, target, target.clone().add(offset), world.camera.zoom);
    },
    zoom: direction => {
      const world = worldRef.current;
      if (world) transition(world, world.controls.target.clone(), world.camera.position.clone(), THREE.MathUtils.clamp(world.camera.zoom * (direction > 0 ? 1.25 : 0.8), 0.45, 12), 250);
    },
    snapshot: () => {
      const world = worldRef.current;
      if (!world) return null;
      world.renderer.render(world.scene, world.camera);
      return world.renderer.domElement.toDataURL('image/png');
    },
  }), []);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    } catch (error) {
      console.error('Tideline WebGL initialization:', error);
      setFailed(true);
      currentProps.current.onError('WebGL is unavailable. Illustrations, parameters, and module exports are still available.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xede9df, 0);
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D coastal diorama. Drag to orbit, scroll to zoom, or click a specimen to select it.');
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35.5, 1, 0.1, 120);
    camera.position.set(4, 18, 24);
    camera.zoom = 0.94;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.7, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minZoom = 0.45;
    controls.maxZoom = 12;
    controls.minDistance = 3.5;
    controls.maxDistance = 58;
    controls.minPolarAngle = 0.001;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.autoRotateSpeed = 0.45;
    controls.update();

    scene.add(new THREE.HemisphereLight('#fffaec', '#a99c82', 2.4));
    const sun = new THREE.DirectionalLight('#fff1d6', 3.25);
    sun.position.set(-10, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 0.1, far: 65 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.022;
    sun.shadow.radius = 3;
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#e9f0eb', 0.85);
    fill.position.set(5, 8, -7);
    scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#ede9df', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.27;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(22, 44, '#8b9786', '#a6ab99');
    grid.position.y = 0.045;
    grid.visible = false;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.24;
    (grid.material as THREE.Material).depthWrite = false;
    scene.add(grid);

    const world: World = { renderer, scene, camera, controls, sun, floor, grid, content: null, tween: null, rigs: [], aspect: 1, active: true };
    worldRef.current = world;
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      world.active = width > 0 && height > 0;
      if (!world.active) return;
      const oldAspect = world.aspect;
      world.aspect = width / height;
      camera.aspect = world.aspect;
      if (!currentProps.current.isolated) camera.zoom *= Math.min(1, world.aspect / 0.85) / Math.min(1, oldAspect / 0.85);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    resetWorld(world);

    const down = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const pointerDown = (event: PointerEvent) => down.set(event.clientX, event.clientY);
    const pointerUp = (event: PointerEvent) => {
      if (down.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5 || !world.content || event.button !== 0) return;
      const rect = host.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const candidates: THREE.Object3D[] = [];
      world.content.children.forEach(child => { if (child.visible && child.userData.assetId) candidates.push(child); });
      const hits = raycaster.intersectObjects(candidates, true);
      const hit = hits.find(intersection => {
        let node: THREE.Object3D | null = intersection.object;
        while (node && node !== world.content) { if (!node.visible) return false; node = node.parent; }
        return true;
      });
      if (!hit) return;
      let node: THREE.Object3D | null = hit.object;
      const partName = hit.object.parent?.name || null;
      while (node && !node.userData.assetId) node = node.parent;
      if (node?.userData.assetId) {
        const asset = getAsset(node.userData.assetId);
        currentProps.current.onSelect(node.userData.assetId, partName && asset.module.detach.includes(partName) ? partName : null);
      }
    };
    const cancelTween = () => { world.tween = null; };
    controls.addEventListener('start', cancelTween);
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    const handleContextLoss = (event: Event) => {
      event.preventDefault();
      setFailed(true);
      currentProps.current.onError('The 3D context was interrupted. Reload to restore the live view; your saved settings will be kept.');
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLoss);
    let announcedReady = false;
    renderer.setAnimationLoop(time => {
      if (document.hidden || !world.active) return;
      if (world.tween) {
        const tween = world.tween;
        const t = Math.min(1, (time - tween.start) / tween.duration);
        const ease = 1 - (1 - Math.max(0, t)) ** 3;
        camera.position.lerpVectors(tween.fromPosition, tween.toPosition, ease);
        controls.target.lerpVectors(tween.fromTarget, tween.toTarget, ease);
        camera.zoom = THREE.MathUtils.lerp(tween.fromZoom, tween.toZoom, ease);
        camera.updateProjectionMatrix();
        if (t === 1) world.tween = null;
      }
      if (currentProps.current.animate) {
        world.rigs.forEach((item, i) => {
          const value = item.base + Math.sin(time * 0.0007 + i * 0.6) * item.amount;
          if (item.translation) item.node.position[item.axis] = value;
          else item.node.rotation[item.axis] = value;
        });
        renderer.shadowMap.needsUpdate = true;
      }
      controls.update();
      renderer.render(scene, camera);
      if (world.content && !announcedReady) {
        announcedReady = true;
        setReady(true);
        currentProps.current.onReady();
      }
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.removeEventListener('start', cancelTween);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLoss);
      disposeObject(scene);
      sun.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      worldRef.current = null;
    };
  }, []);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    try {
      if (world.content) { world.scene.remove(world.content); disposeObject(world.content); }
      world.content = createScene(world.scene, { ...props.settings, editable: true });
      const palette = getPalette(props.settings.colorway);
      world.floor.material.color.set(palette.background);
      applyVisibility(world, currentProps.current);
      world.rigs = [];
      let triangles = 0, selectedTriangles = 0, selectedMeshes = 0;
      world.content.traverseVisible(object => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) {
          const triangleCount = (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3 * ((mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1);
          triangles += triangleCount;
          let parent: THREE.Object3D | null = mesh;
          while (parent && !parent.userData.assetId) parent = parent.parent;
          if (parent?.userData.assetId === props.settings.selectedId && parent.userData.primary) { selectedTriangles += triangleCount; selectedMeshes++; }
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of materials) {
            const material = m as THREE.MeshStandardMaterial;
            material.wireframe = currentProps.current.wireframe;
            if (material.emissive) { material.emissive.set(props.settings.colorway === 'bioluminescent' && parent?.userData.assetId ? '#715c9c' : '#000000'); material.emissiveIntensity = 0.15; }
          }
        }
      });
      const primary = world.content.children.find(child => child.userData.assetId === props.settings.selectedId && child.userData.primary);
      if (primary) {
        const rig = getAsset(props.settings.selectedId).module.rig;
        Object.entries(rig).forEach(([name, item]) => {
          const node = primary.getObjectByName(name);
          if (!node) return;
          const axis = item.axis as 'x' | 'y' | 'z';
          const translation = item.describe.includes('meters');
          world.rigs.push({ node, axis, base: translation ? node.position[axis] : node.rotation[axis], amount: translation ? (item.range[1] - item.range[0]) * 0.22 : THREE.MathUtils.degToRad((item.range[1] - item.range[0]) * 0.075), translation });
        });
      }
      world.renderer.shadowMap.needsUpdate = true;
      const visibleSpecimens = world.content.children.filter(child => child.userData.assetId && child.visible).length;
      props.onStats({ triangles: Math.round(triangles), specimens: visibleSpecimens, selectedTriangles: Math.round(selectedTriangles), selectedMeshes, counts: world.content.userData.counts });
      setFailed(false);
    } catch (error) {
      console.error('Tideline geometry:', error);
      setFailed(true);
      props.onError('The scene could not be rebuilt. Reset the specimen parameters to try again.');
    }
  }, [props.settings]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    applyVisibility(world, currentProps.current);
    if (props.isolated) focusWorld(world, props.settings.selectedId);
    else resetWorld(world);
    world.renderer.shadowMap.needsUpdate = true;
    if (world.content) {
      let triangles = 0, selectedTriangles = 0, selectedMeshes = 0;
      world.content.traverseVisible(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const count = (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3 * ((mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1);
        triangles += count;
        let parent: THREE.Object3D | null = mesh;
        while (parent && !parent.userData.assetId) parent = parent.parent;
        if (parent?.userData.assetId === props.settings.selectedId && parent.userData.primary) { selectedTriangles += count; selectedMeshes++; }
      });
      props.onStats({ triangles: Math.round(triangles), specimens: world.content.children.filter(child => child.userData.assetId && child.visible).length, selectedTriangles: Math.round(selectedTriangles), selectedMeshes, counts: world.content.userData.counts });
    }
  }, [props.isolated, props.isolated ? props.settings.selectedId : null]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.controls.autoRotate = props.autoRotate;
    world.controls.mouseButtons.LEFT = props.panMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    world.grid.visible = props.grid;
    world.content?.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => { (material as THREE.MeshStandardMaterial).wireframe = props.wireframe; });
    });
    if (!props.animate) world.rigs.forEach(item => { if (item.translation) item.node.position[item.axis] = item.base; else item.node.rotation[item.axis] = item.base; });
    const elevation = 0.25 + props.sunlight / 100 * 0.9;
    world.sun.position.set(-15 * Math.cos(elevation), 16 * Math.sin(elevation), 7);
    world.sun.color.set(props.sunlight < 35 ? '#ffddb0' : '#fff1d8');
    world.renderer.shadowMap.needsUpdate = true;
  }, [props.autoRotate, props.panMode, props.grid, props.wireframe, props.sunlight, props.animate]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world?.content || !props.selectedPart) return;
    const primary = world.content.children.find(child => child.userData.assetId === props.settings.selectedId && child.userData.primary);
    const part = primary?.getObjectByName(props.selectedPart);
    const restored: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[]; temporary: THREE.Material }[] = [];
    part?.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const original = mesh.material;
      const highlighted = (original as THREE.MeshStandardMaterial).clone();
      highlighted.emissive?.set('#83956d');
      highlighted.emissiveIntensity = 0.18;
      mesh.material = highlighted;
      restored.push({ mesh, original, temporary: highlighted });
    });
    return () => restored.forEach(({ mesh, original, temporary }) => { mesh.material = original; temporary.dispose(); });
  }, [props.selectedPart, props.settings]);

  return <div className={`scene-viewport ${ready ? 'is-ready' : ''} ${props.panMode ? 'is-panning' : ''}`}>
    <div ref={mount} className="webgl-mount" style={{ display: failed ? 'none' : undefined }}/>
    {failed && <><DioramaFallback/><div className="fallback-notice">Illustrated preview <span>Live 3D requires WebGL</span></div></>}
    {!ready && !failed && <div className="scene-loading"><span className="loading-orbit"/><span>Gathering the tide's treasures...</span></div>}
  </div>;
});

export default SceneViewport;