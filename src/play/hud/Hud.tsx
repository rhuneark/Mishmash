// Everything drawn over the 3D view: stats, clock, objective, minimap,
// joystick, action buttons, hotbar, toasts, banners and the sheets.

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { HOTBAR } from '../../game/sim/inventory';
import { clockLabel } from '../../game/sim/time';
import type { WeatherKind } from '../../game/sim/weather';
import type { GameClient } from '../client';
import type { Input } from '../input';
import type { Sound } from '../audio';
import { toLocal } from '../screen';
import { keyHint, type Action, type Bindings } from '../keys';
import type { Fog } from './map';
import { FullMap, MiniMap } from './MapView';
import { PauseMenu } from './Menu';
import { JournalSheet, KeypadSheet, NoteSheet, StorageSheet } from './Panels';
import { CharacterMenu } from './Character';
import { QuickWindow } from './QuickPanel';
import { ChatBox, ChatLog } from './ChatBox';
import { prefs, usePrefs } from '../prefs';
import { BUILD_CATS, BUILDINGS } from '../../game/content/buildings';
import type { Quest } from '../../game/objectives';
import { cameraRig } from '../settings';
import { DragLayer, ItemIcon, SlotButton, quickUse } from './Slots';

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

/** A mouse or trackpad: show key hints and PC tips. */
export const isPc = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;

const WEATHER_ICONS: Record<WeatherKind, string> = {
  clear: '☀️',
  cloudy: '☁️',
  rain: '🌧️',
  storm: '⛈️',
  fog: '🌫️',
};

const WEATHER_NAMES: Record<WeatherKind, string> = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  rain: 'Rain',
  storm: 'Storm',
  fog: 'Fog',
};

