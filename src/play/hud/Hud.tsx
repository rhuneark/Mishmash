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
import type { GameClient, RoofView } from '../client';
import type { Input } from '../input';
import type { Sound } from '../audio';
import { toLocal } from '../screen';
import { keyHint, type Action, type Bindings } from '../keys';
import type { Fog } from './map';
import { FullMap, MiniMap } from './MapView';
import { PauseMenu } from './Menu';
import { JournalSheet, KeypadSheet, NoteSheet, ScreenSheet, StorageSheet } from './Panels';
import { CharacterMenu } from './Character';
import { QuickWindow } from './QuickPanel';
import { ChatBox, ChatLog } from './ChatBox';
import { prefs, usePrefs } from '../prefs';
import { BUILD_CATS, BUILDINGS } from '../../game/content/buildings';
import { REWARDS } from '../../game/ads';
import { TUT_DONE } from '../../game/tutorial';
import { compass } from '../../game/sim/events';
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
  // Survival basics: its card, and what it lights up.
  const tut = client.tutStep();
  const glow = client.tutGlow();
  const lit = (key: string) => (glow === key ? ' tut-glow' : '');
  const mother = [...client.mobs.values()].find(
    (m) => m.kind === 'mother' && m.dying === 0 && Math.hypot(m.x - client.x, m.z - client.z) < 40,
  );

  if (!me) return null;

  return (
    <div
      className={`hud${info.bloom ? ' bloom' : ''}${info.night ? ' night' : ''}${client.quickOpen && !panel ? ' quick-open' : ''}${quests.length ? ' quests-on' : ''}${tut && !quick && !build ? ' tut-on' : ''}`}
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
        {tut && !quick && !build && <TutorialCard client={client} pc={pc} />}
        {/* With the tutorial card up, big messages come under it instead of over it. */}
        {tut && !quick && !build && client.banner && (
          <div key={client.banner.id} className={`banner side ${client.banner.kind}`}>
            {client.banner.text}
          </div>
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
      {client.banner && !quick && !(tut && !build) && (
        <div key={client.banner.id} className={`banner ${client.banner.kind}`}>
          {client.banner.text}
        </div>
      )}
      {/* Build mode stands the survivor still: the whole island takes taps and drags. */}
      {!build && <Joystick input={input} glow={glow === 'stick'} />}
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
              className={`round-btn big${build ? ' on' : ''}${lit('build')}`}
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
            {!build && (
              <button
                className={`round-btn big${client.quickOpen || panel === 'bag' || panel === 'craft' || panel === 'skills' ? ' on' : ''}${lit('bag')}`}
                onClick={() => client.toggleBag('bag')}
                aria-label="Bag and crafting"
                title={withKey('Survivor, bag and crafting', hint('quick'))}
              >
                🎒
                {client.progress().points > 0 && <span className="btn-dot" aria-hidden="true" />}
              </button>
            )}
            {!build && (
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
            )}
          </div>
          <UseButton client={client} input={input} sound={sound} kind={label.kind} />
        </div>
      </div>
      {build ? (
        <BuildBar client={client} input={input} />
      ) : (
        <Hotbar client={client} hints={keys ? input.bindings : null} />
      )}
      <DragLayer />
      {(panel === 'bag' || panel === 'craft' || panel === 'skills') && (
        <CharacterMenu client={client} tab={panel} pc={pc} />
      )}
      {panel === 'storage' && <StorageSheet client={client} onClose={close} />}
      {panel === 'keypad' && <KeypadSheet client={client} onClose={close} />}
      {panel === 'screen' && <ScreenSheet client={client} onClose={close} />}
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
      className={`use-btn ${kind}${client.tutGlow() === 'use' ? ' tut-glow' : ''}`}
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
/**
 * Survival basics: the step you're on, how to do it (touch or keys), how far along, and
 * which way to go (the island and the minimap mark it too).
 */
function TutorialCard({ client, pc }: { client: GameClient; pc: boolean }) {
  const [skipping, setSkipping] = useState(false);
  const s = client.tutStep();
  const me = client.me;
  if (!s || !me) return null;
  const v = client.tutView();
  const progress = s.progress?.(v);
  const t = client.tutTarget;
  const far = t ? Math.hypot(t.x - client.x, t.z - client.z) : 0;
  const skip = () => {
    client.skipTutorial();
    prefs.set({ tutorial: false });
    client.toast('Tutorial skipped. ☰ › How to play starts it again.');
  };
  return (
    <div className="tut-card" role="region" aria-label="Tutorial">
      <div className="tut-head">
        <span className="tut-kicker">
          📘 Survival basics · {Math.min(me.tut + 1, TUT_DONE)}/{TUT_DONE}
        </span>
        {skipping ? (
          <span className="tut-skip-ask">
            Skip it?{' '}
            <button className="tut-link" onClick={skip}>
              Yes
            </button>{' '}
            <button className="tut-link" onClick={() => setSkipping(false)}>
              No
            </button>
          </span>
        ) : (
          <button className="tut-link" onClick={() => setSkipping(true)}>
            Skip
          </button>
        )}
      </div>
      {client.tutFlash && (
        <div key={client.tutFlash.id} className="tut-flash">
          {client.tutFlash.text}
        </div>
      )}
      <div className="tut-title">
        {s.icon} {s.title}
      </div>
      <p className="tut-text">{pc ? s.pc : s.touch}</p>
      {progress && <div className="tut-progress">{progress}</div>}
      {t && far > 8 && (
        <div className="tut-where">
          📍 {Math.round(far / 5) * 5} m {compass(t.x - client.x, t.z - client.z)}
        </div>
      )}
      {s.action === 'ok' && (
        <div className="row tut-actions">
          <button
            className="btn small primary"
            onClick={() => {
              client.tutorialGotIt();
              prefs.set({ tutorial: false });
            }}
          >
            Let's go
          </button>
          <button className="btn small" onClick={() => client.openPanel('journal')}>
            📖 Journal
          </button>
        </div>
      )}
      <div className="tut-bar" aria-hidden="true">
        <span style={{ width: `${(me.tut / TUT_DONE) * 100}%` }} />
      </div>
    </div>
  );
}

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
  const tut = client.tutStep();
  return (
    <div className="build-panel">
      {tut && (
        <div className="build-tut">
          📘 {tut.icon} {tut.title}
          {tut.action === 'build' && !tut.target?.(client.tutView())
            ? ''
            : pc
              ? ': press V to leave build mode'
              : ': tap 🔨 to leave build mode'}
        </div>
      )}
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
      <div className="build-piece">{def ? def.name : 'Take down (half comes back)'}</div>
      {removing && stack.length > 1 && (
        <div className="build-desc">
          {at + 1} of {stack.length} here: ⟳ picks the next one.
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
          aria-label="Snap to the grid"
          onClick={() => prefs.set({ buildSnap: !s.buildSnap })}
          title={withKey('Snap to the grid', hint('snap'))}
        >
          ▦
        </button>
        <button
          className={`pill-btn roof-switch${client.roofView === 'auto' ? '' : ' on'}`}
          onClick={() => client.setRoofView()}
          aria-label={`Roofs: ${client.roofView}`}
          title={withKey(ROOF_HELP[client.roofView], hint('roofs'))}
        >
          🏠 {ROOF_LABEL[client.roofView]}
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
            ? 'Click a piece to take it down; the wheel picks the next one. Drag or WASD looks around.'
            : 'Tap a piece to pick it. Drag to look around.'
          : pc
            ? 'Drag it into place and let go, or click. Wheel / right click turns it; right-drag looks around.'
            : 'Tap or drag it into place, or drag one up from the menu. Drag the island to look around.'}
        {removing && client.roofView !== 'on' && ' Roofs: 🏠 On.'}
      </div>
    </div>
  );
}

const ROOF_LABEL: Record<RoofView, string> = { auto: 'Auto', on: 'On', off: 'Off' };
const ROOF_HELP: Record<RoofView, string> = {
  auto: 'Roofs: auto (the one over you fades)',
  on: 'Roofs: on (solid; take-down picks them)',
  off: 'Roofs: off (hidden; reach what is under them)',
};

/** Build mode's menu: a tab per kind of piece, each piece showing if you have what it takes. */
/**
 * A piece in the build menu dragged onto the island: it follows the pointer and goes down
 * where it's let go (over anything but the island: just picked). On a touch screen a
 * sideways swipe still scrolls the row.
 */
function dragPiece(e: ReactPointerEvent, client: GameClient, input: Input, kind: string): void {
  if (e.button !== 0) return;
  const pid = e.pointerId;
  const start = toLocal(e.clientX, e.clientY);
  const mouse = e.pointerType === 'mouse';
  let dragging = false;
  const onIsland = (ev: PointerEvent) =>
    !!(document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.classList.contains(
      'game-canvas',
    );
  const aim = (ev: PointerEvent) => {
    if (!onIsland(ev)) return false;
    const p = toLocal(ev.clientX, ev.clientY);
    const at = input.ground?.(p.x, p.y);
    if (at) client.setBuildCursor(at);
    return !!at;
  };
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pid) return;
    if (!dragging) {
      const p = toLocal(ev.clientX, ev.clientY);
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      if (Math.hypot(dx, dy) < 8) return;
      if (!mouse && Math.abs(dx) > Math.abs(dy)) {
        quit();
        return;
      }
      dragging = true;
      if (client.build?.piece !== kind) client.buildPick(kind);
    }
    aim(ev);
  };
  const quit = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
  };
  const end = (ev: PointerEvent) => {
    if (ev.pointerId !== pid) return;
    quit();
    if (dragging && ev.type === 'pointerup' && aim(ev)) client.placeBuild();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

function BuildBar({ client, input }: { client: GameClient; input: Input }) {
  const b = client.build;
  const glow = client.tutGlow();
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
            className={`build-tab${!removing && b.cat === c.id ? ' on' : ''}${glow === `cat:${c.id}` ? ' tut-glow' : ''}`}
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
            className={`slot${b.piece === p.kind ? ' held' : ''}${p.can ? '' : ' poor'}${glow === `piece:${p.kind}` ? ' tut-glow' : ''}`}
            onClick={() => client.buildPick(p.kind)}
            onPointerDown={(e) => dragPiece(e, client, input, p.kind)}
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
  const glow = client.tutGlow();
  if (!me) return null;
  return (
    <div className="hotbar">
      {Array.from({ length: HOTBAR }, (_, i) => (
        <SlotButton
          key={i}
          client={client}
          slotRef={{ area: 'inv', index: i }}
          slot={me.inv[i] ?? null}
          className={`${me.held === i ? 'held' : ''}${glow === `slot:${i}` ? ' tut-glow' : ''}`}
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
function Joystick({ input, glow }: { input: Input; glow: boolean }) {
  const zone = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const pointer = useRef<number | null>(null);
  /** Where and when the thumb landed, and how far it went (a short tap walks there). */
  const press = useRef({ x: 0, y: 0, t: 0, far: 0 });
  const R = 46;
  useEffect(
    () => () => {
      input.joy.x = 0;
      input.joy.z = 0;
    },
    [input],
  );
  const move = (e: ReactPointerEvent, base: { x: number; y: number }) => {
    const p = toLocal(e.clientX, e.clientY);
    let dx = p.x - base.x;
    let dy = p.y - base.y;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    press.current.far = Math.max(press.current.far, d);
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
        // Event times, not the clock: a slow frame mustn't turn a tap into a hold.
        press.current = { ...base, t: e.timeStamp, far: 0 };
        setStick({ ...base, dx: 0, dy: 0 });
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== pointer.current || !stick) return;
        move(e, stick);
      }}
      onPointerUp={(e) => {
        if (e.pointerId !== pointer.current) return;
        end();
        const p = press.current;
        if (p.far < 12 && e.timeStamp - p.t < 500) input.tap?.(p.x, p.y);
      }}
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
        <div className={`joy-hint${glow ? ' tut-glow' : ''}`}>
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
        {client.rewardReady('wind') ? (
          <button
            className="btn ad-btn"
            disabled={client.adBusy !== null}
            onClick={() => void client.watchAd('wind')}
          >
            <span>
              {client.adBusy === 'wind' ? 'Playing…' : `${REWARDS.wind.icon} ${REWARDS.wind.name}`}
            </span>
            <span className="ad-sub">Watch an ad: get up right here, with your bag</span>
          </button>
        ) : (
          <p className="muted small-text">Second wind is used for today.</p>
        )}
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
