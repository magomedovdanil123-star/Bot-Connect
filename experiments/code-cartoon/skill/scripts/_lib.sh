#!/usr/bin/env bash
# Shared helpers for the bash scripts. Source it:  . "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"
#
#   $SKILL_DIR    the skill directory (parent of scripts/)
#   $PY           a real Python 3.9+ (PYTHON env -> python3 -> python -> py), not the Windows Store stub
#   $HF           pinned HyperFrames CLI: "npx --yes hyperframes@<version>" (override with CARTOON_HF_VERSION)

SKILL_DIR="${SKILL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
HF_VERSION="${CARTOON_HF_VERSION:-0.8.164}"
HF="${HF:-npx --yes hyperframes@$HF_VERSION}"

# UTF-8 everywhere (Windows consoles default to a legacy code page and mangle Cyrillic)
export PYTHONIOENCODING=utf-8 PYTHONUTF8=1
# the bash running us (Python subprocesses on Windows would otherwise find WSL's bash first)
export CARTOON_BASH="${CARTOON_BASH:-$BASH}"

find_python() {
  local c
  for c in "${PYTHON:-}" python3 python py; do
    [ -z "$c" ] && continue
    command -v "$c" >/dev/null 2>&1 || continue
    if "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then
      echo "$c"; return 0
    fi
  done
  return 1
}

PY="$(find_python || true)"
need_python() {
  [ -n "$PY" ] && return 0
  echo "Python 3.9+ not found. Install it and run: pip install numpy scipy pillow" >&2
  echo "(on Windows the 'python3' command may be a Microsoft Store stub; set PYTHON=/path/to/python.exe)" >&2
  exit 127
}
