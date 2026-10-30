// Co-op: the island authority runs in a RUN room (src/server/IslandRoom.ts), found
// by the island's multiplayer code. The host uploads their island save; the room
// sends it back every minute so the host keeps the progress. A public island (strangers)
// is found by `open: 'public'`: the room says who hosts (S2C `role`), and the host can
// change when the one before leaves.

import * as run from '../sdk/run';
import { PartBuffer, splitParts, type C2S, type S2C } from '../game/sim/protocol';
import { parseIslandSave, type IslandSave } from '../game/sim/types';
import type { Link, LinkMode } from './link';

export type RoomOpen =
  { ok: true; link: RoomLink } | { ok: false; reason: 'login' | 'notfound' | 'full' | 'error' };

export class RoomLink implements Link {
  /** A public island's host can change while it runs (S2C `role`). */
  mode: LinkMode;
  /** The island's multiplayer code ('' on a public island: it's found without one). */
  readonly code: string;
  readonly open: boolean;
  readonly playerId: string;
  private readonly conn: run.RoomConn;
  private readonly saves = new PartBuffer();
  private handler: ((msg: S2C) => void) | null = null;
  private saved: (() => void) | null = null;

  private constructor(
    conn: run.RoomConn,
    mode: LinkMode,
    code: string,
    private readonly onSave: (save: IslandSave) => void,
    /** A public island: what to upload when the room asks this player to host. */
    private readonly mine: (() => Promise<IslandSave>) | null = null,
  ) {
    this.conn = conn;
    this.mode = mode;
    this.code = code;
    this.open = !!mine;
    this.playerId = conn.playerId;
    conn.onMessage((raw) => {
      const msg = raw as S2C;
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
      if (msg.type === 'role') {
        if (!this.open || !msg.host) return;
        this.mode = 'host';
        if (msg.upload && this.mine) void this.mine().then((save) => this.upload(save));
        return;
      }
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

  /** Opens your island to friends: its room (by its code) gets your save. */
  static async host(
    save: IslandSave & { code: string },
    onSave: (save: IslandSave) => void,
  ): Promise<RoomOpen> {
    const res = await run.islandRoom('island', save.code);
    if (!res.ok) return res;
    const link = new RoomLink(res.room, 'host', save.code, onSave);
    link.upload(save);
    return { ok: true, link };
  }

  /**
   * A public island with strangers: joins one that's open, or opens yours (`mine`) when
   * the room asks (nobody's there yet). Its saves come here while this player hosts it.
   */
  static async quick(
    mine: () => Promise<IslandSave>,
    onSave: (save: IslandSave) => void,
  ): Promise<RoomOpen> {
    const res = await run.publicRoom('island');
    if (!res.ok) return res;
    const link = new RoomLink(res.room, 'guest', '', onSave, mine);
    res.room.send({ type: 'quick' });
    return { ok: true, link };
  }

  private upload(save: IslandSave): void {
    const parts = splitParts(JSON.stringify(save));
    parts.forEach((data, part) =>
      this.conn.send({ type: 'init', part, parts: parts.length, data }),
    );
  }

  /** Joins a friend's island by its multiplayer code (waits there until it's open). */
  static async join(code: string): Promise<RoomOpen> {
    const res = await run.islandRoom('island', code);
    if (!res.ok) return res;
    return { ok: true, link: new RoomLink(res.room, 'guest', code, () => {}) };
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
