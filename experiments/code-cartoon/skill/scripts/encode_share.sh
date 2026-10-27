#!/usr/bin/env bash
# Light copies of a render for sharing.
#
#   encode_share.sh out.mp4 [--crf 20] [--gif] [--webp] [--width 480] [--fps 12] [--from 0] [--dur 6]
#
#   -> out.share.mp4   H.264 CRF 20, yuv420p, +faststart (plays everywhere, ~3x smaller)
#   -> out.gif         --gif: palette-optimised GIF preview (README, chats)
#   -> out.webp        --webp: animated WebP preview (smaller than GIF)
set -euo pipefail
V="${1:?usage: encode_share.sh out.mp4 [--crf 20] [--gif] [--webp] [--width 480] [--fps 12] [--from 0] [--dur 6]}"; shift
CRF=20; GIF=0; WEBP=0; WIDTH=480; FPS=12; FROM=0; DUR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --crf) CRF="$2"; shift 2;; --gif) GIF=1; shift;; --webp) WEBP=1; shift;;
    --width) WIDTH="$2"; shift 2;; --fps) FPS="$2"; shift 2;; --from) FROM="$2"; shift 2;; --dur) DUR="$2"; shift 2;;
    *) echo "unknown option $1"; exit 1;;
  esac
done
base="${V%.*}"
size() { du -h "$1" | cut -f1; }
ffmpeg -hide_banner -loglevel error -y -i "$V" -c:v libx264 -crf "$CRF" -preset slow -pix_fmt yuv420p \
  -movflags +faststart -c:a aac -b:a 160k "$base.share.mp4"
echo "  $base.share.mp4  $(size "$base.share.mp4")  (from $(size "$V"))"
CUT=(-ss "$FROM"); [ -n "$DUR" ] && CUT+=(-t "$DUR")
if [ "$GIF" = 1 ]; then
  ffmpeg -hide_banner -loglevel error -y "${CUT[@]}" -i "$V" \
    -vf "fps=$FPS,scale=$WIDTH:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" \
    -loop 0 "$base.gif"
  echo "  $base.gif  $(size "$base.gif")"
fi
if [ "$WEBP" = 1 ]; then
  ffmpeg -hide_banner -loglevel error -y "${CUT[@]}" -i "$V" -vf "fps=$FPS,scale=$WIDTH:-2:flags=lanczos" \
    -c:v libwebp -lossless 0 -q:v 70 -loop 0 -an "$base.webp"
  echo "  $base.webp  $(size "$base.webp")"
fi
