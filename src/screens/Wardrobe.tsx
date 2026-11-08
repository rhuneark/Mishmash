// 👕 Wardrobe: what your survivor wears on every island, and how what they build and tame
// looks (looks only). Free outfits, ones your records earn (records.ts), and the shop for RUN
// Bits: outfit sets, base styles, pet gear, fire colours, more islands and the Gold Card.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as run from '../sdk/run';
import {
  BASE_STYLES,
  COATS,
  FLAMES,
  HATS,
  PET_GEAR,
  coatOf,
  hatOf,
  shirtOf,
  unlocked,
  wearable,
  type Extra,
  type Look,
  type Unlock,
} from '../game/outfits';
import { FLAME_PAINT, styleSwatch } from '../game/paints';
import { PACKS, packsFor, type Pack, type PackKind } from '../game/shop';
import { colorFor } from '../game/sim/types';
import { buyPack, loadOutfits, outfitStore, syncOwned, wear } from '../play/outfits';
import { loadRecords, recordsStore } from '../play/records';
import { playerId } from '../play/slots';
import { WardrobeScene } from '../play/WardrobeScene';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function Wardrobe() {
  const { look, owned } = useSyncExternalStore(outfitStore.subscribe, outfitStore.get);
  const records = useSyncExternalStore(recordsStore.subscribe, recordsStore.get);
  const [tab, setTab] = useState<Tab>('hat');
  const [trying, setTrying] = useState<Look | null>(null);
  const [prices, setPrices] = useState<Map<string, run.ShopPrice> | null>(null);
  const [buying, setBuying] = useState('');
  const [note, setNote] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<WardrobeScene | null>(null);
  const me = playerId();
  const worn = wearable(look, records, owned);
  const shown = trying ?? worn;

  useEffect(() => {
    void loadRecords();
    void loadOutfits().then(() => syncOwned());
    void run.shopPrices().then(setPrices);
  }, []);

  const shownRef = useRef(shown);
  shownRef.current = shown;
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let s: WardrobeScene | null = null;
    // A moment later, as on the title: the page paints first (and a WebGL context isn't
    // made and lost again when React mounts twice in development).
    const timer = setTimeout(() => {
      try {
        s = new WardrobeScene(el, me, colorFor(me));
        s.wear(shownRef.current);
        s.start();
        scene.current = s;
      } catch {
        s = null;
      }
    }, 60);
    return () => {
      clearTimeout(timer);
      s?.dispose();
      scene.current = null;
    };
  }, [me]);

  useEffect(() => {
    scene.current?.wear(shown);
  }, [shown.hat, shown.coat]);

  const has = (u: Unlock) => unlocked(u, records, owned);
  const pick = (part: Partial<Look>) => {
    const next = { ...worn, ...part };
    setNote('');
    if (unlocksOf(part).every(has)) {
      setTrying(null);
      wear(next);
    } else setTrying(next);
  };
  const locked = trying ? (unlocksOf(trying).find((u) => !has(u)) ?? null) : null;
  const lockedPack = locked?.by === 'shop' ? PACKS.find((p) => p.id === locked.pack) : undefined;
  const price = (p: Pack) => prices?.get(p.id)?.bits ?? p.bits;

  const buy = async (p: Pack) => {
    setBuying(p.id);
    setNote('');
    const outcome = await buyPack(p);
    setBuying('');
    if (outcome === 'done') {
      setNote(`✓ ${p.name}: yours, on every island.`);
      if (trying) {
        wear(trying);
        setTrying(null);
      }
    } else if (outcome === 'pending') setNote('The purchase is on its way. It shows up here soon.');
    else if (outcome === 'failed') setNote("The shop couldn't be reached. Nothing was charged.");
  };

  const offers = packsFor(owned);
  return (
    <div className="wardrobe">
      <div className="card wardrobe-preview">
        <canvas ref={canvas} className="wardrobe-canvas" aria-label="Your survivor" />
        <div className="wardrobe-wearing">
          {hatOf(shown.hat).name} · {coatOf(shown.coat).name}
          {trying && <span className="muted"> (trying on)</span>}
        </div>
        <div className="wardrobe-wearing muted small-text">
          🏠 {nameOf(BASE_STYLES, shown.base)} · 🐾 {nameOf(PET_GEAR, shown.pet)} · 🔥{' '}
          {nameOf(FLAMES, shown.flame)}
        </div>
        {locked && (
          <div className="wardrobe-lock">
            {locked.by === 'record' ? (
              <span>🔒 {locked.text} to wear it.</span>
            ) : lockedPack ? (
              <button
                className="btn small primary"
                disabled={!!buying}
                onClick={() => void buy(lockedPack)}
              >
                {buying === lockedPack.id
                  ? 'Opening the shop…'
                  : `Get ${lockedPack.name} · ${price(lockedPack)} Bits`}
              </button>
            ) : null}
            <button className="btn small" onClick={() => setTrying(null)}>
              Take it off
            </button>
          </div>
        )}
      </div>

      <div className="segmented small wardrobe-tabs" role="tablist" aria-label="Wardrobe">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`segment${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="wardrobe-grid">
        {tab === 'hat' &&
          HATS.map((h) => (
            <button
              key={h.id}
              className={`wardrobe-tile${shown.hat === h.id ? ' on' : ''}${has(h.unlock) ? '' : ' locked'}`}
              onClick={() => pick({ hat: h.id })}
            >
              <span className="wardrobe-name">{h.name}</span>
              <span className="wardrobe-how">{howTo(h.unlock, has(h.unlock))}</span>
            </button>
          ))}
        {tab === 'coat' &&
          COATS.map((c) => (
            <button
              key={c.id}
              className={`wardrobe-tile${shown.coat === c.id ? ' on' : ''}${has(c.unlock) ? '' : ' locked'}`}
              onClick={() => pick({ coat: c.id })}
            >
              <span
                className="wardrobe-swatch"
                style={{
                  background: hex(shirtOf({ ...worn, coat: c.id }, colorFor(me))),
                  borderColor: hex(c.pants),
                }}
                aria-hidden="true"
              />
              <span className="wardrobe-name">{c.name}</span>
              <span className="wardrobe-how">{howTo(c.unlock, has(c.unlock))}</span>
            </button>
          ))}
        {tab !== 'hat' &&
          tab !== 'coat' &&
          EXTRAS[tab].list.map((e) => {
            const key = EXTRAS[tab].part;
            return (
              <button
                key={e.id}
                className={`wardrobe-tile${shown[key] === e.id ? ' on' : ''}${has(e.unlock) ? '' : ' locked'}`}
                onClick={() => pick({ [key]: e.id })}
              >
                <Swatch tab={tab} id={e.id} />
                <span className="wardrobe-name">{e.name}</span>
                <span className="wardrobe-how">{howTo(e.unlock, has(e.unlock))}</span>
              </button>
            );
          })}
      </div>

      {offers.length > 0 && (
        <div className="card wardrobe-shop" aria-label="Shop">
          {SHOP_GROUPS.map((g) => {
            const list = offers.filter((p) => g.kinds.includes(p.kind));
            if (!list.length) return null;
            return (
              <div key={g.label} className="wardrobe-shop-group">
                <div className="label">{g.label}</div>
                {list.map((p) => (
                  <div key={p.id} className="wardrobe-pack">
                    <div>
                      <div className="wardrobe-name">{p.name}</div>
                      <div className="muted small-text">{p.blurb}</div>
                    </div>
                    <button
                      className="btn small primary"
                      disabled={!!buying}
                      aria-label={`Buy ${p.name}`}
                      onClick={() => void buy(p)}
                    >
                      {buying === p.id ? '…' : `${price(p)} Bits`}
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
          {run.shopTestMode() && (
            <p className="muted small-text">Test mode: purchases are free here and not kept.</p>
          )}
        </div>
      )}
      {note && <p className="center small-text">{note}</p>}
      <p className="muted small-text">
        Outfits, base styles, pet gear and fire colours are looks only: everyone on your island sees
        them, and they never change how you play.
      </p>
    </div>
  );
}

type Tab = 'hat' | 'coat' | 'base' | 'pet' | 'fire';

const TABS: { id: Tab; label: string }[] = [
  { id: 'hat', label: '🎩 Hats' },
  { id: 'coat', label: '👕 Coats' },
  { id: 'base', label: '🏠 Base' },
  { id: 'pet', label: '🐾 Pets' },
  { id: 'fire', label: '🔥 Fire' },
];

const EXTRAS: Record<
  'base' | 'pet' | 'fire',
  { list: readonly Extra[]; part: 'base' | 'pet' | 'flame' }
> = {
  base: { list: BASE_STYLES, part: 'base' },
  pet: { list: PET_GEAR, part: 'pet' },
  fire: { list: FLAMES, part: 'flame' },
};

const SHOP_GROUPS: { label: string; kinds: PackKind[] }[] = [
  { label: 'Outfit sets', kinds: ['outfit'] },
  { label: 'Base styles', kinds: ['base'] },
  { label: 'Pets and fire', kinds: ['pet', 'fire'] },
  { label: 'Extras', kinds: ['extra'] },
];

const PET_ICON: Record<string, string> = { none: '🐕', collar: '🔴', bandana: '🧣', tophat: '🎩' };

function nameOf(list: readonly Extra[], id: string): string {
  return list.find((e) => e.id === id)?.name ?? '';
}

/** What it takes to wear each part of a look that's given. */
function unlocksOf(part: Partial<Look>): Unlock[] {
  const out: Unlock[] = [];
  if (part.hat !== undefined) out.push(hatOf(part.hat).unlock);
  if (part.coat !== undefined) out.push(coatOf(part.coat).unlock);
  const extra = (list: readonly Extra[], id?: string) => {
    const e = id !== undefined ? list.find((x) => x.id === id) : undefined;
    if (e) out.push(e.unlock);
  };
  extra(BASE_STYLES, part.base);
  extra(PET_GEAR, part.pet);
  extra(FLAMES, part.flame);
  return out;
}

/** A base style's paint chips, a flame's colours, or what a pet wears. */
function Swatch({ tab, id }: { tab: 'base' | 'pet' | 'fire'; id: string }) {
  if (tab === 'pet')
    return (
      <span className="wardrobe-swatch wardrobe-emoji" aria-hidden="true">
        {PET_ICON[id] ?? '🐕'}
      </span>
    );
  const cols =
    tab === 'base'
      ? styleSwatch(id)
      : [FLAME_PAINT[id]?.outer ?? 0, FLAME_PAINT[id]?.mid ?? 0, FLAME_PAINT[id]?.core ?? 0];
  return (
    <span
      className="wardrobe-swatch"
      style={{
        background: `linear-gradient(90deg, ${cols.map((c, i) => `${hex(c)} ${(i * 100) / 3}% ${((i + 1) * 100) / 3}%`).join(', ')})`,
      }}
      aria-hidden="true"
    />
  );
}

function howTo(u: Unlock, has: boolean): string {
  if (has) return u.by === 'free' ? 'Free' : '✓ Yours';
  if (u.by === 'record') return `🔒 ${u.text}`;
  if (u.by === 'free') return 'Free';
  const pack = PACKS.find((p) => p.id === u.pack);
  return `🔒 ${pack?.name ?? 'Shop'}`;
}
