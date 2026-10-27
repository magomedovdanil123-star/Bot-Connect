#!/usr/bin/env python3
"""Prepare the pictures of a photo3d project.

    python prep_photo.py <project> [--photo person.jpg] [--image drawing.jpg] [--face X,Y,R]
                         [--width 1920 --height 1080]
    (or: cartoon photo . --photo person.jpg --face 440,445,150)

  assets/photo.jpg    the photo scaled to COVER the frame (Lanczos + gentle sharpening), so the camera
                      can drift over it without empty edges. A small photo gets soft: use the original.
  assets/drawing.jpg  the picture that becomes a pop-up book (child's drawing, poster, map...),
                      longest side <= 2048. Measure pop-up ellipses in THIS image's pixels.
  assets/face.png     --face X,Y,R: a round crop of the ORIGINAL photo (centre X,Y and radius R in its
                      pixels) — e.g. the hero's real face in a porthole.
  assets/grain.png    a film-grain tile.
Without --photo / --image the template samples are used (a public-domain park photo and a crayon
drawing made with the 2D engine). Needs Pillow.
"""
import argparse, random, re, sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

TEMPLATE = Path(__file__).resolve().parent.parent / "assets" / "template-photo3d" / "assets"


def frame_size(project):
    html = (project / "index.html").read_text(encoding="utf-8") if (project / "index.html").exists() else ""
    m = re.search(r'data-width="(\d+)"\s+data-height="(\d+)"', html)
    return (int(m.group(1)), int(m.group(2))) if m else (1920, 1080)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("--photo")
    ap.add_argument("--image")
    ap.add_argument("--face", help="X,Y,R in the original photo's pixels")
    ap.add_argument("--width", type=int)
    ap.add_argument("--height", type=int)
    a = ap.parse_args()
    project = Path(a.project)
    out = project / "assets"
    out.mkdir(parents=True, exist_ok=True)
    W, H = frame_size(project)
    W, H = a.width or W, a.height or H

    src = Path(a.photo) if a.photo else TEMPLATE / "sample-photo.jpg"
    ph = Image.open(src).convert("RGB")
    s = max(W / ph.width, H / ph.height) * 1.02
    big = ph.resize((round(ph.width * s), round(ph.height * s)), Image.LANCZOS)
    if s > 1.2:
        big = big.filter(ImageFilter.UnsharpMask(radius=2.2, percent=55, threshold=2))
    big.save(out / "photo.jpg", quality=92)
    soft = "  (upscaled x%.2f — a larger original will look sharper)" % s if s > 1.6 else ""
    print(f"assets/photo.jpg    {big.width}x{big.height} from {src.name} {ph.width}x{ph.height}{soft}")

    isrc = Path(a.image) if a.image else TEMPLATE / "sample-drawing.jpg"
    im = Image.open(isrc).convert("RGB")
    k = min(1.0, 2048 / max(im.size))
    if k < 1:
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(out / "drawing.jpg", quality=93)
    print(f"assets/drawing.jpg  {im.width}x{im.height}  <- measure pop-up ellipses in these pixels")

    if a.face:
        x, y, r = [int(float(v)) for v in a.face.split(",")]
        size = 512
        c = ph.crop((x - r, y - r, x + r, y + r)).resize((size, size), Image.LANCZOS)
        m = Image.new("L", (size * 4, size * 4), 0)
        ImageDraw.Draw(m).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
        c.putalpha(m.resize((size, size), Image.LANCZOS))
        c.save(out / "face.png")
        print("assets/face.png     round crop %d,%d r=%d" % (x, y, r))

    rnd = random.Random(7)
    g = Image.new("L", (256, 256))
    g.putdata([max(0, min(255, int(128 + rnd.gauss(0, 38)))) for _ in range(256 * 256)])
    Image.merge("RGBA", (g, g, g, Image.new("L", (256, 256), 255))).save(out / "grain.png")


if __name__ == "__main__":
    sys.exit(main())
