#!/usr/bin/env python3
"""Build the soundtrack of a code-cartoon project from cues.js.

Every sound sits on the time written in cues.js -- the same constants the scene uses -- so
picture and sound cannot drift. Deterministic (seeded), no samples, no stock libraries.

    python synth_audio.py <project_dir> [--lufs -15] [--peak -1] [--no-music] [--seed 7]
    (or simply: cartoon audio)

A cut of a clip (cues "window": {"from", "to"}, written by `cartoon cut`) mixes that stretch of
song time: every event and track keeps its song time, the cut fades in 20 ms and out 1.5 s.

Mix = sound effects (event types) + synthesized music bed (music.mood) + voice lines
(audio/voice/<id>.wav made by voice.py) + your own tracks (cues "tracks"). Tracks marked
"duck": true and voice lines push the music and effects down while they play.
Writes cues["output"] (default audio/sfx.wav for old projects), 48 kHz stereo 16-bit,
normalised to the target loudness with a true-peak ceiling. Needs numpy + scipy (+ ffmpeg
for tracks).
"""
import argparse, json, re, sys, wave, zlib
from pathlib import Path

import numpy as np
from scipy import signal

SR = 48000


# ------------------------------------------------------------------ helpers
def load_cues(project: Path) -> dict:
    txt = (project / "cues.js").read_text(encoding="utf-8")
    m = re.search(r"/\*JSON-START\*/(.*)/\*JSON-END\*/", txt, re.S)
    if not m:
        sys.exit("cues.js: JSON-START/JSON-END markers not found")
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as e:
        sys.exit(f"cues.js is not strict JSON between the markers: {e}")


def env_adsr(n, a=0.005, d=0.05, s=0.6, r=0.1):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a_n - d_n - r_n)
    e = np.concatenate([np.linspace(0, 1, a_n, endpoint=False), np.linspace(1, s, d_n, endpoint=False),
                        np.full(s_n, s), np.linspace(s, 0, r_n)])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lowpass(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x)


def highpass(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x)


def db(x):
    return 10 ** (x / 20)


def place(bus, x, t0, pan=0.0):
    """add mono x into a stereo bus at t0 seconds (negative t0 trims the head)"""
    start = int(round(t0 * SR))
    if start < 0:
        x = x[-start:]
        start = 0
    if start >= len(bus) or len(x) == 0:
        return False
    end = min(len(bus), start + len(x))
    bus[start:end, 0] += x[: end - start] * np.sqrt((1 - pan) / 2) * 1.414
    bus[start:end, 1] += x[: end - start] * np.sqrt((1 + pan) / 2) * 1.414
    return True


# ------------------------------------------------------------------ sound effects
def v_scribble(rng, dur, fast=False):
    """pencil on paper: band-passed noise, chopped into stroke gestures"""
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    body = bandpass(noise, 1800, 7500) * 0.6 + bandpass(noise, 600, 1800) * 0.25
    gest = np.zeros(n)
    t = 0.0
    while t < dur:
        g = rng.uniform(0.06, 0.16) if fast else rng.uniform(0.09, 0.22)
        a, b = int(t * SR), int(min(dur, t + g) * SR)
        if b > a:
            gest[a:b] = np.sin(np.linspace(0, np.pi, b - a)) ** 0.7 * rng.uniform(0.5, 1.0)
        t += g + rng.uniform(0.0, 0.05)
    clicks = (rng.random(n) > 0.9993) * rng.uniform(0.3, 1.0, n)
    clicks = bandpass(clicks, 2500, 9000) * 3
    fade = np.minimum(1, np.minimum(np.arange(n) / (0.03 * SR), (n - np.arange(n)) / (0.06 * SR)))
    return (body * gest + clicks * gest) * fade * 0.55


def v_hatch(rng, dur):
    """hatching: regular back-and-forth strokes"""
    n = int(dur * SR)
    noise = bandpass(rng.standard_normal(n), 2200, 8000)
    rate = rng.uniform(9, 12)
    t = np.arange(n) / SR
    am = np.abs(np.sin(np.pi * rate * t)) ** 1.5
    fade = np.minimum(1, np.minimum(t / 0.03, (dur - t) / 0.08))
    return noise * am * fade * 0.5


