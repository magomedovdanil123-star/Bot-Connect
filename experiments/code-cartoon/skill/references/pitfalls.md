# Pitfalls

Add a line for every new mistake: symptom | cause | fix. One line, one pitfall. Read before writing
scenes. Grouped by area; numbers are stable ids (new ones go at the end of their section with the
next free number).

## Determinism and time
| # | symptom | cause | fix |
|---|---|---|---|
| 1 | stars/objects jump when neighbours appear | random numbers pulled from a shared stream inside a visibility check | key `Sketch.rng(id, i)` by object; with a shared stream draw ALL numbers first, then skip the invisible |
| 2 | randomness differs on every render | `Math.random`, `Date.now`, `performance.now` | only `Sketch.rng` / `noise1`; time only `d.t` |
| 8 | sound drifted from the picture | timing/length changed but the sound was not rebuilt | time lives only in `cues.js`; after a change run `cartoon audio` |
| 20 | an event after the end breaks the sound | `t` >= length | the script skips it with a warning; fix `cues.js` |
| 37 | "started earlier" with `Math.pow(u, 0.75)` but the drawing starts later | a power < 1 raises u in (0,1) -> later time | earlier = power > 1 (`u^1.3`); check the frame right after the start |
| 38 | a looped video (avatar, background) clicks at the seam | elements are not periodic: camera/particles/drawing at t=L differ from t=0 | everything periodic (`sin(2πn·t/P)`) or 0 at both ends; the next loop's drawing from `t − P`; compare the last and first frame side by side |
| 39 | in a loop the start of the next round is empty | "after the twist" fades are computed from `t`, not from the loop time `tc = t − P` | all drawing phases from `tc`; only once-per-loop things (photo, erase) from `t` |
| 79 | the first drawing (frame 0, the cover) misses an image while drawn shapes are there | a variant picked by `Math.floor(t * n) % 3`: with beatLock the first drawing starts before 0, `t < 0`, and `%` in JS stays negative (`-1`), so the asset key does not exist | wrap it: `((Math.floor(t * n) % 3) + 3) % 3`; check frame 0 in the render, not only in a snapshot |

## Drawing (2D engine)
| # | symptom | cause | fix |
|---|---|---|---|
| 3 | lines do not boil, the drawing is dead | `k` not passed to the pen | `{ k: d.k, seed: "unique" }` in every call |
| 4 | everything boils in sync | the same `seed` on different objects | a unique `seed` per object |
| 5 | a front object erased the back one too early | the "eraser" (destination-out / paper fill) runs before the object appears | gate it with `prog(t, appear, ...) > 0`; draw the back object first |
| 6 | hatching on light paper looks like a negative | the light is hatched instead of the shadow | `shade: light` -> hatch the shadow; `dark` -> the light (`d.pal.shade`) |
| 11 | a global flash washes the whole frame | the whole glow layer filled with bloom and `lighter` | a local radial flash (`fx.flash` with `radius`), alpha <= 0.35 for accents, <= 0.6 for transitions |
| 12 | rays/decor cross the object | directions not filtered | drop the angles where an element overlaps the object |
| 21 | text goes under the Reels interface | the bottom of the frame | keep the bottom 15 % empty; `cartoon sheet` marks the zone |
| 22 | rendering is very slow | screenshot mode without headless-shell, many hatch strokes, big blur | `npx hyperframes browser ensure`; sparser hatching; blur <= 26 px |
| 25 | a caption leaves by "un-writing" its letters | the text `progress` multiplied by the fade-out | appear with `progress`, leave with a separate `alpha`/scale of the whole plate (`fx.ribbon` `out`) |

