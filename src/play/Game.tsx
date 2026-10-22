// The game screen: the 3D view, the frame loop and the HUD over it.

import { useEffect, useRef, useState } from 'react';
import * as run from '../sdk/run';
import { appEvents } from '../app/appEvents';
import { Sound } from './audio';
import type { GameClient } from './client';
import { Hud, useClient } from './hud/Hud';
import { Fog, islandImage } from './hud/map';
import { Input } from './input';
import { View } from './view';

const FOG_KEY = 'mishmash_fog';

export const sound = new Sound();

async function loadFog(seed: number): Promise<Fog> {
  try {
    const raw = await run.getItem(FOG_KEY);
    const data = raw ? (JSON.parse(raw) as { seed?: number; d?: string }) : null;
    if (data?.seed === seed && typeof data.d === 'string') return Fog.decode(data.d);
  } catch {
    // start unexplored
  }
  return new Fog();
}

function saveFog(seed: number, fog: Fog): void {
  if (!fog.changed) return;
  fog.changed = false;
  void run.setItem(FOG_KEY, JSON.stringify({ seed, d: fog.encode() }));
}

export function Game(props: {
  client: GameClient;
  onLeave: () => void;
  onHost: () => void;
  onNewIsland: () => void;
}) {
  const { client } = props;
  useClient(client);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [input] = useState(() => new Input());
  const [map, setMap] = useState<{ fog: Fog; image: HTMLCanvasElement } | null>(null);
  const ready = client.phase === 'ready';
  const seed = client.seed;

  // The local playthrough drives and inspects the game through this.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __game?: { client: GameClient; input: Input } }).__game = {
      client,
      input,
    };
  }, [client, input]);

  // Keep the loading text fresh until the island is up.
  useEffect(() => {
    if (ready) return;
    const t = setInterval(() => client.flushChanges(), 150);
    return () => clearInterval(t);
  }, [client, ready]);

  useEffect(() => {
    input.attach();
    return () => input.detach();
  }, [input]);

  // Map picture and explored fog for this island.
  useEffect(() => {
    if (!ready || !client.island) return;
    let cancelled = false;
    const image = islandImage(client.island);
    void loadFog(seed).then((fog) => {
      if (!cancelled) setMap({ fog, image });
    });
    return () => {
      cancelled = true;
    };
  }, [client, ready, seed]);

  useEffect(() => {
    if (!ready || !map || !canvas.current || !overlay.current) return;
    const view = new View(canvas.current, overlay.current, client, sound);
    const el = canvas.current;
    const resize = () => view.resize(el.clientWidth, el.clientHeight);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let raf = 0;
    let last = performance.now();
    let fogAcc = 0;
    let fogSave = 0;
    map.fog.reveal(client.x, client.z);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      client.update(dt, input.move(), input.useHeld);
      view.update(dt);
      view.render();
      fogAcc += dt;
      if (fogAcc > 0.5) {
        fogAcc = 0;
        map.fog.reveal(client.x, client.z);
      }
      fogSave += dt;
      if (fogSave > 20) {
        fogSave = 0;
        saveFog(seed, map.fog);
      }
      client.flushChanges();
    };
    raf = requestAnimationFrame(frame);
    if (
      client.me &&
      client.me.crafted === 0 &&
      client.notes.size === 0 &&
      client.info().day === 1
    ) {
      client.showBanner('Flight MX207 went down. You are alive. Search the wreckage.', 'info');
    }
    run.track('island_ready', { mode: client.link.mode });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      view.dispose();
      saveFog(seed, map.fog);
    };
  }, [client, ready, map, input, seed]);

  // Keyboard shortcuts.
  useEffect(() => {
    for (let i = 0; i < 6; i++) input.on(`Digit${i + 1}`, () => client.select(i));
    const toggle = (p: 'bag' | 'craft' | 'journal' | 'map') => () =>
      client.openPanel(client.panel === p ? null : p);
    input.on('KeyI', toggle('bag'));
    input.on('Tab', toggle('bag'));
    input.on('KeyC', toggle('craft'));
    input.on('KeyJ', toggle('journal'));
    input.on('KeyM', toggle('map'));
    input.on('KeyR', () => client.turnGhost());
    input.on('Escape', () => client.openPanel(client.panel ? null : 'menu'));
  }, [client, input]);

  // The world pauses (solo) and sound stops while the app is in the background.
  useEffect(() => {
    const pause = () => {
      client.link.pause();
      sound.suspend();
      input.useHeld = false;
    };
    const resume = () => {
      client.link.resume();
      sound.resume();
    };
    const vis = () => (document.hidden ? pause() : resume());
    document.addEventListener('visibilitychange', vis);
    const off = appEvents.on({ pause, resume, sleep: pause });
    return () => {
      document.removeEventListener('visibilitychange', vis);
      off();
    };
  }, [client, input]);

  return (
    <div className="game" onPointerDown={() => sound.unlock()}>
      <canvas ref={canvas} className="game-canvas" />
      <div ref={overlay} className="game-labels" />
      {ready && map ? (
        <Hud
          client={client}
          input={input}
          sound={sound}
          fog={map.fog}
          mapImage={map.image}
          onLeave={props.onLeave}
          onHost={props.onHost}
          onNewIsland={props.onNewIsland}
        />
      ) : (
        <div className="game-loading">
          <div className="loading-island">🏝️</div>
          <div className="loading-text">{client.waitText}</div>
          <button className="btn ghost" onClick={props.onLeave}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
