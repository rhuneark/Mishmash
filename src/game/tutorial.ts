// Survival basics: the guided first steps, like the starter quest chains of other survival
// games. One step at a time, each a plain thing to do with how to do it (on a phone and on a
// PC), something on the island to go to, and a little XP when it's done; the last one hands
// over to the way off the island. The client shows it and points the way; the island's
// authority checks each step (the ones it can see) and pays it once.

import { NODE } from './content/nodes';
import { ITEMS } from './content/items';
import { BUILDINGS } from './content/buildings';
import { count, type Inv } from './sim/inventory';
import type { Slot } from './sim/protocol';

/** What a step's check looks at: the same on the authority and on the phone. */
export interface TutView {
  inv: Inv;
  notes: ReadonlySet<string>;
  /** Kinds of the pieces this survivor has built. */
  built: ReadonlySet<string>;
  /** What only the phone sees (walking, eating, "got it"); the authority takes the word for it. */
  did: ReadonlySet<string>;
}

/** Where the step sends you: a landmark spot, or the nearest node of these kinds. */
export type TutTarget = { kind: 'spot'; id: string } | { kind: 'node'; types: number[] } | null;

/** Which button the step lights up (the client decides what's on screen right now). */
export type TutAction = 'walk' | 'use' | 'craft' | 'build' | 'eat' | 'ok';

export interface TutStep {
  id: string;
  icon: string;
  title: string;
  /** How, on a touch screen and with keys and a mouse. */
  touch: string;
  pc: string;
  xp: number;
  action: TutAction;
  /** Crafting steps: the recipe; building steps: the piece and its build-menu tab. */
  recipe?: string;
  piece?: string;
  done(v: TutView): boolean;
  /** Only the phone can tell (walking, eating): the authority pays it on the player's word. */
  trust?: boolean;
  /** How far along, e.g. "Wood 2/3 · Stone 0/2". */
  progress?(v: TutView): string;
  target?(v: TutView): TutTarget;
}

const TREES = [NODE.palm, NODE.jungle, NODE.pine];
const BUSHES = [NODE.bush, NODE.berry];

const has = (v: TutView, id: string) => count(v.inv, id);
const of = (n: number, need: number) => `${Math.min(n, need)}/${need}`;

/** Something in the bag to eat or drink. */
export function hasFood(inv: Inv): boolean {
  return inv.some((s) => !!s && !!ITEMS[s.id]?.food);
}

function hasAxe(inv: Inv): boolean {
  return inv.some((s) => !!s && ITEMS[s.id]?.tool?.kind === 'axe');
}

/** A bedroll or a bed (anything you wake up at). */
function hasBed(v: TutView): boolean {
  for (const k of v.built) if (BUILDINGS[k]?.spawn) return true;
  return false;
}

