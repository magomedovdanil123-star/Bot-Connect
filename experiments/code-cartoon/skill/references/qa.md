# Checking: frames and the final file

Why show the user something where you can spot the mistake yourself. Check before showing.

## Which frames to take (8–12)
`0` (cover) · the middle of every phase · `twist − 0.05` and `twist + 0.1` · the first frame after every
text appears · `L − 3` (start of the poster) · `L − 0.1` (last). Plus the last frame before and the first
after every scene change.
```bash
cartoon snapshot --at 0,1.2,3.75,3.9,5.5,7,9.9
cartoon sheet .hyperframes/artifacts/snapshots/<id>/ -o sheet.jpg
```
Open the sheet AND 2–3 frames at full size (lines and text are invisible on a sheet).

## Look closer where the sheet cannot help
```bash
cartoon frames out.mp4 --zoom 640,40,620,560 --at 20.9,21.0,21.1 --scale 2   # faces, eyes, small text
cartoon frames out.mp4 --twitch 700,180,260,160 --from 20 --to 24             # what must hold still
cartoon frames out.mp4 --jumps --cues cues.js                                  # unplanned pops
```
`--twitch` compares a region with its own temporal median and lists frames that change far more than
the line boil (a pupil that jumps, a sprite that gets clipped, a texture that flickers).
`--jumps` lists whole-frame changes that do not sit on a cue time. A cut is ONE changed frame: several big
changes within half a second are reported as a burst (the frame settles or swings after a cut). Never
dismiss a flag as "just a camera cut": mark the planned cuts as events (`"type": "none"`; a flash with its
`dur`), and look at the rest drawing by drawing:
```bash
cartoon frames out.mp4 --around 117.6,124.5    # 3 drawings before, 5 after each time, one row per time
```

## A frozen frame means an exception
If a snapshot or a render shows the same frame from some time on (or a black/empty world), the scene
threw an error at that time and the page kept the last good picture. `cartoon check-hf` runs the
HyperFrames checks and lists `page_error` with the message. Run it after every big change to `scene.js`.

## Checklist on the sheet
- [ ] The story reads **without sound**: "it was -> twist -> it became" is clear from the sheet.
- [ ] The first frame is not empty and not dark (it is the cover).
- [ ] The last frame is a poster: all text written, the composition is complete.
- [ ] Text: capital height >= 48–56 px per 1080 px of width (Caveat >= 80 px, Inter >= 66 px), slogan >= 64 px.
- [ ] Text is not covered by motion and not in the bottom 15 % (red on the sheet) or the right 12 %.
- [ ] Nothing jumps that should stand (compare neighbouring frames: line boil <= 2 px is normal, an object jump is not).
- [ ] Every cut is clean (`--around`): the first drawings of a shot are as calm as the rest, the last ones
      still show the action (not empty sky), nothing turns or swings in the drawings next to the cut.
- [ ] The frame is not overloaded: one main object, small things in the faint `soft` role.
- [ ] Neon is not blown out: at most 3 glowing accents at a time, text under glow is readable.
- [ ] No "foreign" colours (when in doubt: `cartoon palettes .` — the frame must look right in every
      palette; if not, a colour is hard-coded somewhere).
- [ ] Hatching on light paper = shadow, on dark paper = light (not a "negative").
- [ ] Faces and eyes at full size (`--zoom`): nothing clipped, nothing twitching.

## The final file
```bash
cartoon check out.mp4 --duration 10 --fps 24 --size 1080x1920
```
- length = `data-duration` (±0.1 s), 24 fps, size, `yuv420p`;
- sound present, −16…−14 LUFS, true peak <= −1 dBFS, no long silence; size warning above 100 MB;
- look at `out.first.png` and `out.last.png`;
- check the holds on twos: `cartoon analyze out.mp4` -> verdict "on TWOS".

## Critic (for important videos)
Give `sheet.jpg` + the story to a separate agent that has not seen the code: "find everything that
stops the story reading without sound, small text, clutter, jumps". Fix, shoot again. Ask the user
first: it is an extra run.

## Long videos: show it in stages
For anything over ~30 s (a clip, a 3D world): keyframes first (`cartoon snapshot`), then each part as
a draft (`cartoon cut <part> --from X --to Y --size 1920x1080`, render inside `cuts/<part>`), the
full render only after the parts are approved. Keep every version beside the last one: `out-v3.mp4` +
`versions/v3/` with the sources, never overwrite a version the user has seen.

## Say honestly what was not checked
The sound was not listened to (metrics only) · frames between the checked ones were not viewed ·
not checked on a phone · the Cyrillic font was checked only on the given words.
