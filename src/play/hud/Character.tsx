// The survivor menu (🎒, Tab, I/B, C, L): your survivor and bag, crafting by category, and
// the skill tree. Tap something to see what it is and what you can do with it; drag items
// between slots, or onto the island to drop them.

import { useState, type ReactNode } from 'react';
import { ITEMS, type ItemDef } from '../../game/content/items';
import { RECIPES, RECIPE_LIST, STATION_NAMES, type Recipe } from '../../game/content/recipes';
import { HOTBAR, INV_SIZE } from '../../game/sim/inventory';
import {
  BRANCHES,
  PERKS,
  PERK_BY_ID,
  TIER_POINTS,
  cantLearn,
  rankOf,
  spent,
  type BranchId,
  type PerkId,
} from '../../game/skills';
import type { GameClient } from '../client';
import { StationChips } from './Craft';
import { ItemIcon, SlotButton, quickUse } from './Slots';

export type CharTab = 'bag' | 'craft' | 'skills';

export function CharacterMenu({
  client,
  tab,
  pc,
}: {
  client: GameClient;
  tab: CharTab;
  pc: boolean;
}) {
  const prog = client.progress();
  const tabs: [CharTab, string][] = [
    ['bag', '🎒 Survivor'],
    ['craft', '🔨 Crafting'],
    ['skills', '⭐ Skills'],
  ];
  return (
    <div className="sheet-backdrop char-backdrop" onClick={() => client.openPanel(null)}>
      <div className="char-menu" data-panel="character" onClick={(e) => e.stopPropagation()}>
        <div className="char-head">
          <div className="char-tabs" role="tablist" aria-label="Survivor menu">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`char-tab${tab === id ? ' on' : ''}${id === 'craft' && client.tutGlow() === 'tab-craft' ? ' tut-glow' : ''}`}
                onClick={() => client.openPanel(id)}
              >
                {label}
                {id === 'skills' && prog.points > 0 && (
                  <span className="char-dot" aria-label={`${prog.points} skill points`}>
                    {prog.points}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button className="round-btn" onClick={() => client.openPanel(null)} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="char-body">
          {tab === 'bag' && <SurvivorTab client={client} pc={pc} />}
          {tab === 'craft' && <CraftingTab client={client} />}
          {tab === 'skills' && <SkillsTab client={client} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Survivor: figure, stats, hotbar and bag.

function SurvivorTab({ client, pc }: { client: GameClient; pc: boolean }) {
  const me = client.me;
  const [sel, setSel] = useState<number | null>(null);
  if (!me) return null;
  const info = client.players.find((p) => p.id === client.you);
  const color = `#${(info?.color ?? 0x4cc9f0).toString(16).padStart(6, '0')}`;
  const prog = client.progress();
  const held = me.inv[me.held];
  const heldDef = held ? ITEMS[held.id] : undefined;
  const free = me.inv.slice(HOTBAR).filter((s) => !s).length;
  const slot = sel !== null ? (me.inv[sel] ?? null) : null;
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
    <div className="survivor">
      <div className="survivor-card">
        <SurvivorFigure color={color} held={held?.id} />
        <div className="survivor-stats">
          <div className="survivor-name">{info?.name ?? 'Survivor'}</div>
          <XpBar client={client} />
          <StatBar icon="❤️" label="Health" value={me.hp} cls="hp" />
          <StatBar icon="🍖" label="Food" value={me.food} cls="food" />
          <StatBar icon="💧" label="Water" value={me.water} cls="water" />
          <div className="survivor-facts">
            <span title="In hand">✋ {heldDef?.name ?? 'Bare hands'}</span>
            <span>⚔️ {client.meleeDamage()} damage</span>
            <span>☠️ {me.kills} kills</span>
            <span>🔨 {me.crafted} crafted</span>
            <span>📅 Day {client.info().day}</span>
            {prog.points > 0 && (
              <button className="link-btn" onClick={() => client.openPanel('skills')}>
                ⭐ {prog.points} skill point{prog.points > 1 ? 's' : ''} to spend
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="label">Hotbar · in hand: slot {me.held + 1}</div>
      {grid(0, HOTBAR)}
      <div className="label">
        Bag <span className="muted">· {free} free</span>
      </div>
      {grid(HOTBAR, INV_SIZE)}
      {slot && sel !== null ? (
        <ItemDetail
          def={ITEMS[slot.id]}
          count={slot.n}
          durability={slot.d}
          actions={
            <ItemActions
              client={client}
              index={sel}
              onGone={() => setSel(null)}
              def={ITEMS[slot.id]}
            />
          }
        />
      ) : (
        <p className="muted small-text">
          Tap an item to see it and use it. {pc ? 'Drag' : 'Hold and drag'} items between slots, or
          onto the island to drop them.
          {pc ? ' Right-click eats, holds or sends it to the hotbar.' : ''}
        </p>
      )}
    </div>
  );
}

/** A simple standing survivor in your colour, holding what you hold. */
function SurvivorFigure({ color, held }: { color: string; held?: string }) {
  return (
    <div className="survivor-figure" aria-hidden="true">
      <svg viewBox="0 0 100 150">
        <ellipse cx="50" cy="142" rx="30" ry="6" fill="rgba(0,0,0,0.35)" />
        <rect x="35" y="96" width="12" height="42" rx="5" fill="#3b3550" />
        <rect x="53" y="96" width="12" height="42" rx="5" fill="#3b3550" />
        <rect x="30" y="54" width="40" height="48" rx="12" fill={color} />
        <rect x="64" y="58" width="12" height="20" rx="4" fill="#6b4a2a" />
        <rect x="20" y="58" width="11" height="36" rx="5" fill={color} />
        <rect x="69" y="58" width="11" height="36" rx="5" fill={color} />
        <circle cx="25.5" cy="96" r="6" fill="#e8b98a" />
        <circle cx="74.5" cy="96" r="6" fill="#e8b98a" />
        <circle cx="50" cy="36" r="17" fill="#e8b98a" />
        <path d="M33 33 C34 16 66 16 67 33 C60 26 40 26 33 33 Z" fill="#4a3424" />
        <circle cx="44" cy="38" r="2" fill="#1b1a2b" />
        <circle cx="56" cy="38" r="2" fill="#1b1a2b" />
      </svg>
      {held && <ItemIcon id={held} className="survivor-held" />}
    </div>
  );
}

function StatBar({
  icon,
  label,
  value,
  cls,
}: {
  icon: string;
  label: string;
  value: number;
  cls: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="stat-row" aria-label={`${label} ${v} of 100`}>
      <span className="stat-icon">{icon}</span>
      <span className={`stat-track ${cls}`}>
        <span style={{ width: `${v}%` }} />
      </span>
      <span className="stat-num">{v}</span>
    </div>
  );
}

function XpBar({ client }: { client: GameClient }) {
  const p = client.progress();
  const span = Math.max(1, p.to - p.from);
  const pct = p.to > p.from ? Math.min(100, ((p.xp - p.from) / span) * 100) : 100;
  return (
    <div className="xp-row">
      <span className="xp-level">Level {p.level}</span>
      <span className="xp-track">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="xp-num">{p.to > p.from ? `${p.xp - p.from}/${span} XP` : 'Max'}</span>
    </div>
  );
}

/** What an item does, as chips: damage, reach, power, food… */
function itemStats(def: ItemDef, durability?: number): string[] {
  const out: string[] = [];
  if (def.weapon)
    out.push(
      `⚔️ ${def.weapon.damage} damage`,
      `↔️ ${def.weapon.reach} m reach`,
      `⏱️ ${(1 / def.weapon.cooldown).toFixed(1)}/s`,
    );
  if (def.ranged) out.push(`🎯 ${def.ranged.damage} damage`, `↔️ ${def.ranged.range} m range`);
  if (def.ammo?.damage) out.push(`+${def.ammo.damage} damage`);
  if (def.ammo?.burn) out.push('🔥 sets things burning');
  if (def.tool && def.tool.kind !== 'hand') out.push(`⛏️ ${def.tool.kind} power ${def.tool.power}`);
  if (def.throwable)
    out.push(
      `💥 ${def.throwable.damage} in ${def.throwable.radius} m`,
      `↗️ ${def.throwable.range} m`,
    );
  if (def.food?.food) out.push(`🍖 +${def.food.food} food`);
  if (def.food?.water) out.push(`💧 +${def.food.water} water`);
  if (def.heal) out.push(`❤️ +${def.heal.hp} over ${def.heal.seconds} s`);
  if (def.light) out.push(`💡 ${def.light} m light`);
  if (def.durability !== undefined && !def.can)
    out.push(`🛠️ ${durability ?? def.durability}/${def.durability}${def.wears ? ' s' : ''}`);
  if (def.can) out.push(`💧 ${durability ?? 0}/${def.durability ?? 8} waterings`);
  if (def.quest) out.push('📻 needed to get off the island');
  return out;
}

function ItemDetail({
  def,
  count,
  durability,
  actions,
}: {
  def: ItemDef | undefined;
  count?: number;
  durability?: number;
  actions?: ReactNode;
}) {
  if (!def) return null;
  const stats = itemStats(def, durability);
  return (
    <div className="item-info">
      <div className="item-head">
        <ItemIcon id={def.id} className="item-icon" />
        <div>
          <div className="item-name">
            {def.name}
            {count && count > 1 ? ` ×${count}` : ''}
          </div>
          <div className="item-desc">{def.desc}</div>
        </div>
      </div>
      {stats.length > 0 && (
        <div className="item-stats">
          {stats.map((t) => (
            <span key={t} className="item-stat">
              {t}
            </span>
          ))}
        </div>
      )}
      {actions}
    </div>
  );
}

function ItemActions({
  client,
  index,
  def,
  onGone,
}: {
  client: GameClient;
  index: number;
  def: ItemDef | undefined;
  onGone: () => void;
}) {
  const me = client.me;
  if (!me || !def) return null;
  const use = def.reads
    ? 'Read'
    : def.heal && !def.food
      ? 'Use'
      : def.food
        ? def.food.water > def.food.food
          ? 'Drink'
          : 'Eat'
        : null;
  return (
    <div className="item-actions">
      {use && (
        <button className="btn small primary" onClick={() => client.eat(index)}>
          {use}
        </button>
      )}
      {index < HOTBAR ? (
        <button
          className="btn small"
          onClick={() => client.select(index)}
          disabled={me.held === index}
        >
          {me.held === index ? 'In hand' : 'Hold'}
        </button>
      ) : (
        <button className="btn small" onClick={() => quickUse(client, index)}>
          To hotbar
        </button>
      )}
      {!def.quest && (
        <button
          className="btn small ghost"
          onClick={() => {
            client.dropSlot(index);
            onGone();
          }}
        >
          Drop
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Crafting: categories, a grid of what you can make, and the recipe you picked.

type CraftCat = 'all' | 'tools' | 'weapons' | 'ranged' | 'food' | 'medicine' | 'mash' | 'materials';

const CRAFT_CATS: [CraftCat, string][] = [
  ['all', 'All'],
  ['tools', '🪓 Tools'],
  ['weapons', '⚔️ Weapons'],
  ['ranged', '🏹 Ranged'],
  ['food', '🍲 Food'],
  ['medicine', '🩹 Medicine'],
  ['mash', '🌺 Bloom gear'],
  ['materials', '🧵 Parts'],
];

export function craftCategory(r: Recipe): Exclude<CraftCat, 'all'> {
  const d = ITEMS[r.out];
  if (r.station === 'mash') return 'mash';
  if (!d) return 'materials';
  if (d.ranged || d.ammo) return 'ranged';
  if (d.tool || d.can) return 'tools';
  if (d.weapon || d.throwable) return 'weapons';
  if (d.heal && !d.food) return 'medicine';
  if (d.food) return 'food';
  return 'materials';
}

let lastCat: CraftCat = 'all';
let lastRecipe: string | null = null;

function CraftingTab({ client }: { client: GameClient }) {
  const [cat, setCat] = useState<CraftCat>(lastCat);
  const [only, setOnly] = useState(false);
  const [pick, setPick] = useState<string | null>(lastRecipe);
  const st = client.stations();
  const list = RECIPE_LIST.filter(
    (r) => (cat === 'all' || craftCategory(r) === cat) && (!only || client.canCraft(r.id)),
  );
  // Craftable first, then what a station you're at makes, then the rest.
  const rank = (r: Recipe) => (client.canCraft(r.id) ? 0 : st[r.station] ? 1 : 2);
  const shown = list
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
    .map((x) => x.r);
  const sel = shown.find((r) => r.id === pick) ?? shown[0];
  // Survival basics: the recipe it asks for (and its category, if another one is showing).
  const want = client.tutGlow() === 'recipe' ? client.tutStep()?.recipe : undefined;
  const wantCat =
    want && !shown.some((r) => r.id === want) && RECIPES[want]
      ? craftCategory(RECIPES[want])
      : null;
  const choose = (id: string) => {
    lastRecipe = id;
    setPick(id);
  };
  return (
    <div className="crafting">
      <div className="craft-cats" role="tablist" aria-label="What to make">
        {CRAFT_CATS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={cat === id}
            className={`craft-cat${cat === id ? ' on' : ''}${wantCat === id || (wantCat && id === 'all') ? ' tut-glow' : ''}`}
            onClick={() => {
              lastCat = id;
              setCat(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="craft-bar">
        <StationChips client={client} />
        <button
          className={`pill-btn${only ? ' on' : ''}`}
          role="switch"
          aria-checked={only}
          onClick={() => setOnly(!only)}
        >
          Can make
        </button>
      </div>
      <div className="recipe-grid" aria-label="Recipes">
        {shown.map((r) => {
          const ok = client.canCraft(r.id);
          return (
            <button
              key={r.id}
              className={`recipe-tile${ok ? ' ok' : st[r.station] ? '' : ' away'}${sel?.id === r.id ? ' sel' : ''}${want === r.id && sel?.id !== r.id ? ' tut-glow' : ''}`}
              onClick={() => choose(r.id)}
              aria-label={ITEMS[r.out]?.name ?? r.out}
              title={ITEMS[r.out]?.name}
            >
              <ItemIcon id={r.out} className="slot-icon" />
              {r.n > 1 && <span className="slot-n">{r.n}</span>}
            </button>
          );
        })}
        {shown.length === 0 && (
          <p className="muted small-text">Nothing here you can make with what you carry.</p>
        )}
      </div>
      {sel && <RecipeDetail client={client} r={sel} glow={want === sel.id} />}
    </div>
  );
}

function RecipeDetail({ client, r, glow }: { client: GameClient; r: Recipe; glow: boolean }) {
  const def = ITEMS[r.out];
  const at = client.stations()[r.station];
  const most = client.craftMax(r.id);
  const where =
    r.station === 'hand'
      ? 'By hand, anywhere'
      : at
        ? `At the ${STATION_NAMES[r.station].toLowerCase()}`
        : r.station === 'fire'
          ? 'Needs a lit campfire nearby'
          : r.station === 'pot'
            ? 'Needs a cooking pot by a lit campfire'
            : r.station === 'mash'
              ? 'Needs a Mashbench nearby (built at a workbench)'
              : 'Needs a workbench nearby';
  return (
    <div className="recipe-detail">
      <ItemDetail def={def} count={r.n} />
      <div className="recipe-needs-list">
        {Object.entries(r.needs).map(([id, n]) => {
          const have = client.craftCount(id);
          return (
            <div key={id} className={`need-row${have >= n ? ' have' : ' need'}`}>
              <ItemIcon id={id} className="need-icon" />
              <span className="need-name">{ITEMS[id]?.name ?? id}</span>
              <span className="need-count">
                {Math.min(have, n)}/{n}
              </span>
            </div>
          );
        })}
        <div className={`need-row${at ? ' have' : ' need'}`}>
          <span className="need-icon station">{at ? '✓' : '✗'}</span>
          <span className="need-name">{where}</span>
        </div>
      </div>
      <div className="item-actions">
        <button
          className={`btn small primary${glow && most >= 1 ? ' tut-glow' : ''}`}
          disabled={most < 1}
          onClick={() => client.craft(r.id)}
        >
          Craft
        </button>
        <button
          className="btn small"
          disabled={most < 2}
          onClick={() => client.craft(r.id, Math.min(5, most))}
        >
          ×{Math.max(2, Math.min(5, most))}
        </button>
        <button
          className="btn small"
          disabled={most < 6}
          onClick={() => client.craft(r.id, Math.min(20, most))}
        >
          All ({Math.min(20, most)})
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skills: four branches, three tiers each.

let lastBranch: BranchId = 'gather';

function SkillsTab({ client }: { client: GameClient }) {
  const [branch, setBranch] = useState<BranchId>(lastBranch);
  const [pick, setPick] = useState<PerkId | null>(null);
  const me = client.me;
  if (!me) return null;
  const p = client.progress();
  const perks = me.perks;
  const def = BRANCHES.find((b) => b.id === branch) ?? BRANCHES[0];
  const chosen = pick && PERK_BY_ID[pick]?.branch === branch ? PERK_BY_ID[pick] : undefined;
  return (
    <div className="skills">
      <div className="skills-top">
        <XpBar client={client} />
        <div className={`skill-points${p.points > 0 ? ' some' : ''}`}>
          {p.points > 0
            ? `⭐ ${p.points} skill point${p.points > 1 ? 's' : ''} to spend`
            : 'Earn XP to level up: gather, craft, build, farm, fight, and survive the nights.'}
        </div>
      </div>
      <div className="branch-tabs" role="tablist" aria-label="Skill branches">
        {BRANCHES.map((b) => (
          <button
            key={b.id}
            role="tab"
            aria-selected={branch === b.id}
            className={`branch-tab${branch === b.id ? ' on' : ''}`}
            onClick={() => {
              lastBranch = b.id;
              setBranch(b.id);
              setPick(null);
            }}
          >
            <ItemIcon id={b.icon} className="branch-icon" />
            <span>{b.name}</span>
            <span className="branch-spent">{spent(perks, b.id)}</span>
          </button>
        ))}
      </div>
      <p className="muted small-text">{def?.blurb}</p>
      <div className="skill-tree">
        {([1, 2, 3] as const).map((tier) => {
          const need = TIER_POINTS[tier - 1] ?? 0;
          const open = spent(perks, branch) >= need;
          return (
            <div key={tier} className={`skill-tier${open ? '' : ' locked'}`}>
              <div className="tier-label">
                Tier {tier}
                {need > 0 && (
                  <span className="muted">
                    {' '}
                    · {open ? 'open' : `${need} points in ${def?.name}`}
                  </span>
                )}
              </div>
              <div className="tier-perks">
                {PERKS.filter((k) => k.branch === branch && k.tier === tier).map((k) => {
                  const rank = rankOf(perks, k.id);
                  const can = !cantLearn(perks, me.xp, k.id);
                  return (
                    <button
                      key={k.id}
                      className={`perk${rank > 0 ? ' has' : ''}${can ? ' can' : ''}${chosen?.id === k.id ? ' sel' : ''}`}
                      onClick={() => setPick(k.id)}
                      aria-label={`${k.name}, rank ${rank} of ${k.max}`}
                    >
                      <ItemIcon id={k.icon} className="perk-icon" />
                      <span className="perk-name">{k.name}</span>
                      <span className="perk-pips">
                        {Array.from({ length: k.max }, (_, i) => (
                          <i key={i} className={i < rank ? 'on' : ''} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {chosen ? (
        <div className="perk-detail">
          <div className="item-head">
            <ItemIcon id={chosen.icon} className="item-icon" />
            <div>
              <div className="item-name">
                {chosen.name}{' '}
                <span className="muted">
                  rank {rankOf(perks, chosen.id)}/{chosen.max}
                </span>
              </div>
              <div className="item-desc">
                {rankOf(perks, chosen.id) > 0
                  ? `Now: ${chosen.text(rankOf(perks, chosen.id))}`
                  : chosen.text(1)}
              </div>
              {rankOf(perks, chosen.id) > 0 && rankOf(perks, chosen.id) < chosen.max && (
                <div className="item-desc">Next: {chosen.text(rankOf(perks, chosen.id) + 1)}</div>
              )}
            </div>
          </div>
          <LearnButton client={client} id={chosen.id} />
        </div>
      ) : (
        <p className="muted small-text">Tap a skill to see what it does.</p>
      )}
    </div>
  );
}

function LearnButton({ client, id }: { client: GameClient; id: PerkId }) {
  const me = client.me;
  if (!me) return null;
  const why = cantLearn(me.perks, me.xp, id);
  return (
    <div className="item-actions">
      <button className="btn small primary" disabled={!!why} onClick={() => client.learn(id)}>
        Learn (1 point)
      </button>
      {why && <span className="muted small-text">{why}</span>}
    </div>
  );
}
