#!/usr/bin/env python3
"""Self-check of the skill itself (run before a release and in CI).   cartoon selfcheck [--quick]

  palettes   strict JSON; every palette has the base roles; crayon/lubok/cosmos have their extra roles
  templates  cues.js blocks parse (2d, photo3d, clip); ids unique; every event type is known to synth_audio.py
  fonts      every @font-face file exists; every font family ships its licence
  vendor     three.js / GSAP present with their licence notes
  js         node --check on the engine, scenes and modules
  privacy    no absolute user paths or e-mail addresses in text files
  beats      a synthetic 120 BPM click track -> 120 +- 1 BPM, beats within 30 ms
  lyrics     Suno tags, backing vocals and syllables parse; LRC (also enhanced) survives a round trip
  gen        generative services offline: picture sizes, requests and replies, .env keys, errors, voice -> LRC
  song       the demo song (scripts/demo_song.py): parts on the right bars with the stem, without it,
             from an LRC and from the music alone; line starts within 1 beat (stem) / 1 bar (no stem)
             (skipped with --quick)
  audio      a fresh project builds its soundtrack at -15 +- 1 LUFS (skipped with --quick)
Exit code 0 = all good.
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
sys.path.insert(0, str(HERE))
fails, notes = [], []


def check(name, ok, detail=""):
    print(f"  {'ok  ' if ok else 'FAIL'}  {name}{('  ' + detail) if detail else ''}")
    if not ok:
        fails.append(name)


def block(path, placeholders=None):
    txt = Path(path).read_text(encoding="utf-8")
    for k, v in (placeholders or {}).items():
        txt = txt.replace(k, v)
    m = re.search(r"/\*JSON-START\*/(.*)/\*JSON-END\*/", txt, re.S)
    return json.loads(m.group(1))


BASE = ["paper", "tooth", "line", "soft", "guide", "a1", "a2", "a3", "warm", "glow", "shade", "kind"]
CRAYON = ["sheet", "navy", "violet", "sun", "orange", "red", "sky", "green", "grey", "black", "brown", "hair", "skin", "cheek"]
COSMOS = CRAYON + ["metal", "gold", "wood", "woodgap", "ocean", "space", "nebula1", "nebula2", "leaf1", "leaf2", "leaf3"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--quick", action="store_true", help="skip the audio build")
    a = ap.parse_args()
    print(f"code-cartoon selfcheck  ({SKILL})")

    # palettes
    try:
        pal = block(SKILL / "assets/template/engine/palettes.js")
        missing = {n: [r for r in BASE if r not in p] for n, p in pal.items()}
        missing = {n: m for n, m in missing.items() if m}
        check(f"palettes: {len(pal)} parse, base roles", not missing, str(missing) if missing else "")
        for name, roles in (("crayon", CRAYON), ("lubok", CRAYON), ("cosmos", COSMOS)):
            lack = [r for r in roles if r not in pal.get(name, {})]
            check(f"palette {name}: extra roles", not lack, ", ".join(lack))
    except Exception as e:  # noqa: BLE001
        check("palettes.js parses", False, str(e))

    # templates: cues
    import synth_audio
    known = set(re.findall(r'"([a-z]+)": lambda', (HERE / "synth_audio.py").read_text(encoding="utf-8"))) | {"none", "voice", "caption", "lyric"}
    for t in ("template", "template-photo3d", "template-clip"):
        try:
            c = block(SKILL / f"assets/{t}/cues.js", {"__DUR__": "10"})
            ids = [e["id"] for e in c["events"]]
            check(f"{t}/cues.js parses, ids unique", len(ids) == len(set(ids)))
            unknown = sorted({e.get("type", "none") for e in c["events"]} - known)
            check(f"{t}/cues.js event types known", not unknown, ", ".join(unknown))
            if c.get("music", {}).get("mood"):
                check(f"{t}/cues.js music mood exists", c["music"]["mood"] in synth_audio.MOODS, c["music"]["mood"])
        except Exception as e:  # noqa: BLE001
            check(f"{t}/cues.js parses", False, str(e))

    # fonts + licences
    for t in ("template", "template-3d", "template-photo3d"):
        html = SKILL / f"assets/{t}/index.html"
        urls = re.findall(r'url\("(fonts/[^"]+)"\)', html.read_text(encoding="utf-8"))
        lost = [u for u in urls if not ((SKILL / f"assets/{t}" / u).exists() or (SKILL / "assets/template" / u).exists())]
        check(f"{t}: {len(urls)} font files present", not lost, ", ".join(lost))
    lic = {"caveat": "LICENSE-Caveat-OFL.txt", "inter": "LICENSE-Inter-OFL.txt", "ruslan": "LICENSE-RuslanDisplay-OFL.txt"}
    for fam, f in lic.items():
        check(f"font licence {f}", (SKILL / "assets/template/fonts" / f).exists())
    check("font licence LICENSE-Lora-OFL.txt", (SKILL / "assets/template-photo3d/fonts/LICENSE-Lora-OFL.txt").exists())
    check("vendor: three.js + MIT note", (SKILL / "assets/template-3d/vendor/three.module.min.js").exists() and (SKILL / "assets/template-3d/vendor/LICENSE-three-MIT.txt").exists())
    g = SKILL / "assets/template/vendor/gsap.min.js"
    check("vendor: GSAP with its notice header", g.exists() and "standard-license" in g.read_text(encoding="utf-8", errors="ignore")[:600])
    check("sample photo licence record", (SKILL / "assets/template-photo3d/assets/sample-photo.LICENSE.json").exists())

    # js syntax
    node = shutil.which("node")
    if node:
        js = [SKILL / "assets/template/engine/sketch.js", SKILL / "assets/template/engine/pencil3d.js", SKILL / "assets/template/engine/engraving.js", SKILL / "assets/template/engine/palettes.js", SKILL / "assets/template/scene.js", SKILL / "assets/template/cues.js",
              SKILL / "assets/template-clip/scene.js", SKILL / "assets/template-clip/cues.js"]
        bad = [p.name for p in js if subprocess.run([node, "--check", str(p)], capture_output=True).returncode != 0]
        mods = [SKILL / "assets/template-3d/scene3d.js", SKILL / "assets/template-photo3d/scene3d.js", SKILL / "assets/template-photo3d/kit3d.js"]
        with tempfile.TemporaryDirectory() as td:  # ES modules: check a .mjs copy
            for p in mods:
                q = Path(td) / (p.parent.name + "-" + p.stem + ".mjs")
                q.write_text(p.read_text(encoding="utf-8"), encoding="utf-8")
                if subprocess.run([node, "--check", str(q)], capture_output=True).returncode != 0:
                    bad.append(p.parent.name + "/" + p.name)
        check("node --check (engine, scenes, modules)", not bad, ", ".join(bad))
        # pencil3d: a path that jumps (a new shot) must not bank the plane around the jump
        probe = r"""