def v_erase(rng, dur):
    n = int(dur * SR)
    noise = bandpass(rng.standard_normal(n), 300, 2500)
    t = np.arange(n) / SR
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 14 * t)
    return noise * am * env_adsr(n, 0.02, 0.05, 0.8, 0.08) * 0.5


def v_click(rng):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 180) + bandpass(rng.standard_normal(n), 3000, 9000) * np.exp(-t * 300) * 0.6
    return x * 0.8


def v_tick(rng):
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 400) * 0.5


def v_thump(rng):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 120 * np.exp(-t * 9) + 45
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 7) + lowpass(rng.standard_normal(n), 400) * np.exp(-t * 40) * 0.4
    return x * 0.9


def v_pop(rng):
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    f = 420 * np.exp(-t * 18) + 380
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28)
    return x * 0.7


def v_whoosh(rng, dur):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    chunks = 8
    for i in range(chunks):  # sweeping band with a rising centre
        a, b = i * n // chunks, (i + 1) * n // chunks
        fc = 500 * (2 ** (i * 3.2 / chunks))
        out[a:b] = bandpass(noise, fc * 0.6, min(fc * 1.6, 20000))[a:b]
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.6
    return out * e * 0.7


def v_chime(rng, f0=880.0, dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for h, a, dcy in [(1, 1, 2.5), (2.0, 0.45, 3.5), (3.01, 0.25, 5), (4.2, 0.12, 7)]:
        x += a * np.sin(2 * np.pi * f0 * h * t) * np.exp(-t * dcy)
    return x * np.minimum(1, t / 0.004) * 0.35


def v_sparkle(rng):
    out = np.zeros(int(0.45 * SR))
    for i in range(3):
        f = rng.choice([1760, 2093, 2349, 2637, 3136])
        c = v_chime(rng, f, 0.35) * 0.5
        o = int(i * 0.05 * SR)
        out[o:o + len(c)] += c[: len(out) - o]
    return out


def v_swell(rng, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = lowpass(rng.standard_normal(n), 1200)
    return noise * (t / dur) ** 2 * 0.5


def v_paper(rng):
    n = int(0.35 * SR)
    noise = bandpass(rng.standard_normal(n), 800, 6000)
    return noise * env_adsr(n, 0.01, 0.1, 0.4, 0.2) * 0.5


def v_page(rng):
    """page turn: a paper swish that rises, then a soft flap"""
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    swish = bandpass(noise, 900, 7000) * np.sin(np.pi * np.clip(t / 0.42, 0, 1)) ** 1.5
    flap = lowpass(noise, 700) * np.exp(-np.maximum(0, t - 0.38) * 28) * (t > 0.38)
    return (swish * 0.5 + flap * 0.7) * 0.6


def v_rumble(rng, dur):
    """rocket engine / big machine: low noise with flutter, eases in and out"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    body = lowpass(noise, 220, 4) * 2.2 + bandpass(noise, 220, 1400) * 0.35
    flutter = 0.75 + 0.25 * np.sin(2 * np.pi * 13 * t + rng.uniform(0, 6)) * np.sin(2 * np.pi * 3.1 * t)
    e = np.minimum(1, np.minimum(t / 0.25, np.maximum(0, dur - t) / 0.4))
    return body * flutter * e * 0.6


def v_magic(rng, dur):
    """magic shimmer: a quick rising run of soft bells + airy sparkle"""
    dur = max(0.6, dur)
    out = np.zeros(int(dur * SR))
    notes = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93]  # major pentatonic upwards
    step = dur * 0.55 / len(notes)
    for i, m in enumerate(notes):
        c = v_chime(rng, midi_hz(m), 0.7) * 0.3
        o = int(i * step * SR)
        out[o:o + len(c)] += c[: len(out) - o]
    air = highpass(rng.standard_normal(len(out)), 6000) * np.sin(np.linspace(0, np.pi, len(out))) * 0.05
    return out + air


def v_wind(rng, dur):
    """wind ambience: slow gusts of low noise"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    gust = 0.55 + 0.45 * np.sin(2 * np.pi * 0.23 * t + rng.uniform(0, 6)) * np.sin(2 * np.pi * 0.071 * t + 1)
    e = np.minimum(1, np.minimum(t / 0.8, np.maximum(0, dur - t) / 1.0))
    return (lowpass(noise, 700) * 0.9 + bandpass(noise, 700, 2500) * 0.15 * gust) * gust * e * 0.45


# ------------------------------------------------------------------ music
NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def pluck(f, dur, bright=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * f * h * t) for h, a in [(1, 1), (2, 0.35 * bright), (3, 0.15 * bright)])
    return x * np.exp(-t * 3.2) * np.minimum(1, t / 0.006)


def pluck_string(f, dur, rng, bright=0.6, decay=0.996):
    """Karplus-Strong plucked string (gusli / balalaika-like), via an IIR comb filter"""
    n = int(dur * SR)
    N = max(2, int(round(SR / f)))
    exc = np.zeros(n)
    burst = rng.standard_normal(N)
    if N > 16:
        burst = lowpass(burst, 1500 + 7000 * bright)
    exc[:N] = burst
    a = np.zeros(N + 2)
    a[0], a[N], a[N + 1] = 1.0, -0.5 * decay, -0.5 * decay
    y = signal.lfilter([1.0], a, exc)
    y *= np.minimum(1, (n - np.arange(n)) / (0.05 * SR))
    return y / (np.max(np.abs(y)) + 1e-9)


def pad(freqs, dur, cutoff=1800):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.12):
            x += np.sin(2 * np.pi * f * (1 + det / 100) * t + det)
    x = lowpass(x, cutoff)
    e = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.8)
    return x * e / (len(freqs) * 3)


