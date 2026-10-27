#!/usr/bin/env python3
"""Speak the "voice" cues of a project: text -> audio/voice/<id>.wav (cached by text + voice).

    python voice.py <project> [--fit] [--engine piper|system|cloud|files] [--model NAME] [--rate 1.0]
    (or: cartoon voice [--fit])

cues.js:
  "voice": {"engine": "piper", "model": "ru_RU-irina-medium", "rate": 1.0, "speaker": 0}
  {"id": "line1", "t": 1.0, "type": "voice", "text": "Once upon a time..."}

Engines
  piper   Local neural TTS: pip install piper-tts. Piper is GPL-3.0 and runs as a separate
          program; it is not part of this skill. Voices download on first use into
          ~/.cache/code-cartoon/piper (override with CARTOON_PIPER_DIR).
          Russian: ru_RU-irina-medium, ru_RU-denis-medium, ru_RU-dmitri-medium, ru_RU-ruslan-medium.
          English: en_US-lessac-medium, en_US-amy-medium, en_GB-alan-medium, ...
          Every voice has its own licence (MODEL_CARD at huggingface.co/rhasspy/piper-voices):
          check it before commercial use.
  system  The OS voice, nothing to install: Windows SAPI ("Microsoft Irina Desktop" for ru-RU),
          macOS `say`, Linux espeak-ng. "model" = voice name (optional), "lang" = e.g. "ru-RU".
  cloud   A speech service (scripts/gen.py, keys: cartoon gen keys). Cloudflare Workers AI:
          "model": "aura-2-en" (default) with "speaker": "luna" | "orion" | "athena" | ... (English),
          "aura-2-es" (Spanish), "melotts" with "lang": en es fr zh jp kr. No Russian there: use piper.
          Paid per character beyond the free daily neurons; "rate" is ignored.
  files   Your own recordings: audio/voice/<id>.wav, or "file": "path" on the cue.

--fit sets each voice cue's "dur" to the spoken length + 0.15 s (d.caption(id) uses it) and warns
when a line runs into the next one. Then run `cartoon audio`: the mix ducks music under the voice.
"""
import argparse, hashlib, json, os, platform, shutil, subprocess, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _cues  # noqa: E402
from _audio import duration  # noqa: E402

PIPER_DIR = Path(os.environ.get("CARTOON_PIPER_DIR", Path.home() / ".cache" / "code-cartoon" / "piper"))


def run(cmd, **kw):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)
    if p.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {(p.stderr or p.stdout)[-400:]}")
    return p


def to_wav48(src, dst):
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", str(dst)])


def piper(text, out, cfg):
    model = cfg.get("model", "en_US-lessac-medium")
    try:
        import piper as _  # noqa: F401
    except ImportError:
        raise SystemExit("Piper is not installed: pip install piper-tts   (or set \"engine\": \"system\" in cues.js voice)")
    PIPER_DIR.mkdir(parents=True, exist_ok=True)
    if not (PIPER_DIR / f"{model}.onnx").exists():
        print(f"  downloading Piper voice {model} -> {PIPER_DIR}")
        run([sys.executable, "-m", "piper.download_voices", model, "--data-dir", str(PIPER_DIR)])
        print(f"  ! check the licence of {model} before commercial use: https://huggingface.co/rhasspy/piper-voices (MODEL_CARD)")
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / "raw.wav"
        cmd = [sys.executable, "-m", "piper", "-m", model, "--data-dir", str(PIPER_DIR), "-f", str(raw),
               "--length-scale", f"{1.0 / float(cfg.get('rate', 1.0)):.3f}"]
        if "speaker" in cfg:
            cmd += ["-s", str(cfg["speaker"])]
        run(cmd + ["--", text])
        to_wav48(raw, out)


