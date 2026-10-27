#!/usr/bin/env python3
"""Look closer at a render than a contact sheet can: zoomed crops, a twitch detector, jump finder.

  frame_check.py out.mp4 --zoom X,Y,W,H --at 20.9,21.0,21.1 [--scale 2] [-o zoom.jpg]
  frame_check.py out.mp4 --twitch X,Y,W,H --from 20 --to 24 [--k 5]
  frame_check.py out.mp4 --jumps [--cues cues.js] [--k 6] [-o jumps.jpg]
  frame_check.py out.mp4 --around 117.6,124.5 [-o around.jpg]
  (or: cartoon frames ...)

Coordinates are video pixels (x, y of the top-left corner, width, height).
--zoom    crops a region at several times and lays them out big, side by side. Use it for faces,
          eyes, small text — anything a 12-frame sheet shrinks to a few pixels.
--twitch  a region that should hold still (a face, a logo) is compared with its own temporal
          median; frames that differ far more than the usual line boil are listed. Catches a pupil
          that jumps, a sprite that gets clipped, a texture that flickers.
--jumps   whole-frame changes that are much bigger than their neighbours and do NOT sit on a cue
          time (cues.js events, parts of the song and lyric lines, ±0.15 s) — unplanned pops and flashes.
          A cut is ONE changed frame: a second big change right after it (within 0.5 s) is reported as
          settling — a plane that turns sideways, a camera that swings for a few drawings after the cut.
          Mark planned camera cuts as events ({"id": "cut3", "t": 117.6, "type": "none"}) and flashes
          with their length ({"id": "flash2", "t": 86.6, "dur": 0.4, "type": "none"}).
--around  every drawing from 0.25 s before to 0.4 s after each time, one row per time: look at every
          cut this way (the last drawings of a shot and the first of the next).
Needs ffmpeg, numpy, Pillow.
"""
import argparse, functools, json, re, subprocess, sys
from pathlib import Path

import numpy as np


@functools.lru_cache(maxsize=None)
def probe(v):
    p = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                        "-show_entries", "format=duration", "-of", "json", str(v)], capture_output=True, text=True)
    j = json.loads(p.stdout)
    s = j["streams"][0]
    n, d = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), int(n) / int(d), float(j["format"]["duration"])


