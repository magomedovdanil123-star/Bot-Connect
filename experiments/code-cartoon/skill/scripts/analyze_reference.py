#!/usr/bin/env python3
"""Measure a reference video so style rules come from numbers, not guesses.

    analyze_reference.py ref.mp4 [-o refs/analysis/ref1] [--frames 12]

Writes to the output dir:
  report.md     drawings per second (ones/twos/threes), hold histogram, cuts and
                shot lengths, motion curve (where the "twist" is), palette with
                shares, background colour, audio loudness and hit times
  sheet.jpg     contact sheet of evenly spaced frames
  frames/       the same frames as PNG (LOOK at them: line weight, hatching, paper)

Run it on every reference (3-5 in one manner), then write the style rules from
what repeats across them. Take techniques, not frames. Needs ffmpeg, numpy, scipy, Pillow.
"""
import argparse, json, subprocess, sys, wave
from pathlib import Path

import numpy as np
from scipy import ndimage, signal


def probe(v):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "stream=codec_type,width,height,r_frame_rate,avg_frame_rate:format=duration",
                          "-of", "json", str(v)], capture_output=True, text=True, check=True)
    j = json.loads(out.stdout)
    vs = next(s for s in j["streams"] if s["codec_type"] == "video")
    n, d = vs["avg_frame_rate"].split("/")
    fps = float(n) / float(d) if float(d) else 0
    if not fps:
        n, d = vs["r_frame_rate"].split("/"); fps = float(n) / float(d)
    has_audio = any(s["codec_type"] == "audio" for s in j["streams"])
    return vs["width"], vs["height"], fps, float(j["format"]["duration"]), has_audio


def read_frames(v, w, h, gray=True):
    pix = "gray" if gray else "rgb24"
    ch = 1 if gray else 3
    p = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(v), "-vf", f"scale={w}:{h}",
                        "-f", "rawvideo", "-pix_fmt", pix, "-"], capture_output=True, check=True)
    a = np.frombuffer(p.stdout, np.uint8)
    return a.reshape(-1, h, w) if gray else a.reshape(-1, h, w, ch)


def kmeans(x, k, iters=25, seed=0):
    rng = np.random.default_rng(seed)
    c = x[rng.choice(len(x), k, replace=False)].astype(float)
    for _ in range(iters):
        d = ((x[:, None, :] - c[None]) ** 2).sum(-1)
        lab = d.argmin(1)
        for i in range(k):
            m = x[lab == i]
            if len(m):
                c[i] = m.mean(0)
    return c, np.bincount(lab, minlength=k) / len(x)


