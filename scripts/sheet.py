# Контактный лист кадров: python3 scripts/sheet.py <папка> <out.jpg> [масштаб] [колонок]
import sys, glob
from PIL import Image
d, out = sys.argv[1], sys.argv[2]; s = float(sys.argv[3]) if len(sys.argv) > 3 else .25; cols = int(sys.argv[4]) if len(sys.argv) > 4 else 7
fs = sorted(glob.glob(d + '/f_*.jpg')); ims = [Image.open(f) for f in fs]; w, h = ims[0].size; W, H = int(w * s), int(h * s)
sheet = Image.new('RGB', (W * cols, H * ((len(ims) + cols - 1) // cols)), 'white')
for i, im in enumerate(ims): sheet.paste(im.resize((W, H)), ((i % cols) * W, (i // cols) * H))
sheet.save(out, quality=85)
