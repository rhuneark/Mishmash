// Chunked terrain meshes, the ocean and freshwater pools.
//
// The ground: colours are worked out at every grid point (so biomes blend into each other)
// and the terrain shader paints detail over them from one tileable texture made in code
// (groundTex.ts): grass mottling, sand ripples, leaf litter in the jungle, needles under the
// pines, cracked rock on slopes and highlands, wet patches in the marsh, a wet band at the
// waterline and the scorch round the crash site. The sea reads how deep the seabed is from
// a depth map of the island: turquoise shallows, deep blue further out, foam at the shore.

import * as THREE from 'three';
import { noise2 } from '../../game/noise';
import { hash01 } from '../../game/rng';
import { BIOME, CELL, CHUNK, CHUNKS, GRID, HALF, WORLD, type Island } from '../../game/world';
import { climateLook } from './climate';
import { groundTexture } from './groundTex';
import { CLOUDS, CLOUD_SHADE, WIND } from './wind';

const PER = CHUNK / CELL;
/** The sea's grid (m): it moves with you in whole cells, so its waves never jump. */
const WATER_CELL = 6;
const DRY = new THREE.Color(0xb8c46a);
/** Seabed depth (m) the depth map spans: deeper reads as the open sea. */
const DEPTH_SPAN = 6;

const BIOME_COLORS: Record<number, number[]> = {
  [BIOME.ocean]: [0xc9b98a],
  [BIOME.beach]: [0xe6d6a0, 0xe0cf96, 0xebdcaa],
  [BIOME.meadow]: [0x6aa83f, 0x5f9a3a, 0x7ab446, 0x72a841],
  [BIOME.jungle]: [0x468a35, 0x3f7f31, 0x529543],
  [BIOME.forest]: [0x51744a, 0x4a6c44, 0x5a7c52],
  [BIOME.highland]: [0x8f8e86, 0x86857d, 0x7a8a5a, 0x9a998f],
  [BIOME.bog]: [0x5d5470, 0x4f5a48, 0x564d66, 0x625a74],
};

const tmp = new THREE.Color();
const acc = new THREE.Color();
const rockColor = new THREE.Color(0x77756e);
const deep = new THREE.Color(0x4f7f8f);
const NIGHT_SEA = new THREE.Color(0x0d2236);
const NIGHT_SHALLOW = new THREE.Color(0x173a48);
const BLOOM_SEA = new THREE.Color(0x2a1830);
const TURQUOISE = new THREE.Color(0x3fd6c6);

/** The ground colours of an island's climate. */
interface Ground {
  biomes: Partial<Record<number, number[]>>;
  wetSand: THREE.Color;
}

/** Detail layers per biome: sand, grass, jungle floor, pine floor, rock, marsh mud. */
function layersOf(biome: number, out: number[]): void {
  out.fill(0);
  switch (biome) {
    case BIOME.meadow:
      out[1] = 1;
      break;
    case BIOME.jungle:
      out[2] = 1;
      break;
    case BIOME.forest:
      out[3] = 1;
      break;
    case BIOME.highland:
      out[4] = 0.65;
      out[1] = 0.35;
      break;
    case BIOME.bog:
      out[5] = 1;
      break;
    default:
      out[0] = 1;
  }
}

const TERRAIN_VERT_HEAD = `
attribute vec3 aL1;
attribute vec3 aL2;
varying vec3 vL1;
varying vec3 vL2;
varying vec3 vTPos;`;

const TERRAIN_FRAG_HEAD = `
uniform sampler2D uGround;
uniform vec3 uWetSand;
uniform vec4 uScorch;
uniform vec4 uClouds;
uniform float uWet;
uniform vec3 uSkyRef;
uniform float uWindTime;
varying vec3 vL1;
varying vec3 vL2;
varying vec3 vTPos;
${CLOUD_SHADE}`;

