#!/usr/bin/env bash
# Delivery check for a rendered MP4: length, fps, size, audio, loudness, first/last frame.
#
#   check_render.sh out.mp4 [--duration 10] [--fps 24] [--size 1080x1920] [--max-mb 100]
#
# Writes out.first.png and out.last.png next to the video so you can LOOK at them
# (first frame = autoplay cover in the feed, last frame = poster).
set -uo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"; need_python
V="${1:?usage: check_render.sh out.mp4 [--duration S] [--fps N] [--size WxH] [--max-mb MB]}"; shift
EXP_DUR=""; EXP_FPS=""; EXP_SIZE=""; MAX_MB=100
while [ $# -gt 0 ]; do case "$1" in --duration) EXP_DUR="$2"; shift 2;; --fps) EXP_FPS="$2"; shift 2;; --size) EXP_SIZE="$2"; shift 2;; --max-mb) MAX_MB="$2"; shift 2;; *) shift;; esac; done
[ -s "$V" ] || { echo "FAIL  file missing or empty: $V"; exit 1; }

fail=0
ok()  { printf '  ok    %s\n' "$1"; }
bad() { printf '  FAIL  %s\n' "$1"; fail=1; }
warn(){ printf '  warn  %s\n' "$1"; }

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")
as=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels -of csv=p=0 "$V")
IFS=, read -r vcodec w h pixfmt fpsr <<<"$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,pix_fmt,r_frame_rate -of csv=p=0 "$V")"
fps=$("$PY" -c "n,d='$fpsr'.split('/'); print(round(int(n)/int(d),3))")
echo "$V"
echo "  video: ${w}x${h} ${vcodec} ${pixfmt} @ ${fps} fps, ${dur}s"
echo "  audio: ${as:-none}"

[ -n "$EXP_DUR" ] && { "$PY" -c "import sys; sys.exit(0 if abs($dur-$EXP_DUR)<=0.1 else 1)" && ok "duration ${dur}s ≈ ${EXP_DUR}s" || bad "duration ${dur}s, expected ${EXP_DUR}s"; }
[ -n "$EXP_FPS" ] && { "$PY" -c "import sys; sys.exit(0 if abs($fps-$EXP_FPS)<0.01 else 1)" && ok "fps $fps" || bad "fps $fps, expected $EXP_FPS"; }
[ -n "$EXP_SIZE" ] && { [ "${w}x${h}" = "$EXP_SIZE" ] && ok "size ${w}x${h}" || bad "size ${w}x${h}, expected $EXP_SIZE"; }
[ "$pixfmt" = "yuv420p" ] && ok "pix_fmt yuv420p (plays everywhere)" || warn "pix_fmt $pixfmt — some phones/socials want yuv420p"

if [ -n "$as" ]; then
  lo=$(ffmpeg -hide_banner -nostats -i "$V" -af ebur128=peak=true -f null - 2>&1)
  I=$(echo "$lo" | grep -E '^\s+I:' | tail -1 | awk '{print $2}')
  P=$(echo "$lo" | grep -E '^\s+Peak:' | tail -1 | awk '{print $2}')
  echo "  loudness: ${I} LUFS integrated, true peak ${P} dBFS"
  "$PY" -c "import sys; sys.exit(0 if -16.5<=$I<=-13.5 else 1)" && ok "loudness in -16..-14 LUFS" || warn "loudness $I LUFS (target -16..-14)"
  "$PY" -c "import sys; sys.exit(0 if $P<=-0.9 else 1)" && ok "true peak <= -1 dBFS" || bad "true peak $P dBFS > -1"
  silent=$(ffmpeg -hide_banner -nostats -i "$V" -af silencedetect=n=-50dB:d=1.5 -f null - 2>&1 | grep -c silence_start)
  [ "$silent" -gt 0 ] && warn "$silent silent stretch(es) > 1.5 s" || ok "no long silences"
else
  warn "no audio stream (fine only if the brief said silent)"
fi

mb=$("$PY" -c "import os,sys; print(round(os.path.getsize(sys.argv[1])/1048576,1))" "$V")
"$PY" -c "import sys; sys.exit(0 if $mb<=$MAX_MB else 1)" && ok "file size ${mb} MB" || warn "file is ${mb} MB — for sharing run: cartoon share $V"

base="${V%.*}"
ffmpeg -hide_banner -loglevel error -y -i "$V" -frames:v 1 "$base.first.png"
ffmpeg -hide_banner -loglevel error -y -sseof -0.08 -i "$V" -frames:v 1 -update 1 "$base.last.png"
echo "  frames: $base.first.png  $base.last.png  (open and look: cover must not be empty, last frame must be a poster)"
# black / blank detection on the first frame
mean=$(ffmpeg -hide_banner -i "$base.first.png" -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1 | grep -oE 'YAVG=[0-9.]+' | head -1 | cut -d= -f2)
echo "  first frame mean luma: ${mean:-?}"
[ $fail -eq 0 ] && echo "RESULT: pass" || echo "RESULT: FAIL"
exit $fail
