// Sheets over the game: bag and crafting, storage boxes, the cargo keypad,
// the journal, notes and the menu.

import { useState, type ReactNode } from 'react';
import { ITEMS } from '../../game/content/items';
import { NOTES, noteText } from '../../game/content/notes';
import { POIS } from '../../game/content/pois';
import { RECIPE_LIST, STATION_NAMES, type Station } from '../../game/content/recipes';
import { knownCode, objectives, tagsFound } from '../../game/objectives';
import { HOTBAR, INV_SIZE } from '../../game/sim/inventory';
import type { Slot } from '../../game/sim/protocol';
import type { Sound } from '../audio';
import type { GameClient } from '../client';
import { SlotView } from './Hud';

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
      <div className={`sheet${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()}>
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
}: {
  client: GameClient;
  onClose: () => void;
  tab: 'bag' | 'craft';
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
      {tab === 'bag' ? <BagTab client={client} /> : <CraftTab client={client} />}
    </Sheet>
  );
}

function BagTab({ client }: { client: GameClient }) {
  const me = client.me;
  const [sel, setSel] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  if (!me) return null;
  const slot = sel !== null ? (me.inv[sel] ?? null) : null;
  const def = slot ? ITEMS[slot.id] : undefined;
  const tap = (i: number) => {
    if (moving && sel !== null) {
      client.moveSlot(sel, i);
      setMoving(false);
      setSel(i);
      return;
    }
    setSel(sel === i ? null : i);
  };
  const toHotbar = () => {
    if (sel === null) return;
    let to = me.inv.findIndex((s, i) => i < HOTBAR && !s);
    if (to < 0) to = me.held;
    client.moveSlot(sel, to);
    setSel(to);
  };
  return (
    <div className="bag">
      <div className="label">Hotbar</div>
      <SlotGrid
        slots={me.inv.slice(0, HOTBAR)}
        offset={0}
        sel={sel}
        held={me.held}
        onTap={tap}
        moving={moving}
      />
      <div className="label">Bag</div>
      <SlotGrid
        slots={me.inv.slice(HOTBAR, INV_SIZE)}
        offset={HOTBAR}
        sel={sel}
        onTap={tap}
        moving={moving}
      />
      {slot && def && sel !== null ? (
        <div className="item-info">
          <div className="item-head">
            <span className="item-icon">{def.icon}</span>
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
              <button className="btn small" onClick={toHotbar}>
                To hotbar
              </button>
            )}
            <button
              className={`btn small${moving ? ' primary' : ''}`}
              onClick={() => setMoving(!moving)}
            >
              {moving ? 'Tap a slot…' : 'Move'}
            </button>
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
          Tap an item to eat it, hold it or move it. Things in the hotbar can be held.
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

function SlotGrid(props: {
  slots: (Slot | null)[];
  offset: number;
  sel: number | null;
  held?: number;
  moving?: boolean;
  onTap: (i: number) => void;
}) {
  return (
    <div className="slot-grid">
      {props.slots.map((s, k) => {
        const i = props.offset + k;
        return (
          <button
            key={i}
            className={`slot${props.sel === i ? ' sel' : ''}${props.held === i ? ' held' : ''}${props.moving && props.sel !== i ? ' target' : ''}`}
            onClick={() => props.onTap(i)}
            aria-label={s ? ITEMS[s.id]?.name : 'Empty slot'}
          >
            <SlotView slot={s} />
          </button>
        );
      })}
    </div>
  );
}

function CraftTab({ client }: { client: GameClient }) {
  const st = client.stations();
  const groups: Station[] = ['hand', 'fire', 'bench'];
  return (
    <div className="craft">
      <div className="station-chips">
        {groups.map((g) => (
          <span key={g} className={`chip${st[g] ? ' ok' : ''}`}>
            {st[g] ? '✓' : '✗'} {STATION_NAMES[g]}
          </span>
        ))}
      </div>
      {groups.map((g) => (
        <div key={g} className="craft-group">
          <div className="label">
            {STATION_NAMES[g]}
            {!st[g] && (
              <span className="muted">
                {' '}
                · {g === 'fire' ? 'stand by a lit campfire' : 'stand by a workbench'}
              </span>
            )}
          </div>
          {RECIPE_LIST.filter((r) => r.station === g).map((r) => {
            const out = ITEMS[r.out];
            const ok = client.canCraft(r.id);
            return (
              <div key={r.id} className={`recipe${ok ? ' ok' : ''}`}>
                <span className="recipe-icon">{out?.icon}</span>
                <div className="recipe-text">
                  <div className="recipe-name">
                    {out?.name}
                    {r.n > 1 ? ` ×${r.n}` : ''}
                  </div>
                  <div className="recipe-needs">
                    {Object.entries(r.needs).map(([id, n]) => {
                      const have = client.count(id);
                      return (
                        <span key={id} className={have >= n ? 'have' : 'need'}>
                          {ITEMS[id]?.icon} {Math.min(have, n)}/{n}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <button
                  className="btn small primary"
                  disabled={!ok}
                  onClick={() => client.craft(r.id)}
                >
                  Craft
                </button>
              </div>
            );
          })}
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
        Tap to move things in or out. Everyone on the island can use this box.
      </p>
      <div className="label">Box</div>
      <SlotGrid slots={box.inv} offset={0} sel={null} onTap={(i) => client.take(i)} />
      <div className="label">Your bag</div>
      <SlotGrid
        slots={me.inv}
        offset={0}
        sel={null}
        held={me.held}
        onTap={(i) => client.store(i)}
      />
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

const TIPS = [
  'Pick up branches and loose stones, pull fiber from bushes. Twist fiber into rope.',
  'A stone axe and pickaxe come first (Bag › Craft). Hold a tool in your hotbar to use it.',
  'Build a campfire before dark. The taken fear fire, it heals you, and it cooks food. Feed it wood.',
  "Every 7th night is a Bloom night: fire won't keep them away. Build walls, spikes and a door.",
  'Drink from freshwater pools, coconuts and rain collectors. Food and water keep you healing.',
  'Puffers burst into poison: hit them from range or back off. Bandages cure poison.',
  'Fire bombs and torches set the Bloom on fire. The Mother Bloom hates fire.',
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
  const tags = tagsFound(client.notes);
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
          const spot = SPOTS.get(id);
          const note = spot?.note ? NOTES[spot.note] : undefined;
          return (
            <button
              key={id}
              className="note-row"
              onClick={() => {
                client.noteId = id;
                client.noteBack = 'journal';
                client.openPanel('note');
              }}
            >
              📄 {note?.title ?? 'Note'}
              {spot?.kind === 'tag' && spot.digit !== undefined ? ` (${spot.digit + 1}/4)` : ''}
            </button>
          );
        })}
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
  const spot = client.noteId ? SPOTS.get(client.noteId) : undefined;
  const note = spot?.note ? NOTES[spot.note] : undefined;
  if (!spot || !note) return null;
  const text = noteText(note.id, client.seed, spot.kind === 'tag' ? spot.digit : undefined);
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

// ---------------------------------------------------------------------------
// Menu.

export function MenuSheet(props: {
  client: GameClient;
  sound: Sound;
  onClose: () => void;
  onLeave: () => void;
  onHost: () => void;
}) {
  const { client, sound } = props;
  const [muted, setMuted] = useState(sound.muted);
  const [howTo, setHowTo] = useState(false);
  const mode = client.link.mode;
  const info = client.info();
  return (
    <Sheet title="☰ Menu" onClose={props.onClose}>
      <div className="menu-island">
        <div>
          🏝️ Day {info.day}
          {info.night ? ' · night' : ''}
        </div>
        <div className="muted small-text">
          Next Bloom night: day {Math.ceil(Math.max(info.day, 1) / 7) * 7}
        </div>
      </div>
      <div className="label">Play with friends</div>
      {mode === 'solo' ? (
        <>
          <p className="muted small-text">
            Open your island so up to 3 friends can join with a code. Your island and progress come
            along.
          </p>
          <button className="btn primary" onClick={props.onHost}>
            👥 Open my island to friends
          </button>
        </>
      ) : (
        <>
          <p className="small-text">Friends join from Play › Join a friend with this code:</p>
          <div className="room-code">{client.link.code}</div>
          <div className="crew">
            {client.players.map((p) => (
              <span
                key={p.id}
                className="crew-name"
                style={{ borderColor: `#${p.color.toString(16).padStart(6, '0')}` }}
              >
                {p.name}
                {p.id === client.you ? ' (you)' : ''}
              </span>
            ))}
          </div>
          {mode === 'guest' && (
            <p className="muted small-text">
              You're on a friend's island. What you carry is saved on their island.
            </p>
          )}
        </>
      )}
      <div className="label">Options</div>
      <div className="menu-row">
        <button
          className="btn"
          onClick={() => {
            sound.unlock();
            sound.setMuted(!muted);
            setMuted(!muted);
          }}
        >
          {muted ? '🔇 Sound off' : '🔊 Sound on'}
        </button>
        <button className="btn" onClick={() => setHowTo(!howTo)}>
          ❓ How to play
        </button>
      </div>
      {howTo && (
        <ul className="tips">
          <li>Move with the stick on the left (or WASD / arrow keys). 🏃 sprints (Shift).</li>
          <li>
            The big button does whatever is in front of you: chop, mine, pick up, attack, open, read
            (Space or E).
          </li>
          <li>
            Pick what you hold from the hotbar (keys 1–6). Hold a building to place it; 🔄 turns it
            (R).
          </li>
          <li>
            🎒 opens your bag and crafting (I). 📖 is your journal (J), the minimap opens the map
            (M).
          </li>
          <li>
            Find the three parts of the emergency radio and call for rescue. The journal says where
            to go.
          </li>
        </ul>
      )}
      <button className="btn ghost leave" onClick={props.onLeave}>
        {mode === 'solo'
          ? '💾 Save and leave'
          : mode === 'host'
            ? '💾 Close the island and leave'
            : '🚪 Leave the island'}
      </button>
    </Sheet>
  );
}