// Runs after the vertex colour is applied: paints the detail over it.
const TERRAIN_FRAG = `
  vec2 tp = vTPos.xz;
  vec4 tA = texture2D(uGround, tp * 0.14);
#ifdef GROUND_LOW
  vec4 tB = tA.argb;
  float tR = tA.a;
  float lb = tA.b;
  float nb = tA.b;
  float pb = tA.r;
  float hb = tA.a;
#else
  vec4 tB = texture2D(uGround, mat2(0.8, -0.6, 0.6, 0.8) * tp * 0.043 + 0.37);
  float tR = texture2D(uGround, mat2(0.6, 0.8, -0.8, 0.6) * tp * 0.085 + 0.21).a;
  float lb = texture2D(uGround, tp * 0.1 + 0.71).b;
  float nb = texture2D(uGround, tp * 0.2 + 0.5).b;
  float pb = texture2D(uGround, tp * 0.019 + 0.13).r;
  float hb = texture2D(uGround, tp * 0.03 + 0.57, 4.0).a;
#endif
  float lSand = vL1.x; float lGrass = vL1.y; float lJungle = vL1.z;
  float lPine = vL2.x; float lRock = vL2.y; float lMud = vL2.z;
  vec3 base = diffuseColor.rgb;
  // Colours here are linear (sRGB 90 is about 0.1).
  float shade = lGrass * mix(0.6, 1.2, tA.r) * mix(0.72, 1.16, tB.r)
    + lSand * mix(0.84, 1.08, tA.g) * mix(0.9, 1.06, tB.g)
    + lRock * mix(0.62, 1.12, tR) * mix(0.82, 1.1, tB.a)
    + (lJungle + lPine) * mix(0.72, 1.06, tB.r)
    + lMud * mix(0.72, 1.12, tB.r);
  vec3 col = base * shade;
  // Grass: sunlit patches go yellow, shaded ones blue-green.
  col *= mix(vec3(1.0), mix(vec3(0.86, 0.98, 1.1), vec3(1.12, 1.04, 0.78), tB.r), lGrass);
  // Leaf litter on the jungle floor, which is darker under the canopy.
  col *= 1.0 - lJungle * 0.18;
  float leaf = smoothstep(0.42, 0.6, lb);
  col = mix(col, vec3(0.09, 0.06, 0.022) * (0.7 + 0.6 * lb), leaf * lJungle * 0.45);
  // Needles under the pines: smaller, rusty drifts.
  float ndl = smoothstep(0.42, 0.6, nb);
  col = mix(col, vec3(0.17, 0.075, 0.025) * (0.75 + 0.5 * tB.b), ndl * lPine * 0.45);
  // Moss in the rock's hollows.
  col = mix(col, vec3(0.07, 0.12, 0.03), smoothstep(0.5, 0.25, tR) * lRock * 0.4);
  // Wet, dark pools of mud in the marsh.
  float pud = smoothstep(0.54, 0.64, pb + (tA.r - 0.5) * 0.12);
  col = mix(col, col * vec3(0.38, 0.42, 0.55), lMud * pud);
  // The waterline: sand darkens where the sea wets it.
  float wy = vTPos.y + (tA.g - 0.5) * 0.25;
  float wet = (1.0 - smoothstep(0.08, 0.75, wy)) * step(-0.4, wy);
  col = mix(col, uWetSand * mix(0.85, 1.05, tA.g), wet * 0.8 * (1.0 - lMud));
  // Scorched ground round the wreck: soot in the middle, singed grass at the edge.
  float sd = length(tp - uScorch.xy) + (tB.a - 0.5) * 7.0 + (tA.b - 0.3) * 1.5;
  float burn = (1.0 - smoothstep(uScorch.z * 0.35, uScorch.z, sd)) * uScorch.w;
  vec3 ash = vec3(0.022, 0.019, 0.017) * mix(0.7, 1.5, tB.r) * mix(0.8, 1.3, tA.r);
  col = mix(col, ash, burn * 0.94);
  float singe = smoothstep(uScorch.z * 1.25, uScorch.z * 0.85, sd) * (1.0 - burn) * uScorch.w;
  col = mix(col, vec3(0.1, 0.065, 0.03) * mix(0.8, 1.2, tA.r), singe * 0.55);
  // Rain: the ground darkens, puddles gather in the flat hollows and mirror the sky.
  float soak = uWet * (1.0 - lSand * 0.45);
  col *= 1.0 - soak * 0.32;
  float hollow = smoothstep(0.66, 0.7, hb) * (1.0 - lRock) * (1.0 - lSand * 0.7);
  float puddle = hollow * smoothstep(0.35, 0.9, uWet);
  float drip = smoothstep(0.9, 0.95, texture2D(uGround, tp * 0.7 + vec2(0.0, uWindTime * 2.7)).r);
  col = mix(col, uSkyRef * 0.34 + col * 0.18 + drip * 0.06, puddle * 0.8);
  col *= cloudShade(tp);
  diffuseColor.rgb = col;`;

