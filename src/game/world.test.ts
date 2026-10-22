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
