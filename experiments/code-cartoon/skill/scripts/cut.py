#!/usr/bin/env python3
"""A cut of a clip: one stretch of the song as its own video (e.g. the chorus for Reels / Shorts).

    python cut.py <project> <name> [--auto | --from chorus1|SECONDS [--to chorus1|SECONDS]] [--len 30]
                  [--bars-before 1] [--format 9:16 | --size WxH]
    (or, inside the clip project: cartoon cut reel --auto --format 9:16)

Builds cuts/<name>/ — a copy of the project with its own frame size, length and cues "window", so the
same scene shows that stretch of the song (song times stay in cues.js; the engine and `cartoon audio`
shift them). The cut is generated: never edit it. Change the clip and run `cartoon cut <name>` again
(the settings are kept in the clip's cues.js "cuts"). Every hyperframes command works inside the cut:
  cd cuts/reel && cartoon snapshot --at 0,5,10 && cartoon render --output reel.mp4

--auto      the first chorus with one bar of lead-in, ending with that chorus when it is between half
            and 1.25 x --len (default 30 s), else at the part end nearest to --len, else on a bar line
--from/--to a part id (from: its start, to: its end) or seconds; snapped to bar lines
"""
import argparse, re, shutil, subprocess, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _cues  # noqa: E402

SIZES = {"9:16": (1080, 1920), "16:9": (1920, 1080), "1:1": (1080, 1080), "4:5": (1080, 1350)}
SKIP = {"cuts", ".hyperframes", "renders", "node_modules", ".git"}


def point(song, v, end=False):
    """a part id -> its start (or end), else seconds"""
    for s in song["sections"]:
        if s["id"] == v:
            return s["end"] if end else s["t"]
    try:
        return float(v)
    except ValueError:
        sys.exit(f"no part '{v}' (parts: {', '.join(s['id'] for s in song['sections'])})")


def window(song, dur, a):
    bars = np.array(song["bars"])
    near_bar = lambda t: float(bars[np.argmin(np.abs(bars - t))])  # noqa: E731
    secs = song["sections"]
    if a.auto or a.from_ is None:
        ch = [s for s in secs if s["label"] == "chorus"]
        start = ch[0] if ch else max(secs, key=lambda s: s.get("nov", 0) if s["t"] > 0 else -1)
        i = int(np.argmin(np.abs(bars - start["t"])))
        t0 = float(bars[max(0, i - a.bars_before)])
        target = t0 + a.len
        ok = [s for s in secs if t0 + 0.5 * a.len <= s["end"] <= t0 + 1.25 * a.len]
        own = [s["end"] for s in ok if s["label"] == start["label"] and s["t"] >= start["t"] - 0.01 and
               all(x["label"] == start["label"] for x in secs if start["t"] - 0.01 <= x["t"] < s["end"] - 0.01)]
        if own:  # end with the chorus itself (or the run of choruses it starts)
            t1 = max(own)
        elif ok:
            t1 = min((s["end"] for s in ok), key=lambda e: abs(e - target))
        else:
            t1 = near_bar(target)
    else:
        t0 = near_bar(point(song, a.from_))
        t1 = near_bar(point(song, a.to, end=True)) if a.to else near_bar(t0 + a.len)
    t1 = min(t1, dur)
    if t1 - t0 < 3:
        sys.exit(f"the cut {t0:.2f}-{t1:.2f}s is too short")
    return round(max(0.0, t0), 3), round(t1, 3)


