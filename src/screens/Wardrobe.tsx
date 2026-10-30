// 👕 Wardrobe: what your survivor wears on every island (looks only). Free outfits, ones
// your records earn (records.ts), and three sets from the shop for RUN Bits.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as run from '../sdk/run';
import {
  COATS,
  HATS,
  coatOf,
  hatOf,
  shirtOf,
  unlocked,
  wearable,
  type Look,
  type Unlock,
} from '../game/outfits';
import { PACKS, packsFor, type Pack } from '../game/shop';
import { colorFor } from '../game/sim/types';
import { buyPack, loadOutfits, outfitStore, syncOwned, wear } from '../play/outfits';
import { loadRecords, recordsStore } from '../play/records';
import { playerId } from '../play/session';
import { WardrobeScene } from '../play/WardrobeScene';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function Wardrobe() {
  const { look, owned } = useSyncExternalStore(outfitStore.subscribe, outfitStore.get);
  const records = useSyncExternalStore(recordsStore.subscribe, recordsStore.get);
  const [tab, setTab] = useState<'hat' | 'coat'>('hat');
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
    const u = part.hat ? hatOf(part.hat).unlock : coatOf(part.coat ?? '').unlock;
    if (has(u)) {
      setTrying(null);
      wear(next);
    } else setTrying(next);
  };
  const locked = trying
    ? ([hatOf(trying.hat).unlock, coatOf(trying.coat).unlock].find((u) => !has(u)) ?? null)
    : null;
  const lockedPack = locked?.by === 'shop' ? PACKS.find((p) => p.id === locked.pack) : undefined;
  const price = (p: Pack) => prices?.get(p.id)?.bits ?? p.bits;

  const buy = async (p: Pack) => {
    setBuying(p.id);
    setNote('');
    const outcome = await buyPack(p);
    setBuying('');
    if (outcome === 'done') {
      setNote(`✓ ${p.name} is yours, on every island.`);
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
                  : `Get the ${lockedPack.name} · ${price(lockedPack)} Bits`}
              </button>
            ) : null}
            <button className="btn small" onClick={() => setTrying(null)}>
              Take it off
            </button>
          </div>
        )}
      </div>

      <div className="segmented small" role="tablist" aria-label="Wardrobe">
        <button
          role="tab"
          aria-selected={tab === 'hat'}
          className={`segment${tab === 'hat' ? ' active' : ''}`}
          onClick={() => setTab('hat')}
        >
          🎩 Hats
        </button>
        <button
          role="tab"
          aria-selected={tab === 'coat'}
          className={`segment${tab === 'coat' ? ' active' : ''}`}
          onClick={() => setTab('coat')}
        >
          👕 Coats
        </button>
      </div>
      <div className="wardrobe-grid">
        {tab === 'hat'
          ? HATS.map((h) => (
              <button
                key={h.id}
                className={`wardrobe-tile${shown.hat === h.id ? ' on' : ''}${has(h.unlock) ? '' : ' locked'}`}
                onClick={() => pick({ hat: h.id })}
              >
                <span className="wardrobe-name">{h.name}</span>
                <span className="wardrobe-how">{howTo(h.unlock, has(h.unlock))}</span>
              </button>
            ))
          : COATS.map((c) => (
              <button
                key={c.id}
                className={`wardrobe-tile${shown.coat === c.id ? ' on' : ''}${has(c.unlock) ? '' : ' locked'}`}
                onClick={() => pick({ coat: c.id })}
              >
                <span
                  className="wardrobe-swatch"
                  style={{
                    background: hex(shirtOf({ hat: 'none', coat: c.id }, colorFor(me))),
                    borderColor: hex(c.pants),
                  }}
                  aria-hidden="true"
                />
                <span className="wardrobe-name">{c.name}</span>
                <span className="wardrobe-how">{howTo(c.unlock, has(c.unlock))}</span>
              </button>
            ))}
      </div>

      {offers.length > 0 && (
        <div className="card wardrobe-shop">
          <div className="label">Outfit sets</div>
          {offers.map((p) => (
            <div key={p.id} className="wardrobe-pack">
              <div>
                <div className="wardrobe-name">{p.name}</div>
                <div className="muted small-text">{p.blurb}</div>
              </div>
              <button className="btn small primary" disabled={!!buying} onClick={() => void buy(p)}>
                {buying === p.id ? '…' : `${price(p)} Bits`}
              </button>
            </div>
          ))}
          {run.shopTestMode() && (
            <p className="muted small-text">Test mode: purchases are free here and not kept.</p>
          )}
        </div>
      )}
      {note && <p className="center small-text">{note}</p>}
      <p className="muted small-text">
        Outfits are looks only: everyone on your island sees them, and they never change how you
        play.
      </p>
    </div>
  );
}

function howTo(u: Unlock, has: boolean): string {
  if (has) return u.by === 'free' ? 'Free' : '✓ Yours';
  if (u.by === 'record') return `🔒 ${u.text}`;
  if (u.by === 'free') return 'Free';
  const pack = PACKS.find((p) => p.id === u.pack);
  return `🔒 ${pack?.name ?? 'Shop'}`;
}
