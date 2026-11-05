// The title theme: a slow piece in D minor made on the fly with WebAudio (nothing to ship):
// bass, pads and a plucked arpeggio over Dm Bb F C | Dm Bb Gm A, wind, and from the second
// half a tune over a low heartbeat. It plays on the title and the hub's pages, follows
// Settings › Audio (master × music) and fades out when a game starts (the game has its own
// music). Browsers keep sound locked until a tap, so it starts on the first one.

import { prefs } from './prefs';
import { gain } from './settings';

const BPM = 76;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

/** A bar's chord: the bass note, then the pad (MIDI). */
const CHORDS: number[][] = [
  [38, 50, 53, 57, 62], // Dm
  [34, 50, 53, 58, 62], // Bb
  [41, 48, 53, 57, 60], // F
  [36, 48, 52, 55, 60], // C
  [38, 50, 53, 57, 62], // Dm
  [34, 50, 53, 58, 62], // Bb
  [43, 50, 55, 58, 62], // Gm
  [45, 49, 52, 57, 61], // A
];

/** The tune over the 8 bars: [bar, beat, note, beats]. */
const TUNE: [number, number, number, number][] = [
  [0, 0, 69, 2],
  [0, 2, 74, 1],
  [0, 3, 76, 1],
  [1, 0, 77, 3],
  [1, 3, 76, 1],
  [2, 0, 72, 2],
  [2, 2, 69, 2],
  [3, 0, 67, 3.5],
  [4, 0, 69, 2],
  [4, 2, 74, 1],
  [4, 3, 76, 1],
  [5, 0, 77, 2],
  [5, 2, 79, 1],
  [5, 3, 77, 1],
  [6, 0, 74, 2],
  [6, 2, 70, 2],
  [7, 0, 73, 4],
];

/** Which pad notes the arpeggio walks through, an eighth each. */
const ARP = [1, 2, 3, 4, 3, 2, 3, 4];

const hz = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

class TitleMusic {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private padBus: GainNode | null = null;
  private echo: DelayNode | null = null;
  private reverb: ConvolverNode | null = null;
  private wind: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private wanted = false;
  private playing = false;
  private bar = 0;
  private nextBar = 0;
  private listening = false;
  private unsubscribe: (() => void) | null = null;

  /** On for the title and the hub, off in a game. */
  want(on: boolean): void {
    this.wanted = on;
    if (on) {
      this.listen();
      if (this.ctx) this.play();
    } else {
      this.fadeOut();
    }
  }

