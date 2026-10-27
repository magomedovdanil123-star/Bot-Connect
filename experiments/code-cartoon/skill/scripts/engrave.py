#!/usr/bin/env python3
"""A picture -> white engraver's lines on black (transparent PNGs), a few variants for the boil.

  cartoon engrave SRC assets/eng/NAME --height 1400 [--crop x0,y0,x1,y1] [--lo 0.5 --hi 0.95 --gamma 1.2]
                  [--style lines|stipple] [--spacing 3.2] [--variants 3] [--mask poly.json --inset 8]
                  [--local 0.4] [--edges 8] [--bg 30] [--sky] [--invert] [--fade 0.1] [--flip] [--preview]
  cartoon engrave SRC refs/NAME --grid 100      a labelled grid over the source: read crops and mask points off it

The tone is the brightness after a curve: everything darker than --lo (a museum backdrop, deep shadows)
falls to black, so marble reads as lit from one side, as on an old engraving.
  lines    engraver's lines along the rows, their width from the tone, slightly waving (reads best in video)
  stipple  dots on a jittered grid (sparse and noisy at video size; for small accents)
Writes NAME-0.png .. NAME-{N-1}.png (white ink, alpha = the lines); draw them with engine/engraving.js,
which swaps the variants a few times a second (the lines boil). --preview also writes NAME-preview.jpg.
Sources: references/engraving.md (public-domain and CC0 pictures, how to record them).
"""
import argparse, json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def grid(src, out, step):
    im = Image.open(src).convert("RGB")
    W0, H0 = im.size
    sc = min(1.0, 1200 / max(W0, H0))
    im = im.resize((int(W0 * sc), int(H0 * sc)))
    dr = ImageDraw.Draw(im)
    for v in range(0, W0, step):
        x = int(v * sc); dr.line((x, 0, x, im.height), fill=(0, 190, 0)); dr.text((x + 2, 2), str(v), fill=(255, 40, 40))
    for v in range(0, H0, step):
        y = int(v * sc); dr.line((0, y, im.width, y), fill=(0, 190, 0)); dr.text((2, y + 2), str(v), fill=(255, 40, 40))
    im.save(out, quality=88)
    print(f"{out}  ({W0}x{H0}; the labels are source pixels: use them for --crop and the --mask polygon)")


def tone_map(src, a):
    im = Image.open(src).convert("RGB")
    if a.crop:
        im = im.crop(tuple(int(v) for v in a.crop.split(",")))
    w, h = im.size
    H = a.height
    W = int(round(w * H / h))
    im = im.resize((W, H), Image.LANCZOS)
    g = im.convert("L").filter(ImageFilter.UnsharpMask(radius=6, percent=120, threshold=2))
    L = np.asarray(g, np.float32) / 255.0
    if a.invert:                                  # dark ink on paper (a print, a patent drawing) -> light lines
        L = 1 - L
        g = Image.fromarray((L * 255).astype(np.uint8))
    if a.local:                                   # local contrast: a face in shade still reads (blend with the global tone)
        G = np.asarray(g.filter(ImageFilter.GaussianBlur(H / 25)), np.float32) / 255.0
        L = (1 - a.local) * L + a.local * np.clip(0.55 + (L - G) * 2.2, 0, 1)
    T = np.clip((L - a.lo) / (a.hi - a.lo), 0, 1) ** a.gamma
    if a.sky:                                     # a blue sky behind (a temple): nothing there
        rgb = np.asarray(im, np.float32)
        blue = np.clip((rgb[..., 2] - rgb[..., 0] - 18) / 30, 0, 1)
        T *= 1 - np.asarray(Image.fromarray((blue * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), np.float32) / 255.0
    if a.bg:                                      # a plain backdrop (studio photo, paper): what differs from its colour stays
        rgb = np.asarray(im, np.float32)
        border = np.concatenate([rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3), rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3)])
        dist = np.linalg.norm(rgb - np.median(border, 0), axis=-1)
        m = Image.fromarray((np.clip((dist - a.bg) / 25, 0, 1) * 255).astype(np.uint8))
        T *= np.asarray(m.filter(ImageFilter.MedianFilter(7)).filter(ImageFilter.GaussianBlur(2)), np.float32) / 255.0
    if a.fade:                                    # fade out towards the edges of the picture (no hard rectangle)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        e = np.minimum(np.minimum(xx, W - 1 - xx), np.minimum(yy, H - 1 - yy)) / (a.fade * min(W, H))
        T *= np.clip(e, 0, 1) ** 1.5
    if a.edges:                                   # engraver's contours: difference of gaussians on the brightness
        b1 = np.asarray(g.filter(ImageFilter.GaussianBlur(1.2)), np.float32)
        b2 = np.asarray(g.filter(ImageFilter.GaussianBlur(3.0)), np.float32)
        T = np.maximum(T, np.clip((b1 - b2) / 255.0 * a.edges, 0, 1))
    if a.mask:                                    # only inside a polygon traced on the source (--grid)
        poly = json.load(open(a.mask, encoding="utf-8"))
        sx, sy = W / w, H / h
        ox, oy = (int(v) for v in a.crop.split(",")[:2]) if a.crop else (0, 0)
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).polygon([((x - ox) * sx, (y - oy) * sy) for x, y in poly], fill=255)
        if a.inset:                               # pull the edge inwards: no halo of the background
            mm = np.asarray(m.filter(ImageFilter.GaussianBlur(a.inset)), np.float32) / 255.0
            m = Image.fromarray((np.clip((mm - 0.85) / 0.15, 0, 1) * 255).astype(np.uint8))
        m = m.filter(ImageFilter.GaussianBlur(a.feather))
        T *= np.asarray(m, np.float32) / 255.0
    return T