## Several worlds and cameras
| # | symptom | cause | fix |
|---|---|---|---|
| 23 | a second world in another palette repaints wrong, or a cached picture changes colours | palettes switched by hand; a cache miss draws with the current world's palette | `Sketch.sequence` (one palette + paper per scene), `Sketch.withPalette`, `Sketch.cache(..., {palette})` pins the palette |
| 24 | at a big zoom pencil lines become thick ropes and dance | width and wobble scale with the camera | built in: `Sketch.config.zoomComp = 0.75` (per call `zoomComp:false`); use `d.useCamera` for worlds with their own camera so the zoom is known |
| 26 | a flying object passes over a standing one | paths not checked against other objects' places | check every stop/hover on the sheet; separate them by height or draw the far one first |
| 47 | during an iris the old world's glow (a neon sun, its lyrics) shines over the new world | the incoming paper covered only the ink layer | fixed in engine 1.2: the glow is cleared inside the circle; do the same in hand-made transitions |

## Text and fonts
| # | symptom | cause | fix |
|---|---|---|---|
| 7 | hand-written letters break or double | an outline font traced as a line | write with `pen.text` (mask + reveal); "pen in the centre" needs a monoline font |
| 14 | canvas falls back to a system font | canvas draws before the font loads | the face in `fonts:` of `mount`; `@font-face` in `index.html` |
| 29 | a caption is unreadable over a glowing object | gold on gold, glow under the text | the caption in a calm area + a dark shadow `0 3px 12px rgba(0,0,0,.95)` |

## 3D and photo3d
| # | symptom | cause | fix |
|---|---|---|---|
| 15 | a 3D object does not fit a vertical frame | the FOV is vertical, the frame is narrow | camera distance from the width: `visH = max(width/aspect, height)` (in the template) |
| 16 | the 3D picture depends on the machine | DPR, `requestAnimationFrame`, particle simulation | `setPixelRatio(1)`, a fixed size, positions = f(t) |
| 28 | a flying rocket shows only its nozzle and a flare | the target is "into the depth", the camera behind | put targets to the side of the camera (motion across the view); check the frame in the middle of every flight |
| 30 | a portrait photo in 16:9 has bars or is soft | the frame is wider than the photo | `cartoon photo` scales it to cover the frame; move the camera vertically; the face no closer than 1.3x; ask for the original |
| 31 | 3D cut-outs (pop-up): alpha in the wrong place, square shadows | alphaMap reads the same UVs as map; the shadow ignores alpha | a mask over the WHOLE sheet; `customDepthMaterial = MeshDepthMaterial({alphaMap, alphaTest})` (`kit3d.popupCutouts`) |
| 32 | two WebGL canvases: reflections gone / errors | a PMREM environment texture belongs to its renderer | one `PMREMGenerator` per renderer (`kit3d.envMap`) |
| 33 | leaves/particles cross a face on the poster | random paths over the main object | hide elements whose paths cross the face/text area (`leavesOverlay.update(..., avoid)`) |
| 34 | a face sprite (a sun) has a wedge cut out of an eye | a sprite is screen-aligned: off-centre, its edge tilts into the ball | float it 1.7 R in front and rescale `s·(d−off)/(d−R)`; clip the pupils to the eye white (`kit3d.faceSprite`) |
| 35 | a character's eyes twitch | the gaze is quantised and follows the target's bob | gaze = a smooth function of the path without the bob, no rounding; redraw the face every frame |
| 36 | a 3D planet looks like a glass ball | low ocean roughness + strong environment + a bright rim | ocean roughness >= 0.5, `envMapIntensity` 0.1–0.15, fresnel power >= 3, rim <= 0.9 |
| 41 | `Object.assign(mesh, { position })` throws in a module | Object3D `position` is read-only | `mesh.position.copy(v)` |
| 42 | fresnel shader: black blotches on some GPUs (lint `shader_unbounded_cosine_pow`) | `pow(1 - max(dot,0), k)` can get a negative base | `pow(1.0 - clamp(dot(n, v), 0.0, 1.0), k)` |

