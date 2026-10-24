import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../../game/content/buildings';
import { ITEM_IDS } from '../../game/content/items';
import { ITEM_ICONS, PIECE_ICONS, itemIconSvg } from './itemIcons';

const KINDS = Object.keys(BUILDINGS);

describe('item icons', () => {
  it('has a picture for every item', () => {
    const missing = ITEM_IDS.filter((id) => !ITEM_ICONS[id]);
    expect(missing).toEqual([]);
  });

  it('has no pictures for items that no longer exist', () => {
    expect(Object.keys(ITEM_ICONS).filter((id) => !ITEM_IDS.includes(id))).toEqual([]);
  });

  it('has a picture for every building piece', () => {
    const missing = KINDS.filter((kind) => !ITEM_ICONS[kind] && !PIECE_ICONS[kind]);
    expect(missing).toEqual([]);
  });

  it('has piece pictures only for buildings without an item picture', () => {
    const keys = Object.keys(PIECE_ICONS);
    expect(keys.filter((kind) => !KINDS.includes(kind))).toEqual([]);
    expect(keys.filter((kind) => ITEM_ICONS[kind])).toEqual([]);
  });

  it('builds a complete svg', () => {
    for (const id of [...ITEM_IDS, ...KINDS]) {
      const svg = itemIconSvg(id);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).not.toContain('undefined');
      expect(svg).not.toContain('NaN');
    }
  });
});
