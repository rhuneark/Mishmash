"""The trailer's score: 30 s in D minor at 120 bpm, cut to the shot list in trailer.mjs.

0-2.5 cold open (drone, wind) | 2.5-5 the taken (heartbeat, a dissonant swell)
5-8.5 gather/craft/build (pulse and toms) | 8.5-11.5 islands (a plucked melody)
11.5-14.5 storm and night (thunder, riser) | 14.5-20.5 the Bloom (full drums)
20.5-23.5 together (a warm lift) | 23.5-26.5 secrets (ticks, riser) | 26.5-30 title (impact, ring out)

python3 scripts/trailer/music.py out.wav
"""

import sys
import wave

import numpy as np

SR = 48000
DUR = 30.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(207)

L = np.zeros(N)
R = np.zeros(N)


def t_of(n):
    return np.arange(n) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    L[i : i + len(sig)] += sig * gain * l
    R[i : i + len(sig)] += sig * gain * r


def env(n, a=0.01, d=0.1, s=0.7, r=0.3, hold=None):
    """ADSR over n samples (hold = seconds at sustain before release)."""
    t = t_of(n)
    total = n / SR
    hold = total - a - d - r if hold is None else hold
    e = np.interp(
        t,
        [0, a, a + d, a + d + max(0, hold), a + d + max(0, hold) + r],
        [0, 1, s, s, 0],
    )
    return e


def lowpass(x, cutoff, order=1):
    """One-pole low-pass (order times over), done as FFT convolutions with its impulse response."""
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    k = int(min(len(x), SR * 0.25))
    h = a * (1 - a) ** np.arange(k)
    for _ in range(order):
        x = fftconv(x, h)[: len(x)]
    return x


def fftconv(x, h):
    n = len(x) + len(h) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(h, m), m)[:n]


def saw(f, n, detune=0.0):
    t = t_of(n)
    out = np.zeros(n)
    for d in (-detune, 0, detune):
        ph = (t * f * (1 + d)) % 1.0
        out += 2 * ph - 1
    return out / 3


def pad(notes, at, dur, gain, cutoff=900, attack=0.8, release=1.4):
    n = int((dur + release) * SR)
    sig = np.zeros(n)
    for m in notes:
        sig += saw(midi(m), n, 0.006)
    sig = lowpass(sig, cutoff) * env(n, attack, 0.3, 0.85, release, hold=dur - attack - 0.3)
    add(sig, at, gain * 0.5, -0.25)
    add(np.roll(sig, int(0.013 * SR)), at, gain * 0.5, 0.25)


def pluck(m, at, gain=0.3, decay=2.2, pan=0.0):
    n = int(1.6 * SR)
    t = t_of(n)
    f = midi(m)
    sig = np.zeros(n)
    for k in range(1, 9):
        sig += np.sin(2 * np.pi * f * k * t) * (1 / k**1.3) * np.exp(-t * decay * k**0.6)
    sig *= np.minimum(1, t / 0.004)
    add(sig, at, gain, pan)


def tom(at, gain=0.8, f0=95, f1=48, decay=7.0):
    n = int(0.9 * SR)
    t = t_of(n)
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * decay)
    click = lowpass(rng.standard_normal(n), 2500) * np.exp(-t * 60) * 0.6
    add(body + click, at, gain)


def snare(at, gain=0.35):
    n = int(0.4 * SR)
    t = t_of(n)
    noise = rng.standard_normal(n)
    sig = (noise - lowpass(noise, 1500)) * np.exp(-t * 16) + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
    add(sig, at, gain, 0.1)


def tick(at, gain=0.15, pan=0.0):
    n = int(0.08 * SR)
    t = t_of(n)
    noise = rng.standard_normal(n)
    sig = (noise - lowpass(noise, 5000)) * np.exp(-t * 90)
    add(sig, at, gain, pan)


