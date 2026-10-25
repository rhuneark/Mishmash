// Movement and action input: rebindable keys and mouse buttons on PC (keys.ts),
// the on-screen joystick and buttons on phones (the HUD writes into the same
// state).

import type { MoveInput } from './client';
import { defaultBindings, reverse, type Action, type Bindings } from './keys';

export class Input {
  /** Joystick vector from the HUD (-1..1, screen axes). */
  joy = { x: 0, z: 0 };
  sprintToggle = false;
  /** The on-screen action button is held. */
  useButton = false;
  /** A quick tap in the stick's area (local px): it walks there like a tap on the island. */
  tap: ((x: number, y: number) => void) | null = null;
  bindings: Bindings = defaultBindings();
  /** Called after the player rebinds keys (Game saves them). */
  onBindingsChanged: ((b: Bindings) => void) | null = null;
  /** Bound keys and mouse buttons currently down. */
  private readonly down = new Set<string>();
  private codes = reverse(this.bindings);
  private readonly handlers: Partial<Record<Action, () => void>> = {};
  private escape: (() => void) | null = null;
  private captureCb: ((code: string | null) => void) | null = null;
  private canvas: HTMLElement | null = null;
  private readonly keyDown = (e: KeyboardEvent) => this.onKey(e, true);
  private readonly keyUp = (e: KeyboardEvent) => this.onKey(e, false);
  private readonly blur = () => {
    this.down.clear();
    this.useButton = false;
  };
  private readonly mouseDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !this.onWorld(e.target)) return;
    this.press(`Mouse${e.button}`, true);
  };
  private readonly mouseUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    this.press(`Mouse${e.button}`, false);
  };
  private readonly wheel = (e: WheelEvent) => {
    if (!this.onWorld(e.target) || e.deltaY === 0) return;
    const code = e.deltaY > 0 ? 'WheelDown' : 'WheelUp';
    for (const a of this.codes.get(code) ?? []) this.handlers[a]?.();
  };
  private readonly menu = (e: MouseEvent) => {
    if (this.onWorld(e.target)) e.preventDefault();
  };

  /** The island itself (the canvas, or the stick's area that lies over it). */
  private onWorld(target: EventTarget | null): boolean {
    if (!target || !this.canvas) return false;
    return target === this.canvas || (target as HTMLElement).classList?.contains('joy-zone');
  }

  attach(canvas: HTMLElement | null): void {
    this.canvas = canvas;
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    window.addEventListener('pointerdown', this.mouseDown);
    window.addEventListener('pointerup', this.mouseUp);
    window.addEventListener('wheel', this.wheel, { passive: true });
    window.addEventListener('contextmenu', this.menu);
  }

  detach(): void {
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
    window.removeEventListener('pointerdown', this.mouseDown);
    window.removeEventListener('pointerup', this.mouseUp);
    window.removeEventListener('wheel', this.wheel);
    window.removeEventListener('contextmenu', this.menu);
  }

  setBindings(b: Bindings): void {
    this.bindings = b;
    this.codes = reverse(b);
    this.down.clear();
  }

  /** What a pressed action does (one press, no repeat). */
  on(action: Action, fn: () => void): void {
    this.handlers[action] = fn;
  }

  /** Escape: close screens (not rebindable). */
  onEscape(fn: () => void): void {
    this.escape = fn;
  }

  /** The next key or mouse button goes to `cb` instead of the game (null: cancelled). */
  capture(cb: ((code: string | null) => void) | null): void {
    this.captureCb = cb;
    this.down.clear();
  }

  get capturing(): boolean {
    return this.captureCb !== null;
  }

  /** Feeds a key, mouse button or wheel code to the rebinding capture. */
  captured(code: string | null): void {
    const cb = this.captureCb;
    this.captureCb = null;
    cb?.(code);
  }

  private onKey(e: KeyboardEvent, isDown: boolean): void {
    if (this.captureCb) {
      if (!isDown) return;
      e.preventDefault();
      this.captured(e.code === 'Escape' ? null : e.code);
      return;
    }
    const target = e.target as HTMLElement | null;
    const typing =
      target?.tagName === 'TEXTAREA' ||
      (target?.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range');
    if (typing) return;
    // A focused slider keeps its arrow keys; everything else still plays.
    if (target?.tagName === 'INPUT' && e.code.startsWith('Arrow')) return;
    if (e.code === 'Escape') {
      if (isDown && !e.repeat) this.escape?.();
      return;
    }
    if (!this.codes.has(e.code)) return;
    e.preventDefault();
    if (isDown && e.repeat) return;
    this.press(e.code, isDown);
  }

  private press(code: string, isDown: boolean): void {
    const actions = this.codes.get(code);
    if (!actions) return;
    if (isDown) {
      if (this.down.has(code)) return;
      this.down.add(code);
      for (const a of actions) this.handlers[a]?.();
    } else {
      this.down.delete(code);
    }
  }

  private held(action: Action): boolean {
    for (const c of this.bindings[action]) if (this.down.has(c)) return true;
    return false;
  }

  /** The action is held (keys, mouse or the on-screen button). */
  get useHeld(): boolean {
    return this.useButton || this.held('use');
  }

  move(): MoveInput {
    let x = this.joy.x;
    let z = this.joy.z;
    const kx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const kz = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    if (kx || kz) {
      const len = Math.hypot(kx, kz);
      x = kx / len;
      z = kz / len;
    }
    return { x, z, sprint: this.sprintToggle || this.held('sprint') };
  }

  /** Lets go of everything (a screen opened, the app went to the background). */
  release(): void {
    this.down.clear();
    this.useButton = false;
  }
}
