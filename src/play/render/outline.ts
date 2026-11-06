// Ink outlines (Settings › Graphics › Outlines): the island is drawn into an off-screen
// picture with its depth, then copied to the screen with a dark ink line wherever something
// stands in front of what's behind it (trees, rocks, buildings, creatures, the wreck), like
// the field journal's drawings. Lines fade into the fog with what they outline.
//
// The off-screen picture is told it's the screen (three's XR flag), so the tone mapping,
// the night grade and the sRGB encoding happen in the materials exactly as they do when
// drawing straight to the canvas, in plain 8-bit colour every phone can draw into.

import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uStep;
uniform float uNear;
uniform float uFar;
uniform float uFogNear;
uniform float uFogFar;
uniform float uStrength;
varying vec2 vUv;

// 1 / distance: flat ground is a straight run on screen, so it cancels out below.
float inv(vec2 uv) {
  float z = -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
  return 1.0 / max(z, 0.001);
}

void main() {
  vec4 col = texture2D(tColor, vUv);
  float c = inv(vUv);
  float l = inv(vUv - vec2(uStep.x, 0.0));
  float r = inv(vUv + vec2(uStep.x, 0.0));
  float d = inv(vUv - vec2(0.0, uStep.y));
  float u = inv(vUv + vec2(0.0, uStep.y));
  // > 0 where this pixel stands in front of its neighbours: the near side of an edge.
  float e = max(2.0 * c - l - r, 2.0 * c - u - d) / c;
  float ink = smoothstep(0.009, 0.026, e);
  ink *= 1.0 - smoothstep(uFogNear, uFogFar, 1.0 / c);
  // Warm dark ink, like the journal's.
  col.rgb = mix(col.rgb, col.rgb * vec3(0.26, 0.2, 0.16), ink * uStrength);
  gl_FragColor = vec4(col.rgb, 1.0);
}`;

export class InkPass {
  private readonly target: THREE.WebGLRenderTarget;
  private readonly scene = new THREE.Scene();
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly mat: THREE.ShaderMaterial;
  private w = 0;
  private h = 0;
  private samples = -1;
  /** False once the device turned out not to draw into it: straight to the screen then. */
  ok = true;
  private checked = false;

  constructor() {
    const depth = new THREE.DepthTexture(1, 1);
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthTexture: depth, samples: 4 });
    const tex = this.target.texture;
    tex.colorSpace = THREE.SRGBColorSpace;
    // Plain RGBA8 holding sRGB-encoded colour (the materials encode it), read back as is.
    tex.internalFormat = 'RGBA8';
    tex.generateMipmaps = false;
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    (this.target as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: tex },
        tDepth: { value: depth },
        uStep: { value: new THREE.Vector2() },
        uNear: { value: 0.5 },
        uFar: { value: 400 },
        uFogNear: { value: 50 },
        uFogFar: { value: 120 },
        uStrength: { value: 0.9 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  /**
   * Draws `scene` with ink lines. `ratio` is the pixel ratio drawn at: lines stay about one
   * screen point wide however sharp the picture is.
   */
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    fog: THREE.Fog,
    ratio: number,
  ): void {
    const size = renderer.getDrawingBufferSize(tmp);
    // Very sharp pictures barely show jagged edges: no multisampling there (it costs a lot
    // of memory at three pixels a point).
    const samples = ratio >= 2.4 ? 0 : 4;
    if (size.x !== this.w || size.y !== this.h || samples !== this.samples) {
      this.w = size.x;
      this.h = size.y;
      if (samples !== this.samples) {
        this.samples = samples;
        this.target.samples = samples;
        this.target.dispose();
      }
      this.target.setSize(this.w, this.h);
      this.checked = false;
    }
    renderer.setRenderTarget(this.target);
    if (!this.checked) {
      this.checked = true;
      const gl = renderer.getContext();
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        this.ok = false;
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        return;
      }
    }
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const u = this.mat.uniforms;
    const px = Math.max(1, Math.round(ratio * 0.9));
    (u['uStep']?.value as THREE.Vector2).set(px / this.w, px / this.h);
    (u['uNear'] as THREE.IUniform).value = camera.near;
    (u['uFar'] as THREE.IUniform).value = camera.far;
    (u['uFogNear'] as THREE.IUniform).value = fog.near;
    (u['uFogFar'] as THREE.IUniform).value = fog.far;
    renderer.render(this.scene, this.cam);
  }

  dispose(): void {
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.mat.dispose();
  }
}

const tmp = new THREE.Vector2();
