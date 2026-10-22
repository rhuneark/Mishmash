// Sound effects made on the fly with WebAudio (no files to ship): short noise
// bursts and tones, quieter the further away they happen.

type Sfx =
  | 'chop'
  | 'mine'
  | 'gather'
  | 'hit'
  | 'swing'
  | 'mobhit'
  | 'death'
  | 'burst'
  | 'boom'
  | 'slam'
  | 'slamwarn'
  | 'bite'
  | 'build'
  | 'break'
  | 'eat'
  | 'heal'
  | 'craft'
  | 'deny'
  | 'unlock'
  | 'pickup'
  | 'drink'
  | 'throw'
  | 'night'
  | 'bloom'
  | 'dawn'
  | 'win'
  | 'dead'
  | 'tap';

const HEAR = 38;

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ambient: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null =
    null;
  private drone: { osc: OscillatorNode; gain: GainNode } | null = null;
  muted = false;

  /** Must run from a user gesture (browsers keep audio locked until then). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.startAmbient();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
  }

  suspend(): void {
    void this.ctx?.suspend().catch(() => {});
  }

  resume(): void {
    void this.ctx?.resume().catch(() => {});
  }

  private startAmbient(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    // Wind and surf: filtered noise that breathes slowly.
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain).connect(gain.gain);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    lfo.start();
    this.ambient = { src, gain, filter };
    // A low drone that swells at night.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const dl = ctx.createBiquadFilter();
    dl.type = 'lowpass';
    dl.frequency.value = 180;
    const dg = ctx.createGain();
    dg.gain.value = 0;
    osc.connect(dl).connect(dg).connect(this.master);
    osc.start();
    this.drone = { osc, gain: dg };
  }

  /** Night (0..1) and Bloom nights change the ambience. */
  setMood(night: number, bloom: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.ambient || !this.drone) return;
    const t = ctx.currentTime;
    this.ambient.filter.frequency.setTargetAtTime(500 - night * 260, t, 1);
    this.drone.gain.gain.setTargetAtTime(night * (bloom ? 0.07 : 0.03), t, 1.5);
    this.drone.osc.frequency.setTargetAtTime(bloom ? 41 : 55, t, 2);
  }

  /** Plays a sound at a distance (metres) from the listener. */
  play(name: Sfx, distance = 0): void {
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out || this.muted || ctx.state !== 'running') return;
    const vol = Math.max(0, 1 - distance / HEAR);
    if (vol <= 0.02) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(out);
    const n = (
      dur: number,
      freq: number,
      type: BiquadFilterType,
      peak: number,
      attack = 0.005,
      q = 1,
    ) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(peak, t + attack);
      e.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f).connect(e).connect(g);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.05);
      return f;
    };
    const o = (
      type: OscillatorType,
      f0: number,
      f1: number,
      dur: number,
      peak: number,
      delay = 0,
    ) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + delay + dur);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t + delay);
      e.gain.linearRampToValueAtTime(peak, t + delay + 0.01);
      e.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      osc.connect(e).connect(g);
      osc.start(t + delay);
      osc.stop(t + delay + dur + 0.05);
    };
    switch (name) {
      case 'chop':
        n(0.12, 900, 'bandpass', 0.7, 0.002, 2);
        o('triangle', 180, 90, 0.12, 0.35);
        break;
      case 'mine':
        n(0.08, 3000, 'highpass', 0.4);
        o('square', 900, 600, 0.15, 0.12);
        o('sine', 1800, 1500, 0.25, 0.08);
        break;
      case 'gather':
        n(0.25, 2500, 'highpass', 0.25, 0.03);
        break;
      case 'hit':
        o('sine', 160, 50, 0.22, 0.6);
        n(0.1, 600, 'lowpass', 0.5);
        break;
      case 'swing':
      case 'throw': {
        const f = n(0.22, 600, 'bandpass', 0.35, 0.05, 1.5);
        f.frequency.exponentialRampToValueAtTime(2400, t + 0.2);
        break;
      }
      case 'mobhit':
        n(0.15, 700, 'bandpass', 0.6, 0.003, 1.2);
        o('sawtooth', 220, 110, 0.12, 0.15);
        break;
      case 'death':
        o('sawtooth', 300, 40, 0.7, 0.25);
        n(0.6, 400, 'lowpass', 0.4, 0.05);
        break;
      case 'burst':
        o('sine', 300, 60, 0.15, 0.5);
        n(0.8, 1800, 'bandpass', 0.35, 0.01, 0.6);
        break;
      case 'boom':
        o('sine', 120, 30, 0.6, 0.9);
        n(0.9, 900, 'lowpass', 0.8, 0.005);
        break;
      case 'slam':
        o('sine', 90, 25, 0.7, 1);
        n(0.5, 300, 'lowpass', 0.8);
        break;
      case 'slamwarn':
        o('sawtooth', 70, 140, 0.9, 0.2);
        break;
      case 'bite':
        n(0.06, 2000, 'highpass', 0.7);
        o('square', 400, 120, 0.08, 0.2);
        break;
      case 'build':
        o('triangle', 220, 160, 0.08, 0.4);
        o('triangle', 260, 180, 0.08, 0.4, 0.12);
        n(0.08, 800, 'bandpass', 0.4);
        break;
      case 'break':
        n(0.4, 1200, 'bandpass', 0.7, 0.002, 0.8);
        o('triangle', 140, 60, 0.3, 0.3);
        break;
      case 'eat':
        n(0.07, 1600, 'bandpass', 0.4);
        n(0.1, 900, 'bandpass', 0.3, 0.04);
        break;
      case 'drink':
        o('sine', 300, 600, 0.12, 0.3);
        o('sine', 320, 700, 0.12, 0.3, 0.16);
        break;
      case 'heal':
        o('sine', 520, 1040, 0.4, 0.25);
        o('sine', 660, 1320, 0.4, 0.15, 0.1);
        break;
      case 'craft':
        o('triangle', 440, 440, 0.12, 0.3);
        o('triangle', 660, 660, 0.18, 0.3, 0.1);
        break;
      case 'deny':
        o('square', 140, 120, 0.18, 0.15);
        break;
      case 'unlock':
        n(0.05, 3000, 'highpass', 0.5);
        o('sine', 880, 880, 0.3, 0.25, 0.08);
        o('sine', 1320, 1320, 0.4, 0.2, 0.2);
        break;
      case 'pickup':
        o('sine', 600, 1200, 0.12, 0.3);
        break;
      case 'night':
        o('sine', 220, 110, 2.2, 0.2);
        o('sine', 165, 82, 2.4, 0.15, 0.3);
        break;
      case 'bloom':
        o('sawtooth', 55, 50, 3, 0.25);
        o('sawtooth', 58, 52, 3, 0.2, 0.2);
        n(2.5, 300, 'lowpass', 0.3, 0.8);
        break;
      case 'dawn':
        o('sine', 392, 392, 0.5, 0.2);
        o('sine', 523, 523, 0.6, 0.2, 0.25);
        o('sine', 659, 659, 0.9, 0.2, 0.5);
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, k) => o('triangle', f, f, 0.6, 0.25, k * 0.15));
        break;
      case 'dead':
        o('sine', 220, 55, 1.6, 0.35);
        break;
      case 'tap':
        o('sine', 800, 700, 0.05, 0.1);
        break;
    }
  }
}

export type { Sfx };
