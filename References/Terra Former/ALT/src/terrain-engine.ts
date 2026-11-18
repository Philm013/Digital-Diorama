import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScene } from './assets/scene.mjs';
import { night as nightMetadata } from './assets/terrain.mjs';
import { DEFAULT_BRUSH, DEFAULT_VIEW } from './studio';
import type { BrushSettings, ProjectState, SceneStats, Tool, ViewSettings } from './studio';

export class TerrainEngine {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 1400);
  readonly controls: OrbitControls;
  model: THREE.Group | null = null;
  private terrain: THREE.Group | null = null;
  private hemisphere = new THREE.HemisphereLight(0xffffff, 0x717b66, 1.2);
  private sunlight = new THREE.DirectionalLight(0xfff9e9, 1.5);
  private ambient = new THREE.AmbientLight(0xffffff, 0.5);
  private ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private grid: THREE.GridHelper;
  private brushRing: THREE.LineLoop;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private observer: ResizeObserver;
  private frameId = 0;
  private lastTime = 0;
  private lastStroke = 0;
  private dragging = false;
  private strokeChanged = false;
  private flattenHeight = 0;
  private size = 128;
  private tool: Tool = 'orbit';
  private brush: BrushSettings = DEFAULT_BRUSH;
  private view: ViewSettings = DEFAULT_VIEW;
  private stats: SceneStats = { triangles: 0, meshes: 0, trees: 0, rocks: 0, zoom: 100 };
  private disposed = false;
  private onStats: (stats: SceneStats) => void;
  private onSculpt: (heights: number[]) => void;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private host: HTMLDivElement, onStats: (stats: SceneStats) => void, onSculpt: (heights: number[]) => void) {
    this.onStats = onStats; this.onSculpt = onSculpt;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.25;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D terrain. Drag to orbit, scroll to zoom, or choose a sculpting tool.');
    this.renderer.domElement.setAttribute('role', 'img'); this.renderer.domElement.tabIndex = 0;
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#f0f2ef');
    this.scene.fog = new THREE.Fog('#f0f2ef', 310, 650);
    this.sunlight.position.set(-90, 150, 100); this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sunlight.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 1, far: 500 });
    this.sunlight.shadow.bias = -0.0003; this.sunlight.shadow.normalBias = 0.07; this.sunlight.shadow.radius = 3;
    this.scene.add(this.hemisphere, this.sunlight, this.ambient);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: '#e8ece5', roughness: 1, metalness: 0 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.position.y = -7.34; this.ground.receiveShadow = true; this.scene.add(this.ground);
    this.grid = new THREE.GridHelper(640, 64, '#bcc8b8', '#c9d1c5'); this.grid.position.y = -7.3;
    const gridMaterial = this.grid.material as THREE.Material; gridMaterial.transparent = true; gridMaterial.opacity = 0.27; gridMaterial.depthWrite = false;
    this.scene.add(this.grid);
    const ringGeometry = new THREE.BufferGeometry(); ringGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
    this.brushRing = new THREE.LineLoop(ringGeometry, new THREE.LineBasicMaterial({ color: '#f9ffea', depthTest: false, transparent: true, opacity: 0.95 }));
    this.brushRing.visible = false; this.brushRing.renderOrder = 100; this.brushRing.frustumCulled = false; this.scene.add(this.brushRing);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.075; this.controls.rotateSpeed = 0.7;
    this.controls.minPolarAngle = 0.01; this.controls.maxPolarAngle = Math.PI / 2.08;
    this.controls.minZoom = 0.45; this.controls.maxZoom = 4; this.controls.autoRotateSpeed = 0.45;
    this.controls.addEventListener('change', this.onControlsChange);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown, true);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointercancel', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointerleave', this.onPointerLeave);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    this.observer = new ResizeObserver(this.resize); this.observer.observe(host);
    this.fit(); this.resize(); this.animate(0);
  }

  setProject(project: ProjectState) {
    const newModel = createScene({ ...project.params, mergeForProduction: false }, project.heights);
    if (this.model) { this.scene.remove(this.model); this.disposeObject(this.model); }
    this.model = newModel;
    this.terrain = newModel.userData.terrain as THREE.Group;
    this.scene.add(newModel);
    const shadowExtent = project.params.size * 1.25;
    Object.assign(this.sunlight.shadow.camera, { left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent });
    this.sunlight.shadow.camera.updateProjectionMatrix();
    if (this.size !== project.params.size) { this.size = project.params.size; this.fit(); }
    this.applyView(); this.updateStats();
  }

  setTool(tool: Tool, brush: BrushSettings) {
    this.tool = tool; this.brush = brush;
    this.controls.enableRotate = tool === 'orbit'; this.controls.enablePan = tool === 'orbit';
    this.controls.autoRotate = this.view.autoRotate && tool === 'orbit';
    this.renderer.domElement.style.cursor = tool === 'orbit' ? 'grab' : 'crosshair';
    if (tool === 'orbit') this.brushRing.visible = false;
  }

  setView(view: ViewSettings) { this.view = view; this.applyView(); }

  private applyView() {
    this.grid.visible = this.view.grid; this.renderer.shadowMap.enabled = this.view.shadows;
    this.ground.material.needsUpdate = true;
    this.sunlight.castShadow = this.view.shadows; this.controls.autoRotate = this.view.autoRotate && this.tool === 'orbit';
    this.model?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;
        material.wireframe = this.view.wireframe;
        const isWater = object.name === 'water' || object.name.startsWith('water_part');
        if (isWater) { material.emissive.set(this.view.night ? nightMetadata.water.color : '#000000'); material.emissiveIntensity = this.view.night ? nightMetadata.water.intensity : 0; }
        material.needsUpdate = true;
      });
    });
  }

  private resize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight), aspect = width / height;
    const viewHeight = Math.max(this.size * 1.3, this.size * 1.79 / aspect);
    this.camera.left = -viewHeight * aspect / 2; this.camera.right = viewHeight * aspect / 2;
    this.camera.top = viewHeight / 2; this.camera.bottom = -viewHeight / 2; this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  fit = () => {
    this.controls.target.set(0, 5, 0);
    this.camera.position.set(this.size * 0.96, this.size * 1.05, this.size * 1.16);
    this.camera.zoom = 1; this.camera.updateProjectionMatrix(); this.controls.update(); this.resize();
  };

  setCameraView = (view: '3d' | 'top') => {
    if (view === '3d') this.fit();
    else { this.controls.target.set(0, 0, 0); this.camera.position.set(0, this.size * 2, 0.01); this.camera.zoom = 1.05; this.camera.updateProjectionMatrix(); this.controls.update(); }
  };

  zoom = (factor: number) => {
    this.camera.zoom = Math.min(4, Math.max(0.45, this.camera.zoom * factor)); this.camera.updateProjectionMatrix(); this.controls.update(); this.onControlsChange();
  };

  screenshot = () => { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png'); };

  soften = () => {
    if (!this.terrain) return;
    let heights: number[] = this.terrain.userData.getHeightData();
    const stride = Math.sqrt(heights.length);
    for (let pass = 0; pass < 3; pass++) {
      const next = [...heights];
      for (let z = 1; z < stride - 1; z++) for (let x = 1; x < stride - 1; x++) { const i = z * stride + x; next[i] = heights[i] * 0.55 + (heights[i - 1] + heights[i + 1] + heights[i - stride] + heights[i + stride]) * 0.1125; }
      heights = next;
    }
    this.terrain.userData.setHeightData(heights); this.model?.userData.reseatProps(); this.onSculpt(heights);
  };

  private hit(event: PointerEvent) {
    if (!this.terrain) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const surface = this.terrain.getObjectByName('terrain');
    return surface ? this.raycaster.intersectObject(surface, false)[0]?.point || null : null;
  }

  private updateRing(point: THREE.Vector3) {
    if (!this.terrain) return;
    const positions = this.brushRing.geometry.getAttribute('position') as THREE.BufferAttribute;
    const half = this.size / 2;
    for (let i = 0; i < 64; i++) {
      const angle = i / 64 * Math.PI * 2, x = Math.max(-half, Math.min(half, point.x + Math.cos(angle) * this.brush.size));
      const z = Math.max(-half, Math.min(half, point.z + Math.sin(angle) * this.brush.size));
      positions.setXYZ(i, x, this.terrain.userData.sampleHeight(x, z) + 0.28, z);
    }
    positions.needsUpdate = true; this.brushRing.visible = true;
  }

  private stroke(point: THREE.Vector3, shift: boolean) {
    if (!this.terrain) return;
    const mode = shift && this.tool === 'raise' ? 'lower' : this.tool;
    this.terrain.userData.sculpt(point.x, point.z, this.brush.size, this.brush.strength, mode, this.flattenHeight, this.brush.falloff);
    this.model?.userData.reseatProps(); this.strokeChanged = true; this.lastStroke = performance.now(); this.updateRing(point);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.tool === 'orbit' || event.button !== 0 || !event.isPrimary) return;
    const point = this.hit(event); if (!point) return;
    event.preventDefault(); event.stopImmediatePropagation();
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.dragging = true; this.strokeChanged = false; this.flattenHeight = point.y; this.stroke(point, event.shiftKey);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (this.tool === 'orbit') return;
    const point = this.hit(event); if (!point) { this.brushRing.visible = false; return; }
    this.updateRing(point);
    if (this.dragging && performance.now() - this.lastStroke > 40) this.stroke(point, event.shiftKey);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
    if (this.strokeChanged && this.terrain) { this.onSculpt(this.terrain.userData.getHeightData()); this.updateStats(); }
  };
  private onPointerLeave = () => { if (!this.dragging) this.brushRing.visible = false; };
  private onContextMenu = (event: Event) => event.preventDefault();
  private onControlsChange = () => {
    const zoom = Math.round(this.camera.zoom * 100);
    if (this.stats.zoom !== zoom) { this.stats = { ...this.stats, zoom }; this.onStats(this.stats); }
  };

  private updateStats() {
    let triangles = 0, meshes = 0;
    this.model?.traverseVisible((object) => { if (object instanceof THREE.Mesh) { triangles += (object.geometry.index ? object.geometry.index.count : object.geometry.attributes.position.count) / 3; meshes++; } });
    this.stats = { triangles, meshes, trees: this.model?.getObjectByName('vegetation')?.children.length || 0, rocks: this.model?.getObjectByName('rocks')?.children.length || 0, zoom: Math.round(this.camera.zoom * 100) };
    this.onStats(this.stats);
  }

  private animate = (time: number) => {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this.animate);
    if (document.hidden) return;
    const delta = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.1) : 0.016; this.lastTime = time;
    const ease = this.reducedMotion ? 1 : 1 - Math.exp(-delta * 7);
    const targetBackground = new THREE.Color(this.view.night ? '#253334' : '#f0f2ef');
    (this.scene.background as THREE.Color).lerp(targetBackground, ease);
    (this.scene.fog as THREE.Fog).color.copy(this.scene.background as THREE.Color);
    this.ground.material.color.lerp(new THREE.Color(this.view.night ? '#263431' : '#e8ece5'), ease);
    this.hemisphere.intensity = THREE.MathUtils.lerp(this.hemisphere.intensity, this.view.night ? 0.72 : 1.2, ease);
    this.sunlight.intensity = THREE.MathUtils.lerp(this.sunlight.intensity, this.view.night ? 0.38 : 1.5, ease);
    this.sunlight.color.lerp(new THREE.Color(this.view.night ? '#b4d4ef' : '#fff9e9'), ease);
    this.ambient.intensity = THREE.MathUtils.lerp(this.ambient.intensity, this.view.night ? 0.18 : 0.5, ease);
    this.controls.update(delta); this.renderer.render(this.scene, this.camera);
  };

  private disposeObject(root: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; cancelAnimationFrame(this.frameId); this.observer.disconnect();
    this.controls.removeEventListener('change', this.onControlsChange); this.controls.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown, true); canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp); canvas.removeEventListener('pointercancel', this.onPointerUp);
    canvas.removeEventListener('pointerleave', this.onPointerLeave); canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.disposeObject(this.scene); this.sunlight.shadow.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); canvas.remove();
  }
}