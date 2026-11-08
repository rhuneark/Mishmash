import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BASE_STYLES,
  COATS,
  DEFAULT_LOOK,
  FLAMES,
  HATS,
  PET_GEAR,
  lookCode,
  parseLook,
  shirtOf,
  unlocked,
  wearable,
} from './outfits';
import { PACKS, SETS, packsFor, shopConfig } from './shop';
import { newRecords } from './records';

describe('outfits', () => {
  it('reads looks from untrusted codes', () => {
    // Codes from before base styles, pet gear and flames still read.
    expect(parseLook('cap.khaki')).toEqual({ ...DEFAULT_LOOK, hat: 'cap', coat: 'khaki' });
    expect(parseLook('crown.gold')).toEqual(DEFAULT_LOOK);
    expect(parseLook(42)).toEqual(DEFAULT_LOOK);
    expect(parseLook('cap.khaki.cabin.bandana.blue')).toEqual({
      hat: 'cap',
      coat: 'khaki',
      base: 'cabin',
      pet: 'bandana',
      flame: 'blue',
    });
    expect(parseLook('cap.khaki.castle.bow.pink')).toEqual({
      ...DEFAULT_LOOK,
      hat: 'cap',
      coat: 'khaki',
    });
    const full = 'captain.midnight.driftwood.bandana.violet';
    expect(lookCode(parseLook(full))).toBe(full);
    for (const list of [HATS, COATS, BASE_STYLES, PET_GEAR, FLAMES]) {
      expect(new Set(list.map((o) => o.id)).size).toBe(list.length);
      for (const o of list) expect(o.id).not.toContain('.');
    }
  });

  it('unlocks by records and by shop sets', () => {
    const r = newRecords();
    const none = new Set<string>();
    const cap = HATS.find((h) => h.id === 'cap')!;
    expect(unlocked(cap.unlock, r, none)).toBe(false);
    expect(unlocked(cap.unlock, { ...r, bestDay: 5 }, none)).toBe(true);
    const hood = HATS.find((h) => h.id === 'hood')!;
    expect(unlocked(hood.unlock, r, none)).toBe(false);
    expect(unlocked(hood.unlock, r, new Set(['outfit_verdance']))).toBe(true);
    // What isn't the player's comes off.
    const worn = { ...DEFAULT_LOOK, hat: 'hood', coat: 'teal', base: 'cabin', flame: 'blue' };
    expect(wearable(worn, r, none)).toEqual({ ...DEFAULT_LOOK, coat: 'teal' });
    expect(wearable(worn, r, new Set(['base_cabin', 'fire_colours']))).toEqual({
      ...worn,
      hat: 'none',
    });
    expect(shirtOf(DEFAULT_LOOK, 0x123456)).toBe(0x123456);
    expect(shirtOf({ ...DEFAULT_LOOK, coat: 'teal' }, 0x123456)).toBe(0x5fd3d0);
  });

  it('sells every shop outfit in a set, and the bundle only while no set is owned', () => {
    for (const o of [...HATS, ...COATS, ...BASE_STYLES, ...PET_GEAR, ...FLAMES])
      if (o.unlock.by === 'shop') {
        const pack = o.unlock.pack;
        expect(SETS as readonly string[]).toContain(pack);
        expect(PACKS.some((p) => (p.sets as readonly string[]).includes(pack))).toBe(true);
      }
    expect(packsFor(new Set()).map((p) => p.id)).toEqual(PACKS.map((p) => p.id));
    const outfits = (owned: string[]) =>
      packsFor(new Set(owned))
        .filter((p) => p.kind === 'outfit')
        .map((p) => p.id);
    expect(outfits(['outfit_night'])).toEqual(['outfit_verdance', 'outfit_captain']);
    expect(packsFor(new Set(SETS))).toEqual([]);
    const bundle = PACKS.find((p) => p.sets.length > 1)!;
    const singles = PACKS.filter((p) => p.kind === 'outfit' && p.sets.length === 1).reduce(
      (n, p) => n + p.bits,
      0,
    );
    expect(bundle.bits).toBeLessThan(singles);
    // Every pack sells something, once.
    expect(new Set(PACKS.map((p) => p.id)).size).toBe(PACKS.length);
    for (const set of SETS) expect(PACKS.some((p) => p.sets.includes(set))).toBe(true);
  });

  it('rundot/shop.config.json matches the catalog (run npm run shop-config)', () => {
    const file: unknown = JSON.parse(
      readFileSync(new URL('../../rundot/shop.config.json', import.meta.url), 'utf8'),
    );
    expect(file).toEqual(shopConfig());
  });
});