export class Terrain {
  private readonly island: Island;
  private readonly group = new THREE.Group();
  private readonly chunks = new Map<number, THREE.Mesh>();
  private readonly material: THREE.MeshLambertMaterial;
  readonly water: THREE.Mesh;
  private readonly waterMat: THREE.MeshPhongMaterial;
  private readonly poolMat: THREE.MeshPhongMaterial;
  private queue: number[] = [];
  private readonly ground: Ground;
  private readonly sea: number;
  private readonly shallow: THREE.Color;
  private readonly seaU = {
    uShallow: { value: new THREE.Color() },
    uGlint: { value: 1 },
  };
  private readonly weatherU = {
    uWet: { value: 0 },
    uSkyRef: { value: new THREE.Color(0x8aa0b8) },
  };
  private readonly poolU = {
    uPoolEdge: { value: new THREE.Color() },
    uGlint: this.seaU.uGlint,
  };

  constructor(island: Island, scene: THREE.Scene) {
    this.island = island;
    const look = climateLook(island.spec.climate);
    this.ground = {
      biomes: { ...BIOME_COLORS, ...look.ground },
      wetSand: new THREE.Color(look.wetSand ?? 0xc9b98a),
    };
    this.sea = look.sea ?? 0x2f8fc0;
    this.shallow = new THREE.Color(this.sea).lerp(TURQUOISE, 0.6).multiplyScalar(1.12);
    const tex = groundTexture();
    const crash = island.poiById['crash'];
    const ground = this.ground;

    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms['uGround'] = { value: tex };
      shader.uniforms['uWetSand'] = { value: ground.wetSand.clone().multiplyScalar(0.82) };
      shader.uniforms['uClouds'] = CLOUDS;
      shader.uniforms['uWet'] = this.weatherU.uWet;
      shader.uniforms['uSkyRef'] = this.weatherU.uSkyRef;
      shader.uniforms['uWindTime'] = WIND;
      shader.uniforms['uScorch'] = {
        value: crash ? new THREE.Vector4(crash.x, crash.z, 13, 1) : new THREE.Vector4(0, 0, 1, 0),
      };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>${TERRAIN_VERT_HEAD}`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
  vL1 = aL1;
  vL2 = aL2;
  vTPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>${TERRAIN_FRAG_HEAD}`)
        .replace('#include <color_fragment>', `#include <color_fragment>${TERRAIN_FRAG}`);
    };

    scene.add(this.group);
    const depth = depthMap(island);
    this.waterMat = new THREE.MeshPhongMaterial({
      color: this.sea,
      transparent: true,
      opacity: 0.8,
      shininess: 90,
      specular: 0xbfe4f6,
      flatShading: true,
    });
    // Low swells, faceted so they catch the sun; shallows and foam from the depth map.
    this.waterMat.onBeforeCompile = (shader) => {
      shader.uniforms['uWindTime'] = WIND;
      shader.uniforms['uDepth'] = { value: depth };
      shader.uniforms['uGround'] = { value: tex };
      shader.uniforms['uShallow'] = this.seaU.uShallow;
      shader.uniforms['uGlint'] = this.seaU.uGlint;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uWindTime;\nvarying vec3 vSeaPos;',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
  vec4 seaAt = modelMatrix * vec4(position, 1.0);
  transformed.y += sin(seaAt.x * 0.33 + uWindTime * 1.2) * 0.07
    + sin(seaAt.z * 0.27 + seaAt.x * 0.11 - uWindTime * 0.9) * 0.06;
  vSeaPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uWindTime;
uniform sampler2D uDepth;
uniform sampler2D uGround;
uniform vec3 uShallow;
uniform float uGlint;
varying vec3 vSeaPos;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
  vec2 sp = vSeaPos.xz;
  float sd = texture2D(uDepth, (sp + ${HALF.toFixed(1)}) / ${WORLD.toFixed(1)}).r;
  float r1 = texture2D(uGround, sp * 0.045 + vec2(uWindTime * 0.012, uWindTime * 0.007)).r;
  float r2 = texture2D(uGround, sp * 0.06 - vec2(uWindTime * 0.009, -uWindTime * 0.011)).r;
  float rip = r1 * r2;
  float deepK = smoothstep(0.02, 0.6, sd + (rip - 0.3) * 0.08);
  diffuseColor.rgb = mix(uShallow, diffuseColor.rgb, deepK) * (0.93 + rip * 0.22);
  diffuseColor.a = mix(0.42, 0.86, smoothstep(0.0, 0.32, sd));
  float edge = sd + (r1 - 0.5) * 0.04;
  float surf = 0.5 + 0.5 * sin(edge * 110.0 - uWindTime * 2.3 + r2 * 3.0);
  float seaFoam = (1.0 - smoothstep(0.0, 0.09, edge)) * (0.3 + 0.7 * surf)
    + (1.0 - smoothstep(0.0, 0.022, edge));
  seaFoam = clamp(seaFoam, 0.0, 1.0) * smoothstep(0.2, 0.5, texture2D(uGround, sp * 0.09 + uWindTime * 0.015).r);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.93, 0.98), seaFoam * 0.78);
  diffuseColor.a = max(diffuseColor.a, seaFoam * 0.92);`,
        )
        .replace(
          '#include <opaque_fragment>',
          `outgoingLight += vec3(1.0, 0.96, 0.86) * smoothstep(0.47, 0.64, rip) * uGlint * (1.0 - seaFoam) * 0.7;