def system_tts(text, out, cfg):
    rate, name, lang = float(cfg.get("rate", 1.0)), cfg.get("model", ""), cfg.get("lang", "")
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        sysname = platform.system()
        if sysname == "Windows":
            (td / "t.txt").write_text(text, encoding="utf-8")
            ps = (
                "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
                f"$name = '{name}'; $lang = '{lang}'; "
                "if ($name) { $s.SelectVoice($name) } elseif ($lang) { $v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq $lang } | Select-Object -First 1; if ($v) { $s.SelectVoice($v.VoiceInfo.Name) } }; "
                f"$s.Rate = {max(-10, min(10, round((rate - 1) * 10)))}; "
                f"$s.SetOutputToWaveFile('{td / 'raw.wav'}'); $s.Speak([IO.File]::ReadAllText('{td / 't.txt'}', [Text.Encoding]::UTF8)); $s.Dispose()"
            )
            run(["powershell", "-NoProfile", "-Command", ps])
            raw = td / "raw.wav"
        elif sysname == "Darwin":
            raw = td / "raw.aiff"
            run(["say"] + (["-v", name] if name else []) + ["-r", str(int(180 * rate)), "-o", str(raw), text])
        else:
            if not shutil.which("espeak-ng"):
                raise SystemExit("no system TTS found: install espeak-ng, or use piper / files")
            raw = td / "raw.wav"
            run(["espeak-ng"] + (["-v", name or lang.split("-")[0]] if (name or lang) else []) + ["-s", str(int(165 * rate)), "-w", str(raw), text])
        to_wav48(raw, out)


def files(text, out, cfg, cue, project):
    src = project / cue["file"] if cue.get("file") else out
    if not src.exists():
        raise SystemExit(f"voice cue {cue['id']}: record {src} (any audio format) or use another engine")
    if src.resolve() != out.resolve():
        to_wav48(src, out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("--fit", action="store_true", help="write each line's spoken length into its cue dur")
    ap.add_argument("--engine"); ap.add_argument("--model"); ap.add_argument("--rate", type=float); ap.add_argument("--lang")
    ap.add_argument("--force", action="store_true", help="re-synthesize even if cached")
    a = ap.parse_args()

    project = Path(a.project)
    cues_path = project / "cues.js"
    cues = _cues.load(cues_path)
    cfg = dict(cues.get("voice", {}))
    for k in ("engine", "model", "rate", "lang"):
        if getattr(a, k) is not None:
            cfg[k] = getattr(a, k)
    engine = cfg.get("engine", "piper")
    lines = [e for e in cues["events"] if e.get("type") == "voice"]
    if not lines:
        print("no voice cues: add {\"id\": \"line1\", \"t\": 1.0, \"type\": \"voice\", \"text\": \"...\"} to cues.js")
        return
    vdir = project / "audio" / "voice"
    vdir.mkdir(parents=True, exist_ok=True)
    durs = {}
    for e in lines:
        out = vdir / f"{e['id']}.wav"
        meta = vdir / f"{e['id']}.json"
        key = hashlib.sha1(json.dumps([engine, cfg.get("model"), cfg.get("rate", 1.0), cfg.get("speaker"), cfg.get("lang"), e.get("text"), e.get("file")], ensure_ascii=False).encode()).hexdigest()
        cached = meta.exists() and out.exists() and json.loads(meta.read_text(encoding="utf-8")).get("key") == key
        if not cached or a.force:
            if engine == "piper":
                piper(e["text"], out, cfg)
            elif engine == "system":
                system_tts(e["text"], out, cfg)
            elif engine == "cloud":
                import gen
                gen.speech(e["text"], out, cfg)
            elif engine == "files":
                files(e.get("text", ""), out, cfg, e, project)
            else:
                raise SystemExit(f"unknown voice engine '{engine}' (piper | system | cloud | files)")
            meta.write_text(json.dumps({"key": key}), encoding="utf-8")
        durs[e["id"]] = duration(out)
        print(f"  {e['t']:7.2f}s  {durs[e['id']]:5.2f}s  {e['id']:<12} {'(cached) ' if cached and not a.force else ''}{e.get('text', '')[:60]}")

    if a.fit:
        for e in cues["events"]:
            if e.get("id") in durs:
                e["dur"] = round(durs[e["id"]] + 0.15, 2)
        _cues.save(cues_path, cues)
        print("  cues.js: voice cue durations updated (--fit)")
    seq = sorted((e for e in cues["events"] if e.get("id") in durs), key=lambda e: e["t"])
    for x, y in zip(seq, seq[1:]):
        if x["t"] + durs[x["id"]] > y["t"]:
            print(f"  ! {x['id']} ({x['t']:.2f}s + {durs[x['id']]:.2f}s) runs into {y['id']} at {y['t']:.2f}s -- move {y['id']} later")
    end = max(e["t"] + durs[e["id"]] for e in seq)
    if end > float(cues["duration"]):
        print(f"  ! the last line ends at {end:.2f}s, after the video ({cues['duration']}s)")
    print(f"{len(durs)} voice line(s) in audio/voice/ -- next: cartoon audio")


if __name__ == "__main__":
    main()
