#!/usr/bin/env python3
"""Generative services: pictures, text (LLMs, a look at a picture), speech, lyrics timing from a voice.

  cartoon gen keys [--from OTHER/.env]          which services have keys (masked); --from copies known keys
  cartoon gen models [image|text|vision|speech|asr|video] [--service fal] [--q words]   the live catalogues
  cartoon gen info fal-ai/z-image/base          a fal model: input fields, defaults, price (its llms.txt)
  cartoon gen image "prompt" refs/sky.png [--model klein9 | fal-ai/z-image/base] [--aspect 16:9 | --size 1920x1088]
                    [--seed 7] [--n 4] [--ref in.png ...] [--steps N] [--negative "..."] [--param k=v] [--yes] [--no-cache]
  cartoon gen video "prompt" out.mp4 --model fal-ai/kling-video/v3/standard/text-to-video [--image first.png]
                    [--seconds 5] [--aspect 16:9] [--param k=v] [--yes]
  cartoon gen fal <model> OUT [-p k=v ...] [--input in.json] [--yes]   any fal model (speech, upscale, 3D...)
  cartoon gen text "prompt" [--model gpt-oss] [--system "..."] [--image frame.png ...] [--json] [-o out.txt]
  cartoon gen speech "text" audio/voice/x.wav [--model aura-2-en --voice luna]   (or "engine": "cloud" in cues.js voice)
  cartoon gen transcribe audio/vocals.wav [--lyrics lyrics.txt] [--lang ru] [-o audio/song.lrc]

"prompt" may be @file.txt or - (stdin). Services:
  cloudflare  Workers AI: FLUX.2 / FLUX.1 / SDXL / Leonardo pictures, ~40 LLMs (some see pictures), Whisper with
              word times, Deepgram Aura and MeloTTS speech. 10 000 free "neurons" a day per account, then
              paid. Keys: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_AI_API_TOKEN (a token with Workers AI Read + Edit).
  fal         fal.ai: hundreds of image, video, speech, 3D models, all paid from prepaid credits. Key: FAL_KEY.
              A fal call without --yes only prints the model, the input and the estimated price, and exits 3:
              the user agrees first (references/generate.md).
  openai      any OpenAI-compatible chat API (OpenRouter, Groq, a local Ollama or LM Studio) for `text`:
              CARTOON_LLM_BASE_URL (e.g. http://localhost:11434/v1), CARTOON_LLM_API_KEY, CARTOON_LLM_MODEL.
Keys are read from the environment, then ./.env (the project; never commit it), then
~/.config/code-cartoon/keys.env (CARTOON_KEYS overrides the path). They are never printed.

Pictures are cached in ~/.cache/code-cartoon/gen (the same request costs nothing twice) and recorded:
OUT.json beside the picture and a line in SOURCES.md of its folder (service, model, seed, prompt, terms).
More: references/generate.md.
"""
import argparse, base64, hashlib, json, os, random, re, subprocess, sys, tempfile, time, uuid
import urllib.error, urllib.request
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = Path(os.environ.get("CARTOON_GEN_CACHE", Path.home() / ".cache" / "code-cartoon" / "gen"))
KEYS_FILE = Path(os.environ.get("CARTOON_KEYS", Path.home() / ".config" / "code-cartoon" / "keys.env"))
KEY_NAMES = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_AI_API_TOKEN", "FAL_KEY", "CARTOON_LLM_BASE_URL", "CARTOON_LLM_API_KEY", "CARTOON_LLM_MODEL"]
SECRET = {"CLOUDFLARE_AI_API_TOKEN", "FAL_KEY", "CARTOON_LLM_API_KEY"}


class GenError(SystemExit):
    pass


# ---------------------------------------------------------------- keys
def read_env(path):
    out = {}
    try:
        for raw in Path(path).read_text(encoding="utf-8-sig").splitlines():
            mo = re.match(r"\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", raw)
            if mo and not raw.lstrip().startswith("#"):
                v = mo.group(2).strip()
                if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                    v = v[1:-1]
                else:
                    v = re.sub(r"\s+#.*$", "", v)
                out[mo.group(1)] = v
    except OSError:
        pass
    return out


def keys():
    """{name: (value, where)} for the known key names: environment > ./.env > the user's keys file"""
    found = {}
    for where, src in (("environment", os.environ), ("./.env", read_env(".env")), (str(KEYS_FILE), read_env(KEYS_FILE))):
        for n in KEY_NAMES + ["CLOUDFLARE_API_TOKEN"]:
            if src.get(n) and n not in found:
                found[n] = (src[n], where)
    if "CLOUDFLARE_AI_API_TOKEN" not in found and "CLOUDFLARE_API_TOKEN" in found:
        found["CLOUDFLARE_AI_API_TOKEN"] = found["CLOUDFLARE_API_TOKEN"]
    return found


def mask(name, v):
    return (v[:4] + "..." + v[-3:] if len(v) > 10 else "...") if name in SECRET else v


# ---------------------------------------------------------------- http
def multipart(fields, files=()):
    """fields {name: value}, files [(name, filename, bytes, type)] -> (body, content type)"""
    b = "----cartoon" + uuid.uuid4().hex
    out = bytearray()
    for k, v in fields.items():
        out += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for k, fn, data, ct in files:
        out += f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{fn}"\r\nContent-Type: {ct}\r\n\r\n'.encode()
        out += data + b"\r\n"
    out += f"--{b}--\r\n".encode()
    return bytes(out), f"multipart/form-data; boundary={b}"


def post(url, token, body, ctype, timeout=300):
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Authorization": f"Bearer {token}", "Content-Type": ctype, "User-Agent": "code-cartoon-gen"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.headers.get("Content-Type", ""), r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type", ""), e.read()
    except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
        return 0, "", str(e).encode()


def get(url, token):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "User-Agent": "code-cartoon-gen"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")


class Transient(Exception):
    pass


def cf_error(status, data):
    """a Cloudflare error -> a message (raises Transient when a retry may help)"""
    try:
        env = json.loads(data)
        errs = env.get("errors") or []
    except ValueError:
        env, errs = {}, []
    codes = {e.get("code") for e in errs if isinstance(e, dict)}
    msg = "; ".join(f"{e.get('code')}: {e.get('message')}" for e in errs if isinstance(e, dict)) or data[:300].decode("utf-8", "replace")
    if 3036 in codes:
        raise GenError("cloudflare: the free daily quota (10 000 neurons) is used up; it resets at 00:00 UTC, "
                       "or turn on the paid plan in the dashboard (Workers AI)")
    if status in (401, 403) or 10000 in codes:
        raise GenError(f"cloudflare: the token was refused ({status}): it needs Workers AI Read + Edit for this account. {msg}")
    if status == 0 or status == 429 or status >= 500 or 3040 in codes:
        raise Transient(f"status {status}: {msg}")
    raise GenError(f"cloudflare: status {status}: {msg}")


