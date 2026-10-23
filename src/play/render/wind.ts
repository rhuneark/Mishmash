// Wind: trees, bushes and grass sway a little, each in its own rhythm. The sway
// is done in the vertex shader, so it costs nothing per frame but one uniform.

import * as THREE from 'three';

/** Seconds, shared by every windy material (View advances it). */
export const WIND = { value: 0 };

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
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uWindTime;\nuniform float uWindStr;\nuniform float uWindFrom;',
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
  float windK = windH * windH * uWindStr;
  float windP = uWindTime * 1.6 + windAt.x * 0.21 + windAt.z * 0.17;
  transformed.x += (sin(windP) * 0.7 + sin(windP * 2.3 + 1.7) * 0.3) * windK;
  transformed.z += cos(windP * 0.8 + 0.6) * 0.45 * windK;`,
      );
  };
  return m;
}
