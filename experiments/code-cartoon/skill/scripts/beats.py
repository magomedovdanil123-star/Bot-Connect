#!/usr/bin/env python3
"""Find the beat of a music track: tempo, beats, bars, energy and a twist candidate.

    python beats.py song.mp3 [-o refs/beats.json] [--png refs/beats.png] [--bpm-min 60] [--bpm-max 190]
                    [--snap cues.js [--grid beat|bar] [--all] [--tol 0.15] [--twist]]
    (or: cartoon beats song.mp3 --snap cues.js)

JSON: bpm, beats[], downbeats[], energy {times, db}, twist_candidate, duration.
PNG "song map": loudness envelope, energy curve, beat ticks, bar lines, twist marker — look at it.

--snap moves cue events onto the grid: events with "snap": "beat" | "bar", or every sound event
(t >= 0) with --all. The song is added to "tracks" (path relative to the project), synthesized
music is switched off and music.bpm is set, so `cartoon audio` mixes your song with the effects.
--twist also moves the "twist" cue to the twist candidate (the strongest energy rise in the
middle of the track, on a bar line).
Pure numpy/scipy (no librosa); needs ffmpeg to decode.
"""
import argparse, json, os, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _cues  # noqa: E402
from _audio import load_audio, onset_strength, rms_db  # noqa: E402

SR, NFFT, HOP = 22050, 1024, 256
FPS = SR / HOP
OFFSET = 0.033  # an onset frame is stamped at its window start; the attack sits ~33 ms later (calibrated on a click track, see selfcheck)


def tempo(env, bpm_min, bpm_max):
    n = len(env)
    e = env - env.mean()
    f = np.fft.rfft(e, 2 * n)
    ac = np.fft.irfft(f * np.conj(f))[:n]
    ac /= ac[0] + 1e-12
    lags = np.arange(int(60 * FPS / bpm_max), int(60 * FPS / bpm_min) + 1)
    bpms = 60 * FPS / lags
    prior = np.exp(-0.5 * (np.log2(bpms / 120.0) / 1.0) ** 2)  # one octave around 120 BPM
    score = ac[lags] * prior
    i = int(np.argmax(score))
    lag = float(lags[i])
    if 0 < i < len(lags) - 1:  # parabolic refinement
        a, b, c = score[i - 1], score[i], score[i + 1]
        den = a - 2 * b + c
        if abs(den) > 1e-12:
            lag += 0.5 * (a - c) / den
    return 60 * FPS / lag, lag


def track_beats(env, period, tightness=100.0):
    """Ellis (2007) dynamic programming: beats where onsets are strong AND spacing stays near the period"""
    n = len(env)
    w = np.exp(-0.5 * ((np.arange(-int(period), int(period) + 1)) / (period / 32.0)) ** 2)
    local = np.convolve(env, w, mode="same")
    cum, back = np.zeros(n), -np.ones(n, dtype=int)
    offs = np.arange(-int(round(2 * period)), -int(round(period / 2)) + 1)
    txwt = -tightness * np.log(-offs / period) ** 2
    for i in range(n):
        idx = i + offs
        ok = idx >= 0
        if not ok.any():
            cum[i] = local[i]
            continue
        sc = cum[idx[ok]] + txwt[ok]
        j = int(np.argmax(sc))
        cum[i] = local[i] + sc[j]
        back[i] = idx[ok][j]
    tail = max(0, n - int(round(period)))
    i = tail + int(np.argmax(cum[tail:]))
    beats = []
    while i >= 0:
        beats.append(i)
        i = back[i]
    beats = np.array(beats[::-1])
    # drop weak beats at the edges (silence before the music starts / after it ends)
    strong = local[beats] > 0.1 * np.median(local[beats])
    if strong.any():
        first, last = np.argmax(strong), len(strong) - 1 - np.argmax(strong[::-1])
        beats = beats[first:last + 1]
    return beats


def analyse(path, bpm_min=60, bpm_max=190):
    x = load_audio(path, SR, 1)
    env, _ = onset_strength(x, SR, NFFT, HOP)
    low, _ = onset_strength(x, SR, NFFT, HOP, band=(30, 160))
    bpm, period = tempo(env, bpm_min, bpm_max)
    bf = track_beats(env, period)
    beats = bf / FPS + OFFSET
    # bar phase: the beat that carries the most bass (kick) every 4 beats
    phase = int(np.argmax([low[bf[p::4]].sum() + 0.5 * env[bf[p::4]].sum() for p in range(4)])) if len(bf) >= 8 else 0
    downbeats = beats[phase::4]
    dur = len(x) / SR
    edb, et = rms_db(x, SR, win=1.0, hop=0.5)
    edb_s = np.convolve(np.pad(edb, 1, mode="edge"), np.ones(3) / 3, mode="valid")  # smooth without edge spikes
    twist = None
    if len(edb_s) > 10:
        step = 8  # 4 s rise window at 0.5 s hop
        rise = np.full(len(edb_s), -1e9)
        rise[:-step] = edb_s[step:] - edb_s[:-step]
        lo, hi = 0.25 * dur, 0.70 * dur
        ok = (et >= lo) & (et <= hi)
        if ok.any():
            k = np.where(ok)[0][int(np.argmax(rise[ok]))]
            t_mid = et[k] + 2.0
            twist = float(downbeats[np.argmin(np.abs(downbeats - t_mid))]) if len(downbeats) else float(t_mid)
    return {
        "file": str(path), "duration": round(dur, 3), "bpm": round(float(bpm), 2),
        "beats": [round(float(b), 3) for b in beats if b >= 0],
        "downbeats": [round(float(b), 3) for b in downbeats if b >= 0],
        "energy": {"times": [round(float(t), 2) for t in et], "db": [round(float(v), 1) for v in edb_s]},
        "twist_candidate": None if twist is None else round(twist, 3),
    }, x


