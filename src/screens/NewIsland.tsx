// Making a new island: pick its climate, terrain and layout (or roll them), see its
// map, and set its world rules before the plane goes down.

import { useEffect, useRef, useState } from 'react';
import {
  CLIMATES,
  CLIMATE_NAMES,
  TERRAINS,
  TERRAIN_NAMES,
  islandName,
  parseSpecCode,
  randomParts,
  specCode,
  type Climate,
  type IslandSpec,
  type Terrain,
} from '../game/islands';
import { randomSeed } from '../game/rng';
import { DEFAULT_RULES, type WorldRules } from '../game/rules';
import { islandImage } from '../play/hud/map';
import { Choice, Toggle } from '../play/hud/Menu';
import { RulesEditor } from '../play/hud/RulesPanel';
import { islandFor, type NewIsland } from '../play/session';
import { CELL, GRID, HALF } from '../game/world';

const CLIMATE_ICONS: Record<Climate, string> = {
  tropic: '🌴',
  autumn: '🍂',
  pines: '🌲',
  volcanic: '🌋',
  overgrown: '🌺',
};

const TERRAIN_DESC: Record<Terrain, string> = {
  classic: 'Gentle hills and long beaches.',
  rugged: 'A jagged shore of coves and points.',
  islets: 'Little islands off the coast to wade out to.',
  highlands: 'More hills and a taller peak.',
  wetlands: 'More marsh and more pools.',
};

const TURNS = ['As charted', '¼ turn', '½ turn', '¾ turn'];

function rollSpec(): IslandSpec {
  return { seed: randomSeed(Math.random), ...randomParts(Math.random) };
}

