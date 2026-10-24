// The pause menu (☰ or Esc): resume, settings, journal, map, friends, how to
// play, save and quit. Solo play pauses while it's open. The settings panel is
// shared with the hub's Play tab.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { CLIMATE_NAMES, TERRAIN_NAMES, islandName, specCode } from '../../game/islands';
import { bloomOrdinal, type WorldRules } from '../../game/rules';
import { clockLabel } from '../../game/sim/time';
import type { Sound } from '../audio';
import type { GameClient } from '../client';
import type { Input } from '../input';
import {
  ACTIONS,
  MAX_BINDS,
  bind,
  defaultBindings,
  keyLabel,
  unbind,
  type Action,
  type ActionDef,
} from '../keys';
import { isTouch, prefs, usePrefs } from '../prefs';
import type { Settings } from '../settings';
import { RulesEditor, RulesList } from './RulesPanel';

export function PauseMenu(props: {
  client: GameClient;
  input: Input;
  sound: Sound;
  pc: boolean;
  onLeave: () => void;
  onHost: () => void;
}) {
  const { client } = props;
  const page = client.menuPage;
  const close = () => client.openPanel(null);
  const back = () => client.setMenuPage('main');
  return (
    <div className="menu-screen" data-panel="menu">
      {page === 'main' && <MainPage {...props} onClose={close} />}
      {page === 'settings' && (
        <MenuCard title="⚙️ Settings" onBack={back} onClose={close} wide>
          <SettingsPanel input={props.input} sound={props.sound} />
        </MenuCard>
      )}
      {page === 'friends' && (
        <MenuCard title="👥 Play with friends" onBack={back} onClose={close}>
          <Friends client={client} onHost={props.onHost} />
        </MenuCard>
      )}
      {page === 'howto' && (
        <MenuCard title="❓ How to play" onBack={back} onClose={close} wide>
          <HowTo pc={props.pc} bloomEvery={client.rules.bloomEvery} />
        </MenuCard>
      )}
      {page === 'island' && (
        <MenuCard title="🏝️ This island" onBack={back} onClose={close} wide>
          <IslandPage client={client} />
        </MenuCard>
      )}
    </div>
  );
}

function MenuCard(props: {
  title: string;
  onBack: () => void;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`menu-card${props.wide ? ' wide' : ''}`}>
      <div className="menu-head">
        <button className="btn small" onClick={props.onBack}>
          ‹ Back
        </button>
        <div className="menu-head-title">{props.title}</div>
        <button className="round-btn" onClick={props.onClose} aria-label="Resume">
          ✕
        </button>
      </div>
      <div className="menu-scroll">{props.children}</div>
    </div>
  );
}

function MainPage(props: { client: GameClient; onClose: () => void; onLeave: () => void }) {
  const { client } = props;
  const info = client.info();
  const mode = client.link.mode;
  const solo = mode === 'solo';
  const every = client.rules.bloomEvery;
  const nextBloom = every > 0 ? Math.ceil(Math.max(info.day, 1) / every) * every : 0;
  const go = (page: 'settings' | 'friends' | 'howto' | 'island') => () => client.setMenuPage(page);
  return (
    <div className="menu-card main">
      <div className="menu-title">{solo ? 'Paused' : 'Menu'}</div>
      <div className="menu-sub">
        {info.night ? (info.bloom ? '🌑' : '🌙') : '☀️'} {clockLabel(client.now())}
      </div>
      <div className="menu-sub muted">
        {info.bloom && info.night
          ? "Bloom night: fire won't stop them. Wall up and stay together."
          : !nextBloom
            ? 'No Bloom nights on this island.'
            : nextBloom === info.day
              ? 'Tonight is a Bloom night.'
              : `Next Bloom night: day ${nextBloom}`}
      </div>
      <div className="menu-buttons">
        <button className="menu-btn primary" onClick={props.onClose}>
          ▶ Resume
        </button>
        <button className="menu-btn" onClick={go('settings')}>
          ⚙️ Settings
        </button>
        <button className="menu-btn" onClick={() => client.openPanel('journal')}>
          📖 Journal
        </button>
        <button className="menu-btn" onClick={() => client.openPanel('map')}>
          🗺️ Map
        </button>
        <button className="menu-btn" onClick={go('friends')}>
          👥 {solo ? 'Play with friends' : `Friends · ${client.link.code}`}
        </button>
        <button className="menu-btn" onClick={go('island')}>
          🏝️ This island
        </button>
        <button className="menu-btn" onClick={go('howto')}>
          ❓ How to play
        </button>
        <button className="menu-btn leave" onClick={props.onLeave}>
          {solo
            ? '💾 Save and quit'
            : mode === 'host'
              ? '💾 Close the island and quit'
              : '🚪 Leave the island'}
        </button>
      </div>
      <div className="menu-foot muted small-text">
        {solo
          ? 'The island waits while this menu is open.'
          : 'The island keeps going while you are in the menu.'}
      </div>
    </div>
  );
}

