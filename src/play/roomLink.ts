// Co-op: the island authority runs in a RUN room (src/server/IslandRoom.ts).
// The host uploads their island save; the room sends it back every minute so
// the host keeps the progress.

import * as run from '../sdk/run';
import { PartBuffer, splitParts, type C2S, type S2C } from '../game/sim/protocol';
import { parseIslandSave, type IslandSave } from '../game/sim/types';
import type { Link, LinkMode } from './link';

export type RoomOpen =
  { ok: true; link: RoomLink } | { ok: false; reason: 'login' | 'notfound' | 'full' | 'error' };

export class RoomLink implements Link {
  readonly mode: LinkMode;
  readonly code: string;
  readonly playerId: string;
  private readonly conn: run.RoomConn;
  private readonly saves = new PartBuffer();
  private handler: ((msg: S2C) => void) | null = null;
  private saved: (() => void) | null = null;

  private constructor(
    conn: run.RoomConn,
    mode: LinkMode,
    private readonly onSave: (save: IslandSave) => void,
  ) {
    this.conn = conn;
    this.mode = mode;
    this.code = conn.code;
    this.playerId = conn.playerId;
    conn.onMessage((raw) => {
      const msg = raw as S2C;
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
      if (msg.type === 'save') {
        if (this.mode !== 'host') return;
        const whole = this.saves.add(msg.part, msg.parts, msg.data);
        if (whole !== null) {
          try {
            const save = parseIslandSave(JSON.parse(whole));
            if (save) this.onSave(save);
            this.saved?.();
          } catch {
            // a broken save message: keep the last good one
          }
        }
        return;
      }
      this.handler?.(msg);
    });
  }

  /** Opens your island to friends: creates a room and loads your save into it. */
  static async host(save: IslandSave, onSave: (save: IslandSave) => void): Promise<RoomOpen> {
    const res = await run.createRoom('island');
    if (!res.ok) return res;
    const link = new RoomLink(res.room, 'host', onSave);
    const parts = splitParts(JSON.stringify(save));
    parts.forEach((data, part) => res.room.send({ type: 'init', part, parts: parts.length, data }));
    return { ok: true, link };
  }

  /** Joins a friend's island by its room code. */
  static async join(code: string): Promise<RoomOpen> {
    const res = await run.joinRoom(code);
    if (!res.ok) return res;
    return { ok: true, link: new RoomLink(res.room, 'guest', () => {}) };
  }

  send(msg: C2S): void {
    this.conn.send(msg);
  }

  onMessage(cb: (msg: S2C) => void): void {
    this.handler = cb;
  }

  onStatus(cb: (status: run.RoomStatus) => void): void {
    this.conn.onStatus(cb);
  }

  pause(): void {}

  resume(): void {}

  /** Leaves the room; the host first waits (briefly) for a last save. */
  async close(): Promise<void> {
    if (this.mode === 'host') {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 2500);
        this.saved = () => {
          clearTimeout(timer);
          resolve();
        };
        this.conn.send({ type: 'bye' });
      });
    }
    this.conn.leave();
  }
}
