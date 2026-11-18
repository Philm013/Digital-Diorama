import * as THREE from 'three';
import type { FrameStyle } from './types';
import { BACKDROPS, paintClouds, paintLand, type BackdropStyle } from './backdropPainter';
import type { SkyState } from './Sky';
import { rng } from './util';

const backVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const backFrag = /* glsl */ `
uniform sampler2D uLand;
uniform sampler2D uClouds;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uTint;
uniform float uNight;
uniform float uDusk;
uniform float uSunUp;
uniform float uOvercast;
uniform float uTime;
uniform float uHorizonV;
uniform float uAspect;
uniform float uUnderwater;
uniform vec2 uSun;
uniform vec2 uMoon;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  float v = uv.y;
  vec3 sky = mix(uHorizon, uTop, smoothstep(uHorizonV, 1.0, v));
  vec2 ds = (uv - uSun) * vec2(uAspect, 1.0);
  float rs = length(ds);
  vec2 dm = (uv - uMoon) * vec2(uAspect, 1.0);
  float rm = length(dm);
  if (uUnderwater < 0.5) {
    sky += uSunColor * (smoothstep(0.045, 0.038, rs) * 1.2 + exp(-rs * 9.0) * 0.45) * uSunUp * (1.0 - uOvercast * 0.8);
    float moon = smoothstep(0.03, 0.026, rm) * (1.0 - smoothstep(0.03, 0.02, length(dm - vec2(0.012, 0.006))) * 0.85);
    sky = mix(sky, vec3(0.93, 0.95, 1.0), moon * uNight);
    sky += vec3(0.6, 0.7, 1.0) * exp(-rm * 14.0) * 0.18 * uNight;
    if (uNight > 0.02) {
      vec2 sp = floor(uv * vec2(uAspect * 220.0, 220.0));
      float st = step(0.985, hash(sp)) * (0.55 + 0.45 * sin(uTime * 1.7 + hash(sp + 2.0) * 40.0));
      sky += vec3(st) * uNight * smoothstep(uHorizonV, uHorizonV + 0.2, v);
    }
  } else {
    // rippling light from the surface far above
    float w = sin(uv.x * 60.0 + uTime * 0.8) * sin(uv.x * 23.0 - uTime * 0.6);
    sky += vec3(0.08, 0.12, 0.12) * w * smoothstep(0.6, 1.0, v);
  }
  float lum = dot(sky, vec3(0.299, 0.587, 0.114));
  sky = mix(sky, vec3(lum * 0.85 + 0.05), uOvercast * 0.7);
  vec4 cl = texture2D(uClouds, uv + vec2(uTime * 0.0015, 0.0));
  vec3 cloudCol = mix(vec3(1.0), uHorizon * 1.1, 0.22 + uDusk * 0.4) * (1.0 - 0.8 * uNight) * (1.0 - uOvercast * 0.25);
  sky = mix(sky, cloudCol, cl.a * (0.9 + 0.1 * uOvercast));
  vec4 land = texture2D(uLand, uv);
  vec3 lc = land.rgb * uTint * mix(1.0, 0.16, uNight) * mix(vec3(1.0), vec3(1.15, 0.86, 0.7), uDusk * 0.6) * (1.0 - uOvercast * 0.25);
  vec3 col = mix(sky, lc, land.a);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/** Build a vertical strip following a U-shaped path (left side → back → right side). */
function uStripGeometry(xl: number, xr: number, zb: number, zf: number, radius: number, yb: number, yt: number, inset = 0) {
  const path: THREE.Vector2[] = [];
  const r = Math.min(radius, (xr - xl) / 2 - 0.01, (zf - zb) - 0.01);
  const L = xl + inset, Rr = xr - inset, B = zb + inset;
  const seg = 14;
  path.push(new THREE.Vector2(L, zf));
  path.push(new THREE.Vector2(L, B + r));
  for (let k = 1; k < seg; k++) { const a = Math.PI + (k / seg) * (Math.PI / 2); path.push(new THREE.Vector2(L + r + Math.cos(a) * r, B + r + Math.sin(a) * r)); }
  path.push(new THREE.Vector2(L + r, B));
  path.push(new THREE.Vector2(Rr - r, B));
  for (let k = 1; k < seg; k++) { const a = -Math.PI / 2 + (k / seg) * (Math.PI / 2); path.push(new THREE.Vector2(Rr - r + Math.cos(a) * r, B + r + Math.sin(a) * r)); }
  path.push(new THREE.Vector2(Rr, B + r));
  path.push(new THREE.Vector2(Rr, zf));
  // subdivide long straight runs so the strip deforms nicely
  const pts: THREE.Vector2[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / 2));
    for (let k = 1; k <= n; k++) pts.push(a.clone().lerp(b, k / n));
  }
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = lens[lens.length - 1];
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  pts.forEach((p, i) => {
    pos.push(p.x, yb, p.y, p.x, yt, p.y);
    uv.push(lens[i] / total, 0, lens[i] / total, 1);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geometry: g, length: total, path: pts };
}

function woodTexture(seed = 3, base = '#9a6a3f', dark = '#6e4626') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
  const R = rng(seed);
  for (let i = 0; i < 90; i++) {
    const y = R() * 512;
    ctx.strokeStyle = `rgba(${dark === '#6e4626' ? '80,48,24' : '30,20,12'},${0.08 + R() * 0.16})`;
    ctx.lineWidth = 1 + R() * 3;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3 + (R() - 0.5) * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const x = R() * 512, y = R() * 512;
    ctx.strokeStyle = 'rgba(70,40,20,0.25)';
    for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.ellipse(x, y, 4 * k, 1.6 * k, 0, 0, Math.PI * 2); ctx.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function kraftTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#c49a64'; ctx.fillRect(0, 0, 256, 64);
  // corrugated flutes seen on the cut edge
  ctx.fillStyle = '#a97f4e';
  for (let x = 0; x < 256; x += 8) { ctx.beginPath(); ctx.arc(x + 4, 32, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#d8b07a'; ctx.fillRect(0, 0, 256, 12); ctx.fillRect(0, 52, 256, 12);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function plaqueTexture(title: string, subtitle: string) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#e8cf8a'); g.addColorStop(0.5, '#c9a55a'); g.addColorStop(1, '#a8843f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#7d5f2a'; ctx.lineWidth = 10; ctx.strokeRect(10, 10, 1004, 236);
  ctx.fillStyle = '#3b2c12';
  ctx.textAlign = 'center';
  ctx.font = '700 84px Fredoka, Nunito, system-ui, sans-serif';
  ctx.fillText(title.slice(0, 26) || 'My Diorama', 512, 120, 960);
  ctx.font = '600 44px Nunito, system-ui, sans-serif';
  ctx.fillText(subtitle.slice(0, 48), 512, 195, 960);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export interface FrameBounds { minX: number; maxX: number; minZ: number; maxZ: number; bottomY: number; topY: number; groundY: number; backGroundY: number }

export class Frame {
  group = new THREE.Group();
  backdrop?: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  style: FrameStyle = 'shoebox';
  backdropStyle: BackdropStyle = BACKDROPS.meadow;
  table?: THREE.Mesh;
  plaque?: THREE.Mesh;
  private landTex: THREE.CanvasTexture;
  private cloudTex: THREE.CanvasTexture;
  private landCanvas = document.createElement('canvas');
  private cloudCanvas = document.createElement('canvas');
  private horizonV = 0.3;
  private aspect = 4;
  bounds!: FrameBounds;
  title = '';
  subtitle = '';
  floorY = 0;

  constructor(hiRes: boolean) {
    this.group.name = 'frame';
    const w = hiRes ? 4096 : 2048, h = hiRes ? 1024 : 512;
    this.landCanvas.width = w; this.landCanvas.height = h;
    this.cloudCanvas.width = w / 2; this.cloudCanvas.height = h / 2;
    this.landTex = new THREE.CanvasTexture(this.landCanvas);
    this.landTex.colorSpace = THREE.SRGBColorSpace;
    this.landTex.anisotropy = 4;
    this.cloudTex = new THREE.CanvasTexture(this.cloudCanvas);
    this.uniforms = {
      uLand: { value: this.landTex }, uClouds: { value: this.cloudTex },
      uTop: { value: new THREE.Color('#4f8ed6') }, uHorizon: { value: new THREE.Color('#cfe4f2') },
      uSunColor: { value: new THREE.Color('#fff1cf') }, uTint: { value: new THREE.Color('#ffffff') },
      uNight: { value: 0 }, uDusk: { value: 0 }, uSunUp: { value: 1 }, uOvercast: { value: 0 }, uTime: { value: 0 },
      uHorizonV: { value: 0.3 }, uAspect: { value: 4 }, uUnderwater: { value: 0 },
      uSun: { value: new THREE.Vector2(0.5, 0.8) }, uMoon: { value: new THREE.Vector2(0.3, 0.8) },
    };
  }

  build(style: FrameStyle, backdropId: string, b: FrameBounds, title: string, subtitle: string) {
    this.clear();
    this.style = style;
    this.bounds = b;
    this.title = title; this.subtitle = subtitle;
    this.backdropStyle = BACKDROPS[backdropId] ?? BACKDROPS.meadow;
    if (style === 'island' || style === 'open') return;
    const margin = style === 'museum' ? 1.2 : 1.0;
    const xl = b.minX - margin, xr = b.maxX + margin, zb = b.minZ - margin, zf = b.maxZ + (style === 'museum' ? 0.4 : 0.6);
    const yb = b.bottomY - (style === 'museum' ? 0 : 0.05);
    const yt = Math.max(b.topY, b.groundY + (xr - xl) * 0.36);
    const radius = style === 'museum' ? (xr - xl) * 0.22 : 0.7;
    const strip = uStripGeometry(xl, xr, zb, zf, radius, yb, yt);
    this.aspect = strip.length / (yt - yb);
    // horizon: a little above the back of the terrain
    this.horizonV = Math.min(0.62, Math.max(0.12, (b.backGroundY + 1.2 - yb) / (yt - yb)));
    this.uniforms.uHorizonV.value = this.horizonV;
    this.uniforms.uAspect.value = this.aspect;
    this.uniforms.uUnderwater.value = this.backdropStyle.underwater ? 1 : 0;
    this.repaint();
    // The strip winds left→back→right, so its triangles face into the box: from outside the
    // walls are back-face culled and simply vanish, which keeps every viewing angle unobstructed.
    const mat = new THREE.ShaderMaterial({ vertexShader: backVert, fragmentShader: backFrag, uniforms: this.uniforms, side: THREE.FrontSide });
    this.backdrop = new THREE.Mesh(strip.geometry, mat);
    this.backdrop.name = 'backdrop';
    this.group.add(this.backdrop);

    if (style === 'shoebox') {
      const kraft = kraftTexture();
      // cardboard rim along the top edge
      const rimMat = new THREE.MeshStandardMaterial({ color: '#c39a66', roughness: 0.95, side: THREE.DoubleSide });
      const rimPts = strip.path;
      const rim = new THREE.BufferGeometry();
      const rp: number[] = [], ri: number[] = [];
      const th = 0.28;
      rimPts.forEach((p, i) => {
        const prev = rimPts[Math.max(0, i - 1)], next = rimPts[Math.min(rimPts.length - 1, i + 1)];
        const tx = next.x - prev.x, tz = next.y - prev.y, l = Math.hypot(tx, tz) || 1;
        const nx = tz / l, nz = -tx / l; // outward normal for this winding
        rp.push(p.x, yt, p.y, p.x + nx * th, yt, p.y + nz * th);
        if (i > 0) { const a = (i - 1) * 2; ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      });
      rim.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
      rim.setIndex(ri);
      rim.computeVertexNormals();
      this.group.add(new THREE.Mesh(rim, rimMat));
      // cut front edges showing the corrugated flutes
      const edgeMat = new THREE.MeshStandardMaterial({ map: kraft, roughness: 1 });
      for (const x of [xl - th / 2, xr + th / 2]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(th, yt - yb, 0.04), edgeMat);
        e.position.set(x, (yt + yb) / 2, zf);
        this.group.add(e);
      }
      // box floor
      const floor = new THREE.Mesh(new THREE.BoxGeometry(xr - xl + th * 2, 0.12, zf - zb + th), new THREE.MeshStandardMaterial({ color: '#b98f5c', roughness: 1 }));
      floor.position.set((xl + xr) / 2, yb - 0.06, (zb + zf) / 2 - th / 2);
      floor.receiveShadow = true;
      this.group.add(floor);
      this.floorY = yb - 0.12;
      // paper name tag taped on the front edge of the floor
      this.plaque = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshStandardMaterial({ map: plaqueTexture(title, subtitle), roughness: 0.8 }));
      this.plaque.position.set(0, yb - 0.06, zf + 0.02);
      this.plaque.scale.setScalar(0.62);
      this.plaque.position.y = yb - 0.05;
      this.plaque.visible = false;
      this.group.add(this.plaque);
    } else {
      // museum: dark wooden plinth with a brass plaque
      const wood = woodTexture(5, '#5a3a22', '#2a180c');
      wood.repeat.set(3, 1);
      const pw = b.maxX - b.minX + 1.6, pd = b.maxZ - b.minZ + 1.6, ph = 1.6;
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, metalness: 0.05 }));
      plinth.position.set((b.minX + b.maxX) / 2, b.bottomY - ph / 2, (b.minZ + b.maxZ) / 2 + 0.2);
      plinth.receiveShadow = true; plinth.castShadow = true;
      this.group.add(plinth);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.3, 0.16, pd + 0.3), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.4 }));
      lip.position.set(plinth.position.x, b.bottomY - ph - 0.08, plinth.position.z);
      this.group.add(lip);
      this.floorY = b.bottomY - ph - 0.16;
      this.plaque = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshStandardMaterial({ map: plaqueTexture(title, subtitle), roughness: 0.35, metalness: 0.6 }));
      this.plaque.position.set(plinth.position.x, b.bottomY - ph / 2, plinth.position.z + pd / 2 + 0.01);
      this.plaque.scale.setScalar(Math.min(1, pw / 9));
      this.group.add(this.plaque);
      const capMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.5 });
      const cap = new THREE.Mesh(new THREE.BoxGeometry(xr - xl + 0.4, 0.3, 0.4), capMat);
      cap.position.set((xl + xr) / 2, yt + 0.15, zb - 0.1);
      this.group.add(cap);
    }
    // table
    const tableTex = woodTexture(11);
    tableTex.repeat.set(6, 6);
    this.table = new THREE.Mesh(new THREE.CircleGeometry(Math.max(xr - xl, zf - zb) * 1.6, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.75 }));
    this.table.position.y = this.floorY - 0.01;
    this.table.receiveShadow = true;
    this.table.name = 'table';
    this.group.add(this.table);
  }

  setTitle(title: string, subtitle: string) {
    this.title = title; this.subtitle = subtitle;
    if (this.plaque) {
      const m = this.plaque.material as THREE.MeshStandardMaterial;
      m.map?.dispose();
      m.map = plaqueTexture(title, subtitle);
      m.needsUpdate = true;
    }
  }

  repaint(seed = 7) {
    paintLand(this.landCanvas, this.backdropStyle, 1 - this.horizonV, seed);
    paintClouds(this.cloudCanvas, this.backdropStyle.clouds, 1 - this.horizonV, seed + 2);
    this.landTex.needsUpdate = true;
    this.cloudTex.needsUpdate = true;
  }

  setBackdrop(id: string) {
    this.backdropStyle = BACKDROPS[id] ?? BACKDROPS.meadow;
    this.uniforms.uUnderwater.value = this.backdropStyle.underwater ? 1 : 0;
    if (this.backdrop) this.repaint();
  }

  applySky(s: SkyState, overcast: number, t: number, underwaterColors?: { top: string; horizon: string }) {
    const u = this.uniforms;
    if (underwaterColors) {
      (u.uTop.value as THREE.Color).set(underwaterColors.top).multiplyScalar(1 - s.night * 0.75);
      (u.uHorizon.value as THREE.Color).set(underwaterColors.horizon).multiplyScalar(1 - s.night * 0.7);
    } else {
      (u.uTop.value as THREE.Color).copy(s.top);
      (u.uHorizon.value as THREE.Color).copy(s.horizon);
    }
    (u.uSunColor.value as THREE.Color).copy(s.sunColor);
    u.uNight.value = s.night;
    u.uDusk.value = s.dusk;
    u.uSunUp.value = s.sunUp;
    u.uOvercast.value = overcast;
    u.uTime.value = t;
    const hv = this.horizonV;
    const dayT = (s.hour - 6) / 12; // 0 sunrise .. 1 sunset
    const ang = dayT * Math.PI;
    (u.uSun.value as THREE.Vector2).set(0.82 - 0.64 * dayT, hv + (1 - hv) * 0.82 * Math.max(-0.2, Math.sin(ang)));
    const nt = ((s.hour + 6) % 24) / 12 - 1; // moon arc across the night
    (u.uMoon.value as THREE.Vector2).set(0.78 - 0.56 * (nt + 1) / 2, hv + (1 - hv) * (0.45 + 0.35 * Math.sin(((nt + 1) / 2) * Math.PI)));
  }

  clear() {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mat = m.material as THREE.Material & { map?: THREE.Texture };
          if (mat !== this.backdrop?.material) { mat.map?.dispose(); mat.dispose(); }
        }
      });
    }
    this.backdrop = undefined;
    this.table = undefined;
    this.plaque = undefined;
  }

  dispose() {
    this.clear();
    this.landTex.dispose();
    this.cloudTex.dispose();
  }
}
