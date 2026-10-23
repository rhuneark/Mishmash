// Sheets over the game: bag and crafting, storage boxes, the cargo keypad,
// the journal and notes (the menu and settings are in Menu.tsx).

import { useState, type ReactNode } from 'react';
import { ITEMS } from '../../game/content/items';
import { NOTES, PAGES, noteText } from '../../game/content/notes';
import { POIS } from '../../game/content/pois';
import { STATION_NAMES, STATIONS, RECIPE_LIST } from '../../game/content/recipes';
import { knownCode, objectives, tagsFound } from '../../game/objectives';
import { HOTBAR, INV_SIZE } from '../../game/sim/inventory';
import type { GameClient } from '../client';
import { keyHint } from '../keys';
import { RecipeRow, StationChips } from './Craft';
import { ItemIcon, SlotButton, quickUse } from './Slots';

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
// Bag and crafting.

export function BagSheet({
  client,
  onClose,
  tab: start,
  pc,
}: {
  client: GameClient;
  onClose: () => void;
  tab: 'bag' | 'craft';
  pc: boolean;
}) {
  const [tab, setTab] = useState(start);
  return (
    <Sheet
      onClose={onClose}
      wide
      title={
        <div className="tabs">
          <button className={`tab-btn${tab === 'bag' ? ' on' : ''}`} onClick={() => setTab('bag')}>
            🎒 Bag
          </button>
          <button
            className={`tab-btn${tab === 'craft' ? ' on' : ''}`}
            onClick={() => setTab('craft')}
          >
            🔨 Craft
          </button>
        </div>
      }
    >
      {tab === 'bag' ? <BagTab client={client} pc={pc} /> : <CraftTab client={client} />}
    </Sheet>
  );
}

