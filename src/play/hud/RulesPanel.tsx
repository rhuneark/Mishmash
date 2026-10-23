// The island's world rules: the editor on the New island screen and the read-only
// list in the pause menu (🏝️ This island).

import {
  PRESETS,
  presetOf,
  type DeathDrop,
  type Hunger,
  type Markers,
  type Often,
  type Amount,
  type Speed,
  type WorldRules,
} from '../../game/rules';
import { Toggle } from './Menu';

type Opt<V> = { id: V; label: string };

interface ChoiceRow<K extends keyof WorldRules> {
  key: K;
  label: string;
  desc?: string;
  options: Opt<WorldRules[K]>[];
}

interface ToggleRow {
  key: 'infiniteStacks' | 'sharedChests' | 'craftFromChests';
  label: string;
  desc: string;
  toggle: true;
}

type Row = { [K in keyof WorldRules]: ChoiceRow<K> }[keyof WorldRules] | ToggleRow;

const SPEED: Opt<Speed>[] = [
  { id: 'walk', label: 'Walk' },
  { id: 'jog', label: 'Jog' },
  { id: 'run', label: 'Run' },
  { id: 'sprint', label: 'Sprint' },
];

const pct = (list: number[], zero = 'None'): Opt<number>[] =>
  list.map((n) => ({ id: n, label: n === 0 ? zero : `${n}%` }));

export const RULE_GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: '🧍 Survival',
    rows: [
      {
        key: 'difficulty',
        label: 'How hard the Bloom hits you',
        options: [
          { id: 50, label: 'Soft' },
          { id: 100, label: 'Normal' },
          { id: 150, label: 'Hard' },
          { id: 200, label: 'Brutal' },
        ],
      },
      {
        key: 'hunger',
        label: 'Hunger and thirst',
        options: [
          { id: 'off', label: 'Off' },
          { id: 'slow', label: 'Slow' },
          { id: 'normal', label: 'Normal' },
          { id: 'fast', label: 'Fast' },
        ] satisfies Opt<Hunger>[],
      },
      {
        key: 'deathDrop',
        label: 'When you fall, you drop',
        desc: 'Toolbelt: your hotbar. Backpack: the rest of your bag. Lose it all: no bag to go back for.',
        options: [
          { id: 'everything', label: 'Everything' },
          { id: 'toolbelt', label: 'Toolbelt' },
          { id: 'backpack', label: 'Backpack' },
          { id: 'nothing', label: 'Nothing' },
          { id: 'delete', label: 'Lose it all' },
        ] satisfies Opt<DeathDrop>[],
      },
      {
        key: 'infiniteStacks',
        toggle: true,
        label: 'Infinite stacks',
        desc: 'Materials and food stack without a limit (tools are still one each).',
      },
    ],
  },
  {
    title: '🥀 The Bloom',
    rows: [
      { key: 'daySpeed', label: 'How fast they move by day', options: SPEED },
      { key: 'nightSpeed', label: 'How fast they move at night', options: SPEED },
      {
        key: 'bloomEvery',
        label: 'A Bloom night every',
        desc: 'On a Bloom night they come in hordes and fear nothing, fire included.',
        options: [3, 5, 7, 10, 14, 0].map((n) => ({
          id: n,
          label: n === 0 ? 'Never' : `${n}th night`.replace('3th', '3rd'),
        })),
      },
      {
        key: 'monsters',
        label: 'How many roam the island',
        desc: 'None: no roamers, only the rooted Snapjaws and the Mother Bloom. Bloom nights and the rescue still come (at least half size).',
        options: [
          { id: 'none', label: 'None' },
          { id: 'few', label: 'Few' },
          { id: 'normal', label: 'Normal' },
          { id: 'many', label: 'Many' },
          { id: 'swarm', label: 'Swarm' },
        ] satisfies Opt<Amount>[],
      },
      {
        key: 'bloomBlockDamage',
        label: 'Their damage to your walls and buildings',
        options: pct([0, 25, 50, 100, 200, 300]),
      },
    ],
  },
  {
    title: '🌴 The island',
    rows: [
      {
        key: 'blockDamage',
        label: 'Your damage to trees and rocks',
        options: pct([50, 100, 200, 300]),
      },
      {
        key: 'yield',
        label: 'What you gather',
        desc: 'From trees, rocks, bushes and suitcases.',
        options: pct([50, 100, 200, 300]),
      },
      {
        key: 'events',
        label: 'World events',
        desc: 'Wreckage washing up, supply pods, packs of Husks.',
        options: [
          { id: 'off', label: 'Off' },
          { id: 'rare', label: 'Rare' },
          { id: 'normal', label: 'Normal' },
          { id: 'often', label: 'Often' },
        ] satisfies Opt<Often>[],
      },
      {
        key: 'markers',
        label: 'Map markers',
        desc: 'Everything: landmarks, your next goal, crates, pods, bags and friends.',
        options: [
          { id: 'all', label: 'Everything' },
          { id: 'landmarks', label: 'Landmarks' },
          { id: 'none', label: 'Only you' },
        ] satisfies Opt<Markers>[],
      },
    ],
  },
  {
    title: '📦 Storage',
    rows: [
      {
        key: 'sharedChests',
        toggle: true,
        label: 'Connected storage boxes',
        desc: 'Every storage box opens the same storage, wherever you build them.',
      },
      {
        key: 'craftFromChests',
        toggle: true,
        label: 'Craft from storage',
        desc: "Crafting uses what's in your storage boxes, wherever you are.",
      },
    ],
  },
];

