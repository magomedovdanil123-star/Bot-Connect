# Sound

Sound is code, like the picture. `cartoon audio` (scripts/synth_audio.py) reads `cues.js` and puts every
sound exactly on its event time. Seeded: running it again gives the same file. No samples, no licences.

## Effect types (`type` in cues.js)
| type | what you hear | when | `dur` |
|---|---|---|---|
| `scribble` | pencil on paper (gesture rustle) | a contour is being drawn | yes — how long it draws |
| `write` | quick writing rustle | text is written | yes |
| `hatch` | rhythmic hatching | hatching / fills | yes |
| `erase` | eraser | erasing | yes |
| `click` | click | the twist, a button, a switch | — |
| `tick` | soft tick | dots, small appearances, a wink | — |
| `thump` | low hit | landing, the twist, weight | — |
| `pop` | "pop" | an object or plate appears | — |
| `whoosh` | whoosh rising in pitch | fast motion, rays, push-in | yes |
| `chime` | bell | insight, "correct", a hello | — |
| `sparkle` | sparkles (three bells) | glitter, stars | — |
| `swell` | rising noise | the lead-in to a twist (1–2 s before) | yes |
| `paper` | paper rustle | a collage piece, a card standing up | — |
| `page` | page turn | a book, a pop-up, a new chapter | — |
| `rumble` | engine rumble | rockets, machines, trains | yes |
| `magic` | a rising run of soft bells + air | transformation, a dive into a picture | yes (~1 s) |
| `wind` | slow gusts | outdoor ambience | yes |
| `voice` | the narrator's line (see below) | narration | from `cartoon voice --fit` |
| `caption` | silence (text only) | on-screen text without speech | yes |
| `none` | silence | an event for the picture only | — |
Fields: `gain` (dB), `pan` (−1…1). A negative `t` trims the head of the sound (the drawing is already
running on frame 0).

## Music moods
`"music": {"enabled": true, "mood": "musicbox", "bpm": 96, "root": "A", "twist": "twist", "gain": -6}`
- `musicbox` — sparse music-box notes in minor before the twist, a major pad and arpeggio after (default).
- `folk` — a lonely plucked string over a drone before, a dancing major-pentatonic tune with
  balalaika-like tremolo after (Karplus-Strong strings). Good for lubok and fairy tales.
- `space` — dark pads and echoing pings before, an open major add9 pad with echoing arpeggios after.
No music: `"enabled": false` or `cartoon audio --no-music`.

## Narration
```json
"voice": {"engine": "piper", "model": "ru_RU-irina-medium", "rate": 1.0},
{"id": "line1", "t": 0.4, "type": "voice", "text": "Once upon a time there was a boy."}
```
`cartoon voice --fit` speaks every `voice` cue into `audio/voice/<id>.wav` (cached by text + voice) and
writes the spoken length into its `dur`, so captions (`d.caption(id)`, photo3d `#cap`) match the speech;
it warns when a line runs into the next. Then `cartoon audio` mixes it and **ducks** music, effects and
other tracks under the voice (~9 dB, reported as "ducking: −8.4 dB under the voice").
Engines:
- `piper` — local neural TTS, `pip install piper-tts` (GPL-3.0, a separate program, not bundled).
  Voices download once into `~/.cache/code-cartoon/piper`: Russian `ru_RU-irina-medium`,
  `ru_RU-denis-medium`, `ru_RU-dmitri-medium`, `ru_RU-ruslan-medium`; English `en_US-lessac-medium`,
  `en_US-amy-medium`, `en_GB-alan-medium` and more. Each voice has its own licence (MODEL_CARD on
  huggingface.co/rhasspy/piper-voices): check it before commercial use.
- `system` — the OS voice, nothing to install: Windows SAPI (`"lang": "ru-RU"` picks "Microsoft Irina"),
  macOS `say`, Linux `espeak-ng`. Lower quality, always available.
- `cloud` — a speech service (`references/generate.md`, keys via `cartoon gen keys`): Cloudflare
  `"model": "aura-2-en"` with `"speaker": "orion"` (40 English voices), `aura-2-es`, `melotts`
  (`"lang"`: en es fr zh jp kr). No Russian there. Free within the daily neurons, then per character.
- `files` — the user's own recordings: `audio/voice/<id>.wav` or `"file": "path"` on the cue.

## Your music, your rhythm
- Mix any file: `"tracks": [{"file": "audio/song.mp3", "gain": -2, "t": 0, "from": 12.5}]`
  (`t` = where it starts in the video, `from` = where to start inside the file). `"duck": true` makes
  a track behave like narration (everything else ducks under it).
- `cartoon beats audio/song.mp3` -> tempo, beats, bars (downbeats from the bass), an energy curve and
  a twist candidate (the strongest rise between 25 % and 70 %), plus `song.beats.png` — look at it.
- `--snap cues.js` moves events marked `"snap": "beat"` / `"bar"` onto the grid (`--all` = every sound
  event), `--twist` puts the twist on the candidate; synthesized music is switched off and the song is
  added to `tracks`.

## A clip to a song
`cartoon song --song s.mp3 --lyrics l.txt [--vocals v.wav | --lrc s.lrc]` goes further than `beats`: the
parts of the song, every lyric line ("lyric" cues, silent in the mix), the song in `tracks`, synthesized
music off, the length of the video = the song. Effects you add stay quiet under it (−8…−12 dB): the song
is already mastered. A cut (`cartoon cut`) mixes only its stretch of the song with a 20 ms fade in and a
1.5 s fade out. Everything else: `references/song-clip.md`.

## Loudness and mix
- Result: **−16…−14 LUFS** integrated (target −15), **true peak <= −1 dBFS** (soft limiter).
- Frame-accurate within 40 ms because the time comes from the same constant. After any change of
  length or timing **always** run `cartoon audio` again (pitfall "sound drifted").
- Check the final MP4 with `cartoon check` (ebur128, silences > 1.5 s).
- Under narration the music sits ~9 dB lower (ducking); do not lower it by hand as well.

## Add a sound
A new function `v_<name>(rng, ...)` in `synth_audio.py` + a line in the `gen` table + a row in the
table above + the type list in `assets/template/cues.js`. `cartoon selfcheck` verifies that every type
used in the templates exists.
