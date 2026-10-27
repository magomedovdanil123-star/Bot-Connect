#!/usr/bin/env python3
"""Prepare a clip to a song: bars, the parts of the song and the time of every lyric line -> cues.js.

    python song.py <project> [--song audio/song.mp3] [--lyrics lyrics.txt] [--vocals vocals.wav]
                   [--lrc song.lrc | --auto] [--parts "intro:0,fight:41.8,..." | --auto-parts]
                   [--no-preview] [--bpm-min 60] [--bpm-max 190]
    (or, inside the project: cartoon song --song song.mp3 --lyrics lyrics.txt)

Sections come from the tags of the lyrics ([Intro], [Verse], [Chorus], ... as Suno/Udio write them),
placed on the bars where the music changes (self-similarity novelty), where the voice sings and how
long each part should be from its lines. Without lyrics the parts are found from the music alone.
Line times, from the most precise source:
  --lrc      an LRC file (enhanced <mm:ss.xx> word times are kept)
  --vocals   the vocal stem (Suno: Get Stems): lines follow where the voice really sings
  otherwise  lines are spread over the bars of their part (rough: watch the preview)
Files outside the project are copied into audio/. Run it again without options to reuse the files
stored in cues.js. To fix the timing edit audio/song.lrc, then: cartoon song --lrc audio/song.lrc
(--auto goes back to the automatic timing).
Your own parts (an instrumental, or when the found parts are wrong): --parts "intro:0,fight:41.8,
storm:1:23.1,outro:138.3" — label:seconds (or m:ss), snapped to bar lines, kept for the next runs
(--auto-parts finds them again). Any labels work; Sketch.songScenes takes them as they are.

Writes
  cues.js             "song" (bpm, bars, beats, energy, sections) + "lyric" events, "twist" on the
                      first chorus, "poster", duration = the song, synthesized music off, the song in tracks
  index.html          data-duration = the song length
  audio/song.lrc      the line times (edit this to fix them)
  song.srt            subtitles (YouTube)
  song.map.png        bars, energy, parts, lines and the voice: look at it
  lyrics-preview.mp4  the song with karaoke lines and a playhead over the map: watch it before rendering
Prints a reading of the music per part (key, loudness, brightness, bass, note density, dynamics, width):
Claude cannot hear the song, so it states what the numbers suggest and asks the rest (SKILL.md, step 0).
Pure numpy/scipy (+ ffmpeg). 4/4 time is assumed.
"""
import argparse, json, re, shutil, subprocess, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _cues, _lyrics, beats  # noqa: E402
from _audio import load_audio, onset_strength  # noqa: E402

SR = beats.SR
VFPS = 50  # voice activity frames per second
LAM, NOV_W, MU_IN, MU_OUT = 0.8, 1.5, 1.5, 0.4  # section placement: length prior, novelty, voice in a part without lines, silence in a part with lines
KIND_COL = {"intro": (150, 150, 150), "verse": (47, 111, 176), "prechorus": (40, 150, 150), "chorus": (224, 144, 42),
            "bridge": (140, 90, 170), "instrumental": (90, 160, 90), "outro": (120, 120, 120), "section": (100, 100, 100)}


# ------------------------------------------------------------------ audio features
def stft_chunks(x, n_fft=4096, hop=1024, chunk=256):
    """(frame centre times, magnitude) in chunks, so a long song stays light on memory"""
    if len(x) < n_fft:
        x = np.pad(x, (0, n_fft - len(x)))
    n = 1 + (len(x) - n_fft) // hop
    win = np.hanning(n_fft)
    for a in range(0, n, chunk):
        b = min(n, a + chunk)
        idx = np.arange(n_fft)[None, :] + hop * np.arange(a, b)[:, None]
        yield (np.arange(a, b) * hop + n_fft / 2) / SR, np.abs(np.fft.rfft(x[idx] * win, axis=1))


def span_features(x, edges):
    """chroma (12), spectral shape (24 log bands) and loudness (dB) averaged over each span [edges[i], edges[i+1])"""
    n_fft = 4096
    f = np.fft.rfftfreq(n_fft, 1 / SR)
    sel = np.where((f >= 80) & (f <= 2500))[0]
    C = np.zeros((len(f), 12))
    C[sel, np.round(12 * np.log2(f[sel] / 440) + 69).astype(int) % 12] = 1
    eb = np.geomspace(60, 10000, 25)
    M = np.stack([((f >= eb[i]) & (f < eb[i + 1])).astype(float) for i in range(24)], axis=1)
    nb = len(edges) - 1
    ac, am, ae, cnt = np.zeros((nb, 12)), np.zeros((nb, 24)), np.zeros(nb), np.zeros(nb)
    for times, mag in stft_chunks(x, n_fft):
        bi = np.searchsorted(edges, times, side="right") - 1
        ok = (bi >= 0) & (bi < nb)
        if not ok.any():
            continue
        m, b = mag[ok], bi[ok]
        p = m ** 2
        np.add.at(ac, b, np.sqrt(m) @ C)
        np.add.at(am, b, np.log10(p @ M + 1e-10))
        np.add.at(ae, b, p.sum(axis=1))
        np.add.at(cnt, b, 1)
    cnt = np.maximum(cnt, 1)
    chroma = ac / cnt[:, None]
    chroma /= np.linalg.norm(chroma, axis=1, keepdims=True) + 1e-9
    shape = am / cnt[:, None]
    shape -= shape.mean(axis=1, keepdims=True)
    return chroma, shape, 10 * np.log10(ae / cnt + 1e-12)


def zs(a):
    a = np.asarray(a, float)
    s = a.std(axis=0)
    return (a - a.mean(axis=0)) / np.where(s > 1e-9, s, 1)


