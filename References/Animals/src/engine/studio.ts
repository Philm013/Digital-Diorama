import * as THREE from 'three';
import { createAsset, getSchema, getColorways } from './animal.mjs';
import type { Animal, AnimalOptions } from '../data/catalog';

export { getSchema, getColorways };

export interface PartInfo {
  name: string;
  label: string;
  zone: string;
  count: number;
  isGroup: boolean;
}

export interface ModelStats {
  triangles: number;
  materials: number;
  meshes: number;
  dimensions: number[];
  parts: PartInfo[];
}

export function makeAnimal(animal: Animal, options: AnimalOptions = {}) {
  return createAsset({ __animal: animal, ...options });
}

export function labelForPart(name: string) {
  return name.replace(/--1/g, '-right').replace(/-1(?=-|$)/g, '-left').replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export function modelStats(group: THREE.Group): ModelStats {
  const data = group.userData;
  const parts: PartInfo[] = [];
  group.children.forEach(container => {
    if (container instanceof THREE.Mesh) {
      parts.push({ name: container.name, label: labelForPart(container.name), zone: container.userData.zone, count: 1, isGroup: false });
    } else container.children.forEach(part => {
      let count = 0;
      part.traverse(child => { if (child instanceof THREE.Mesh) count++; });
      parts.push({ name: part.name, label: labelForPart(part.name), zone: part.userData.zone || 'mixed', count, isGroup: part instanceof THREE.Group });
    });
  });
  return { triangles: Math.round(data.triangles), materials: data.materialCount, meshes: data.partCount, dimensions: data.dimensions, parts };
}

export function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}

export function formatLength(value: number, short = false) {
  if (!Number.isFinite(value)) return '--';
  if (value < 0.001) return `${Math.round(value * 1e6)} ${short ? 'um' : 'micrometers'}`;
  if (value < 0.01) return `${Number((value * 1000).toFixed(2))} mm`;
  if (value < 1) return `${Number((value * 100).toFixed(1))} cm`;
  return `${Number(value.toFixed(2))} m`;
}

let thumbnailRenderer: THREE.WebGLRenderer | null = null;
const thumbnailCache = new Map<string, string>();
const thumbnailQueue: Array<() => void> = [];
let queueRunning = false;

function runThumbnailQueue() {
  const next = thumbnailQueue.shift();
  if (!next) { queueRunning = false; return; }
  queueRunning = true;
  requestAnimationFrame(() => { next(); runThumbnailQueue(); });
}

export function getThumbnail(animal: Animal, options: AnimalOptions = {}): Promise<string> {
  const key = animal.id + JSON.stringify(options);
  const cached = thumbnailCache.get(key);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    thumbnailQueue.push(() => {
      let model: THREE.Group | null = null;
      try {
        if (!thumbnailRenderer) {
          thumbnailRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
          thumbnailRenderer.setSize(256, 208);
          thumbnailRenderer.setPixelRatio(1);
          thumbnailRenderer.setClearColor(0x000000, 0);
          thumbnailRenderer.outputColorSpace = THREE.SRGBColorSpace;
          thumbnailRenderer.toneMapping = THREE.ACESFilmicToneMapping;
          thumbnailRenderer.toneMappingExposure = 1.3;
        }
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffffff, 0x858776, 2.6));
        const keyLight = new THREE.DirectionalLight(0xfff8e8, 3.2); keyLight.position.set(3, 5, 4); scene.add(keyLight);
        const fill = new THREE.DirectionalLight(0xdce9ef, 1.0); fill.position.set(-4, 2, -3); scene.add(fill);
        model = makeAnimal(animal, { ...options, mergeForProduction: true, detailLevel: 'Draft' });
        const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
        const wrapper = new THREE.Group(); wrapper.add(model); model.position.sub(center); wrapper.scale.setScalar(1.85 / Math.max(size.x, size.y, size.z)); scene.add(wrapper);
        const aspect = 256 / 208;
        const camera = new THREE.OrthographicCamera(-1.22 * aspect, 1.22 * aspect, 1.22, -1.22, 0.01, 50);
        const overhead = ['butterfly', 'starfish', 'placozoan', 'frog', 'crab'].includes(animal.bodyPlan);
        camera.position.set(overhead ? 0.8 : 2.6, overhead ? 5.2 : 2.2, 5.8); camera.lookAt(0, 0, 0);
        thumbnailRenderer.render(scene, camera);
        const url = thumbnailRenderer.domElement.toDataURL('image/png');
        thumbnailCache.set(key, url); resolve(url);
      } catch (error) { reject(error); }
      finally { if (model) disposeObject(model); }
    });
    if (!queueRunning) runThumbnailQueue();
  });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadDataUrl(url: string, name: string) {
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
}