function Friends({ client, onHost }: { client: GameClient; onHost: () => void }) {
  const mode = client.link.mode;
  if (mode === 'solo')
    return (
      <>
        <p className="small-text">
          Open your island so up to 3 friends can join with a code. Your island and progress come
          along, and you keep everything when they leave.
        </p>
        <button className="btn primary" onClick={onHost}>
          👥 Open my island to friends
        </button>
      </>
    );
  return (
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
  );
}

function IslandPage({ client }: { client: GameClient }) {
  const spec = client.island?.spec;
  const [draft, setDraft] = useState<WorldRules | null>(null);
  if (!spec) return null;
  // The solo player and a co-op host may change the rules; guests play by them.
  const owner = client.link.mode !== 'guest';
  const layout = `${['North up', 'Turned ¼', 'Turned ½', 'Turned ¾'][spec.turn]}${spec.mirror ? ', mirrored' : ''}`;
  return (
    <>
      <div className="island-card">
        <div className="island-name">{islandName(spec)}</div>
        <div className="island-tags">
          <span>{CLIMATE_NAMES[spec.climate]}</span>
          <span>{TERRAIN_NAMES[spec.terrain]}</span>
          <span>{layout}</span>
        </div>
        <div className="island-code">
          Island code <b>{specCode(spec)}</b>
        </div>
        <p className="muted small-text">
          Type this code on the New island screen to make the same island again. Friends who join
          play by this island's rules{owner ? '; you can change them here.' : '.'}
        </p>
      </div>
      {draft ? (
        <>
          <RulesEditor rules={draft} set={setDraft} fixed={['sharedChests']} />
          <div className="row rules-apply">
            <button
              className="btn primary"
              onClick={() => {
                client.setRules(draft);
                setDraft(null);
              }}
            >
              Use these rules
            </button>
            <button className="btn" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          {owner && (
            <button className="btn" onClick={() => setDraft({ ...client.rules })}>
              ✏️ Change the rules
            </button>
          )}
          <RulesList rules={client.rules} />
        </>
      )}
    </>
  );
}