def bar_flux(x, edges):
    """rhythmic activity per bar in three bands (kick, body, hats): drums entering mark a new part"""
    nb, out = len(edges) - 1, []
    for band in ((30, 160), (160, 2000), (4000, 10000)):
        env, t = onset_strength(x, SR, 2048, 512, band=band)
        bi = np.searchsorted(edges, t, side="right") - 1
        ok = (bi >= 0) & (bi < nb)
        s, c = np.zeros(nb), np.zeros(nb)
        np.add.at(s, bi[ok], env[ok])
        np.add.at(c, bi[ok], 1)
        out.append(s / np.maximum(c, 1))
    return np.stack(out, axis=1)


def stack(a, k=4):
    """bar i + the next k-1 bars: a phrase, so a chord sequence counts and not a single chord"""
    P = np.pad(a, ((0, k - 1), (0, 0)), mode="edge")
    return np.hstack([P[i:i + len(a)] for i in range(k)])


def feature_matrix(chroma, shape, loud, flux):
    """texture (spectral shape, loudness, rhythm) decides; harmony counts per 4-bar phrase, at half weight
    (bar-by-bar chroma only shows the chord of each bar, and choruses often reuse the verse chords)"""
    blocks = [(zs(shape), 1.0), (zs(loud[:, None]), 0.7), (zs(flux), 1.0), (zs(stack(chroma)), 0.5)]
    return np.hstack([b * w / np.sqrt(b.shape[1]) for b, w in blocks])


def novelty(F):
    """boundary strength before every bar (0..1): checkerboard kernels of 2 and 4 bars over the self-similarity"""
    N = len(F)
    U = F / (np.linalg.norm(F, axis=1, keepdims=True) + 1e-9)
    S = U @ U.T
    out = np.zeros(N + 1)
    for L in (2, 4):
        if N < 2 * L:
            continue
        a = np.arange(-L, L) + 0.5
        K = np.sign(a)[:, None] * np.sign(a)[None, :] * np.exp(-(a[:, None] ** 2 + a[None, :] ** 2) / (2 * (0.7 * L) ** 2))
        P = np.pad(S, L, mode="edge")
        nov = np.maximum(0, np.array([(K * P[i:i + 2 * L, i:i + 2 * L]).sum() for i in range(N + 1)]))
        out += nov / (nov.max() + 1e-9)
    out[0] = out[-1] = 0
    return out / (out.max() + 1e-9)


def bar_grid(res, x, dur):
    """bar lines covering the song (4/4) + the beat grid. Downbeat phase = bass onsets + chord changes."""
    B = np.array(res["beats"], float)
    if len(B) < 8:
        p = 60.0 / max(res["bpm"], 1)
        B = np.arange(0, dur, p)
    low, _ = onset_strength(x, SR, beats.NFFT, beats.HOP, band=(30, 160))
    fi = np.clip(np.round((B - beats.OFFSET) * beats.FPS).astype(int), 0, len(low) - 1)
    lowb = low[fi]
    ch, _, _ = span_features(x, np.append(B, B[-1] + np.median(np.diff(B))))
    change = np.concatenate([[0], 1 - np.sum(ch[1:] * ch[:-1], axis=1)])
    score = [lowb[p::4].mean() / (lowb.mean() + 1e-9) + change[p::4].mean() / (change.mean() + 1e-9) for p in range(4)]
    D = list(B[int(np.argmax(score))::4])
    L = float(np.median(np.diff(D))) if len(D) > 1 else 4 * 60.0 / res["bpm"]
    while D[0] - L >= -0.25 * L:
        D.insert(0, D[0] - L)
    while D[-1] + L < dur - 0.25 * L:
        D.append(D[-1] + L)
    edges = np.array(D + [D[-1] + L])
    grid = np.concatenate([np.linspace(edges[i], edges[i + 1], 4, endpoint=False) for i in range(len(edges) - 1)] + [edges[-1:]])
    return edges, grid


# ------------------------------------------------------------------ the voice (stem)
def runs(mask):
    m = np.concatenate([[0], np.asarray(mask, np.int8), [0]])
    d = np.diff(m)
    return list(zip(np.where(d == 1)[0], np.where(d == -1)[0]))


def voice_activity(path, dur):
    """True where the vocal stem sings, VFPS frames per second; None if the stem is silent"""
    v = load_audio(path, SR, 1)
    hop = SR // VFPS
    n = int(np.ceil(dur * VFPS))
    v = np.pad(v, (0, max(0, n * hop - len(v))))[: n * hop]
    e = np.convolve((v.reshape(n, hop) ** 2).mean(axis=1), np.ones(2) / 2, mode="same")
    db = 10 * np.log10(e + 1e-12)
    ref = np.percentile(db, 95)
    if ref < -60:
        return None
    act = db > ref - 26
    for a, b in runs(~act):  # breaths inside a phrase
        if a > 0 and b < n and b - a < 0.2 * VFPS:
            act[a:b] = True
    for a, b in runs(act):  # clicks
        if b - a < 0.12 * VFPS:
            act[a:b] = False
    return act


def per_bar(act, edges):
    if act is None:
        return None
    fr = (np.asarray(edges) * VFPS).astype(int)
    return np.array([act[max(0, a):max(0, b)].mean() if b > a and a < len(act) else 0.0 for a, b in zip(fr[:-1], fr[1:])])


# ------------------------------------------------------------------ sections
def expected_bars(secs, nbars):
    """parts without lines: intro/outro ~4 bars, an instrumental ~8 (less in a short song); parts with
    lines share the rest by their syllables"""
    fixed = {"intro": (4, 0.1), "outro": (4, 0.1), "instrumental": (8, 0.15)}
    cap = lambda k: min(fixed.get(k, (4, 0.1))[0], max(1.0, fixed.get(k, (4, 0.1))[1] * nbars))  # noqa: E731
    exp = np.array([0.0 if s["lines"] else cap(s["kind"]) for s in secs])
    lyr = [k for k, s in enumerate(secs) if s["lines"]]
    syl = {k: sum(l["syl"] for l in secs[k]["lines"]) for k in lyr}
    rest = max(nbars - exp.sum(), len(lyr))
    for k in lyr:
        exp[k] = max(1.0, rest * syl[k] / (sum(syl.values()) or 1))
    return exp


