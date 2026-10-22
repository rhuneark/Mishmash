// Movement and action input: keyboard on desktop, the on-screen joystick and
// buttons on phones (the HUD writes into the same state).

import type { MoveInput } from './client';

export class Input {
  /** Joystick vector from the HUD (-1..1, screen axes). */
  joy = { x: 0, z: 0 };
  sprintToggle = false;
  useHeld = false;
  private readonly keys = new Set<string>();
  private readonly handlers: Record<string, () => void> = {};
  private readonly down = (e: KeyboardEvent) => this.onKey(e, true);
  private readonly up = (e: KeyboardEvent) => this.onKey(e, false);
  private readonly blur = () => {
    this.keys.clear();
    this.useHeld = false;
  };

  attach(): void {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.blur);
  }

  /** Key press shortcuts (e.g. 'Digit1', 'KeyI', 'Escape'). */
  on(code: string, fn: () => void): void {
    this.handlers[code] = fn;
  }

  private onKey(e: KeyboardEvent, isDown: boolean): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (isDown) {
      if (!this.keys.has(e.code)) this.handlers[e.code]?.();
      this.keys.add(e.code);
    } else {
      this.keys.delete(e.code);
    }
    if (e.code === 'Space' || e.code === 'KeyE') this.useHeld = isDown;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code))
      e.preventDefault();
  }

  move(): MoveInput {
    let x = this.joy.x;
    let z = this.joy.z;
    const k = this.keys;
    const kx =
      (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) -
      (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const kz =
      (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (kx || kz) {
      const len = Math.hypot(kx, kz);
      x = kx / len;
      z = kz / len;
    }
    const sprint = this.sprintToggle || k.has('ShiftLeft') || k.has('ShiftRight');
    return { x, z, sprint };
  }

  detach(): void {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.blur);
  }
}