export function HowTo({ pc, bloomEvery }: { pc: boolean; bloomEvery: number }) {
  return (
    <ul className="tips">
      <li>
        Move with the stick on the left{pc ? ' or WASD / arrow keys' : ''}. 🏃 sprints while you
        have breath.
      </li>
      <li>
        The big button does whatever is in front of you: chop, mine, pick up, attack, open, read
        {pc ? ' (Space, E or left click on the island)' : ''}. Hold it to keep going.
      </li>
      <li>
        With <b>Auto tool</b> on (Settings › Gameplay) you grab the right axe, pickaxe or blade for
        the job and switch back afterwards; <b>Auto weapon</b> does the same in a fight.
      </li>
      <li>Pick what you hold from the hotbar{pc ? ' (1–6 or the mouse wheel)' : ''}.</li>
      <li>
        🔨 opens build mode{pc ? ' (V)' : ''}: pick a piece from the tabs (walls, floors, roofs,
        furniture, farming, fire and light) and put it down. It's paid for straight from your bag;
        taking a piece down gives half back.
      </li>
      <li>
        Hold a bow, crossbow or slingshot and the big button shoots the nearest monster
        {pc ? ', or wherever the mouse points' : ''}. Arrows need feathers from island birds (or
        fiber); stones fly from a slingshot.
      </li>
      <li>
        Farm: build a garden plot, plant seeds from suitcases and crates, and keep it watered with a
        watering can (or let the rain do it). Cook meals in a cooking pot next to a lit campfire:
        they fill you up and heal you.
      </li>
      <li>
        Island animals roam by day. Hunt them for meat and hides, or hold their favourite food and
        feed them a few times: they'll trust you, follow you, and give eggs or milk.
      </li>
      <li>
        The weather turns: rain waters crops and fills collectors, storms throw lightning (stay
        under a roof), and in fog the Bloom only sees you up close.
      </li>
      <li>
        🎒 opens the quick bag and craft panel{pc ? ' (Tab)' : ''}: it stays open while you move and
        fight. Drag items between slots, or onto the island to drop them.
      </li>
      <li>
        Eat and drink before the bars run out. A lit campfire heals you and keeps most of the Bloom
        away.{' '}
        {bloomEvery > 0
          ? `Every ${bloomOrdinal(bloomEvery)} night is a Bloom night: they fear nothing then.`
          : 'This island has no Bloom nights.'}
      </li>
      <li>
        Watch for things that happen on their own: wreckage washing up on the beaches, Verdance
        supply pods dropping from the sky (the crash wakes the Bloom around them), packs of Husks on
        the move.
      </li>
      <li>
        Monster parts make better gear at the Mashbench. Husks sometimes carry pages of Dr.
        Kessler's research.
      </li>
      <li>
        The island hides secrets: a sealed Verdance bunker, a stranded freighter whose hold only
        drains at low tide, and treasure maps (some in bottles on the beach). Bring a shovel.
      </li>
      <li>
        Find the three parts of the emergency radio and call for rescue. The journal says where to
        go.
      </li>
      {pc && <li>Every key can be changed under Settings › Controls.</li>}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Settings.

type Tab = 'gameplay' | 'audio' | 'screen' | 'hud' | 'graphics' | 'controls';

const TAB_NAMES: Record<Tab, string> = {
  gameplay: '🎮 Gameplay',
  audio: '🔊 Audio',
  screen: '📱 Screen',
  hud: '🧭 HUD',
  graphics: '✨ Graphics',
  controls: '⌨️ Controls',
};

let lastTab: Tab = 'gameplay';

/** Every setting, by tab. Without `input` (the hub) there's no key rebinding. */
export function SettingsPanel({ input, sound }: { input?: Input; sound?: Sound }) {
  const s = usePrefs();
  const [tab, setTab] = useState<Tab>(lastTab);
  const touch = isTouch();
  const tabs: Tab[] = [
    'gameplay',
    'audio',
    'screen',
    'hud',
    'graphics',
    ...(input ? ['controls' as const] : []),
  ];
  const set = (patch: Partial<Settings>) => prefs.set(patch);
  const pick = (t: Tab) => {
    lastTab = t;
    setTab(t);
  };
  return (
    <div className="settings">
      <div className="tabs settings-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === tab}
            className={`tab-btn${t === tab ? ' on' : ''}`}
            onClick={() => pick(t)}
          >
            {TAB_NAMES[t]}
          </button>
        ))}
      </div>
      {tab === 'gameplay' && (
        <Group
          onReset={() =>
            prefs.reset([
              'autoTool',
              'autoWeapon',
              'autoBack',
              'buildSnap',
              'buildGrid',
              'buildGridShow',
            ])
          }
        >
          <Toggle
            label="Auto tool"
            desc="Grab the right axe, pickaxe or blade for trees, rocks and vines."
            on={s.autoTool}
            set={(v) => set({ autoTool: v })}
          />
          <Toggle
            label="Auto weapon"
            desc="Grab your best weapon when you attack the Bloom."
            on={s.autoWeapon}
            set={(v) => set({ autoWeapon: v })}
          />
          <Toggle
            label="Switch back"
            desc="Go back to what you held (a torch, say) once the job is done."
            on={s.autoBack}
            set={(v) => set({ autoBack: v })}
          />
          <Toggle
            label="Small bag window"
            desc="🎒 opens a small bag and craft window by your survivor that stays open while you play, instead of the survivor menu."
            on={s.bagWindow}
            set={(v) => set({ bagWindow: v })}
          />
          <Toggle
            label="Build: snap to the grid"
            desc="Walls line up along the grid and meet at the corners. Off: put pieces anywhere."
            on={s.buildSnap}
            set={(v) => set({ buildSnap: v })}
          />
          <Choice
            label="Build grid"
            value={String(s.buildGrid) as '1' | '2'}
            options={[
              { id: '1', label: '1 m (fine)' },
              { id: '2', label: '2 m (a wall long)' },
            ]}
            set={(v) => set({ buildGrid: Number(v) })}
          />
          <Toggle
            label="Build: show the grid"
            on={s.buildGridShow}
            set={(v) => set({ buildGridShow: v })}
          />
        </Group>
      )}
      {tab === 'audio' && (
        <Group onReset={() => prefs.reset(['master', 'sfx', 'ambience', 'music'])}>
          <Slider
            label="Master"
            value={s.master}
            set={(v) => set({ master: v })}
            onDone={() => sound?.play('pickup')}
          />
          <Slider
            label="Effects"
            value={s.sfx}
            set={(v) => set({ sfx: v })}
            onDone={() => sound?.play('chop')}
          />
          <Slider label="Ambience" value={s.ambience} set={(v) => set({ ambience: v })} />
          <Slider label="Music" value={s.music} set={(v) => set({ music: v })} />
          <p className="muted small-text">
            The music follows the island: calm by day, darker at night, drums when the Bloom closes
            in.
          </p>
        </Group>
      )}
      {tab === 'screen' && (
        <Group
          onReset={() =>
            prefs.reset([
              'orientation',
              'view',
              'flip',
              'leftHanded',
              'camera',
              'shake',
              'vibration',
            ])
          }
        >
          {touch && (
            <>
              <Choice
                label="Screen"
                desc="Landscape turns the game sideways: turn your phone to match."
                value={s.orientation}
                options={[
                  { id: 'portrait', label: '📱 Portrait' },
                  { id: 'landscape', label: '📱↪ Landscape' },
                ]}
                set={(v) => set({ orientation: v })}
              />
              {s.orientation === 'landscape' && (
                <Toggle
                  label="Turn it the other way"
                  desc="For holding your phone with the top to the right."
                  on={s.flip}
                  set={(v) => set({ flip: v })}
                />
              )}
              <Toggle
                label="Left-handed"
                desc="The stick on the right, the buttons on the left."
                on={s.leftHanded}
                set={(v) => set({ leftHanded: v })}
              />
            </>
          )}
          <Choice
            label="Camera angle"
            desc="Isometric looks across the island at a slant; top-down keeps north up."
            value={s.view}
            options={[
              { id: 'iso', label: '◇ Isometric' },
              { id: 'top', label: '▢ Top-down' },
            ]}
            set={(v) => set({ view: v })}
          />
          <Slider
            label="Camera distance"
            value={s.camera}
            min={80}
            max={130}
            set={(v) => set({ camera: v })}
          />
          <Toggle
            label="Camera shake"
            desc="Hits, blasts and falling trees shake the view."
            on={s.shake}
            set={(v) => set({ shake: v })}
          />
          {touch && (
            <Toggle
              label="Vibration"
              desc="Feel hits, blasts and big finds."
              on={s.vibration}
              set={(v) => set({ vibration: v })}
            />
          )}
        </Group>
      )}
      {tab === 'hud' && (
        <Group
          onReset={() =>
            prefs.reset([
              'hudOn',
              'stats',
              'statsAt',
              'clock',
              'minimap',
              'mapSize',
              'mapTurn',
              'quests',
              'hudScale',
              'hudOpacity',
              'hud',
              'damageNumbers',
              'keyHints',
            ])
          }
        >
          <Toggle
            label="Show the HUD"
            desc={`Everything over the island; the controls and ☰ stay.${input ? ' H on a keyboard.' : ''}`}
            on={s.hudOn}
            set={(v) => set({ hudOn: v })}
          />
          <Toggle label="Health, food and water" on={s.stats} set={(v) => set({ stats: v })} />
          <Choice
            label="Where they sit"
            desc="Auto: bottom left on PC and sideways, top left on an upright phone."
            value={s.statsAt}
            options={[
              { id: 'auto', label: 'Auto' },
              { id: 'top', label: 'Top left' },
              { id: 'bottom', label: 'Bottom left' },
            ]}
            set={(v) => set({ statsAt: v })}
          />
          <Toggle label="Day and time" on={s.clock} set={(v) => set({ clock: v })} />
          <Toggle label="Minimap" on={s.minimap} set={(v) => set({ minimap: v })} />
          <Choice
            label="Minimap size"
            value={s.mapSize}
            options={[
              { id: 'small', label: 'Small' },
              { id: 'normal', label: 'Normal' },
              { id: 'large', label: 'Large' },
            ]}
            set={(v) => set({ mapSize: v })}
          />
          <Toggle
            label="Minimap turns with the camera"
            desc="Off: north is always up."
            on={s.mapTurn}
            set={(v) => set({ mapTurn: v })}
          />
          <Choice
            label="Quests under the minimap"
            value={s.quests}
            options={[
              { id: 'full', label: 'Every step' },
              { id: 'current', label: 'Next step' },
              { id: 'off', label: 'Hidden' },
            ]}
            set={(v) => set({ quests: v })}
          />
          <Slider
            label="HUD size"
            value={s.hudScale}
            min={80}
            max={140}
            set={(v) => set({ hudScale: v })}
          />
          <Slider
            label="HUD opacity"
            value={s.hudOpacity}
            min={40}
            max={100}
            set={(v) => set({ hudOpacity: v })}
          />
          <Choice
            label="Button size"
            value={s.hud}
            options={[
              { id: 'small', label: 'Small' },
              { id: 'normal', label: 'Normal' },
              { id: 'large', label: 'Large' },
            ]}
            set={(v) => set({ hud: v })}
          />
          <Toggle
            label="Damage numbers"
            on={s.damageNumbers}
            set={(v) => set({ damageNumbers: v })}
          />
          {!touch && (
            <Toggle
              label="Key hints"
              desc="Show which key does what on the buttons and the hotbar."
              on={s.keyHints}
              set={(v) => set({ keyHints: v })}
            />
          )}
        </Group>
      )}
      {tab === 'graphics' && (
        <Group onReset={() => prefs.reset(['quality', 'life', 'fps'])}>
          <Choice
            label="Quality"
            desc="Medium and High draw shadows. Lower it if the game feels slow or your phone gets warm."
            value={s.quality}
            options={[
              { id: 'auto', label: 'Auto' },
              { id: 'low', label: 'Low' },
              { id: 'medium', label: 'Medium' },
              { id: 'high', label: 'High' },
            ]}
            set={(v) => set({ quality: v })}
          />
          <Toggle
            label="Grass and wildlife"
            desc="Swaying grass, birds, butterflies and fireflies."
            on={s.life}
            set={(v) => set({ life: v })}
          />
          <Toggle label="Show FPS" on={s.fps} set={(v) => set({ fps: v })} />
        </Group>
      )}
      {tab === 'controls' && input && <ControlsTab input={input} touch={touch} />}
    </div>
  );
}

