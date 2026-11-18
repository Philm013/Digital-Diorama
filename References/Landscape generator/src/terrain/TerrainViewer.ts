/**
 * TerrainViewer — a self-contained three.js viewport for the terraformer.
 * Owns: terrain mesh + diorama skirt, animated water, sky dome, day/dusk/night
 * lighting, sculpt raycasting with a live brush cursor, and prop scattering.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TerrainField, BrushSettings } from './TerrainField';
import { PALETTE_BY_ID } from './presets';
import { clamp, lerp } from './noise';

export type SkyMode = 'day' | 'dusk' | 'night';

export interface ViewerStats {
  triangles: number;
  vertices: number;
  minH: number;
  maxH: number;
  fps: number;
}

export interface HoverInfo {
  x: number;
  z: number;
  h: number;
  slope: number;
}

export interface ViewerCallbacks {
  onStrokeStart?: () => void;
  onStrokeEnd?: () => void;
  onStats?: (s: ViewerStats) => void;
  onHover?: (info: HoverInfo | null) => void;
}

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

export class TerrainViewer {
  field: TerrainField;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  private container: HTMLElement;

  terrainMesh!: THREE.Mesh;
  private terrainGeo!: THREE.BufferGeometry;
  skirtMesh!: THREE.Mesh;
  private skirtGeo!: THREE.BufferGeometry;
  waterMesh!: THREE.Mesh;
  private waterBase!: Float32Array;
  waterVisible = true;
  autoRotate = false;

  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private fill!: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial;
  private stars!: THREE.Points;
  private grid!: THREE.GridHelper;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private cursor!: THREE.Group;
  private cursorRing!: THREE.Mesh;
  private trees: THREE.InstancedMesh[] = [];
  private rocks!: THREE.InstancedMesh;
  private treeGeos: THREE.BufferGeometry[] = [];
  private treeMats: THREE.MeshStandardMaterial[] = [];
  private rockGeo!: THREE.BufferGeometry;
  private rockMat!: THREE.MeshStandardMaterial;
  private scatterGroup = new THREE.Group();
  private cb: ViewerCallbacks;

  private sculpting = false;
  private lastHit: THREE.Vector3 | null = null;
  private pending: BrushSettings | null = null;
  private dirtySkirt = true;
  private clock = new THREE.Clock();
  private frameCount = 0;
  private fpsTime = 0;
  private raf = 0;
  private ro: ResizeObserver;
  private disposed = false;
  private stats: ViewerStats = { triangles: 0, vertices: 0, minH: 0, maxH: 1, fps: 0 };
  private onStats?: (s: ViewerStats) => void;

  constructor(container: HTMLElement, field: TerrainField, cb: ViewerCallbacks = {}) {
    this.container = container;
    this.field = field;
    this.onStats = cb.onStats;
    this.cb = cb;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';

    this.camera = new THREE.PerspectiveCamera(52, this.aspect, 0.5, 6000);
    this.camera.position.set(field.size * 0.75, field.size * 0.55, field.size * 0.85);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.target.set(0, field.amplitude * 0.15, 0);
    this.controls.minDistance = field.size * 0.08;
    this.controls.maxDistance = field.size * 4;
    // left-drag sculpts, so make right-drag orbit too
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color('#4f9fe0') },
        horizonColor: { value: new THREE.Color('#cfe6f7') },
        groundColor: { value: new THREE.Color('#8a9aa8') },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.skyMat);
    sky.scale.setScalar(field.size * 6);
    sky.frustumCulled = false;
    this.scene.add(sky);

    this.scene.fog = new THREE.Fog('#cfe6f7', field.size * 0.9, field.size * 4.2);

    this.hemi = new THREE.HemisphereLight('#cfe6f7', '#4a5a3a', 1.1);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight('#fff4e2', 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.fill = new THREE.DirectionalLight('#9dc4ff', 0.35);
    this.fill.position.set(-1, 0.6, -1);
    this.scene.add(this.fill);

    // starfield (night only)
    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(field.size * 5);
      v.y = Math.abs(v.y) * 0.9 + 20;
      sp[i * 3] = v.x;
      sp[i * 3 + 1] = v.y;
      sp[i * 3 + 2] = v.z;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0.9 }));
    this.stars.visible = false;
    this.scene.add(this.stars);

    this.grid = new THREE.GridHelper(field.size * 2, 40, 0x7fa8c9, 0x47637a);
    (this.grid.material as THREE.Material).transparent = true;
    (this.grid.material as THREE.Material).opacity = 0.22;
    this.grid.position.y = -field.amplitude * 0.5;
    this.scene.add(this.grid);

    this.buildTerrain();
    this.buildSkirt();
    this.buildWater();
    this.buildCursor();
    this.scene.add(this.scatterGroup);
    this.buildScatterMeshes();

    this.setSky('day');
    this.applyPalette();

    // events
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointerleave', this.onPointerLeave);
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);

    this.loop();
  }

  /* ------------------------------ geometry ------------------------------ */

  private get aspect() {
    return Math.max(0.1, (this.container.clientWidth || 800) / (this.container.clientHeight || 600));
  }

  buildTerrain() {
    const f = this.field;
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainGeo.dispose();
    }
    const geo = new THREE.PlaneGeometry(f.size, f.size, f.n - 1, f.n - 1);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(f.n * f.n * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(f.n * f.n * 3), 3));
    // plane rows run +y downward; rotate so index (j*n+i) maps to world (x_i, z_j)
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.0,
      flatShading: false,
    });
    this.terrainGeo = geo;
    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.castShadow = true;
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.name = 'terrain';
    this.scene.add(this.terrainMesh);
    this.pushAll();
    this.updateStats();
  }

  private pushAll() {
    this.field.recomputeRange();
    this.field.recomputeShading();
    const f = this.field;
    const pos = this.terrainGeo.attributes.position as THREE.BufferAttribute;
    const nrm = this.terrainGeo.attributes.normal as THREE.BufferAttribute;
    const col = this.terrainGeo.attributes.color as THREE.BufferAttribute;
    for (let j = 0; j < f.n; j++) {
      for (let i = 0; i < f.n; i++) {
        const k = j * f.n + i;
        pos.setXYZ(k, f.worldX(i), f.heights[k], f.worldZ(j));
        nrm.setXYZ(k, f.normals[k * 3], f.normals[k * 3 + 1], f.normals[k * 3 + 2]);
        col.setXYZ(k, f.colors[k * 3], f.colors[k * 3 + 1], f.colors[k * 3 + 2]);
      }
    }
    pos.needsUpdate = true;
    nrm.needsUpdate = true;
    col.needsUpdate = true;
    this.terrainGeo.computeBoundingSphere();
    this.dirtySkirt = true;
  }

  /** Push the entire field to the GPU (after generation / import / resolution change). */
  syncAll() {
    this.pushAll();
    this.updateSkirt();
    this.updateStats();
  }

  /** Copy dirty rect data from the field into the GPU buffers. */
  private flushDirty() {
    const f = this.field;
    const rect = f.takeDirty();
    if (!rect) return;
    f.recomputeRange();
    f.recomputeShading(rect);
    const pos = this.terrainGeo.attributes.position as THREE.BufferAttribute;
    const nrm = this.terrainGeo.attributes.normal as THREE.BufferAttribute;
    const col = this.terrainGeo.attributes.color as THREE.BufferAttribute;
    for (let j = rect.j0; j <= rect.j1; j++) {
      for (let i = rect.i0; i <= rect.i1; i++) {
        const k = j * f.n + i;
        pos.setXYZ(k, f.worldX(i), f.heights[k], f.worldZ(j));
        nrm.setXYZ(k, f.normals[k * 3], f.normals[k * 3 + 1], f.normals[k * 3 + 2]);
        col.setXYZ(k, f.colors[k * 3], f.colors[k * 3 + 1], f.colors[k * 3 + 2]);
      }
    }
    pos.needsUpdate = true;
    nrm.needsUpdate = true;
    col.needsUpdate = true;
    this.terrainGeo.computeBoundingSphere();
    if (rect.i0 === 0 || rect.j0 === 0 || rect.i1 === f.n - 1 || rect.j1 === f.n - 1) this.dirtySkirt = true;
  }

  /* ------------------------------ skirt --------------------------------- */

  private baseY() {
    return Math.min(this.field.minH, this.field.waterLevel) - Math.max(3, this.field.size * 0.055);
  }

  private buildSkirt() {
    const n = this.field.n;
    const verts = 8 * n;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    const idx: number[] = [];
    // per side: vertices laid out as [t0,b0,t1,b1,...]
    for (let s = 0; s < 4; s++) {
      const off = s * 2 * n;
      for (let i = 0; i < n - 1; i++) {
        const a = off + i * 2;
        const b = off + i * 2 + 1;
        const c = off + i * 2 + 2;
        const d = off + i * 2 + 3;
        if (s === 0 || s === 3) {
          idx.push(a, b, c, c, b, d);
        } else {
          idx.push(a, c, b, c, d, b);
        }
      }
    }
    geo.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
    this.skirtGeo = geo;
    this.skirtMesh = new THREE.Mesh(geo, mat);
    this.skirtMesh.castShadow = true;
    this.skirtMesh.receiveShadow = true;
    this.skirtMesh.name = 'skirt';
    this.scene.add(this.skirtMesh);
    this.updateSkirt();
  }

  private updateSkirt() {
    const f = this.field;
    const pos = this.skirtGeo.attributes.position as THREE.BufferAttribute;
    const col = this.skirtGeo.attributes.color as THREE.BufferAttribute;
    const base = this.baseY();
    const half = f.size / 2;
    const pal = PALETTE_BY_ID[f.paletteId] ?? PALETTE_BY_ID.temperate;
    const top = new THREE.Color(pal.rock);
    const bottom = top.clone().multiplyScalar(0.35);
    const write = (v: number, x: number, y: number, z: number, t: number) => {
      pos.setXYZ(v, x, y, z);
      const c = bottom.clone().lerp(top, t);
      col.setXYZ(v, c.r, c.g, c.b);
    };
    for (let i = 0; i < f.n; i++) {
      const x = f.worldX(i);
      const z = f.worldZ(i);
      // north (z = -half) j = 0
      write(0 + i * 2, x, f.at(i, 0), -half, 1);
      write(0 + i * 2 + 1, x, base, -half, 0);
      // east (x = +half) i = n-1
      write(2 * f.n + i * 2, half, f.at(f.n - 1, i), z, 1);
      write(2 * f.n + i * 2 + 1, half, base, z, 0);
      // south (z = +half) j = n-1
      write(4 * f.n + i * 2, x, f.at(i, f.n - 1), half, 1);
      write(4 * f.n + i * 2 + 1, x, base, half, 0);
      // west (x = -half) i = 0
      write(6 * f.n + i * 2, -half, f.at(0, i), z, 1);
      write(6 * f.n + i * 2 + 1, -half, base, z, 0);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.skirtGeo.computeVertexNormals();
    this.skirtGeo.computeBoundingSphere();
    this.dirtySkirt = false;
  }

  /* ------------------------------ water --------------------------------- */

  private buildWater() {
    const seg = 48;
    const geo = new THREE.PlaneGeometry(this.field.size * 1.06, this.field.size * 1.06, seg, seg);
    geo.rotateX(-Math.PI / 2);
    this.waterBase = Float32Array.from(geo.attributes.position.array as Float32Array);
    const mat = new THREE.MeshStandardMaterial({
      color: '#2b6f8f',
      transparent: true,
      opacity: 0.74,
      roughness: 0.12,
      metalness: 0.35,
    });
    this.waterMesh = new THREE.Mesh(geo, mat);
    this.waterMesh.receiveShadow = true;
    this.waterMesh.name = 'water';
    this.waterMesh.position.y = this.field.waterLevel;
    this.scene.add(this.waterMesh);
  }

  setWaterLevel(level: number) {
    this.field.waterLevel = level;
    this.waterMesh.position.y = level;
    this.field.markAllDirty();
    this.dirtySkirt = true;
  }

  setWaterVisible(v: boolean) {
    this.waterVisible = v;
    this.waterMesh.visible = v;
    this.field.waterTint = v;
  }

  setWaterColor(hex: string) {
    (this.waterMesh.material as THREE.MeshStandardMaterial).color.set(hex);
  }

  /* ------------------------------ cursor -------------------------------- */

  private buildCursor() {
    this.cursor = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.9, 1.0, 72);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false });
    this.cursorRing = new THREE.Mesh(ringGeo, ringMat);
    this.cursorRing.renderOrder = 999;
    const discGeo = new THREE.CircleGeometry(1, 64);
    const discMat = new THREE.MeshBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthTest: false });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.renderOrder = 998;
    this.cursor.add(this.cursorRing, disc);
    this.cursor.visible = false;
    this.scene.add(this.cursor);
  }

  setCursor(radius: number, color: string, visible: boolean) {
    this.cursor.scale.setScalar(Math.max(0.2, radius));
    (this.cursorRing.material as THREE.MeshBasicMaterial).color.set(color);
    if (!visible) this.cursor.visible = false;
  }

  /* ------------------------------ scatter ------------------------------- */

  /** Build (or rebuild) the shared geometries/materials used by the scatter. */
  private buildScatterMeshes() {
    this.disposeScatterProps();
    const f = this.field;
    const s = Math.max(0.5, f.size / 160);
    // A pine = trunk cylinder + two stacked cones; InstancedMesh needs one
    // instance per primitive, so we keep three parallel instanced meshes.
    const trunk = new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.5 * s, 6);
    trunk.translate(0, 0.75 * s, 0);
    const coneA = new THREE.ConeGeometry(1.05 * s, 2.4 * s, 7);
    coneA.translate(0, 2.1 * s, 0);
    const coneB = new THREE.ConeGeometry(0.78 * s, 1.9 * s, 7);
    coneB.translate(0, 3.2 * s, 0);
    const pal = PALETTE_BY_ID[f.paletteId] ?? PALETTE_BY_ID.temperate;
    const foliage = new THREE.Color(pal.stops[Math.floor(pal.stops.length * 0.45)].c).multiplyScalar(0.95);
    const wood = new THREE.Color('#5a4530');

    this.treeGeos = [trunk, coneA, coneB];
    this.treeMats = [
      new THREE.MeshStandardMaterial({ color: wood, roughness: 0.9, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: foliage, roughness: 0.85, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: foliage.clone().multiplyScalar(1.1), roughness: 0.85, flatShading: true }),
    ];
    this.rockGeo = new THREE.IcosahedronGeometry(0.55 * s, 0);
    this.rockMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pal.rock), roughness: 0.95, flatShading: true });

    this.trees = this.treeGeos.map((g, i) => this.makeInstances(g, this.treeMats[i], 32));
    this.rocks = this.makeInstances(this.rockGeo, this.rockMat, 32);
  }

  private makeInstances(geo: THREE.BufferGeometry, mat: THREE.Material, cap: number) {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(8, cap));
    im.count = 0;
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scatterGroup.add(im);
    return im;
  }

  /** Drop the instanced meshes + shared geo/materials. */
  private disposeScatterProps() {
    for (const m of this.trees) {
      this.scatterGroup.remove(m);
      m.dispose();
    }
    if (this.rocks) {
      this.scatterGroup.remove(this.rocks);
      this.rocks.dispose();
    }
    this.trees = [];
    this.treeGeos.forEach((g) => g.dispose());
    this.treeMats.forEach((mm) => mm.dispose());
    this.treeGeos = [];
    this.treeMats = [];
    if (this.rockGeo) this.rockGeo.dispose();
    if (this.rockMat) this.rockMat.dispose();
  }

  private ensureCapacity(treeCap: number, rockCap: number) {
    if (!this.trees.length) this.buildScatterMeshes();
    const grow = (im: THREE.InstancedMesh, geo: THREE.BufferGeometry, mat: THREE.Material, cap: number) => {
      if (im.instanceMatrix.count >= cap) return im;
      this.scatterGroup.remove(im);
      im.dispose();
      return this.makeInstances(geo, mat, cap);
    };
    this.trees = this.trees.map((im, i) => grow(im, this.treeGeos[i], this.treeMats[i], treeCap));
    this.rocks = grow(this.rocks, this.rockGeo, this.rockMat, rockCap);
  }

  /** Place trees + rocks using height/slope rules. */
  scatter(treeDensity = 0.5, rockDensity = 0.35) {
    const f = this.field;
    const maxTrees = Math.floor(2600 * treeDensity);
    const maxRocks = Math.floor(1400 * rockDensity);
    if (maxTrees + maxRocks <= 0) {
      this.trees.forEach((t) => (t.count = 0));
      if (this.rocks) this.rocks.count = 0;
      return;
    }
    this.ensureCapacity(Math.max(32, maxTrees), Math.max(32, maxRocks));

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const half = f.size / 2 - f.step * 2;
    let ti = 0;
    let ri = 0;
    let attempts = 0;
    const maxAttempts = (maxTrees + maxRocks) * 18 + 400;

    while ((ti < maxTrees || ri < maxRocks) && attempts < maxAttempts) {
      attempts++;
      const x = (Math.random() * 2 - 1) * half;
      const z = (Math.random() * 2 - 1) * half;
      const h = f.heightAt(x, z);
      if (h < f.waterLevel + 0.4) continue;
      if (h > f.waterLevel + f.amplitude * 0.78) continue;
      const gi = clamp(Math.round(f.gridX(x)), 0, f.n - 1);
      const gj = clamp(Math.round(f.gridZ(z)), 0, f.n - 1);
      const slope = f.slopes[gj * f.n + gi];
      const r = Math.random();
      if (ti < maxTrees && slope < 0.32 && r < 0.6) {
        const s = 0.7 + Math.random() * 0.8;
        q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
        scl.set(s, s * (0.85 + Math.random() * 0.4), s);
        pos.set(x, h - 0.1, z);
        m.compose(pos, q, scl);
        for (let c = 0; c < this.trees.length; c++) this.trees[c].setMatrixAt(ti, m);
        ti++;
      } else if (ri < maxRocks && slope < 0.85) {
        const s = 0.5 + Math.random() * 1.5;
        q.setFromEuler(new THREE.Euler(Math.random() * 0.6, Math.random() * 6.28, Math.random() * 0.6));
        scl.set(s, s * (0.5 + Math.random() * 0.5), s);
        pos.set(x, h - s * 0.12, z);
        m.compose(pos, q, scl);
        this.rocks.setMatrixAt(ri, m);
        ri++;
      }
    }
    for (const t of this.trees) {
      t.count = ti;
      t.instanceMatrix.needsUpdate = true;
    }
    this.rocks.count = ri;
    this.rocks.instanceMatrix.needsUpdate = true;
  }

  setScatterVisible(v: boolean) {
    this.scatterGroup.visible = v;
  }

  /* ------------------------------ appearance ---------------------------- */

  applyPalette() {
    const pal = PALETTE_BY_ID[this.field.paletteId] ?? PALETTE_BY_ID.temperate;
    this.setWaterColor(pal.water);
    this.field.markAllDirty();
    this.dirtySkirt = true;
    this.buildScatterMeshes();
  }

  setFlatShading(v: boolean) {
    const mat = this.terrainMesh.material as THREE.MeshStandardMaterial;
    mat.flatShading = v;
    mat.needsUpdate = true;
    if (v) this.terrainGeo.computeVertexNormals();
    else {
      this.field.recomputeShading();
      const nrm = this.terrainGeo.attributes.normal as THREE.BufferAttribute;
      const f = this.field;
      for (let k = 0; k < f.n * f.n; k++) nrm.setXYZ(k, f.normals[k * 3], f.normals[k * 3 + 1], f.normals[k * 3 + 2]);
      nrm.needsUpdate = true;
    }
  }

  setWireframe(v: boolean) {
    (this.terrainMesh.material as THREE.MeshStandardMaterial).wireframe = v;
    (this.skirtMesh.material as THREE.MeshStandardMaterial).wireframe = v;
  }

  setGridVisible(v: boolean) {
    this.grid.visible = v;
  }

  setSky(mode: SkyMode) {
    const u = this.skyMat.uniforms;
    if (mode === 'day') {
      u.topColor.value.set('#4f9fe0');
      u.horizonColor.value.set('#d8ecfa');
      u.groundColor.value.set('#93a5ae');
      if (this.scene.fog) (this.scene.fog as THREE.Fog).color.set('#d8ecfa');
      this.hemi.color.set('#cfe6f7');
      this.hemi.groundColor.set('#5b6b45');
      this.hemi.intensity = 1.1;
      this.sun.color.set('#fff4e2');
      this.sun.intensity = 2.1;
      this.sun.position.set(this.field.size * 0.7, this.field.size * 0.95, this.field.size * 0.5);
      this.fill.intensity = 0.35;
      this.stars.visible = false;
      this.renderer.toneMappingExposure = 1.05;
    } else if (mode === 'dusk') {
      u.topColor.value.set('#2a3f74');
      u.horizonColor.value.set('#f0a06a');
      u.groundColor.value.set('#5a3f3f');
      if (this.scene.fog) (this.scene.fog as THREE.Fog).color.set('#e8a97e');
      this.hemi.color.set('#ffb98a');
      this.hemi.groundColor.set('#3a2a30');
      this.hemi.intensity = 0.85;
      this.sun.color.set('#ffb070');
      this.sun.intensity = 2.4;
      this.sun.position.set(-this.field.size * 0.9, this.field.size * 0.22, this.field.size * 0.35);
      this.fill.intensity = 0.22;
      this.stars.visible = false;
      this.renderer.toneMappingExposure = 1.1;
    } else {
      u.topColor.value.set('#050a18');
      u.horizonColor.value.set('#16233d');
      u.groundColor.value.set('#0b1020');
      if (this.scene.fog) (this.scene.fog as THREE.Fog).color.set('#16233d');
      this.hemi.color.set('#3b5a8c');
      this.hemi.groundColor.set('#0a0f1a');
      this.hemi.intensity = 0.5;
      this.sun.color.set('#9fc0ff');
      this.sun.intensity = 0.85;
      this.sun.position.set(-this.field.size * 0.4, this.field.size * 0.9, -this.field.size * 0.5);
      this.fill.intensity = 0.18;
      this.stars.visible = true;
      this.renderer.toneMappingExposure = 1.25;
    }
    this.updateShadowFrustum();
  }

  private updateShadowFrustum() {
    const s = this.field.size;
    const cam = this.sun.shadow.camera;
    cam.left = -s * 0.8;
    cam.right = s * 0.8;
    cam.top = s * 0.8;
    cam.bottom = -s * 0.8;
    cam.near = 1;
    cam.far = s * 4;
    cam.updateProjectionMatrix();
  }

  /* ------------------------------ sculpting ----------------------------- */

  setBrush(brush: BrushSettings | null) {
    this.pending = brush;
    if (!brush) this.cursor.visible = false;
  }

  private ndc(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private pick(e: PointerEvent): THREE.Vector3 | null {
    this.ndc(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.terrainMesh, false);
    return hit.length ? hit[0].point : null;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || !this.pending) return;
    const hit = this.pick(e);
    if (!hit) return;
    this.sculpting = true;
    this.controls.enabled = false;
    this.cb.onStrokeStart?.();
    this.renderer.domElement.setPointerCapture?.(e.pointerId);
    this.lastHit = hit.clone();
    const b: BrushSettings = { ...this.pending };
    if (b.mode === 'flatten') b.target = this.field.heightAt(hit.x, hit.z);
    this.field.applyBrush(hit.x, hit.z, b, 1);
  };

  private onPointerMove = (e: PointerEvent) => {
    const hit = this.pick(e);
    if (hit) {
      this.cursor.visible = !!this.pending;
      this.cursor.position.copy(hit).add(new THREE.Vector3(0, 0.05, 0));
      // orient ring to the surface
      const gi = clamp(Math.round(this.field.gridX(hit.x)), 0, this.field.n - 1);
      const gj = clamp(Math.round(this.field.gridZ(hit.z)), 0, this.field.n - 1);
      const k = gj * this.field.n + gi;
      const n = new THREE.Vector3(this.field.normals[k * 3], this.field.normals[k * 3 + 1], this.field.normals[k * 3 + 2]);
      this.cursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      this.cb.onHover?.({
        x: hit.x,
        z: hit.z,
        h: this.field.heightAt(hit.x, hit.z),
        slope: this.field.slopes[k],
      });
    } else {
      this.cursor.visible = false;
      this.cb.onHover?.(null);
    }
    if (!this.sculpting || !this.pending || !hit) return;
    const b: BrushSettings = { ...this.pending };
    if (b.mode === 'flatten' && b.target === undefined) b.target = this.field.heightAt(hit.x, hit.z);
    if (this.lastHit) this.field.stroke(this.lastHit.x, this.lastHit.z, hit.x, hit.z, b);
    else this.field.applyBrush(hit.x, hit.z, b, 1);
    this.lastHit = hit.clone();
  };

  private onPointerUp = () => {
    if (!this.sculpting) return;
    this.sculpting = false;
    this.lastHit = null;
    this.controls.enabled = true;
    this.cb.onStrokeEnd?.();
  };

  private onPointerLeave = () => {
    this.cursor.visible = false;
  };

  /* ------------------------------ lifecycle ----------------------------- */

  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  frameCamera() {
    const s = this.field.size;
    this.camera.position.set(s * 0.78, s * 0.5, s * 0.92);
    this.controls.target.set(0, this.field.amplitude * 0.15, 0);
    this.controls.update();
  }

  /** Straight-down plan view — handy for landscape composition. */
  topView() {
    const s = this.field.size;
    this.camera.position.set(0, s * 1.15, 0.001);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /** Full rebuild after resolution / world-size change. */
  rebuild() {
    this.buildTerrain();
    this.scene.remove(this.skirtMesh);
    this.skirtGeo.dispose();
    this.buildSkirt();
    this.scene.remove(this.waterMesh);
    this.waterMesh.geometry.dispose();
    this.buildWater();
    this.waterMesh.visible = this.waterVisible;
    this.buildScatterMeshes();
    this.updateShadowFrustum();
    this.controls.minDistance = this.field.size * 0.08;
    this.controls.maxDistance = this.field.size * 4;
    this.frameCamera();
  }

  updateStats() {
    this.stats.triangles = this.field.triangleCount + (this.field.n - 1) * 8;
    this.stats.vertices = this.field.vertexCount + this.field.n * 8;
    this.onStats?.(this.stats);
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = this.clock.getDelta();
    const t = this.clock.elapsedTime;

    if (this.sculpting) this.flushDirty();
    else this.flushDirty();
    if (this.dirtySkirt) this.updateSkirt();

    // water ripple
    if (this.waterVisible) {
      const pos = this.waterMesh.geometry.attributes.position as THREE.BufferAttribute;
      const base = this.waterBase;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i];
        const z = base[i + 2];
        arr[i + 1] =
          Math.sin(x * 0.09 + t * 0.9) * 0.16 +
          Math.sin(z * 0.12 - t * 0.7) * 0.13 +
          Math.sin((x + z) * 0.05 + t * 1.3) * 0.1;
      }
      pos.needsUpdate = true;
    }

    this.controls.autoRotate = this.autoRotate;
    this.controls.update();

    // fps + stats
    this.frameCount++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.stats.fps = Math.round(this.frameCount / this.fpsTime);
      this.stats.minH = this.field.minH;
      this.stats.maxH = this.field.maxH;
      this.frameCount = 0;
      this.fpsTime = 0;
      this.onStats?.({ ...this.stats });
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
    if (el.parentElement) el.parentElement.removeChild(el);
  }
}

export const lerpColor = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, clamp(lerp(0, 1, t), 0, 1));
