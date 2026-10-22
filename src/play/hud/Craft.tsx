// Recipe rows shared by the quick panel and the full crafting sheet.

import { ITEMS } from '../../game/content/items';
import { RECIPE_LIST, STATION_NAMES, STATIONS, type Recipe } from '../../game/content/recipes';
import type { GameClient } from '../client';
import { ItemIcon } from './Slots';

export function StationChips({ client }: { client: GameClient }) {
  const st = client.stations();
  return (
    <div className="station-chips">
      {STATIONS.map((g) => (
        <span key={g} className={`chip${st[g] ? ' ok' : ''}`}>
          {st[g] ? '✓' : '✗'} {STATION_NAMES[g]}
        </span>
      ))}
    </div>
  );
}

/** Recipes ordered for quick crafting: craftable now, then at a station you're at, then the rest. */
export function sortedRecipes(client: GameClient): Recipe[] {
  const st = client.stations();
  const rank = (r: Recipe) => (client.canCraft(r.id) ? 0 : st[r.station] ? 1 : 2);
  return RECIPE_LIST.map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
    .map((x) => x.r);
}

export function RecipeRow({
  client,
  r,
  compact,
}: {
  client: GameClient;
  r: Recipe;
  compact?: boolean;
}) {
  const out = ITEMS[r.out];
  const ok = client.canCraft(r.id);
  const atStation = client.stations()[r.station];
  return (
    <div className={`recipe${ok ? ' ok' : ''}${compact ? ' compact' : ''}`}>
      <ItemIcon id={r.out} className="recipe-icon" />
      <div className="recipe-text">
        <div className="recipe-name">
          {out?.name}
          {r.n > 1 ? ` ×${r.n}` : ''}
          {!atStation && <span className="recipe-where"> · {STATION_NAMES[r.station]}</span>}
        </div>
        <div className="recipe-needs">
          {Object.entries(r.needs).map(([id, n]) => {
            const have = client.count(id);
            return (
              <span key={id} className={have >= n ? 'have' : 'need'} title={ITEMS[id]?.name}>
                <ItemIcon id={id} className="need-icon" /> {Math.min(have, n)}/{n}
              </span>
            );
          })}
        </div>
      </div>
      <button className="btn small primary" disabled={!ok} onClick={() => client.craft(r.id)}>
        Craft
      </button>
    </div>
  );
}
