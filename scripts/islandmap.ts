// Renders an island seed to a PNG (biomes, nodes, pools, landmarks) for a quick look.
// Usage: npx tsx scripts/islandmap.ts <seed> <out.png>
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { generateIsland, GRID, CELL, HALF, heightAt } from '../src/game/world';
import { POIS } from '../src/game/content/pois';

const seed = Number(process.argv[2] ?? 12345);
const out = process.argv[3] ?? 'island.png';
const t0 = performance.now();
const island = generateIsland(seed);
const ms = performance.now() - t0;
const S = GRID;
const px = new Uint8Array(S * S * 3);
const COLORS: [number, number, number][] = [
  [40, 90, 160],
  [230, 214, 160],
  [140, 190, 90],
  [50, 130, 60],
  [40, 95, 70],
  [140, 140, 130],
  [90, 80, 110],
];
for (let j = 0; j < S; j++)
  for (let i = 0; i < S; i++) {
    const b = island.biomes[j * S + i] ?? 0;
    const h = heightAt(island, i * CELL - HALF, j * CELL - HALF);
    const c = COLORS[b] ?? [0, 0, 0];
    const shade = b === 0 ? Math.max(0.5, 1 + h * 0.05) : 0.75 + Math.min(0.5, h / 40);
    const k = (j * S + i) * 3;
    px[k] = Math.min(255, c[0] * shade);
    px[k + 1] = Math.min(255, c[1] * shade);
    px[k + 2] = Math.min(255, c[2] * shade);
  }
const dot = (x: number, z: number, r: number, g: number, b: number, size = 0) => {
  const i0 = Math.floor((x + HALF) / CELL),
    j0 = Math.floor((z + HALF) / CELL);
  for (let dj = -size; dj <= size; dj++)
    for (let di = -size; di <= size; di++) {
      const i = i0 + di,
        j = j0 + dj;
      if (i < 0 || j < 0 || i >= S || j >= S) continue;
      const k = (j * S + i) * 3;
      px[k] = r;
      px[k + 1] = g;
      px[k + 2] = b;
    }
};
const counts: Record<number, number> = {};
for (let id = 0; id < island.nodeCount; id++) {
  const t = island.nodeType[id] ?? 0;
  counts[t] = (counts[t] ?? 0) + 1;
  if (t <= 2) dot(island.nodeX[id] ?? 0, island.nodeZ[id] ?? 0, 20, 60, 20);
  else if (t === 5) dot(island.nodeX[id] ?? 0, island.nodeZ[id] ?? 0, 110, 110, 110);
  else if (t === 11) dot(island.nodeX[id] ?? 0, island.nodeZ[id] ?? 0, 150, 40, 150);
}
for (const p of island.pools) dot(p.x, p.z, 80, 200, 255, 2);
for (const s of island.snapjaws) dot(s.x, s.z, 230, 40, 40, 1);
for (const p of POIS) dot(p.x, p.z, 255, 255, 0, 4);
// PNG encode
const raw = Buffer.alloc((S * 3 + 1) * S);
for (let j = 0; j < S; j++) {
  raw[j * (S * 3 + 1)] = 0;
  Buffer.from(px.buffer, j * S * 3, S * 3).copy(raw, j * (S * 3 + 1) + 1);
}
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc = (buf: Buffer) => {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 255]! ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8;
ihdr[9] = 2;
writeFileSync(
  out,
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
console.log(
  JSON.stringify({
    seed,
    ms: Math.round(ms),
    nodes: island.nodeCount,
    counts,
    pools: island.pools.length,
    snapjaws: island.snapjaws.length,
    towerVines: island.towerVines,
    code: island.code,
  }),
);
