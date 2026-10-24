// The way off the island as a checklist, worked out from shared progress
// (flags, notes read) and what the player carries.

import { cargoCode } from './content/notes';
import { turnDirections, type IslandParts } from './islands';
import type { RescueNet } from './sim/protocol';

export interface Objective {
  id: string;
  text: string;
  done: boolean;
  /** Landmark it points to (map marker). */
  poi?: string;
  /** The quest it belongs to (the HUD's quest list groups them). */
  chapter?: Chapter;
  /** A short line for the quest list. */
  short?: string;
}

export type Chapter = 'crash' | 'parts' | 'rescue';

export const CHAPTER_TITLES: Record<Chapter, string> = {
  crash: '✈️ Survivors of MX207',
  parts: '📻 Three radio parts',
  rescue: '🚁 Call for rescue',
};

/** A quest in the HUD's list: a title and its steps. */
export interface Quest {
  id: string;
  title: string;
  steps: { id: string; text: string; done: boolean }[];
}

export interface Progress {
  flags: ReadonlySet<string>;
  notes: ReadonlySet<string>;
  /** Item ids the player carries. */
  carrying: ReadonlySet<string>;
  rescue: RescueNet;
  /** The island's layout (directions in the texts turn with it). */
  parts?: IslandParts;
}

/** Digits of the cargo code found so far ('_' for unknown). */
export function knownCode(seed: number, notes: ReadonlySet<string>): string {
  const code = cargoCode(seed);
  let out = '';
  for (let i = 0; i < 4; i++) out += notes.has(`tag_${i}`) ? (code[i] ?? '_') : '_';
  return out;
}

export function tagsFound(notes: ReadonlySet<string>): number {
  let n = 0;
  for (let i = 0; i < 4; i++) if (notes.has(`tag_${i}`)) n++;
  return n;
}

export function objectives(p: Progress): Objective[] {
  const list = checklist(p);
  const parts = p.parts;
  return parts
    ? list.map((o) => ({
        ...o,
        text: turnDirections(o.text, parts),
        ...(o.short ? { short: turnDirections(o.short, parts) } : {}),
      }))
    : list;
}

/** The way off as quests: the chapter you're on, its steps ticked off as you go. */
export function mainQuest(list: Objective[]): Quest | null {
  const now = list.find((o) => !o.done) ?? list[list.length - 1];
  if (!now?.chapter) return null;
  const chapter = now.chapter;
  return {
    id: chapter,
    title: CHAPTER_TITLES[chapter],
    steps: list
      .filter((o) => o.chapter === chapter)
      .map((o) => ({ id: o.id, text: o.short ?? o.text, done: o.done })),
  };
}

/** What a new survivor sets up on the first days. */
export interface StarterProgress {
  axe: boolean;
  campfire: boolean;
  bedroll: boolean;
  day: number;
}

/** The first-night quest: until it's done, and only on the first days. */
export function starterQuest(p: StarterProgress): Quest | null {
  const steps = [
    { id: 'axe', text: 'Craft a stone axe', done: p.axe },
    { id: 'campfire', text: 'Build a campfire before dark (🔨)', done: p.campfire },
    { id: 'bedroll', text: 'Put down a bedroll or a bed', done: p.bedroll },
  ];
  if (p.day > 3 || steps.every((s) => s.done)) return null;
  return { id: 'starter', title: '🔥 The first night', steps };
}

/**
 * A card for a secret you've come across (the bunker, the wreck, a treasure map): one at a
 * time, the treasure first, so the HUD stays tidy.
 */
export function secretQuest(p: Progress & { treasures: number }): Quest | null {
  const f = p.flags;
  const n = p.notes;
  if (p.treasures > 0) {
    return {
      id: 'treasure',
      title: '🗺️ Buried treasure',
      steps: [
        { id: 'shovel', text: 'Make a shovel at a workbench', done: p.carrying.has('shovel') },
        {
          id: 'dig',
          text: `Dig where the X is on your map${p.treasures > 1 ? ` (${p.treasures} left)` : ''}`,
          done: false,
        },
      ],
    };
  }
  if (f.has('seen:wreck') && !f.has('wreck_open')) {
    return {
      id: 'wreck',
      title: '⚓ The Marisol',
      steps: [
        { id: 'log', text: "Read the ship's log", done: n.has('wreck_log') },
        { id: 'plate', text: 'Find her hull number on the bow', done: n.has('wreck_plate') },
        { id: 'safe', text: 'Open the safe at low tide (04–08, 16–20)', done: false },
      ],
    };
  }
  if (f.has('seen:bunker') && !f.has('bunker_open')) {
    const markers = ['a', 'b', 'c', 'd'].filter((k) => n.has(`marker_${k}_plate`)).length;
    return {
      id: 'bunker',
      title: '🚪 The Verdance bunker',
      steps: [
        { id: 'sign', text: 'Read the sign by the door', done: n.has('bunker_sign') },
        { id: 'markers', text: `Find the survey markers (${markers}/4)`, done: markers === 4 },
        { id: 'power', text: 'Fuel the generator (3 Bloom sap)', done: f.has('bunker_power') },
        { id: 'code', text: 'Enter the code at the door', done: false },
      ],
    };
  }
  return null;
}

