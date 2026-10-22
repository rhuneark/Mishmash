import { describe, expect, it } from 'vitest';
import { ITEM_IDS } from '../../game/content/items';
import { ITEM_ICONS, itemIconSvg } from './itemIcons';

describe('item icons', () => {
  it('has a picture for every item', () => {
    const missing = ITEM_IDS.filter((id) => !ITEM_ICONS[id]);
    expect(missing).toEqual([]);
  });

  it('has no pictures for items that no longer exist', () => {
    expect(Object.keys(ITEM_ICONS).filter((id) => !ITEM_IDS.includes(id))).toEqual([]);
  });

  it('builds a complete svg', () => {
    for (const id of ITEM_IDS) {
      const svg = itemIconSvg(id);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).not.toContain('undefined');
      expect(svg).not.toContain('NaN');
    }
  });
});
