// The island map: drawn once from the heightmap, with fog over the parts you
// haven't explored yet (kept per island in appStorage).

import { BIOME, GRID, HALF, WORLD, type Island } from '../../game/world';

const COLORS: Record<number, [number, number, number]> = {
  [BIOME.ocean]: [38, 110, 160],
  [BIOME.beach]: [226, 210, 158],
  [BIOME.meadow]: [128, 188, 88],
  [BIOME.jungle]: [70, 130, 60],
  [BIOME.forest]: [76, 110, 70],
  [BIOME.highland]: [140, 138, 128],
  [BIOME.bog]: [94, 84, 112],
};

/** A GRID×GRID picture of the island (one pixel per heightmap cell). */
export function islandImage(island: Island): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = GRID;
  canvas.height = GRID;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const img = ctx.createImageData(GRID, GRID);
  const n1 = GRID + 1;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const h = island.heights[j * n1 + i] as number;
      const hE = island.heights[j * n1 + i + 1] as number;
      const hS = island.heights[(j + 1) * n1 + i] as number;
      const biome = island.biomes[j * GRID + i] as number;
      let [r, g, b] = COLORS[biome] ?? (COLORS[BIOME.ocean] as [number, number, number]);
      if (h < 0) {
        const deep = Math.min(1, -h / 6);
        r = 60 - deep * 30;
        g = 150 - deep * 50;
        b = 190 - deep * 30;
      } else {
        // Hill shading from the north-west.
        const shade = 1 + (h - hE + (h - hS)) * 0.18 + Math.min(0.25, h / 120);
        r *= shade;
        g *= shade;
        b *= shade;
      }
      const k = (j * GRID + i) * 4;
      img.data[k] = r;
      img.data[k + 1] = g;
      img.data[k + 2] = b;
      img.data[k + 3] = 255;
    }
  }
  for (const p of island.pools) {
    const ci = Math.round((p.x + HALF) / (WORLD / GRID));
    const cj = Math.round((p.z + HALF) / (WORLD / GRID));
    const rr = Math.max(1, Math.round(p.r / (WORLD / GRID)));
    for (let dj = -rr; dj <= rr; dj++) {
      for (let di = -rr; di <= rr; di++) {
        if (di * di + dj * dj > rr * rr) continue;
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= GRID || j >= GRID) continue;
        const k = (j * GRID + i) * 4;
        img.data[k] = 90;
        img.data[k + 1] = 176;
        img.data[k + 2] = 216;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export const FOG_CELLS = 64;
const FOG_SIZE = WORLD / FOG_CELLS;
export const REVEAL_RADIUS = 56;

/** Explored map cells (16 m squares). */
export class Fog {
  readonly cells = new Uint8Array(FOG_CELLS * FOG_CELLS);
  changed = false;

  /** Marks cells around (x, z) explored. */
  reveal(x: number, z: number, r = REVEAL_RADIUS): void {
    const c0 = Math.max(0, Math.floor((x - r + HALF) / FOG_SIZE));
    const c1 = Math.min(FOG_CELLS - 1, Math.floor((x + r + HALF) / FOG_SIZE));
    const r0 = Math.max(0, Math.floor((z - r + HALF) / FOG_SIZE));
    const r1 = Math.min(FOG_CELLS - 1, Math.floor((z + r + HALF) / FOG_SIZE));
    for (let j = r0; j <= r1; j++) {
      for (let i = c0; i <= c1; i++) {
        const cx = (i + 0.5) * FOG_SIZE - HALF;
        const cz = (j + 0.5) * FOG_SIZE - HALF;
        if ((cx - x) ** 2 + (cz - z) ** 2 > r * r) continue;
        const k = j * FOG_CELLS + i;
        if (!this.cells[k]) {
          this.cells[k] = 1;
          this.changed = true;
          this.version++;
        }
      }
    }
  }

  seen(x: number, z: number): boolean {
    const i = Math.floor((x + HALF) / FOG_SIZE);
    const j = Math.floor((z + HALF) / FOG_SIZE);
    if (i < 0 || j < 0 || i >= FOG_CELLS || j >= FOG_CELLS) return false;
    return this.cells[j * FOG_CELLS + i] === 1;
  }

  encode(): string {
    let bits = '';
    for (let k = 0; k < this.cells.length; k += 8) {
      let byte = 0;
      for (let b = 0; b < 8; b++) if (this.cells[k + b]) byte |= 1 << b;
      bits += String.fromCharCode(byte);
    }
    return btoa(bits);
  }

  static decode(data: string): Fog {
    const fog = new Fog();
    try {
      const bits = atob(data);
      for (let k = 0; k < bits.length && k * 8 < fog.cells.length; k++) {
        const byte = bits.charCodeAt(k);
        for (let b = 0; b < 8; b++) if (byte & (1 << b)) fog.cells[k * 8 + b] = 1;
      }
    } catch {
      // unreadable: start unexplored
    }
    return fog;
  }

  private canvas: HTMLCanvasElement | null = null;
  private drawn = -1;
  private version = 0;

  /** Paints the fog over a map drawn at `scale` px per metre, origin at the island's corner. */
  paint(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    scale: number,
    rgb: [number, number, number],
    alpha: number,
  ): void {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = FOG_CELLS;
      this.canvas.height = FOG_CELLS;
    }
    if (this.drawn !== this.version) {
      this.drawn = this.version;
      const fctx = this.canvas.getContext('2d');
      if (fctx) {
        const img = fctx.createImageData(FOG_CELLS, FOG_CELLS);
        for (let k = 0; k < this.cells.length; k++) {
          img.data[k * 4] = rgb[0];
          img.data[k * 4 + 1] = rgb[1];
          img.data[k * 4 + 2] = rgb[2];
          img.data[k * 4 + 3] = this.cells[k] ? 0 : Math.round(alpha * 255);
        }
        fctx.putImageData(img, 0, 0);
      }
    }
    // Smoothing softens the 16 m squares into a misty edge.
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.canvas, ox, oy, WORLD * scale, WORLD * scale);
    ctx.imageSmoothingEnabled = smooth;
  }
}