global.window = global; window.Sketch = {}; require(process.argv[2]);
const P3 = window.P3, turn = (t, s) => [240 * Math.sin(t * 0.3), 0, s * 240 * (1 - Math.cos(t * 0.3))];
const path = (t) => (t < 5 ? turn(t, 1) : (([x, y, z]) => [x - 700, y, z])(turn(t, -1)));
const bank = (t) => { const a = P3.flight(path, t).att; return Math.atan2(P3.dot(a.u, P3.norm(P3.cross(a.f, [0, 1, 0]))), a.u[1]) * 180 / Math.PI; };
console.log(JSON.stringify([4, 4.8, 4.98, 5.02, 5.2, 6].map((t) => [t, Math.abs(bank(t)), P3.len(P3.flight(path, t).vel)])));
"""
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "probe.js").write_text(probe, encoding="utf-8")
            r = subprocess.run([node, str(Path(td) / "probe.js"), str(SKILL / "assets/template/engine/pencil3d.js")], capture_output=True, text=True)
        try:
            rows = json.loads(r.stdout)
            ok = all(abs(b - rows[0][1]) < 1 and abs(v - 72) < 2 for _, b, v in rows)
            check("pencil3d: a jump in a path does not bank the plane", ok, " ".join(f"{t}s {b:.0f}deg {v:.0f}m/s" for t, b, v in rows))
        except ValueError:
            check("pencil3d: a jump in a path does not bank the plane", False, (r.stderr or r.stdout)[-200:])
        # engraving: the variant of a drawing that starts before 0 (beatLock) is never negative
        probe = r"""
