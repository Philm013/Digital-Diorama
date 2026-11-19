import * as THREE from 'three';
import { Terrain } from './Terrain';

const vert = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec3 p = position;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  wp.y += 0.025 * sin(wp.x * 0.9 + uTime * 1.3) + 0.018 * sin(wp.z * 1.3 - uTime * 1.1);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const frag = /* glsl */ `
uniform float uTime;
uniform sampler2D uDepth;
uniform float uDepthRange;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform float uRain;
uniform float uFoam;
uniform float uNight;
varying vec3 vWorld;
varying vec2 vUv;
#include <fog_pars_fragment>

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 p = vWorld.xz;
  float t = uTime;
  // analytic slope of a few travelling waves
  vec2 g = vec2(0.0);
  vec2 d1 = normalize(vec2(1.0, 0.35)); float f1 = 1.7; float a1 = 0.035;
  vec2 d2 = normalize(vec2(-0.6, 1.0)); float f2 = 2.9; float a2 = 0.022;
  vec2 d3 = normalize(vec2(0.2, -1.0)); float f3 = 5.3; float a3 = 0.012;
  vec2 d4 = normalize(vec2(-1.0, -0.4)); float f4 = 9.1; float a4 = 0.006;
  g += d1 * f1 * a1 * cos(dot(d1, p) * f1 + t * 1.6);
  g += d2 * f2 * a2 * cos(dot(d2, p) * f2 + t * 2.1);
  g += d3 * f3 * a3 * cos(dot(d3, p) * f3 + t * 2.9);
  g += d4 * f4 * a4 * cos(dot(d4, p) * f4 + t * 3.7);
  // rain rings
  if (uRain > 0.0) {
    vec2 cell = floor(p * 1.6);
    for (int i = 0; i < 4; i++) {
      vec2 c = cell + vec2(float(i - (i / 2) * 2), float(i / 2));
      float h = hash(c);
      float period = 0.9 + h * 0.8;
      float age = fract(t / period + h * 7.0);
      vec2 center = (c + vec2(hash(c + 3.1), hash(c + 7.7))) / 1.6;
      float r = length(p - center);
      float ring = sin((r - age * 0.6) * 40.0) * exp(-age * 3.0) * smoothstep(age * 0.6 + 0.05, age * 0.6 - 0.05, r);
      g += normalize(p - center + 1e-4) * ring * 0.35 * uRain;
    }
  }
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(cameraPosition - vWorld);
  float depth = texture2D(uDepth, vUv).r * uDepthRange;
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 base = mix(uShallow, uDeep, smoothstep(0.0, 2.2, depth));
  vec3 R = reflect(-V, N);
  vec3 refl = mix(uHorizon, uSky, clamp(R.y * 1.5, 0.0, 1.0));
  vec3 col = mix(base, refl, clamp(fres * 0.7, 0.0, 0.85));
  vec3 L = normalize(uSunDir);
  float spec = pow(max(dot(reflect(-L, N), V), 0.0), 160.0) * uSunIntensity;
  col += uSunColor * spec * 1.4;
  // shoreline foam
  float n = hash(floor(p * 9.0 + vec2(t * 0.7, 0.0)));
  float foam = smoothstep(0.07, 0.0, depth) * (0.35 + 0.35 * sin(t * 2.0 + depth * 60.0 + n * 6.0)) * uFoam;
  col = mix(col, vec3(0.86, 0.93, 0.93) * (1.0 - uNight * 0.7), clamp(foam, 0.0, 1.0) * 0.5);
  float alpha = clamp(0.5 + depth * 0.22 + fres * 0.45 + foam * 0.4, 0.42, 0.94);
  alpha *= smoothstep(0.0, 0.02, depth);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export class Water {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  constructor(private terrain: Terrain) {
    const segX = Math.max(8, Math.round(terrain.width / 1.2));
    const segZ = Math.max(8, Math.round(terrain.depth / 1.2));
    // inset slightly so the surface never pokes through the strata walls
    const geo = new THREE.PlaneGeometry(terrain.width - 0.01, terrain.depth - 0.01, segX, segZ).rotateX(-Math.PI / 2);
    // PlaneGeometry uv.v runs bottom→top in local Y, which became -Z; flip so v grows with +Z like the depth texture rows
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDepth: { value: terrain.depthTexture },
          uDepthRange: { value: Terrain.DEPTH_RANGE },
          uShallow: { value: new THREE.Color('#3f9c98') },
          uDeep: { value: new THREE.Color('#174a63') },
          uSky: { value: new THREE.Color('#7fb2e5') },
          uHorizon: { value: new THREE.Color('#d8ecf5') },
          uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.4) },
          uSunColor: { value: new THREE.Color('#fff4d6') },
          uSunIntensity: { value: 1 },
          uRain: { value: 0 },
          uFoam: { value: 1 },
          uNight: { value: 0 },
        },
      ]),
    });
    this.material.uniforms.uDepth.value = terrain.depthTexture;
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'water';
    this.mesh.renderOrder = 1;
    this.mesh.receiveShadow = false;
    this.sync();
  }
  sync() {
    const wl = this.terrain.waterLevel;
    this.mesh.visible = wl !== null && this.terrain.minHeight() < wl;
    if (wl !== null) this.mesh.position.y = wl;
  }
  setPalette(shallow: string, deep: string) {
    (this.material.uniforms.uShallow.value as THREE.Color).set(shallow);
    (this.material.uniforms.uDeep.value as THREE.Color).set(deep);
  }
  update(t: number) { this.material.uniforms.uTime.value = t; }
  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}
