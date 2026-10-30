// How a game talks to its island authority: in-process for solo play, or a
// RUN room for co-op (roomLink.ts). Both carry the same messages.

import { rng } from '../game/rng';
import { IslandSim } from '../game/sim/sim';
import type { C2S, S2C } from '../game/sim/protocol';
import type { IslandSave } from '../game/sim/types';
import type { Island } from '../game/world';

export type LinkMode = 'solo' | 'host' | 'guest';

export interface Link {
  readonly mode: LinkMode;
  /** The island's multiplayer code (friends join with it once it's open). */
  readonly code: string;
  /** A public island (strangers come and go; found without a code). */
  readonly open: boolean;
  send(msg: C2S): void;
  onMessage(cb: (msg: S2C) => void): void;
  /** Connection trouble for the HUD (co-op). */
  onStatus(cb: (status: 'ok' | 'reconnecting' | 'lost') => void): void;
  pause(): void;
  resume(): void;
  /** Stops the link; resolves once a final save (if any) is done. */
  close(): Promise<void>;
}

const TICK_MS = 100;
const AUTOSAVE_MS = 30_000;

/** Solo play: the authority runs right here; the world pauses with the app. */
export class LocalLink implements Link {
  readonly mode = 'solo' as const;
  readonly code: string;
  readonly open = false;
  private readonly sim: IslandSim;
  private handler: ((msg: S2C) => void) | null = null;
  private queue: S2C[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private saveTimer: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private readonly playerId: string;

  constructor(
    island: Island,
    save: IslandSave,
    playerId: string,
    private readonly onSave: (save: IslandSave) => Promise<void> | void,
  ) {
    this.playerId = playerId;
    this.code = save.code ?? '';
    this.sim = new IslandSim(
      island,
      save,
      (to, msg) => {
        if (to === null || to === playerId) this.queue.push(msg);
      },
      rng((save.seed ^ Date.now()) >>> 0),
    );
    this.sim.owner = playerId;
    this.resume();
  }

  send(msg: C2S): void {
    if (msg.type === 'hello') this.sim.join(this.playerId, msg.name, msg.look);
    else this.sim.handle(this.playerId, msg);
    this.flush();
  }

  onMessage(cb: (msg: S2C) => void): void {
    this.handler = cb;
    this.flush();
  }

  onStatus(): void {}

  private flush(): void {
    if (!this.handler || !this.queue.length) return;
    const q = this.queue;
    this.queue = [];
    for (const m of q) this.handler(m);
  }

  pause(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.save();
  }

  resume(): void {
    if (this.timer) return;
    this.last = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      // Catch up after hiccups, but never simulate more than a second at once.
      let steps = Math.min(10, Math.round((now - this.last) / TICK_MS));
      this.last += steps * TICK_MS;
      if (steps < 1) return;
      this.sim.wallMs = Date.now();
      while (steps-- > 0) this.sim.tick(TICK_MS / 1000);
      this.flush();
    }, TICK_MS);
    this.saveTimer ??= setInterval(() => void this.save(), AUTOSAVE_MS);
  }

  private save(): Promise<void> | void {
    return this.onSave(this.sim.serialize());
  }

  async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    if (this.saveTimer) clearInterval(this.saveTimer);
    this.timer = null;
    this.saveTimer = null;
    this.sim.leave(this.playerId);
    await this.save();
  }
}