def gray_frames(v, t0=None, t1=None, crop=None, width=None):
    W, H, fps, dur = probe(v)
    vf = []
    if crop:
        x, y, w, h = crop
        vf.append(f"crop={w}:{h}:{x}:{y}")
        ow, oh = w, h
    else:
        ow, oh = W, H
    if width and ow > width:
        oh = int(round(oh * width / ow / 2) * 2)
        ow = width
        vf.append(f"scale={ow}:{oh}")
    vf.append("format=gray")
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error"]
    if t0 is not None:
        cmd += ["-ss", f"{t0:.3f}"]
    cmd += ["-i", str(v)]
    if t1 is not None:
        cmd += ["-t", f"{max(0.05, t1 - (t0 or 0)):.3f}"]
    cmd += ["-vf", ",".join(vf), "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, oh, ow).astype(np.float32)
    times = (t0 or 0) + np.arange(len(f)) / fps
    return f, times, fps


def frame_at(v, t):
    from PIL import Image
    import io
    W, H, fps, dur = probe(v)
    t = min(max(0.0, t), max(0.0, dur - 1.5 / fps))     # past the end ffmpeg returns no frame at all
    p = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", str(v), "-frames:v", "1",
                        "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
    return Image.open(io.BytesIO(p.stdout)).convert("RGB")


def robust_flags(x, k):
    med = np.median(x)
    mad = np.median(np.abs(x - med)) * 1.4826 + 1e-6
    return (x > med + k * mad) & (x > med * 1.8 + 0.5), med


def cue_times(path):
    """(points, spans): event times (one changed frame each) and part changes (a transition of up to two beats)"""
    if not path:
        return np.array([]), []
    txt = Path(path).read_text(encoding="utf-8")
    m = re.search(r"/\*JSON-START\*/(.*)/\*JSON-END\*/", txt, re.S)
    cues = json.loads(m.group(1))
    ev = cues["events"]
    # an event is one changed frame; an event with a length (a flash, a shake) may change the picture all along it
    ts = [e["t"] for e in ev if e.get("type") != "lyric" and not e.get("dur")]
    long_ = [(e["t"], e["t"] + e["dur"]) for e in ev if e.get("dur") and e.get("type") != "lyric"]
    song = cues.get("song") or {}
    two = 120.0 / float(song.get("bpm") or 120)  # a transition between parts lasts up to two beats
    ts += [e["t"] for e in ev if e.get("type") == "lyric"]  # a lyric line appears
    off = float((cues.get("window") or {}).get("from", 0))  # a cut of a clip: song time -> video time
    spans = [(s["t"] - off - 0.15, s["t"] - off + two + 0.15) for s in song.get("sections", [])]  # a new part changes the picture for a while
    spans += [(t0 - off - 0.15, t1 - off + 0.15) for t0, t1 in long_]
    return np.array(ts) - off, spans


def around(v, times, out):
    """rows of drawings around each time: 3 before, 5 after (on twos a drawing lasts 1/12 s)"""
    from PIL import Image, ImageDraw
    rows = []
    for t0 in times:
        rows.append([(t, frame_at(v, t)) for t in [t0 + k / 12 for k in range(-3, 6)]])
    dur = probe(v)[3]
    tw = 320
    th = int(rows[0][0][1].height * tw / rows[0][0][1].width)
    sheet = Image.new("RGB", (tw * len(rows[0]), (th + 18) * len(rows)), (24, 24, 24))
    dr = ImageDraw.Draw(sheet)
    for r, row in enumerate(rows):
        for c, (t, im) in enumerate(row):
            sheet.paste(im.resize((tw, th)), (c * tw, r * (th + 18) + 18))
            label = f"{t:.3f}s" if 0 <= t < dur else ("start" if t < 0 else "end")   # outside the video: its first/last frame
            dr.text((c * tw + 4, r * (th + 18) + 3), label, fill=(255, 210, 120) if c == 3 else (220, 220, 220))
    sheet.save(out, quality=88)
    print(f"around: {out}  ({len(rows)} rows: 3 drawings before each time, 5 from it) — open it and look at every row")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--zoom", help="X,Y,W,H region to enlarge")
    ap.add_argument("--at", help="comma-separated times for --zoom")
    ap.add_argument("--scale", type=float, default=2.0)
    ap.add_argument("--twitch", help="X,Y,W,H region that should hold still")
    ap.add_argument("--from", dest="t0", type=float, default=None)
    ap.add_argument("--to", dest="t1", type=float, default=None)
    ap.add_argument("--jumps", action="store_true")
    ap.add_argument("--cues", help="cues.js: expected event times are not reported as jumps")
    ap.add_argument("--around", help="comma-separated times: every drawing around each (cuts)")
    ap.add_argument("--k", type=float, default=None, help="sensitivity (lower = more flags)")
    ap.add_argument("-o", "--out")
    a = ap.parse_args()
    v = Path(a.video)
    if not v.exists():
        sys.exit(f"no such file: {v}")
    rc = 0

    if a.zoom:
        from PIL import Image, ImageDraw
        x, y, w, h = [int(float(s)) for s in a.zoom.split(",")]
        ts = [float(s) for s in (a.at or "0").split(",")]
        tiles = [frame_at(v, t).crop((x, y, x + w, y + h)).resize((int(w * a.scale), int(h * a.scale)), Image.LANCZOS) for t in ts]
        cols = min(len(tiles), max(1, int(2400 // tiles[0].width)))
        rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tiles[0].width, rows * (tiles[0].height + 22)), (24, 24, 24))
        dr = ImageDraw.Draw(sheet)
        for i, (t, im) in enumerate(zip(ts, tiles)):
            cx, cy = (i % cols) * im.width, (i // cols) * (im.height + 22)
            sheet.paste(im, (cx, cy + 22))
            dr.text((cx + 6, cy + 4), f"{t:.2f}s  [{x},{y} {w}x{h}]", fill=(230, 230, 230))
        out = a.out or str(v.with_suffix("")) + ".zoom.jpg"
        sheet.save(out, quality=90)
        print(f"zoom grid: {out}  ({len(ts)} crops x{a.scale:g}) — open it and look")

    if a.twitch:
        x, y, w, h = [int(float(s)) for s in a.twitch.split(",")]
        f, ts, fps = gray_frames(v, a.t0, a.t1, crop=(x, y, w, h), width=480)
        if len(f) < 4:
            sys.exit("too few frames in the range")
        med = np.median(f, axis=0)
        dev = np.mean(np.abs(f - med), axis=(1, 2))
        flags, base = robust_flags(dev, a.k or 5.0)
        print(f"twitch check [{x},{y} {w}x{h}] {ts[0]:.2f}-{ts[-1]:.2f}s: {len(f)} frames, usual change {base:.2f}/255")
        hits = ts[flags]
        if len(hits):
            rc = 1
            print(f"  ! {len(hits)} frame(s) change much more than the usual boil:")
            for t, d in zip(hits, dev[flags]):
                print(f"    {t:7.3f}s  {d:.2f}/255")
            print(f"  look: cartoon frames {v.name} --zoom {x},{y},{w},{h} --at " + ",".join(f"{t:.2f}" for t in hits[:8]))
        else:
            print("  ok: nothing jumps beyond the line boil")

    if a.jumps:
        f, ts, fps = gray_frames(v, a.t0, a.t1, width=320)
        d = np.concatenate([[0], np.mean(np.abs(np.diff(f, axis=0)), axis=(1, 2))])
        # the local level of change: the median of the frames that changed (on twos every other frame repeats the
        # drawing, and a median over those zeros would call any camera move in a 3D shot a jump)
        win = max(3, int(fps))
        pad = np.pad(d, win, mode="edge")
        def level(w):
            moving = w[w > 0.4]
            return np.median(moving) if len(moving) >= 3 else np.median(w)
        local = np.array([level(pad[i:i + 2 * win + 1]) for i in range(len(d))])
        k = a.k or 6.0
        flags = (d > local * k) & (d > 3.0)
        ct, spans = cue_times(a.cues)
        in_span = np.array([any(lo <= t <= hi for lo, hi in spans) for t in ts], dtype=bool)
        # an event (a cut, a flash) explains ONE changed frame: the first big change within 0.15 s of it
        expected = in_span.copy()
        used = set()
        for i in np.where(flags & ~in_span)[0]:
            if len(ct):
                j = int(np.argmin(np.abs(ct - ts[i])))
                if abs(ct[j] - ts[i]) <= 0.15 and j not in used:
                    expected[i] = True
                    used.add(j)
        bad = flags & ~expected
        print(f"jump check: {len(f)} frames; {int(flags.sum())} big changes, {int((flags & expected).sum())} on cues, {int(bad.sum())} unexpected")
        for t, dd in zip(ts[bad], d[bad]):
            print(f"  ! {t:7.3f}s  change {dd:.1f}/255 (around it {local[list(ts).index(t)]:.1f}) — not on any cue")
        # several big changes within half a second (outside part transitions) of which at least one no cue explains:
        # a cut that settles, or a swing. Changes that each sit on their own cue (a cut, then a lyric line) are fine.
        idx = [i for i in np.where(flags)[0] if not in_span[i]]
        groups, cur = [], []
        for i in idx:
            if cur and ts[i] - ts[cur[0]] > 0.5:
                groups.append(cur)
                cur = []
            cur.append(i)
        if cur:
            groups.append(cur)
        settle = [g for g in groups if len(g) >= 2 and any(bad[i] for i in g)]
        for g in settle:
            rc = 1
            print(f"  ! {ts[g[0]]:7.3f}s  {len(g)} big changes in {ts[g[-1]] - ts[g[0]]:.2f} s — a cut is one changed frame; this settles or swings "
                  "(a time window across the cut: speed, bank, a lagging camera? a camera that changed its subject?)")
        if bad.any() or settle:
            inside = {i for g in settle for i in g}
            spots = sorted([float(ts[g[0]]) for g in settle] + [float(ts[i]) for i in np.where(bad)[0] if i not in inside])
            print("  look at every drawing:")
            for j in range(0, len(spots), 8):
                print(f"    cartoon frames {v.name} --around " + ",".join(f"{t:.2f}" for t in spots[j:j + 8]))
        if bad.any():
            rc = 1
            if a.out:
                from PIL import Image
                ims = []
                for t in ts[bad][:6]:
                    pair = [frame_at(v, max(0, t - 1 / fps)), frame_at(v, t)]
                    ims.append(pair)
                tw = 480
                th = int(ims[0][0].height * tw / ims[0][0].width)
                sheet = Image.new("RGB", (tw * 2, th * len(ims)), (0, 0, 0))
                for r, (p0, p1) in enumerate(ims):
                    sheet.paste(p0.resize((tw, th)), (0, r * th))
                    sheet.paste(p1.resize((tw, th)), (tw, r * th))
                sheet.save(a.out, quality=88)
                print(f"  before/after pairs: {a.out}")
        elif not settle:
            print("  ok: every big change sits on a cue")

    if a.around:
        around(v, [float(x) for x in a.around.split(",")], a.out if a.out and not (a.zoom or a.jumps) else str(v.with_suffix("")) + ".around.jpg")

    if not (a.zoom or a.twitch or a.jumps or a.around):
        ap.print_help()
    sys.exit(rc)


if __name__ == "__main__":
    main()
