// Music made on the fly with WebAudio: soft chords and a plucked melody that
// follow the island's mood. Calm and bright by day, minor and sparse at night,
// drums when the Bloom closes in, a sick drone on Bloom nights.

export interface MusicMood {
  /** 0 day … 1 night. */
  night: number;
  bloom: boolean;
  /** 0 calm … 1 surrounded. */
  danger: number;
  rescue: boolean;
}

interface Progression {
  /** Chords as MIDI notes (low to high); the first is the root. */
  chords: number[][];
  /** Melody notes. */
  scale: number[];
  wave: OscillatorType;
  filter: number;
}

const DAY: Progression = {
  chords: [
    [48, 60, 64, 67],
    [45, 57, 60, 64],
    [41, 57, 60, 65],
    [43, 55, 59, 62],
  ],
  scale: [72, 74, 76, 79, 81, 84, 86],
  wave: 'triangle',
  filter: 1400,
};

const NIGHT: Progression = {
  chords: [
    [45, 57, 60, 64],
    [41, 53, 57, 60],
    [43, 55, 60, 64],
    [40, 56, 59, 64],
  ],
  scale: [69, 72, 74, 76, 79, 81],
  wave: 'sawtooth',
  filter: 650,
};

const BLOOM: Progression = {
  chords: [
    [33, 57, 60, 63],
    [34, 58, 61, 64],
    [33, 56, 60, 63],
    [28, 52, 58, 59],
  ],
  scale: [57, 58, 61, 63, 64, 66],
  wave: 'sawtooth',
  filter: 420,
};

function hz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export class Music {
  private readonly ctx: AudioContext;
  private readonly out: GainNode;
  private readonly padBus: GainNode;
  private readonly padFilter: BiquadFilterNode;
  private readonly echo: DelayNode;
  private readonly reverb: ConvolverNode;
  private readonly noise: AudioBuffer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;
  private mood: MusicMood = { night: 0, bloom: false, danger: 0, rescue: false };
  private danger = 0;
  private lastNote = 3;
  private prog: Progression = DAY;

  constructor(ctx: AudioContext, out: AudioNode, noise: AudioBuffer) {
    this.ctx = ctx;
    this.noise = noise;
    this.out = ctx.createGain();
    this.out.gain.value = 0.5;
    this.out.connect(out);
    // A little space: a short generated reverb and a soft echo for the melody.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(this.out);
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.4;
    this.echo.connect(fb).connect(this.echo);
    this.echo.connect(echoOut).connect(this.out);
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = DAY.filter;
    this.padBus = ctx.createGain();
    this.padBus.gain.value = 0.16;
    this.padBus.connect(this.padFilter);
    this.padFilter.connect(this.out);
    this.padFilter.connect(this.reverb);
  }

  start(): void {
    if (this.timer) return;
    this.nextBeat = this.ctx.currentTime + 0.3;
    this.timer = setInterval(() => this.schedule(), 60);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setMood(m: MusicMood): void {
    this.mood = m;
  }

  private impulse(seconds: number): AudioBuffer {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  private tempo(): number {
    const base = this.mood.bloom ? 64 : 70 - this.mood.night * 10;
    return base + this.danger * 36;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (ctx.state !== 'running') {
      this.nextBeat = ctx.currentTime + 0.3;
      return;
    }
    // Danger rises fast and settles slowly, so the drums don't flutter.
    const want = Math.max(this.mood.danger, this.mood.rescue ? 0.85 : 0);
    this.danger += (want - this.danger) * (want > this.danger ? 0.08 : 0.012);
    if (this.nextBeat < ctx.currentTime) this.nextBeat = ctx.currentTime + 0.05;
    while (this.nextBeat < ctx.currentTime + 0.25) {
      const len = 60 / this.tempo();
      this.playBeat(this.nextBeat, this.beat, len);
      this.nextBeat += len;
      this.beat++;
    }
  }

  private playBeat(t: number, beat: number, len: number): void {
    const m = this.mood;
    if (beat % 8 === 0) {
      this.prog = m.bloom && m.night > 0.5 ? BLOOM : m.night > 0.55 && !m.rescue ? NIGHT : DAY;
      const chord = this.prog.chords[(beat / 8) % 4] as number[];
      this.padFilter.frequency.setTargetAtTime(this.prog.filter + this.danger * 900, t, 1.5);
      this.pad(chord, t, len * 8);
    }
    // The melody: a wandering line, busier by day.
    const busy = (this.prog === DAY ? 0.42 : this.prog === NIGHT ? 0.26 : 0.18) + this.danger * 0.2;
    if (Math.random() < busy) this.melody(t, len);
    if (Math.random() < busy * 0.35) this.melody(t + len / 2, len);
    // Drums when the Bloom is close (and for the rescue).
    const d = this.danger;
    if (d > 0.15) {
      const k = Math.min(1, (d - 0.15) / 0.6);
      if (beat % 2 === 0) this.kick(t, 0.55 * k);
      if (beat % 4 === 2) this.snare(t, 0.3 * k);
      this.hat(t + len / 2, 0.12 * k);
      if (d > 0.6) this.hat(t, 0.08 * k);
    }
  }

  private pad(chord: number[], t: number, dur: number): void {
    const ctx = this.ctx;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + Math.min(2, dur * 0.3));
    env.gain.setValueAtTime(1, t + dur * 0.8);
    env.gain.linearRampToValueAtTime(0, t + dur + 1.5);
    env.connect(this.padBus);
    chord.forEach((note, i) => {
      for (const cents of i === 0 ? [0] : [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = i === 0 ? 'sine' : this.prog.wave;
        osc.frequency.value = hz(note);
        osc.detune.value = cents;
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 0.9 : 0.35;
        osc.connect(g).connect(env);
        osc.start(t);
        osc.stop(t + dur + 1.6);
      }
    });
  }

  private melody(t: number, len: number): void {
    const ctx = this.ctx;
    const scale = this.prog.scale;
    this.lastNote = Math.max(
      0,
      Math.min(scale.length - 1, this.lastNote + Math.round((Math.random() - 0.5) * 4)),
    );
    const f = hz(scale[this.lastNote] as number);
    const env = ctx.createGain();
    const peak = this.prog === BLOOM ? 0.06 : 0.1;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0005, t + Math.max(0.6, len * 2));
    env.connect(this.out);
    env.connect(this.echo);
    env.connect(this.reverb);
    for (const [mul, type, g] of [
      [1, 'sine', 1],
      [2, 'triangle', 0.25],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f * mul;
      const gg = ctx.createGain();
      gg.gain.value = g;
      osc.connect(gg).connect(env);
      osc.start(t);
      osc.stop(t + Math.max(0.6, len * 2) + 0.1);
    }
  }

  private kick(t: number, peak: number): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(this.out);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  private noiseHit(t: number, peak: number, dur: number, freq: number, type: BiquadFilterType) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private snare(t: number, peak: number): void {
    this.noiseHit(t, peak, 0.16, 1700, 'bandpass');
  }

  private hat(t: number, peak: number): void {
    this.noiseHit(t, peak, 0.05, 7000, 'highpass');
  }
}
