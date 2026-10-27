#!/usr/bin/env python3
"""A synthesized demo song with known answers: for the song-clip example and the selfcheck.

    python demo_song.py <out_dir>

Writes song.wav (the mix), vocals.wav (the "voice" stem), lyrics.txt (Suno-style tags) and
truth.json (bpm, bar times, sections, the start and end of every sung line). 110 BPM in A minor:
intro 2 bars, verse 4, chorus 4, verse 4, chorus 4, outro 2 (about 44 s). Deterministic: the same
files every run. No samples: every sound is made here, so the repository holds no third-party audio.
"""
import json, sys, wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from synth_audio import SR, bandpass, highpass, lowpass, midi_hz, pad, pluck  # noqa: E402

BPM = 110.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
LEAD_IN = 0.4  # silence before bar 1, like an exported track
PLAN = [("intro", 2), ("verse", 4), ("chorus", 4), ("verse", 4), ("chorus", 4), ("outro", 2)]
CHORDS = {  # one chord per bar (MIDI roots, minor/major triads)
    "intro": [(57, "m"), (53, "M")],
    "verse": [(57, "m"), (53, "M"), (48, "M"), (55, "M")],
    "chorus": [(53, "M"), (48, "M"), (55, "M"), (57, "m")],
    "outro": [(57, "m"), (57, "m")],
}
LYRICS = {
    ("verse", 0): ["Утро в городе тихо спит", "Дождь по крышам стучит", "Я иду, а ветер поёт", "Что-то новое меня ждёт"],
    ("verse", 1): ["Вечер красит окна в медь", "Хочется петь", "Я иду, а город молчит", "И никто не скажет стоп"],
    ("chorus", 0): ["Лети, лети, не жди", "Солнце встало впереди", "Лети, лети, не спи", "Мы вернёмся домой"],
}
LYRICS[("chorus", 1)] = LYRICS[("chorus", 0)]
START_BEATS = [0.0, 0.5, 0.25, 0.0]  # where each line starts inside its bar (singers are not always on 1)
SYL = 0.205  # seconds per sung syllable


def triad(root, q):
    return [root, root + (3 if q == "m" else 4), root + 7]


def tone(f, dur, harm=6, decay=0.0):
    t = np.arange(int(dur * SR)) / SR
    x = sum(np.sin(2 * np.pi * f * h * t) / h for h in range(1, harm + 1))
    return x * (np.exp(-t * decay) if decay else 1.0)


def kick(n_rng):
    t = np.arange(int(0.35 * SR)) / SR
    f = 110 * np.exp(-t * 18) + 48
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def snare(rng):
    t = np.arange(int(0.18 * SR)) / SR
    return bandpass(rng.standard_normal(len(t)), 1200, 6000) * np.exp(-t * 22) * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4


def hat(rng, open_=False):
    t = np.arange(int((0.12 if open_ else 0.04) * SR)) / SR
    return highpass(rng.standard_normal(len(t)), 7000) * np.exp(-t * (25 if open_ else 90)) * 0.5