# ---------------------------------------------------------------- services
class Cloudflare:
    name = "cloudflare"
    tasks = {"image", "text", "vision", "speech", "asr"}
    TASKS = {"image": "Text-to-Image", "text": "Text Generation", "speech": "Text-to-Speech",
             "asr": "Automatic Speech Recognition", "vision": "Text Generation"}

    def __init__(self, k):
        if "CLOUDFLARE_ACCOUNT_ID" not in k or "CLOUDFLARE_AI_API_TOKEN" not in k:
            raise GenError("cloudflare: no keys. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_TOKEN in "
                           f"{KEYS_FILE} (or the environment); see: cartoon gen keys")
        self.base = f"https://api.cloudflare.com/client/v4/accounts/{k['CLOUDFLARE_ACCOUNT_ID'][0]}/ai"
        self.token = k["CLOUDFLARE_AI_API_TOKEN"][0]

    def run(self, model, body, ctype="application/json", tries=3):
        """POST /ai/run/<model>, retrying 'no capacity' and 5xx; -> (content type, bytes)"""
        if isinstance(body, dict):
            body = json.dumps(body).encode()
        wait = 2.0
        for i in range(tries):
            status, ct, data = post(f"{self.base}/run/{model}", self.token, body, ctype)
            if status == 200 and not ("json" in ct and b'"success":false' in data.replace(b" ", b"")):
                return ct, data
            try:
                cf_error(status, data)
            except Transient as e:
                if i == tries - 1:
                    raise GenError(f"cloudflare: {model}: {e} (tried {tries} times)")
                print(f"  ({e}; again in {wait:.0f} s)", file=sys.stderr)
                time.sleep(wait)
                wait *= 2

    def chat(self, model, messages, **kw):
        return chat_openai(f"{self.base}/v1", self.token, model, messages, **kw, err=cf_error)

    def models(self):
        d = get(f"{self.base}/models/search?per_page=500", self.token)
        if not d.get("success"):
            cf_error(401 if d.get("errors") else 0, json.dumps(d).encode())
        return d["result"]


class OpenAICompat:
    name = "openai"
    tasks = {"text", "vision"}

    def __init__(self, k):
        if "CARTOON_LLM_BASE_URL" not in k:
            raise GenError("openai: set CARTOON_LLM_BASE_URL (and CARTOON_LLM_API_KEY, CARTOON_LLM_MODEL); see cartoon gen keys")
        self.base = k["CARTOON_LLM_BASE_URL"][0].rstrip("/")
        self.token = k.get("CARTOON_LLM_API_KEY", ("none", ""))[0]
        self.default = k.get("CARTOON_LLM_MODEL", ("", ""))[0]

    def chat(self, model, messages, **kw):
        return chat_openai(self.base, self.token, model, messages, **kw)

    def models(self):
        d = get(f"{self.base}/models", self.token)
        return [{"name": m.get("id"), "task": {"name": "Text Generation"}, "description": ""} for m in d.get("data", [])]


