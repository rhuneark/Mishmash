// What a game tells RUN's analytics, so updates can follow what players do: the first
// session as a funnel (app → intro → island → each tutorial step → the first night → day 3 →
// escape), and events for the tutorial, crafting, nights, deaths, escapes, how long a
// session lasts and how smoothly it runs. Watches the client a few times a second.

import * as run from '../sdk/run';
import { TUTORIAL, TUT_DONE } from '../game/tutorial';
import type { MeNet } from '../game/sim/protocol';

/** First-session funnel steps (1 and 2 are the hub's: app loaded, intro done). */
export const FUNNEL = {
  island: 3,
  /** + the step's index. */
  tutorial: 4,
  firstNight: 4 + TUTORIAL.length,
  day3: 5 + TUTORIAL.length,
  escaped: 6 + TUTORIAL.length,
} as const;

interface Seen {
  tut: number;
  alive: boolean;
  escaped: boolean;
  crafted: number;
  day: number;
}

export class Telemetry {
  private last: Seen | null = null;
  private readonly startedAt: number;
  private startDay = 0;
  private deaths = 0;

  constructor(
    private readonly mode: string,
    now: number,
  ) {
    this.startedAt = now;
  }

  /** The island is on screen. */
  ready(day: number, level: number): void {
    this.startDay = day;
    run.track('island_ready', { mode: this.mode, day, level });
    run.funnel(FUNNEL.island, 'island_ready');
  }

  /** What changed since the last look (`now`: the session clock in seconds). */
  watch(me: MeNet, day: number, bloom: boolean, now: number): void {
    const seen: Seen = {
      tut: me.tut,
      alive: me.alive,
      escaped: me.escaped,
      crafted: me.crafted,
      day,
    };
    const was = this.last;
    this.last = seen;
    if (!was) return;
    const sec = Math.round(now - this.startedAt);
    if (seen.tut > was.tut && seen.tut <= TUT_DONE) {
      for (let i = was.tut; i < seen.tut; i++) {
        const step = TUTORIAL[i];
        if (!step) continue;
        run.track('tutorial_step', { step: i + 1, id: step.id, sec });
        run.funnel(FUNNEL.tutorial + i, `tutorial_${step.id}`);
      }
    }
    if (was.crafted === 0 && seen.crafted > 0) run.track('first_craft', { sec, day });
    if (seen.day > was.day && seen.alive) {
      run.track('night_survived', { day: was.day, bloom, sec });
      if (was.day === 1) run.funnel(FUNNEL.firstNight, 'first_night_survived');
      if (seen.day === 3) run.funnel(FUNNEL.day3, 'day_3');
    }
    if (was.alive && !seen.alive) {
      this.deaths++;
      run.track('death', { day, sec, deaths: this.deaths });
    }
    if (!was.escaped && seen.escaped) {
      run.track('escaped', { day, sec });
      run.funnel(FUNNEL.escaped, 'escaped');
    }
  }

  tutorialSkipped(step: number): void {
    run.track('tutorial_skip', { step: step + 1, id: TUTORIAL[step]?.id ?? 'done' });
  }

  /** How smoothly it runs: a sample now and then (frames per second, on what). */
  perf(fps: number, quality: string, w: number, h: number, touch: boolean): void {
    run.track('perf', { fps: Math.round(fps), quality, w, h, touch });
  }

  /** The game is closing: how long it lasted and how far it got. */
  end(now: number, level: number): void {
    run.track('session_end', {
      mode: this.mode,
      minutes: Math.round((now - this.startedAt) / 6) / 10,
      days: Math.max(0, (this.last?.day ?? this.startDay) - this.startDay),
      day: this.last?.day ?? this.startDay,
      level,
      deaths: this.deaths,
    });
  }
}
