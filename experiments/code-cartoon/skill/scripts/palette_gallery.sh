#!/usr/bin/env bash
# Palette gallery: renders ONE frame of your project in every palette, side by side.
# Shows the client/you how the same video looks recoloured — and proves the scene
# uses roles, not raw colours (if a frame looks broken in some palette, a colour is hardcoded).
#
#   palette_gallery.sh <project_dir> [time=9.5] [palettes="graphite neon mystic ..."]
#   -> <project_dir>/palettes.jpg
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"; need_python
P="$(cd "${1:?usage: palette_gallery.sh <project_dir> [time] [palettes]}" && pwd)"
T="${2:-9.5}"
LIST="${3:-$(grep -oE '^  "[a-z0-9_-]+"' "$P/engine/palettes.js" | tr -d ' "' | tr '\n' ' ')}"
SCENE=$(ls "$P"/scene*.js | head -1)
WORK="$(mktemp -d)"; OUT="$WORK/frames"; mkdir -p "$OUT"
for pal in $LIST; do
  # one copy per palette: on Windows a finished render can keep its folder busy for a while
  D="$WORK/p-$pal"; mkdir -p "$D"
  (cd "$P" && tar --exclude=.hyperframes --exclude='*.mp4' -cf - .) | (cd "$D" && tar -xf -)
  sed -i.bak -E "s/^const PALETTE = \"[^\"]*\"/const PALETTE = \"$pal\"/" "$D/$(basename "$SCENE")"
  (cd "$D" && $HF snapshot --at "$T" >/dev/null 2>&1) || { echo "snapshot failed for $pal"; continue; }
  f=$(ls -t "$D"/.hyperframes/artifacts/snapshots/*/frame-00-*.png 2>/dev/null | head -1)
  [ -n "$f" ] && cp "$f" "$OUT/$pal.png" && echo "  $pal"
done
N=$(ls "$OUT" | wc -l); COLS=$("$PY" -c "import math, sys; print(max(3, math.ceil(math.sqrt(int(sys.argv[1])))))" "$N")   # a square-ish grid
"$PY" "$SKILL_DIR/scripts/contact_sheet.py" "$OUT" --cols "$COLS" --width 300 --no-safe -o "$P/palettes.jpg"
rm -rf "$WORK" 2>/dev/null || true
