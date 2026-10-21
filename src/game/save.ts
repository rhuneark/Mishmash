// Save data: a JSON string in appStorage under SAVE_KEY. parseSave must keep
// accepting every older save (migrate, don't break).

export const SAVE_KEY = 'mishmash_save';
export const SAVE_VERSION = 1;

export interface SaveData {
  v: number;
  /** Times the game has been opened. */
  visits: number;
}

export function newSave(): SaveData {
  return { v: SAVE_VERSION, visits: 0 };
}

/** Parses a stored save; anything missing or broken falls back to defaults. */
export function parseSave(raw: string | null): SaveData {
  const save = newSave();
  if (!raw) return save;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return save;
  }
  if (!data || typeof data !== 'object') return save;
  const visits = (data as Record<string, unknown>)['visits'];
  if (typeof visits === 'number' && Number.isFinite(visits) && visits >= 0) {
    save.visits = Math.floor(visits);
  }
  return save;
}

export function recordVisit(save: SaveData): SaveData {
  return { ...save, visits: save.visits + 1 };
}
