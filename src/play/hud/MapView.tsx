import { useEffect, useRef } from 'react';
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
  /** Turns the map so up matches up on screen (the camera's yaw; 0 = north up). */
  rot?: number;
}

function drawMap(ctx: CanvasRenderingContext2D, w: number, h: number, o: MapOpts): void {
  const { client: c } = o;
  const scale = w / o.across;
  const ox = w / 2 - (o.cx + HALF) * scale;
  const oy = h / 2 - (o.cz + HALF) * scale;
  const rot = o.rot ?? 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  /** A spot on the island → canvas (turned about the centre; markers stay upright). */
  const at = (x: number, z: number): [number, number] => {
    const dx = ox + (x + HALF) * scale - w / 2;
    const dy = oy + (z + HALF) * scale - h / 2;
    return [w / 2 + dx * cos - dy * sin, h / 2 + dx * sin + dy * cos];
  };
  ctx.fillStyle = '#1d4f72';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  if (rot) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rot);
    ctx.translate(-w / 2, -h / 2);
  }
  ctx.imageSmoothingEnabled = o.full;
  ctx.drawImage(o.image, ox, oy, WORLD * scale, WORLD * scale);
  o.fog.paint(ctx, ox, oy, scale, [14, 16, 32], o.full ? 0.86 : 0.9);
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // The island's rules say what the map shows: everything, landmarks only, or just you.
  const markers = c.rules.markers;
  // Landmarks you found (or read about).
  const iconSize = o.full ? 18 : 13;
  ctx.font = `${iconSize}px system-ui, sans-serif`;
  for (const poi of markers === 'none' ? [] : (c.island?.pois ?? [])) {
    if (!c.flags.has(`seen:${poi.id}`)) continue;
    const [x, y] = at(poi.x, poi.z);
    if (poi.id === o.objectivePoi && markers === 'all') {
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
  for (const b of markers === 'none' ? [] : c.buildings.values()) {
    if (b.kind !== 'bedroll' || b.owner !== c.you) continue;
    ctx.fillText('🛏️', ...at(b.x, b.z));
  }
  const drops = markers === 'all' ? [...c.drops.values()] : [];
  for (const d of drops) {
    if (!d.label.endsWith("'s bag")) continue;
    ctx.fillText('🎒', ...at(d.x, d.z));
  }
  // Washed-up crates and supply pods: on the minimap's rim when they're further away.
  for (const d of drops) {
    if (d.kind !== 'crate' && d.kind !== 'pod') continue;
    let [x, y] = at(d.x, d.z);
    if (!o.full) {
      const r = w / 2 - iconSize * 0.7;
      const dx = x - w / 2;
      const dy = y - h / 2;
      const dd = Math.hypot(dx, dy);
      if (dd > r) {
        x = w / 2 + (dx / dd) * r;
        y = h / 2 + (dy / dd) * r;
      }
    }
    ctx.strokeStyle = d.kind === 'pod' ? 'rgba(120, 255, 150, 0.9)' : 'rgba(255, 220, 140, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, iconSize * (0.75 + Math.sin(o.t * 5) * 0.15), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(d.kind === 'pod' ? '🛰️' : '📦', x, y);
  }
  for (const other of markers === 'all' ? c.others.values() : []) {
    if (!other.alive) continue;
    const info = c.players.find((p) => p.id === other.id);
    ctx.fillStyle = `#${(info?.color ?? 0xffffff).toString(16).padStart(6, '0')}`;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(...at(other.x, other.z), o.full ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // You: an arrow.
  const [x, y] = at(c.x, c.z);
  const fx = Math.sin(c.ry) * cos - Math.cos(c.ry) * sin;
  const fz = Math.sin(c.ry) * sin + Math.cos(c.ry) * cos;
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
  // A turned minimap shows where north is.
  if (rot && !o.full) {
    const r = w / 2 - 9;
    const nx = w / 2 + sin * r;
    const ny = h / 2 - cos * r;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillStyle = '#ffd36a';
    ctx.strokeText('N', nx, ny);
    ctx.fillText('N', nx, ny);
  }
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
  rot: number;
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