export function NewIslandScreen({
  replacing,
  onBack,
  onStart,
}: {
  /** The saved island a new one replaces. */
  replacing: { day: number; name: string } | null;
  onBack: () => void;
  onStart: (fresh: NewIsland) => void;
}) {
  const [spec, setSpec] = useState<IslandSpec>(rollSpec);
  const [rules, setRules] = useState<WorldRules>({ ...DEFAULT_RULES });
  const [code, setCode] = useState('');
  const [codeBad, setCodeBad] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = (patch: Partial<IslandSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const name = islandName(spec);

  const applyCode = () => {
    const s = parseSpecCode(code);
    setCodeBad(!s);
    if (s) {
      setSpec(s);
      setCode('');
    }
  };

  const start = () => {
    if (replacing && !confirm) {
      setConfirm(true);
      return;
    }
    const { seed, ...parts } = spec;
    onStart({ seed, parts, rules });
  };

  return (
    <div className="menu-screen new-island" role="dialog" aria-label="New island">
      <div className="menu-card wide">
        <div className="menu-head">
          <button className="btn small" onClick={onBack}>
            ‹ Back
          </button>
          <div className="menu-head-title">🏝️ New island</div>
          <span className="menu-head-space" />
        </div>
        <div className="menu-scroll">
          <div className="island-pick">
            <MapPreview spec={spec} />
            <div className="island-card">
              <div className="island-name" data-testid="island-name">
                {name}
              </div>
              <div className="island-tags">
                <span>
                  {CLIMATE_ICONS[spec.climate]} {CLIMATE_NAMES[spec.climate]}
                </span>
                <span>{TERRAIN_NAMES[spec.terrain]}</span>
              </div>
              <div className="island-code">
                Code <b data-testid="island-code">{specCode(spec)}</b>
              </div>
              <div className="island-dice">
                <button className="btn small" onClick={() => setSpec(rollSpec())}>
                  🎲 Surprise me
                </button>
                <button
                  className="btn small"
                  onClick={() => set({ seed: randomSeed(Math.random) })}
                >
                  🔄 Same kind, new island
                </button>
              </div>
            </div>
          </div>

          <div className="rules-group">
            <div className="rules-title">🗺️ The island</div>
            <Choice
              label="Climate"
              value={spec.climate}
              options={CLIMATES.map((c) => ({
                id: c,
                label: `${CLIMATE_ICONS[c]} ${CLIMATE_NAMES[c]}`,
              }))}
              set={(climate) => set({ climate })}
            />
            <Choice
              label="Terrain"
              desc={TERRAIN_DESC[spec.terrain]}
              value={spec.terrain}
              options={TERRAINS.map((t) => ({ id: t, label: TERRAIN_NAMES[t] }))}
              set={(terrain) => set({ terrain })}
            />
            <Choice
              label="Layout"
              desc="Where the crash site, the peak, the marsh and the rest end up."
              value={String(spec.turn) as '0' | '1' | '2' | '3'}
              options={TURNS.map((label, i) => ({ id: String(i) as '0' | '1' | '2' | '3', label }))}
              set={(t) => set({ turn: Number(t) as 0 | 1 | 2 | 3 })}
            />
            <Toggle
              label="Mirrored"
              desc="Flips the layout east to west."
              on={spec.mirror}
              set={(mirror) => set({ mirror })}
            />
            <form
              className="set-row island-code-row"
              onSubmit={(e) => {
                e.preventDefault();
                applyCode();
              }}
            >
              <span className="set-text">
                <span className="set-label">Have an island code?</span>
                <span className="set-desc">
                  {codeBad
                    ? "That isn't an island code. It looks like AU-R2M-48213."
                    : 'Make the same island as a friend (it is under Menu › This island).'}
                </span>
                <span className="island-code-input">
                  <input
                    className="code-input small"
                    value={code}
                    maxLength={20}
                    autoCapitalize="characters"
                    autoComplete="off"
                    placeholder="AU-R2M-48213"
                    aria-label="Island code"
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      setCodeBad(false);
                    }}
                  />
                  <button className="btn small" type="submit" disabled={!code.trim()}>
                    Use
                  </button>
                </span>
              </span>
            </form>
          </div>

          <div className="rules-head">
            <div className="label">World rules</div>
            <p className="muted small-text">
              Picked now and kept with the island. Friends who join play by them.
            </p>
          </div>
          <RulesEditor rules={rules} set={setRules} />
        </div>
        <div className="new-island-foot">
          {confirm && replacing ? (
            <div className="card confirm">
              <p>
                This replaces {replacing.name} (day {replacing.day}). Sure?
              </p>
              <div className="row">
                <button className="btn small primary" onClick={start}>
                  Replace it
                </button>
                <button className="btn small" onClick={() => setConfirm(false)}>
                  Keep mine
                </button>
              </div>
            </div>
          ) : (
            <button className="menu-btn primary" onClick={start}>
              ✈️ Start on {name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The island's map, drawn once it's made (a moment after the last change). */
function MapPreview({ spec }: { spec: IslandSpec }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(true);
  const code = specCode(spec);
  useEffect(() => {
    setBusy(true);
    const timer = setTimeout(() => {
      const canvas = ref.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const island = islandFor(spec);
      const img = islandImage(island);
      const size = canvas.width;
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = '#1d4f72';
      ctx.fillRect(0, 0, size, size);
      // The island fills about 80% of the world square: crop to it.
      const crop = GRID * 0.1;
      ctx.drawImage(img, crop, crop, GRID - crop * 2, GRID - crop * 2, 0, 0, size, size);
      // Where the plane comes down.
      const k = size / (GRID - crop * 2);
      const x = ((island.spawn.x + HALF) / CELL - crop) * k;
      const y = ((island.spawn.z + HALF) / CELL - crop) * k;
      ctx.font = `${Math.round(size / 12)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✈️', x, y);
      setBusy(false);
    }, 220);
    return () => clearTimeout(timer);
  }, [code]);
  return (
    <div className="map-preview">
      <canvas ref={ref} width={360} height={360} aria-label="Map of the island" />
      {busy && <div className="map-busy">Charting the island…</div>}
    </div>
  );
}
