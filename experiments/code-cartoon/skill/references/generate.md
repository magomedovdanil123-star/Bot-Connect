# Generative services: pictures, video, LLMs, speech, lyrics timing

`cartoon gen` (`scripts/gen.py`) talks to generative services. The cartoon itself stays code: the services
make **material** for it (a source picture to engrave, an English narration voice, the times of the sung
words) and give a **second opinion** (a model looks at a rendered frame). Services now:

| service | gives | keys |
|---|---|---|
| `cloudflare` (Workers AI) | pictures (FLUX.2, FLUX.1, SDXL, Leonardo), ~40 LLMs (some see pictures), Whisper with word times, Deepgram Aura / MeloTTS speech | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_API_TOKEN` |
| `fal` (fal.ai) | hundreds of models, all **paid** from prepaid credits: pictures (GPT Image 2, Z-Image, FLUX, Nano Banana...), **video** (Kling, Veo, Wan, Seedance, MiniMax...), speech, upscaling, 3D | `FAL_KEY` |
| `openai` | `text` from any OpenAI-compatible chat API: OpenRouter, Groq, a local Ollama / LM Studio | `CARTOON_LLM_BASE_URL`, `CARTOON_LLM_API_KEY`, `CARTOON_LLM_MODEL` |

## Ask before generating
- **Every generation during the skill's work is the user's decision.** Before a picture, a voice or a video
  is generated, say what for, which service and model, how many, and whether it is free (Cloudflare within
  the daily neurons) or paid; wait for a yes. A yes covers what was asked ("4 variants of the violin"), not
  the next batch.
- **Paid calls (every fal model, Leonardo beyond the free neurons): give the price.** `cartoon gen` makes it
  hard to forget: a fal call without `--yes` sends nothing, prints `PAID CALL, not sent: ~$0.010 (...)` and
  exits with code 3. Show that line to the user; add `--yes` only after they agree. A repeat of a call that
  was made is free (cached) and needs no `--yes`.
- When the price is unknown up front (token-priced models such as GPT Image 2, compute-priced ones), say so
  and give the model's pricing line from `cartoon gen info`.
- **Choosing a fal model**: Claude may propose one, the user approves it. Find candidates with
  `cartoon gen models image --service fal --q "words"` (with the price per unit), read the 1–3 best with
  `cartoon gen info <model>` (fields, defaults, price), then offer them with prices and what each is good
  at. The catalogue changes often: never call a model id from memory without `info`.

## What leaves the machine
Everything else in the skill runs locally; `cartoon gen` is the exception: the prompt, `--image`/`--ref`
pictures and the audio go to the service of the keys (the user's own account and its terms). Never send
photos of real people, especially children; before sending the user's own song, voice or art, say so.
Generated pictures and transcripts are cached locally only.

## Keys
- Read from the environment, then `./.env` of the project, then `~/.config/code-cartoon/keys.env`
  (`CARTOON_KEYS` overrides the path). Never printed: `cartoon gen keys` shows them masked and says
  which service is ready. `cartoon gen keys --from path/.env` copies the known names from another
  project's `.env` into the user's keys file (the best place: it is outside every project).
- New projects ignore `.env` in git; `cartoon gen keys` warns when `./.env` is not ignored.
- Cloudflare: the account id is in the dashboard URL (`dash.cloudflare.com/<account id>/...`); the token:
  My Profile -> API Tokens -> Create -> the "Workers AI" template (Workers AI Read + Edit).
- Free: 10 000 "neurons" a day per account, reset at 00:00 UTC. Beyond that the call fails with code 3036
  ("quota") unless the paid plan is on. Prices per model: `cartoon gen models image` (from the catalogue).
- fal: `FAL_KEY` from fal.ai/dashboard/keys (`id:secret`). An "API" scope key runs models and reads prices
  but not the account's billing: the real cost of a call is on the fal dashboard (Usage).

## Commands
```bash
cartoon gen models image          # the live catalogue: id, alias, vision/reasoning, partner terms, price
cartoon gen image "studio photograph of an antique violin with small golden wings, plain pure black background, hard side light from the left, no text" \
    refs/violin.png --size 1152x1536 --seed 11          # 4 s
