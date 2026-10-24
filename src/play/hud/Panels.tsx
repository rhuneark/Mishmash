// Sheets over the game: storage boxes, the keypads, the journal and notes (the survivor
// menu is in Character.tsx, the pause menu and settings in Menu.tsx).

import { useState, type ReactNode } from 'react';
import { NOTES, PAGES, noteText } from '../../game/content/notes';
import { bloomOrdinal } from '../../game/rules';
import { POIS } from '../../game/content/pois';
import { SECRETS, TREASURES, bunkerCode } from '../../game/content/secrets';
import { knownCode, objectives, tagsFound } from '../../game/objectives';
import type { GameClient } from '../client';
import { keyHint } from '../keys';
import { SlotButton } from './Slots';

function Sheet({
  title,
  onClose,
  children,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet${wide ? ' wide' : ''}`}
        data-panel="sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button className="round-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Storage box.

export function StorageSheet({ client, onClose }: { client: GameClient; onClose: () => void }) {
  const box = client.storageId !== null ? client.buildings.get(client.storageId) : undefined;
  const me = client.me;
  if (!box?.inv || !me) {
    return (
      <Sheet title="📦 Storage box" onClose={onClose}>
        <p className="muted">The box is gone.</p>
      </Sheet>
    );
  }
  const shared = client.rules.sharedChests;
  return (
    <Sheet title={shared ? '📦 Connected storage' : '📦 Storage box'} onClose={onClose} wide>
      <p className="muted small-text">
        Tap to move things in or out, or drag them where you want them.{' '}
        {shared
          ? 'Every storage box on the island opens this same storage.'
          : 'Everyone on the island can use this box.'}
        {client.rules.craftFromChests && ' Crafting can use what is in here, wherever you are.'}
      </p>
      <div className="label">{shared ? 'Storage' : 'Box'}</div>
      <div className="slot-grid">
        {box.inv.map((s, i) => (
          <SlotButton
            key={i}
            client={client}
            slotRef={{ area: 'box', index: i }}
            slot={s}
            onTap={() => client.take(i)}
            onContext={() => client.take(i)}
          />
        ))}
      </div>
      <div className="label">Your bag</div>
      <div className="slot-grid">
        {me.inv.map((s, i) => (
          <SlotButton
            key={i}
            client={client}
            slotRef={{ area: 'inv', index: i }}
            slot={s}
            className={me.held === i ? 'held' : ''}
            onTap={() => client.store(i)}
            onContext={() => client.store(i)}
          />
        ))}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The cargo hold's lock.

/** Survey marker plates found so far (the bunker code). */
const MARKER_SPOTS = ['marker_a_plate', 'marker_b_plate', 'marker_c_plate', 'marker_d_plate'];

export function KeypadSheet({ client, onClose }: { client: GameClient; onClose: () => void }) {
  const [code, setCode] = useState('');
  const lock = client.keypadLock;
  const press = (d: string) => setCode((c) => (c.length >= 4 ? c : c + d));
  const submit = () => {
    if (code.length !== 4) return;
    client.enterCode(code);
    setCode('');
  };
  const title =
    lock === 'bunker' ? 'Bunker door' : lock === 'wreck' ? "Captain's safe" : 'Cargo hold lock';
  if (client.flags.has(`${lock}_open`)) {
    return (
      <Sheet title={`🔓 ${title}`} onClose={onClose}>
        <p>It's open.</p>
      </Sheet>
    );
  }
  if (lock === 'bunker' && !client.flags.has('bunker_power')) {
    return (
      <Sheet title={`🔒 ${title}`} onClose={onClose}>
        <p>The keypad is dark. The generator next to the door has no fuel.</p>
      </Sheet>
    );
  }
  let hint: string;
  if (lock === 'bunker') {
    const found = MARKER_SPOTS.filter((id) => client.notes.has(id)).length;
    const digits = bunkerCode(client.seed)
      .split('')
      .map((d, i) => (client.notes.has(MARKER_SPOTS[i] as string) ? d : '_'));
    hint = found
      ? `From the survey markers: ${digits.join(' ')}`
      : 'Four digits. One is on each Verdance survey marker, A to D.';
  } else if (lock === 'wreck') {
    hint = 'A heavy dial safe, four digits. The captain must have written it down somewhere.';
  } else {
    const known = knownCode(client.seed, client.notes);
    hint = tagsFound(client.notes)
      ? `From the luggage tags: ${known.split('').join(' ')}`
      : 'Four digits. Luggage tags near the crash site might have them.';
  }
  return (
    <Sheet title={`🔒 ${title}`} onClose={onClose}>
      <div className="keypad">
        <div className="keypad-screen">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i}>{code[i] ?? '·'}</span>
          ))}
        </div>
        <p className="muted small-text center">{hint}</p>
        <div className="keypad-keys">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} className="key" onClick={() => press(d)}>
              {d}
            </button>
          ))}
          <button className="key" onClick={() => setCode('')}>
            ⌫
          </button>
          <button className="key" onClick={() => press('0')}>
            0
          </button>
          <button className="key go" onClick={submit} disabled={code.length !== 4}>
            Open
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Journal and notes.

const SPOTS = new Map([...POIS, ...SECRETS].flatMap((p) => p.spots.map((s) => [s.id, s] as const)));

/** The note behind something found: a spot on the island or a research page. */
function noteFor(found: string) {
  const spot = SPOTS.get(found);
  if (spot) return { note: spot.note ? NOTES[spot.note] : undefined, spot };
  return { note: NOTES[found], spot: undefined };
}

const TIPS = [
  'Pick up branches and loose stones, pull fiber from bushes. Twist fiber into rope.',
  'A stone axe and pickaxe come first (🎒 › Craft). Hold a tool in your hotbar to use it.',
  'Build a campfire before dark. The taken fear fire, it heals you, and it cooks food. Feed it wood.',
  "Every {nth} night is a Bloom night: fire won't keep them away. Build walls, spikes and a door.",
  'Drink from freshwater pools, coconuts and rain collectors. Food and water keep you healing.',
  'Puffers burst into poison: hit them from range or back off. Bandages cure poison.',
  'Fire bombs and torches set the Bloom on fire. The Mother Bloom hates fire.',
  'Monsters drop parts: Husk tendrils, Snapjaw teeth, Puffer spore sacs (kill it before it bursts), Thornback plates. Build a Mashbench at a workbench to turn them into special gear.',
  "Husks still carry pages of Dr. Kessler's research. Collect all 8 to learn what the Bloom is.",
  'A bedroll sets where you wake up after you fall. Your bag stays where you dropped.',
  'Build mode (🔨) pays for each piece from your bag. Floors, roofs and furniture make a real home.',
  'Garden plots grow seeds while watered. Rain does it for you; a roof over a plot keeps it dry.',
  'Feed an island animal its favourite food a few times and it will follow you.',
  'Bows need arrows: wood, stone and feathers (or fiber). Fire arrows set the Bloom burning.',
  'Low water at the wreck is from 04:00 to 08:00 and from 16:00 to 20:00.',
];

export function JournalSheet({ client, onClose }: { client: GameClient; onClose: () => void }) {
  const list = objectives({
    flags: client.flags,
    notes: client.notes,
    carrying: client.carrying(),
    rescue: client.rescue,
    parts: client.island?.spec,
  });
  const notes = [...client.notes].filter((id) => SPOTS.has(id));
  const every = client.rules.bloomEvery;
  const pages = PAGES.filter((id) => client.notes.has(id));
  const maps = Array.from({ length: TREASURES }, (_, i) => i + 1).filter((n) =>
    client.notes.has(`treasure_${n}`),
  );
  const tags = tagsFound(client.notes);
  const open = (id: string) => {
    client.noteId = id;
    client.noteBack = 'journal';
    client.openPanel('note');
  };
  return (
    <Sheet title="📖 Journal" onClose={onClose}>
      <div className="label">Getting off the island</div>
      <ul className="objectives">
        {list.map((o) => (
          <li key={o.id} className={o.done ? 'done' : ''}>
            <span>{o.done ? '✅' : '⬜'}</span> {o.text}
          </li>
        ))}
      </ul>
      {tags > 0 && !client.flags.has('cargo_open') && (
        <p className="code-line">
          Cargo code so far: <b>{knownCode(client.seed, client.notes).split('').join(' ')}</b>
        </p>
      )}
      <div className="label">Notes found ({notes.length})</div>
      {notes.length === 0 && (
        <p className="muted small-text">Nothing yet. Look for glowing papers.</p>
      )}
      <div className="note-list">
        {notes.map((id) => {
          const { note, spot } = noteFor(id);
          return (
            <button key={id} className="note-row" onClick={() => open(id)}>
              📄 {note?.title ?? 'Note'}
              {spot?.kind === 'tag' && spot.digit !== undefined ? ` (${spot.digit + 1}/4)` : ''}
            </button>
          );
        })}
      </div>
      {maps.length > 0 && (
        <>
          <div className="label">
            Treasure maps ({maps.length}/{TREASURES})
          </div>
          <div className="note-list">
            {maps.map((n) => (
              <button key={n} className="note-row" onClick={() => open(`treasure_${n}`)}>
                {client.flags.has(`dug:${n}`) ? '✅' : '🗺️'}{' '}
                {NOTES[`treasure_${n}`]?.title ?? 'Map'}
                {client.flags.has(`dug:${n}`) ? ' (dug up)' : ''}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="label">
        Dr. Kessler's research ({pages.length}/{PAGES.length})
      </div>
      {pages.length === 0 && (
        <p className="muted small-text">The Husks carry the pages. Some of them, anyway.</p>
      )}
      <div className="note-list">
        {pages.map((id) => (
          <button key={id} className="note-row" onClick={() => open(id)}>
            🧪 {NOTES[id]?.title ?? 'Page'}
          </button>
        ))}
      </div>
      <div className="label">Survival tips</div>
      <ul className="tips">
        {TIPS.filter((t) => every > 0 || !t.includes('{nth}')).map((t) => (
          <li key={t}>{t.replace('{nth}', bloomOrdinal(every))}</li>
        ))}
      </ul>
    </Sheet>
  );
}

export function NoteSheet({ client, onClose }: { client: GameClient; onClose: () => void }) {
  const { note, spot } = client.noteId
    ? noteFor(client.noteId)
    : { note: undefined, spot: undefined };
  if (!note) return null;
  const text = noteText(
    note.id,
    client.seed,
    spot?.kind === 'tag' ? spot.digit : undefined,
    client.island ? { parts: client.island.spec, bloomEvery: client.rules.bloomEvery } : undefined,
  );
  return (
    <Sheet title={`📄 ${note.title}`} onClose={onClose}>
      <div className="note-paper">
        {text.split('\n\n').map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {note.reveals?.length ? (
        <p className="muted small-text">New places are marked on your map.</p>
      ) : null}
    </Sheet>
  );
}

export { keyHint };
