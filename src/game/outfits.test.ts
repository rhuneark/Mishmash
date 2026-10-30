import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COATS, HATS, lookCode, parseLook, shirtOf, unlocked, wearable } from './outfits';
import { PACKS, SETS, packsFor, shopConfig } from './shop';
import { newRecords } from './records';

describe('outfits', () => {
  it('reads looks from untrusted codes', () => {
    expect(parseLook('cap.khaki')).toEqual({ hat: 'cap', coat: 'khaki' });
    expect(parseLook('crown.gold')).toEqual({ hat: 'none', coat: 'auto' });
    expect(parseLook(42)).toEqual({ hat: 'none', coat: 'auto' });
    expect(lookCode(parseLook('tophat.midnight'))).toBe('tophat.midnight');
    expect(new Set(HATS.map((h) => h.id)).size).toBe(HATS.length);
    expect(new Set(COATS.map((c) => c.id)).size).toBe(COATS.length);
    for (const id of [...HATS, ...COATS].map((o) => o.id)) expect(id).not.toContain('.');
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
    expect(wearable({ hat: 'hood', coat: 'teal' }, r, none)).toEqual({ hat: 'none', coat: 'teal' });
    expect(shirtOf({ hat: 'none', coat: 'auto' }, 0x123456)).toBe(0x123456);
    expect(shirtOf({ hat: 'none', coat: 'teal' }, 0x123456)).toBe(0x5fd3d0);
  });

  it('sells every shop outfit in a set, and the bundle only while no set is owned', () => {
    for (const o of [...HATS, ...COATS])
      if (o.unlock.by === 'shop') expect(SETS as readonly string[]).toContain(o.unlock.pack);
    expect(packsFor(new Set()).map((p) => p.id)).toEqual(PACKS.map((p) => p.id));
    expect(packsFor(new Set(['outfit_night'])).map((p) => p.id)).toEqual([
      'outfit_verdance',
      'outfit_captain',
    ]);
    expect(packsFor(new Set(SETS))).toEqual([]);
    const bundle = PACKS.find((p) => p.sets.length > 1)!;
    const singles = PACKS.filter((p) => p.sets.length === 1).reduce((n, p) => n + p.bits, 0);
    expect(bundle.bits).toBeLessThan(singles);
  });

  it('rundot/shop.config.json matches the catalog (run npm run shop-config)', () => {
    const file: unknown = JSON.parse(
      readFileSync(new URL('../../rundot/shop.config.json', import.meta.url), 'utf8'),
    );
    expect(file).toEqual(shopConfig());
  });
});