def stipple(T, sp, seed, ss=2):
    H, W = T.shape
    rng = np.random.default_rng(seed)
    gy, gx = np.mgrid[0:H:sp, 0:W:sp].astype(np.float32)
    gx += rng.uniform(0, sp, gx.shape)
    gy += rng.uniform(0, sp, gy.shape)
    t = T[np.clip(gy.astype(int), 0, H - 1), np.clip(gx.astype(int), 0, W - 1)]
    keep = rng.uniform(0, 1, t.shape) < t * 1.05
    out = Image.new("L", (W * ss, H * ss), 0)
    dr = ImageDraw.Draw(out)
    for x, y, v in zip(gx[keep], gy[keep], t[keep]):
        r = (0.45 + 0.75 * v) * sp * 0.42 * ss
        dr.ellipse((x * ss - r, y * ss - r, x * ss + r, y * ss + r), fill=255)
    return out.resize((W, H), Image.LANCZOS)


def lines(T, sp, seed, ss=2):
    H, W = T.shape
    rng = np.random.default_rng(seed)
    out = Image.new("L", (W * ss, H * ss), 0)
    dr = ImageDraw.Draw(out)
    ph, amp, freq = rng.uniform(0, 6.28), sp * 0.18, rng.uniform(0.006, 0.01)
    xs = np.arange(0, W, 2.0)
    for row in np.arange(sp / 2, H, sp):
        y = row + amp * np.sin(xs * freq + ph + row * 0.05)
        t = T[np.clip(y.astype(int), 0, H - 1), xs.astype(int)]
        wdt = t * sp * 0.78
        for i in range(len(xs) - 1):
            if wdt[i] < 0.12:
                continue
            hw = wdt[i] * ss / 2
            dr.rectangle((xs[i] * ss, y[i] * ss - hw, xs[i + 1] * ss, y[i] * ss + hw), fill=255)
    return out.resize((W, H), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("out", help="output prefix, e.g. assets/eng/zeus")
    ap.add_argument("--grid", type=int, default=0, help="only write OUT-grid.jpg: the source with a labelled grid every N px")
    ap.add_argument("--height", type=int, default=1400, help="height of the engraving in frame pixels (draw it at about this size)")
    ap.add_argument("--crop", help="x0,y0,x1,y1 in source pixels")
    ap.add_argument("--mask", help="a JSON polygon [[x, y], ...] in source pixels: only inside it")
    ap.add_argument("--inset", type=float, default=0, help="pull a --mask edge inwards by about this many px (kills the halo)")
    ap.add_argument("--feather", type=float, default=4)
    ap.add_argument("--lo", type=float, default=0.5, help="brightness that becomes black")
    ap.add_argument("--hi", type=float, default=0.95, help="brightness that becomes full white")
    ap.add_argument("--gamma", type=float, default=1.2)
    ap.add_argument("--local", type=float, default=0, help="0..1: blend in local contrast (faces in shade)")
    ap.add_argument("--edges", type=float, default=0, help="strength of light contour lines (e.g. 8)")
    ap.add_argument("--sky", action="store_true", help="drop a blue sky")
    ap.add_argument("--bg", type=float, default=0, help="cut a plain backdrop: colour distance threshold (e.g. 30)")
    ap.add_argument("--invert", action="store_true", help="dark lines on paper (prints, patents) -> light lines")
    ap.add_argument("--fade", type=float, default=0, help="fade to black near the edges (fraction of the short side)")
    ap.add_argument("--flip", action="store_true", help="mirror left-right")
    ap.add_argument("--style", default="lines", choices=["lines", "stipple"])
    ap.add_argument("--spacing", type=float, default=3.2, help="line pitch in px (3 for faces, 3.4 for big plain things)")
    ap.add_argument("--variants", type=int, default=3)
    ap.add_argument("--preview", action="store_true", help="also write OUT-preview.jpg (variant 0 on black)")
    a = ap.parse_args()
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    if a.grid:
        return grid(a.src, a.out + "-grid.jpg", a.grid)
    T = tone_map(a.src, a)
    if a.flip:
        T = T[:, ::-1].copy()
    for v in range(a.variants):
        alpha = (stipple if a.style == "stipple" else lines)(T, a.spacing, 1000 + v)
        Image.merge("RGBA", (Image.new("L", alpha.size, 255),) * 3 + (alpha,)).save(a.out + f"-{v}.png", optimize=True)
        if v == 0 and a.preview:
            Image.merge("RGB", (alpha,) * 3).save(a.out + "-preview.jpg", quality=88)
    print(f"{a.out}-0..{a.variants - 1}.png  {T.shape[1]}x{T.shape[0]}  ink {T.mean():.3f}"
          + ("  (almost empty: lower --lo)" if T.mean() < 0.02 else ""))


if __name__ == "__main__":
    main()