def sing(f, dur, vowel, rng):
    """a vowel-like voice: a buzzy source with vibrato through two formant band-passes"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.01 * np.sin(2 * np.pi * 5.3 * t + rng.uniform(0, 6)) * np.minimum(1, t / 0.15)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    src = sum(np.sin(h * ph) / h for h in range(1, 16))
    x = bandpass(src, vowel[0] * 0.8, vowel[0] * 1.25) + 0.7 * bandpass(src, vowel[1] * 0.85, vowel[1] * 1.2)
    env = np.minimum(1, t / 0.025) * np.minimum(1, (dur - t) / 0.05)
    return x / (np.max(np.abs(x)) + 1e-9) * env


def put(bus, x, t0, gain=1.0):
    a = int(round(t0 * SR))
    if a < 0 or a >= len(bus):
        return
    b = min(len(bus), a + len(x))
    bus[a:b] += x[: b - a] * gain


def build():
    import _lyrics
    rng = np.random.default_rng(2026)
    nbars = sum(b for _, b in PLAN)
    total = LEAD_IN + nbars * BAR + 2.5
    inst, voice = np.zeros(int(total * SR)), np.zeros(int(total * SR))
    vowels = [(700, 1220), (400, 2000), (550, 900), (300, 2300), (450, 1000)]
    scale_v = [57, 60, 62, 64, 67, 69]          # A minor pentatonic, A3..A4
    scale_c = [64, 67, 69, 72, 74, 76]          # higher for the chorus
    sections, lines, bar = [], [], 0
    count = {}
    for kind, nb in PLAN:
        n = count.get(kind, 0)
        count[kind] = n + 1
        t_sec = LEAD_IN + bar * BAR
        sections.append({"kind": kind, "n": n, "bar": bar, "bars": nb, "t": round(t_sec, 3), "end": round(t_sec + nb * BAR, 3)})
        loud = {"intro": 0.35, "verse": 0.6, "chorus": 1.0, "outro": 0.4}[kind]
        for i in range(nb):
            t0 = t_sec + i * BAR
            root, q = CHORDS[kind][i % len(CHORDS[kind])]
            notes = triad(root, q)
            put(inst, pad([midi_hz(m) for m in notes], BAR + 0.3, 1400 if kind != "chorus" else 2600), t0, 0.9 * loud + 0.2)
            if kind in ("verse", "chorus"):
                put(inst, lowpass(tone(midi_hz(root - 24), BEAT * 1.6, 4, 2.0), 300), t0, 0.9)
                put(inst, lowpass(tone(midi_hz(root - 24), BEAT * 0.8, 4, 4.0), 300), t0 + 2 * BEAT, 0.6)
                put(inst, kick(rng), t0, 1.0)
                put(inst, kick(rng), t0 + 2 * BEAT, 0.55 if kind == "verse" else 0.8)
            if kind == "chorus":
                put(inst, kick(rng), t0 + BEAT, 0.6)
                put(inst, kick(rng), t0 + 3 * BEAT, 0.6)
                for b in (1, 3):
                    put(inst, snare(rng), t0 + b * BEAT, 0.8)
                arp = notes + [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[0] + 24, notes[2] + 12]
                for j in range(8):
                    put(inst, pluck(midi_hz(arp[j % len(arp)] + 12), 0.4, 0.9), t0 + j * BEAT / 2, 0.22)
            for j in range(8):
                if kind != "outro" or i == 0:
                    put(inst, hat(rng, open_=(kind == "chorus" and j % 2 == 1)), t0 + j * BEAT / 2, (0.18 if j % 2 else 0.3) * (0.5 + loud))
            if kind == "intro":
                put(inst, kick(rng), t0, 0.5)
            if kind == "outro" and i == 0:
                put(inst, kick(rng), t0, 0.9)
                put(inst, lowpass(tone(midi_hz(root - 24), BAR * 2, 4, 0.8), 300), t0, 0.8)
            # the voice: one line per bar
            text_lines = LYRICS.get((kind, n))
            if text_lines and i < len(text_lines):
                text = text_lines[i]
                ls = t0 + START_BEATS[i % 4] * BEAT + rng.uniform(-0.04, 0.04)
                ws = _lyrics.words(text)
                syl = [max(1, _lyrics.syllables(w)) for w in ws]
                scale = scale_c if kind == "chorus" else scale_v
                tt, wt, k = ls, [], 0
                for wi, (w, s) in enumerate(zip(ws, syl)):
                    wt.append([round(tt, 3), w])
                    for _ in range(s):
                        d = SYL * rng.uniform(0.9, 1.15) * (1.6 if k == sum(syl) - 1 else 1.0)
                        f = midi_hz(scale[int(rng.integers(0, len(scale)))])
                        put(voice, sing(f, d, vowels[int(rng.integers(0, len(vowels)))], rng), tt, 0.8 if kind == "chorus" else 0.65)
                        tt += d
                        k += 1
                    if wi == len(ws) // 2 - 1:
                        tt += 0.12  # a short breath in the middle of the line
                lines.append({"t": round(ls, 3), "end": round(tt, 3), "text": text, "section": f"{kind}{n + 1}", "words": wt})
        bar += nb
    mix = inst * 0.5 + voice * 0.55
    peak = np.max(np.abs(mix)) + 1e-9
    mix, voice = mix / peak * 0.89, voice / peak * 0.89 * 0.55
    bars = [round(LEAD_IN + i * BAR, 3) for i in range(nbars + 1)]
    text = []
    for kind, n in [(s["kind"], s["n"]) for s in sections]:
        text.append(f"[{kind.capitalize()}{' ' + str(n + 1) if kind == 'verse' else ''}]")
        text += LYRICS.get((kind, n), [])
        text.append("")
    truth = {"bpm": BPM, "bar": BAR, "beat": BEAT, "bars": bars, "duration": round(len(mix) / SR, 3),
             "sections": sections, "lines": lines}
    return mix, voice, "\n".join(text), truth


def write_wav(path, x):
    pcm = (np.clip(np.stack([x, x], axis=1), -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    mix, voice, text, truth = build()
    write_wav(out / "song.wav", mix)
    write_wav(out / "vocals.wav", voice)
    (out / "lyrics.txt").write_text(text, encoding="utf-8")
    (out / "truth.json").write_text(json.dumps(truth, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"demo song: {truth['duration']:.1f}s, {BPM:.0f} BPM, {len(truth['sections'])} sections, {len(truth['lines'])} lines -> {out}")


if __name__ == "__main__":
    main()
