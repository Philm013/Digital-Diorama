import * as THREE from 'three';

/** Shared wind clock — every swaying material reads these uniforms. */
export const WIND = { uTime: { value: 0 }, uWind: { value: 0.35 } };

/**
 * Patch a material so its vertices sway with height (local y above the
 * asset's root). Safe on shared materials and materials that already have an
 * onBeforeCompile hook: the previous hook is chained and the cache key extended.
 */
export function applyWind(material: THREE.Material, height: number, strength = 1, instanced = false) {
  const ud = material.userData as { wind?: boolean };
  if (ud.wind) return;
  ud.wind = true;
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);
  const inv = 1 / Math.max(0.3, height);
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.uWindTime = WIND.uTime;
    shader.uniforms.uWind = WIND.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uWindTime;\nuniform float uWind;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  vec3 wp0 = ${instanced ? 'vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]) + ' : ''}vec3(modelMatrix[3][0], 0.0, modelMatrix[3][2]);
  float hh = max(transformed.y, 0.0) * ${inv.toFixed(5)};
  float k = hh * hh * uWind * ${(strength * Math.min(1.2, height * 0.06 + 0.15)).toFixed(4)};
  float ph = uWindTime * 1.4 + wp0.x * 0.21 + wp0.z * 0.17;
  transformed.x += (sin(ph) * 0.8 + sin(ph * 2.3 + transformed.y) * 0.2) * k;
  transformed.z += (cos(ph * 0.8 + 1.3) * 0.5) * k;
}`);
  };
  material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + `|wind${inv.toFixed(3)}${strength}${instanced}`;
  material.needsUpdate = true;
}