def place_sections(secs, nov, vf, nbars):
    """dynamic programming: one bar span per tagged section, in order (novelty + length + voice)"""
    K = len(secs)
    if K > nbars:
        print(f"  ! {K} tagged parts but only {nbars} bars: the last parts are dropped")
        secs, K = secs[:nbars], nbars
    exp = expected_bars(secs, nbars)
    vc = None if vf is None else np.concatenate([[0], np.cumsum(vf)])
    INF = 1e18
    dp = np.full((K + 1, nbars + 1), INF)
    back = np.zeros((K + 1, nbars + 1), int)
    dp[0, 0] = 0
    for k in range(1, K + 1):
        lines = bool(secs[k - 1]["lines"])
        for b in range(k, nbars - (K - k) + 1):
            best, arg = INF, -1
            for a in range(k - 1, b):
                if dp[k - 1, a] >= INF:
                    continue
                L = b - a
                c = dp[k - 1, a] + LAM * np.log(L / exp[k - 1]) ** 2
                if vc is not None:
                    v = vc[b] - vc[a]
                    c += MU_OUT * (L - v) if lines else MU_IN * v
                if c < best:
                    best, arg = c, a
            dp[k, b] = best - (NOV_W * nov[b] if k < K else 0)
            back[k, b] = arg
    bounds, b = [nbars], nbars
    for k in range(K, 0, -1):
        b = back[k, b]
        bounds.append(b)
    bounds = bounds[::-1]
    return [dict(s, a=bounds[k], b=bounds[k + 1]) for k, s in enumerate(secs)]


def phrase_bounds(F, nbars, L=2):
    """part starts on the 4-bar phrase grid: features averaged per phrase (the phase that shows the
    clearest change), a checkerboard of 2 phrases each side; for music that "breathes" every phrase"""
    best = None
    for ph in range(4):
        starts = ([0] if ph else []) + list(range(ph, nbars, 4))
        segs = list(zip(starts, starts[1:] + [nbars]))
        if len(segs) < 2 * L + 1:
            continue
        P = np.stack([F[a:b].mean(axis=0) for a, b in segs])
        U = P / (np.linalg.norm(P, axis=1, keepdims=True) + 1e-9)
        a = np.arange(-L, L) + 0.5
        K = np.sign(a)[:, None] * np.sign(a)[None, :]
        Pp = np.pad(U @ U.T, L, mode="edge")
        nov = np.maximum(0, np.array([(K * Pp[i:i + 2 * L, i:i + 2 * L]).sum() for i in range(len(segs) + 1)]))
        nov[0] = nov[-1] = 0
        if best is None or nov.max() > best[0]:
            best = (nov.max(), segs, nov / (nov.max() + 1e-9))
    if best is None:
        return []
    _, segs, nov = best
    cand = sorted((i for i in range(1, len(segs)) if nov[i] > 0.35 and nov[i] >= nov[i - 1] and nov[i] >= nov[i + 1]), key=lambda i: -nov[i])
    picked = []
    for i in cand:
        if all(abs(i - j) >= 2 for j in picked):
            picked.append(i)
    return [segs[i][0] for i in sorted(picked)]


def sections_from_audio(F, nov, loud, nbars):
    """no lyrics: novelty peaks (on the 4-bar phrase grid when close) -> parts; repeated + loudest = chorus.
    More than 10 parts means the music changes every phrase: then the parts are found per phrase."""
    score = nov * np.where(np.arange(nbars + 1) % 4 == 0, 1.25, 1.0)
    cand = sorted((i for i in range(2, nbars - 1) if nov[i] > 0.25 and nov[i] >= nov[i - 1] and nov[i] >= nov[i + 1]), key=lambda i: -score[i])
    picked = []
    for i in cand:
        if all(abs(i - j) >= 4 for j in picked):
            picked.append(i)
    if len(picked) + 1 > 10:
        picked = phrase_bounds(F, nbars) or picked
    bounds = [0] + sorted(picked) + [nbars]
    means = [F[a:b].mean(axis=0) for a, b in zip(bounds[:-1], bounds[1:])]
    lab = []
    for m in means:
        for j, (c, _) in enumerate(lab):
            if np.dot(m, c) / (np.linalg.norm(m) * np.linalg.norm(c) + 1e-9) > 0.6:
                lab.append((c, j))
                break
        else:
            lab.append((m, len({x for _, x in lab})))
    cl = [x for _, x in lab]
    seg_loud = [loud[a:b].mean() for a, b in zip(bounds[:-1], bounds[1:])]
    rep = [c for c in set(cl) if cl.count(c) > 1]
    chorus = max(rep, key=lambda c: np.mean([seg_loud[i] for i in range(len(cl)) if cl[i] == c])) if rep else None
    out = []
    for i, (a, b) in enumerate(zip(bounds[:-1], bounds[1:])):
        quiet = seg_loud[i] < np.median(seg_loud)
        if cl[i] == chorus:
            kind = "chorus"
        elif i == 0 and b - a <= 8 and quiet and len(bounds) > 2:
            kind = "intro"
        elif i == len(bounds) - 2 and b - a <= 8 and quiet and len(bounds) > 2:
            kind = "outro"
        elif cl.count(cl[i]) > 1:
            kind = "verse"
        else:
            kind = "bridge" if i > 0 else "verse"
        out.append({"kind": kind, "label": "", "lines": [], "a": a, "b": b})
    return out