function checklist(p: Progress): Objective[] {
  const f = p.flags;
  const has = (id: string) => p.carrying.has(id);
  const list: Objective[] = [];
  const searched = p.notes.has('crash_note');
  list.push({
    id: 'crash',
    text: 'Search the wreckage at the crash site',
    short: 'Search the wreckage',
    done: searched,
    poi: 'crash',
    chapter: 'crash',
  });
  if (!searched) return list;
  const log = p.notes.has('cockpit_log');
  list.push({
    id: 'cockpit',
    text: 'Find the cockpit in the jungle to the north-west',
    short: 'Find the cockpit (north-west)',
    done: log,
    poi: 'cockpit',
    chapter: 'crash',
  });
  if (!log) return list;
  const radio = f.has('radio_built') || has('radio');
  const tags = tagsFound(p.notes);
  list.push({
    id: 'battery',
    text: f.has('cargo_open')
      ? 'Battery: taken from the cargo hold'
      : `Battery: open the cargo hold at the tail section (west). The code is on 4 luggage tags around the crash site (${tags}/4)`,
    short: f.has('cargo_open')
      ? 'Battery from the cargo hold'
      : `Battery: open the cargo hold (west), code tags ${tags}/4`,
    done: f.has('cargo_open') || has('battery') || radio,
    poi: 'tail',
    chapter: 'parts',
  });
  list.push({
    id: 'antenna',
    text: f.has('antenna_taken')
      ? 'Antenna: taken from the radio tower'
      : 'Antenna: cut the Bloom vines at the radio tower (north-east, needs a machete) and climb it',
    short: f.has('antenna_taken')
      ? 'Antenna from the radio tower'
      : 'Antenna: cut the vines at the radio tower (north-east)',
    done: f.has('antenna_taken') || has('antenna') || radio,
    poi: 'tower',
    chapter: 'parts',
  });
  list.push({
    id: 'transmitter',
    text: f.has('mother_dead')
      ? "Transmitter: lies in the Mother Bloom's remains at Kessler Station"
      : 'Transmitter: destroy the Mother Bloom at Kessler Station (east marsh). Fire hurts it',
    short: f.has('mother_dead')
      ? "Transmitter: in the Mother Bloom's remains"
      : 'Transmitter: kill the Mother Bloom (east marsh)',
    done: has('transmitter') || radio,
    poi: 'station',
    chapter: 'parts',
  });
  const parts = f.has('cargo_open') && f.has('antenna_taken') && f.has('mother_dead');
  if (!parts && !radio) return list;
  list.push({
    id: 'radio',
    text: 'Build the emergency radio at a workbench',
    short: 'Build the radio at a workbench',
    done: radio,
    chapter: 'parts',
  });
  if (!radio) return list;
  const called = f.has('radio_called');
  list.push({
    id: 'call',
    text: 'Call for rescue at the beacon by the radio tower',
    short: 'Call from the beacon by the tower',
    done: called,
    poi: 'tower',
    chapter: 'rescue',
  });
  if (!called) return list;
  const phase = p.rescue.phase;
  if (phase === 'gone') {
    list.push({
      id: 'again',
      text: 'The helicopter left. Call again from the beacon',
      short: 'Call again from the beacon',
      done: false,
      poi: 'tower',
      chapter: 'rescue',
    });
    return list;
  }
  list.push({
    id: 'hold',
    text: 'Hold out until the helicopter lands',
    short: 'Hold out until it lands',
    done: phase === 'landed' || f.has('escaped'),
    chapter: 'rescue',
  });
  list.push({
    id: 'board',
    text: 'Board the helicopter on the helipad',
    short: 'Board the helicopter',
    done: f.has('escaped'),
    poi: 'tower',
    chapter: 'rescue',
  });
  return list;
}

/** The first unfinished objective (the HUD shows it). */
export function currentObjective(p: Progress): Objective | null {
  return objectives(p).find((o) => !o.done) ?? null;
}