def set_html(path, w, h, dur):
    txt = path.read_text(encoding="utf-8")

    def root(m):
        tag = m.group(0)
        for k, v in (("data-width", w), ("data-height", h), ("data-duration", f"{dur:g}")):
            tag = re.sub(rf'{k}="[^"]*"', f'{k}="{v}"', tag)
        return tag
    txt = re.sub(r'<[^>]*data-composition-id="main"[^>]*>', root, txt, count=1)
    txt = re.sub(r'<audio[^>]*id="mix"[^>]*>', lambda m: re.sub(r'data-duration="[^"]*"', f'data-duration="{dur:g}"', m.group(0)), txt, count=1)
    txt = re.sub(r'(<canvas[^>]*id="stage"[^>]*?)width="\d+"([^>]*?)height="\d+"', rf'\g<1>width="{w}"\g<2>height="{h}"', txt, count=1)
    txt = re.sub(r'(<meta name="viewport" content=")width=\d+, height=\d+', rf"\g<1>width={w}, height={h}", txt, count=1)
    path.write_text(txt, encoding="utf-8", newline="\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("name", help="the cut's name: cuts/<name>/")
    ap.add_argument("--auto", action="store_true")
    ap.add_argument("--from", dest="from_")
    ap.add_argument("--to")
    ap.add_argument("--len", type=float)
    ap.add_argument("--bars-before", type=int)
    ap.add_argument("--format", choices=sorted(SIZES))
    ap.add_argument("--size", help="WxH")
    a = ap.parse_args()
    project = Path(a.project).resolve()
    cues = _cues.load(project / "cues.js")
    song = cues.get("song")
    if not song or not song.get("sections"):
        sys.exit("no song in cues.js: a cut is made from a clip (cartoon song --song ...)")
    if not re.fullmatch(r"[\w-]+", a.name):
        sys.exit("the name: letters, digits, - and _")
    # settings: given > stored for this name > defaults
    st = (cues.get("cuts") or {}).get(a.name, {})
    if not (a.auto or a.from_):
        if st.get("from") is not None:
            a.from_, a.to = str(st["from"]), str(st["to"])
        else:
            a.auto = True
    a.len = a.len or float(st.get("len", 30))
    a.bars_before = a.bars_before if a.bars_before is not None else int(st.get("bars_before", 1))
    if a.size:
        w, h = (int(v) for v in a.size.lower().split("x"))
    elif a.format:
        w, h = SIZES[a.format]
    elif st.get("size"):
        w, h = (int(v) for v in st["size"].split("x"))
    else:
        html = (project / "index.html").read_text(encoding="utf-8")
        w, h = int(re.search(r'data-width="(\d+)"', html).group(1)), int(re.search(r'data-height="(\d+)"', html).group(1))
    t0, t1 = window(song, float(cues["duration"]), a)
    cues.setdefault("cuts", {})[a.name] = {"from": t0, "to": t1, "size": f"{w}x{h}", "len": a.len, "bars_before": a.bars_before}
    _cues.save(project / "cues.js", cues)

    dest = project / "cuts" / a.name
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    for p in project.iterdir():
        if p.name in SKIP or p.suffix.lower() in (".mp4", ".webm", ".mov", ".gif") or p.name in ("song.map.png", "song.srt"):
            continue
        if p.name == "audio":  # the song stays in the clip; only small per-line files are copied
            (dest / "audio").mkdir()
            if (p / "voice").is_dir():
                shutil.copytree(p / "voice", dest / "audio" / "voice")
            continue
        (shutil.copytree if p.is_dir() else shutil.copy2)(p, dest / p.name)
    c = _cues.load(dest / "cues.js")
    c["duration"] = round(t1 - t0, 3)
    c["window"] = {"from": t0, "to": t1}
    c.pop("cuts", None)
    for tr in c.get("tracks", []):
        tr["file"] = "../../" + tr["file"]
    _cues.save(dest / "cues.js", c)
    set_html(dest / "index.html", w, h, round(t1 - t0, 3))
    (dest / "project.md").write_text(
        f"# cut '{a.name}' of {project.name}\n- song {t0:.2f}-{t1:.2f}s ({t1 - t0:.1f}s), {w}x{h}\n"
        f"- GENERATED by `cartoon cut {a.name}`: do not edit. Change the clip, then run `cartoon cut {a.name}` again.\n",
        encoding="utf-8")
    r = subprocess.run([sys.executable, str(Path(__file__).resolve().parent / "synth_audio.py"), str(dest)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    print((r.stdout.strip().splitlines() or [""])[-1] if r.returncode == 0 else "! cartoon audio failed in the cut: " + r.stderr[-300:])
    parts = [s["id"] for s in song["sections"] if s["end"] > t0 + 0.01 and s["t"] < t1 - 0.01]
    print(f"cuts/{a.name}: song {t0:.2f}-{t1:.2f}s ({t1 - t0:.1f}s, {', '.join(parts)}), {w}x{h}")
    print(f"next: cd cuts/{a.name} && cartoon snapshot --at 0,{(t1 - t0) / 2:.1f},{t1 - t0 - 0.5:.1f} && cartoon render --output {a.name}.mp4")


if __name__ == "__main__":
    main()
