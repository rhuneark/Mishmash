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
  /** The island save slot played last (1…ISLAND_SLOTS). */
  slot: number;
  /** The newest What's new the player has seen (news.ts version). */
  newsSeen: string;
}

/** Islands a player can keep side by side. */
export const ISLAND_SLOTS = 3;

export function newSave(): SaveData {
  return { v: SAVE_VERSION, visits: 0, introSeen: false, slot: 1, newsSeen: '' };
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
  const slot = fields['slot'];
  if (typeof slot === 'number' && Number.isInteger(slot) && slot >= 1 && slot <= ISLAND_SLOTS)
    save.slot = slot;
  if (typeof fields['newsSeen'] === 'string') save.newsSeen = fields['newsSeen'].slice(0, 16);
  return save;
}

export function recordVisit(save: SaveData): SaveData {
  return { ...save, visits: save.visits + 1 };
}