## Pencil 3D (`engine/pencil3d.js`, `references/pencil3d.md`)
| # | symptom | cause | fix |
|---|---|---|---|
| 55 | a plane flips belly up / down in one drawing | the bank taken from the whole lift vector, which passes through zero over the top of a turn | bank only from the sideways acceleration, smooth and limited (`P3.flight` does it); a roll only on purpose (`roll`) |
| 56 | a plane slides sideways or hangs in the air in a hard turn | a hand-made path turns faster than the speed allows | a flight simulation (g-limit, roll rate, speed lost in climbs) run once at load, `P3.track` |
| 57 | the nose snaps onto the target before a burst / bullets fly 30° off the nose | aiming by turning the nose or by shooting at the target | bullets along `att.f` only; fire when the stream passes within ~18 m of where the target will be |
| 58 | a straight line across the frame from the old place to the new one when a shot or pass changes | the trail sampled back across the jump | sample trails only from the start of the current shot (`since`) |
| 59 | the sun bleaches the planes in front of it | the sun drawn on the glow layer (added over everything) | draw it first on the ink layer, behind the scene |
| 60 | a far wing's outline shows through the body | all outlines drawn after all faces | part by part, far to near, each filled and outlined (built in); split big parts (wing halves) |
| 61 | insignia vanish on a curved fuselage | the decal drawn with its face, a nearer face of the same part covered it | decals after all faces of their part (built in) |
| 62 | clouds look like piles of balls | round, evenly shaded puffs | flattened bumpy puffs, own shade low in the cloud, a rim only on sunlit tops (`P3.cumulus`) |
| 63 | the 3D world is black / wrong colours | meshes or clouds built at load, before `Sketch.mount` set the palette | build lazily on first use (`let m = null; const mesh = () => m \|\| (m = build())`) |
| 64 | the camera goes through a puff and the screen turns white or black | a puff at the camera fills the frame | puffs fade near the camera (built in); keep the camera out of smoke trails |
| 65 | the snapshot or render shows one frozen frame from some time on | the scene threw an exception (a shadowed helper name, an undefined value) | `cartoon check-hf` lists `page_error`; do not shadow helpers (`P`, `X`) with locals |
| 66 | the chase camera shows empty sky | the target point far ahead of the chaser, or the planes split | look between chaser and target, distance from their separation; check the middle of every shot |
| 67 | `cartoon frames --jumps` flags every camera move in 3D | on twos half the frames repeat; a median over the zeros called every move a jump | fixed: the baseline is the median of the frames that changed; camera cuts still count, add them as cue events |
| 68 | around a cut a plane comes in sideways and snaps level in 3–4 drawings; the frame swings; smoke is a stick | the path picks its formula by time (pass = `floor(t / phrase)`) and jumps at the cut; bank, speed, camera and trails sample a window across it | one path per shot, defined for any `t`, chosen once per drawing; `P3.flight` stops its window at a jump (`P3.span`) |
| 69 | the camera jumps to the other plane at a random moment | the subject chosen by a condition ("whoever is behind now") that flips | the subject from the plan of the shot; it changes only on planned cuts |
| 70 | the frame swings in one drawing when the target crosses close in front | the aim follows the target instantly | aim at `P3.lag` of the offset relative to the subject (0.3–0.5 s, from the shot start) |
| 71 | the chased plane drops out of its own chase camera | the aim pulled toward a far target by a fixed fraction | keep the subject within ~15° of the aim |
| 72 | a shot ends on empty sky, the cut lands on nothing | the action flew out of a fixed camera before the cut | pan with one of them; end on what the next shot starts with |
| 73 | a plane banks away from the side it breaks to | the roll sign from a world direction; a plane flying the other way gets it mirrored | roll in its own frame: lateral offset · direction of flight |
| 74 | a cloud hides the plane the shot is about | puffs between the camera and the subject | `world.keep: [the planes]` fades those puffs |
| 75 | jerks shipped although `frames --jumps` had flagged them | the flags were dismissed as "camera cuts" without looking | a cut is ONE changed frame; mark cuts as events; the detector reports bursts; look at every flag with `--around` |
| 76 | in a chase shot the plane stays still and the whole sky whips round in one or two drawings | the camera bolted to the plane: its attitude every drawing (rolls of 14° per drawing in a 9 g fight) | the camera follows the heading and bank lagged ~0.5 s (`P3.lag`), the horizon tilted by half the bank at most |
| 77 | the sky turns light/dark in one drawing while the camera rolls | a vertical gradient with the horizon from the pitch only | the gradient along world up as the frame sees it: `P3.horizon(cam, ...)` |
| 78 | the camera jumps when the target passes close to it | pushed "away from the target": the direction flips as it passes | push along a stable axis (up), by an amount that grows smoothly |

