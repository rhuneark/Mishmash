// Item slots everywhere in the HUD: icon, count, durability, and drag and drop
// between the hotbar, bag, quick panel and storage boxes.

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { ITEMS } from '../../game/content/items';
import { HOTBAR } from '../../game/sim/inventory';
import type { Slot } from '../../game/sim/protocol';
import type { GameClient } from '../client';
import { drag, holdStill, slotKey, startSlotDrag, type DropTarget, type SlotRef } from './drag';
import { itemIconUrl } from './itemIcons';

export function ItemIcon({ id, className }: { id: string; className?: string }) {
  return <img className={className ?? 'icon'} src={itemIconUrl(id)} alt="" draggable={false} />;
}

export function SlotView({ slot }: { slot: Slot | null }) {
  if (!slot) return null;
  const max = ITEMS[slot.id]?.durability;
  return (
    <>
      <ItemIcon id={slot.id} className="slot-icon" />
      {slot.n > 1 && <span className="slot-n">{slot.n}</span>}
      {max !== undefined && slot.d !== undefined && slot.d < max && (
        <span className="slot-dur">
          <span style={{ width: `${(slot.d / max) * 100}%` }} />
        </span>
      )}
    </>
  );
}

/** What happens when an item is let go over a slot or the ground. */
export function dropItem(client: GameClient, from: SlotRef, to: DropTarget): void {
  const me = client.me;
  if (!me) return;
  if (to === 'ground') {
    if (from.area !== 'inv') return;
    const s = me.inv[from.index];
    if (!s) return;
    if (ITEMS[s.id]?.quest) {
      client.toast('Keep that one: you need it to get off the island.');
      return;
    }
    client.dropSlot(from.index);
    return;
  }
  if (from.area === 'inv' && to.area === 'inv') {
    if (from.index !== to.index) client.moveSlot(from.index, to.index);
  } else if (from.area === 'inv' && to.area === 'box') {
    client.store(from.index, to.index);
  } else if (from.area === 'box' && to.area === 'inv') {
    client.take(from.index, to.index);
  }
}

/** Right click (PC): eat it, hold it, or bring it to the hotbar. */
export function quickUse(client: GameClient, index: number): void {
  const me = client.me;
  const s = me?.inv[index];
  const def = s ? ITEMS[s.id] : undefined;
  if (!me || !s || !def) return;
  if (def.food || def.heal) {
    client.eat(index);
  } else if (index < HOTBAR) {
    client.select(index);
  } else {
    let to = me.inv.findIndex((x, i) => i < HOTBAR && !x);
    if (to < 0) to = me.held;
    client.moveSlot(index, to);
  }
}

export function SlotButton(props: {
  client: GameClient;
  slotRef: SlotRef;
  slot: Slot | null;
  className?: string;
  onTap: () => void;
  onContext?: () => void;
  children?: ReactNode;
  title?: string;
  /** What the tutorial's pointer says at it (while it's lit). */
  tip?: string;
}) {
  const { client, slotRef, slot } = props;
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => (ref.current ? holdStill(ref.current) : undefined), []);
  const name = slot ? ITEMS[slot.id]?.name : undefined;
  // A bow shows how many arrows it has left.
  const shoots = slot ? ITEMS[slot.id]?.ranged?.ammo : undefined;
  const ammo = shoots
    ? (client.me?.inv ?? []).reduce((n, s) => n + (s && shoots.includes(s.id) ? s.n : 0), 0)
    : null;
  return (
    <button
      ref={ref}
      className={`slot${props.className ? ` ${props.className}` : ''}`}
      data-slot={slotKey(slotRef)}
      data-item={slot ? '' : undefined}
      data-tip={props.tip}
      title={props.title ?? name}
      aria-label={name ?? 'Empty slot'}
      onPointerDown={(e) =>
        startSlotDrag(e, slotRef, slot, (from, to) => dropItem(client, from, to))
      }
      onClick={() => {
        if (!drag.justEnded()) props.onTap();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        // A finger held down lifts the item (Android also calls that a context menu).
        if (!drag.pressing() && !drag.get()) props.onContext?.();
      }}
    >
      <SlotView slot={slot} />
      {ammo !== null && <span className={`slot-ammo${ammo ? '' : ' out'}`}>{ammo}</span>}
      {props.children}
    </button>
  );
}

/** The item under the finger or cursor while dragging, and the slot it would land in. */
export function DragLayer() {
  const state = useSyncExternalStore(drag.subscribe, drag.get);
  const over = state?.over && state.over !== 'ground' ? slotKey(state.over) : null;
  useEffect(() => {
    if (!over) return;
    const els = document.querySelectorAll<HTMLElement>(`[data-slot="${over}"]`);
    els.forEach((el) => el.classList.add('drop-over'));
    return () => els.forEach((el) => el.classList.remove('drop-over'));
  }, [over]);
  if (!state) return null;
  return (
    <div className="drag-ghost" style={{ transform: `translate(${state.x}px, ${state.y}px)` }}>
      <ItemIcon id={state.id} className="drag-icon" />
      {state.n > 1 && <span className="slot-n">{state.n}</span>}
      {state.over === 'ground' && <span className="drag-hint">Drop on the ground</span>}
    </div>
  );
}