def echo(x, delay, fb=0.35, taps=4):
    out = x.copy()
    d = int(delay * SR)
    for k in range(1, taps + 1):
        if d * k >= len(x):
            break
        out[d * k:] += x[: len(x) - d * k] * fb ** k
    return out


def add(out, x, t0, pan=0.0, gain=1.0):
    a = int(t0 * SR)
    if a >= len(out):
        return
    b = min(len(out), a + len(x))
    out[a:b, 0] += x[: b - a] * gain * (1 - pan)
    out[a:b, 1] += x[: b - a] * gain * (1 + pan)


def music_musicbox(rng, cfg, total, twist_t, root, beat):
    out = np.zeros((int(total * SR), 2))
    cold = [0, 3, 5, 7, 10, 12]  # sparse music-box notes, minor pentatonic
    t = 0.0
    while t < twist_t - 0.2:
        add(out, pluck(midi_hz(root + 12 + rng.choice(cold)), 1.2, 0.3) * 0.22, t, rng.uniform(-0.5, 0.5), 0.7)
        t += beat * rng.choice([1, 1, 2])
    if twist_t < total:  # warm: major pad + rising arpeggio
        prog = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]]
        bar, t, i = beat * 4, twist_t, 0
        while t < total:
            ch = prog[i % len(prog)]
            p = pad([midi_hz(root + c) for c in ch], min(bar, total - t) + 0.8) * 0.5
            add(out, p, t, 0.0, 0.5)
            for j, c in enumerate(ch + [ch[0] + 12]):
                if t + j * beat / 2 < total:
                    add(out, pluck(midi_hz(root + 12 + c), 0.9, 0.8) * 0.18, t + j * beat / 2, [-0.4, 0.2, 0.4, -0.2][j % 4])
            t += bar
            i += 1
    return out