export function Group({ children, onReset }: { children: ReactNode; onReset: () => void }) {
  return (
    <div className="settings-group">
      {children}
      <button className="btn ghost small reset-btn" onClick={onReset}>
        Reset this page
      </button>
    </div>
  );
}

export function Toggle(props: {
  label: string;
  desc?: string;
  on: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <button
      className={`set-row toggle${props.on ? ' on' : ''}`}
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      onClick={() => props.set(!props.on)}
    >
      <span className="set-text">
        <span className="set-label">{props.label}</span>
        {props.desc && <span className="set-desc">{props.desc}</span>}
      </span>
      <span className="switch">
        <span className="switch-knob" />
      </span>
    </button>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  set: (v: number) => void;
  onDone?: () => void;
}) {
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  return (
    <label className="set-row slider">
      <span className="set-label">{props.label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={5}
        value={props.value}
        aria-label={props.label}
        style={{ '--p': `${((props.value - min) / (max - min)) * 100}%` } as CSSProperties}
        onChange={(e) => props.set(Number(e.target.value))}
        onPointerUp={props.onDone}
        onKeyUp={props.onDone}
      />
      <span className="set-value">{props.value}%</span>
    </label>
  );
}

export function Choice<T extends string>(props: {
  label: string;
  desc?: string;
  value: T;
  options: { id: T; label: string }[];
  set: (v: T) => void;
}) {
  return (
    <div className="set-row choice">
      <span className="set-text">
        <span className="set-label">{props.label}</span>
        {props.desc && <span className="set-desc">{props.desc}</span>}
      </span>
      <span className="seg" role="radiogroup" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={o.id === props.value}
            className={o.id === props.value ? 'on' : ''}
            onClick={() => props.set(o.id)}
          >
            {o.label}
          </button>
        ))}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controls (PC): rebind every action.