  private listen(): void {
    if (this.listening || typeof window === 'undefined') return;
    this.listening = true;
    // Taps in a game do nothing here: the music's context stays asleep while it's off.
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend().catch(() => {});
      else if (this.playing) void this.ctx.resume().catch(() => {});
    });
  }

  /** Must run from a user gesture. */
  private unlock(): void {
    if (!this.wanted) return;
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.build(new Ctor());
      } catch {
        return;
      }
    }
    this.play();
  }

  private build(ctx: AudioContext): void {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(ctx.destination);
    // A little space: a generated reverb and an echo for the plucks and the tune.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.42;
    this.reverb.connect(wet).connect(this.out);
    this.echo = ctx.createDelay(1.5);
    this.echo.delayTime.value = BEAT * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.35;
    this.echo.connect(fb).connect(this.echo);
    this.echo.connect(echoOut).connect(this.out);
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 900;
    this.padBus = ctx.createGain();
    this.padBus.gain.value = 0.11;
    this.padBus.connect(padFilter);
    padFilter.connect(this.out);
    padFilter.connect(this.reverb);
    // Wind: looped noise through a low-pass that drifts.
    const len = ctx.sampleRate * 4;
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 380;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(wf.frequency);
    this.wind = ctx.createGain();
    this.wind.gain.value = 0.05;
    src.connect(wf).connect(this.wind).connect(this.out);
    src.start();
    lfo.start();
    this.unsubscribe = prefs.subscribe(() => this.level(0.3));
  }

  private volume(): number {
    const s = prefs.get();
    return gain(s.master) * gain(s.music) * 0.9;
  }

  private level(smooth: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    this.out.gain.setTargetAtTime(this.playing ? this.volume() : 0, ctx.currentTime, smooth);
  }

  private play(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    // A resume outside a tap can be refused: every tap on the title tries again.
    if (ctx.state === 'suspended' && !document.hidden) void ctx.resume().catch(() => {});
    if (this.playing) {
      this.level(0.5);
      return;
    }
    this.playing = true;
    this.bar = 0;
    this.nextBar = ctx.currentTime + 0.2;
    this.level(1.2);
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 100);
  }

  private fadeOut(): void {
    if (!this.playing) return;
    this.playing = false;
    this.level(0.4);
    const ctx = this.ctx;
    // Stop scheduling once it's quiet, and let the device rest.
    setTimeout(() => {
      if (this.playing) return;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      void ctx?.suspend().catch(() => {});
    }, 2000);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') {
      if (ctx) this.nextBar = ctx.currentTime + 0.2;
      return;
    }
    if (this.nextBar < ctx.currentTime) this.nextBar = ctx.currentTime + 0.05;
    while (this.nextBar < ctx.currentTime + 0.4) {
      this.playBar(this.nextBar, this.bar);
      this.nextBar += BAR;
      this.bar++;
    }
  }

  private playBar(t: number, bar: number): void {
    const i = bar % 8;
    const chord = CHORDS[i] as number[];
    // The first time through is the intro (no tune); then the tune every half.
    const tune = bar >= 8;
    this.bass(chord[0] as number, t, BAR);
    this.pad(chord.slice(1), t, BAR);
    for (let e = 0; e < 8; e++) {
      const note = (chord[ARP[e] as number] as number) + 12;
      this.pluck(note, t + e * (BEAT / 2), e % 4 === 0 ? 0.05 : 0.035);
    }
    if (tune) {
      for (const [b, beat, note, beats] of TUNE)
        if (b === i) this.lead(note, t + beat * BEAT, beats * BEAT);
      // A low heartbeat under the tune.
      this.heart(t, 0.28);
      this.heart(t + BEAT * 0.3, 0.18);
    }
  }

  private bass(note: number, t: number, dur: number): void {
    const ctx = this.ctx as AudioContext;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz(note);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.08);
    g.gain.setTargetAtTime(0.12, t + 0.2, 0.6);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.2);
    osc.connect(g).connect(this.out as GainNode);
    osc.start(t);
    osc.stop(t + dur + 0.3);
  }

  private pad(notes: number[], t: number, dur: number): void {
    const ctx = this.ctx as AudioContext;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.9);
    env.gain.setValueAtTime(1, t + dur * 0.85);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.9);
    env.connect(this.padBus as GainNode);
    for (const note of notes) {
      for (const cents of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = hz(note);
        osc.detune.value = cents;
        const g = ctx.createGain();
        g.gain.value = 0.3;
        osc.connect(g).connect(env);
        osc.start(t);
        osc.stop(t + dur + 1);
      }
    }
  }

  private pluck(note: number, t: number, peak: number): void {
    const ctx = this.ctx as AudioContext;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0004, t + 0.9);
    env.connect(this.out as GainNode);
    env.connect(this.echo as DelayNode);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = hz(note);
    osc.connect(env);
    osc.start(t);
    osc.stop(t + 1);
  }

  private lead(note: number, t: number, dur: number): void {
    const ctx = this.ctx as AudioContext;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.085, t + 0.06);
    env.gain.setTargetAtTime(0.06, t + 0.1, 0.4);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.25);
    env.connect(this.out as GainNode);
    env.connect(this.reverb as ConvolverNode);
    env.connect(this.echo as DelayNode);
    // A soft flute: a sine with a little vibrato and a quiet octave.
    const vib = ctx.createOscillator();
    vib.frequency.value = 5;
    const vibGain = ctx.createGain();
    vibGain.gain.value = 3;
    vib.connect(vibGain);
    for (const [mul, g] of [
      [1, 1],
      [2, 0.12],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = hz(note) * mul;
      vibGain.connect(osc.detune);
      const gg = ctx.createGain();
      gg.gain.value = g;
      osc.connect(gg).connect(env);
      osc.start(t);
      osc.stop(t + dur + 0.3);
    }
    vib.start(t);
    vib.stop(t + dur + 0.3);
  }

  private heart(t: number, peak: number): void {
    const ctx = this.ctx as AudioContext;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(72, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g).connect(this.out as GainNode);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  private impulse(seconds: number): AudioBuffer {
    const ctx = this.ctx as AudioContext;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  /** Every bar of `seconds` scheduled at once on an offline context (renderTheme). */
  offline(ctx: AudioContext, seconds: number): void {
    this.build(ctx);
    this.unsubscribe?.();
    (this.out as GainNode).gain.value = 0.8;
    for (let bar = 0, t = 0.05; t < seconds; bar++, t += BAR) this.playBar(t, bar);
  }

  /** For tests and the dev hook: what it's doing. */
  state(): { wanted: boolean; playing: boolean; bar: number; ctx: string } {
    return {
      wanted: this.wanted,
      playing: this.playing,
      bar: this.bar,
      ctx: this.ctx?.state ?? 'none',
    };
  }

  dispose(): void {
    this.unsubscribe?.();
  }
}

export const titleMusic = new TitleMusic();

/** The theme rendered without playing it (dev: to listen to it as a file). */
export function renderTheme(seconds: number, sampleRate = 44100): Promise<AudioBuffer> {
  const off = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  new TitleMusic().offline(off as unknown as AudioContext, seconds);
  return off.startRendering();
}
