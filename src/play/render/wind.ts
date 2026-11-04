// Wind: trees, bushes and grass sway a little, each in its own rhythm. The sway
// is done in the vertex shader, so it costs nothing per frame but one uniform.

import * as THREE from 'three';
import { groundTexture } from './groundTex';

/** Seconds, shared by every windy material (View advances it). */
export const WIND = { value: 0 };
/** How hard it blows: sway × this (1 on a calm day, more in storm gusts). */
export const GUST = { value: 1 };
/**
 * Cloud shadows drifting over the island: x, z = how far they've drifted (m), z = how much
 * of the ground they cover (0..1), w = how dark they are (0 = none).
 */
export const CLOUDS = { value: new THREE.Vector4(0, 0, 0.3, 0) };

/** GLSL: the cloud shadow over a point (1 = in the sun); needs uGround and uClouds. */
export const CLOUD_SHADE = `
float cloudShade(vec2 p) {
  float n = texture2D(uGround, (p + uClouds.xy) * 0.0035, 5.0).r;
  return 1.0 - uClouds.w * (1.0 - smoothstep(uClouds.z - 0.07, uClouds.z + 0.07, n));
}`;

/**
 * A copy of `base` whose vertices sway with height above `base` (model units).
 * Works on instanced and plain meshes (the sway phase comes from where it stands).
 */
export function windy<T extends THREE.Material>(base: T, strength: number, from = 0.4): T {
  const m = base.clone() as T;
  m.onBeforeCompile = (shader) => {
    shader.uniforms['uWindTime'] = WIND;
    shader.uniforms['uWindStr'] = { value: strength };
    shader.uniforms['uWindFrom'] = { value: from };
    shader.uniforms['uGust'] = GUST;
    shader.uniforms['uClouds'] = CLOUDS;
    shader.uniforms['uGround'] = { value: groundTexture() };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform sampler2D uGround;\nuniform vec4 uClouds;\nvarying vec2 vCloudAt;${CLOUD_SHADE}`,
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n  diffuseColor.rgb *= cloudShade(vCloudAt);',
      );
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uWindTime;\nuniform float uWindStr;\nuniform float uWindFrom;\nuniform float uGust;\nvarying vec2 vCloudAt;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 windAt = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
#else
  vec3 windAt = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]) + position;
#endif
  float windH = max(0.0, position.y - uWindFrom);
  float windK = windH * windH * uWindStr * uGust;
  vCloudAt = windAt.xz;
  float windP = uWindTime * 1.6 + windAt.x * 0.21 + windAt.z * 0.17;
  transformed.x += (sin(windP) * 0.7 + sin(windP * 2.3 + 1.7) * 0.3 + (uGust - 1.0) * 0.6) * windK;
  transformed.z += cos(windP * 0.8 + 0.6) * 0.45 * windK;`,
      );
  };
  return m;
}
