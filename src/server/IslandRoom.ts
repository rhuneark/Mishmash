// Co-op island room (RUN realtime, runs on RUN's servers). The first player
// in is the host: they upload their island save, the room runs the island
// authority (the same IslandSim as solo play) and sends saves back to them.

import { GameRoom, type GameMessage, type Player } from '@series-inc/rundot-game-sdk/mp-server';
import { rng } from '../game/rng';
import { IslandSim } from '../game/sim/sim';
import { PartBuffer, splitParts, type C2S, type S2C } from '../game/sim/protocol';
import { parseIslandSave, type IslandSave } from '../game/sim/types';
import { generateIsland } from '../game/world';

type Msg = C2S | S2C;

const TICK_MS = 100;
const SAVE_EVERY = 60;

export default class IslandRoom extends GameRoom<Msg> {
  private sim: IslandSim | null = null;
  private hostId = '';
  private readonly init = new PartBuffer();
  private readonly pending = new Map<string, string>();
  private saveAcc = 0;

  onCreate(): void {
    this.clock.setInterval('tick', () => this.step(), TICK_MS);
  }

  onPlayerJoin(player: Player): void {
    if (!this.hostId) this.hostId = player.id;
    if (!this.sim)
      this.sendTo(player.id, { type: 'wait', text: 'Waiting for the island to load…' });
  }

  onGameMessage(message: GameMessage<Msg>): void {
    const { sender, payload } = message;
    switch (payload.type) {
      case 'init': {
        if (sender.id !== this.hostId || this.sim) return;
        const whole = this.init.add(payload.part, payload.parts, payload.data);
        if (whole !== null) this.start(whole);
        return;
      }
      case 'bye':
        if (sender.id === this.hostId) this.sendSave();
        return;
      case 'hello':
        if (!this.sim) this.pending.set(sender.id, payload.name || sender.username);
        else this.sim.join(sender.id, payload.name || sender.username);
        return;
      default:
        if (this.sim && isClientMessage(payload)) this.sim.handle(sender.id, payload);
    }
  }

  onPlayerLeave(player: Player): void {
    this.pending.delete(player.id);
    if (player.id === this.hostId) this.sendSave();
    this.sim?.leave(player.id);
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
    for (const [id, name] of this.pending) this.sim.join(id, name);
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
  'eat',
  'equip',
  'craft',
  'place',
  'demolish',
  'move',
  'drop',
  'store',
  'take',
  'code',
  'respawn',
  'rules',
  'say',
]);

function isClientMessage(m: Msg): m is C2S {
  return CLIENT_TYPES.has(m.type);
}
