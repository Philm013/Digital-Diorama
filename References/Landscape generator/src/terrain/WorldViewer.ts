/**
 * WorldViewer — viewport for the endless, chunk-streamed world.
 * Orbit + pan navigation, streaming LOD ring, skydome, water and a
 * travel system that can teleport to the nearest occurrence of any biome.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ChunkManager, CHUNK_M, LOD_VERTS } from './chunks';
import { WorldSampler } from './world';
import { BIOMES, BIOME_INDEX } from './biomes';
import { clamp } from './noise';

export type SkyMode = 'day' | 'dusk' | 'night';

const OCEAN_COLOR = '#2f82a6';

const SKY_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 groundColor;
  varying vec3 vWorld;
  void main() {
    float h = normalize(vWorld).y;
    float t = smoothstep(-0.08, 0.55, h);
    vec3 c = mix(horizonColor, topColor, t);
    c = mix(groundColor, c, smoothstep(-0.35, -0.02, h));
    gl_FragColor = vec4(c, 1.0);
  }
`;

export interface WorldStats {
  chunks: number;
  pending: number;
  generated: number;
  cached: number;
  saved: number;
  tris: number;
  fps: number;
  biome: string;
  x: number;
  z: number;
  elev: number;
}

export class WorldViewer {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  world: WorldSampler;
  chunks: ChunkManager;

  private container: HTMLElement;
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private fill!: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private stars!: THREE.Points;
  private water!: THREE.Mesh;
  private waterBase!: Float32Array;
  private clock = new THREE.Clock();
  private raf = 0;
  private ro: ResizeObserver;
  private disposed = false;
  private frames = 0;
  private fpsT = 0;
  private stats: WorldStats = { chunks: 0, pending: 0, generated: 0, cached: 0, saved: 0, tris: 0, fps: 60, biome: '—', x: 0, z: 0, elev: 0 };
  private onStats?: (s: WorldStats) => void;
  private lastFocus = new THREE.Vector2(1e9, 1e9);
  waterVisible = true;
  autoRotate = false;
  skyMode: SkyMode = 'day';
  private followTerrain = true;

  constructor(container: HTMLElement, world: WorldSampler, onStats?: (s: WorldStats) => void) {
    this.container = container;
    this.world = world;
    this.onStats = onStats;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    const view = 1400;
    this.camera = new THREE.PerspectiveCamera(56, this.aspect, 1, view * 4);
    this.camera.position.set(300, 260, 380);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 1600;
    this.controls.screenSpacePanning = false;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.target.set(0, 40, 0);

    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color('#4f9fe0') },
        horizonColor: { value: new THREE.Color('#d8ecfa') },
        groundColor: { value: new THREE.Color('#93a5ae') },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.skyMat);
    this.sky.scale.setScalar(view * 3);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    this.scene.fog = new THREE.Fog('#cfe2f2', 500, 1500);

    this.hemi = new THREE.HemisphereLight('#cfe6f7', '#4a5a3a', 1.15);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4e2', 2.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 1.2;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight('#9dc4ff', 0.35);
    this.fill.position.set(-1, 0.6, -1);
    this.scene.add(this.fill);

    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(1200 * 3);
    for (let i = 0; i < 1200; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(4000);
      v.y = Math.abs(v.y) * 0.9 + 40;
      sp[i * 3] = v.x;
      sp[i * 3 + 1] = v.y;
      sp[i * 3 + 2] = v.z;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.9 }));
    this.stars.visible = false;
    this.scene.add(this.stars);

    // ocean
    const wg = new THREE.PlaneGeometry(2600, 2600, 40, 40);
    wg.rotateX(-Math.PI / 2);
    this.waterBase = Float32Array.from(wg.attributes.position.array as Float32Array);
    const wmat = new THREE.MeshStandardMaterial({
      color: '#2b6f8f', transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.4,
    });
    this.water = new THREE.Mesh(wg, wmat);
    this.water.receiveShadow = false;
    this.water.renderOrder = 2;
    this.scene.add(this.water);

    this.chunks = new ChunkManager(world);
    this.chunks.setPrefix(world.cfg as unknown as Record<string, unknown>);
    this.scene.add(this.chunks.group);

    this.setSky('day');
    this.applyWaterColor();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.loop();
  }

  private get aspect() {
    return Math.max(0.1, (this.container.clientWidth || 800) / (this.container.clientHeight || 600));
  }

  /* ------------------------------ config ------------------------------ */

  /** World parameters changed: wipe the streaming cache and start over. */
  reconfigure(patch: Record<string, unknown>, hard: boolean) {
    this.world.set(patch as never);
    this.chunks.setPrefix(this.world.cfg as unknown as Record<string, unknown>);
    if (hard) this.chunks.clearAll();
    this.applyWaterColor();
    this.lastFocus.set(1e9, 1e9);
  }

  applyWaterColor() {
    (this.water.material as THREE.MeshStandardMaterial).color.set(OCEAN_COLOR);
    this.water.position.y = this.world.cfg.seaLevel;
    this.water.visible = this.waterVisible && this.world.cfg.water;
  }

  setWaterVisible(v: boolean) {
    this.waterVisible = v;
    this.water.visible = v && this.world.cfg.water;
  }

  setSky(mode: SkyMode) {
    this.skyMode = mode;
    const u = this.skyMat.uniforms;
    const fog = this.scene.fog as THREE.Fog;
    if (mode === 'day') {
      u.topColor.value.set('#4f9fe0');
      u.horizonColor.value.set('#d8ecfa');
      u.groundColor.value.set('#93a5ae');
      fog.color.set('#d8ecfa');
      this.hemi.color.set('#cfe6f7');
      this.hemi.groundColor.set('#5b6b45');
      this.hemi.intensity = 1.15;
      this.sun.color.set('#fff4e2');
      this.sun.intensity = 2.0;
      this.fill.intensity = 0.35;
      this.stars.visible = false;
      this.renderer.toneMappingExposure = 1.05;
    } else if (mode === 'dusk') {
      u.topColor.value.set('#2a3f74');
      u.horizonColor.value.set('#f0a06a');
      u.groundColor.value.set('#5a3f3f');
      fog.color.set('#e8a97e');
      this.hemi.color.set('#ffb98a');
      this.hemi.groundColor.set('#3a2a30');
      this.hemi.intensity = 0.85;
      this.sun.color.set('#ffb070');
      this.sun.intensity = 2.3;
      this.fill.intensity = 0.22;
      this.stars.visible = false;
      this.renderer.toneMappingExposure = 1.1;
    } else {
      u.topColor.value.set('#050a18');
      u.horizonColor.value.set('#16233d');
      u.groundColor.value.set('#0b1020');
      fog.color.set('#16233d');
      this.hemi.color.set('#3b5a8c');
      this.hemi.groundColor.set('#0a0f1a');
      this.hemi.intensity = 0.5;
      this.sun.color.set('#9fc0ff');
      this.sun.intensity = 0.9;
      this.fill.intensity = 0.18;
      this.stars.visible = true;
      this.renderer.toneMappingExposure = 1.25;
    }
  }

  /* ------------------------------ travel ------------------------------ */

  /** Teleport the rig to the nearest place where the biome dominates. */
  travelToBiome(biomeId: string) {
    const target = BIOME_INDEX[biomeId];
    if (target === undefined) return false;
    const startX = this.controls.target.x;
    const startZ = this.controls.target.z;
    const step = CHUNK_M * 1.5;
    for (let ring = 1; ring <= 45; ring++) {
      for (let a = 0; a < ring * 8; a++) {
        const ang = (a / (ring * 8)) * Math.PI * 2;
        const x = startX + Math.cos(ang) * ring * step;
        const z = startZ + Math.sin(ang) * ring * step;
        if (this.world.biomeAt(x, z) === biomeId) {
          this.teleport(x, z);
          return true;
        }
      }
    }
    return false;
  }

  teleport(x: number, z: number) {
    const h = this.world.heightAt(x, z);
    this.controls.target.set(x, h, z);
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    dir.y = 0;
    if (dir.lengthSq() < 1) dir.set(1, 0, 1);
    dir.normalize().multiplyScalar(Math.max(90, this.world.cfg.amplitude * 1.6));
    this.camera.position.set(x + dir.x, h + Math.max(60, this.world.cfg.amplitude * 0.9), z + dir.z);
    this.controls.update();
    this.lastFocus.set(1e9, 1e9);
  }

  frameReset() {
    const h = this.world.heightAt(0, 0);
    this.teleport(0, 0);
    void h;
  }

  setFollowTerrain(v: boolean) {
    this.followTerrain = v;
  }

  /** Force the streaming ring to be recomputed on the next frame. */
  refresh() {
    this.lastFocus.set(1e9, 1e9);
  }

  /* ------------------------------ loop -------------------------------- */

  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = this.clock.getDelta();
    const t = this.clock.elapsedTime;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.update();

    const tgt = this.controls.target;
    // stream around the view target (what the user is looking at)
    const fx = Math.round(tgt.x / CHUNK_M);
    const fz = Math.round(tgt.z / CHUNK_M);
    if (fx !== this.lastFocus.x || fz !== this.lastFocus.y) {
      this.lastFocus.set(fx, fz);
      this.chunks.update(tgt.x, tgt.z);
    } else if (this.chunks.stats.pending > 0) {
      this.chunks.update(tgt.x, tgt.z);
    }

    if (this.followTerrain) {
      // keep the orbit target glued to the ground so panning feels natural
      const gh = this.world.heightAt(tgt.x, tgt.z);
      const floor = Math.max(gh, this.world.cfg.seaLevel);
      if (Math.abs(tgt.y - floor) > 0.6) tgt.y += (floor - tgt.y) * Math.min(1, dt * 4);
      if (this.camera.position.y < floor + 4) this.camera.position.y = floor + 4;
    }

    // sky + water + sun follow the camera
    this.sky.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.stars.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.water.position.x = this.camera.position.x;
    this.water.position.z = this.camera.position.z;
    this.water.position.y = this.world.cfg.seaLevel;
    if (this.water.visible) {
      const pos = this.water.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const base = this.waterBase;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i] + this.camera.position.x;
        const z = base[i + 2] + this.camera.position.z;
        arr[i + 1] =
          Math.sin(x * 0.012 + t * 0.9) * 0.35 +
          Math.sin(z * 0.017 - t * 0.7) * 0.28 +
          Math.sin((x + z) * 0.007 + t * 1.3) * 0.2;
      }
      pos.needsUpdate = true;
    }

    const d = Math.max(60, this.camera.position.distanceTo(this.controls.target));
    this.sun.position.set(
      this.controls.target.x + d * 0.7,
      this.controls.target.y + d * 0.95,
      this.controls.target.z + d * 0.5
    );
    this.sun.target.position.copy(this.controls.target);
    const sc = this.sun.shadow.camera;
    const ext = clamp(d * 1.2, 120, 900);
    if (Math.abs(sc.right - ext) > 1) {
      sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
      sc.near = 1; sc.far = ext * 4;
      sc.updateProjectionMatrix();
    }

    this.frames++;
    this.fpsT += dt;
    if (this.fpsT > 0.5) {
      this.stats.fps = Math.round(this.frames / this.fpsT);
      this.frames = 0;
      this.fpsT = 0;
      const s = this.chunks.stats;
      this.stats.chunks = s.loaded;
      this.stats.pending = s.pending;
      this.stats.generated = s.generated;
      this.stats.cached = s.cached;
      this.stats.saved = s.saved;
      this.stats.tris = s.tris;
      this.stats.x = this.controls.target.x;
      this.stats.z = this.controls.target.z;
      this.stats.elev = this.world.heightAt(this.controls.target.x, this.controls.target.z);
      this.stats.biome = this.world.biomeAt(this.controls.target.x, this.controls.target.z);
      this.onStats?.({ ...this.stats });
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.chunks.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
  }
}

export const TOTAL_LOD_LEVELS = LOD_VERTS.length;
export const BIOME_LIST = BIOMES;
