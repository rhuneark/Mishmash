// The island for a spec, generated on this device (the last one is kept: making one takes
// a moment). The title backdrop, the New island preview and the game share it.

import { specKey, type IslandSpec } from '../game/islands';
import { generateIsland, type Island } from '../game/world';

let cached: Island | null = null;

/** The island for a spec (generating one takes a moment; the last is kept). */
export function islandFor(spec: IslandSpec): Island {
  if (!cached || specKey(cached.spec) !== specKey(spec)) cached = generateIsland(spec.seed, spec);
  return cached;
}
