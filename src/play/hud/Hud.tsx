// Everything drawn over the 3D view: stats, clock, objective, minimap,
// joystick, action buttons, hotbar, toasts, banners and the sheets.

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { ITEMS } from '../../game/content/items';
import { HOTBAR } from '../../game/sim/inventory';
import { clockLabel } from '../../game/sim/time';
import type { GameClient } from '../client';
import type { Input } from '../input';
import type { Sound } from '../audio';
import type { Fog } from './map';
import { FullMap, MiniMap } from './MapView';
import { BagSheet, JournalSheet, KeypadSheet, MenuSheet, NoteSheet, StorageSheet } from './Panels';

export interface HudProps {
  client: GameClient;
  input: Input;
  sound: Sound;
  fog: Fog;
  mapImage: HTMLCanvasElement;
  onLeave: () => void;
  onHost: () => void;
  onNewIsland: () => void;
}

export function useClient(client: GameClient): number {
  return useSyncExternalStore(client.subscribe, client.getVersion);
}

export function Hud(props: HudProps) {
  const { client, input, sound } = props;
  useClient(client);
  const me = client.me;
  const info = client.info();
  const objective = client.objective();
  const label = client.actionLabel();
  const panel = client.panel;
  const close = () => client.openPanel(null);
  const mother = [...client.mobs.values()].find(
    (m) => m.kind === 'mother' && m.dying === 0 && Math.hypot(m.x - client.x, m.z - client.z) < 40,
  );

  if (!me) return null;

  return (
    <div className={`hud${info.bloom ? ' bloom' : ''}${info.night ? ' night' : ''}`}>
      <div className="hurt-flash" style={{ opacity: client.hurtFlash * 0.7 }} />
      {me.poison > 0 && <div className="poison-tint" />}
      <div className="hud-top">
        <div className="hud-stats">
          <Bar icon="❤️" value={me.hp} cls={`hp${me.poison > 0 ? ' poisoned' : ''}`} />
          <Bar icon="🍖" value={me.food} cls="food" />
          <Bar icon="💧" value={me.water} cls="water" />
          <div className="hud-clock">
            {info.night ? (info.bloom ? '🌑' : '🌙') : '☀️'} {clockLabel(client.now())}
          </div>
          {me.poison > 0 && <div className="chip poison">☠️ Poisoned</div>}
        </div>
        <div className="hud-corner">
          <MiniMap
            client={client}
            fog={props.fog}
            image={props.mapImage}
            objectivePoi={objective?.poi ?? null}
            onOpen={() => client.openPanel('map')}
          />
          <div className="hud-corner-buttons">
            <button
              className="round-btn"
              onClick={() => client.openPanel('journal')}
              aria-label="Journal"
            >
              📖
            </button>
            <button
              className="round-btn"
              onClick={() => client.openPanel('menu')}
              aria-label="Menu"
            >
              ☰
            </button>
          </div>
        </div>
      </div>
      <div className="hud-feed">
        {objective && (
          <button className="objective" onClick={() => client.openPanel('journal')}>
            <span className="objective-mark">▸</span> {objective.text}
          </button>
        )}
        {mother && (
          <div className="bossbar">
            <div className="bossbar-name">The Mother Bloom</div>
            <div className="bossbar-track">
              <div className="bossbar-fill" style={{ width: `${mother.hp}%` }} />
            </div>
          </div>
        )}
        {client.status !== 'ok' && (
          <div className="chip status">
            {client.status === 'reconnecting' ? 'Reconnecting…' : 'Connection lost'}
          </div>
        )}
        {client.rescue.phase === 'calling' && (
          <div className="chip rescue">🚁 Rescue in {formatTime(client.rescueLeft())}</div>
        )}
        {client.rescue.phase === 'landed' && (
          <div className="chip rescue go">
            🚁 The helicopter is waiting! {formatTime(client.rescueLeft())}
          </div>
        )}
        {client.toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
      {client.banner && (
        <div key={client.banner.id} className={`banner ${client.banner.kind}`}>
          {client.banner.text}
        </div>
      )}
      <Joystick input={input} />
      <div className="hud-actions">
        <div className={`action-label${label.blocked ? ' blocked' : ''}`}>
          {label.blocked ?? label.text}
        </div>
        <div className="action-row">
          <div className="action-side">
            {client.ghost && (
              <button
                className="round-btn big"
                onClick={() => client.turnGhost()}
                aria-label="Turn"
              >
                🔄
              </button>
            )}
            {!client.ghost && client.target?.building !== undefined && (
              <TakeDown
                onConfirm={() =>
                  client.target?.building !== undefined && client.demolish(client.target.building)
                }
              />
            )}
            <button
              className="round-btn big"
              onClick={() => client.openPanel('bag')}
              aria-label="Bag and crafting"
            >
              🎒
            </button>
            <button
              className={`round-btn big${input.sprintToggle ? ' on' : ''}`}
              onClick={() => {
                input.sprintToggle = !input.sprintToggle;
                client.touch();
              }}
              aria-label="Sprint"
            >
              🏃
              <span className="stamina" style={{ height: `${client.stamina}%` }} />
            </button>
          </div>
          <UseButton client={client} input={input} sound={sound} kind={label.kind} />
        </div>
      </div>
      <Hotbar client={client} />
      {panel === 'bag' && <BagSheet client={client} onClose={close} tab="bag" />}
      {panel === 'craft' && <BagSheet client={client} onClose={close} tab="craft" />}
      {panel === 'storage' && <StorageSheet client={client} onClose={close} />}
      {panel === 'keypad' && <KeypadSheet client={client} onClose={close} />}
      {panel === 'journal' && <JournalSheet client={client} onClose={close} />}
      {panel === 'note' && (
        <NoteSheet client={client} onClose={() => client.openPanel(client.noteBack ?? null)} />
      )}
      {panel === 'menu' && (
        <MenuSheet
          client={client}
          sound={sound}
          onClose={close}
          onLeave={props.onLeave}
          onHost={props.onHost}
        />
      )}
      {panel === 'map' && (
        <div className="sheet-backdrop" onClick={close}>
          <div className="map-sheet">
            <FullMap
              client={client}
              fog={props.fog}
              image={props.mapImage}
              objectivePoi={objective?.poi ?? null}
            />
            <div className="map-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
      {!me.alive && !me.escaped && <DeathScreen client={client} />}
      {(me.escaped || client.won) && (
        <WinScreen client={client} onLeave={props.onLeave} onNewIsland={props.onNewIsland} />
      )}
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function Bar({ icon, value, cls }: { icon: string; value: number; cls: string }) {
  const low = value < 20;
  return (
    <div className={`bar ${cls}${low ? ' low' : ''}`}>
      <span className="bar-icon">{icon}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function UseButton({
  client,
  input,
  sound,
  kind,
}: {
  client: GameClient;
  input: Input;
  sound: Sound;
  kind: string;
}) {
  const down = (e: ReactPointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    sound.unlock();
    input.useHeld = true;
    client.use();
  };
  const up = () => {
    input.useHeld = false;
  };
  const icon =
    kind === 'place'
      ? '🔨'
      : kind === 'attack'
        ? '⚔️'
        : kind === 'throw'
          ? '💣'
          : kind === 'eat'
            ? '😋'
            : kind === 'use'
              ? '✋'
              : '👊';
  return (
    <button
      className={`use-btn ${kind}`}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      aria-label="Action"
    >
      {icon}
    </button>
  );
}

function TakeDown({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={`round-btn big${armed ? ' danger' : ''}`}
      onClick={() => {
        if (armed) {
          onConfirm();
          setArmed(false);
        } else setArmed(true);
      }}
      aria-label="Take down"
    >
      {armed ? '✔️' : '🪚'}
      {armed && <span className="btn-tip">Tap again to take it down</span>}
    </button>
  );
}

function Hotbar({ client }: { client: GameClient }) {
  const me = client.me;
  if (!me) return null;
  return (
    <div className="hotbar">
      {Array.from({ length: HOTBAR }, (_, i) => {
        const s = me.inv[i] ?? null;
        return (
          <button
            key={i}
            className={`slot${me.held === i ? ' held' : ''}`}
            onClick={() => client.select(i)}
            aria-label={s ? ITEMS[s.id]?.name : `Slot ${i + 1}`}
          >
            <SlotView slot={s} />
            <span className="slot-key">{i + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SlotView({ slot }: { slot: { id: string; n: number; d?: number } | null }) {
  if (!slot) return null;
  const def = ITEMS[slot.id];
  const max = def?.durability;
  return (
    <>
      <span className="slot-icon">{def?.icon ?? '?'}</span>
      {slot.n > 1 && <span className="slot-n">{slot.n}</span>}
      {max !== undefined && slot.d !== undefined && slot.d < max && (
        <span className="slot-dur">
          <span style={{ width: `${(slot.d / max) * 100}%` }} />
        </span>
      )}
    </>
  );
}

/** A joystick that appears where the thumb lands (left side of the screen). */
function Joystick({ input }: { input: Input }) {
  const zone = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const pointer = useRef<number | null>(null);
  const R = 46;
  const move = (e: ReactPointerEvent, base: { x: number; y: number }) => {
    let dx = e.clientX - base.x;
    let dy = e.clientY - base.y;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    const mag = Math.min(1, d / R);
    const k = mag < 0.15 ? 0 : mag;
    input.joy.x = d > 0 ? (dx / Math.max(d, 1e-6)) * k : 0;
    input.joy.z = d > 0 ? (dy / Math.max(d, 1e-6)) * k : 0;
    setStick({ ...base, dx, dy });
  };
  const end = () => {
    pointer.current = null;
    input.joy.x = 0;
    input.joy.z = 0;
    setStick(null);
  };
  return (
    <div
      ref={zone}
      className="joy-zone"
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        pointer.current = e.pointerId;
        zone.current?.setPointerCapture(e.pointerId);
        const base = { x: e.clientX, y: e.clientY };
        setStick({ ...base, dx: 0, dy: 0 });
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== pointer.current || !stick) return;
        move(e, stick);
      }}
      onPointerUp={(e) => e.pointerId === pointer.current && end()}
      onPointerCancel={(e) => e.pointerId === pointer.current && end()}
    >
      {stick ? (
        <div className="joy-base" style={{ left: stick.x, top: stick.y }}>
          <div
            className="joy-knob"
            style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }}
          />
        </div>
      ) : (
        <div className="joy-hint">
          <div className="joy-knob" />
        </div>
      )}
    </div>
  );
}

function DeathScreen({ client }: { client: GameClient }) {
  const me = client.me;
  return (
    <div className="overlay death">
      <div className="overlay-card">
        <div className="overlay-icon">🥀</div>
        <h2>The Bloom took you</h2>
        <p>Your bag lies where you fell. Go back for it before it rots away (two days).</p>
        <button className="btn primary" onClick={() => client.respawn()}>
          {me?.spawnSet ? 'Wake up at your bedroll' : 'Wake up at the crash site'}
        </button>
      </div>
    </div>
  );
}

function WinScreen({
  client,
  onLeave,
  onNewIsland,
}: {
  client: GameClient;
  onLeave: () => void;
  onNewIsland: () => void;
}) {
  const me = client.me;
  const day = client.info().day;
  const solo = client.link.mode === 'solo';
  return (
    <div className="overlay win">
      <div className="overlay-card">
        <div className="overlay-icon">🚁</div>
        <h2>You got off the island!</h2>
        <p>The rotors drown out the screaming trees below. Rescued on day {day}.</p>
        <div className="win-stats">
          <div>
            <b>{me?.kills ?? 0}</b> Bloom destroyed
          </div>
          <div>
            <b>{me?.crafted ?? 0}</b> things crafted
          </div>
          <div>
            <b>{me?.deaths ?? 0}</b> times taken
          </div>
        </div>
        {solo && (
          <button className="btn primary" onClick={onNewIsland}>
            Crash on a new island
          </button>
        )}
        <button className={`btn${solo ? '' : ' primary'}`} onClick={onLeave}>
          Back to the hub
        </button>
      </div>
    </div>
  );
}
