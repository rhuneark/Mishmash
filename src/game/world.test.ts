import { describe, expect, it } from 'vitest';
import {
  BIOME,
  biomeAt,
  forNodesNear,
  generateIsland,
  heightAt,
  hitCollider,
  CHUNKS,
  type Island,
} from './world';
import { POIS, SPAWN, TOWER_VINES } from './content/pois';
import { NODE } from './content/nodes';
import {
  CLASSIC,
  TERRAINS,
  islandName,
  parseSpecCode,
  place,
  randomParts,
  specCode,
  turnDirections,
  unplace,
} from './islands';
import { rng } from './rng';

function checksum(island: Island): number {
  let h = 0;
  const mix = (v: number) => {
    h = (Math.imul(h, 31) + (Math.round(v * 1000) | 0)) | 0;
  };
  for (let i = 0; i < island.heights.length; i += 97) mix(island.heights[i] as number);
  for (let i = 0; i < island.nodeCount; i++) {
    mix(island.nodeX[i] as number);
    mix(island.nodeZ[i] as number);
    mix(island.nodeType[i] as number);
  }
  return h;
}

const SEEDS = [12345, 987, 42];
const islands = SEEDS.map((s) => generateIsland(s));

describe('island generation', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const again = generateIsland(12345);
    expect(checksum(again)).toBe(checksum(islands[0] as Island));
    expect(again.nodeCount).toBe(islands[0]?.nodeCount);
    expect(checksum(islands[1] as Island)).not.toBe(checksum(islands[0] as Island));
  });

  it('puts the spawn and every landmark on dry land', () => {
    for (const island of islands) {
      expect(heightAt(island, SPAWN.x, SPAWN.z)).toBeGreaterThan(0.5);
      for (const p of POIS) {
        expect(heightAt(island, p.x, p.z), `${p.id} on seed ${island.seed}`).toBeGreaterThan(0.5);
        expect(biomeAt(island, p.x, p.z)).not.toBe(BIOME.ocean);
      }
    }
  });

  it('is big: a coast more than 600 m across and thousands of resources', () => {
    for (const island of islands) {
      expect(heightAt(island, -300, 0)).toBeGreaterThan(-0.05);
      expect(heightAt(island, 300, 0)).toBeGreaterThan(-0.05);
      expect(heightAt(island, 500, 500)).toBeLessThan(0);
      expect(island.nodeCount).toBeGreaterThan(8000);
      expect(island.pools.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('keeps chunk node ranges contiguous and covering every node', () => {
    for (const island of islands) {
      expect(island.chunkStart[0]).toBe(0);
      expect(island.chunkStart[CHUNKS * CHUNKS]).toBe(island.nodeCount);
      for (let c = 0; c < CHUNKS * CHUNKS; c++) {
        expect(island.chunkStart[c + 1]).toBeGreaterThanOrEqual(island.chunkStart[c] as number);
      }
    }
  });

  it('finds nodes near a point and grows vines over the tower base', () => {
    for (const island of islands) {
      expect(island.towerVines).toHaveLength(TOWER_VINES.length);
      for (const id of island.towerVines) expect(island.nodeType[id]).toBe(NODE.vines);
      let near = 0;
      forNodesNear(island, SPAWN.x, SPAWN.z, 60, () => near++);
      expect(near).toBeGreaterThan(20);
    }
  });

  it('has landmark colliders and a 4-digit cargo code', () => {
    const island = islands[0] as Island;
    const crash = POIS.find((p) => p.id === 'crash');
    expect(crash).toBeDefined();
    expect(hitCollider(island, crash?.x ?? 0, crash?.z ?? 0, 0.3)).not.toBeNull();
    expect(hitCollider(island, SPAWN.x, SPAWN.z, 0.3)).toBeNull();
    expect(island.code).toMatch(/^\d{4}$/);
  });
});

function fingerprint(i: Island): string {
  let h = 2166136261;
  const fnv = (v: number) => {
    h ^= v & 0xffffffff;
    h = Math.imul(h, 16777619) >>> 0;
  };
  const f32 = (a: Float32Array) => {
    for (const v of new Uint32Array(a.buffer, a.byteOffset, a.length)) fnv(v);
  };
  const fl = new Float32Array(1);
  const u1 = new Uint32Array(fl.buffer);
  const num = (n: number) => {
    fl[0] = n;
    fnv(u1[0] as number);
  };
  f32(i.heights);
  for (const v of i.biomes) fnv(v);
  f32(i.nodeX);
  f32(i.nodeZ);
  for (const v of i.nodeType) fnv(v);
  for (const v of i.nodeVar) fnv(v);
  for (const v of i.chunkStart) fnv(v);
  for (const p of i.pools) [p.x, p.z, p.r, p.y].forEach(num);
  for (const s of i.snapjaws) [s.x, s.z].forEach(num);
  for (const t of i.towerVines) fnv(t);
  for (const c of i.colliders) [c.x, c.z, c.hw, c.hd].forEach(num);
  return `${i.seed}:${h.toString(16)}:${i.nodeCount}:${i.code}`;
}

describe('islands from parts', () => {
  it('keeps every classic island exactly as it was (saves from before)', () => {
    // Recorded before islands had parts.
    expect(fingerprint(islands[0] as Island)).toBe('12345:d48e02a2:13294:8002');
    expect(fingerprint(islands[1] as Island)).toBe('987:6b0337f9:13374:2224');
    expect(fingerprint(generateIsland(4242))).toBe('4242:8a27778d:12668:1296');
    expect(fingerprint(generateIsland(4242, { ...CLASSIC }))).toBe('4242:8a27778d:12668:1296');
  });

  it('turns and mirrors the whole island on the height grid', () => {
    const base = islands[0] as Island;
    const parts = { ...CLASSIC, turn: 1 as const, mirror: true };
    const turned = generateIsland(12345, parts);
    for (const [x, z] of [
      [0, 0],
      // Away from the landmarks (their flattening rounds to the nearest grid cell).
      [120, -120],
      [-215, -60],
      [88, 202],
      [-310, 140],
    ] as const) {
      const at = place(parts, x, z);
      expect(heightAt(turned, at.x, at.z)).toBeCloseTo(heightAt(base, x, z), 3);
      expect(unplace(parts, at.x, at.z)).toEqual({ x, z });
    }
    const tower = turned.poiById['tower'];
    expect(tower && place(parts, 150, -175)).toEqual({ x: tower?.x, z: tower?.z });
    expect(heightAt(turned, turned.spawn.x, turned.spawn.z)).toBeGreaterThan(0.5);
  });

  it('keeps the landmarks on dry land with every climate and terrain', () => {
    const random = rng(99);
    for (const terrain of TERRAINS) {
      const parts = randomParts(random, { terrain });
      const island = generateIsland(1000 + Math.floor(random() * 9000), parts);
      for (const p of island.pois) {
        expect(heightAt(island, p.x, p.z), `${p.id} on ${specCode(island.spec)}`).toBeGreaterThan(
          0.5,
        );
      }
      for (const v of island.towerVines) expect(island.nodeType[v]).toBe(NODE.vines);
      expect(island.towerVines.length).toBe(TOWER_VINES.length);
      expect(island.nodeCount).toBeGreaterThan(5000);
    }
  });

  it('turns direction words with the layout and shares islands by code', () => {
    const p = { ...CLASSIC, turn: 1 as const };
    expect(turnDirections('the tail (west), the north-east peak, the eastern marsh', p)).toBe(
      'the tail (north), the south-east peak, the southern marsh',
    );
    expect(turnDirections('West coast', { ...CLASSIC, mirror: true })).toBe('East coast');
    expect(turnDirections('to the north-west', CLASSIC)).toBe('to the north-west');
    const spec = {
      seed: 48213,
      turn: 3 as const,
      mirror: true,
      climate: 'autumn' as const,
      terrain: 'islets' as const,
    };
    expect(parseSpecCode(specCode(spec))).toEqual(spec);
    expect(parseSpecCode('nonsense')).toBeNull();
    expect(islandName(spec)).toMatch(/^\w+ \w+$/);
  });
});
