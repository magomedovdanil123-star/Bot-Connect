#!/usr/bin/env python3
"""Hybrid mode: turn a real / AI-generated video into pencil-ready line frames.

The video model (or live footage) gives believable MOTION — heads turning,
laughing, hair. This script traces every drawing (12 per second, on twos)
into line art; the engine then re-draws it in the project's style with boil,
hatching and palette roles (Sketch.roto.draw).

    roto_extract.py clip.mp4 <project_dir> --name hero [--fps 12] [--width 900]
                    [--start 0] [--dur 4] [--detail 1.0] [--shadow 0.3] [--threshold 0.12]

Writes  <project>/refs/roto/<name>/edges_####.png   white lines on transparent
        <project>/refs/roto/<name>/shadow_####.png  soft mask of dark areas (for hatching)
        <project>/refs/roto/<name>/manifest.js      include with <script> before scene.js

Line extraction = XDoG (extended difference of Gaussians), which gives
pencil-like lines rather than edge-detector noise. Tune --detail (sigma scale:
<1 more detail, >1 bolder/simpler) and --threshold (higher = fewer lines).
Only use footage you have the rights to. Needs ffmpeg, numpy, scipy, Pillow.
"""
import argparse, json, subprocess, sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def xdog(gray, sigma=1.2, k=1.6, tau=0.985, eps=-0.004, phi=140):
    g1 = ndimage.gaussian_filter(gray, sigma)
    g2 = ndimage.gaussian_filter(gray, sigma * k)
    d = g1 - tau * g2
    e = np.where(d >= eps, 1.0, 1.0 + np.tanh(phi * (d - eps)))
    return 1.0 - np.clip(e, 0, 1)  # 1 = line


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video"); ap.add_argument("project")
    ap.add_argument("--name", required=True)
    ap.add_argument("--fps", type=float, default=12)
    ap.add_argument("--width", type=int, default=900)
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--dur", type=float, default=0)
    ap.add_argument("--detail", type=float, default=1.0)
    ap.add_argument("--threshold", type=float, default=0.12)
    ap.add_argument("--shadow", type=float, default=0.30, help="darkest fraction of pixels that gets hatching (0 = off)")
    a = ap.parse_args()

    outdir = Path(a.project) / "refs" / "roto" / a.name
    outdir.mkdir(parents=True, exist_ok=True)
    for old in outdir.glob("*.png"):
        old.unlink()
    pr = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                         "-of", "csv=p=0", a.video], capture_output=True, text=True, check=True)
    W0, H0 = map(int, pr.stdout.strip().split(","))
    W = a.width
    H = int(round(H0 * W / W0 / 2) * 2)
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error"]
    if a.start:
        cmd += ["-ss", str(a.start)]
    cmd += ["-i", a.video]
    if a.dur:
        cmd += ["-t", str(a.dur)]
    cmd += ["-vf", f"fps={a.fps},scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32) / 255.0
    if not len(frames):
        sys.exit("no frames decoded")

    man = {"name": a.name, "fps": a.fps, "width": W, "height": H, "base": f"refs/roto/{a.name}/", "frames": []}
    for i, g in enumerate(frames):
        line = xdog(g, sigma=1.2 * a.detail)
        line = np.where(line > a.threshold, line, 0)
        line = ndimage.grey_opening(line, size=(2, 2)) * 0.35 + line * 0.65  # kill single-pixel speckle
        alpha = (np.clip(line * 1.4, 0, 1) * 255).astype(np.uint8)
        rgba = np.dstack([np.full_like(alpha, 255)] * 3 + [alpha])
        en = f"edges_{i:04d}.png"
        Image.fromarray(rgba, "RGBA").save(outdir / en, optimize=True)
        entry = {"edges": en}
        if a.shadow > 0:
            sm = ndimage.gaussian_filter(g, 3)
            cut = np.quantile(sm, a.shadow)
            m = np.clip((cut - sm) / 0.08 + 0.5, 0, 1)
            sa = (m * 255).astype(np.uint8)
            sn = f"shadow_{i:04d}.png"
            Image.fromarray(np.dstack([np.full_like(sa, 255)] * 3 + [sa]), "RGBA").save(outdir / sn, optimize=True)
            entry["shadow"] = sn
        man["frames"].append(entry)

    (outdir / "manifest.js").write_text(
        "window.ROTO = window.ROTO || {};\n"
        f"window.ROTO[{json.dumps(a.name)}] = {json.dumps(man, ensure_ascii=False)};\n", encoding="utf-8")
    print(f"{len(frames)} drawings ({len(frames) / a.fps:.2f}s at {a.fps:g}/s), {W}x{H} -> {outdir}")
    print(f'add to index.html before scene.js:  <script src="refs/roto/{a.name}/manifest.js"></script>')
    print(f'in scene.js (top level):  Sketch.roto.load("{a.name}", window.ROTO["{a.name}"]);')
    print(f'in draw(d):  Sketch.roto.draw(d.ink, "{a.name}", {{ k: d.k, t: d.t - START, x: 90, y: 400 }});')


if __name__ == "__main__":
    main()