def song_map(res, x, out_png=None, width=1600):
    """the song map image (saved when out_png is given); song.py draws sections and lines under it"""
    from PIL import Image, ImageDraw
    Wd, Ht, pad = width, 420, 40
    im = Image.new("RGB", (Wd, Ht), (250, 248, 242))
    d = ImageDraw.Draw(im)
    dur = res["duration"]
    X = lambda t: pad + (Wd - 2 * pad) * t / max(dur, 1e-6)
    cols = Wd - 2 * pad
    seg = max(1, len(x) // cols)
    env = np.abs(x[: seg * cols]).reshape(cols, seg).max(axis=1)
    mid = Ht * 0.45
    for i, v in enumerate(env):
        h = v * Ht * 0.3
        d.line([(pad + i, mid - h), (pad + i, mid + h)], fill=(190, 186, 176))
    t, e = np.array(res["energy"]["times"]), np.array(res["energy"]["db"])
    if len(e) > 1:
        lo, hi = np.percentile(e, 5), e.max()
        pts = [(X(tt), Ht - pad - (Ht * 0.35) * (ee - lo) / max(hi - lo, 1e-6)) for tt, ee in zip(t, e)]
        d.line(pts, fill=(47, 111, 176), width=3)
    for b in res["beats"]:
        d.line([(X(b), Ht - pad + 6), (X(b), Ht - pad + 14)], fill=(150, 150, 150))
    for i, b in enumerate(res["downbeats"]):
        d.line([(X(b), pad), (X(b), Ht - pad + 18)], fill=(120, 120, 120) if i % 4 else (60, 60, 60), width=1)
        if i % 4 == 0:
            d.text((X(b) + 3, pad - 14), str(i + 1), fill=(60, 60, 60))
    if res.get("twist_candidate") is not None:
        tx = X(res["twist_candidate"])
        d.line([(tx, pad - 20), (tx, Ht - 10)], fill=(224, 144, 42), width=4)
        d.text((tx + 6, Ht - 30), f"twist? {res['twist_candidate']:.2f}s", fill=(224, 144, 42))
    d.text((pad, 8), f"{Path(res['file']).name}  {res['bpm']:.1f} BPM  {dur:.1f}s  bars: grey lines, every 4th numbered; blue = energy", fill=(30, 30, 30))
    if out_png:
        im.save(out_png)
    return im


def snap(res, cues_path, grid, all_events, tol, twist):
    cues = _cues.load(cues_path)
    beats, bars = np.array(res["beats"]), np.array(res["downbeats"])
    moved = []
    for e in cues["events"]:
        mode = e.get("snap") or (grid if all_events and e.get("type", "none") != "none" and e["t"] >= 0 else None)
        if twist and e.get("id") == "twist" and res.get("twist_candidate") is not None:
            moved.append((e["id"], e["t"], res["twist_candidate"]))
            e["t"] = res["twist_candidate"]
            continue
        if not mode:
            continue
        g = bars if mode == "bar" else beats
        if not len(g):
            continue
        near = float(g[np.argmin(np.abs(g - e["t"]))])
        if abs(near - e["t"]) <= tol and abs(near - e["t"]) > 1e-4:
            moved.append((e["id"], e["t"], near))
            e["t"] = round(near, 3)
    proj = Path(cues_path).resolve().parent
    rel = os.path.relpath(Path(res["file"]).resolve(), proj).replace("\\", "/")
    cues.setdefault("music", {})["enabled"] = False
    cues["music"]["bpm"] = res["bpm"]
    tracks = cues.setdefault("tracks", [])
    if not any(t.get("file") == rel for t in tracks):
        tracks.append({"file": rel, "gain": 0})
    _cues.save(cues_path, cues)
    for i, a, b in moved:
        print(f"  {i:<12} {a:7.3f}s -> {b:7.3f}s")
    print(f"  cues.js: {len(moved)} event(s) snapped, music off, track {rel} added, bpm {res['bpm']}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("song")
    ap.add_argument("-o", "--out", help="JSON output (default: <song>.beats.json)")
    ap.add_argument("--png", help="song map PNG (default: <song>.beats.png)")
    ap.add_argument("--bpm-min", type=float, default=60)
    ap.add_argument("--bpm-max", type=float, default=190)
    ap.add_argument("--snap", help="cues.js to snap onto the grid")
    ap.add_argument("--grid", choices=["beat", "bar"], default="beat")
    ap.add_argument("--all", action="store_true", help="snap every sound event, not only those with \"snap\"")
    ap.add_argument("--tol", type=float, default=0.15, help="max move in seconds")
    ap.add_argument("--twist", action="store_true", help="move the twist cue to the twist candidate")
    a = ap.parse_args()
    res, x = analyse(a.song, a.bpm_min, a.bpm_max)
    base = os.path.splitext(a.song)[0]
    out = a.out or base + ".beats.json"
    png = a.png or base + ".beats.png"
    Path(out).write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    song_map(res, x, png)
    print(f"{Path(a.song).name}: {res['bpm']:.1f} BPM, {len(res['beats'])} beats, {len(res['downbeats'])} bars, "
          f"twist candidate {res['twist_candidate']}s\n  {out}\n  {png}")
    if a.snap:
        snap(res, a.snap, a.grid, a.all, a.tol, a.twist)


if __name__ == "__main__":
    main()
