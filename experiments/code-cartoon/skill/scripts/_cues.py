"""Read and write the strict-JSON block of cues.js (between /*JSON-START*/ and /*JSON-END*/).

save() keeps the file readable: one top-level key per line, one event per line, comments
outside the block untouched.
"""
import json
import re
from pathlib import Path

MARK = re.compile(r"/\*JSON-START\*/(.*)/\*JSON-END\*/", re.S)


def load(path):
    txt = Path(path).read_text(encoding="utf-8")
    m = MARK.search(txt)
    if not m:
        raise SystemExit(f"{path}: JSON-START/JSON-END markers not found")
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as e:
        raise SystemExit(f"{path} is not strict JSON between the markers: {e}")


def dumps(cues):
    keys = list(cues.keys())
    lines = ["{"]
    for i, k in enumerate(keys):
        comma = "," if i < len(keys) - 1 else ""
        if k == "events":
            lines.append('  "events": [')
            ev = cues[k]
            for j, e in enumerate(ev):
                lines.append("    " + json.dumps(e, ensure_ascii=False) + ("," if j < len(ev) - 1 else ""))
            lines.append("  ]" + comma)
        else:
            lines.append(f"  {json.dumps(k)}: {json.dumps(cues[k], ensure_ascii=False)}{comma}")
    lines.append("}")
    return "\n".join(lines)


def save(path, cues):
    txt = Path(path).read_text(encoding="utf-8")
    m = MARK.search(txt)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(txt[: m.start(1)] + dumps(cues) + txt[m.end(1):])