cartoon gen image "..." refs/sky.png --aspect 16:9 --n 4  # sky-<seed>.png x4 + sky-pick.jpg to choose from
cartoon gen image "the same violin seen from above" refs/violin-top.png --ref refs/violin.png   # FLUX.2: up to 4 refs
cartoon gen text "Ten titles for a clip about Hermes giving people AI. One per line."
cartoon gen text "What reads first in this frame? Is any text cut off?" --image frames/t045.png    # a vision model
cartoon gen speech "The light ran from hand to hand." audio/voice/line1.wav --voice orion
cartoon gen transcribe audio/vocals.wav --lyrics audio/lyrics.txt     # -> audio/song.lrc, then: cartoon song --lrc audio/song.lrc
```
`"prompt"` can be `@file.txt` or `-` (stdin).

### Pictures
| alias | model | notes (tested 2026-10-17) |
|---|---|---|
| `klein9` (default) | FLUX.2 [klein] 9B | 2 s at 512², 4 s at 1152x1536; **the only one where the same seed gives the same picture**; `--ref` |
| `klein` | FLUX.2 [klein] 4B | ~10 s; the seed is ignored; `--ref` |
| `flux2` | FLUX.2 [dev] | ~8 s at 512²; the seed is ignored; `--ref` |
| `schnell` | FLUX.1 [schnell] | square 1024 only, no seed |
| `sdxl-lightning`, `sdxl` | Stable Diffusion XL | sizes, `--negative`; the seed is ignored; looks dated |
| `lucid`, `phoenix` | Leonardo | photographic / good with lettering; priced per 512² tile |

- Sizes: `--aspect` gives ~1 MP in multiples of 16 (16:9 -> 1328x736); `--size WxH` up to 1920 a side
  (FLUX.2). Generate a source for an engraving at the size it will be engraved (`--height` of `cartoon engrave`).
- Without `--seed` every run picks a new seed (a new picture); the seed is printed and recorded. Every
  picture is cached by its request in `~/.cache/code-cartoon/gen`: the same command with the same `--seed`
  costs nothing and returns the same file, even on models that ignore the seed. Put the commands with
  their seeds in `tools/build_assets.sh`. `--no-cache` asks again.
- Every picture is recorded: `OUT.json` beside it and a line in `SOURCES.md` of its folder (service, model,
  seed, size, prompt, refs), like the museum pictures of an engraving clip.
- FLUX.2 references (`--ref`, up to 4) are shrunk under 512x512 before sending (the service wants that).

### fal: any model, pictures, video
```bash
cartoon gen models image --service fal --q "photo realistic"       # candidates with their unit prices
cartoon gen models video --service fal                              # text-to-video ($/second)
cartoon gen info openai/gpt-image-2                                 # fields, defaults, price (the model's llms.txt)
cartoon gen image "..." refs/violin.png --model fal-ai/z-image/base --size 896x1152 --seed 5      # -> PAID CALL, not sent: ~$0.010
cartoon gen image "..." refs/violin.png --model fal-ai/z-image/base --size 896x1152 --seed 5 --yes
cartoon gen image "..." refs/violin.png --model openai/gpt-image-2 --size 1024x1024 --param quality=low --yes
cartoon gen video "a moth circles a glowing orb, macro" clips/moth.mp4 --model fal-ai/kling-video/v3/standard/text-to-video --seconds 5 --aspect 16:9
cartoon gen video "the violin slowly turns" clips/v.mp4 --model fal-ai/kling-video/v3/standard/image-to-video --image refs/violin.png --seconds 5
cartoon gen fal fal-ai/clarity-upscaler refs/violin-big -p image_url=@refs/violin.png    # any model, its own fields
cartoon gen fal openai/gpt-image-2 refs/violin --request <id>     # download an earlier paid result again, free
```
- `image` maps the common options for fal: `--size`/`--aspect` -> `image_size {width, height}`, `--n` ->
  `num_images`, `--seed`, `--negative`, `--steps` -> `num_inference_steps`, `--ref` -> `image_urls` (for edit
  models). Anything else: `--param key=value` (JSON if it parses: `--param num_images=2`). `video`: `--image`
  -> the model's first-frame field, found in its schema (`image_url`, `start_image_url`, ...), `--seconds` ->
  `duration`, `--aspect` -> `aspect_ratio`. `fal`: only `-p` fields;
  `-p field=@file` sends a local file as a data URI. Field names differ per model: read `info` first; a wrong
  one comes back as a 422 with the field named.
- The result is kept the moment it arrives (`~/.cache/code-cartoon/gen/fal-*`), before the download: a
  failed download is fixed by running the same command again, without a new charge. Every file is recorded
  in `OUT.json` and `SOURCES.md` (model, input, request id, the estimate).
- Tested 2026-10-18: Z-Image base 896x1152 in ~4 s, $0.01/MP (a grey studio backdrop although "pure black"
  was asked); GPT Image 2, quality low, 1024² in ~8 s, a clean black backdrop, token-priced.
- Video for a code cartoon: a generated clip as the source for `cartoon roto` (redrawn in the cartoon's
  style), or a background plate to engrave frame by frame; not as finished frames of the cartoon.

### Text and pictures to text
- Aliases: `gpt-oss` (default text, gpt-oss-120b), `gemma` (default with `--image`: Gemma 4 sees pictures),
  `llama`, `llama4`, `kimi`, `qwen`, `glm`, `deepseek`, `mistral`; or any full id from `cartoon gen models text`.
- `--system`, `--json` (a JSON object back), `--max-tokens` (reasoning models spend tokens before the answer:
  raise it if "only reasoning came back"), `-o file`.
- `--provider openai` sends the same request to the OpenAI-compatible service from the keys.

### Speech
`aura-2-en` (default, `--voice` luna, orion, athena, zeus, ... 40 voices), `aura-2-es`, `aura-1`, `melotts`
(`--lang` en es fr zh jp kr). **No Russian**: Russian narration stays with Piper (`references/sound.md`).
In a project: `"voice": {"engine": "cloud", "model": "aura-2-en", "speaker": "orion"}` in `cues.js`, then
`cartoon voice --fit` as with any engine.

### Lyrics timing from the voice
`cartoon gen transcribe vocals.wav --lyrics lyrics.txt` runs Whisper (large-v3-turbo, word times) on the
voice and lays the user's lyrics over the words it heard: the lines keep the user's text, the times come
from the voice; a misheard word inside a line takes the time between its neighbours, a line nobody heard
is left out (`cartoon song` places it between its neighbours). The result is an enhanced LRC
(`<mm:ss.xx>` per word) for `cartoon song --lrc`. Use the vocal stem: on a full mix Whisper hears fewer
words. The console says how many words of the lyrics were found ("20/20"); below ~70 % check
`lyrics-preview.mp4` closely or fix `audio/song.lrc` by hand.

## When a service helps, and when not
- **A source picture nobody has**: a specific object, pose or scene for an engraving (`references/engraving.md`)
  when no public-domain picture fits. Ask for a plain black or white backdrop and a hard side light, then
  `cartoon engrave ... --bg 30`. A dark subject on black (wood, bronze) needs a low tone curve:
  `--lo 0.12 --hi 0.75 --gamma 0.9 --local 0.35`. Engraving generated and museum pictures with the same
  settings keeps them one world.
- **Texture and backdrops**: paper, stone, clouds, a starfield, to engrave or to use behind code drawings.
- **A reference to draw from in code**: a pose, a silhouette, a composition to trace into paths.
- **A second look**: a vision model on a rendered frame ("what reads first", "is text cut off"). It is a
  hint, not a check: it invents details (it saw a "watermark" on a clean cloud). Look at the frame yourself.
- **Bulk text**: captions in ten languages, title variants, alt texts.
- Not for: the frames of the cartoon themselves (the style is code); real people's faces; a living
  artist's style by name; logos and brands. A clip with realistic generated pictures may need the
  platform's "altered or synthetic content" label (YouTube): say so to the user when it applies.
- Partner models (FLUX, Leonardo) have their own terms, linked in the catalogue (`partner terms`): check
  them before commercial use, as with the licence of a museum picture.

## Adding a service
A class in `PROVIDERS` of `scripts/gen.py`: `name`, `tasks` (a set of image, text, vision, speech, asr,
video), `__init__(keys)` that raises `GenError` without its keys, and the methods of its tasks (`chat`,
`run`, `models`); its key names go into `KEY_NAMES` (secrets also into `SECRET`). A paid service goes
through `guard()` (the price, `--yes`) and keeps its answer before downloading, as `fal_call()` does. Keep
the key out of the output, the cache and the record.