## Engravings (`engine/engraving.js`, `references/engraving.md`)
| # | symptom | cause | fix |
|---|---|---|---|
| 80 | a figure cut from a picture keeps a grey halo of its old background | the mask edge is feathered outwards, and local contrast lifts the background | `--mask ... --inset 6–9 --feather 3` |
| 81 | a face in shade becomes mush in the engraving | a global tone curve; lines too coarse for a small face | `--local 0.4–0.5`, `--spacing 3`, engrave at the size it is shown (`--height` 1500 for a full figure) |
| 82 | stipple engravings look sparse and noisy in the video | dots at video size; their probability follows a dark tone | `--style lines` (the default) |
| 83 | generated clouds look like stone balls or bubbles with holes | spheres or metaballs with normals from small puffs | engrave a public-domain cloud photo (NOAA) with `--fade` |
| 84 | the "image" downloaded from Commons does not open | throttled: the file is an HTML error page | a User-Agent, 2–3 s between requests; check every file with Pillow |
| 85 | a museum object keeps its grey gradient backdrop | `--bg` measures the colour at the border; a gradient differs from it | trace a mask on `--grid` |
| 86 | the twist is a full-frame violet wash, the subject a small figure in a corner | a long global flash plus a strong grid behind a figure that enters from off-frame | the subject big and centred from the first drawing; a flash ≤ 0.4 that dies in ~0.3 s; the grid a ghost (alpha ≤ 0.1) |
| 87 | an empty drawing between two objects that change on a bar line | the old one is gone before the new one starts to appear | the new one appears over the old one (cross-fade over ~0.3 bar) |
| 88 | a cast shadow is invisible | a black shadow on a black background | light the wall first (a gradient in the light's colour), then the shadow on it (`color: "#050507", colorA: 1`), then the figure |
| 89 | a part draft (`cartoon cut --size 960x540`) has everything in the wrong place | the scene uses fixed 1920x1080 coordinates | draft at the full size, or lay the scene out from `W`, `H` |

## Generative services (`scripts/gen.py`, `references/generate.md`)
| # | symptom | cause | fix |
|---|---|---|---|
| 90 | the same `--seed` gives another picture | only FLUX.2 [klein] 9B on Workers AI follows the seed (klein 4B, FLUX.2 dev, SDXL ignore it) | `--model klein9`, or keep the file: the cache and `SOURCES.md` keep it; do not regenerate a picture that is already engraved |
| 91 | a vision model reports a watermark, text or a hand that is not in the frame | it invents details | a hint only: look at the frame (`cartoon frames --zoom`) before changing anything |
| 92 | `transcribe` without the lyrics gives wrong words in the LRC | Whisper mishears sung words, more on a full mix | `--lyrics lyrics.txt` (the user's text, the voice's times) and the vocal stem |
| 93 | every call fails with code 3036 | the free 10 000 neurons of the day are used up | wait for 00:00 UTC or turn on the paid plan; the cache keeps what was made |
| 94 | an engraving of a generated dark object (wood, bronze) on black is almost empty | `--lo 0.5` blacks out a dark subject | `--lo 0.12 --hi 0.75 --gamma 0.9 --local 0.35` |
| 95 | keys end up in git | `.env` in a project that is pushed | keys in `~/.config/code-cartoon/keys.env` (`cartoon gen keys --from`); new projects ignore `.env` |
| 96 | a fal call is paid but no file arrives (`CERTIFICATE_VERIFY_FAILED` on `*.fal.media`) | the Python on Windows lacks the CDN's CA; the answer was dropped with the error | the answer is kept before the download; the download falls back to certifi, then curl; `cartoon gen fal <model> OUT --request <id>` fetches an earlier result for free |
| 97 | a fal model returns 422 for `image_url` | field names differ per model (Kling: `start_image_url`) | `cartoon gen info <model>` first; `gen video --image` reads the field from the schema |

## Sound
| # | symptom | cause | fix |
|---|---|---|---|
| 9 | the render is silent | `<audio>` has no `id`, or no `audio/mix.wav` | an `id` + run `cartoon audio` |
| 19 | loudness jumps from video to video | normalised by peak | `cartoon audio` normalises by LUFS (−15) + limiter |

## Song clips
| # | symptom | cause | fix |
|---|---|---|---|
| 48 | hits look a drawing late, the picture feels behind the beat | on twos the 12/s grid ignores the beat (up to 83 ms late) | beatLock (on by default with a song): a new drawing starts on every beat |
| 49 | lyric lines are off by a line or more | Suno sang something else than its text, or no stem was given | make `lyrics.txt` say what is sung; give `--vocals` (Suno: Get Stems) or fix `audio/song.lrc` + `cartoon song --lrc audio/song.lrc`; check `lyrics-preview.mp4` |
| 50 | a part starts a bar or two off | two parts with the same texture (same drums and chords) | look at `song.map.png`; an LRC places parts by their first line; check the tags against what is sung |
| 51 | the grid runs at half/double speed or bars are shifted by two beats | the tracker locked to half time; bass equal on 1 and 3 | `cartoon song --bpm-min/--bpm-max` around the real tempo; check the bar numbers on the map against the chorus |
| 52 | a cut starts mid-word or ends with a click | cut at an arbitrary second | `cartoon cut` cuts on bar lines (one bar before the chorus), fades in 20 ms and out 1.5 s |
| 53 | the clip is quieter than the song in Suno | the mix is normalised to −15 LUFS; Suno masters at −9…−12 | expected (platforms normalise to −14 anyway); do not stack loud effects on the song |
| 54 | lyrics run under the Reels interface in a 9:16 cut of a 16:9 clip | lyrics placed in fixed pixels | place them with `Sketch.fx.lyric` / `Sketch.safe()`; layout from the frame size |

## Rotoscope
| # | symptom | cause | fix |
|---|---|---|---|
| 17 | the whole background is hatched | a dark background falls into the "darkest 30 %" | `--shadow 0` or a light background in the source |
| 18 | lines are noisy dots | XDoG threshold too low / small details | `--threshold 0.18`, `--detail 1.3` |

## Platform (Windows, shells)
| # | symptom | cause | fix |
|---|---|---|---|
| 13 | lint: `missing_timeline_registry` | the timeline is registered only in an external js | an inline script with `window.__timelines` in `index.html` (in the templates) |
| 27 | Cyrillic looks like mojibake in python/sed output on Windows | the console is cp1251, the file is fine (UTF-8) | check bytes with `od -c` / grep the file; do not "repair" it; `cartoon` sets `PYTHONIOENCODING=utf-8` |
| 40 | `analyze_reference.py` fails with `UnicodeEncodeError` on Windows | cp1251 console, Cyrillic in the report | run through `cartoon` (UTF-8) or set `PYTHONIOENCODING=utf-8` |
| 43 | args from a Python helper arrive as `--template\r` in bash | Python on Windows prints CRLF; `"${x%$'\r'}"` inside double quotes does not strip it | `CR=$(printf '\r'); x=${x%"$CR"}` or `tr -d '\r'` |
| 44 | files written by a Python snippet get CRLF | text mode on Windows converts `\n` | `open(p, "w", encoding="utf-8", newline="\n")`; `.gitattributes` keeps LF in the repo |
| 45 | a Python subprocess runs "bash" and gets WSL ("execvpe(/bin/bash) failed") | `C:\Windows\System32\bash.exe` comes first on PATH | use the bash that runs us: `CARTOON_BASH` (exported by `cartoon`) |
| 46 | `node --check` fails on ES modules (`import`) | `.js` is CommonJS for node | check a `.mjs` copy (`cartoon selfcheck` does it) |
