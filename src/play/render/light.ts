// Light shared by the game and the title backdrop: filmic tone mapping and a sun
// (or moon) that casts soft shadows in a box that follows the survivor.

import * as THREE from 'three';

export const EXPOSURE = 1.2;

// Night grade: after the filmic curve, dark colours drift towards moonlit blue (purple on
// Bloom nights) while bright ones (fires, lanterns, glowing eyes) keep their colour. It
// rides in the exposure uniform every material already has, so it costs no extra pass:
// the whole part is the grade (0..40 night, +50 on a Bloom night), the fraction × 10 the
// exposure.
const GRADE_STEPS = 40;
const BLOOM_BIT = 50;
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
  'vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping( vec3 color ) {
	float gradeBits = floor( toneMappingExposure );
	float exposure = ( toneMappingExposure - gradeBits ) * 10.0;
	float bloomNight = step( ${BLOOM_BIT - 0.5}, gradeBits );
	float night = ( gradeBits - bloomNight * ${BLOOM_BIT.toFixed(1)} ) / ${GRADE_STEPS.toFixed(1)};
	const mat3 inM = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
	const mat3 outM = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
	color *= exposure / 0.6;
	color = outM * RRTAndODTFit( inM * color );
	color = saturate( color );
	float luma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
	vec3 moon = luma * mix( vec3( 0.7, 0.88, 1.32 ), vec3( 1.12, 0.7, 1.3 ), bloomNight ) + vec3( 0.0, 0.004, 0.012 );
	color = mix( color, moon, night * 0.78 * ( 1.0 - smoothstep( 0.18, 0.55, luma ) ) );
	return saturate( color );
}`,
);

/** The exposure uniform's value: exposure with the night grade packed in. */
export function packExposure(exposure: number, night = 0, bloom = false): number {
  const grade = Math.round(Math.min(1, Math.max(0, night)) * GRADE_STEPS) + (bloom ? BLOOM_BIT : 0);
  return grade + exposure / 10;
}

/** Tone mapping and the shadow map (only lights with castShadow draw into it). */
export function setupRenderer(r: THREE.WebGLRenderer, exposure = EXPOSURE): void {
  r.toneMapping = THREE.CustomToneMapping;
  r.toneMappingExposure = packExposure(exposure);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
}

const fit = (v: number) =>
  (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);

/**
 * A colour as the tone mapping would show it (the sky is a clear colour, which isn't tone
 * mapped, but the fog it fades into is): three's ACES filmic curve, in JS.
 */
export function toneMapped(
  c: THREE.Color,
  out: THREE.Color,
  exposure = EXPOSURE,
  night = 0,
  bloom = false,
): THREE.Color {
  const k = exposure / 0.6;
  const r = c.r * k;
  const g = c.g * k;
  const b = c.b * k;
  const x = fit(0.59719 * r + 0.35458 * g + 0.04823 * b);
  const y = fit(0.076 * r + 0.90834 * g + 0.01566 * b);
  const z = fit(0.0284 * r + 0.13383 * g + 0.83777 * b);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const or = clamp(1.60475 * x - 0.53108 * y - 0.07367 * z);
  const og = clamp(-0.10208 * x + 1.10813 * y - 0.00605 * z);
  const ob = clamp(-0.00327 * x - 0.07276 * y + 1.07602 * z);
  // The same night grade as the shader (packExposure rounds it the same way).
  const n = Math.round(Math.min(1, Math.max(0, night)) * GRADE_STEPS) / GRADE_STEPS;
  const luma = 0.2126 * or + 0.7152 * og + 0.0722 * ob;
  const t = Math.min(1, Math.max(0, (luma - 0.18) / 0.37));
  const amt = n * 0.78 * (1 - t * t * (3 - 2 * t));
  const tint = bloom ? [1.12, 0.7, 1.3] : [0.7, 0.88, 1.32];
  const lift = [0, 0.004, 0.012];
  const grade = (v: number, i: number) =>
    clamp(v + (luma * (tint[i] as number) + (lift[i] as number) - v) * amt);
  return out.setRGB(grade(or, 0), grade(og, 1), grade(ob, 2));
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
const ray = new THREE.Ray();
const hit = new THREE.Vector3();
const CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/**
 * A directional light whose shadow box (2 × `half` metres) follows a point, or fits round
 * what a camera sees (`fit`).
 */
export class SunShadow {
  private size = 0;
  /** The fitted box's half width and height (light space), whole metres. */
  private halfA = 0;
  private halfB = 0;

  constructor(
    readonly light: THREE.DirectionalLight,
    private readonly half = 38,
    radius = 2.5,
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
    light.shadow.radius = radius;
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

  /**
   * Fits the box round what `camera` sees, from the ground (`ground`) up to `top` metres
   * above it, so the whole shadow map lands on screen: about a fifth of the old fixed box in
   * a phone held upright, so shadows come out several times sharper. Its size moves in whole
   * metres (and only shrinks for a clear change) and it's snapped to texels, so edges don't
   * crawl or pop while the camera moves.
   */
  fit(camera: THREE.Camera, ground: number, top: number, dir: THREE.Vector3): void {
    const d = tmpDir.copy(dir).normalize();
    right.crossVectors(UP, d).normalize();
    upv.crossVectors(d, right);
    camera.updateMatrixWorld();
    let minA = Infinity;
    let maxA = -Infinity;
    let minB = Infinity;
    let maxB = -Infinity;
    let sumC = 0;
    let n = 0;
    for (const [sx, sy] of CORNERS) {
      ray.origin.setFromMatrixPosition(camera.matrixWorld);
      ray.direction.set(sx, sy, 0.5).unproject(camera).sub(ray.origin).normalize();
      for (const h of [ground, ground + top]) {
        const dy = ray.direction.y;
        const t = dy < -0.05 ? Math.max(0, (h - ray.origin.y) / dy) : FIT_FAR;
        hit.copy(ray.origin).addScaledVector(ray.direction, Math.min(t, FIT_FAR));
        const a = hit.dot(right);
        const b = hit.dot(upv);
        minA = Math.min(minA, a);
        maxA = Math.max(maxA, a);
        minB = Math.min(minB, b);
        maxB = Math.max(maxB, b);
        sumC += hit.dot(d);
        n++;
      }
    }
    const want = (span: number) =>
      Math.min(FIT_MAX, Math.max(FIT_MIN, Math.ceil(span / 2 + FIT_MARGIN)));
    const ha = want(maxA - minA);
    const hb = want(maxB - minB);
    let changed = false;
    if (ha > this.halfA || ha < this.halfA - 3) {
      this.halfA = ha;
      changed = true;
    }
    if (hb > this.halfB || hb < this.halfB - 3) {
      this.halfB = hb;
      changed = true;
    }
    const cam = this.light.shadow.camera;
    if (changed) {
      cam.left = -this.halfA;
      cam.right = this.halfA;
      cam.top = this.halfB;
      cam.bottom = -this.halfB;
      cam.updateProjectionMatrix();
    }
    const size = Math.max(256, this.size || 1024);
    const ta = (this.halfA * 2) / size;
    const tb = (this.halfB * 2) / size;
    const a = Math.round((minA + maxA) / 2 / ta) * ta;
    const b = Math.round((minB + maxB) / 2 / tb) * tb;
    at.copy(right)
      .multiplyScalar(a)
      .addScaledVector(upv, b)
      .addScaledVector(d, sumC / n);
    this.light.target.position.copy(at);
    this.light.position.copy(at).addScaledVector(d, 110);
    this.light.target.updateMatrixWorld();
  }
}

const tmpDir = new THREE.Vector3();
/** How far a camera ray that never meets the ground is followed (m). */
const FIT_FAR = 140;
const FIT_MARGIN = 3;
const FIT_MIN = 8;
const FIT_MAX = 70;