function BagTab({ client, pc }: { client: GameClient; pc: boolean }) {
  const me = client.me;
  const [sel, setSel] = useState<number | null>(null);
  if (!me) return null;
  const slot = sel !== null ? (me.inv[sel] ?? null) : null;
  const def = slot ? ITEMS[slot.id] : undefined;
  const grid = (from: number, to: number) => (
    <div className="slot-grid">
      {Array.from({ length: to - from }, (_, k) => {
        const i = from + k;
        return (
          <SlotButton
            key={i}
            client={client}
            slotRef={{ area: 'inv', index: i }}
            slot={me.inv[i] ?? null}
            className={`${sel === i ? 'sel' : ''}${me.held === i ? ' held' : ''}`}
            onTap={() => setSel(sel === i ? null : i)}
            onContext={() => quickUse(client, i)}
          />
        );
      })}
    </div>
  );
  return (
    <div className="bag">
      <div className="label">Hotbar</div>
      {grid(0, HOTBAR)}
      <div className="label">Bag</div>
      {grid(HOTBAR, INV_SIZE)}
      {slot && def && sel !== null ? (
        <div className="item-info">
          <div className="item-head">
            <ItemIcon id={def.id} className="item-icon" />
            <div>
              <div className="item-name">
                {def.name}
                {slot.n > 1 ? ` ×${slot.n}` : ''}
              </div>
              <div className="item-desc">{describe(def.id)}</div>
            </div>
          </div>
          <div className="item-actions">
            {(def.food || def.heal) && (
              <button className="btn small primary" onClick={() => client.eat(sel)}>
                {def.heal ? 'Use' : def.food && def.food.water > def.food.food ? 'Drink' : 'Eat'}
              </button>
            )}
            {sel < HOTBAR ? (
              <button
                className="btn small"
                onClick={() => client.select(sel)}
                disabled={me.held === sel}
              >
                {me.held === sel ? 'In hand' : 'Hold'}
              </button>
            ) : (
              <button className="btn small" onClick={() => quickUse(client, sel)}>
                To hotbar
              </button>
            )}
            {!def.quest && (
              <button
                className="btn small ghost"
                onClick={() => {
                  client.dropSlot(sel);
                  setSel(null);
                }}
              >
                Drop
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="muted small-text">
          Drag items to move them between slots. Tap one to eat it, hold it or drop it.
          {pc ? ' Right-click eats, holds or sends it to the hotbar.' : ''}
        </p>
      )}
    </div>
  );
}

function describe(id: string): string {
  const d = ITEMS[id];
  if (!d) return '';
  const bits: string[] = [d.desc];
  if (d.weapon) bits.push(`Damage ${d.weapon.damage}.`);
  if (d.food) bits.push(`+${d.food.food} food${d.food.water ? `, +${d.food.water} water` : ''}.`);
  if (d.place) bits.push('Hold it to place it.');
  return bits.join(' ');
}

function CraftTab({ client }: { client: GameClient }) {
  const st = client.stations();
  return (
    <div className="craft">
      <StationChips client={client} />
      {STATIONS.map((g) => (
        <div key={g} className="craft-group">
          <div className="label">
            {STATION_NAMES[g]}
            {!st[g] && (
              <span className="muted">
                {' '}
                ·{' '}
                {g === 'fire'
                  ? 'stand by a lit campfire'
                  : g === 'mash'
                    ? 'stand by a Mashbench (build one at a workbench)'
                    : 'stand by a workbench'}
              </span>
            )}
          </div>
          {RECIPE_LIST.filter((r) => r.station === g).map((r) => (
            <RecipeRow key={r.id} client={client} r={r} />
          ))}
        </div>
      ))}
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
  return (
    <Sheet title="📦 Storage box" onClose={onClose} wide>
      <p className="muted small-text">
        Tap to move things in or out, or drag them where you want them. Everyone on the island can
        use this box.
      </p>
      <div className="label">Box</div>
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

export function KeypadSheet({ client, onClose }: { client: GameClient; onClose: () => void }) {
  const [code, setCode] = useState('');
  const known = knownCode(client.seed, client.notes);
  const press = (d: string) => setCode((c) => (c.length >= 4 ? c : c + d));
  const submit = () => {
    if (code.length !== 4) return;
    client.enterCode(code);
    setCode('');
  };
  if (client.flags.has('cargo_open')) {
    return (
      <Sheet title="🔓 Cargo lock" onClose={onClose}>
        <p>The lock is open.</p>
      </Sheet>
    );
  }
  return (
    <Sheet title="🔒 Cargo hold lock" onClose={onClose}>
      <div className="keypad">
        <div className="keypad-screen">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i}>{code[i] ?? '·'}</span>
          ))}
        </div>
        <p className="muted small-text center">
          {tagsFound(client.notes)
            ? `From the luggage tags: ${known.split('').join(' ')}`
            : 'Four digits. Luggage tags near the crash site might have them.'}
        </p>
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

const SPOTS = new Map(POIS.flatMap((p) => p.spots.map((s) => [s.id, s] as const)));

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
  "Every 7th night is a Bloom night: fire won't keep them away. Build walls, spikes and a door.",
  'Drink from freshwater pools, coconuts and rain collectors. Food and water keep you healing.',
  'Puffers burst into poison: hit them from range or back off. Bandages cure poison.',
  'Fire bombs and torches set the Bloom on fire. The Mother Bloom hates fire.',
  'Monsters drop parts: Husk tendrils, Snapjaw teeth, Puffer spore sacs (kill it before it bursts), Thornback plates. Build a Mashbench at a workbench to turn them into special gear.',
  "Husks still carry pages of Dr. Kessler's research. Collect all 8 to learn what the Bloom is.",
  'A bedroll sets where you wake up after you fall. Your bag stays where you dropped.',
];

export function JournalSheet({ client, onClose }: { client: GameClient; onClose: () => void }) {
  const list = objectives({
    flags: client.flags,
    notes: client.notes,
    carrying: client.carrying(),
    rescue: client.rescue,
  });
  const notes = [...client.notes].filter((id) => SPOTS.has(id));
  const pages = PAGES.filter((id) => client.notes.has(id));
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
        {TIPS.map((t) => (
          <li key={t}>{t}</li>
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
  const text = noteText(note.id, client.seed, spot?.kind === 'tag' ? spot.digit : undefined);
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