class Fal:
    """fal.ai: hundreds of models behind one key (FAL_KEY), every call paid from prepaid credits.
    A model is an endpoint id ("fal-ai/z-image/base"); its schema and price: fal.ai/models/<id>/llms.txt"""
    name = "fal"
    tasks = {"image", "video", "any"}
    API = "https://api.fal.ai/v1"

    def __init__(self, k):
        if "FAL_KEY" not in k:
            raise GenError(f"fal: no key. Put FAL_KEY=... into {KEYS_FILE} (fal.ai/dashboard/keys); see cartoon gen keys")
        self.token = k["FAL_KEY"][0]

    def _req(self, url, body=None):
        req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(),
                                     method="GET" if body is None else "POST",
                                     headers={"Authorization": f"Key {self.token}", "Content-Type": "application/json",
                                              "User-Agent": "code-cartoon-gen"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.status, json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                return e.code, json.loads(raw)
            except ValueError:
                return e.code, {"detail": raw[:300].decode("utf-8", "replace")}
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            return 0, {"detail": str(e)}

    def fail(self, status, d, what):
        detail = d.get("detail") if isinstance(d, dict) else d
        if isinstance(detail, list):        # 422: [{"loc": [...], "msg": ...}]
            detail = "; ".join(f"{'.'.join(map(str, x.get('loc', [])[1:]))}: {x.get('msg')}" for x in detail if isinstance(x, dict))
        if status in (401, 403):
            raise GenError(f"fal: the key was refused ({status}): {detail}")
        if status == 402 or "balance" in str(detail).lower() or "locked" in str(detail).lower():
            raise GenError(f"fal: no credits left ({status}): {detail}. Top up at fal.ai/dashboard/billing")
        raise GenError(f"fal: {what}: status {status}: {detail}  (the schema: cartoon gen info <model>)")

    def run(self, endpoint, inp, timeout=1800):
        """the queue: submit, wait, fetch the result -> (result, request id)"""
        st, d = self._req(f"https://queue.fal.run/{endpoint}", inp)
        if st not in (200, 201, 202) or "request_id" not in d:
            self.fail(st, d, endpoint)
        rid, t0, last = d["request_id"], time.time(), ""
        status_url, response_url = d.get("status_url"), d.get("response_url")
        while True:
            st, s = self._req(status_url)
            state = s.get("status", "") if st in (200, 202) else ""
            if state == "COMPLETED":
                break
            if st not in (200, 202) and st != 0:
                self.fail(st, s, f"{endpoint} status")
            if state != last:
                print(f"  fal: {state.lower().replace('_', ' ') or 'waiting'}" + (f" (#{s['queue_position']})" if s.get("queue_position") else ""), file=sys.stderr)
                last = state
            if time.time() - t0 > timeout:
                raise GenError(f"fal: {endpoint} is not done after {timeout} s (request {rid}: it is still billed if it finishes)")
            time.sleep(1.5 if time.time() - t0 < 30 else 5)
        st, res = self._req(response_url)
        if st != 200:
            self.fail(st, res, f"{endpoint} result")
        return res, rid

    def price(self, endpoint):
        st, d = self._req(f"{self.API}/models/pricing?endpoint_id={urllib.request.quote(endpoint, safe='/')}")
        ps = d.get("prices") or [] if st == 200 else []
        return ps[0] if ps else None

    def search(self, q=None, category=None, limit=30):
        qs = "&".join(f"{k}={urllib.request.quote(str(v))}" for k, v in (("q", q), ("category", category), ("limit", limit), ("sort", "relevant")) if v)
        st, d = self._req(f"{self.API}/models?{qs}")
        if st != 200:
            self.fail(st, d, "search")
        return [m for m in d.get("models", []) if (m.get("metadata") or {}).get("status", "active") == "active"]

    def models(self):
        return [{"name": m["endpoint_id"], "task": {"name": m["metadata"].get("category", "")}, "description": m["metadata"].get("description", "")}
                for m in self.search(limit=100)]


PROVIDERS = {"cloudflare": Cloudflare, "openai": OpenAICompat, "fal": Fal}


# ---------------------------------------------------------------- fal: schema, price, the paid-call guard
def fal_info(endpoint, refresh=False):
    """the model's llms.txt (schema, defaults, price); cached for a day"""
    p = CACHE / "fal-info" / (re.sub(r"[^\w.-]+", "_", endpoint) + ".txt")
    if p.exists() and not refresh and time.time() - p.stat().st_mtime < 86400:
        return p.read_text(encoding="utf-8")
    req = urllib.request.Request(f"https://fal.ai/models/{endpoint}/llms.txt", headers={"User-Agent": "code-cartoon-gen"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            text = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        raise GenError(f"fal: no model '{endpoint}' ({e.code}); find one: cartoon gen models --service fal --q ...")
    if "## Overview" not in text and "Input Schema" not in text:
        raise GenError(f"fal: no model '{endpoint}' (find one: cartoon gen models --service fal --q ...)")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return text


def fal_summary(text):
    """the parts of a model's llms.txt worth reading before a call: overview, pricing, input schema"""
    keep, out = False, []
    for line in text.splitlines():
        if line.startswith("## ") or line.startswith("### "):
            keep = any(s in line for s in ("Overview", "Pricing", "Input Schema"))
        if keep and line.strip() and not line.startswith("For more details"):
            out.append(line)
    return "\n".join(out)


def estimate(price, inp, n=1):
    """(dollars or None, how) from a fal unit price and the input of a call"""
    if not price:
        return None, "no price listed"
    u, p = price.get("unit", ""), float(price.get("unit_price", 0))
    size = inp.get("image_size")
    if "megapixel" in u:
        mp = size["width"] * size["height"] / 1e6 if isinstance(size, dict) else 1.0
        return p * mp * n, f"${p:g}/MP x {mp:.2f} MP x {n}" + ("" if isinstance(size, dict) else " (preset size: ~1 MP assumed)")
    if u.startswith("image"):
        return p * n, f"${p:g}/image x {n}"
    if "second" in u:
        secs = next((float(str(inp[k]).rstrip("s")) for k in ("duration", "seconds", "num_seconds", "duration_seconds") if k in inp), None)
        if secs is None:
            return None, f"${p:g}/second x the model's default length (pass --param duration=...)"
        return p * secs * n, f"${p:g}/s x {secs:g} s x {n}"
    if u.startswith("video"):
        return p * n, f"${p:g}/video x {n}"
    return None, f"${p:g} per {u}: priced by tokens or compute, see cartoon gen info"


def guard(fal, endpoint, inp, n, yes):
    """fal is always paid: without --yes, say what it would cost and stop"""
    price = fal.price(endpoint)
    cost, how = estimate(price, inp, n)
    line = f"fal {endpoint}: " + (f"~${cost:.3f}" if cost is not None else "price unknown") + f"  ({how})"
    if not yes:
        print(f"PAID CALL, not sent: {line}\n  input: {json.dumps(short(inp), ensure_ascii=False)[:400]}\n"
              "  Ask the user (model, count, price), then run the same command with --yes.")
        raise SystemExit(3)
    print(f"  {line}")
    return cost, how


def short(v):
    """an input for printing: data URIs cut"""
    if isinstance(v, dict):
        return {k: short(x) for k, x in v.items()}
    if isinstance(v, list):
        return [short(x) for x in v]
    if isinstance(v, str) and v.startswith("data:"):
        return v[:30] + "...(" + str(len(v)) + " chars)"
    return v


def media_urls(res):
    """every file in a fal result: [(url, content type or file name)]"""
    out = []
    if isinstance(res, dict):
        if isinstance(res.get("url"), str) and res["url"].startswith("http") and ("content_type" in res or "file_name" in res or "width" in res):
            out.append((res["url"], res.get("content_type") or res.get("file_name") or ""))
        else:
            for v in res.values():
                out += media_urls(v)
    elif isinstance(res, list):
        for v in res:
            out += media_urls(v)
    return out


def fetch(url):
    """download a result file. Some Pythons (Windows) lack the CA of a CDN: then certifi, then curl"""
    req = urllib.request.Request(url, headers={"User-Agent": "code-cartoon-gen"})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return r.read()
    except urllib.error.URLError as e:
        if "CERTIFICATE_VERIFY_FAILED" not in str(e):
            raise
    try:
        import ssl, certifi
        with urllib.request.urlopen(req, timeout=600, context=ssl.create_default_context(cafile=certifi.where())) as r:
            return r.read()
    except ImportError:
        pass
    p = subprocess.run(["curl", "-sfL", "--max-time", "600", url], capture_output=True)
    if p.returncode or not p.stdout:
        raise GenError(f"cannot download {url} (certificate check failed; curl: {p.returncode}). pip install certifi")
    return p.stdout


EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "video/mp4": ".mp4", "audio/mpeg": ".mp3",
       "audio/wav": ".wav", "audio/x-wav": ".wav", "model/gltf-binary": ".glb", "video/webm": ".webm"}


def ext_for(kind, url):
    if kind in EXT:
        return EXT[kind]
    m = re.search(r"\.(\w{2,5})$", kind or "") or re.search(r"\.(\w{2,5})(?:\?|$)", url)
    return "." + m.group(1).lower() if m else ".bin"


def param_value(v):
    try:
        return json.loads(v)
    except ValueError:
        return v


def fal_call(endpoint, inp, out, n=1, yes=False, no_cache=False, meta=None):
    """run a fal model (cached by its input), save every file it returns as OUT[-i].ext, record them"""
    fal = provider("fal")
    key = hashlib.sha1(json.dumps([endpoint, inp], sort_keys=True).encode()).hexdigest()
    cdir = CACHE / f"fal-{key}"
    cost = how = rid = None
    if (cdir / "result.json").exists() and not no_cache:
        saved = json.loads((cdir / "result.json").read_text(encoding="utf-8"))
        res, rid, cost, how = saved["result"], saved.get("request"), saved.get("cost"), saved.get("how")
        print("  (cached: no call, no cost)")
    else:
        cost, how = guard(fal, endpoint, inp, n, yes)
        t0 = time.time()
        res, rid = fal.run(endpoint, inp)
        cdir.mkdir(parents=True, exist_ok=True)       # paid for: keep the answer before anything else can fail
        (cdir / "result.json").write_text(json.dumps({"result": res, "request": rid, "cost": cost, "how": how},
                                                     ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  fal: done in {time.time() - t0:.0f} s, request {rid}")
    files = []
    for i, (u, kind) in enumerate(media_urls(res)):
        f = cdir / f"file-{i:02d}{ext_for(kind, u)}"
        if not f.exists():
            try:
                f.write_bytes(fetch(u))
            except (GenError, OSError, urllib.error.URLError) as e:
                raise GenError(f"fal: the result is paid for and kept, but a file did not download ({e}). "
                               "Run the same command again: it downloads without a new call")
        files.append(f)
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    stem = out.with_suffix("") if out.suffix else out
    made = []
    for i, f in enumerate(files):
        dst = Path(f"{stem}{'' if len(files) == 1 else '-' + str(i + 1)}{f.suffix}")
        dst.write_bytes(f.read_bytes())
        made.append(dst)
        m = dict(meta or {}, service="fal", model=endpoint, input=short(inp), request=rid,
                 cost_estimate=round(cost, 4) if cost is not None else None, cost_how=how, date=date.today().isoformat())
        record_any(dst, m)
        print(f"  {dst}")
    if not files:
        print(json.dumps(short(res), ensure_ascii=False, indent=1)[:3000])
    return made, res


def record_any(out, meta):
    """OUT.json + a SOURCES.md line for any generated file"""
    out = Path(out)
    out.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    inp = meta.get("input") or {}
    src = out.parent / "SOURCES.md"
    line = (f"- `{out.name}` — generated {meta['date']}: {meta['service']} `{meta['model']}`"
            + (f", seed {inp['seed']}" if "seed" in inp else "")
            + (f", ~${meta['cost_estimate']}" if meta.get("cost_estimate") is not None else "")
            + (f"; prompt: \"{str(inp['prompt'])[:300]}\"" if inp.get("prompt") else "") + "\n")
    old = src.read_text(encoding="utf-8") if src.exists() else "# Sources\n\n"
    old = "".join(l + "\n" for l in old.splitlines() if not l.startswith(f"- `{out.name}` — generated "))
    src.write_bytes((old + line).encode("utf-8"))


def is_fal(model):
    return bool(model) and "/" in model and not model.startswith("@")


def provider(name=None, task=None):
    k = keys()
    if name:
        return PROVIDERS[name](k)
    for cls in PROVIDERS.values():
        if task in cls.tasks:
            try:
                return cls(k)
            except GenError:
                continue
    have = [n for n, c in PROVIDERS.items() if task in c.tasks]
    if not have:
        raise GenError(f"no service for '{task}' yet (services: {', '.join(PROVIDERS)}); see references/generate.md")
    raise GenError(f"no keys for {' or '.join(have)}: see cartoon gen keys")


def chat_openai(base, token, model, messages, max_tokens=2000, temperature=None, json_mode=False, err=None):
    body = {"model": model, "messages": messages, "max_tokens": max_tokens}
    if temperature is not None:
        body["temperature"] = temperature
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    wait = 2.0
    for i in range(3):
        status, ct, data = post(f"{base}/chat/completions", token, json.dumps(body).encode(), "application/json")
        if status == 200:
            d = json.loads(data)
            m = d["choices"][0]["message"]
            text = m.get("content") or ""
            if not text and m.get("reasoning_content"):
                raise GenError(f"{model}: only reasoning came back (raise --max-tokens): {m['reasoning_content'][:200]}")
            return text, d.get("usage", {})
        try:
            (err or generic_error)(status, data)
        except Transient as e:
            if i == 2:
                raise GenError(f"{model}: {e}")
            time.sleep(wait)
            wait *= 2


def generic_error(status, data):
    if status == 0 or status == 429 or status >= 500:
        raise Transient(f"status {status}")
    raise GenError(f"status {status}: {data[:300].decode('utf-8', 'replace')}")


# ---------------------------------------------------------------- pictures
# name: (model id, how to ask, max side, what it takes). Any "@cf/..." id works too (sent as JSON).
# Tested 2026-10-17: only klein9 gives the same picture for the same seed; the others draw anew every call
# (the cache in ~/.cache/code-cartoon/gen is what keeps a picture then).
IMAGE = {
    "klein9":  ("@cf/black-forest-labs/flux-2-klein-9b", "flux2", 1920, "default: fast, the seed repeats a picture; up to 4 --ref"),
    "klein":   ("@cf/black-forest-labs/flux-2-klein-4b", "flux2", 1920, "the small Klein; the seed is ignored; --ref"),
    "flux2":   ("@cf/black-forest-labs/flux-2-dev", "flux2", 1920, "FLUX.2 dev: slower; the seed is ignored; --ref"),
    "schnell": ("@cf/black-forest-labs/flux-1-schnell", "schnell", 1024, "square 1024 only, no seed"),
    "sdxl-lightning": ("@cf/bytedance/stable-diffusion-xl-lightning", "sdxl", 2048, "sizes, negative; looks dated; the seed is ignored"),
    "sdxl":    ("@cf/stabilityai/stable-diffusion-xl-base-1.0", "sdxl", 2048, "sizes, negative; slow"),
    "lucid":   ("@cf/leonardo/lucid-origin", "leonardo", 2500, "Leonardo: photographic; its own terms; more neurons"),
    "phoenix": ("@cf/leonardo/phoenix-1.0", "leonardo", 2048, "Leonardo: good with text in pictures; its own terms"),
}
ASPECT = {"1:1": (1, 1), "16:9": (16, 9), "9:16": (9, 16), "4:3": (4, 3), "3:4": (3, 4), "4:5": (4, 5), "5:4": (5, 4),
          "3:2": (3, 2), "2:3": (2, 3), "21:9": (21, 9)}


def dims(aspect="1:1", size=None, max_side=1920, mp=1.0):
    """an aspect or WxH -> (w, h): multiples of 16, about `mp` megapixels, no side over max_side"""
    if size:
        w, h = (int(v) for v in size.lower().split("x"))
    else:
        a, b = ASPECT.get(aspect) or tuple(float(v) for v in aspect.split(":"))
        h = (mp * 1e6 * b / a) ** 0.5
        w = h * a / b
    k = min(1.0, max_side / max(w, h))
    return int(w * k) // 16 * 16, int(h * k) // 16 * 16


def image_request(kind, prompt, w, h, seed=None, steps=None, negative=None, refs=()):
    """-> (body, content type) for one picture"""
    if kind == "flux2":
        f = {"prompt": prompt, "width": w, "height": h}      # steps are fixed (4) in the distilled Klein
        if seed is not None:
            f["seed"] = seed
        if len(refs) > 4:
            raise GenError("FLUX.2 takes up to 4 --ref pictures")
        return multipart(f, [(f"input_image_{i}", f"ref{i}.png", small_png(r), "image/png") for i, r in enumerate(refs)])
    if refs:
        raise GenError("--ref works with the FLUX.2 models (klein, klein9, flux2)")
    if kind == "schnell":
        body = {"prompt": prompt[:2048], "steps": min(8, steps or 4)}
    elif kind == "sdxl":
        body = {"prompt": prompt, "width": w, "height": h, "num_steps": min(20, steps or 8)}
        if negative:
            body["negative_prompt"] = negative
    else:
        body = {"prompt": prompt, "width": w, "height": h}
        if steps:
            body["steps"] = steps
    if seed is not None and kind != "schnell":
        body["seed"] = seed
    return json.dumps(body).encode(), "application/json"


def small_png(path, side=511):
    """a reference picture under 512x512 (FLUX.2 on Workers AI wants them smaller)"""
    try:
        from io import BytesIO
        from PIL import Image
    except ImportError:
        raise GenError("--ref needs Pillow: pip install pillow")
    im = Image.open(path).convert("RGB")
    im.thumbnail((side, side), Image.LANCZOS)
    buf = BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def image_bytes(ct, data):
    """a reply (raw PNG/JPEG, or JSON with base64 'image') -> picture bytes"""
    if "json" not in ct and data[:1] != b"{":
        if not (data[:8] == b"\x89PNG\r\n\x1a\n" or data[:3] == b"\xff\xd8\xff" or data[:4] == b"RIFF"):
            raise GenError(f"the reply is not a picture ({ct}, {len(data)} bytes)")
        return data
    d = json.loads(data)
    b64 = (d.get("result") or {}).get("image") if isinstance(d.get("result"), dict) else None
    b64 = b64 or d.get("image")
    if not b64:
        raise GenError(f"no picture in the reply: {data[:200]!r}")
    if b64.startswith("data:"):
        b64 = b64.split(",", 1)[1]
    return base64.b64decode(b64)


def ext_of(data):
    return ".png" if data[:4] == b"\x89PNG" else ".webp" if data[:4] == b"RIFF" else ".jpg"


def cached(key, make):
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / f"{key}.bin"
    if p.exists():
        return p.read_bytes(), True
    data = make()
    p.write_bytes(data)
    return data, False


def record(out, meta):
    """OUT.json beside the picture + a line in SOURCES.md of its folder"""
    out = Path(out)
    out.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    src = out.parent / "SOURCES.md"
    line = (f"- `{out.name}` — generated {meta['date']}: {meta['service']} `{meta['model']}`, seed {meta.get('seed')}"
            f"{'' if meta.get('seed_repeats') else ' (the model ignores it: keep the file)'}, "
            f"{meta['width']}x{meta['height']}; prompt: \"{meta['prompt'][:300]}\"" + (f"; refs: {', '.join(meta['refs'])}" if meta.get("refs") else "") + "\n")
    old = src.read_text(encoding="utf-8") if src.exists() else "# Sources\n\n"
    old = "".join(l + "\n" for l in old.splitlines() if not l.startswith(f"- `{out.name}` — generated "))
    src.write_text(old + line, encoding="utf-8")


def cmd_image(a):
    prompt = read_prompt(a.prompt)
    if is_fal(a.model):
        w, h = dims(a.aspect, a.size, 3840)
        inp = {"prompt": prompt, "image_size": {"width": w, "height": h}}
        if a.n > 1:
            inp["num_images"] = a.n
        if a.seed is not None:
            inp["seed"] = a.seed
        if a.negative:
            inp["negative_prompt"] = a.negative
        if a.steps:
            inp["num_inference_steps"] = a.steps
        if a.ref:
            inp["image_urls"] = [data_url(r) for r in a.ref]
        for kv in a.param:
            k, _, v = kv.partition("=")
            inp[k] = param_value(v)
        made, _ = fal_call(a.model, inp, a.out, a.n, a.yes, a.no_cache)
        if len(made) > 1:
            pick(made, Path(a.out).with_name(f"{Path(a.out).stem}-pick.jpg"))
        return
    if a.param or a.yes:
        print("  (--param / --yes are for fal models; ignored)", file=sys.stderr)
    model, kind, side, _ = IMAGE.get(a.model, (a.model, "json", 2048, ""))
    seeded = a.model == "klein9"
    if a.model not in IMAGE and not a.model.startswith("@"):
        raise GenError(f"unknown picture model '{a.model}': {', '.join(IMAGE)} or a full @cf/... id")
    w, h = (1024, 1024) if kind == "schnell" else dims(a.aspect, a.size, side)
    cf = provider("cloudflare")
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    seed0 = a.seed if a.seed is not None else random.randrange(1, 2**31)
    refsum = [hashlib.sha1(Path(r).read_bytes()).hexdigest()[:12] for r in a.ref]
    made = []
    for i in range(a.n):
        seed = None if kind == "schnell" else seed0 + i
        body, ct = image_request(kind, prompt, w, h, seed, a.steps, a.negative, a.ref)
        key = hashlib.sha1(json.dumps([model, prompt, w, h, seed, a.steps, a.negative, refsum]).encode()).hexdigest()
        t0 = time.time()
        make = lambda: image_bytes(*cf.run(model, body, ct))  # noqa: E731
        data, hit = (make(), False) if a.no_cache else cached(key, make)
        dst = out if a.n == 1 else out.with_name(f"{out.stem}-{seed if seed is not None else i}{out.suffix}")
        if dst.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp") or ext_of(data) == ".png" and dst.suffix.lower() != ".png":
            dst = dst.with_suffix(ext_of(data))
        dst.write_bytes(data)
        record(dst, {"service": "cloudflare", "model": model, "prompt": prompt, "seed": seed, "seed_repeats": seeded, "width": w, "height": h,
                     "steps": a.steps, "negative": a.negative, "refs": [str(r) for r in a.ref], "date": date.today().isoformat()})
        made.append(dst)
        print(f"  {dst}  {w}x{h}  seed {seed}  {'(cached)' if hit else f'{time.time() - t0:.1f} s'}")
    if len(made) > 1:
        pick(made, out.with_name(f"{out.stem}-pick.jpg"))


def pick(paths, dst):
    """the variants side by side with their names: choose one, rename it"""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return
    ims = [Image.open(p).convert("RGB") for p in paths]
    hh = 360
    ims = [im.resize((int(im.width * hh / im.height), hh)) for im in ims]
    sheet = Image.new("RGB", (sum(im.width for im in ims) + 8 * (len(ims) + 1), hh + 40), (20, 20, 24))
    x = 8
    for p, im in zip(paths, ims):
        sheet.paste(im, (x, 8))
        ImageDraw.Draw(sheet).text((x, hh + 14), Path(p).name, fill=(230, 230, 230))
        x += im.width + 8
    sheet.save(dst, quality=88)
    print(f"  {dst}  (the variants side by side)")


# ---------------------------------------------------------------- text
TEXT = {
    "gpt-oss": "@cf/openai/gpt-oss-120b", "gpt-oss-20b": "@cf/openai/gpt-oss-20b",
    "gemma": "@cf/google/gemma-4-26b-a4b-it", "llama": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "llama4": "@cf/meta/llama-4-scout-17b-16e-instruct", "kimi": "@cf/moonshotai/kimi-k2.6",
    "qwen": "@cf/qwen/qwen3-30b-a3b-fp8", "glm": "@cf/zai-org/glm-4.7-flash", "deepseek": "@cf/deepseek-ai/deepseek-v4-flash-0731",
    "mistral": "@cf/mistralai/mistral-small-3.1-24b-instruct",
}
VISION_DEFAULT = "gemma"     # sees pictures (also llama4, mistral)


def read_prompt(p):
    if p == "-":
        return sys.stdin.read()
    if p.startswith("@") and Path(p[1:]).is_file():
        return Path(p[1:]).read_text(encoding="utf-8")
    return p


def data_url(path):
    data = Path(path).read_bytes()
    if len(data) > 3_000_000:            # a full frame PNG: shrink to a JPEG first
        try:
            from io import BytesIO
            from PIL import Image
            im = Image.open(path).convert("RGB")
            im.thumbnail((1280, 1280))
            buf = BytesIO()
            im.save(buf, "JPEG", quality=85)
            data = buf.getvalue()
        except ImportError:
            pass
    mime = "image/png" if data[:4] == b"\x89PNG" else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(data).decode()


def cmd_text(a):
    task = "vision" if a.image else "text"
    p = provider(a.provider, task)
    if p.name == "cloudflare":
        model = a.model or (VISION_DEFAULT if a.image else "gpt-oss")
        model = TEXT.get(model, model)
    else:
        model = a.model or p.default
        if not model:
            raise GenError(f"{p.name}: no model: pass --model or set CARTOON_LLM_MODEL")
    content = read_prompt(a.prompt)
    if a.image:
        content = [{"type": "text", "text": content}] + [{"type": "image_url", "image_url": {"url": data_url(i)}} for i in a.image]
    messages = ([{"role": "system", "content": a.system}] if a.system else []) + [{"role": "user", "content": content}]
    text, usage = p.chat(model, messages, max_tokens=a.max_tokens, temperature=a.temperature, json_mode=a.json)
    if a.output:
        Path(a.output).write_text(text, encoding="utf-8")
        print(f"  {a.output}  ({len(text)} chars, {p.name} {model})")
    else:
        print(text)
    if usage:
        print(f"  ({p.name} {model}: {usage.get('prompt_tokens', '?')} in, {usage.get('completion_tokens', '?')} out)", file=sys.stderr)


# ---------------------------------------------------------------- speech
SPEECH = {"aura-2-en": "@cf/deepgram/aura-2-en", "aura-2-es": "@cf/deepgram/aura-2-es", "aura-1": "@cf/deepgram/aura-1",
          "melotts": "@cf/myshell-ai/melotts"}


def ffmpeg(*args):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], capture_output=True, text=True)
    if p.returncode:
        raise GenError(f"ffmpeg: {p.stderr[-300:]}")


def speech(text, out, cfg):
    """text -> a 48 kHz mono wav (also used by voice.py, engine "cloud")"""
    name = cfg.get("model") or "aura-2-en"
    model = SPEECH.get(name, name)
    cf = provider("cloudflare")
    if "melotts" in model:
        body = {"prompt": text, "lang": cfg.get("lang", "en")[:2]}
    else:
        body = {"text": text, "speaker": str(cfg.get("speaker") or cfg.get("voice") or "luna"), "encoding": "mp3"}
    ct, data = cf.run(model, body)
    if "json" in ct or data[:1] == b"{":
        d = json.loads(data)
        data = base64.b64decode((d.get("result") or d).get("audio"))
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / "raw.mp3"
        raw.write_bytes(data)
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        ffmpeg("-i", raw, "-ar", 48000, "-ac", 1, "-c:a", "pcm_s16le", out)


def cmd_speech(a):
    speech(read_prompt(a.text), a.out, {"model": a.model, "speaker": a.voice, "lang": a.lang})
    print(f"  {a.out}")


# ---------------------------------------------------------------- lyrics timing
def norm_word(w):
    return re.sub(r"[^\w]+", "", w.lower().replace("ё", "е"))


def align_words(lines, words):
    """lyric lines (text) + recognised words [(t0, t1, word)] -> per line [(t, word)] (None where unheard).
    The lines keep the user's text; the voice gives the times (difflib over the word sequences)."""
    import difflib
    lw = [[w for w in l.split() if norm_word(w)] for l in lines]
    flat = [(i, w) for i, ws in enumerate(lw) for w in ws]
    a = [norm_word(w) for _, w in flat]
    b = [norm_word(w) for _, _, w in words]
    t = [None] * len(flat)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            t[blk.a + k] = words[blk.b + k][0]
    for i in range(len(t)):     # a near-miss ("gonna"/"going") inside a line: between its neighbours
        if t[i] is None:
            prev = next((t[j] for j in range(i - 1, -1, -1) if t[j] is not None and flat[j][0] == flat[i][0]), None)
            nxt = next((t[j] for j in range(i + 1, len(t)) if t[j] is not None and flat[j][0] == flat[i][0]), None)
            if prev is not None and nxt is not None:
                t[i] = round((prev + nxt) / 2, 3)
    out = [[] for _ in lines]
    for (li, w), ti in zip(flat, t):
        out[li].append((ti, w))
    return out


def lrc_time(t):
    m, s = divmod(max(0.0, t), 60)
    return f"{int(m):02d}:{s:05.2f}"


def write_lrc(path, timed):
    """timed: [(line text, [(t, word)...])] -> an enhanced LRC; a line nobody heard is left out (song.py
    times it between its neighbours)"""
    rows, missing = [], 0
    for text, ws in timed:
        known = [x for x in ws if x[0] is not None]
        if not known:
            missing += 1
            continue
        ts, last = [], known[0][0]       # every word gets a stamp (read_lrc drops text before the first one)
        for t, _ in ws:
            last = t if t is not None else last
            ts.append(last)
        body = " ".join(f"<{lrc_time(t)}>{w}" for t, (_, w) in zip(ts, ws))
        rows.append((known[0][0], f"[{lrc_time(known[0][0])}]{body}"))
    rows.sort()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text("".join(r + "\n" for _, r in rows), encoding="utf-8")
    return len(rows), missing


def cmd_transcribe(a):
    cf = provider("cloudflare")
    with tempfile.TemporaryDirectory() as td:
        mp3 = Path(td) / "v.mp3"
        ffmpeg("-i", a.audio, "-ac", 1, "-ar", 16000, "-b:a", "48k", mp3)
        body = {"audio": base64.b64encode(mp3.read_bytes()).decode(), "vad_filter": True,
                "condition_on_previous_text": False}
    lines = None
    if a.lyrics:
        sys.path.insert(0, str(HERE))
        import _lyrics
        lines = [l["text"] for s in _lyrics.parse(Path(a.lyrics).read_text(encoding="utf-8")) for l in s["lines"]]
        body["initial_prompt"] = " ".join(lines)[:600]
    if a.lang:
        body["language"] = a.lang
    key = hashlib.sha1((a.model + json.dumps(body, sort_keys=True)).encode()).hexdigest()
    t0 = time.time()
    data, hit = cached(key, lambda: cf.run(a.model, body)[1])
    res = json.loads(data)
    res = res.get("result", res)
    words = [(w["start"], w["end"], w["word"].strip()) for s in res.get("segments", []) for w in s.get("words", []) if w.get("word", "").strip()]
    info = res.get("transcription_info", {})
    print(f"  heard {len(words)} words, language {info.get('language', '?')}  {'(cached)' if hit else f'{time.time() - t0:.1f} s'}")
    if lines:
        timed = list(zip(lines, align_words(lines, words)))
        heard = sum(1 for _, ws in timed for t, _ in ws if t is not None)
        total = sum(len(ws) for _, ws in timed)
        print(f"  {heard}/{total} words of the lyrics found in the voice")
    else:
        timed = [(s["text"].strip(), [(w["start"], w["word"].strip()) for w in s.get("words", []) if w.get("word", "").strip()])
                 for s in res.get("segments", []) if s.get("text", "").strip()]
    n, missing = write_lrc(a.output, timed)
    print(f"  {a.output}: {n} lines" + (f", {missing} not heard (song.py places them between neighbours)" if missing else ""))
    print(f"  next: cartoon song --lrc {a.output}" + (" --lyrics " + a.lyrics if a.lyrics else ""))
    if not a.lyrics:
        print("  ! no --lyrics: the lines are Whisper's text (it mishears sung words); give the real lyrics to keep them")


# ---------------------------------------------------------------- video and any fal model
def cmd_video(a):
    if not is_fal(a.model or ""):
        raise GenError("video needs a fal model: --model fal-ai/kling-video/v3/standard/text-to-video (find one: "
                       "cartoon gen models video --service fal; read it: cartoon gen info <model>)")
    inp = {"prompt": read_prompt(a.prompt)}
    if a.image:                 # the first-frame field differs per model: take it from the schema
        fields = re.findall(r"^- \*\*`(\w+)`\*\*", fal_info(a.model), re.M)
        name = next((f for f in ("image_url", "start_image_url", "first_frame_url", "first_frame_image", "image") if f in fields), None)
        if not name:
            raise GenError(f"{a.model} takes no picture (fields: {', '.join(fields)}); an image-to-video model does")
        inp[name] = data_url(a.image)
    if a.seconds:
        inp["duration"] = a.seconds
    if a.aspect:
        inp["aspect_ratio"] = a.aspect
    for kv in a.param:
        k, _, v = kv.partition("=")
        inp[k] = param_value(v)
    fal_call(a.model, inp, a.out, 1, a.yes, a.no_cache)


def fal_recover(fal, endpoint, rid):
    """the result of an earlier (paid) request, without a new call: after a lost download or a timeout"""
    base = "/".join(endpoint.split("/")[:2])
    for app in dict.fromkeys([base, endpoint]):
        st, res = fal._req(f"https://queue.fal.run/{app}/requests/{rid}")
        if st == 200:
            return res
    fal.fail(st, res, f"request {rid}")


def cmd_fal(a):
    """any fal model with its own input fields (read them with cartoon gen info)"""
    if a.request:
        fal = provider("fal")
        res = fal_recover(fal, a.endpoint, a.request)
        cdir = CACHE / f"fal-request-{a.request}"
        cdir.mkdir(parents=True, exist_ok=True)
        (cdir / "result.json").write_text(json.dumps({"result": res, "request": a.request}, ensure_ascii=False), encoding="utf-8")
        stem = Path(a.out).with_suffix("") if Path(a.out).suffix else Path(a.out)
        urls = media_urls(res)
        for i, (u, kind) in enumerate(urls):
            dst = Path(f"{stem}{'' if len(urls) == 1 else '-' + str(i + 1)}{ext_for(kind, u)}")
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(fetch(u))
            record_any(dst, {"service": "fal", "model": a.endpoint, "request": a.request, "input": {}, "date": date.today().isoformat()})
            print(f"  {dst}  (request {a.request}: recovered, no new call)")
        return
    inp = json.loads(Path(a.input).read_text(encoding="utf-8")) if a.input else {}
    for kv in a.param:
        k, _, v = kv.partition("=")
        if v.startswith("@") and Path(v[1:]).is_file():      # a local file -> data URI
            v = json.dumps(data_url(v[1:]) if not v.lower().endswith((".wav", ".mp3", ".m4a", ".ogg")) else
                           "data:audio/" + Path(v[1:]).suffix[1:] + ";base64," + base64.b64encode(Path(v[1:]).read_bytes()).decode())
        inp[k] = param_value(v)
    fal_call(a.endpoint, inp, a.out, int(inp.get("num_images", 1)), a.yes, a.no_cache)


def cmd_info(a):
    text = fal_info(a.endpoint, a.refresh)
    print(text if a.full else fal_summary(text))
    try:
        p = provider("fal").price(a.endpoint)
        if p:
            print(f"\nlive price for this account: ${p['unit_price']:g} per {p['unit']} ({p.get('currency', 'USD')})")
    except GenError:
        pass


# ---------------------------------------------------------------- catalogue, keys
FAL_CATEGORY = {"image": "text-to-image", "video": "text-to-video", "speech": "text-to-speech", "asr": "speech-to-text"}


def cmd_models(a):
    task = a.task
    if a.service == "fal" or a.q:
        fal = provider("fal")
        ms = fal.search(a.q, a.category or FAL_CATEGORY.get(task), a.limit)
        ids = [m["endpoint_id"] for m in ms]
        prices = {}
        for i in range(0, len(ids), 40):
            qs = "&".join("endpoint_id=" + urllib.request.quote(x, safe="/") for x in ids[i:i + 40])
            st, d = fal._req(f"{fal.API}/models/pricing?{qs}")
            prices.update({p["endpoint_id"]: p for p in (d.get("prices") or [])} if st == 200 else {})
        print(f"fal: {len(ms)} models" + (f" for '{a.q}'" if a.q else "") + " (schema and price of one: cartoon gen info <model>)")
        for m in ms:
            md, p = m.get("metadata") or {}, prices.get(m["endpoint_id"])
            cost = f"${p['unit_price']:g}/{p['unit'].rstrip('s')}" if p else ""
            print(f"  {md.get('category', '')[:15]:<15} {m['endpoint_id']:<58} {cost:<16} {md.get('display_name', '')[:40]}")
        return
    for name, cls in PROVIDERS.items():
        if name == "fal" or task and task not in cls.tasks:
            continue
        try:
            p = cls(keys())
        except GenError as e:
            print(f"{name}: {e}")
            continue
        ms = p.models()
        want = Cloudflare.TASKS.get(task) if name == "cloudflare" else None
        print(f"{name}: {len(ms)} models")
        for m in sorted(ms, key=lambda m: (m["task"]["name"], m["name"])):
            if want and m["task"]["name"] != want:
                continue
            props = {x["property_id"]: x["value"] for x in m.get("properties", [])}
            if task == "vision" and props.get("vision") != "true":
                continue
            tags = [t for t in ("vision", "reasoning") if props.get(t) == "true"] + (["partner terms"] if props.get("partner") == "true" else [])
            tags += [f"${x['price']:g}/{x['unit'].replace('per ', '')}" for x in (props.get("price") or [])[:2] if x.get("price")]
            alias = next((k for d in (IMAGE, TEXT, SPEECH) for k, v in d.items() if (v[0] if isinstance(v, tuple) else v) == m["name"]), "")
            print(f"  {m['task']['name'][:22]:<22} {m['name']:<52} {alias:<14} {', '.join(tags)}")
    print("fal: hundreds of paid models: cartoon gen models " + (task or "") + " --service fal [--q words]")


def cmd_keys(a):
    if a.from_file:
        src = read_env(a.from_file)
        got = {n: src[n] for n in KEY_NAMES if src.get(n)}
        if not got and src.get("CLOUDFLARE_API_TOKEN"):
            got["CLOUDFLARE_AI_API_TOKEN"] = src["CLOUDFLARE_API_TOKEN"]
        if not got:
            raise GenError(f"{a.from_file}: none of {', '.join(KEY_NAMES)}")
        KEYS_FILE.parent.mkdir(parents=True, exist_ok=True)
        cur = read_env(KEYS_FILE)
        cur.update(got)
        KEYS_FILE.write_text("".join(f"{k}={v}\n" for k, v in cur.items()), encoding="utf-8")
        try:
            os.chmod(KEYS_FILE, 0o600)
        except OSError:
            pass
        print(f"  {KEYS_FILE}: {', '.join(got)} copied")
    k = keys()
    for n in KEY_NAMES:
        v = k.get(n)
        print(f"  {n:<26} {mask(n, v[0]) + '  (' + v[1] + ')' if v else '-'}")
    for name, cls in PROVIDERS.items():
        try:
            cls(k)
            print(f"  {name}: ready for {', '.join(sorted(cls.tasks))}")
        except GenError:
            print(f"  {name}: no keys")
    ignore = Path(".gitignore").read_text(encoding="utf-8", errors="ignore").split() if Path(".gitignore").exists() else []
    if Path(".env").exists() and ".env" not in ignore:
        print("  ! ./.env is not in .gitignore: the keys would be committed with the project")


def main():
    for f in (sys.stdout, sys.stderr):
        f.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(prog="cartoon gen", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("keys", help="which services have keys")
    s.add_argument("--from", dest="from_file", help="copy the known keys from another .env into the user's keys file")
    s = sub.add_parser("models", help="the live catalogue")
    s.add_argument("task", nargs="?", choices=["image", "text", "vision", "speech", "asr", "video"])
    s.add_argument("--service", choices=list(PROVIDERS)); s.add_argument("--q", help="fal: search words")
    s.add_argument("--category", help="fal: e.g. text-to-image, image-to-video, image-to-image")
    s.add_argument("--limit", type=int, default=30)
    s = sub.add_parser("info", help="fal: a model's input schema, defaults and price (its llms.txt)")
    s.add_argument("endpoint"); s.add_argument("--full", action="store_true"); s.add_argument("--refresh", action="store_true")
    s = sub.add_parser("image", help="a picture from a prompt")
    s.add_argument("prompt"); s.add_argument("out")
    s.add_argument("--model", default="klein9", help=", ".join(IMAGE) + ", a full @cf/... id, or a fal model id (paid)")
    s.add_argument("--aspect", default="1:1"); s.add_argument("--size", help="WxH (multiples of 16)")
    s.add_argument("--seed", type=int); s.add_argument("--n", type=int, default=1, help="variants with seeds seed..seed+n-1")
    s.add_argument("--ref", action="append", default=[], help="a reference picture (FLUX.2: up to 4; fal: image_urls)")
    s.add_argument("--steps", type=int); s.add_argument("--negative")
    s.add_argument("--param", action="append", default=[], help="fal: an extra input field, k=v (v is JSON if it parses)")
    s.add_argument("--yes", action="store_true", help="fal: the user agreed to pay for this call")
    s.add_argument("--no-cache", action="store_true")
    s = sub.add_parser("video", help="a video clip from a fal model (paid)")
    s.add_argument("prompt"); s.add_argument("out"); s.add_argument("--model", required=True)
    s.add_argument("--image", help="the first frame (image-to-video models)"); s.add_argument("--seconds")
    s.add_argument("--aspect"); s.add_argument("--param", action="append", default=[])
    s.add_argument("--yes", action="store_true"); s.add_argument("--no-cache", action="store_true")
    s = sub.add_parser("fal", help="any fal model with its own fields (paid)")
    s.add_argument("endpoint"); s.add_argument("out", help="output path without or with extension; several files get -1, -2 ...")
    s.add_argument("--param", "-p", action="append", default=[], help="k=v (JSON value if it parses; @file -> data URI)")
    s.add_argument("--input", help="a JSON file with the whole input")
    s.add_argument("--request", help="download the result of an earlier request id (no new call, no cost)")
    s.add_argument("--yes", action="store_true"); s.add_argument("--no-cache", action="store_true")
    s = sub.add_parser("text", help="ask an LLM (with --image: about a picture)")
    s.add_argument("prompt"); s.add_argument("--model", help=", ".join(TEXT) + " or a full id")
    s.add_argument("--provider", choices=list(PROVIDERS)); s.add_argument("--system")
    s.add_argument("--image", action="append", default=[]); s.add_argument("--json", action="store_true")
    s.add_argument("--max-tokens", type=int, default=4000); s.add_argument("--temperature", type=float)
    s.add_argument("-o", "--output")
    s = sub.add_parser("speech", help="text -> wav")
    s.add_argument("text"); s.add_argument("out")
    s.add_argument("--model", default="aura-2-en", help=", ".join(SPEECH)); s.add_argument("--voice", default="luna")
    s.add_argument("--lang", default="en", help="melotts: en es fr zh jp kr")
    s = sub.add_parser("transcribe", help="a voice -> an enhanced LRC (word times) for cartoon song --lrc")
    s.add_argument("audio"); s.add_argument("--lyrics", help="the lyrics (Suno tags ok): keep their text, take the times")
    s.add_argument("--lang"); s.add_argument("--model", default="@cf/openai/whisper-large-v3-turbo")
    s.add_argument("-o", "--output", default="audio/song.lrc")
    a = ap.parse_args()
    {"keys": cmd_keys, "models": cmd_models, "info": cmd_info, "image": cmd_image, "video": cmd_video, "fal": cmd_fal,
     "text": cmd_text, "speech": cmd_speech, "transcribe": cmd_transcribe}[a.cmd](a)


if __name__ == "__main__":
    main()