def impact(at, gain=1.0):
    """A cinematic hit: a deep sine drop, a noise burst and a long low rumble."""
    n = int(4.0 * SR)
    t = t_of(n)
    f = 30 + 90 * np.exp(-t * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    noise = lowpass(rng.standard_normal(n), 700, order=3) * np.exp(-t * 3) * 2.4
    add(boom + noise, at, gain)


def thunder(at, gain=0.7):
    n = int(3.5 * SR)
    t = t_of(n)
    crack = lowpass(rng.standard_normal(n), 3000, order=2) * np.exp(-t * 9) * 0.9
    rumble = lowpass(rng.standard_normal(n), 200, order=3) * (np.exp(-t * 1.2) * (1 - np.exp(-t * 20))) * 7.0
    add(crack + rumble, at, gain, -0.2)


def riser(at, dur, gain=0.35):
    n = int(dur * SR)
    t = t_of(n)
    noise = rng.standard_normal(n)
    bright = noise - lowpass(noise, 900)
    f = 180 + 900 * (t / dur) ** 2
    sweep = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35
    sig = (bright + sweep) * (t / dur) ** 2.2
    add(sig, at, gain, 0.0)


def heartbeat(at, gain=0.6):
    for d, g in ((0, 1.0), (0.22, 0.7)):
        tom(at + d, gain * g, f0=70, f1=40, decay=11)


def wind(at, dur, gain=0.12):
    n = int(dur * SR)
    t = t_of(n)
    noise = rng.standard_normal(n)
    sweep = 0.5 + 0.5 * np.sin(2 * np.pi * t * 0.23)
    sig = lowpass(noise, 280, order=3) * 3 * (0.4 + 0.6 * sweep) * np.minimum(1, t / 1.0) * np.minimum(1, (dur - t) / 1.0)
    add(sig, at, gain, -0.4)
    add(np.roll(sig, int(0.3 * SR)), at, gain, 0.4)


# --- The score --------------------------------------------------------------------------------

D2, A2, D3, F3, A3, C4, D4, E4, F4, G4, A4, C5, D5 = 38, 45, 50, 53, 57, 60, 62, 64, 65, 67, 69, 72, 74
Dm = [50, 53, 57, 62]
Bb = [46, 53, 58, 62]
F = [48, 53, 57, 60]
C = [48, 52, 55, 60]
Gm = [43, 50, 55, 58]

# Cold open: wind and a low drone.
wind(0.0, 14.0, 0.16)
pad([D2, A2], 0.0, 5.0, 0.35, cutoff=300, attack=1.6)

# The taken: a heartbeat and a dissonant swell.
for b in (2.5, 3.5, 4.5):
    heartbeat(b, 0.5)
pad([50, 51, 57], 2.5, 2.5, 0.22, cutoff=700, attack=1.5, release=0.6)

# Gather, craft, build: the chords move, a pulse in eighths, toms on the beat.
prog = [(5.0, Dm), (7.0, Bb), (9.0, F), (11.0, C), (13.0, Dm)]
for at, ch in prog:
    pad(ch, at, 2.0, 0.28, cutoff=1100)
for k in range(int((14.5 - 5.0) / 0.25)):
    at = 5.0 + k * 0.25
    root = 50 if at < 7 else 46 if at < 9 else 53 if at < 11 else 48 if at < 13 else 50
    pluck(root + (12 if k % 4 == 2 else 0), at, 0.11, decay=9, pan=-0.3 if k % 2 else 0.3)
for k in range(int((14.5 - 5.0) / BEAT)):
    tom(5.0 + k * BEAT, 0.45 if k % 2 == 0 else 0.3)

# Islands: a plucked melody.
melody = [(8.5, A4), (9.0, C5), (9.5, D5), (10.0, A4), (10.5, F4), (11.0, G4), (11.25, A4), (12.0, E4), (12.5, F4), (13.0, D4)]
for at, m in melody:
    pluck(m, at, 0.2, decay=2.4, pan=0.15)

# Storm and night: thunder, then a riser into the Bloom.
thunder(11.5, 0.75)
riser(12.5, 2.0, 0.3)

# The Bloom: the big hit, full drums, low brass-like chords.
impact(14.5, 0.9)
bloom = [(14.5, [38, 50, 53, 57]), (16.5, [34, 46, 53, 58]), (18.5, [36, 48, 52, 55])]
for at, ch in bloom:
    pad(ch, at, 2.0, 0.42, cutoff=1500, attack=0.15)
for k in range(int((20.5 - 14.5) / 0.25)):
    at = 14.5 + k * 0.25
    if k % 2 == 0:
        tom(at, 0.75 if k % 4 == 0 else 0.5, f0=110, f1=50)
    if k % 4 == 2:
        snare(at, 0.4)
    tick(at, 0.08, pan=0.5 if k % 2 else -0.5)
for k in range(int((20.5 - 14.5) / 0.25)):
    pluck(38 + (12 if k % 2 else 0), 14.5 + k * 0.25, 0.12, decay=8)

# Together: a warm lift.
pad([46, 53, 58, 62, 65], 20.5, 1.5, 0.32, cutoff=2000, attack=0.2)
pad([48, 55, 60, 64, 67], 22.0, 1.5, 0.32, cutoff=2000, attack=0.2)
for k in range(6):
    tom(20.5 + k * BEAT, 0.35)
for at, m in [(20.5, D5), (21.0, C5), (21.5, A4), (22.0, C5), (22.5, E4 + 12), (23.0, D5)]:
    pluck(m, at, 0.16, decay=2.0, pan=-0.15)

# Secrets: ticking, a riser.
for k in range(12):
    tick(23.5 + k * 0.25, 0.14, pan=0.6 if k % 2 else -0.6)
pad([50, 53, 57], 23.5, 3.0, 0.2, cutoff=600)
riser(24.5, 2.0, 0.4)

# Title: the impact, and the island rings out.
impact(26.5, 1.0)
pad([38, 50, 57, 62, 64, 69], 26.5, 2.6, 0.45, cutoff=1700, attack=0.05, release=1.0)
for at, m in [(26.5, D4), (26.75, A4), (27.0, D5), (27.25, E4 + 12)]:
    pluck(m, at, 0.18, decay=1.2)

# --- Mix: a long reverb, a gentle limiter, fades -----------------------------------------------

ir_n = int(2.6 * SR)
ir_t = t_of(ir_n)
ir = rng.standard_normal(ir_n) * np.exp(-ir_t * 2.3)
ir = lowpass(ir, 4500)
ir /= np.sqrt(np.sum(ir**2))
wetL = fftconv(L, ir)[:N]
wetR = fftconv(R, np.roll(ir, 97))[:N]
outL = L + 0.32 * wetL
outR = R + 0.32 * wetR

fade = np.ones(N)
fade[: int(0.4 * SR)] = np.linspace(0, 1, int(0.4 * SR))
fade[-int(1.2 * SR) :] = np.linspace(1, 0, int(1.2 * SR))
stereo = np.stack([outL * fade, outR * fade], axis=1)
stereo /= np.max(np.abs(stereo)) + 1e-9
stereo = np.tanh(stereo * 1.6) / np.tanh(1.6) * 0.9

out = sys.argv[1] if len(sys.argv) > 1 else 'trailer-music.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((stereo * 32767).astype('<i2').tobytes())
print('wrote', out)