def music_folk(rng, cfg, total, twist_t, root, beat):
    """plucked strings over a drone: modest minor tune before the twist, a dancing major one after"""
    out = np.zeros((int(total * SR), 2))
    drone = pad([midi_hz(root - 12), midi_hz(root - 5)], total, cutoff=900)
    add(out, drone, 0, 0.0, 0.18)
    t = 0.0
    minor = [0, 3, 5, 7, 10, 12]
    while t < twist_t - 0.2:  # cold: a lonely string, one note every beat or two
        add(out, pluck_string(midi_hz(root + 12 + rng.choice(minor)), 1.6, rng, 0.4) * 0.2, t, rng.uniform(-0.4, 0.4), 0.7)
        t += beat * rng.choice([1, 2, 2])
    if twist_t < total:  # warm: a motif of 8 eighths in major pentatonic, varied each bar, bass on the downbeat
        major = [0, 2, 4, 7, 9, 12, 14, 16]
        motif = [rng.integers(0, 6) for _ in range(8)]
        t, bar_i = twist_t, 0
        while t < total:
            add(out, pluck_string(midi_hz(root - 12), 1.4, rng, 0.3, 0.995) * 0.32, t, -0.2)
            add(out, pluck_string(midi_hz(root - 5), 1.0, rng, 0.3, 0.995) * 0.2, t + beat * 2, 0.2)
            for j, deg in enumerate(motif):
                tt = t + j * beat / 2
                if tt >= total:
                    break
                d = deg + (rng.integers(-1, 2) if j in (3, 7) else 0) + (2 if bar_i % 4 == 2 else 0)
                note = root + 12 + major[int(np.clip(d, 0, len(major) - 1))]
                add(out, pluck_string(midi_hz(note), 0.9, rng, 0.75) * 0.18, tt, [-0.35, 0.35][j % 2])
                if j % 2 == 0:  # tremolo on the strong eighths, like a balalaika
                    add(out, pluck_string(midi_hz(note), 0.5, rng, 0.75) * 0.08, tt + beat / 8, [-0.35, 0.35][j % 2])
            t += beat * 4
            bar_i += 1
    return out


def music_space(rng, cfg, total, twist_t, root, beat):
    """slow pads and echoing pings: dark minor before the twist, open major add9 after"""
    out = np.zeros((int(total * SR), 2))
    bar = beat * 4
    t = 0.0
    while t < min(twist_t, total):
        add(out, pad([midi_hz(root - 12), midi_hz(root - 9), midi_hz(root - 5), midi_hz(root + 2)], min(bar * 2, total - t) + 1.0, cutoff=900), t, 0.0, 0.55)
        t += bar * 2
    pings = np.zeros(int(total * SR))
    t = beat
    while t < twist_t - 0.3:
        c = pluck(midi_hz(root + 24 + rng.choice([0, 3, 7, 10])), 0.8, 0.2) * 0.12
        a = int(t * SR)
        pings[a:a + len(c)] += c[: len(pings) - a]
        t += beat * rng.choice([2, 3])
    pings = echo(pings, beat * 0.75, 0.45)
    out[:, 0] += pings * 0.9
    out[:, 1] += np.roll(pings, int(0.011 * SR)) * 0.9
    if twist_t < total:
        t = twist_t
        prog = [[0, 4, 7, 14], [-3, 0, 4, 11], [5, 9, 12, 16], [7, 11, 14, 18]]
        i = 0
        arp = np.zeros(int(total * SR))
        while t < total:
            ch = prog[i % len(prog)]
            add(out, pad([midi_hz(root + c) for c in ch], min(bar, total - t) + 1.0, cutoff=2600), t, 0.0, 0.5)
            for j in range(8):
                tt = t + j * beat / 2
                if tt >= total:
                    break
                c = pluck(midi_hz(root + 12 + ch[j % 4]), 0.6, 0.6) * 0.1
                a = int(tt * SR)
                arp[a:a + len(c)] += c[: len(arp) - a]
            t += bar
            i += 1
        arp = echo(arp, beat * 0.75, 0.4)
        out[:, 0] += arp
        out[:, 1] += np.roll(arp, int(0.017 * SR))
        air = highpass(rng.standard_normal(len(arp)), 7000) * 0.006
        a = int(twist_t * SR)
        out[a:, 0] += air[a:]
        out[a:, 1] += air[a:][::-1][: len(out) - a]
    return out


MOODS = {"musicbox": music_musicbox, "folk": music_folk, "space": music_space}


def music_bed(rng, cfg, total, twist_t):
    root = 57 + NOTE.get(cfg.get("root", "A"), 9) - 9  # around A3
    beat = 60.0 / cfg.get("bpm", 96)
    mood = cfg.get("mood", "musicbox")
    if mood not in MOODS:
        print(f"  ! unknown music mood '{mood}' -- using musicbox (have: {', '.join(MOODS)})")
        mood = "musicbox"
    out = MOODS[mood](rng, cfg, total, twist_t, root, beat)
    f = int(0.6 * SR)  # last 0.6 s fade so the poster ends clean
    out[-f:] *= np.linspace(1, 0, f)[:, None]
    return out


