// Weather: fair spells, clouds, rain, storms and fog, picked by the authority so everyone
// on the island sees the same sky. Rain waters crops and fills rain collectors, makes
// campfires burn faster, and quenches thirst; storms throw lightning; fog hides you
// (the Bloom notices you closer). How often comes from the climate and the world rule.

import type { Climate } from '../islands';
import type { Often } from '../rules';
import type { IslandSim } from './sim';

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog';
export const WEATHER_KINDS: WeatherKind[] = ['clear', 'cloudy', 'rain', 'storm', 'fog'];

export interface WeatherState {
  kind: WeatherKind;
  /** Island time it changes. */
  until: number;
}

/** How likely each weather is, by climate. */
const ODDS: Record<Climate, Record<WeatherKind, number>> = {
  tropic: { clear: 0.42, cloudy: 0.18, rain: 0.22, storm: 0.12, fog: 0.06 },
  autumn: { clear: 0.3, cloudy: 0.3, rain: 0.22, storm: 0.06, fog: 0.12 },
  pines: { clear: 0.26, cloudy: 0.24, rain: 0.15, storm: 0.05, fog: 0.3 },
  volcanic: { clear: 0.36, cloudy: 0.3, rain: 0.1, storm: 0.16, fog: 0.08 },
  overgrown: { clear: 0.28, cloudy: 0.2, rain: 0.32, storm: 0.1, fog: 0.1 },
};

/** Minutes a spell lasts (min..max). */
const LASTS: Record<WeatherKind, [number, number]> = {
  clear: [3, 6],
  cloudy: [2, 4],
  rain: [2, 4],
  storm: [1.5, 3],
  fog: [2, 4],
};

/** Rain and storms more or less often by the world rule. */
const WET: Record<Often, number> = { off: 0, rare: 0.45, normal: 1, often: 1.8 };

/** A new island starts fair for this long. */
export const FIRST_FAIR = 240;

/** The next spell after `prev` (never two storms in a row). */
export function nextWeather(
  climate: Climate,
  rule: Often,
  prev: WeatherKind,
  now: number,
  random: () => number,
): WeatherState {
  if (rule === 'off') return { kind: 'clear', until: now + 600 };
  const odds = { ...ODDS[climate] };
  odds.rain *= WET[rule];
  odds.storm *= WET[rule];
  odds.fog *= rule === 'rare' ? 0.6 : 1;
  if (prev === 'storm') odds.storm = 0;
  if (prev !== 'clear') odds.clear *= 1.4;
  const total = WEATHER_KINDS.reduce((s, k) => s + odds[k], 0);
  let r = random() * total;
  let kind: WeatherKind = 'clear';
  for (const k of WEATHER_KINDS) {
    r -= odds[k];
    if (r < 0) {
      kind = k;
      break;
    }
  }
  const [lo, hi] = LASTS[kind];
  return { kind, until: now + (lo + random() * (hi - lo)) * 60 };
}

export function parseWeather(raw: unknown, now: number): WeatherState {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kind = WEATHER_KINDS.includes(d['kind'] as WeatherKind) ? (d['kind'] as WeatherKind) : null;
  const until = typeof d['until'] === 'number' && Number.isFinite(d['until']) ? d['until'] : 0;
  return kind ? { kind, until } : { kind: 'clear', until: now + FIRST_FAIR };
}

export const WEATHER_NEWS: Partial<Record<WeatherKind, string>> = {
  rain: '🌧️ Rain sweeps in. Crops and rain collectors drink it up.',
  storm: '⛈️ A storm is coming in! Get under a roof, away from tall trees.',
  fog: '🌫️ A thick fog rolls in. The Bloom will only notice you up close.',
};

/** Changes the weather when its time comes, and throws lightning in storms. */
export function runWeather(sim: IslandSim): void {
  const w = sim.weather;
  if (sim.time >= w.until) {
    const next = nextWeather(sim.parts.climate, sim.rules.weather, w.kind, sim.time, sim.random);
    const changed = next.kind !== w.kind;
    sim.weather = next;
    sim.broadcast({ type: 'weather', w: next.kind });
    const news = changed ? WEATHER_NEWS[next.kind] : undefined;
    if (news) sim.broadcast({ type: 'toast', text: news });
  }
  if (sim.weather.kind === 'storm' && sim.random() < 1 / 18) lightning(sim);
}

/** A bolt near a random survivor: it hurts what it hits, and fells trees. */
function lightning(sim: IslandSim): void {
  const ids = [...sim.online].filter((id) => sim.players.get(id)?.alive);
  if (!ids.length) return;
  const p = sim.players.get(ids[Math.floor(sim.random() * ids.length)] as string);
  if (!p) return;
  const a = sim.random() * Math.PI * 2;
  const r = 8 + sim.random() * 26;
  const x = p.x + Math.sin(a) * r;
  const z = p.z + Math.cos(a) * r;
  if (sim.sheltered(x, z)) return;
  sim.fx('lightning', x, z);
  for (const q of sim.players.values()) {
    if (!sim.online.has(q.id) || !q.alive) continue;
    if (Math.hypot(q.x - x, q.z - z) < 2.2 && !sim.sheltered(q.x, q.z))
      sim.hurtPlayer(q, 30, x, z, false);
  }
  sim.strike(x, z);
}
