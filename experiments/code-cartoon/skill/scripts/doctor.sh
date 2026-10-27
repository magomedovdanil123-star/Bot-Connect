#!/usr/bin/env bash
# Check the machine for everything code-cartoon needs.   cartoon doctor
set -uo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"
miss=0
ok()   { printf '  ok    %s\n' "$1"; }
bad()  { printf '  MISS  %s\n        -> %s\n' "$1" "$2"; miss=1; }
opt()  { printf '  opt   %s\n        -> %s\n' "$1" "$2"; }

echo "code-cartoon doctor  (skill: $SKILL_DIR)"
if command -v node >/dev/null; then
  v=$(node -v | tr -d v); major=${v%%.*}
  [ "$major" -ge 22 ] && ok "Node.js $v" || bad "Node.js $v (need 22+)" "install Node 22+ from nodejs.org"
else bad "Node.js" "install Node 22+ from nodejs.org"; fi
command -v npx >/dev/null && ok "npx" || bad "npx" "comes with Node.js"
command -v ffmpeg >/dev/null && ok "ffmpeg $(ffmpeg -version 2>/dev/null | head -1 | awk '{print $3}')" || bad "ffmpeg" "macOS: brew install ffmpeg; Ubuntu: apt install ffmpeg; Windows: winget install Gyan.FFmpeg"
command -v ffprobe >/dev/null && ok "ffprobe" || bad "ffprobe" "ships with ffmpeg"
if command -v ffmpeg >/dev/null; then
  ffmpeg -hide_banner -filters 2>/dev/null | grep -q " subtitles " && ok "ffmpeg libass (song clips: lyrics-preview.mp4)"     || opt "ffmpeg without libass (only for the lyrics preview of song clips)" "use a full ffmpeg build (Windows: winget install Gyan.FFmpeg; Ubuntu: apt install ffmpeg)"
fi
if [ -n "$PY" ]; then
  ok "Python $("$PY" -c 'import sys; print(sys.version.split()[0])') ($PY)"
  for m in numpy scipy PIL; do
    "$PY" -c "import $m" 2>/dev/null && ok "python: $m" || bad "python: $m" "$PY -m pip install numpy scipy pillow"
  done
  "$PY" -c "import piper" 2>/dev/null && ok "Piper TTS (voice engine 'piper')" || opt "Piper TTS not installed (only for narration)" "$PY -m pip install piper-tts   (GPL-3.0, separate program) — or use the 'system' engine"
else
  bad "Python 3.9+" "install Python 3 (on Windows the 'python3' Store stub does not count; set PYTHON=/path/to/python.exe)"
fi
case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*) ok "Git Bash on Windows (system voice: Windows SAPI)";;
  Darwin) command -v say >/dev/null && ok "macOS 'say' (system voice)";;
  *) command -v espeak-ng >/dev/null && ok "espeak-ng (system voice)" || opt "espeak-ng not found (system voice on Linux)" "apt install espeak-ng";;
esac
echo "  ..    HyperFrames $HF_VERSION (renderer, downloads a headless Chrome on first use)"
if $HF doctor >/tmp/cc-doctor.$$ 2>&1; then ok "hyperframes doctor"; else
  grep -E "✗|MISS|not found" /tmp/cc-doctor.$$ | head -5 | sed 's/^/        /'
  echo "        (optional items above are fine; for Chrome run: $HF browser ensure)"; fi
rm -f /tmp/cc-doctor.$$
[ $miss -eq 0 ] && echo "RESULT: ready" || echo "RESULT: install the MISS items above"
exit $miss