export const TUTORIAL: TutStep[] = [
  {
    id: 'walk',
    icon: '👣',
    title: 'Find your feet',
    touch: 'Drag on the left side of the screen to walk, or tap the ground to walk there.',
    pc: 'Walk with W A S D or the arrow keys. Hold Shift to run.',
    xp: 10,
    action: 'walk',
    trust: true,
    done: (v) => v.did.has('walk'),
  },
  {
    id: 'note',
    icon: '📄',
    title: 'Search the wreckage',
    touch: 'Walk to the glowing note by the plane and tap the big ✋ button to read it.',
    pc: 'Walk to the glowing note by the plane and press E or Space (or click it) to read it.',
    xp: 15,
    action: 'use',
    done: (v) => v.notes.has('crash_note'),
    target: () => ({ kind: 'spot', id: 'crash_note' }),
  },
  {
    id: 'sticks',
    icon: '🪵',
    title: 'Sticks and stones',
    touch: 'Pick up fallen branches and loose stones: walk up to one and tap ✋.',
    pc: 'Pick up fallen branches and loose stones: walk up to one and press E.',
    xp: 15,
    action: 'use',
    done: (v) => (has(v, 'wood') >= 3 && has(v, 'stone') >= 2) || hasAxe(v.inv),
    progress: (v) => `Wood ${of(has(v, 'wood'), 3)} · Stone ${of(has(v, 'stone'), 2)}`,
    target: (v) => ({ kind: 'node', types: [has(v, 'wood') < 3 ? NODE.branch : NODE.pebble] }),
  },
  {
    id: 'fiber',
    icon: '🌿',
    title: 'Plant fiber',
    touch: 'Pull fiber from a bush: walk up to it and tap ✋.',
    pc: 'Pull fiber from a bush: walk up to it and press E.',
    xp: 15,
    action: 'use',
    done: (v) => has(v, 'fiber') >= 2 || hasAxe(v.inv),
    progress: (v) => `Fiber ${of(has(v, 'fiber'), 2)}`,
    target: () => ({ kind: 'node', types: BUSHES }),
  },
  {
    id: 'axe',
    icon: '🪓',
    title: 'Your first tool',
    touch: 'Tap 🎒, open 🔨 Crafting, pick the Stone axe and tap Craft.',
    pc: 'Press C (or 🎒, then 🔨 Crafting), pick the Stone axe and click Craft.',
    xp: 25,
    action: 'craft',
    recipe: 'axe_stone',
    done: (v) => hasAxe(v.inv),
  },
  {
    id: 'chop',
    icon: '🌴',
    title: 'Timber!',
    touch: 'Chop a tree: walk up to it and hold ✋. The axe comes out by itself.',
    pc: 'Chop a tree: walk up to it and hold E. The axe comes out by itself.',
    xp: 20,
    action: 'use',
    done: (v) => has(v, 'wood') >= 5 || v.built.has('campfire'),
    progress: (v) => `Wood ${of(has(v, 'wood'), 5)}`,
    target: () => ({ kind: 'node', types: TREES }),
  },
  {
    id: 'stones',
    icon: '🪨',
    title: 'Stones for a fire pit',
    touch: 'Pick up loose stones with ✋.',
    pc: 'Pick up loose stones with E.',
    xp: 10,
    action: 'use',
    done: (v) => has(v, 'stone') >= 4 || v.built.has('campfire'),
    progress: (v) => `Stone ${of(has(v, 'stone'), 4)}`,
    target: () => ({ kind: 'node', types: [NODE.pebble] }),
  },
  {
    id: 'campfire',
    icon: '🔥',
    title: 'Light a fire before dark',
    touch:
      "Tap 🔨, pick the Campfire and tap the big button to put it down. Tap 🔨 again when you're done.",
    pc: "Press V (or 🔨), pick the Campfire and click where it goes. Press V again when you're done.",
    xp: 30,
    action: 'build',
    piece: 'campfire',
    done: (v) => v.built.has('campfire'),
  },
  {
    id: 'eat',
    icon: '🍖',
    title: 'Keep your strength up',
    touch: 'Food 🍖 and water 💧 run down. Tap the ration in your hotbar, then tap ✋ to eat it.',
    pc: 'Food 🍖 and water 💧 run down. Pick the ration with its number key and press F to eat it.',
    xp: 10,
    action: 'eat',
    trust: true,
    // Nothing left to eat: there's nothing to learn here yet.
    done: (v) => v.did.has('eat') || !hasFood(v.inv),
  },
  {
    id: 'cloth',
    icon: '🧳',
    title: 'Rummage through the luggage',
    touch: 'Search the suitcases around the crash for cloth: walk up and tap ✋.',
    pc: 'Search the suitcases around the crash for cloth: walk up and press E.',
    xp: 15,
    action: 'use',
    done: (v) => has(v, 'cloth') >= 2 || hasBed(v),
    progress: (v) => `Cloth ${of(has(v, 'cloth'), 2)}`,
    target: () => ({ kind: 'node', types: [NODE.luggage] }),
  },
  {
    id: 'bedroll',
    icon: '🛏️',
    title: 'A place to sleep',
    touch:
      'Pull 8 fiber from bushes, then tap 🔨 and build a Bedroll. If the Bloom gets you, you wake up there.',
    pc: 'Pull 8 fiber from bushes, then press V and build a Bedroll. If the Bloom gets you, you wake up there.',
    xp: 30,
    action: 'build',
    piece: 'bedroll',
    done: hasBed,
    progress: (v) => `Fiber ${of(has(v, 'fiber'), 8)} · Cloth ${of(has(v, 'cloth'), 2)}`,
    target: (v) => (has(v, 'fiber') < 8 ? { kind: 'node', types: BUSHES } : null),
  },
  {
    id: 'end',
    icon: '🧭',
    title: 'Now find a way off',
    touch:
      "That's the basics. 📖 The journal shows what's next: start at the cockpit, north-west of the crash. Survive the nights by your fire.",
    pc: "That's the basics. 📖 The journal (J) shows what's next: start at the cockpit, north-west of the crash. Survive the nights by your fire.",
    xp: 25,
    action: 'ok',
    trust: true,
    done: (v) => v.did.has('end'),
  },
];

/** Past the last step: finished (or skipped). */
export const TUT_DONE = TUTORIAL.length;

/** What finishing the tutorial gives, with its XP. */
export const TUT_GIFT: Slot[] = [
  { id: 'bandage', n: 2 },
  { id: 'torch', n: 1 },
];

/** A saved step (untrusted): 0 … TUT_DONE. */
export function parseTut(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(TUT_DONE, Math.floor(v)));
}

/** Which kinds of pieces a survivor has built. */
export function builtBy(
  buildings: Iterable<{ kind: string; owner: string }>,
  who: string,
): Set<string> {
  const out = new Set<string>();
  for (const b of buildings) if (b.owner === who) out.add(b.kind);
  return out;
}
