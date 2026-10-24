// Sound made on the fly with WebAudio (no files to ship): effects (short noise
// bursts and tones, quieter the further away they happen), wind and drone
// ambience, and music (music.ts), each with its own volume.

import { Music } from './music';

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
  | 'tap'
  | 'podfall'
  | 'creak'
  | 'thud'
  | 'thunder'
  | 'crack'
  | 'shoot'
  | 'grunt'
  | 'bleat'
  | 'cluck'
  | 'bark'
  | 'dig';

const HEAR = 38;

export interface Volumes {
  master: number;
  sfx: number;
  ambience: number;
  music: number;
}

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private music: Music | null = null;
  private noise: AudioBuffer | null = null;
  private ambient: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null =
    null;
  private drone: { osc: OscillatorNode; gain: GainNode } | null = null;
  private rain: GainNode | null = null;
  /** Gains (already curved), 0..1. */
  private vol: Volumes = { master: 0.64, sfx: 0.81, ambience: 0.49, music: 0.3 };

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
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.ambBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      for (const b of [this.sfxBus, this.ambBus, this.musicBus]) b.connect(this.master);
      this.applyVolumes(0);
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.startAmbient();
      this.music = new Music(ctx, this.musicBus, this.noise);
      if (this.vol.music > 0) this.music.start();
    } catch {
      this.ctx = null;
    }
  }

  /** Volumes as gains 0..1 (settings.gain turns slider values into these). */
  setVolumes(v: Volumes): void {
    this.vol = v;
    this.applyVolumes(0.05);
    if (this.music) {
      if (v.music > 0 && v.master > 0) this.music.start();
      else this.music.stop();
    }
  }

  private applyVolumes(smooth: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const set = (node: GainNode | null, v: number) => {
      if (!node) return;
      if (smooth) node.gain.setTargetAtTime(v, ctx.currentTime, smooth);
      else node.gain.value = v;
    };
    set(this.master, this.vol.master);
    set(this.sfxBus, this.vol.sfx);
    set(this.ambBus, this.vol.ambience);
    set(this.musicBus, this.vol.music);
  }

  suspend(): void {
    void this.ctx?.suspend().catch(() => {});
  }

  resume(): void {
    void this.ctx?.resume().catch(() => {});
  }

  private startAmbient(): void {
    const ctx = this.ctx;
    if (!ctx || !this.ambBus || !this.noise) return;
    // Wind and surf: filtered noise that breathes slowly.
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain).connect(gain.gain);
    src.connect(filter).connect(gain).connect(this.ambBus);
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
    osc.connect(dl).connect(dg).connect(this.ambBus);
    osc.start();
    this.drone = { osc, gain: dg };
    // Rain: hissing noise, silent until the weather turns.
    const rs = ctx.createBufferSource();
    rs.buffer = this.noise;
    rs.loop = true;
    const rf = ctx.createBiquadFilter();
    rf.type = 'highpass';
    rf.frequency.value = 1400;
    const rg = ctx.createGain();
    rg.gain.value = 0;
    rs.connect(rf).connect(rg).connect(this.ambBus);
    rs.start(0, 0.7);
    this.rain = rg;
  }

  /** How hard it rains (0..1). */
  setRain(level: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.rain) return;
    this.rain.gain.setTargetAtTime(level * 0.16, ctx.currentTime, 1.2);
  }

  /** A sound that comes later (thunder after the flash). */
  playLater(name: Sfx, seconds: number, distance = 0): void {
    setTimeout(() => this.play(name, distance), Math.max(0, seconds) * 1000);
  }

  /** Night (0..1), Bloom nights, how close the Bloom is (0..1) and the rescue. */
  setMood(night: number, bloom: boolean, danger = 0, rescue = false): void {
    const ctx = this.ctx;
    if (!ctx || !this.ambient || !this.drone) return;
    const t = ctx.currentTime;
    this.ambient.filter.frequency.setTargetAtTime(500 - night * 260, t, 1);
    this.drone.gain.gain.setTargetAtTime(night * (bloom ? 0.1 : 0.045), t, 1.5);
    this.drone.osc.frequency.setTargetAtTime(bloom ? 41 : 55, t, 2);
    this.music?.setMood({ night, bloom, danger, rescue });
  }

  /** Plays a sound at a distance (metres) from the listener. */
  play(name: Sfx, distance = 0): void {
    const ctx = this.ctx;
    const out = this.sfxBus;
    if (!ctx || !out || ctx.state !== 'running' || this.vol.master * this.vol.sfx < 0.001) return;
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
      case 'podfall': {
        // A rising whistle and roar as it comes down.
        const f = n(3.8, 400, 'bandpass', 0.35, 2.5, 1.2);
        f.frequency.exponentialRampToValueAtTime(2200, t + 3.6);
        o('sine', 1800, 500, 3.6, 0.08);
        break;
      }
      case 'creak':
        o('sawtooth', 110, 70, 0.9, 0.12);
        o('sawtooth', 116, 64, 0.8, 0.08, 0.1);
        n(0.5, 500, 'bandpass', 0.2, 0.2, 2);
        break;
      case 'thud':
        o('sine', 80, 30, 0.6, 0.9);
        n(0.6, 600, 'lowpass', 0.6, 0.004);
        n(0.4, 2500, 'bandpass', 0.25, 0.02, 0.8);
        break;
      case 'thunder':
        n(3.2, 160, 'lowpass', 0.9, 0.08);
        n(1.6, 420, 'lowpass', 0.4, 0.3);
        o('sine', 55, 28, 2.4, 0.45);
        break;
      case 'crack':
        n(0.35, 3000, 'highpass', 0.9, 0.002);
        o('square', 120, 40, 0.4, 0.3);
        break;
      case 'shoot':
        o('triangle', 420, 140, 0.16, 0.35);
        n(0.12, 1800, 'bandpass', 0.35, 0.002, 2);
        break;
      case 'grunt':
        o('sawtooth', 130, 80, 0.25, 0.25);
        n(0.2, 300, 'lowpass', 0.3, 0.02);
        break;
      case 'bleat':
        o('sawtooth', 520, 470, 0.45, 0.12);
        o('sine', 780, 700, 0.4, 0.06);
        break;
      case 'cluck':
        o('square', 900, 600, 0.06, 0.1);
        o('square', 950, 650, 0.06, 0.08, 0.12);
        break;
      case 'bark':
        o('sawtooth', 380, 180, 0.14, 0.3);
        n(0.12, 900, 'bandpass', 0.3, 0.004, 1.5);
        break;
      case 'dig':
        n(0.25, 500, 'lowpass', 0.6, 0.01);
        n(0.1, 2200, 'bandpass', 0.2, 0.01, 1);
        break;
    }
  }
}

export type { Sfx };
