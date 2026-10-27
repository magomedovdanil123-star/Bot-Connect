"""Song lyrics: Suno/Udio text with section tags, syllables, LRC and SRT.

    parse(text)            -> [{"kind", "label", "lines": [{"text", "syl", "backing"}]}]
    syllables(text)        vowel groups (Russian and English), never 0 for a word with letters
    read_lrc(path)         -> [{"t", "text", "words": [[t, word], ...] | None}]  (enhanced LRC <mm:ss.xx> too)
    write_lrc(path, lines, meta) / write_srt(path, lines)
    match(lyric_lines, lrc_lines) -> index of the LRC line for every lyric line (or None)

Section tags are lines in square brackets: [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Bridge],
[Instrumental], [Guitar Solo], [Outro] (Russian too: [Куплет], [Припев], [Бридж], [Проигрыш]).
Production tags ([Fade Out], [End], [Male Vocal], ...) are skipped. A line fully in parentheses is
a backing vocal: it is shown with the line before it and is not timed on its own.
"""
import difflib
import re
from pathlib import Path

KINDS = [  # (kind, keywords) — the first match wins, so pre-chorus is tested before chorus
    ("prechorus", ("pre-chorus", "prechorus", "pre chorus", "build", "предприпев", "пред-припев")),
    ("chorus", ("chorus", "hook", "refrain", "припев")),
    ("verse", ("verse", "куплет")),
    ("bridge", ("bridge", "бридж", "мост")),
    ("intro", ("intro", "интро", "вступление")),
    ("outro", ("outro", "аутро", "кода", "coda", "окончание", "финал")),
    ("instrumental", ("instrumental", "solo", "break", "interlude", "drop", "соло", "проигрыш", "инструментал")),
]
SKIP = ("end", "fade", "конец", "male", "female", "vocal", "voice", "spoken", "whisper", "harmon", "choir",
        "tempo", "bpm", "key", "style", "mood", "genre", "мужск", "женск", "вокал", "голос")
TAG = re.compile(r"^\s*\[([^\]]*)\]\s*$")
RU_V = set("аеёиоуыэюяАЕЁИОУЫЭЮЯ")
WORD = re.compile(r"[\w'’-]+", re.U)


def kind_of(label):
    low = label.lower()
    for kind, keys in KINDS:
        if any(k in low for k in keys):
            return kind
    if any(low.startswith(s) or s in low for s in SKIP):
        return None
    return "section"


def syllables(text):
    """vowel groups; Cyrillic counts every vowel, Latin uses a light English heuristic"""
    total = 0
    for w in WORD.findall(text):
        if any(c in RU_V for c in w):
            total += sum(c in RU_V for c in w)
            continue
        lw = re.sub(r"[^a-z]", "", w.lower())
        if not lw:
            continue
        n = len(re.findall(r"[aeiouy]+", lw))
        if lw.endswith("e") and not lw.endswith(("le", "ee")) and n > 1:
            n -= 1
        total += max(1, n)
    return total


def words(text):
    """the words of a line as shown (punctuation stays attached)"""
    return [w for w in text.split() if w.strip()]


def word_weights(text):
    """per-word timing weight: syllables, at least 0.4 (a one-letter preposition still takes time)"""
    return [max(0.4, syllables(w)) for w in words(text)]


def parse(text):
    """Suno/Udio lyrics -> sections. Text without tags -> stanzas split on blank lines (kind "stanza")."""
    sections, cur = [], None
    has_tags = any(TAG.match(ln) and kind_of(TAG.match(ln).group(1)) for ln in text.splitlines())
    blank = True
    for raw in text.splitlines():
        ln = raw.strip()
        m = TAG.match(ln)
        if m:
            k = kind_of(m.group(1))
            if k:
                cur = {"kind": k, "label": m.group(1).strip(), "lines": []}
                sections.append(cur)
            continue
        if not ln:
            blank = True
            continue
        if not has_tags and (cur is None or blank):
            cur = {"kind": "stanza", "label": "", "lines": []}
            sections.append(cur)
        blank = False
        if cur is None:
            cur = {"kind": "verse", "label": "", "lines": []}
            sections.append(cur)
        if ln.startswith("(") and ln.endswith(")"):
            if cur["lines"]:
                cur["lines"][-1]["backing"] = (cur["lines"][-1].get("backing", "") + " " + ln).strip()
            continue
        main = re.sub(r"\([^)]*\)", "", ln).strip()
        cur["lines"].append({"text": ln, "syl": max(1, syllables(main or ln))})
    if not has_tags:
        label_stanzas(sections)
    return sections


