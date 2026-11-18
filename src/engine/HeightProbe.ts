import * as THREE from 'three';

/**
 * Renders meshes from straight above into a packed RGBA8 target and reads the
 * highest surface per texel back as a height grid. Works on every WebGL device
 * (no float render targets needed).
 */
const vert = /* glsl */ `
varying float vY;
#include <common>
#include <skinning_pars_vertex>
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vY = wp.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const frag = /* glsl */ `
uniform float uMin; uniform float uRange;
varying float vY;
void main() {
  float h = clamp((vY - uMin) / uRange, 0.0, 0.99999);
  vec3 enc = fract(h * vec3(1.0, 255.0, 65025.0));
  enc -= enc.yzz * vec3(1.0 / 255.0, 1.0 / 255.0, 0.0);
  gl_FragColor = vec4(enc, 1.0);
}`;

export interface HeightGrid { minX: number; minZ: number; width: number; depth: number; res: number; data: Float32Array; valid: Uint8Array }

export function sampleGrid(g: HeightGrid, x: number, z: number): number | null {
  const fx = ((x - g.minX) / g.width) * (g.res - 1), fz = ((z - g.minZ) / g.depth) * (g.res - 1);
  if (fx < 0 || fz < 0 || fx > g.res - 1 || fz > g.res - 1) return null;
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const i1 = Math.min(g.res - 1, i + 1), j1 = Math.min(g.res - 1, j + 1);
  const idx = (a: number, b: number) => b * g.res + a;
  let sum = 0, wsum = 0;
  const taps: [number, number, number][] = [[i, j, (1 - u) * (1 - v)], [i1, j, u * (1 - v)], [i, j1, (1 - u) * v], [i1, j1, u * v]];
  for (const [a, b, w] of taps) { const k = idx(a, b); if (g.valid[k]) { sum += g.data[k] * w; wsum += w; } }
  return wsum > 0 ? sum / wsum : null;
}

export function probeHeights(renderer: THREE.WebGLRenderer, root: THREE.Object3D, filter: (m: THREE.Mesh) => boolean, res = 256): HeightGrid | null {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.visible && filter(m)) { meshes.push(m); box.expandByObject(m); }
  });
  if (!meshes.length || box.isEmpty()) return null;
  const minY = box.min.y - 0.5, range = Math.max(1, box.max.y - box.min.y + 1);
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { uMin: { value: minY }, uRange: { value: range } }, side: THREE.DoubleSide });
  const scene = new THREE.Scene();
  // render proxies that share geometry + world transforms (so the real objects stay where they are)
  for (const m of meshes) {
    const proxy = (m as THREE.SkinnedMesh).isSkinnedMesh ? null : new THREE.Mesh(m.geometry, mat);
    if (!proxy) continue;
    proxy.matrixAutoUpdate = false;
    proxy.matrix.copy(m.matrixWorld);
    proxy.matrixWorld.copy(m.matrixWorld);
    proxy.frustumCulled = false;
    scene.add(proxy);
  }
  const cam = new THREE.OrthographicCamera(box.min.x, box.max.x, -box.min.z, -box.max.z, 0.1, range + 10);
  // looking straight down: camera above, up vector -Z so +X right, image rows run along +Z
  cam.position.set(0, box.max.y + 2, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, box.min.y - 5, 0);
  cam.left = box.min.x; cam.right = box.max.x; cam.top = -box.min.z; cam.bottom = -box.max.z;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  const rt = new THREE.WebGLRenderTarget(res, res, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: true });
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  const prevShadow = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false;
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  const px = new Uint8Array(res * res * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, res, res, px);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  renderer.shadowMap.enabled = prevShadow;
  rt.dispose();
  mat.dispose();
  const data = new Float32Array(res * res), valid = new Uint8Array(res * res);
  // readPixels rows start at the bottom of the image (= camera "bottom" = +maxZ); flip so row j grows with +Z from minZ
  for (let row = 0; row < res; row++) {
    const j = res - 1 - row;
    for (let i = 0; i < res; i++) {
      const k = (row * res + i) * 4;
      if (px[k + 3] < 128) continue;
      const h = px[k] / 255 + px[k + 1] / 65025 + px[k + 2] / 16581375;
      data[j * res + i] = minY + h * range;
      valid[j * res + i] = 1;
    }
  }
  return { minX: box.min.x, minZ: box.min.z, width: box.max.x - box.min.x, depth: box.max.z - box.min.z, res, data, valid };
}