def sections_from_parts(spec, edges, nbars):
    """--parts "intro:0,fight:41.8,storm:83.1,outro:138.3": your own parts, each from the bar line nearest
    its time (seconds or m:ss) to the next one; any labels (Sketch.songScenes uses them as they are)"""
    out = []
    for item in [p for p in spec.split(",") if p.strip()]:
        if ":" not in item:
            sys.exit(f"--parts: '{item}' is not label:time")
        label, t = item.split(":", 1)
        sec = float(t.split(":")[0]) * 60 + float(t.split(":")[1]) if ":" in t else float(t)
        out.append((re.sub(r"[^a-z_-]", "", label.strip().lower()) or "section", int(np.argmin(np.abs(edges[:-1] - sec)))))
    out.sort(key=lambda p: p[1])
    out[0] = (out[0][0], 0)
    for (l, a), nxt in zip(out, out[1:] + [(None, nbars)]):
        if nxt[1] <= a:
            sys.exit(f"--parts: '{l}' and the next part start on the same bar")
    return [{"kind": l, "label": "", "lines": [], "a": a, "b": nxt[1]} for (l, a), nxt in zip(out, out[1:] + [(None, nbars)])]


def sections_from_lines(secs, edges, nbars):
    """lines already timed (LRC): a part starts on the bar nearest its first line; parts without lines
    start on the bar after the previous line ends"""
    K = len(secs)
    st = [None] * K
    for k, s in enumerate(secs):
        if s["lines"]:
            st[k] = int(np.argmin(np.abs(edges[:-1] - s["lines"][0]["t"])))
    last_end = None
    for k, s in enumerate(secs):
        if st[k] is None:
            st[k] = 0 if k == 0 or last_end is None else int(np.argmin(np.abs(edges[:-1] - last_end)))
        if s["lines"]:
            last_end = s["lines"][-1]["end"]
    st[0] = 0
    for k in range(1, K):
        st[k] = min(max(st[k], st[k - 1] + 1), nbars - (K - k))
    return [dict(s, a=st[k], b=(st[k + 1] if k + 1 < K else nbars)) for k, s in enumerate(secs)]


# ------------------------------------------------------------------ line timing
def spread_words(line, t0, t1, act=None):
    """word start times inside [t0, t1]: by syllables, over the voiced frames if the stem is known"""
    ws = _lyrics.words(re.sub(r"\([^)]*\)", "", line["text"])) or [line["text"]]
    w = np.array(_lyrics.word_weights(" ".join(ws)) or [1.0])
    cum = np.concatenate([[0], np.cumsum(w)])[:-1] / w.sum()
    if act is not None:
        a, b = int(t0 * VFPS), max(int(t0 * VFPS) + 1, int(t1 * VFPS))
        seg = act[a:b].astype(float)
        if seg.sum() >= 2:
            cv = np.cumsum(seg) / seg.sum()
            return [[round(t0 if i == 0 else (a + int(np.searchsorted(cv, c))) / VFPS, 3), x] for i, (c, x) in enumerate(zip(cum, ws))]
    return [[round(t0 + c * (t1 - t0) * 0.9, 3), x] for c, x in zip(cum, ws)]


def snap(t, grid, tol):
    g = grid[np.argmin(np.abs(grid - t))]
    return float(g) if abs(g - t) <= tol else float(t)


def time_grid(sec, edges, grid):
    """no stem, no LRC: lines on the bars of their part (one line per bar or two, else by syllables on beats)"""
    lines, a, b = sec["lines"], sec["a"], sec["b"]
    B, L = b - a, len(lines)
    bar_t = lambda u: float(np.interp(a + u, np.arange(len(edges)), edges))  # noqa: E731
    if L <= B and abs(B / L - round(B / L)) < 1e-9:
        starts = [bar_t(j * B / L) for j in range(L)]
    elif L > B and L % B == 0:
        starts = [bar_t(j * B / L) for j in range(L)]
    else:
        w = np.array([l["syl"] for l in lines], float)
        starts = [snap(bar_t(B * c), grid, 1.0) for c in np.concatenate([[0], np.cumsum(w)])[:-1] / w.sum()]
    beat = (edges[b] - edges[a]) / (4 * B)
    for j, l in enumerate(lines):
        end = (starts[j + 1] - 0.15 * beat) if j + 1 < L else edges[b] - 0.25 * beat
        l["t"], l["end"] = round(starts[j], 3), round(max(end, starts[j] + 0.4), 3)
        l["words"] = spread_words(l, l["t"], l["end"])


def time_voice(sec, edges, grid, act):
    """vocal stem: line j starts where the sung time reaches its share of the syllables, moved to a
    nearby onset after a pause (distance counted in sung time, so the pause itself is free; bigger
    pauses win); a line ends where the voice stops before the next one"""
    lines = sec["lines"]
    S, E = edges[sec["a"]], edges[sec["b"]]
    f0, f1 = max(0, int((S - 0.35) * VFPS)), min(len(act), int(E * VFPS))
    seg = act[f0:f1].copy()
    if f0 > 0 and act[f0 - 1] and len(seg) and seg[0]:  # the tail of the previous part's last line
        seg[: runs(seg)[0][1]] = False
    cv = np.cumsum(seg)
    if len(cv) == 0 or cv[-1] < 0.3 * VFPS * len(lines):
        return False
    T = cv[-1]
    sung = np.concatenate([[0], cv])  # sung frames before frame f
    w = np.array([l["syl"] for l in lines], float)
    share = np.concatenate([[0], np.cumsum(w)])[:-1] / w.sum()
    rr = runs(seg)
    onsets = [(s, (s - rr[i - 1][1]) / VFPS if i else 1.0) for i, (s, _) in enumerate(rr)]
    syl_f = T / w.sum()  # sung frames per syllable
    starts = []
    for j, c in enumerate(share):
        raw = int(np.searchsorted(cv, c * T + 0.5))
        near = [(abs(sung[o] - c * T) / syl_f - 2.0 * min(g, 1.0), o) for o, g in onsets
                if abs(sung[o] - c * T) <= 2.5 * syl_f and (not starts or o > starts[-1])]
        f = min(near)[1] if near else raw
        if starts and f <= starts[-1] + 0.4 * VFPS:
            f = max(raw, starts[-1] + int(0.4 * VFPS))
        starts.append(min(f, len(seg) - 1))
    for j, l in enumerate(lines):
        nxt = starts[j + 1] if j + 1 < len(lines) else len(seg)
        voiced = np.where(seg[starts[j]:nxt])[0]
        end_f = starts[j] + (voiced[-1] + 1 if len(voiced) else int(0.5 * VFPS))
        t0 = snap((f0 + starts[j]) / VFPS, half_grid(grid), 0.08)
        l["t"], l["end"] = round(t0, 3), round(max((f0 + end_f) / VFPS, t0 + 0.3), 3)
        l["words"] = spread_words(l, l["t"], l["end"], act)
    return True


