# HyperFrames: contract, commands, install

Tested with hyperframes 0.8.164 (October 2026). `cartoon` pins this version
(`npx --yes hyperframes@0.8.164`); override with `CARTOON_HF_VERSION=x.y.z` when you upgrade on purpose.
Docs: https://hyperframes.heygen.com · repository: https://github.com/heygen-com/hyperframes (Apache-2.0).

## Install
- Node.js 22+, FFmpeg. `cartoon doctor` shows what is missing (it also runs `hyperframes doctor`).
- Chrome Headless Shell: `npx hyperframes browser ensure`. If the download is blocked (corporate
  network, sandbox): `export HYPERFRAMES_BROWSER_PATH=/path/to/chrome` — any Chrome/Chromium works (the
  screenshot path is slower but works). On macOS:
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- Python 3.9+ with `pip install numpy scipy pillow` — sound and analysis scripts.
- Windows: run the scripts from Git Bash (the Bash tool of Claude Code uses it). The `python3`
  command may be a Microsoft Store stub: `cartoon` skips it and uses `python`/`py`, or set `PYTHON`.
- Optional: `pip install piper-tts` for narration.

## Composition contract (what the runtime needs)
- A root `<div data-composition-id="main" data-width data-height data-duration>` directly in `<body>`
  (no `<template>`). **`data-duration` is static** — the length is read before scripts run.
- Exactly one paused GSAP timeline in `window.__timelines["<id>"]`, key = `data-composition-id`.
  Register it **after** the async build (fonts/images) — the engine and the 3D templates do this.
- Heavy preparation -> a promise in `window.__hf.buildReady["name"]` (registered by the engine).
- Three.js: the runtime sends `hf-seek` with `detail.time`; render exactly that time.
- Forbidden for visual state: `Date.now()`, `performance.now()`, unseeded `Math.random()`, network
  loads during rendering, hover/scroll, endless loops. Everything is vendored locally.
- Every `<audio>` has an `id`, otherwise the render is silent. No `crossorigin` on `<audio>/<video>`.
- A named CSS font -> `@font-face` on a local file (fonts live in `fonts/`).

## Commands (through `cartoon`, run inside the project)
```bash
cartoon lint                                  # quick, after every structural change
cartoon check-hf                              # hyperframes check: lint + runtime + layout + contrast
cartoon snapshot --at 0,3.8,9.5               # frames + contact-sheet.jpg in .hyperframes/artifacts/snapshots/<id>/
cartoon snapshot --range 3:5 --frames 8
cartoon preview --background                  # studio in the browser for the user (timeline, edits)
cartoon render --fps 24 --quality draft    --output draft.mp4   # quick iterations
cartoon render --fps 24 --quality looks    --output out.mp4     # normal render
cartoon render --fps 24 --quality delivery --output final.mp4   # final
cartoon render --format webm ...              # with transparency (overlays)
```
`--fps` supports 24, 30, 60. For hand-drawn styles use **24** (12 drawings on twos).
The second line of the render summary says `beginframe` (fast) or `screenshot` (slower; 3D and DOM
layers use it).

## Common lint errors
| code | fix |
|---|---|
| `missing_timeline_registry` | an inline script with `window.__timelines` in `index.html` (the templates have it) |
| `root_composition_missing_duration_source` | a static `data-duration` on the root |
| `media_missing_id` | an `id` on `<audio>` |
| `font_family_without_font_face` | `@font-face` on a file in `fonts/` |
| `gsap_timeline_registered_before_async_build` | register the timeline at the end of the async build |
| `gsap_animates_clip_element` | do not tween `visibility/autoAlpha` of `.clip`, animate a child |
| `shader_unbounded_cosine_pow` | `pow(1.0 - clamp(dot(n, v), 0.0, 1.0), k)` — clamp both sides |

## Speed
A MacBook M-series: 10–12 s of vertical 2D in 10–20 s. A Ryzen laptop on Windows: 8 s of 16:9 2D in
~45 s; 40 s of photo + 3D in ~3.5 min. Heavy frames = many hatching strokes and `ctx.filter` blur;
if slow, raise the hatch `spacing` and lower the glow radius.
