#!/usr/bin/env python3
"""Contact sheet from a video or a folder of PNG snapshots.

    contact_sheet.py out.mp4 [-n 12 | --at 0,1.5,3.8,9.5] [--cols 4] [-o sheet.jpg]
    contact_sheet.py path/to/snapshots/ [-o sheet.jpg]

Each cell is labelled with its time. Use it to check that the story reads
WITHOUT sound, that nothing jumps, that text is big and clear of the bottom 15 %.
The bottom-15 % safe zone (Reels/Shorts UI) is shaded on vertical videos.
Needs ffmpeg/ffprobe and Pillow.
"""
import argparse, subprocess, sys, tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def probe_duration(v):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(v)],
                         capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def grab(v, t, dst):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-i", str(v),
                    "-frames:v", "1", str(dst)], check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("-n", type=int, default=12, help="frames, evenly spaced (video input)")
    ap.add_argument("--at", default="", help="explicit times, comma separated")
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--width", type=int, default=360, help="cell width px")
    ap.add_argument("--no-safe", action="store_true", help="do not shade the bottom 15%% on vertical frames")
    ap.add_argument("-o", "--out", default="")
    a = ap.parse_args()

    src = Path(a.src)
    cells = []  # (label, path)
    tmp = Path(tempfile.mkdtemp(prefix="sheet_"))
    if src.is_dir():
        for p in sorted(src.glob("*.png")):
            cells.append((p.stem.replace("frame-", ""), p))
    else:
        dur = probe_duration(src)
        times = [float(x) for x in a.at.split(",") if x.strip()] if a.at else \
            [min(dur - 0.05, i * dur / (a.n - 1)) for i in range(a.n)]
        for i, t in enumerate(times):
            p = tmp / f"f{i:03d}.png"
            grab(src, t, p)
            cells.append((f"{t:.2f}s", p))
    if not cells:
        sys.exit("no frames")

    ims = [Image.open(p).convert("RGB") for _, p in cells]
    w0, h0 = ims[0].size
    cw = a.width
    ch = int(h0 * cw / w0)
    cols = min(a.cols, len(ims))
    rows = (len(ims) + cols - 1) // cols
    pad, lab = 8, 26
    sheet = Image.new("RGB", (cols * (cw + pad) + pad, rows * (ch + lab + pad) + pad), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 16)
    except OSError:
        font = ImageFont.load_default()
    vertical = h0 > w0
    for i, ((label, _), im) in enumerate(zip(cells, ims)):
        x = pad + (i % cols) * (cw + pad)
        y = pad + (i // cols) * (ch + lab + pad)
        cell = im.resize((cw, ch), Image.LANCZOS)
        if vertical and not a.no_safe:
            ov = Image.new("RGBA", cell.size, (0, 0, 0, 0))
            od = ImageDraw.Draw(ov)
            od.rectangle([0, int(ch * 0.85), cw, ch], fill=(255, 40, 40, 55))
            cell = Image.alpha_composite(cell.convert("RGBA"), ov).convert("RGB")
        sheet.paste(cell, (x, y + lab))
        d.text((x + 2, y + 4), label, fill=(230, 230, 230), font=font)
    out = Path(a.out) if a.out else (src / "contact-sheet.jpg" if src.is_dir() else src.with_suffix(".sheet.jpg"))
    sheet.save(out, quality=90)
    print(out)


if __name__ == "__main__":
    main()
