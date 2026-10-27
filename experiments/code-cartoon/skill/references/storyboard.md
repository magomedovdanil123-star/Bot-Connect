# Story and storyboard

## Story (before any picture)
3–6 sentences: who/what, what changes, what the twist is, how it ends, what text is on screen.
A good short video = one idea and one transformation. Test: can you retell it in one sentence
"it was X -> click -> it became Y".

## Structure by length
| length | structure |
|---|---|
| 6–15 s | one continuous scene, 3–4 phases: appear -> develop -> **twist** -> poster |
| 20–60 s | a chain of 6–15 s scenes; the last object of a scene becomes the first of the next (morph / camera push / dive) — `Sketch.sequence` |
| 1–3 min | build from 10–30 s scenes, each its own project or sequence block; join on a shared object |

## Rules
1. **Twist** (click, hit, flash, fall, dive) at 35–45 % of the length. Before it: quiet, cold roles
   (`line`, `soft`, `a1`), the camera further away. After it: bright, big, warm (`warm`), camera closer.
2. **The last 3 s are a poster**: all text written, nothing fast moves; the lines still boil.
3. **The first frame is not empty** — it is the cover in the feed. Drawing starts before 0 (`t: -0.5` in cues).
4. **One action — one sound.** If something appears or hits, it has a cue with a sound type.
5. **Text must be readable in its time on screen**: ~3 words per second + 1 s. At most 2 lines at once.
6. **Safe zones in 9:16**: the bottom 15 % is empty (Reels/Shorts interface), ~12 % on the right
   (buttons) without important text; the top ~8 % is under the account name.
7. **Rhythm**: events on the music beat (`music.bpm` in cues; with their song — `cartoon beats --snap`):
   at 96 bpm a beat is 0.625 s.
8. **Transitions** by camera (push/pan), by shape (morph) or by iris between worlds — not by cuts,
   unless the style asks for it. When there are cuts (a clip, a 3D chase): on a bar line, on the action
   (the next shot starts with what the last one ended on), each one written in the storyboard and in
   `cues.js`.

## Table template (in `project.md`)
| time | drawn | camera | sound (cue id: type) |
|---|---|---|---|
| −0.5–1.6 | construction lines, the bulb contour | zoom 0.90, slight shake | outline: scribble |
| 0.6–1.8 | caption "first, a sketch" at the top | — | write1: write |
| 2.4–3.4 | hatching of the shadow | — | shade: hatch |
| **3.8** | **click: the filament lights, flash, rays** | punch-in 0.93 -> 1.03 outBack | twist: click, boom: thump, shine: chime |
| 4.2–5.2 | the caption becomes "then — light!" | — | write2: write |
| 5.6–6.6 | the title under the bulb | — | title: write, titlepop: pop |
| 7–10 | poster | still | music |

Translate the table into `cues.js` 1:1: one row = one event with `id`, `t`, `dur`, `type`.

## Clips to a song
The song sets the timing; the storyboard is by **parts**, not by seconds (`cartoon song` prints them):
| part | bars | time | world / palette | camera | motif / what grows | lyrics style | transition in |
|---|---|---|---|---|---|---|---|
| intro1 | 2 | 0–4.8 | pencil sketch of the motif, the title | still, 0.96 | a ray per beat | — | — |
| verse1 | 4 | 4.8–13.5 | graphite landscape, a new object per bar | travels one object per bar | — | write | iris |
| **chorus1** | 4 | **13.5**–22.2 | neon sun = the motif | kick on every bar | sparkle per beat | karaoke | flash |
| chorus2 | 4 | 31–39.7 | the same sun, bigger, a second ring | closer | the payoff (`sec.last`) | karaoke | flash |
| outro1 | 3 | 39.7–end | poster: the sun + the title | still | nothing fast | — | iris |
Rules: the twist is the first chorus; the chorus motif grows with each repeat; something new on every bar,
small hits on beats, big changes only between parts; a cut for Reels = one bar before a chorus to its end.
The way into the loudest part wants motion that grows (something spreading and speeding up, the camera
pulling back faster and faster), not a new still picture. A two-sided ending is shown, not said: a symbol
(a moth at a light) and a colour that changes on the last chord.
Details: `references/song-clip.md`.
