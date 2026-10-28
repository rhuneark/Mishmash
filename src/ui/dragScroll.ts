// Click and drag scrolls every scrolling list and row (the crafting grid, the bag, settings,
// the build menu, the hub's pages), the way a finger does on a phone; touch keeps the
// browser's own scrolling. A press on an item slot still drags the item, and text boxes,
// sliders and the island itself are left alone. A drag that scrolled swallows the click that
// follows it, and a flick keeps going for a moment. The wheel scrolls sideways rows too.

/** What a press must not turn into a scroll. */
const SKIP =
  'input, textarea, select, [contenteditable="true"], [data-slot][data-item], .game-canvas, .joy-zone, .capture, [data-noscroll]';
/** Pixels a press moves before it becomes a drag. */
const START = 6;

interface Scroller {
  el: HTMLElement;
  x: boolean;
  y: boolean;
}

/** The scrolling boxes under a point, nearest first. */
function scrollersAt(from: Element | null): Scroller[] {
  const out: Scroller[] = [];
  for (let el = from as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    const cs = getComputedStyle(el);
    const x = /auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
    const y = /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
    if (x || y) out.push({ el, x, y });
  }
  return out;
}

let flinging = 0;

function stopFling(): void {
  if (flinging) cancelAnimationFrame(flinging);
  flinging = 0;
}

/** Keeps a flicked list moving, slowing down. */
function fling(el: HTMLElement, axis: 'x' | 'y', v: number): void {
  let last = performance.now();
  const step = (now: number) => {
    const dt = Math.min(40, now - last);
    last = now;
    const before = axis === 'x' ? el.scrollLeft : el.scrollTop;
    if (axis === 'x') el.scrollLeft = before - v * dt;
    else el.scrollTop = before - v * dt;
    const after = axis === 'x' ? el.scrollLeft : el.scrollTop;
    v *= Math.pow(0.94, dt / 16);
    flinging = Math.abs(v) > 0.02 && after !== before ? requestAnimationFrame(step) : 0;
  };
  flinging = requestAnimationFrame(step);
}

/** Swallows the click the browser sends when a drag that scrolled is let go. */
function eatClick(): void {
  const eat = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener('click', eat, true);
  };
  window.addEventListener('click', eat, true);
  window.setTimeout(() => window.removeEventListener('click', eat, true), 300);
}

function down(e: PointerEvent): void {
  stopFling();
  if (e.pointerType === 'touch' || e.button !== 0) return;
  const target = e.target as Element | null;
  if (!target || target.closest(SKIP)) return;
  const list = scrollersAt(target);
  if (!list.length) return;
  const pid = e.pointerId;
  const sx = e.clientX;
  const sy = e.clientY;
  let on: { el: HTMLElement; axis: 'x' | 'y'; from: number } | null = null;
  // The last few positions, for the speed of a flick.
  let trail: { t: number; p: number }[] = [];
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pid) return;
    const dx = ev.clientX - sx;
    const dy = ev.clientY - sy;
    if (!on) {
      if (Math.hypot(dx, dy) < START) return;
      const axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      const s = list.find((c) => c[axis]);
      if (!s) {
        quit();
        return;
      }
      on = { el: s.el, axis, from: axis === 'x' ? s.el.scrollLeft : s.el.scrollTop };
      document.documentElement.classList.add('drag-scrolling');
      window.getSelection()?.removeAllRanges();
    }
    const p = on.axis === 'x' ? ev.clientX : ev.clientY;
    if (on.axis === 'x') on.el.scrollLeft = on.from - dx;
    else on.el.scrollTop = on.from - dy;
    const t = ev.timeStamp;
    trail.push({ t, p });
    trail = trail.filter((s) => t - s.t < 90);
  };
  const quit = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    document.documentElement.classList.remove('drag-scrolling');
  };
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== pid) return;
    quit();
    if (!on) return;
    eatClick();
    const first = trail[0];
    const last = trail[trail.length - 1];
    if (ev.type === 'pointerup' && first && last && last.t - first.t > 10) {
      const v = (last.p - first.p) / (last.t - first.t);
      if (Math.abs(v) > 0.3) fling(on.el, on.axis, v);
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

/** The wheel over a row that only scrolls sideways (category chips, the build menu). */
function wheel(e: WheelEvent): void {
  if (e.deltaY === 0 || e.deltaX !== 0 || e.ctrlKey) return;
  const target = e.target as Element | null;
  if (!target || target.closest(SKIP)) return;
  const s = scrollersAt(target)[0];
  if (!s || s.y || !s.x) return;
  stopFling();
  s.el.scrollLeft += e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
}

export function installDragScroll(): void {
  window.addEventListener('pointerdown', down);
  window.addEventListener('wheel', wheel, { passive: true });
}