const GROUPS: ActionDef['group'][] = ['Move', 'Act', 'Build', 'Screens', 'Hotbar', 'Camera'];

function ControlsTab({ input, touch }: { input: Input; touch: boolean }) {
  const [b, setB] = useState(input.bindings);
  const [wait, setWait] = useState<{ action: Action; index: number } | null>(null);
  const [note, setNote] = useState('');
  const label = (a: Action) => ACTIONS.find((x) => x.id === a)?.label ?? a;

  const apply = (next: typeof b) => {
    setB(next);
    input.setBindings(next);
    input.onBindingsChanged?.(next);
  };

  useEffect(() => {
    if (!wait) return;
    input.capture((code) => {
      setWait(null);
      if (code === null) return;
      if (code === 'Backspace' || code === 'Delete') {
        apply(unbind(b, wait.action, wait.index));
        setNote(`Cleared a key from "${label(wait.action)}".`);
        return;
      }
      const { bindings, took } = bind(b, wait.action, wait.index, code);
      if (bindings === b) {
        setNote(`${keyLabel(code)} can't be used.`);
        return;
      }
      apply(bindings);
      setNote(
        took
          ? `${keyLabel(code)} now does "${label(wait.action)}" (it was "${label(took)}").`
          : `${keyLabel(code)} → ${label(wait.action)}.`,
      );
    });
    return () => input.capture(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wait]);

  return (
    <div className="settings-group">
      <p className="muted small-text">
        {touch
          ? 'For a keyboard and mouse. On touch: the stick on the left moves, the big button acts, 🏃 sprints, 🎒 opens the quick bag.'
          : 'Click a key to change it, then press the new key or mouse button. Backspace clears it, Esc cancels. Esc always opens and closes the menu.'}
      </p>
      {note && <div className="chip ok note-chip">{note}</div>}
      {GROUPS.map((g) => (
        <div key={g} className="controls-group">
          <div className="label">{g}</div>
          {ACTIONS.filter((a) => a.group === g).map((a) => (
            <div key={a.id} className="control-row">
              <div className="control-name">{a.label}</div>
              <div className="control-keys">
                {Array.from({ length: MAX_BINDS }, (_, i) => {
                  const code = b[a.id][i];
                  const waiting = wait?.action === a.id && wait.index === i;
                  return (
                    <button
                      key={i}
                      className={`key-btn${waiting ? ' waiting' : ''}${code ? '' : ' empty'}`}
                      onClick={() => setWait({ action: a.id, index: Math.min(i, b[a.id].length) })}
                      aria-label={`${a.label}, key ${i + 1}`}
                    >
                      {waiting ? 'Press…' : code ? keyLabel(code) : '+'}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
      <button
        className="btn"
        onClick={() => {
          apply(defaultBindings());
          setNote('Back to the default keys.');
        }}
      >
        Reset to defaults
      </button>
      {wait && <CaptureOverlay input={input} what={label(wait.action)} />}
    </div>
  );
}

/** While rebinding: catches mouse buttons and the wheel too. */
function CaptureOverlay({ input, what }: { input: Input; what: string }) {
  return (
    <div
      className="capture"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.pointerType === 'mouse') input.captured(`Mouse${e.button}`);
      }}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={(e) => input.captured(e.deltaY > 0 ? 'WheelDown' : 'WheelUp')}
    >
      <div className="capture-card">
        <div className="capture-title">Press a key or a mouse button</div>
        <div className="muted small-text">for "{what}". Esc cancels, Backspace clears.</div>
      </div>
    </div>
  );
}