#include <opaque_fragment>`,
        );
    };
    const cells = Math.round(420 / WATER_CELL);
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(cells * WATER_CELL, cells * WATER_CELL, cells, cells).rotateX(
        -Math.PI / 2,
      ),
      this.waterMat,
    );
    this.water.position.y = -0.02;
    this.water.renderOrder = 1;
    this.water.userData['shade'] = 'receive';
    scene.add(this.water);

    this.poolMat = new THREE.MeshPhongMaterial({
      color: 0x2f7fa8,
      transparent: true,
      opacity: 0.85,
      shininess: 80,
    });
    // Pools: deeper in the middle, clear and pale at the edge, the same glints as the sea.
    this.poolMat.onBeforeCompile = (shader) => {
      shader.uniforms['uWindTime'] = WIND;
      shader.uniforms['uGround'] = { value: tex };
      shader.uniforms['uPoolEdge'] = this.poolU.uPoolEdge;
      shader.uniforms['uGlint'] = this.poolU.uGlint;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float aEdge;\nvarying float vEdge;\nvarying vec3 vPoolPos;',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
  vEdge = aEdge;
  vPoolPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uWindTime;
uniform sampler2D uGround;
uniform vec3 uPoolEdge;
uniform float uGlint;
varying float vEdge;
varying vec3 vPoolPos;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
  vec2 pp = vPoolPos.xz;
  float p1 = texture2D(uGround, pp * 0.07 + vec2(uWindTime * 0.01, uWindTime * 0.006)).r;
  float p2 = texture2D(uGround, pp * 0.09 - vec2(uWindTime * 0.008, -uWindTime * 0.01)).r;
  float prip = p1 * p2;
  float rim = smoothstep(0.5, 1.0, vEdge);
  diffuseColor.rgb = mix(diffuseColor.rgb, uPoolEdge, rim) * (0.94 + prip * 0.18);
  diffuseColor.a = mix(0.9, 0.5, rim);`,
        )
        .replace(
          '#include <opaque_fragment>',
          `outgoingLight += vec3(1.0, 0.96, 0.86) * smoothstep(0.5, 0.66, prip) * uGlint * 0.45;
#include <opaque_fragment>`,
        );
    };
    const pads: { x: number; y: number; z: number; r: number; a: number; flower: boolean }[] = [];
    island.pools.forEach((p, k) => {
      const geo = new THREE.CircleGeometry(p.r + 0.6, 18).rotateX(-Math.PI / 2);
      const n = geo.getAttribute('position').count;
      const edge = new Float32Array(n);
      for (let v = 1; v < n; v++) edge[v] = 1;
      geo.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
      const disc = new THREE.Mesh(geo, this.poolMat);
      disc.position.set(p.x, p.y, p.z);
      disc.renderOrder = 1;
      disc.userData['shade'] = 'receive';
      scene.add(disc);
      // Lily pads on marsh pools (and now and then elsewhere), some with a pink flower.
      const marsh = island.biomes[cellIndex(p.x, p.z)] === BIOME.bog;
      if (!marsh && hash01(k, 7, island.seed + 404) > 0.35) return;
      const count = Math.round((marsh ? 5 : 2) + p.r * (marsh ? 1.6 : 0.7));
      for (let i = 0; i < count; i++) {
        const ang = hash01(k, i * 3, island.seed + 405) * Math.PI * 2;
        const dist = Math.sqrt(hash01(k, i * 3 + 1, island.seed + 406)) * p.r * 0.85;
        pads.push({
          x: p.x + Math.cos(ang) * dist,
          y: p.y + 0.025,
          z: p.z + Math.sin(ang) * dist,
          r: 0.32 + hash01(k, i * 3 + 2, island.seed + 407) * 0.3,
          a: hash01(i, k, island.seed + 408) * Math.PI * 2,
          flower: hash01(i, k * 5, island.seed + 409) > (marsh ? 0.62 : 0.8),
        });
      }
    });
    if (pads.length) this.addPads(scene, pads);
  }

  private addPads(
    scene: THREE.Scene,
    pads: { x: number; y: number; z: number; r: number; a: number; flower: boolean }[],
  ): void {
    const padGeo = new THREE.CircleGeometry(1, 9, 0.35, Math.PI * 2 - 0.7).rotateX(-Math.PI / 2);
    const padMat = new THREE.MeshLambertMaterial({ color: 0x4f8f3a, flatShading: true });
    const padMesh = new THREE.InstancedMesh(padGeo, padMat, pads.length);
    const flowers = pads.filter((p) => p.flower);
    const flowerGeo = new THREE.ConeGeometry(0.16, 0.16, 5).translate(0, 0.08, 0);
    const flowerMat = new THREE.MeshLambertMaterial({
      color: 0xff6aa8,
      emissive: 0x5a0a2a,
      flatShading: true,
    });
    const flowerMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, Math.max(1, flowers.length));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p3 = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    pads.forEach((p, i) => {
      q.setFromAxisAngle(up, p.a);
      m.compose(p3.set(p.x, p.y, p.z), q, s.set(p.r, 1, p.r));
      padMesh.setMatrixAt(i, m);
    });
    flowers.forEach((p, i) => {
      q.setFromAxisAngle(up, p.a);
      m.compose(p3.set(p.x + 0.08, p.y, p.z), q, s.set(1, 1, 1));
      flowerMesh.setMatrixAt(i, m);
    });
    flowerMesh.count = flowers.length;
    padMesh.userData['shade'] = 'receive';
    flowerMesh.userData['shade'] = 'none';
    padMesh.renderOrder = 2;
    scene.add(padMesh, flowerMesh);
  }

  /** Rain soaking the ground (0..1) and the sky its puddles mirror (linear colour). */
  setWet(wet: number, sky: THREE.Color): void {
    this.weatherU.uWet.value = wet;
    this.weatherU.uSkyRef.value.copy(sky);
  }

  /** Ground detail: 2 = full, 1 = one texture read a pixel (low quality). */
  setDetail(level: number): void {
    const low = level < 2;
    const defines = (this.material.defines ??= {});
    if (low === 'GROUND_LOW' in defines) return;
    if (low) defines['GROUND_LOW'] = '';
    else delete defines['GROUND_LOW'];
    this.material.needsUpdate = true;
  }

  /** Night darkens the water; `clear` (0..1) is how much sun there is to glint. */
  setWaterTint(day: number, bloom: boolean, clear = 1): void {
    const night = 1 - day;
    this.waterMat.color.setHex(this.sea).lerp(bloom ? BLOOM_SEA : NIGHT_SEA, night);
    this.seaU.uShallow.value.copy(this.shallow).lerp(bloom ? BLOOM_SEA : NIGHT_SHALLOW, night);
    this.poolMat.color.setHex(0x2f7fa8).lerp(tmp.setHex(0x0f2438), night);
    this.poolU.uPoolEdge.value.setHex(0x6cc4d8).lerp(tmp.setHex(0x16304a), night);
    this.seaU.uGlint.value = Math.max(0, day * 1.15 - 0.15) * clear;
  }

  /** Keeps chunks within `radius` of (x, z) built; builds a couple per call. */
  update(x: number, z: number, radius: number): void {
    this.water.position.x = Math.round(x / WATER_CELL) * WATER_CELL;
    this.water.position.z = Math.round(z / WATER_CELL) * WATER_CELL;
    const cx = Math.floor((x + HALF) / CHUNK);
    const cz = Math.floor((z + HALF) / CHUNK);
    const want = new Set<number>();
    for (let j = cz - radius; j <= cz + radius; j++) {
      for (let i = cx - radius; i <= cx + radius; i++) {
        if (i < 0 || j < 0 || i >= CHUNKS || j >= CHUNKS) continue;
        want.add(j * CHUNKS + i);
      }
    }
    for (const [c, m] of this.chunks) {
      if (!want.has(c)) {
        const ci = c % CHUNKS;
        const cj = Math.floor(c / CHUNKS);
        if (Math.abs(ci - cx) > radius + 1 || Math.abs(cj - cz) > radius + 1) {
          this.group.remove(m);
          m.geometry.dispose();
          this.chunks.delete(c);
        }
      }
    }
    this.queue = [...want].filter((c) => !this.chunks.has(c));
    // Nearest first.
    this.queue.sort((a, b) => dist2(a, cx, cz) - dist2(b, cx, cz));
    for (let k = 0; k < 3 && this.queue.length; k++) {
      const c = this.queue.shift() as number;
      const m = this.buildChunk(c);
      this.chunks.set(c, m);
      this.group.add(m);
    }
  }

  /** Builds every chunk within radius at once (loading screen). */
  prime(x: number, z: number, radius: number): void {
    for (let k = 0; k < 40; k++) this.update(x, z, radius);
  }

  private buildChunk(c: number): THREE.Mesh {
    const island = this.island;
    const ci = c % CHUNKS;
    const cj = Math.floor(c / CHUNKS);
    const n1 = GRID + 1;
    const hAt = (i: number, j: number) =>
      island.heights[
        Math.max(0, Math.min(GRID, j)) * n1 + Math.max(0, Math.min(GRID, i))
      ] as number;
    // Cells round the chunk (one extra on each side): biome and slope.
    const S = PER + 2;
    const cellBiome = new Uint8Array(S * S);
    const cellSlope = new Float32Array(S * S);
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const gi = Math.max(0, Math.min(GRID - 1, ci * PER + i - 1));
        const gj = Math.max(0, Math.min(GRID - 1, cj * PER + j - 1));
        cellBiome[j * S + i] = island.biomes[gj * GRID + gi] as number;
        cellSlope[j * S + i] =
          Math.max(
            Math.abs(hAt(gi, gj) - hAt(gi + 1, gj + 1)),
            Math.abs(hAt(gi + 1, gj) - hAt(gi, gj + 1)),
          ) / CELL;
      }
    }
    // Every grid point: the average look of the four cells that meet there.
    const V = PER + 1;
    const vCol = new Float32Array(V * V * 3);
    const vL = new Float32Array(V * V * 6);
    const lay = [0, 0, 0, 0, 0, 0];
    for (let j = 0; j < V; j++) {
      for (let i = 0; i < V; i++) {
        const gi = ci * PER + i;
        const gj = cj * PER + j;
        const h = hAt(gi, gj);
        const patch = noise2(gi * 0.09, gj * 0.09, island.seed + 33);
        const dry = noise2(gi * 0.03, gj * 0.03, island.seed + 71);
        acc.setRGB(0, 0, 0);
        const o = (j * V + i) * 6;
        for (let dj = 0; dj < 2; dj++) {
          for (let di = 0; di < 2; di++) {
            const k = (j + dj) * S + (i + di);
            const biome = cellBiome[k] as number;
            const slope = cellSlope[k] as number;
            colorFor(this.ground, biome, h, slope, patch, tmp);
            if (biome === BIOME.meadow && dry > 0.6)
              tmp.lerp(DRY, Math.min(0.5, (dry - 0.6) * 1.6));
            acc.r += tmp.r / 4;
            acc.g += tmp.g / 4;
            acc.b += tmp.b / 4;
            layersOf(biome, lay);
            const rocky = Math.min(1, Math.max(0, (slope - 0.6) * 1.6));
            for (let l = 0; l < 6; l++) {
              const w = (lay[l] as number) * (1 - rocky) + (l === 4 ? rocky : 0);
              vL[o + l] = (vL[o + l] as number) + w / 4;
            }
          }
        }
        vCol[(j * V + i) * 3] = acc.r;
        vCol[(j * V + i) * 3 + 1] = acc.g;
        vCol[(j * V + i) * 3 + 2] = acc.b;
      }
    }
    const pos = new Float32Array(PER * PER * 6 * 3);
    const col = new Float32Array(PER * PER * 6 * 3);
    const l1 = new Float32Array(PER * PER * 6 * 3);
    const l2 = new Float32Array(PER * PER * 6 * 3);
    let o = 0;
    const put = (i: number, j: number) => {
      const gi = ci * PER + i;
      const gj = cj * PER + j;
      const v = j * V + i;
      pos[o] = gi * CELL - HALF;
      pos[o + 1] = hAt(gi, gj);
      pos[o + 2] = gj * CELL - HALF;
      col[o] = vCol[v * 3] as number;
      col[o + 1] = vCol[v * 3 + 1] as number;
      col[o + 2] = vCol[v * 3 + 2] as number;
      l1[o] = vL[v * 6] as number;
      l1[o + 1] = vL[v * 6 + 1] as number;
      l1[o + 2] = vL[v * 6 + 2] as number;
      l2[o] = vL[v * 6 + 3] as number;
      l2[o + 1] = vL[v * 6 + 4] as number;
      l2[o + 2] = vL[v * 6 + 5] as number;
      o += 3;
    };
    for (let j = 0; j < PER; j++) {
      for (let i = 0; i < PER; i++) {
        put(i, j);
        put(i, j + 1);
        put(i + 1, j);
        put(i + 1, j);
        put(i, j + 1);
        put(i + 1, j + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aL1', new THREE.BufferAttribute(l1, 3));
    geo.setAttribute('aL2', new THREE.BufferAttribute(l2, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.userData['shade'] = 'receive';
    return mesh;
  }
}

const blend = new THREE.Color();

function cellIndex(x: number, z: number): number {
  const i = Math.max(0, Math.min(GRID - 1, Math.floor((x + HALF) / CELL)));
  const j = Math.max(0, Math.min(GRID - 1, Math.floor((z + HALF) / CELL)));
  return j * GRID + i;
}

/** How deep the seabed lies under each 2 m cell (0 = dry land or the shore, 1 = 6 m+). */
function depthMap(island: Island): THREE.DataTexture {
  const n1 = GRID + 1;
  const data = new Uint8Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const h =
        ((island.heights[j * n1 + i] as number) +
          (island.heights[j * n1 + i + 1] as number) +
          (island.heights[(j + 1) * n1 + i] as number) +
          (island.heights[(j + 1) * n1 + i + 1] as number)) /
        4;
      data[j * GRID + i] = Math.max(0, Math.min(255, Math.round((-h / DEPTH_SPAN) * 255)));
    }
  }
  const tex = new THREE.DataTexture(data, GRID, GRID, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Ground colour: soft patches of the biome's shades (noise), rock on steep slopes. */
function colorFor(
  ground: Ground,
  biome: number,
  h: number,
  slope: number,
  patch: number,
  out: THREE.Color,
): void {
  if (h < 0) {
    out.copy(ground.wetSand).lerp(deep, Math.min(1, -h / 4));
    return;
  }
  const list = ground.biomes[biome] ?? [0x888888];
  const f = Math.max(0, Math.min(0.999, patch)) * (list.length - 1);
  const i = Math.floor(f);
  out.setHex(list[i] as number).lerp(blend.setHex((list[i + 1] ?? list[i]) as number), f - i);
  if (slope > 0.7) out.lerp(rockColor, Math.min(1, (slope - 0.7) * 1.5));
}

function dist2(c: number, cx: number, cz: number): number {
  const i = c % CHUNKS;
  const j = Math.floor(c / CHUNKS);
  return (i - cx) * (i - cx) + (j - cz) * (j - cz);
}