def half_grid(grid):
    return np.sort(np.concatenate([grid, (grid[1:] + grid[:-1]) / 2]))


def time_lrc(lines, lrc, act):
    """LRC times onto the lyric lines (matched by text); unmatched lines are interpolated by syllables"""
    idx = _lyrics.match(lines, lrc)
    for l, i in zip(lines, idx):
        if i is not None:
            l["t"] = lrc[i]["t"]
            l["words_lrc"] = lrc[i]["words"]
    known = [j for j, l in enumerate(lines) if "t" in l]
    if not known:
        return False
    for j, l in enumerate(lines):
        if "t" in l:
            continue
        p = max([k for k in known if k < j], default=None)
        n = min([k for k in known if k > j], default=None)
        if p is None:
            l["t"] = lines[n]["t"] - 0.35 * sum(x["syl"] for x in lines[j:n])
        elif n is None:
            l["t"] = lines[p]["t"] + 0.35 * sum(x["syl"] for x in lines[p:j])
        else:
            w = np.array([x["syl"] for x in lines[p:n]], float)
            l["t"] = lines[p]["t"] + (lines[n]["t"] - lines[p]["t"]) * w[: j - p].sum() / w.sum()
    for j, l in enumerate(lines):
        nxt = lines[j + 1]["t"] if j + 1 < len(lines) else l["t"] + 6
        end = min(nxt - 0.1, l["t"] + 0.32 * l["syl"] + 0.6)
        if act is not None:
            a, b = int(l["t"] * VFPS), int(nxt * VFPS)
            v = np.where(act[a:b])[0]
            if len(v):
                end = min(nxt - 0.05, (a + v[-1] + 1) / VFPS)
        l["t"], l["end"] = round(l["t"], 3), round(max(end, l["t"] + 0.3), 3)
        wl = l.pop("words_lrc", None)
        l["words"] = wl if wl else spread_words(l, l["t"], l["end"], act)
    return True


# ------------------------------------------------------------------ outputs
def adopt(project, p):
    """a file outside the project is copied into audio/; returns the project-relative posix path"""
    if not p:
        return None
    src = Path(p)
    src = (src if src.is_absolute() else Path.cwd() / src).resolve()
    if not src.exists():
        sys.exit(f"not found: {p}")
    try:
        return src.relative_to(project).as_posix()
    except ValueError:
        dst = project / "audio" / src.name
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        print(f"  copied {src.name} -> audio/")
        return dst.relative_to(project).as_posix()


def set_html_duration(path, dur):
    if not path.exists():
        return
    txt = path.read_text(encoding="utf-8")
    fix = lambda m: re.sub(r'data-duration="[^"]*"', f'data-duration="{dur:g}"', m.group(0))  # noqa: E731
    txt = re.sub(r'<[^>]*data-composition-id="main"[^>]*>', fix, txt, count=1)
    txt = re.sub(r'<audio[^>]*id="mix"[^>]*>', fix, txt, count=1)
    path.write_text(txt, encoding="utf-8", newline="\n")


def update_cues(path, info, lines, dur, twist, poster):
    cues = _cues.load(path)
    cues["duration"] = round(dur, 2)
    mus = cues.setdefault("music", {})
    mus["enabled"], mus["bpm"] = False, info["bpm"]
    cues["tracks"] = [{"file": info["file"], "gain": 0, "song": True}] + [t for t in cues.get("tracks", []) if not t.get("song")]
    cues["song"] = info
    old = cues["events"]
    keep = [e for e in old if e.get("type") != "lyric" and e.get("gen") != "song"]
    ids = {e["id"] for e in keep}
    gen = []
    for cid, t in (("twist", twist), ("poster", poster)):
        if cid in ids:
            mine = next(e for e in keep if e["id"] == cid)
            print(f"  ! your own '{cid}' cue stays at {mine['t']}s (the song suggests {t:.2f}s; add \"gen\": \"song\" to let it move)")
        else:
            gen.append({"id": cid, "t": round(t, 3), "type": "none", "gen": "song"})
    for i, l in enumerate(lines, 1):
        e = {"id": f"l{i}", "t": l["t"], "dur": round(l["end"] - l["t"], 3), "type": "lyric", "section": l["section"], "text": l["text"]}
        if l.get("backing"):
            e["backing"] = l["backing"]
        e["words"] = l["words"]
        gen.append(e)
    cues["events"] = keep + sorted(gen, key=lambda e: e["t"])
    _cues.save(path, cues)


def draw_map(res, x, info, lines, act, dur, out):
    from PIL import Image, ImageDraw
    W = int(min(4000, max(1600, 12 * dur)))
    top = beats.song_map(res, x, None, width=W)
    im = Image.new("RGB", (W, 560), (250, 248, 242))
    im.paste(top, (0, 0))
    d = ImageDraw.Draw(im)
    pad = 40
    X = lambda t: pad + (W - 2 * pad) * t / max(dur, 1e-6)  # noqa: E731
    for s in info["sections"]:
        c = KIND_COL.get(s["label"], (100, 100, 100))
        d.rectangle([X(s["t"]), 428, X(s["end"]) - 1, 462], fill=c)
        d.text((X(s["t"]) + 4, 440), s["id"], fill=(255, 255, 255))
    for i, l in enumerate(lines):
        c = (60, 60, 60) if i % 2 else (130, 130, 130)
        d.rectangle([X(l["t"]), 472, max(X(l["t"]) + 2, X(l["end"])), 488], fill=c)
        d.text((X(l["t"]) + 2, 492), str(i + 1), fill=(40, 40, 40))
    if act is not None:
        for a, b in runs(act):
            d.rectangle([X(a / VFPS), 510, max(X(a / VFPS) + 1, X(b / VFPS)), 518], fill=(176, 60, 60))
    d.text((pad, 530), "parts (coloured, ids) | lyric lines (numbered) | red = the vocal stem sings", fill=(60, 60, 60))
    im.save(out)
    return W