# ------------------------------------------------------------------ ducking
def duck_gain(key, depth_db=9.0, thr_db=-42.0, attack=0.04, release=0.35):
    """gain curve (linear, per sample) that dips by depth_db while `key` (mono) is sounding"""
    hop = int(0.01 * SR)
    n = len(key)
    frames = max(1, n // hop)
    lvl = np.array([np.sqrt(np.mean(key[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(frames)])
    target = np.clip((20 * np.log10(lvl + 1e-9) - thr_db) / 6.0, 0, 1)
    a_up, a_dn = np.exp(-0.01 / attack), np.exp(-0.01 / release)
    sm = np.zeros(frames)
    v = 0.0
    for i, x in enumerate(target):
        k = a_up if x > v else a_dn
        v = k * v + (1 - k) * x
        sm[i] = v
    g_db = -depth_db * sm
    curve = np.interp(np.arange(n), (np.arange(frames) + 0.5) * hop, g_db)
    return db(curve), g_db, target


# ------------------------------------------------------------------ loudness (ITU-R BS.1770-4)
def k_weight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x))


def integrated_lufs(st):
    """gated integrated loudness of a stereo signal (n, 2) at 48 kHz"""
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    kw = np.stack([k_weight(st[:, c]) for c in range(st.shape[1])], axis=1)
    pw = [np.mean(kw[i:i + blk] ** 2, axis=0).sum() for i in range(0, max(1, len(kw) - blk), hop)]
    pw = np.array(pw) + 1e-12
    lk = -0.691 + 10 * np.log10(pw)
    g = pw[lk > -70]
    if len(g) == 0:
        return -70.0
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g2 = pw[(lk > -70) & (lk > rel)]
    return float(-0.691 + 10 * np.log10(g2.mean())) if len(g2) else -70.0


def true_peak_db(st):
    up = signal.resample_poly(st, 4, 1, axis=0)
    return float(20 * np.log10(np.max(np.abs(up)) + 1e-12))


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("--lufs", type=float, default=-15.0, help="target integrated loudness (-16..-14 for social)")
    ap.add_argument("--peak", type=float, default=-1.0, help="true-peak ceiling, dBFS")
    ap.add_argument("--no-music", action="store_true")
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()

    project = Path(a.project)
    cues = load_cues(project)
    total = float(cues["duration"])
    win = cues.get("window") or {}
    off = float(win.get("from", 0))  # a cut: song time -> time in the cut
    N = int(total * SR) + SR
    sfx, music, voice, tracks = (np.zeros((N, 2)) for _ in range(4))
    ids = [e.get("id") for e in cues["events"]]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        sys.exit(f"duplicate cue ids: {dup}")

    report, missing_voice = [], []
    for e in cues["events"]:
        typ, t0, dur = e.get("type", "none"), float(e["t"]) - off, float(e.get("dur", 0.4))
        if typ in ("none", "caption", "lyric"):
            continue
        if t0 >= total:
            if not win:  # in a cut, events after its window are expected
                print(f"  ! cue {e['id']} at {t0:.2f}s is past the end ({total:.2f}s) -- skipped")
            continue
        if typ == "voice":
            f = project / "audio" / "voice" / f"{e['id']}.wav"
            if not f.exists():
                missing_voice.append(e["id"])
                continue
            from _audio import load_audio
            x = load_audio(f, SR, 1) * db(e.get("gain", 0.0))
            place(voice, x, t0, float(e.get("pan", 0.0)))
            report.append(f"  {t0:7.3f}s  {'voice':9s} {e['id']}  ({len(x) / SR:.2f}s)")
            continue
        r = np.random.default_rng([a.seed, zlib.crc32(e["id"].encode())])  # stable across runs
        gen = {
            "scribble": lambda: v_scribble(r, dur),
            "write": lambda: v_scribble(r, dur, fast=True) * 0.8,
            "hatch": lambda: v_hatch(r, dur),
            "erase": lambda: v_erase(r, dur),
            "click": lambda: v_click(r),
            "tick": lambda: v_tick(r),
            "thump": lambda: v_thump(r),
            "pop": lambda: v_pop(r),
            "whoosh": lambda: v_whoosh(r, dur),
            "chime": lambda: v_chime(r),
            "sparkle": lambda: v_sparkle(r),
            "swell": lambda: v_swell(r, dur),
            "paper": lambda: v_paper(r),
            "page": lambda: v_page(r),
            "rumble": lambda: v_rumble(r, dur),
            "magic": lambda: v_magic(r, float(e.get("dur", 1.2))),
            "wind": lambda: v_wind(r, dur),
        }.get(typ)
        if gen is None:
            print(f"  ! unknown sound type '{typ}' in cue {e['id']} -- skipped")
            continue
        if place(sfx, gen() * db(e.get("gain", 0.0)), t0, float(e.get("pan", 0.0))):
            report.append(f"  {t0:7.3f}s  {typ:9s} {e['id']}")
    if missing_voice:
        print(f"  ! no audio for voice cues {', '.join(missing_voice)} -- run: cartoon voice")

    mus = cues.get("music", {})
    if mus.get("enabled") and not a.no_music:
        tw = next((float(e["t"]) - off for e in cues["events"] if e["id"] == mus.get("twist", "twist")), total)
        bed = music_bed(np.random.default_rng(a.seed + 1), mus, total, tw) * db(mus.get("gain", -6))
        music[: len(bed)] += bed

    for tr in cues.get("tracks", []):
        from _audio import load_audio
        f = project / tr["file"]
        if not f.exists():
            print(f"  ! track {tr['file']} not found -- skipped")
            continue
        t_in, skip = float(tr.get("t", 0)) - off, float(tr.get("from", 0))
        if t_in < 0:  # the cut starts inside this track
            skip, t_in = skip - t_in, 0.0
        x = load_audio(f, SR, 2)[int(skip * SR):] * db(tr.get("gain", 0.0))
        start = int(t_in * SR)
        if start < len(tracks):
            end = min(len(tracks), start + len(x))
            (voice if tr.get("duck") else tracks)[start:end] += x[: end - start]
            report.append(f"  {float(tr.get('t', 0)):7.3f}s  {'track':9s} {tr['file']}{'  (ducks the rest)' if tr.get('duck') else ''}")

    # voice and duck tracks push music, effects and other tracks down while they sound
    duck_note = ""
    if np.max(np.abs(voice)) > 1e-4:
        g, g_db, active = duck_gain(voice.mean(axis=1), float(cues.get("duck_db", 9.0)))
        for bus in (sfx, music, tracks):
            bus *= g[:, None]
        on = active > 0.5
        if on.any():
            duck_note = f"  ducking: {np.mean(g_db[on]):.1f} dB under the voice ({on.mean() * 100:.0f}% of the time)"

    out = (sfx + music + tracks + voice)[: int(total * SR)]
    out = highpass(out.T, 30).T  # remove DC / sub rumble
    if win:  # a cut: no click at the start, a fade at the end
        n_in, n_out = int(0.02 * SR), min(len(out), int(float(win.get("fade", 1.5)) * SR))
        out[:n_in] *= np.linspace(0, 1, n_in)[:, None]
        if n_out:
            out[len(out) - n_out:] *= np.linspace(1, 0, n_out)[:, None] ** 1.5
    silent = np.max(np.abs(out)) < 1e-6
    # loudness to target, true peak under the ceiling; iterate because limiting lowers loudness
    ceil = db(a.peak - 0.3)
    for _ in range(0 if silent else 5):
        out *= db(a.lufs - integrated_lufs(out))
        if true_peak_db(out) > a.peak:
            out = np.tanh(out / ceil) * ceil  # soft-knee limiter
        if abs(integrated_lufs(out) - a.lufs) < 0.2 and true_peak_db(out) <= a.peak:
            break
    L2, tp2 = (-70.0, -120.0) if silent else (integrated_lufs(out), true_peak_db(out))

    dest = project / cues.get("output", "audio/sfx.wav")
    dest.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(out, -1, 1) * 32767).astype("<i2")
    with wave.open(str(dest), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("\n".join(report))
    if duck_note:
        print(duck_note)
    print(f"{dest.relative_to(project).as_posix()}  {total:.2f}s  integrated {L2:.1f} LUFS  true peak {tp2:.1f} dBFS"
          + (f"  music: {mus.get('mood', 'musicbox')}" if mus.get("enabled") and not a.no_music else ""))
    if silent:
        print("  (silent: no sound events, music off)")
    elif not (-16.5 <= L2 <= -13.5):
        print("  ! loudness outside -16..-14 LUFS -- check the mix")


if __name__ == "__main__":
    main()