global.window = global; window.Sketch = { load() {}, asset() {} }; require(process.argv[2]);
const E = window.Sketch.engraving;
console.log(JSON.stringify([-0.4, -0.1, 0, 0.1, 0.5, 1.7].map((t) => E.variant(t))));
"""
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "eng.js").write_text(probe, encoding="utf-8")
            r = subprocess.run([node, str(Path(td) / "eng.js"), str(SKILL / "assets/template/engine/engraving.js")], capture_output=True, text=True)
        try:
            vs = json.loads(r.stdout)
            check("engraving: the variant is wrapped before t = 0", all(v in (0, 1, 2) for v in vs), str(vs))
        except ValueError:
            check("engraving: the variant is wrapped before t = 0", False, (r.stderr or r.stdout)[-200:])
        # ...and a plane that speeds up from rest is not a jump: its time window stays whole
        start = r"""
global.window = global; window.Sketch = {}; require(process.argv[2]);
const P3 = window.P3, ss = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (6 * u - 15) + 10));
const path = (t) => { const a = (160 * ss((t - 1) / 2)) / 80; return [80 * Math.sin(a), 0, 80 * (1 - Math.cos(a))]; };
console.log(JSON.stringify([1.05, 1.15, 1.3].map((t) => P3.span(path, t, 0.3).map((x) => +(x - t).toFixed(3)))));
"""
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "start.js").write_text(start, encoding="utf-8")
            r = subprocess.run([node, str(Path(td) / "start.js"), str(SKILL / "assets/template/engine/pencil3d.js")], capture_output=True, text=True)
        try:
            spans = json.loads(r.stdout)
            check("pencil3d: speeding up from rest is not a jump", all(lo == -0.3 and hi == 0.3 for lo, hi in spans), str(spans))
        except ValueError:
            check("pencil3d: speeding up from rest is not a jump", False, (r.stderr or r.stdout)[-200:])
    else:
        notes.append("node not found: JS syntax not checked")

    # privacy
    pat = re.compile(r"([A-Za-z]:[\\/]Users[\\/]|/Users/[a-z]|/home/[a-z]|[\w.+-]+@[\w-]+\.[\w.]+)")
    hits = []
    for p in SKILL.rglob("*"):
        if p.is_file() and p.suffix in {".md", ".sh", ".py", ".js", ".json", ".html", ".txt"} and "vendor" not in p.parts and p.name != "selfcheck.py":
            for m in pat.finditer(p.read_text(encoding="utf-8", errors="ignore")):
                s = m.group(0)
                if not re.search(r"(noreply|example\.com|users\.noreply|@anthropic-ai|@fontsource|@\d|greensock\.com)", s):
                    hits.append(f"{p.relative_to(SKILL)}: {s}")
    check("privacy: no user paths / e-mails", not hits, "; ".join(hits[:5]))

    # beats calibration
    try:
        import numpy as np
        import beats
        with tempfile.TemporaryDirectory() as td:
            sr, bpm, t0 = 44100, 120.0, 0.5
            x = np.zeros(int(20 * sr)); truth = []
            for k in range(int((20 - t0) * bpm / 60)):
                t = t0 + k * 60 / bpm; truth.append(t); i = int(t * sr); n = int(0.05 * sr); tt = np.arange(n) / sr
                x[i:i + n] += (np.sin(2 * np.pi * (1500 if k % 4 else 80) * tt) * np.exp(-tt * (60 if k % 4 else 25)) * (0.5 if k % 4 else 0.9))[: len(x) - i]
            f = Path(td) / "click.wav"
            with wave.open(str(f), "wb") as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
            res, _ = beats.analyse(f)
            b = np.array(res["beats"]); truth = np.array(truth)
            err = np.array([b[np.argmin(np.abs(b - t))] - t for t in truth if b.min() - 0.1 < t < b.max() + 0.1])
            check("beats: 120 BPM click track", abs(res["bpm"] - 120) <= 1 and np.max(np.abs(err)) <= 0.03, f"{res['bpm']} BPM, max error {np.max(np.abs(err)) * 1000:.0f} ms")
    except Exception as e:  # noqa: BLE001
        check("beats: 120 BPM click track", False, str(e))

    # lyrics: tags, backing vocals, syllables, LRC round trip
    try:
        import _lyrics
        secs = _lyrics.parse("[Intro]\n[Verse 1: Male Vocal]\nУтро в городе тихо спит\n(тихо спит)\nRain is falling down\n\n"
                             "[Pre-Chorus]\nОдна строка\n[Chorus]\nЛети, лети\n[Guitar Solo]\n[Fade Out]\n[Припев]\nЛети, лети\n[End]\n")
        kinds = [s["kind"] for s in secs]
        v = secs[1]["lines"]
        ok = kinds == ["intro", "verse", "prechorus", "chorus", "instrumental", "chorus"] and len(v) == 2 \
            and v[0].get("backing") == "(тихо спит)" and v[0]["syl"] == 8 and v[1]["syl"] == 5
        check("lyrics: Suno tags, backing vocals, syllables", ok, f"{kinds} {[(l['text'], l['syl']) for l in v]}")
        with tempfile.TemporaryDirectory() as td:
            ls = [{"t": 4.8, "text": "Утро в городе", "words": [[4.8, "Утро"], [5.31, "в"], [5.44, "городе"]]},
                  {"t": 65.07, "text": "Rain is falling", "words": [[65.07, "Rain"], [65.5, "is"], [65.9, "falling"]]}]
            _lyrics.write_lrc(Path(td) / "a.lrc", ls, {"ti": "demo"}, word_times=True)
            back = _lyrics.read_lrc(Path(td) / "a.lrc")
            (Path(td) / "b.lrc").write_text("[offset:+200]\n[00:01.50][00:20.00]Twice\n[00:03.00]Once\n", encoding="utf-8")
            off = _lyrics.read_lrc(Path(td) / "b.lrc")
            ok = [(l["t"], l["text"], l["words"]) for l in back] == [(l["t"], l["text"], l["words"]) for l in ls] \
                and [(l["t"], l["text"]) for l in off] == [(1.3, "Twice"), (2.8, "Once"), (19.8, "Twice")]
            check("lyrics: LRC round trip (enhanced, offset, repeated stamps)", ok)
    except Exception as e:  # noqa: BLE001
        check("lyrics: parse and LRC", False, repr(e))

    # gen: requests and replies of the generative services, offline (no keys, no network)
    try:
        import base64 as b64
        import gen
        w, h = gen.dims("16:9")
        ok = w % 16 == 0 and h % 16 == 0 and 0.9e6 < w * h < 1.1e6 and abs(w / h - 16 / 9) < 0.03 \
            and gen.dims("9:16", max_side=1024)[1] <= 1024 and gen.dims(size="1921x1080") == (1920, 1072)
        check("gen: picture sizes (multiples of 16, ~1 MP, max side)", ok, f"{w}x{h}")
        png = b"\x89PNG\r\n\x1a\n" + b"\0" * 16
        enc = b64.b64encode(png).decode()
        got = [gen.image_bytes("image/png", png), gen.image_bytes("application/json", json.dumps({"result": {"image": enc}}).encode()),
               gen.image_bytes("application/json", json.dumps({"image": "data:image/png;base64," + enc}).encode())]
        try:
            gen.image_bytes("text/html", b"<html>throttled</html>")
            bad = False
        except SystemExit:
            bad = True
        check("gen: picture replies (raw, base64 JSON, data URL; HTML refused)", got == [png] * 3 and bad)
        body, ct = gen.image_request("flux2", "a cloud", 512, 512, seed=7)
        sch, _ = gen.image_request("schnell", "a cloud", 1024, 1024, seed=7)
        ok = ct.startswith("multipart/form-data; boundary=") and b'name="seed"\r\n\r\n7\r\n' in body and b'name="prompt"' in body \
            and "seed" not in json.loads(sch)
        check("gen: FLUX.2 multipart with seed; Schnell without", ok)
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "k.env").write_text('# keys\nexport CLOUDFLARE_ACCOUNT_ID=abc\nCLOUDFLARE_AI_API_TOKEN="tok en#1"\nX=1 # note\n', encoding="utf-8")
            env = gen.read_env(Path(td) / "k.env")
        ok = env == {"CLOUDFLARE_ACCOUNT_ID": "abc", "CLOUDFLARE_AI_API_TOKEN": "tok en#1", "X": "1"} \
            and "secret" not in gen.mask("CLOUDFLARE_AI_API_TOKEN", "cfut-secret-123456")
        check("gen: .env keys (export, quotes, comments) and masking", ok, str(env))
        quota = transient = False
        try:
            gen.cf_error(429, json.dumps({"errors": [{"code": 3036, "message": "daily free allocation"}]}).encode())
        except SystemExit as e:
            quota = "quota" in str(e)
        try:
            gen.cf_error(200, json.dumps({"success": False, "errors": [{"code": 3040, "message": "out of capacity"}]}).encode())
        except gen.Transient:
            transient = True
        check("gen: quota is final, 'no capacity' is retried", quota and transient)
        # lyrics timing: the user's text keeps, the voice gives times; a misheard word sits between neighbours
        lines = ["Hermes came down at night", "Gonna give the spark away"]
        heard = [(0.5, 0.9, "Hermes"), (1.0, 1.2, "came"), (1.25, 1.5, "down"), (1.6, 1.7, "at"), (1.8, 2.2, "night"),
                 (3.0, 3.3, "going"), (3.4, 3.6, "give"), (3.7, 3.8, "the"), (3.9, 4.3, "spark"), (4.4, 4.9, "away")]
        timed = gen.align_words(lines, heard)
        with tempfile.TemporaryDirectory() as td:
            gen.write_lrc(Path(td) / "s.lrc", list(zip(lines, timed)))
            back = _lyrics.read_lrc(Path(td) / "s.lrc")
        ok = [(l["t"], l["text"]) for l in back] == [(0.5, "Hermes came down at night"), (3.4, "Gonna give the spark away")] \
            and back[1]["words"][0] == [3.4, "Gonna"] and back[0]["words"][-1] == [1.8, "night"]
        check("gen: voice -> lyric line times (enhanced LRC, first word kept)", ok, str([(l["t"], l["text"]) for l in back]))
        # fal: price estimates from unit prices, every file of a result, data URIs cut when printed
        est = [gen.estimate({"unit": "megapixels", "unit_price": 0.01}, {"image_size": {"width": 1000, "height": 2000}}, 2)[0],
               gen.estimate({"unit": "seconds", "unit_price": 0.14}, {"duration": "5"})[0],
               gen.estimate({"unit": "seconds", "unit_price": 0.14}, {})[0],
               gen.estimate({"unit": "images", "unit_price": 0.03}, {}, 3)[0],
               gen.estimate({"unit": "units", "unit_price": 1}, {})[0]]
        ok = [round(x, 4) if x is not None else None for x in est] == [0.04, 0.7, None, 0.09, None]
        check("gen: fal price estimates (MP, seconds, images; unknown stays unknown)", ok, str(est))
        res = {"images": [{"url": "https://x.fal.media/a.png", "content_type": "image/png", "width": 8},
                          {"url": "https://x.fal.media/b.png", "content_type": "image/png", "width": 8}],
               "video": {"url": "https://x.fal.media/c.mp4", "content_type": "video/mp4"}, "seed": 5, "prompt": "https://not-a-file"}
        urls = gen.media_urls(res)
        ok = [u for u, _ in urls] == ["https://x.fal.media/a.png", "https://x.fal.media/b.png", "https://x.fal.media/c.mp4"] \
            and [gen.ext_for(k, u) for u, k in urls] == [".png", ".png", ".mp4"] \
            and len(json.dumps(gen.short({"image_url": "data:image/png;base64," + "A" * 5000}))) < 120
        check("gen: fal result files and printable inputs", ok)
    except Exception as e:  # noqa: BLE001
        check("gen: offline checks", False, repr(e))

    # song: parts and lines on the demo song with known answers
    if not a.quick:
        try:
            import numpy as np
            import demo_song, song
            with tempfile.TemporaryDirectory() as td:
                proj = Path(td)
                (proj / "audio").mkdir()
                mix, voice, text, truth = demo_song.build()
                demo_song.write_wav(proj / "audio/song.wav", mix)
                demo_song.write_wav(proj / "audio/vocals.wav", voice)
                (proj / "audio/lyrics.txt").write_text(text, encoding="utf-8")
                _lyrics.write_lrc(proj / "audio/truth.lrc", truth["lines"], word_times=True)
                ts = np.array([s["t"] for s in truth["sections"]])
                runs_ = [("stem", {"lyrics": "audio/lyrics.txt", "vocals": "audio/vocals.wav"}, truth["beat"]),
                         ("no stem", {"lyrics": "audio/lyrics.txt"}, truth["bar"]),
                         ("LRC", {"lyrics": "audio/lyrics.txt", "lrc": "audio/truth.lrc"}, 0.02),
                         ("music only", {}, None)]
                for name, kw, tol in runs_:
                    info, lines, *_ = song.analyse(proj, "audio/song.wav", **kw)
                    got = [s["id"] for s in info["sections"]]
                    st = np.array([s["t"] for s in info["sections"]])
                    serr = max(np.min(np.abs(st - t)) for t in ts[1:]) / truth["bar"]
                    ok = got == ["intro1", "verse1", "chorus1", "verse2", "chorus2", "outro1"] and serr < 0.5
                    detail = f"{' '.join(got)}"
                    if tol is not None:
                        lerr = max(abs(l["t"] - t["t"]) for l, t in zip(lines, truth["lines"]))
                        ok = ok and len(lines) == len(truth["lines"]) and lerr <= tol
                        detail += f"; lines max error {lerr * 1000:.0f} ms"
                    check(f"song: demo parts + lines ({name})", ok, detail)
        except Exception as e:  # noqa: BLE001
            check("song: demo song analysis", False, repr(e))

    # audio build in a fresh project
    if not a.quick:
        with tempfile.TemporaryDirectory() as td:
            proj = Path(td) / "p"
            sh = os.environ.get("CARTOON_BASH") or shutil.which("bash")  # on Windows PATH's bash may be WSL's
            r = subprocess.run([sh, str(HERE / "new_project.sh"), str(proj), "--duration", "4"], capture_output=True, text=True, encoding="utf-8", errors="replace")
            mm = re.search(r"integrated (-?[\d.]+) LUFS", r.stdout)
            ok = r.returncode == 0 and (proj / "audio/mix.wav").exists() and mm and abs(float(mm.group(1)) + 15) <= 1
            check("new project + soundtrack (-15 LUFS)", bool(ok), (mm.group(0) if mm else (r.stderr or r.stdout)[-200:]))

    for n in notes:
        print("  note  " + n)
    print("RESULT: " + ("pass" if not fails else f"FAIL ({len(fails)})"))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
