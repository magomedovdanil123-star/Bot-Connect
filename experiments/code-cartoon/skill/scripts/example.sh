#!/usr/bin/env bash
# Build one of the bundled example projects.   cartoon example [name] [dir]
#   cartoon example                 list the examples
#   cartoon example lubok-sun-ship ./demo
# An example = examples/<name>/example.json (template, format or size, duration, palette, title, lang,
# "song": "demo" for a clip to the synthesized demo song) + files laid over a fresh project (scene.js, ...).
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"; need_python
EX="$SKILL_DIR/examples"
NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "bundled examples:"
  for d in "$EX"/*/; do
    n=$(basename "$d")
    "$PY" -c "import json,sys; j=json.load(open(sys.argv[1],encoding='utf-8')); print('  %-18s %s' % (sys.argv[2], j.get('about','')))" "$d/example.json" "$n" | tr -d '\r'
  done
  echo "build one:  cartoon example <name> <dir>"; exit 0
fi
DIR="${2:-./$NAME}"
[ -f "$EX/$NAME/example.json" ] || { echo "no such example: $NAME (run: cartoon example)"; exit 1; }
A=()
CR=$(printf '\r')
while IFS= read -r line; do line=${line%"$CR"}; A+=("$line"); done < <("$PY" - "$EX/$NAME/example.json" <<'PYEOF'
import json, sys
j = json.load(open(sys.argv[1], encoding="utf-8"))
a = ["--template", j.get("template", "2d"), "--duration", str(j.get("duration", 10)), "--palette", j.get("palette", "neon"), "--title", j.get("title", "Example")]
a += ["--size", j["size"]] if "size" in j else ["--format", j.get("format", "9:16")]
a += ["--lang", j["lang"]] if "lang" in j else []
a += ["--demo-song"] if j.get("song") == "demo" else []
print("\n".join(a))
PYEOF
)
# a clip example sings the synthesized demo song (scripts/demo_song.py): no third-party audio in the skill
TMP=""
if [ "${A[${#A[@]}-1]}" = "--demo-song" ]; then
  unset 'A[${#A[@]}-1]'
  TMP=$(mktemp -d)
  "$PY" "$SKILL_DIR/scripts/demo_song.py" "$TMP" | tail -1
  A+=(--song "$TMP/song.wav" --lyrics "$TMP/lyrics.txt" --vocals "$TMP/vocals.wav")
fi
bash "$SKILL_DIR/scripts/new_project.sh" "$DIR" "${A[@]}" | tail -12
[ -n "$TMP" ] && rm -rf "$TMP"
cp -R "$EX/$NAME/." "$DIR/"; rm -f "$DIR/example.json"
"$PY" "$SKILL_DIR/scripts/synth_audio.py" "$DIR" | tail -1
echo "ready: cd $DIR && $SKILL_DIR/scripts/cartoon lint && $SKILL_DIR/scripts/cartoon render --output out.mp4"
