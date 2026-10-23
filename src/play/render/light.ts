// Light shared by the game and the title backdrop: filmic tone mapping and a sun
// (or moon) that casts soft shadows in a box that follows the survivor.

import * as THREE from 'three';

export const EXPOSURE = 1.2;

/** Tone mapping and the shadow map (only lights with castShadow draw into it). */
export function setupRenderer(r: THREE.WebGLRenderer, exposure = EXPOSURE): void {
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = exposure;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
}

const fit = (v: number) =>
  (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);

/**
 * A colour as the tone mapping would show it (the sky is a clear colour, which isn't tone
 * mapped, but the fog it fades into is): three's ACES filmic curve, in JS.
 */
export function toneMapped(c: THREE.Color, out: THREE.Color, exposure = EXPOSURE): THREE.Color {
  const k = exposure / 0.6;
  const r = c.r * k;
  const g = c.g * k;
  const b = c.b * k;
  const x = fit(0.59719 * r + 0.35458 * g + 0.04823 * b);
  const y = fit(0.076 * r + 0.90834 * g + 0.01566 * b);
  const z = fit(0.0284 * r + 0.13383 * g + 0.83777 * b);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return out.setRGB(
    clamp(1.60475 * x - 0.53108 * y - 0.07367 * z),
    clamp(-0.10208 * x + 1.10813 * y - 0.00605 * z),
    clamp(-0.00327 * x - 0.07276 * y + 1.07602 * z),
  );
}

/**
 * Who casts and who catches shadows: lit meshes do both unless `userData.shade` says
 * otherwise ('cast', 'receive' or 'none'); glowing and see-through ones don't cast.
 */
export function shadeAll(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || o.userData['shaded']) return;
    o.userData['shaded'] = true;
    const want = o.userData['shade'] as 'cast' | 'receive' | 'none' | undefined;
    if (want) {
      m.castShadow = want === 'cast';
      m.receiveShadow = want === 'receive';
      return;
    }
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material;
    const lit =
      mat instanceof THREE.MeshLambertMaterial ||
      mat instanceof THREE.MeshPhongMaterial ||
      mat instanceof THREE.MeshStandardMaterial;
    m.castShadow = lit && !mat.transparent;
    m.receiveShadow = lit;
  });
}

const right = new THREE.Vector3();
const upv = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const at = new THREE.Vector3();

/** A directional light whose shadow box (2 × `half` metres) follows a point. */
export class SunShadow {
  private size = 0;

  constructor(
    readonly light: THREE.DirectionalLight,
    private readonly half = 38,
  ) {
    const cam = light.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = 220;
    cam.updateProjectionMatrix();
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.05;
    light.shadow.radius = 2.5;
  }

  /** Shadow map size in pixels (0: no shadows). */
  setSize(size: number): void {
    if (size === this.size) return;
    this.size = size;
    this.light.castShadow = size > 0;
    if (size > 0) {
      this.light.shadow.mapSize.set(size, size);
      this.light.shadow.map?.dispose();
      this.light.shadow.map = null;
    }
  }

  /**
   * Shines from `dir` (towards the light, any length) onto (x, y, z). The box is snapped to
   * whole shadow-map texels, so shadow edges don't crawl while the camera moves.
   */
  follow(x: number, y: number, z: number, dir: THREE.Vector3): void {
    const d = dir.clone().normalize();
    right.crossVectors(UP, d).normalize();
    upv.crossVectors(d, right);
    const texel = (this.half * 2) / Math.max(256, this.size || 1024);
    at.set(x, y, z);
    const a = Math.round(at.dot(right) / texel) * texel;
    const b = Math.round(at.dot(upv) / texel) * texel;
    const c = at.dot(d);
    at.copy(right).multiplyScalar(a).addScaledVector(upv, b).addScaledVector(d, c);
    this.light.target.position.copy(at);
    this.light.position.copy(at).addScaledVector(d, 110);
    this.light.target.updateMatrixWorld();
  }
}