def norm(s):
    return re.sub(r"\W+", " ", s.lower().replace("ё", "е")).strip()


def label_stanzas(sections):
    """untagged lyrics: a stanza whose text repeats is the chorus, the others are verses"""
    texts = [" / ".join(norm(l["text"]) for l in s["lines"]) for s in sections]
    for i, s in enumerate(sections):
        rep = any(j != i and difflib.SequenceMatcher(None, texts[i], texts[j]).ratio() > 0.7 for j in range(len(texts)))
        s["kind"] = "chorus" if rep else "verse"


# ------------------------------------------------------------------ LRC / SRT
TS = re.compile(r"\[(\d+):(\d+(?:[.:]\d+)?)\]")
WTS = re.compile(r"<(\d+):(\d+(?:[.:]\d+)?)>")


def _sec(m, s):
    return int(m) * 60 + float(s.replace(":", "."))


def read_lrc(path):
    """LRC lines sorted by time; [offset:+/-ms] applied; enhanced <mm:ss.xx> word times kept"""
    offset, out = 0.0, []
    for raw in Path(path).read_text(encoding="utf-8-sig").splitlines():
        mo = re.match(r"\s*\[offset:\s*([+-]?\d+)\]", raw, re.I)
        if mo:
            offset = int(mo.group(1)) / 1000.0
            continue
        stamps = TS.findall(raw)
        if not stamps:
            continue
        body = TS.sub("", raw).strip()
        wts = [(_sec(a, b), i) for i, (a, b) in enumerate(WTS.findall(body))]
        wl = None
        if wts:
            parts = WTS.split(body)  # text, m, s, text, m, s, text ...
            wl = []
            for i in range(1, len(parts) - 1, 3):
                w = parts[i + 2].strip()
                if w:
                    wl.append([round(_sec(parts[i], parts[i + 1]) - offset, 3), w])
            body = " ".join(w for _, w in wl)
        if not body:
            continue  # an empty timed line marks the end of the previous one
        for a, b in stamps:
            out.append({"t": round(_sec(a, b) - offset, 3), "text": body, "words": wl})
    out.sort(key=lambda l: l["t"])
    return out


def fmt_lrc(t):
    t = max(0.0, t)
    m = int(t // 60)
    return f"{m:02d}:{t - 60 * m:05.2f}"


def write_lrc(path, lines, meta=None, word_times=False):
    """lines: [{"t", "text", "words"?}]; word_times writes enhanced LRC when every line has words"""
    out = [f"[{k}:{v}]" for k, v in (meta or {}).items() if v]
    for l in lines:
        if word_times and l.get("words"):
            out.append(f"[{fmt_lrc(l['t'])}]" + " ".join(f"<{fmt_lrc(t)}>{w}" for t, w in l["words"]))
        else:
            out.append(f"[{fmt_lrc(l['t'])}]{l['text']}")
    Path(path).write_text("\n".join(out) + "\n", encoding="utf-8")


def write_srt(path, lines):
    def ts(t):
        ms = int(round(max(0.0, t) * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    out = []
    for i, l in enumerate(lines, 1):
        out += [str(i), f"{ts(l['t'])} --> {ts(l['t'] + l['dur'])}", l["text"], ""]
    Path(path).write_text("\n".join(out), encoding="utf-8")


def match(lyric_lines, lrc_lines):
    """align lyric lines (from the tagged text) with LRC lines by text; returns an index or None per lyric line"""
    a = [norm(l["text"]) for l in lyric_lines]
    b = [norm(l["text"]) for l in lrc_lines]
    if len(a) == len(b):
        return list(range(len(a)))
    res = [None] * len(a)
    j = 0
    for i, s in enumerate(a):  # greedy in order, looking a few lines ahead
        best, bj = 0.0, None
        for k in range(j, min(len(b), j + 4)):
            r = difflib.SequenceMatcher(None, s, b[k]).ratio()
            if r > best:
                best, bj = r, k
        if bj is not None and best >= 0.5:
            res[i], j = bj, bj + 1
    return res
