// Co-op island room (RUN realtime, runs on RUN's servers), found by the island's
// multiplayer code. Whoever uploads the island is its host: the room runs the island
// authority (the same IslandSim as solo play) and sends saves back to them. Friends who
// come before the host wait; when the host leaves, everyone goes and the room waits
// for the host to open the island again.

import { GameRoom, type GameMessage, type Player } from '@series-inc/rundot-game-sdk/mp-server';
import { rng } from '../game/rng';
import { IslandSim } from '../game/sim/sim';
import { PartBuffer, splitParts, type C2S, type S2C } from '../game/sim/protocol';
import { parseIslandSave, type IslandSave } from '../game/sim/types';
import { generateIsland } from '../game/world';

type Msg = C2S | S2C;

const TICK_MS = 100;
const SAVE_EVERY = 60;
/** How long a friend waits for the host to open the island. */
const HOST_WAIT_MS = 120_000;

const WAITING = 'Waiting for your friend to open the island…';
const NOBODY =
  'Nobody opened this island. Check the code with your friend: they open it from ☰ › Play with friends.';
const HOST_LEFT = 'Your friend closed the island. What you carry is saved there.';
const TAKEN = 'Another island is open with this code right now. Try again in a few minutes.';

export default class IslandRoom extends GameRoom<Msg> {
  private sim: IslandSim | null = null;
  private hostId = '';
  private init = new PartBuffer();
  private readonly pending = new Map<string, string>();
  private saveAcc = 0;

  onCreate(): void {
    this.clock.setInterval('tick', () => this.step(), TICK_MS);
  }

  onPlayerJoin(player: Player): void {
    if (!this.sim) this.sendTo(player.id, { type: 'wait', text: WAITING });
  }

  onGameMessage(message: GameMessage<Msg>): void {
    const { sender, payload } = message;
    switch (payload.type) {
      case 'init': {
        // The first to upload the island hosts it; nobody takes over an open one.
        if (!this.hostId && !this.sim) {
          this.hostId = sender.id;
          this.broadcast({ type: 'wait', text: 'The island is loading…' });
        }
        if (sender.id !== this.hostId) {
          if (payload.part === 0) this.letGo(sender.id, TAKEN);
          return;
        }
        if (this.sim) return;
        const whole = this.init.add(payload.part, payload.parts, payload.data);
        if (whole !== null) this.start(whole);
        return;
      }
      case 'bye':
        // The host is closing the island: their last save, then everyone else goes (their
        // socket only drops after this; the room hears of it a reconnect window later).
        if (sender.id !== this.hostId) return;
        this.sendSave();
        this.close(sender.id);
        return;
      case 'hello':
        if (this.sim) {
          this.sim.join(sender.id, payload.name || sender.username);
          return;
        }
        this.pending.set(sender.id, payload.name || sender.username);
        this.clock.setTimeout(`wait:${sender.id}`, () => this.giveUp(sender.id), HOST_WAIT_MS);
        return;
      default:
        if (this.sim && isClientMessage(payload)) this.sim.handle(sender.id, payload);
    }
  }

  onPlayerLeave(player: Player): void {
    this.pending.delete(player.id);
    this.clock.clear(`wait:${player.id}`);
    if (player.id === this.hostId) {
      this.sendSave();
      this.close();
      return;
    }
    this.sim?.leave(player.id);
  }

  /** A friend waited and nobody opened the island. */
  private giveUp(id: string): void {
    if (this.sim || (this.hostId && this.players.get(this.hostId))) return;
    this.pending.delete(id);
    this.letGo(id, NOBODY);
  }

  private letGo(id: string, text: string): void {
    if (!this.players.has(id)) return;
    this.sendTo(id, { type: 'closed', text });
    this.kick(id, text);
  }

  /** The host left (`host`: is leaving now): everyone else goes, and the room waits for the
   * island to open again. */
  private close(host?: string): void {
    this.sim = null;
    this.hostId = '';
    this.init = new PartBuffer();
    this.saveAcc = 0;
    this.pending.clear();
    for (const id of [...this.players.keys()]) {
      this.clock.clear(`wait:${id}`);
      if (id !== host) this.letGo(id, HOST_LEFT);
    }
  }

  private start(json: string): void {
    let save: IslandSave | null = null;
    try {
      save = parseIslandSave(JSON.parse(json));
    } catch {
      save = null;
    }
    if (!save) {
      this.log.warn('Bad island save from host');
      return;
    }
    this.boot(save);
  }

  private boot(save: IslandSave): void {
    const island = generateIsland(save.seed, save.island);
    this.sim = new IslandSim(
      island,
      save,
      (to, msg) => this.out(to, msg),
      rng((save.seed ^ Date.now()) >>> 0),
    );
    this.sim.owner = this.hostId;
    for (const [id, name] of this.pending) {
      this.clock.clear(`wait:${id}`);
      this.sim.join(id, name);
    }
    this.pending.clear();
    this.log.info('Island ready', { seed: save.seed, players: this.playerCount });
  }

  private out(to: string | null, msg: S2C): void {
    if (to === null) this.broadcast(msg);
    else if (this.players.get(to)?.connected) this.sendTo(to, msg);
  }

  private step(): void {
    if (!this.sim) return;
    this.sim.tick(TICK_MS / 1000);
    this.saveAcc += TICK_MS / 1000;
    if (this.saveAcc >= SAVE_EVERY) {
      this.saveAcc = 0;
      this.sendSave();
    }
  }

  private sendSave(): void {
    if (!this.sim || !this.players.get(this.hostId)?.connected) return;
    const parts = splitParts(JSON.stringify(this.sim.serialize()));
    parts.forEach((data, part) =>
      this.sendTo(this.hostId, { type: 'save', part, parts: parts.length, data }),
    );
  }

  protected getPersistState(): Record<string, unknown> {
    return this.sim ? { save: this.sim.serialize(), hostId: this.hostId } : { hostId: this.hostId };
  }

  onRestore(snapshot: Record<string, unknown>): void {
    this.hostId = typeof snapshot['hostId'] === 'string' ? snapshot['hostId'] : '';
    const save = parseIslandSave(snapshot['save']);
    if (save) this.boot(save);
    this.clock.setInterval('tick', () => this.step(), TICK_MS);
  }
}

const CLIENT_TYPES = new Set([
  'pos',
  'use',
  'throw',
  'shoot',
  'eat',
  'equip',
  'craft',
  'learn',
  'place',
  'build',
  'demolish',
  'move',
  'drop',
  'store',
  'take',
  'code',
  'respawn',
  'rules',
  'say',
  'reward',
]);

function isClientMessage(m: Msg): m is C2S {
  return CLIENT_TYPES.has(m.type);
}