def hexc(c):
    return "#" + "".join(f"{int(round(v)):02x}" for v in c)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("-o", "--out", default="")
    ap.add_argument("--frames", type=int, default=12)
    a = ap.parse_args()
    v = Path(a.video)
    out = Path(a.out) if a.out else v.with_suffix("").parent / ("analysis_" + v.stem)
    (out / "frames").mkdir(parents=True, exist_ok=True)

    W, H, fps, dur, has_audio = probe(v)
    sw = 192
    sh = int(round(H * sw / W / 2) * 2)
    g = read_frames(v, sw, sh).astype(np.float32)
    g = ndimage.gaussian_filter(g, sigma=(0, 1, 1))
    diffs = np.abs(np.diff(g, axis=0)).mean(axis=(1, 2))
    lines = [f"# Reference analysis: {v.name}", "",
             f"- source: {W}x{H}, {fps:.3f} fps, {dur:.2f} s, {len(g)} frames, audio: {'yes' if has_audio else 'no'}",
             f"- aspect: {'9:16 vertical' if H > W * 1.5 else '16:9' if W > H * 1.5 else 'square-ish'}"]

    # ---- holds: how many video frames each drawing stays on screen
    noise = np.percentile(diffs, 10) if len(diffs) else 0
    thr = max(0.35, noise * 2.5)
    changed = diffs > thr
    runs, cur = [], 1
    for c in changed:
        if c:
            runs.append(cur); cur = 1
        else:
            cur += 1
    runs.append(cur)
    runs = np.array(runs)
    moving = runs[runs <= 6]  # long runs are static poses, not animation rhythm
    hist = {i: int((moving == i).sum()) for i in range(1, 7)}
    dps = changed.sum() / dur if dur else 0
    mode = max(hist, key=hist.get) if moving.size else 0
    verdict = {1: "on ones (every frame new) — smooth/computer motion",
               2: "on TWOS (each drawing held 2 frames) — classic hand-drawn",
               3: "on threes — choppy, limited/anime-like"}.get(mode, "mostly static / holds")
    lines += ["", "## Drawing rate",
              f"- new drawings per second (avg): **{dps:.1f}** at {fps:.0f} fps video",
              f"- hold length histogram (frames: count, runs <= 6): {hist}",
              f"- verdict: **{verdict}**",
              f"- static holds >= 0.5 s: {int((runs >= fps * 0.5).sum())} (poses / poster moments)",
              f"- change threshold used: {thr:.2f} (noise floor {noise:.2f})"]

    # ---- cuts
    m, s = diffs.mean(), diffs.std()
    cut_idx = np.where((diffs > m + 4 * s) & (diffs > 12))[0]
    cuts = [(i + 1) / fps for i in cut_idx]
    bounds = [0.0] + cuts + [dur]
    shots = np.diff(bounds)
    lines += ["", "## Cuts and shots",
              f"- hard cuts: {len(cuts)} at " + (", ".join(f"{c:.2f}s" for c in cuts) or "none (one continuous scene — transitions by camera/morph?)"),
              f"- shot lengths: " + ", ".join(f"{x:.2f}s" for x in shots)]

    # ---- motion energy curve, 0.5 s bins: where does it peak? (the twist)
    bin_n = max(1, int(fps * 0.5))
    e = [float(diffs[i:i + bin_n].mean()) for i in range(0, len(diffs), bin_n)]
    peak = int(np.argmax(e)) * 0.5 if e else 0
    bars = "".join(" ▁▂▃▄▅▆▇█"[min(8, int(x / (max(e) + 1e-9) * 8))] for x in e)
    lines += ["", "## Motion curve (0.5 s bins)", f"`{bars}`",
              f"- peak motion at ~{peak:.1f}s = {peak / dur * 100:.0f}% of length (twist usually 35-45%)",
              f"- last 3 s motion vs average: {np.mean(e[-6:]) / (np.mean(e) + 1e-9):.2f}x (low = poster ending)"]

    # ---- palette
    cw = 96
    chh = int(round(H * cw / W / 2) * 2)
    rgb = read_frames(v, cw, chh, gray=False)
    step = max(1, int(fps * 0.5))
    px = rgb[::step].reshape(-1, 3).astype(float)
    rng = np.random.default_rng(1)
    px = px[rng.choice(len(px), min(len(px), 40000), replace=False)]
    cents, share = kmeans(px, 7)
    order = np.argsort(-share)
    border = np.concatenate([rgb[::step, 0].reshape(-1, 3), rgb[::step, -1].reshape(-1, 3),
                             rgb[::step, :, 0].reshape(-1, 3), rgb[::step, :, -1].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
    lines += ["", "## Palette", f"- background (border median): **{hexc(bg)}** -> {'dark paper' if lum(bg) < 100 else 'light paper'}",
              "- clusters (share of pixels):"]
    for i in order:
        sat = (max(cents[i]) - min(cents[i])) / (max(cents[i]) + 1e-9)
        lines.append(f"  - {hexc(cents[i])}  {share[i] * 100:5.1f}%  {'accent' if sat > 0.35 and share[i] < 0.2 else ''}")

    # ---- audio
    if has_audio:
        lo = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(v), "-af", "ebur128=peak=true", "-f", "null", "-"],
                            capture_output=True, text=True).stderr
        I = [l.split()[1] for l in lo.splitlines() if l.strip().startswith("I:")]
        P = [l.split()[1] for l in lo.splitlines() if l.strip().startswith("Peak:")]
        wav = out / "audio.wav"
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(v), "-ac", "1", "-ar", "22050", str(wav)], check=True)
        with wave.open(str(wav)) as w:
            x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float) / 32768
        f, t, Z = signal.stft(x, 22050, nperseg=1024, noverlap=768)
        mag = np.abs(Z)
        flux = np.maximum(0, np.diff(mag, axis=1)).sum(0)
        flux = (flux - flux.mean()) / (flux.std() + 1e-9)
        peaks, _ = signal.find_peaks(flux, height=2.0, distance=int(0.12 * 22050 / 256))
        hits = t[1:][peaks]
        lines += ["", "## Audio", f"- integrated loudness: {I[-1] if I else '?'} LUFS, true peak {P[-1] if P else '?'} dBFS",
                  f"- strong hits ({len(hits)}): " + ", ".join(f"{h:.2f}s" for h in hits[:40]),
                  "- compare hit times with cuts / motion peaks above: hits on picture events = sound designed per action"]
        wav.unlink(missing_ok=True)

    # ---- frames + sheet
    times = [min(dur - 0.05, i * dur / (a.frames - 1)) for i in range(a.frames)]
    for i, t in enumerate(times):
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-i", str(v),
                        "-frames:v", "1", str(out / "frames" / f"frame-{i:02d}-at-{t:.2f}s.png")], check=True)
    here = Path(__file__).resolve().parent
    subprocess.run([sys.executable, str(here / "contact_sheet.py"), str(out / "frames"), "-o", str(out / "sheet.jpg"), "--no-safe"],
                   check=True, capture_output=True)
    lines += ["", "## Look at the frames yourself", f"- sheet: {out / 'sheet.jpg'}", f"- frames: {out / 'frames'}",
              "- note by eye: line weight & taper, breaks, boil, hatching vs fill, paper texture, glow, text style, transitions"]
    (out / "report.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