def ass_time(t):
    cs = int(round(max(0.0, t) * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def preview(project, info, lines, dur, map_w):
    """lyrics-preview.mp4: the map, a playhead and karaoke lines (ASS via libass) over the song"""
    ass = project / "audio" / "lyrics-preview.ass"
    head = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 1280", "PlayResY: 720", "WrapStyle: 0", "",
            "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
            "Style: Lyric,Arial,52,&H002A90E0,&H00F0F0F0,&H00141414,&H00000000,-1,0,0,0,100,100,0,0,1,3,0,2,40,40,120,1",
            "Style: Next,Arial,34,&H00A0A0A0,&H00A0A0A0,&H00141414,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,40,40,60,1",
            "Style: Part,Arial,30,&H002A90E0,&H002A90E0,&H00141414,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,7,40,40,462,1",
            "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    ev = []
    for s in info["sections"]:
        ev.append(f"Dialogue: 0,{ass_time(s['t'])},{ass_time(s['end'])},Part,,0,0,0,,{s['id']}  {s['t']:.2f}s")
    for i, l in enumerate(lines):
        ws = l["words"]
        parts = []
        if ws and ws[0][0] > l["t"]:
            parts.append(f"{{\\k{int(round((ws[0][0] - l['t']) * 100))}}}")
        for j, (t, w) in enumerate(ws):
            t1 = ws[j + 1][0] if j + 1 < len(ws) else l["end"]
            parts.append(f"{{\\kf{max(1, int(round((t1 - t) * 100)))}}}{w} ")
        nxt = lines[i + 1]["t"] if i + 1 < len(lines) else l["end"] + 1.5
        hold = max(l["end"] + 0.3, min(nxt, l["end"] + 1.5))
        ev.append(f"Dialogue: 1,{ass_time(l['t'])},{ass_time(hold)},Lyric,,0,0,0,,{''.join(parts).strip()}")
        if i + 1 < len(lines):
            ev.append(f"Dialogue: 1,{ass_time(l['t'])},{ass_time(hold)},Next,,0,0,0,,{lines[i + 1]['text']}")
    ass.write_text("\n".join(head + ev) + "\n", encoding="utf-8")
    h = int(round(560 * 1280 / map_w / 2)) * 2
    k = (map_w - 80) * 1280 / map_w / dur
    x0 = 40 * 1280 / map_w
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-loop", "1", "-framerate", "12", "-i", "song.map.png",
           "-f", "lavfi", "-i", f"color=c=0xe0902a:s=3x{h}:r=12", "-i", info["file"],
           "-filter_complex", f"[0:v]scale=1280:{h},pad=1280:720:0:0:color=0x141414[bg];[bg][1:v]overlay=x='{x0:.2f}+t*{k:.5f}':y=0[v1];[v1]subtitles=audio/lyrics-preview.ass[v]",
           "-map", "[v]", "-map", "2:a", "-t", f"{dur:.2f}", "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage",
           "-crf", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "lyrics-preview.mp4"]
    p = subprocess.run(cmd, cwd=project, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode != 0:
        print(f"  ! lyrics-preview.mp4 not made (ffmpeg needs libass for subtitles): {p.stderr.strip()[-300:]}")
        print("    play audio/song.lrc or song.srt with the song in any player instead")
        return False
    return True


# ------------------------------------------------------------------ main
def analyse(project, song, lyrics=None, vocals=None, lrc=None, bpm_min=60, bpm_max=190, parts=None):
    """-> (info, lines, act, res, x, dur, notes); every path is relative to project"""
    res, x = beats.analyse(project / song, bpm_min, bpm_max)
    dur = res["duration"]
    edges, grid = bar_grid(res, x, dur)
    nbars = len(edges) - 1
    chroma, shape, loud = span_features(x, edges)
    F = feature_matrix(chroma, shape, loud, bar_flux(x, edges))
    nov = novelty(F)
    act = voice_activity(project / vocals, dur) if vocals else None
    notes = []
    if vocals and act is None:
        notes.append("the vocal stem is silent -- ignored")
    vf = per_bar(act, edges)
    secs = _lyrics.parse((project / lyrics).read_text(encoding="utf-8-sig")) if lyrics else None
    lrc_lines = _lyrics.read_lrc(project / lrc) if lrc else None
    if secs is not None and not secs:
        secs = None
    if lrc_lines and secs is None:  # an LRC alone: its lines are the lyrics
        secs = [{"kind": "verse", "label": "", "lines": [{"text": l["text"], "syl": max(1, _lyrics.syllables(l["text"]))} for l in lrc_lines]}]
        flat = secs[0]["lines"]
        time_lrc(flat, lrc_lines, act)
        placed = sections_from_audio(F, nov, loud, nbars)
        for s in placed:
            s["lines"] = [l for l in flat if edges[s["a"]] - 0.5 <= l["t"] < edges[s["b"]] - 0.5]
        mode = "lrc"
    elif secs:
        flat = [l for s in secs for l in s["lines"]]
        if lrc_lines and time_lrc(flat, lrc_lines, act):
            placed, mode = sections_from_lines(secs, edges, nbars), "lrc"
        else:
            placed = place_sections(secs, nov, vf, nbars)
            mode = "stem" if act is not None else "grid"
            for s in placed:
                if not s["lines"]:
                    continue
                if mode == "grid" or not time_voice(s, edges, grid, act):
                    if mode == "stem":
                        notes.append(f"no voice found in a {s['kind']} -- its lines are spread on bars")
                    time_grid(s, edges, grid)
    else:
        placed, mode = sections_from_audio(F, nov, loud, nbars), "none"
    if parts:  # your own parts win; timed lines go to the part they fall in
        flat = sorted((l for s in placed for l in s["lines"] if "t" in l), key=lambda l: l["t"])
        placed = sections_from_parts(parts, edges, nbars)
        for s in placed:
            s["lines"] = [l for l in flat if edges[s["a"]] - 0.5 <= l["t"] < edges[s["b"]] - 0.5]
    # ids, occurrence numbers, times
    count, out_secs, lines = {}, [], []
    for k, s in enumerate(placed):
        n = count.get(s["kind"], 0)
        count[s["kind"]] = n + 1
        sid = f"{s['kind']}{n + 1}"
        t0 = 0.0 if k == 0 else float(edges[s["a"]])
        t1 = float(dur) if k == len(placed) - 1 else float(edges[s["b"]])
        sec = {"id": sid, "label": s["kind"], "n": n, "t": round(t0, 3), "end": round(t1, 3), "bar": int(s["a"]), "bars": int(s["b"] - s["a"])}
        if s.get("label"):
            sec["tag"] = s["label"]
        sec["nov"] = round(float(nov[s["a"]]), 2) if k else 1.0
        if vf is not None:
            sec["voice"] = round(float(vf[s["a"]:s["b"]].mean()), 2)
        out_secs.append(sec)
        for l in s["lines"]:
            lines.append(dict(l, section=sid))
    lines.sort(key=lambda l: l["t"])
    for a, b in zip(lines, lines[1:]):  # no overlaps
        if a["end"] > b["t"] - 0.02:
            a["end"] = round(max(a["t"] + 0.2, b["t"] - 0.02), 3)
    e = np.array(res["energy"]["db"], float)
    lo, hi = (np.percentile(e, 5), e.max()) if len(e) else (0, 1)
    info = {"file": song, "lyrics": lyrics, "vocals": vocals, "lrc": lrc, "parts": parts, "timing": mode, "bpm": res["bpm"],
            "bars": [round(float(t), 3) for t in edges], "beats": [round(float(t), 3) for t in grid],
            "energy": {"t0": res["energy"]["times"][0] if len(e) else 0, "hop": 0.5,
                       "v": [round(float(v), 2) for v in np.clip((e - lo) / max(hi - lo, 1e-6), 0, 1)]},
            "sections": out_secs}
    info = {k: v for k, v in info.items() if v is not None}
    return info, lines, act, res, x, dur, notes


# ------------------------------------------------------------------ reading the music
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
KS_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KS_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def key_of(chroma):
    """Krumhansl key profile: (name, correlation)"""
    best = max(((np.corrcoef(chroma, np.roll(prof, r))[0, 1], f"{NOTE_NAMES[r]} {mode}") for r in range(12)
                for mode, prof in (("major", KS_MAJ), ("minor", KS_MIN))), key=lambda c: c[0])
    return best[1], best[0]


def music_reading(project, song, info, x):
    """What the numbers say about every part: key, loudness, brightness, bass, note density, dynamics, width.
    Claude cannot hear the song: this is the base for a short reading to check with the user (SKILL.md, step 0)."""
    edges = np.array(info["bars"])
    chroma, _, _ = span_features(x, edges)
    st = load_audio(project / song, SR, 2)
    env, et = onset_strength(x, SR, 2048, 512)
    cent, lowf, ct = [], [], []
    f = np.fft.rfftfreq(4096, 1 / SR)
    for times, mag in stft_chunks(x):
        cent += list((mag * f).sum(axis=1) / (mag.sum(axis=1) + 1e-9))
        lowf += list(mag[:, f < 150].sum(axis=1) / (mag.sum(axis=1) + 1e-9))
        ct += list(times)
    cent, lowf, ct = np.array(cent), np.array(lowf), np.array(ct)
    rows = []
    for sec in info["sections"]:
        a, b = sec["t"], sec["end"]
        i0, i1 = int(a * SR), int(b * SR)
        seg, sseg = x[i0:i1], st[i0:i1]
        if len(seg) < SR:
            continue
        rms = np.sqrt(np.mean(seg ** 2)) + 1e-9
        m = (ct >= a) & (ct < b)
        on = env[(et >= a) & (et < b)]
        bars = (edges[:-1] >= a - 0.01) & (edges[:-1] < b - 0.01)
        key, conf = key_of(chroma[bars].mean(axis=0)) if bars.any() else ("?", 0)
        mid, side = sseg[:, 0] + sseg[:, 1], sseg[:, 0] - sseg[:, 1]
        rows.append({"id": sec["id"], "t": a, "key": key, "conf": conf, "db": 20 * np.log10(rms), "bright": float(np.median(cent[m])) if m.any() else 0,
                     "bass": float(np.mean(lowf[m]) * 100) if m.any() else 0, "notes": float((np.diff((on > 0.25).astype(int)) == 1).sum() / (b - a)),
                     "crest": float(20 * np.log10(np.max(np.abs(seg)) / rms)), "width": float(np.std(side) / (np.std(mid) + 1e-9))})
    if not rows:
        return
    avg = {k: np.median([r[k] for r in rows]) for k in ("db", "bright", "bass", "notes")}   # a quiet intro must not make every part "louder"
    whole, _ = key_of(chroma.mean(axis=0))
    print(f"  reading the music (numbers, not hearing): the whole song {whole}")
    print("  part           key        loud   bright   bass  notes/s  dyn   width  -> relative to the song")
    for r in rows:
        words = []
        words.append("louder" if r["db"] > avg["db"] + 1.0 else "quieter" if r["db"] < avg["db"] - 1.0 else "")
        words.append("brighter" if r["bright"] > avg["bright"] * 1.12 else "darker" if r["bright"] < avg["bright"] * 0.88 else "")
        words.append("heavier bass" if r["bass"] > avg["bass"] * 1.15 else "")
        words.append("busier" if r["notes"] > avg["notes"] * 1.25 else "sparser" if r["notes"] < avg["notes"] * 0.75 else "")
        print(f"  {r['id']:<13} {r['key']:<9} {r['db']:5.1f}dB {r['bright']:6.0f}Hz {r['bass']:5.1f}% {r['notes']:6.1f} {r['crest']:5.1f}dB {r['width']:5.2f}   {', '.join(w for w in words if w) or '-'}")
    print("  -> say what this suggests (minor to the end = not a triumph; a darker, heavier part = weight, not relief),")
    print("     then ask what numbers cannot tell: genre and lead instrument, the story it tells, how it should end")


def suggest(info, lines, dur):
    secs = info["sections"]
    ch = [s for s in secs if s["label"] == "chorus"]
    if ch:
        twist = ch[0]["t"]
    else:
        e = info["energy"]["v"]
        rises = [(np.mean(e[int(s["t"] / 0.5):int(s["end"] / 0.5) + 1] or [0]) - np.mean(e[max(0, int(p["t"] / 0.5)):int(p["end"] / 0.5) + 1] or [0]), s["t"])
                 for p, s in zip(secs, secs[1:]) if 0.2 * dur <= s["t"] <= 0.75 * dur]
        twist = max(rises)[1] if rises else round(0.4 * dur, 3)
    out = [s for s in secs if s["label"] == "outro"]
    last_line = max((l["end"] for l in lines), default=0)
    poster = out[-1]["t"] if out and dur - out[-1]["t"] <= 15 else max(dur - 4, last_line + 0.5)
    return twist, min(poster, dur - 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("--song")
    ap.add_argument("--lyrics", help="the lyrics with [Verse]/[Chorus] tags (Suno/Udio text)")
    ap.add_argument("--vocals", help="the vocal stem: precise line timing")
    ap.add_argument("--lrc", help="line times from an LRC file")
    ap.add_argument("--auto", action="store_true", help="ignore the stored LRC: time the lines automatically again")
    ap.add_argument("--parts", help='your own parts: "intro:0,fight:41.8,storm:1:23.1,outro:138.3" (label:seconds or m:ss)')
    ap.add_argument("--auto-parts", action="store_true", help="forget the stored --parts: find the parts again")
    ap.add_argument("--no-preview", action="store_true")
    ap.add_argument("--no-reading", action="store_true", help="skip the per-part reading of the music")
    ap.add_argument("--bpm-min", type=float, default=60)
    ap.add_argument("--bpm-max", type=float, default=190)
    a = ap.parse_args()
    project = Path(a.project).resolve()
    cues_path = project / "cues.js"
    if not cues_path.exists():
        sys.exit("no cues.js here: run it inside a project (cartoon new my-clip --template clip --song ...)")
    prev = _cues.load(cues_path).get("song", {})
    song = adopt(project, a.song) or prev.get("file")
    if not song:
        sys.exit("which song? cartoon song --song audio/song.mp3 [--lyrics lyrics.txt] [--vocals vocals.wav]")
    lyrics = adopt(project, a.lyrics) or prev.get("lyrics")
    vocals = adopt(project, a.vocals) or prev.get("vocals")
    lrc = None if a.auto else (adopt(project, a.lrc) or prev.get("lrc"))
    parts = None if a.auto_parts else (a.parts or prev.get("parts"))
    info, lines, act, res, x, dur, notes = analyse(project, song, lyrics, vocals, lrc, a.bpm_min, a.bpm_max, parts)
    reading = (lambda: music_reading(project, song, info, x)) if not a.no_reading else (lambda: None)
    twist, poster = suggest(info, lines, dur)
    update_cues(cues_path, info, lines, dur, twist, poster)
    set_html_duration(project / "index.html", round(dur, 2))
    (project / "audio").mkdir(exist_ok=True)
    words_known = info["timing"] == "lrc" and lines and all(l.get("words") for l in lines) and lrc and "<" in (project / lrc).read_text(encoding="utf-8-sig")
    _lyrics.write_lrc(project / "audio" / "song.lrc", lines, word_times=bool(words_known))
    for l in lines:
        l["dur"] = l["end"] - l["t"]
    _lyrics.write_srt(project / "song.srt", lines)
    res = dict(res, downbeats=info["bars"], twist_candidate=twist)
    map_w = draw_map(res, x, info, lines, act, dur, project / "song.map.png")
    made = False if a.no_preview else preview(project, info, lines, dur, map_w)

    how = {"lrc": "LRC", "stem": "vocal stem", "grid": "spread on bars (rough: no stem, no LRC)", "none": "no lyrics"}[info["timing"]]
    print(f"{Path(song).name}: {dur:.1f}s, {info['bpm']:.1f} BPM, {len(info['bars']) - 1} bars, line timing: {how}")
    print("  part           start  bars  lines  check")
    for s in info["sections"]:
        n = sum(1 for l in lines if l["section"] == s["id"])
        chk = []
        if s["n"] or s["t"] > 0:
            if s.get("nov", 1) < 0.2:
                chk.append("weak change")
        if "voice" in s:
            if n and s["voice"] < 0.15:
                chk.append("no voice?")
            if not n and s["voice"] > 0.3:
                chk.append("voice here?")
        print(f"  {s['id']:<13} {s['t']:6.2f}  {s['bars']:4d}  {n:5d}  {', '.join(chk) or 'ok'}")
    for m in notes:
        print("  ! " + m)
    print(f"  twist {twist:.2f}s, poster {poster:.2f}s; {len(lines)} lyric lines -> cues.js, audio/song.lrc, song.srt")
    reading()
    print("  look: song.map.png" + ("; watch: lyrics-preview.mp4 (are the lines on time?)" if made else ""))
    print("  fix timing: edit audio/song.lrc, then: cartoon song --lrc audio/song.lrc   next: cartoon audio")


if __name__ == "__main__":
    main()