export function Hud(props: HudProps) {
  const { client, input, sound } = props;
  useClient(client);
  const me = client.me;
  const info = client.info();
  const objective = client.objective();
  const label = client.actionLabel();
  const panel = client.panel;
  const close = () => client.openPanel(null);
  const pc = isPc();
  const settings = usePrefs();
  const quick = client.quickOpen && !panel && me?.alive !== false;
  const keys = pc && settings.keyHints;
  const hint = (a: Action) => (keys ? keyHint(input.bindings, a) : '');
  // Settings › HUD: what shows (the controls and ☰ always do).
  const showInfo = settings.hudOn;
  const coop = client.link.mode !== 'solo';
  const build = client.build;
  // Quests make room for the bag window and for build mode (you tap the island there).
  const quests = showInfo && settings.quests !== 'off' && !quick && !build ? client.quests() : [];
  const mother = [...client.mobs.values()].find(
    (m) => m.kind === 'mother' && m.dying === 0 && Math.hypot(m.x - client.x, m.z - client.z) < 40,
  );

  if (!me) return null;

  return (
    <div
      className={`hud${info.bloom ? ' bloom' : ''}${info.night ? ' night' : ''}${client.quickOpen && !panel ? ' quick-open' : ''}${quests.length ? ' quests-on' : ''}`}
    >
      <div className="hurt-flash" style={{ opacity: client.hurtFlash * 0.7 }} />
      {me.poison > 0 && <div className="poison-tint" />}
      <div className="hud-player">
        {showInfo && settings.clock && (
          <div className="hud-clock">
            {info.night ? (info.bloom ? '🌑' : '🌙') : '☀️'} {clockLabel(client.now())}
            {client.weather !== 'clear' && (
              <span className="hud-weather" title={WEATHER_NAMES[client.weather]}>
                {' '}
                {WEATHER_ICONS[client.weather]}
              </span>
            )}
          </div>
        )}
        {showInfo && settings.stats && <LevelBadge client={client} />}
        {showInfo && settings.stats && (
          <div className="hud-stats">
            <Bar icon="❤️" value={me.hp} cls={`hp${me.poison > 0 ? ' poisoned' : ''}`} />
            <Bar icon="🍖" value={me.food} cls="food" />
            <Bar icon="💧" value={me.water} cls="water" />
          </div>
        )}
        {me.poison > 0 && <div className="chip poison">☠️ Poisoned</div>}
      </div>
      <div className="hud-corner">
        <div className="hud-corner-row">
          {showInfo && settings.minimap && (
            <MiniMap
              client={client}
              fog={props.fog}
              image={props.mapImage}
              objectivePoi={objective?.poi ?? null}
              rot={settings.mapTurn ? cameraRig(settings.view).yaw : 0}
              onOpen={() => client.openPanel('map')}
            />
          )}
          <div className="hud-corner-buttons">
            {showInfo && (
              <button
                className="round-btn"
                onClick={() => client.openPanel('journal')}
                aria-label="Journal"
                title={withKey('Journal', hint('journal'))}
              >
                📖
              </button>
            )}
            {coop && (
              <button
                className="round-btn chat-btn"
                onClick={() => client.toggleChat()}
                aria-label={client.unread ? `Chat, ${client.unread} new` : 'Chat'}
                title={withKey('Chat', hint('chat'))}
              >
                💬
                {client.unread > 0 && (
                  <span className="chat-badge">{Math.min(client.unread, 9)}</span>
                )}
              </button>
            )}
            <button
              className="round-btn"
              onClick={() => client.openPanel('menu')}
              aria-label="Menu"
            >
              ☰
            </button>
          </div>
        </div>
        {quests.length > 0 && (
          <QuestList quests={quests} current={settings.quests === 'current'} client={client} />
        )}
      </div>
      <div className="hud-left">
        {build && <BuildPanel client={client} pc={pc} hint={hint} />}
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
        {quick && client.banner && (
          <div key={client.banner.id} className={`toast banner-toast ${client.banner.kind}`}>
            {client.banner.text}
          </div>
        )}
        {client.toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
        {coop && !client.chatOpen && <ChatLog client={client} />}
      </div>
      {coop && client.chatOpen && !panel && <ChatBox client={client} />}
      {quick && <QuickWindow client={client} pc={pc} />}
      {client.banner && !quick && (
        <div key={client.banner.id} className={`banner ${client.banner.kind}`}>
          {client.banner.text}
        </div>
      )}
      <Joystick input={input} />
      <div className="hud-actions">
        <div className={`action-label${label.blocked ? ' blocked' : ''}`}>
          {!label.blocked && label.text && hint('use') ? (
            <span className="key-cap">{hint('use')}</span>
          ) : null}
          {label.blocked ?? label.text}
          {!label.blocked && label.item ? (
            <ItemIcon id={label.item} className="label-icon" />
          ) : null}
        </div>
        <div className="action-row">
          <div className="action-side">
            {client.ghost && (
              <button
                className="round-btn big"
                onClick={() => client.turnGhost()}
                aria-label="Turn"
                title={withKey('Turn', hint('turn'))}
              >
                🔄
              </button>
            )}
            <button
              className={`round-btn big${build ? ' on' : ''}`}
              onClick={() => client.toggleBuild()}
              aria-label={build ? 'Leave build mode' : 'Build mode'}
              title={withKey('Build mode', hint('build'))}
            >
              🔨
            </button>
            {!client.ghost && client.target?.building !== undefined && (
              <TakeDown
                onConfirm={() =>
                  client.target?.building !== undefined && client.demolish(client.target.building)
                }
              />
            )}
            <button
              className={`round-btn big${client.quickOpen || panel === 'bag' || panel === 'craft' || panel === 'skills' ? ' on' : ''}`}
              onClick={() => client.toggleBag('bag')}
              aria-label="Bag and crafting"
              title={withKey('Survivor, bag and crafting', hint('quick'))}
            >
              🎒
              {client.progress().points > 0 && <span className="btn-dot" aria-hidden="true" />}
            </button>
            <button
              className={`round-btn big${input.sprintToggle ? ' on' : ''}`}
              onClick={() => {
                input.sprintToggle = !input.sprintToggle;
                client.touch();
              }}
              aria-label="Sprint"
              title={withKey('Sprint', hint('sprint'))}
            >
              🏃
              <span className="stamina" style={{ height: `${client.stamina}%` }} />
            </button>
          </div>
          <UseButton client={client} input={input} sound={sound} kind={label.kind} />
        </div>
      </div>
      {build ? (
        <BuildBar client={client} />
      ) : (
        <Hotbar client={client} hints={keys ? input.bindings : null} />
      )}
      <DragLayer />
      {(panel === 'bag' || panel === 'craft' || panel === 'skills') && (
        <CharacterMenu client={client} tab={panel} pc={pc} />
      )}
      {panel === 'storage' && <StorageSheet client={client} onClose={close} />}
      {panel === 'keypad' && <KeypadSheet client={client} onClose={close} />}
      {panel === 'journal' && <JournalSheet client={client} onClose={close} />}
      {panel === 'note' && (
        <NoteSheet client={client} onClose={() => client.openPanel(client.noteBack ?? null)} />
      )}
      {panel === 'menu' && (
        <PauseMenu
          client={client}
          input={input}
          sound={sound}
          pc={pc}
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

function withKey(label: string, key: string): string {
  return key ? `${label} (${key})` : label;
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
    input.useButton = true;
    client.use();
  };
  const up = () => {
    input.useButton = false;
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
      {armed ? '✔️' : <ItemIcon id="axe_stone" className="btn-icon" />}
      {armed && <span className="btn-tip">Tap again to take it down</span>}
    </button>
  );
}

/** The quests under the minimap: a title and its steps, done ones ticked. */
function QuestList({
  quests,
  current,
  client,
}: {
  quests: Quest[];
  current: boolean;
  client: GameClient;
}) {
  return (
    <div className="quests" aria-label="Quests">
      {quests.map((q) => {
        const steps = current ? q.steps.filter((s) => !s.done).slice(0, 1) : q.steps;
        return (
          <button key={q.id} className="quest" onClick={() => client.openPanel('journal')}>
            <span className="quest-title">{q.title}</span>
            <ul className="quest-steps">
              {steps.map((s) => (
                <li key={s.id} className={s.done ? 'done' : ''}>
                  {s.text}
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}

/** Build mode's tools: turn the piece, snap to the grid, the grid's size, leave. */
function BuildPanel({
  client,
  pc,
  hint,
}: {
  client: GameClient;
  pc: boolean;
  hint: (a: Action) => string;
}) {
  const s = usePrefs();
  const piece = client.build?.piece;
  const def = piece && piece !== 'remove' ? BUILDINGS[piece] : undefined;
  const removing = piece === 'remove';
  // Taking down: the pieces stacked under the cursor (roof, wall, floor…), topmost first.
  const stack = removing ? client.removeStack() : [];
  const at = removing ? stack.indexOf(client.build?.remove ?? -1) : -1;
  return (
    <div className="build-panel">
      <div className="build-head">
        <span className="build-title">🔨 Build mode</span>
        <button
          className="round-btn"
          onClick={() => client.toggleBuild(false)}
          aria-label="Leave build mode"
          title={withKey('Leave build mode', hint('build'))}
        >
          ✕
        </button>
      </div>
      <div className="build-piece">{def ? def.name : 'Take pieces down (half comes back)'}</div>
      {removing && stack.length > 1 && (
        <div className="build-desc">
          {at + 1} of {stack.length} here: ⟳ picks the next one down.
        </div>
      )}
      {def && (
        <div className="build-cost" aria-label="Cost">
          {Object.entries(client.costOf(piece as string)).map(([id, n]) => {
            const have = client.craftCount(id);
            return (
              <span key={id} className={`build-need${have >= n ? '' : ' short'}`}>
                <ItemIcon id={id} className="build-need-icon" />
                {have}/{n}
              </span>
            );
          })}
        </div>
      )}
      {def && <div className="build-desc">{def.desc}</div>}
      <div className="build-tools">
        <button
          className="round-btn"
          onClick={() => client.turnGhost(-1)}
          aria-label={removing ? 'Piece above' : 'Turn left'}
        >
          ⟲
        </button>
        <button
          className="round-btn"
          onClick={() => client.turnGhost(1)}
          aria-label={removing ? 'Piece below' : 'Turn right'}
          title={withKey(removing ? 'Next piece here' : 'Turn', hint('turn'))}
        >
          ⟳
        </button>
        <button
          className={`pill-btn${s.buildSnap ? ' on' : ''}`}
          role="switch"
          aria-checked={s.buildSnap}
          onClick={() => prefs.set({ buildSnap: !s.buildSnap })}
          title={withKey('Snap to the grid', hint('snap'))}
        >
          ▦ Snap
        </button>
        <button
          className="pill-btn"
          onClick={() => prefs.set({ buildGrid: s.buildGrid === 2 ? 1 : 2 })}
          aria-label={`Grid ${s.buildGrid} m`}
        >
          {s.buildGrid} m
        </button>
      </div>
      <div className="build-tip">
        {removing
          ? pc
            ? 'Point at a piece and click to take it down; the wheel picks the one below.'
            : 'Drag onto a piece, then tap the button to take it down.'
          : pc
            ? 'Point anywhere on the island: the wheel turns it, click to place.'
            : 'Drag anywhere on the island to move it, then tap the build button.'}
      </div>
    </div>
  );
}

/** Build mode's menu: a tab per kind of piece, each piece showing if you have what it takes. */
function BuildBar({ client }: { client: GameClient }) {
  const b = client.build;
  if (!b) return null;
  const removing = b.piece === 'remove';
  return (
    <div className="build-bar">
      <div className="build-tabs" role="tablist" aria-label="Build menu">
        <button
          role="tab"
          aria-selected={removing}
          className={`build-tab${removing ? ' on' : ''}`}
          onClick={() => client.buildPick('remove')}
          aria-label="Take down"
          title="Take down"
        >
          🗑️
        </button>
        {BUILD_CATS.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={!removing && b.cat === c.id}
            className={`build-tab${!removing && b.cat === c.id ? ' on' : ''}`}
            onClick={() => client.buildTab(c.id)}
            aria-label={c.name}
            title={c.name}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div className="build-row" aria-label="Pieces">
        {client.buildPieces(b.cat).map((p) => (
          <button
            key={p.kind}
            className={`slot${b.piece === p.kind ? ' held' : ''}${p.can ? '' : ' poor'}`}
            onClick={() => client.buildPick(p.kind)}
            aria-label={BUILDINGS[p.kind]?.name ?? p.kind}
          >
            <ItemIcon id={p.kind} className="slot-icon" />
            {p.made > 0 && <span className="slot-n">{p.made}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Hotbar({ client, hints }: { client: GameClient; hints: Bindings | null }) {
  const me = client.me;
  if (!me) return null;
  return (
    <div className="hotbar">
      {Array.from({ length: HOTBAR }, (_, i) => (
        <SlotButton
          key={i}
          client={client}
          slotRef={{ area: 'inv', index: i }}
          slot={me.inv[i] ?? null}
          className={me.held === i ? 'held' : ''}
          onTap={() => client.select(i)}
          onContext={() => quickUse(client, i)}
        >
          <span className="slot-key">
            {hints ? keyHint(hints, `slot${i + 1}` as Action) : i + 1}
          </span>
        </SlotButton>
      ))}
    </div>
  );
}

/** A joystick that appears where the thumb lands (left side of the screen). */
function Joystick({ input }: { input: Input }) {
  const zone = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const pointer = useRef<number | null>(null);
  const R = 46;
  const move = (e: ReactPointerEvent, base: { x: number; y: number }) => {
    const p = toLocal(e.clientX, e.clientY);
    let dx = p.x - base.x;
    let dy = p.y - base.y;
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
        // A mouse clicks the island (Input), it doesn't grab the stick.
        if (pointer.current !== null || e.pointerType === 'mouse') return;
        pointer.current = e.pointerId;
        zone.current?.setPointerCapture(e.pointerId);
        const base = toLocal(e.clientX, e.clientY);
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

/** Your level and how far to the next, by the bars; tap for the skill tree. */
function LevelBadge({ client }: { client: GameClient }) {
  const p = client.progress();
  const span = Math.max(1, p.to - p.from);
  const pct = p.to > p.from ? Math.min(100, ((p.xp - p.from) / span) * 100) : 100;
  return (
    <button
      className={`level-badge${p.points > 0 ? ' points' : ''}`}
      onClick={() => client.toggleBag('skills')}
      aria-label={`Level ${p.level}${p.points > 0 ? `, ${p.points} skill points to spend` : ''}`}
    >
      <span className="level-num">⭐ {p.level}</span>
      <span className="level-track">
        <span style={{ width: `${pct}%` }} />
      </span>
      {p.points > 0 && <span className="level-plus">+{p.points}</span>}
    </button>
  );
}
