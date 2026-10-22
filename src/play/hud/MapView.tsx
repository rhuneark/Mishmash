import { useEffect, useRef } from 'react';
import { POIS } from '../../game/content/pois';
import { HALF, WORLD } from '../../game/world';
import type { GameClient } from '../client';
import type { Fog } from './map';

interface MapOpts {
  client: GameClient;
  fog: Fog;
  image: HTMLCanvasElement;
  /** Centre of the view (m). */
  cx: number;
  cz: number;
  /** Metres shown across the canvas. */
  across: number;
  t: number;
  full: boolean;
  objectivePoi: string | null;
}

function drawMap(ctx: CanvasRenderingContext2D, w: number, h: number, o: MapOpts): void {
  const { client: c } = o;
  const scale = w / o.across;
  const ox = w / 2 - (o.cx + HALF) * scale;
  const oy = h / 2 - (o.cz + HALF) * scale;
  const px = (x: number) => ox + (x + HALF) * scale;
  const py = (z: number) => oy + (z + HALF) * scale;
  ctx.fillStyle = '#1d4f72';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = o.full;
  ctx.drawImage(o.image, ox, oy, WORLD * scale, WORLD * scale);
  o.fog.paint(ctx, ox, oy, scale, [14, 16, 32], o.full ? 0.86 : 0.9);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Landmarks you found (or read about).
  const iconSize = o.full ? 18 : 13;
  ctx.font = `${iconSize}px system-ui, sans-serif`;
  for (const poi of POIS) {
    if (!c.flags.has(`seen:${poi.id}`)) continue;
    const x = px(poi.x);
    const y = py(poi.z);
    if (poi.id === o.objectivePoi) {
      ctx.strokeStyle = `rgba(255, 210, 90, ${0.5 + Math.sin(o.t * 4) * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, iconSize * 0.95, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillText(poi.icon, x, y);
    if (o.full) {
      ctx.font = `bold ${11}px system-ui, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText(poi.name, x, y + 16);
      ctx.fillText(poi.name, x, y + 16);
      ctx.font = `${iconSize}px system-ui, sans-serif`;
    }
  }
  for (const b of c.buildings.values()) {
    if (b.kind !== 'bedroll' || b.owner !== c.you) continue;
    ctx.fillText('🛏️', px(b.x), py(b.z));
  }
  for (const d of c.drops.values()) {
    if (!d.label.endsWith("'s bag")) continue;
    ctx.fillText('🎒', px(d.x), py(d.z));
  }
  for (const other of c.others.values()) {
    if (!other.alive) continue;
    const info = c.players.find((p) => p.id === other.id);
    ctx.fillStyle = `#${(info?.color ?? 0xffffff).toString(16).padStart(6, '0')}`;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px(other.x), py(other.z), o.full ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // You: an arrow.
  const x = px(c.x);
  const y = py(c.z);
  const fx = Math.sin(c.ry);
  const fz = Math.cos(c.ry);
  const s = o.full ? 9 : 7;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + fx * s, y + fz * s);
  ctx.lineTo(x - fx * s * 0.6 + fz * s * 0.6, y - fz * s * 0.6 - fx * s * 0.6);
  ctx.lineTo(x - fx * s * 0.6 - fz * s * 0.6, y - fz * s * 0.6 + fx * s * 0.6);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
}

function useMapCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void,
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 100) return;
      last = now;
      const canvas = ref.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current(ctx, w, h, now / 1000);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return ref;
}

export function MiniMap(props: {
  client: GameClient;
  fog: Fog;
  image: HTMLCanvasElement;
  objectivePoi: string | null;
  onOpen: () => void;
}) {
  const ref = useMapCanvas((ctx, w, h, t) => {
    drawMap(ctx, w, h, {
      ...props,
      cx: props.client.x,
      cz: props.client.z,
      across: 150,
      t,
      full: false,
    });
  });
  return (
    <button className="minimap" onClick={props.onOpen} aria-label="Open the map">
      <canvas ref={ref} />
    </button>
  );
}

export function FullMap(props: {
  client: GameClient;
  fog: Fog;
  image: HTMLCanvasElement;
  objectivePoi: string | null;
}) {
  const ref = useMapCanvas((ctx, w, h, t) => {
    drawMap(ctx, w, h, { ...props, cx: 0, cz: 0, across: 900, t, full: true });
  });
  return <canvas ref={ref} className="fullmap" />;
}