function isToggle(r: Row): r is ToggleRow {
  return 'toggle' in r;
}

/** What a rule is set to, in words. */
function valueLabel(r: Row, rules: WorldRules): string {
  if (isToggle(r)) return rules[r.key] ? 'On' : 'Off';
  const v = rules[r.key];
  return (r.options as Opt<unknown>[]).find((o) => o.id === v)?.label ?? String(v);
}

/** The rules to pick on the New island screen: a preset, then every rule. */
export function RulesEditor({ rules, set }: { rules: WorldRules; set: (r: WorldRules) => void }) {
  const preset = presetOf(rules);
  return (
    <div className="rules">
      <div className="set-row choice">
        <span className="set-text">
          <span className="set-label">Start from</span>
          <span className="set-desc">
            {PRESETS.find((p) => p.id === preset)?.desc ?? 'Your own mix (changed below).'}
          </span>
        </span>
        <span className="seg" role="radiogroup" aria-label="Rules preset">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              role="radio"
              aria-checked={p.id === preset}
              className={p.id === preset ? 'on' : ''}
              onClick={() => set({ ...p.rules })}
            >
              {p.name}
            </button>
          ))}
        </span>
      </div>
      {RULE_GROUPS.map((g) => (
        <div key={g.title} className="rules-group">
          <div className="rules-title">{g.title}</div>
          {g.rows.map((r) =>
            isToggle(r) ? (
              <Toggle
                key={r.key}
                label={r.label}
                desc={r.desc}
                on={rules[r.key]}
                set={(v) => set({ ...rules, [r.key]: v })}
              />
            ) : (
              <div key={r.key} className="set-row choice">
                <span className="set-text">
                  <span className="set-label">{r.label}</span>
                  {r.desc && <span className="set-desc">{r.desc}</span>}
                </span>
                <span className="seg" role="radiogroup" aria-label={r.label}>
                  {(r.options as Opt<WorldRules[typeof r.key]>[]).map((o) => (
                    <button
                      key={String(o.id)}
                      role="radio"
                      aria-checked={o.id === rules[r.key]}
                      className={o.id === rules[r.key] ? 'on' : ''}
                      onClick={() => set({ ...rules, [r.key]: o.id })}
                    >
                      {o.label}
                    </button>
                  ))}
                </span>
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

/** The rules as a list (the island's page in the pause menu). */
export function RulesList({ rules }: { rules: WorldRules }) {
  const preset = PRESETS.find((p) => p.id === presetOf(rules));
  return (
    <div className="rules">
      <div className="rules-preset">
        Rules: <b>{preset?.name ?? 'Custom'}</b>
      </div>
      {RULE_GROUPS.map((g) => (
        <div key={g.title} className="rules-group">
          <div className="rules-title">{g.title}</div>
          <dl className="rules-list">
            {g.rows.map((r) => (
              <div key={r.key} className="rules-item">
                <dt>{r.label}</dt>
                <dd>{valueLabel(r, rules)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
