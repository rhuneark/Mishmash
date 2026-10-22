// Tiny geometry kit: coloured low-poly primitives that merge into one mesh,
// so a whole model costs one draw call and one shared material.

import * as THREE from 'three';

export interface Place {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

const tmpColor = new THREE.Color();

/** Non-indexed copy with a vertex colour per face (slight shade jitter per face). */
function paint(
  geo: THREE.BufferGeometry,
  color: number,
  jitter: number,
  p: Place,
): THREE.BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(p.x ?? 0, p.y ?? 0, p.z ?? 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0)),
    new THREE.Vector3(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1),
  );
  g.applyMatrix4(m);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const n = g.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  tmpColor.setHex(color);
  let seed = (color * 2654435761) >>> 0;
  for (let i = 0; i < n; i += 3) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const k = 1 + ((seed >>> 8) / 16777216 - 0.5) * jitter;
    for (let v = 0; v < 3; v++) {
      colors[(i + v) * 3] = tmpColor.r * k;
      colors[(i + v) * 3 + 1] = tmpColor.g * k;
      colors[(i + v) * 3 + 2] = tmpColor.b * k;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g = g as THREE.BufferGeometry;
  return g;
}

export function box(w: number, h: number, d: number, color: number, p: Place = {}, jitter = 0.08) {
  return paint(new THREE.BoxGeometry(w, h, d), color, jitter, p);
}

export function cyl(
  rt: number,
  rb: number,
  h: number,
  seg: number,
  color: number,
  p: Place = {},
  jitter = 0.08,
) {
  return paint(new THREE.CylinderGeometry(rt, rb, h, seg), color, jitter, p);
}

export function cone(
  r: number,
  h: number,
  seg: number,
  color: number,
  p: Place = {},
  jitter = 0.08,
) {
  return paint(new THREE.ConeGeometry(r, h, seg), color, jitter, p);
}

export function ico(r: number, detail: number, color: number, p: Place = {}, jitter = 0.12) {
  return paint(new THREE.IcosahedronGeometry(r, detail), color, jitter, p);
}

export function dodeca(r: number, color: number, p: Place = {}, jitter = 0.12) {
  return paint(new THREE.DodecahedronGeometry(r, 0), color, jitter, p);
}

export function sphere(
  r: number,
  w: number,
  h: number,
  color: number,
  p: Place = {},
  jitter = 0.05,
) {
  return paint(new THREE.SphereGeometry(r, w, h), color, jitter, p);
}

export function torus(r: number, tube: number, color: number, p: Place = {}, jitter = 0.05) {
  return paint(new THREE.TorusGeometry(r, tube, 5, 10), color, jitter, p);
}

/** A flat disc lying on the ground (y up). */
export function disc(r: number, seg: number, color: number, p: Place = {}) {
  return paint(new THREE.CircleGeometry(r, seg), color, 0, { rx: -Math.PI / 2, ...p });
}

/** Merges painted primitives into one geometry. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const g of parts) total += g.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    const p = g.getAttribute('position').array as Float32Array;
    const n = g.getAttribute('normal').array as Float32Array;
    const c = g.getAttribute('color').array as Float32Array;
    pos.set(p, o);
    nor.set(n, o);
    col.set(c, o);
    o += p.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** Shared materials: lit low-poly, unlit glow, water. */
export const MAT = {
  lit: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  glowAdd: new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
};

export function mesh(
  parts: THREE.BufferGeometry[],
  material: THREE.Material = MAT.lit,
): THREE.Mesh {
  return new THREE.Mesh(merge(parts), material);
}
