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
  return parts ? list.map((o) => ({ ...o, text: turnDirections(o.text, parts) })) : list;
}

function checklist(p: Progress): Objective[] {
  const f = p.flags;
  const has = (id: string) => p.carrying.has(id);
  const list: Objective[] = [];
  const searched = p.notes.has('crash_note');
  list.push({
    id: 'crash',
    text: 'Search the wreckage at the crash site',
    done: searched,
    poi: 'crash',
  });
  if (!searched) return list;
  const log = p.notes.has('cockpit_log');
  list.push({
    id: 'cockpit',
    text: 'Find the cockpit in the jungle to the north-west',
    done: log,
    poi: 'cockpit',
  });
  if (!log) return list;
  const radio = f.has('radio_built') || has('radio');
  const tags = tagsFound(p.notes);
  list.push({
    id: 'battery',
    text: f.has('cargo_open')
      ? 'Battery: taken from the cargo hold'
      : `Battery: open the cargo hold at the tail section (west). The code is on 4 luggage tags around the crash site (${tags}/4)`,
    done: f.has('cargo_open') || has('battery') || radio,
    poi: 'tail',
  });
  list.push({
    id: 'antenna',
    text: f.has('antenna_taken')
      ? 'Antenna: taken from the radio tower'
      : 'Antenna: cut the Bloom vines at the radio tower (north-east, needs a machete) and climb it',
    done: f.has('antenna_taken') || has('antenna') || radio,
    poi: 'tower',
  });
  list.push({
    id: 'transmitter',
    text: f.has('mother_dead')
      ? "Transmitter: lies in the Mother Bloom's remains at Kessler Station"
      : 'Transmitter: destroy the Mother Bloom at Kessler Station (east marsh). Fire hurts it',
    done: has('transmitter') || radio,
    poi: 'station',
  });
  const parts = f.has('cargo_open') && f.has('antenna_taken') && f.has('mother_dead');
  if (!parts && !radio) return list;
  list.push({ id: 'radio', text: 'Build the emergency radio at a workbench', done: radio });
  if (!radio) return list;
  const called = f.has('radio_called');
  list.push({
    id: 'call',
    text: 'Call for rescue at the beacon by the radio tower',
    done: called,
    poi: 'tower',
  });
  if (!called) return list;
  const phase = p.rescue.phase;
  if (phase === 'gone') {
    list.push({
      id: 'again',
      text: 'The helicopter left. Call again from the beacon',
      done: false,
      poi: 'tower',
    });
    return list;
  }
  list.push({
    id: 'hold',
    text: 'Hold out until the helicopter lands',
    done: phase === 'landed' || f.has('escaped'),
  });
  list.push({
    id: 'board',
    text: 'Board the helicopter on the helipad',
    done: f.has('escaped'),
    poi: 'tower',
  });
  return list;
}

/** The first unfinished objective (the HUD shows it). */
export function currentObjective(p: Progress): Objective | null {
  return objectives(p).find((o) => !o.done) ?? null;
}
