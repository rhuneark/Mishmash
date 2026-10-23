// The bag and craft window: pops up to the top right of the survivor and stays
// open while you move, fight and gather, so you can craft and sort your bag
// without stopping.

import { useState, type CSSProperties } from 'react';
import { ITEMS } from '../../game/content/items';
import { HOTBAR, INV_SIZE } from '../../game/sim/inventory';
import type { GameClient } from '../client';
import { usePrefs } from '../prefs';
import { RecipeRow, sortedRecipes } from './Craft';
import { ItemIcon, SlotButton, quickUse } from './Slots';

/**
 * Where the window goes: its bottom-left corner just above and right of the survivor's
 * head (client.anchor, from the view), kept on screen, clear of the minimap when upright
 * and of the action buttons when sideways.
 */
export function QuickWindow({ client, pc }: { client: GameClient; pc: boolean }) {
  const s = usePrefs();
  const a = client.anchor;
  const w = a.w || window.innerWidth;
  const h = a.h || window.innerHeight;
  const x = a.w ? a.x : w / 2;
  const y = a.w ? a.y : h * 0.55;
  const landscape = w > h;
  const buttons = s.hud === 'large' ? 210 : 188;
  const width = Math.min(w - 16, 312);
  const minLeft = landscape && s.leftHanded ? buttons : 8;
  const maxLeft = w - width - (landscape && !s.leftHanded ? buttons : 8);
  const left = Math.max(minLeft, Math.min(x + 16, maxLeft));
  const bottom = Math.max(8, h - y + 14);
  const room = landscape ? 8 : s.hud === 'large' ? 176 : 164;
  const style = {
    left,
    bottom,
    width,
    maxHeight: `max(150px, calc(${h - bottom - room}px - var(--safe-top)))`,
    '--tail': `${Math.max(18, Math.min(width - 18, x - left))}px`,
  } as CSSProperties;
  return (
    <div className="quick-window" style={style}>
      <QuickPanel client={client} pc={pc} />
    </div>
  );
}

export function QuickPanel({ client, pc }: { client: GameClient; pc: boolean }) {
  const tab = client.quickTab;
  const setTab = (t: 'bag' | 'craft') => {
    client.quickTab = t;
    client.touch();
  };
  return (
    <div className="quick-panel" data-panel="quick">
      <div className="quick-head">
        <div className="tabs">
          <button
            className={`tab-btn small${tab === 'bag' ? ' on' : ''}`}
            onClick={() => setTab('bag')}
          >
            Bag
          </button>
          <button
            className={`tab-btn small${tab === 'craft' ? ' on' : ''}`}
            onClick={() => setTab('craft')}
          >
            Craft
          </button>
        </div>
        <div className="quick-head-buttons">
          <button
            className="round-btn"
            onClick={() => client.openPanel(tab === 'bag' ? 'bag' : 'craft')}
            aria-label="Open the full screen"
            title="Open the full screen"
          >
            ⤢
          </button>
          <button
            className="round-btn"
            onClick={() => client.toggleQuick()}
            aria-label="Close the bag window"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="quick-body">
        {tab === 'bag' ? <QuickBag client={client} pc={pc} /> : <QuickCraft client={client} />}
      </div>
    </div>
  );
}

function QuickBag({ client, pc }: { client: GameClient; pc: boolean }) {
  const me = client.me;
  const [sel, setSel] = useState<number | null>(null);
  if (!me) return null;
  const slot = sel !== null ? (me.inv[sel] ?? null) : null;
  const def = slot ? ITEMS[slot.id] : undefined;
  return (
    <>
      <div className="slot-grid quick-grid">
        {Array.from({ length: INV_SIZE - HOTBAR }, (_, k) => HOTBAR + k).map((i) => (
          <SlotButton
            key={i}
            client={client}
            slotRef={{ area: 'inv', index: i }}
            slot={me.inv[i] ?? null}
            className={sel === i ? 'sel' : ''}
            onTap={() => setSel(sel === i ? null : i)}
            onContext={() => quickUse(client, i)}
          />
        ))}
      </div>
      {slot && def && sel !== null ? (
        <div className="quick-info">
          <ItemIcon id={slot.id} className="quick-info-icon" />
          <div className="quick-info-name">{def.name}</div>
          <div className="quick-info-actions">
            {(def.food || def.heal) && (
              <button className="btn small primary" onClick={() => client.eat(sel)}>
                {def.heal ? 'Use' : def.food && def.food.water > def.food.food ? 'Drink' : 'Eat'}
              </button>
            )}
            {sel < HOTBAR && me.held !== sel && (
              <button className="btn small" onClick={() => client.select(sel)}>
                Hold
              </button>
            )}
            {sel >= HOTBAR && (
              <button className="btn small" onClick={() => quickUse(client, sel)}>
                To hotbar
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="quick-hint">
          {pc
            ? 'Drag to the hotbar or the island. Right-click to use.'
            : 'Drag to the hotbar, or onto the island to drop.'}
        </p>
      )}
    </>
  );
}

function QuickCraft({ client }: { client: GameClient }) {
  const list = sortedRecipes(client);
  const ready = list.filter((r) => client.canCraft(r.id)).length;
  return (
    <>
      <div className="quick-note">
        {ready ? `${ready} you can craft right now` : 'Nothing to craft with what you carry here.'}
      </div>
      <div className="quick-recipes">
        {list.map((r) => (
          <RecipeRow key={r.id} client={client} r={r} compact />
        ))}
      </div>
    </>
  );
}
