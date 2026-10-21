// Save data: a JSON string in appStorage under SAVE_KEY. parseSave must keep
// accepting every older save (migrate, don't break).

export const SAVE_KEY = 'mishmash_save';
export const SAVE_VERSION = 1;

export interface SaveData {
  v: number;
  /** Times the game has been opened. */
  visits: number;
  /** The intro has been read (it then stays under About). */
  introSeen: boolean;
}

export function newSave(): SaveData {
  return { v: SAVE_VERSION, visits: 0, introSeen: false };
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
  const fields = data as Record<string, unknown>;
  const visits = fields['visits'];
  if (typeof visits === 'number' && Number.isFinite(visits) && visits >= 0) {
    save.visits = Math.floor(visits);
  }
  save.introSeen = fields['introSeen'] === true;
  return save;
}

export function recordVisit(save: SaveData): SaveData {
  return { ...save, visits: save.visits + 1 };
}
