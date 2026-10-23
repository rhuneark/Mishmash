// The game screen: the 3D view, the frame loop and the HUD over it.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import * as run from '../sdk/run';
import { appEvents } from '../app/appEvents';
import { Sound } from './audio';
import type { GameClient } from './client';
import { Hud, isPc, useClient } from './hud/Hud';
import { Fog, islandImage } from './hud/map';
import { Input } from './input';
import { KEYS_KEY, parseBindings, type Action } from './keys';
import { isTouch, prefs, usePrefs } from './prefs';
import { rotationFor, setRotation, toLocal, turnInsets } from './screen';
import { gain, graphicsFor, type Settings } from './settings';
import { View } from './view';

const FOG_KEY = 'mishmash_fog';

export const sound = new Sound();

/** Settings → the sound buses (the hub's settings use this too). */
export function applyVolumes(s: Settings): void {
  sound.setVolumes({
    master: gain(s.master),
    sfx: gain(s.sfx),
    ambience: gain(s.ambience),
    music: gain(s.music) * 0.8,
  });
}

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

function useViewport(): { w: number; h: number } {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return vp;
}

export function Game(props: {
  client: GameClient;
  onLeave: () => void;
  onHost: () => void;
  onNewIsland: () => void;
}) {
  const { client } = props;
  useClient(client);
  const settings = usePrefs();
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const fpsEl = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View | null>(null);
  /** The mouse over the island (build mode aims the piece at it every frame). */
  const mouseAt = useRef<{ x: number; y: number } | null>(null);
  const [input] = useState(() => new Input());
  const [map, setMap] = useState<{ fog: Fog; image: HTMLCanvasElement } | null>(null);
  const ready = client.phase === 'ready';
  const seed = client.seed;
  const touch = useMemo(() => isTouch(), []);
  const vp = useViewport();
  const solo = client.link.mode === 'solo';
  const menuOpen = client.panel === 'menu';

  // Landscape on phones: the game turns inside the upright screen.
  const rot = rotationFor(settings.orientation, settings.flip, vp.w, vp.h, touch);
  setRotation(rot, vp.w, vp.h);
  const local = rot === 0 ? vp : { w: vp.h, h: vp.w };
  const landscape = local.w > local.h;
  const insets = turnInsets(run.safeArea(), rot);
  const pc = useMemo(() => isPc(), []);
  // Health, food and water: bottom left on PC and sideways (Settings › HUD can pin them).
  const statsLow =
    settings.statsAt === 'bottom' || (settings.statsAt === 'auto' && (pc || landscape));
  const style = {
    '--hud-scale': settings.hudScale / 100,
    '--hud-alpha': settings.hudOpacity / 100,
    '--safe-top': `${insets.top}px`,
    '--safe-right': `${insets.right}px`,
    '--safe-bottom': `${insets.bottom}px`,
    '--safe-left': `${insets.left}px`,
    ...(rot !== 0
      ? {
          inset: 'auto',
          left: 0,
          top: 0,
          width: `${local.w}px`,
          height: `${local.h}px`,
          transformOrigin: '0 0',
          transform:
            rot === 90
              ? `translateX(${vp.w}px) rotate(90deg)`
              : `translateY(${vp.h}px) rotate(-90deg)`,
        }
      : {}),
  } as CSSProperties;

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
    input.attach(canvas.current);
    return () => input.detach();
  }, [input]);

  // Music and ambience belong to the island: quiet in the hub.
  useEffect(() => {
    sound.resume();
    return () => sound.suspend();
  }, []);

  // Your keys (PC), saved per player.
  useEffect(() => {
    let cancelled = false;
    void run.getItem(KEYS_KEY).then((raw) => {
      if (cancelled || !raw) return;
      try {
        input.setBindings(parseBindings(JSON.parse(raw)));
        client.touch();
      } catch {
        // keep the defaults
      }
    });
    input.onBindingsChanged = (b) => {
      void run.setItem(KEYS_KEY, JSON.stringify(b));
      client.touch();
    };
    return () => {
      cancelled = true;
      input.onBindingsChanged = null;
    };
  }, [client, input]);

  // Settings: volumes, auto tool, camera and graphics.
  useEffect(() => applyVolumes(settings), [settings]);
  useEffect(() => {
    client.auto = { tool: settings.autoTool, weapon: settings.autoWeapon, back: settings.autoBack };
  }, [client, settings.autoTool, settings.autoWeapon, settings.autoBack]);
  useEffect(() => {
    client.buildPrefs = { snap: settings.buildSnap, grid: settings.buildGrid };
    client.touch();
  }, [client, settings.buildSnap, settings.buildGrid]);
  useEffect(() => {
    viewRef.current?.configure({
      view: settings.view,
      zoom: settings.camera / 100,
      shake: settings.shake,
      numbers: settings.damageNumbers,
      gfx: graphicsFor(settings.quality, touch),
      life: settings.life,
      grid: settings.buildGridShow,
    });
  }, [settings, touch, map]);

  // Build mode: the mouse, or a finger on the island, moves the piece.
  useEffect(() => {
    const el = canvas.current;
    if (!el || !ready) return;
    let finger: number | null = null;
    const aim = (e: PointerEvent) => {
      const view = viewRef.current;
      if (!view || !client.build) return;
      const p = toLocal(e.clientX, e.clientY);
      // A finger would hide the piece: aim a little above it.
      const at = view.groundAt(p.x, p.y - (e.pointerType === 'mouse' ? 0 : 56));
      if (at) client.setBuildCursor(at);
    };
    const down = (e: PointerEvent) => {
      if (!client.build) return;
      if (e.pointerType !== 'mouse') finger = e.pointerId;
      aim(e);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        mouseAt.current = toLocal(e.clientX, e.clientY);
        if (client.build) aim(e);
      } else if (e.pointerId === finger) aim(e);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === finger) finger = null;
    };
    const leave = () => {
      mouseAt.current = null;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      window.removeEventListener('pointerup', up);
    };
  }, [client, ready]);

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
    viewRef.current = view;
    const s = prefs.get();
    view.configure({
      view: s.view,
      zoom: s.camera / 100,
      shake: s.shake,
      numbers: s.damageNumbers,
      gfx: graphicsFor(s.quality, touch),
      life: s.life,
      grid: s.buildGridShow,
    });
    const el = canvas.current;
    const resize = () => view.resize(el.clientWidth, el.clientHeight);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let raf = 0;
    let last = performance.now();
    let fogAcc = 0;
    let fogSave = 0;
    let fpsAcc = 0;
    let frames = 0;
    map.fog.reveal(client.x, client.z);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      // The stick and keys are screen directions; the island turns with the camera.
      client.update(dt, view.toWorld(input.move()), input.useHeld);
      // The piece stays under the mouse while you walk.
      const m = mouseAt.current;
      if (client.build && m) {
        const at = view.groundAt(m.x, m.y);
        if (at) client.setBuildCursor(at);
      }
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
      frames++;
      fpsAcc += dt;
      if (fpsAcc >= 0.5) {
        if (fpsEl.current) fpsEl.current.textContent = `${Math.round(frames / fpsAcc)} fps`;
        frames = 0;
        fpsAcc = 0;
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
      viewRef.current = null;
      view.dispose();
      saveFog(seed, map.fog);
    };
  }, [client, ready, map, input, seed, touch]);

  // What keys and mouse buttons do (keys.ts; rebindable under Menu › Settings › Controls).
  useEffect(() => {
    for (let i = 0; i < 6; i++) input.on(`slot${i + 1}` as Action, () => client.select(i));
    const toggle = (p: 'journal' | 'map') => () => client.openPanel(client.panel === p ? null : p);
    input.on('use', () => client.use());
    input.on('eat', () => client.eatHeld());
    input.on('drop', () => client.dropHeld());
    input.on('turn', () => client.turnGhost());
    input.on('build', () => client.toggleBuild());
    input.on('snap', () => prefs.set({ buildSnap: !prefs.get().buildSnap }));
    input.on('hud', () => prefs.set({ hudOn: !prefs.get().hudOn }));
    input.on('quick', () => {
      if (client.panel === 'bag' || client.panel === 'craft') client.openPanel(null);
      else if (!client.panel) client.toggleQuick();
    });
    // The bag and crafting open the window by the survivor (⤢ in it opens the full sheet).
    const bagWindow = (tab: 'bag' | 'craft') => () => {
      if (client.panel === 'bag' || client.panel === 'craft') client.openPanel(null);
      else if (!client.panel) client.toggleQuick(tab);
    };
    input.on('bag', bagWindow('bag'));
    input.on('craft', bagWindow('craft'));
    input.on('journal', toggle('journal'));
    input.on('map', toggle('map'));
    // The wheel turns the piece in build mode, else it picks hotbar slots.
    input.on('next', () => (client.build ? client.turnGhost(1) : client.cycle(1)));
    input.on('prev', () => (client.build ? client.turnGhost(-1) : client.cycle(-1)));
    const zoom = (step: number) => () =>
      prefs.set({ camera: Math.min(130, Math.max(80, prefs.get().camera + step)) });
    input.on('zoomIn', zoom(-10));
    input.on('zoomOut', zoom(10));
    input.onEscape(() => {
      if (client.panel === 'menu' && client.menuPage !== 'main') client.setMenuPage('main');
      else if (client.panel) client.openPanel(null);
      else if (client.quickOpen) client.toggleQuick();
      else if (client.build) client.toggleBuild(false);
      else client.openPanel('menu');
    });
  }, [client, input]);

  // Solo play waits while the menu is open, like any game's pause menu.
  const paused = useRef({ app: false, menu: false });
  useEffect(() => {
    if (!solo) return;
    paused.current.menu = menuOpen;
    if (menuOpen) {
      input.release();
      client.link.pause();
    } else if (!paused.current.app) client.link.resume();
  }, [client, input, menuOpen, solo]);

  // The world pauses (solo) and sound stops while the app is in the background.
  useEffect(() => {
    const pause = () => {
      paused.current.app = true;
      client.link.pause();
      sound.suspend();
      input.release();
    };
    const resume = () => {
      paused.current.app = false;
      if (!(solo && paused.current.menu)) client.link.resume();
      sound.resume();
    };
    const vis = () => (document.hidden ? pause() : resume());
    document.addEventListener('visibilitychange', vis);
    const off = appEvents.on({ pause, resume, sleep: pause });
    return () => {
      document.removeEventListener('visibilitychange', vis);
      off();
    };
  }, [client, input, solo]);

  const cls = [
    'game',
    landscape ? 'landscape' : 'portrait',
    rot !== 0 ? 'turned' : '',
    settings.leftHanded ? 'lefty' : '',
    `hud-${settings.hud}`,
    pc ? 'pc' : '',
    statsLow ? 'stats-low' : 'stats-top',
    `map-${settings.mapSize}`,
    settings.hudOn ? '' : 'hud-off',
    client.build ? 'building' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} style={style} onPointerDown={() => sound.unlock()}>
      <canvas ref={canvas} className="game-canvas" />
      <div ref={overlay} className="game-labels" />
      {settings.fps && <div ref={fpsEl} className="fps" />}
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
