# References and the hybrid with a video model

## Three ways to use someone else's video
1. **As a source of rules** (main). Analyse 3–5 videos in one manner, write down the rules, draw your
   own. The picture is yours, the techniques come from the examples.
2. **As motion (hybrid / rotoscope).** A video gives live motion (a head turn, laughter, hair, a walk),
   the code redraws every drawing in style. This works around code's main limit — faces and bodies.
3. **As material in the frame.** A photo/video as a layer: collage (`fx.piece` with `img`), halftone
   (`fx.halftone` over a frame), tint by a palette role; a real photo in `--template photo3d`.

## 1. Analysing examples
```bash
cartoon analyze refs/ref1.mp4 -o refs/analysis/ref1
```
It measures drawings per second and the hold histogram (on ones/twos/threes), cuts and shot lengths,
the motion curve (where the peak = the twist, in % of length), the calm of the last 3 s (poster?),
the palette with shares and the background colour, loudness and the times of strong sound hits.
Plus `sheet.jpg` and frames.

Then **look at the frames** (Read the PNGs): line thickness and tapering, lifts, second pass, hatching
or fill, paper texture, glow, font, how transitions are built. Compare sound hits with motion peaks —
if they match, sound is made "for every action".

The result is a style table (6–10 rows) in `project.md` or a new section in `styles.md`. Map the
example's colours to roles: background -> `paper`, main line -> `line`, secondary -> `soft`, cold
accents -> `a1..a3`, the warmest/most saturated payoff accent -> `warm`.

Never: copy frames, characters, logos, recognisable illustrations. Allowed: timing, rhythm, drawing
rate, principles of line and colour, transition types.

## 2. Hybrid: video model / footage -> drawn style
1. Get a video with the motion: film it, take licensed stock or generate it with a video model
   (Veo, Kling, Sora and so on — outside this skill). Tips for generation: plain background, a clear
   silhouette, no cuts, 2–6 s, a static camera (add camera moves in code).
2. Trace:
   ```bash
   cartoon roto clip.mp4 . --name hero --fps 12 --width 900 --dur 4
   ```
   `--detail` < 1 gives more small lines, > 1 simpler and bolder; a higher `--threshold` gives fewer
   lines; `--shadow 0.3` is the share of the darkest areas to hatch (0 = off; 0 for dark backgrounds).
3. Load `refs/roto/hero/manifest.js` in `index.html` before `scene.js`; in the scene:
   ```js
   Sketch.roto.load("hero", window.ROTO["hero"]);            // before mount
   // in draw(d):
   Sketch.roto.draw(d.ink, "hero", { k: d.k, t: d.t - d.cue("hero"), x: 90, y: 420, w: 900, h: 1600 });
   ```
   Lines are tinted by a role (`color`), boil with `k`, shadows are hatched (`hatch`, `hatchColor`).
4. Draw your own elements on top: captions, arrows, accents, a glowing twist.
5. Check the sheet: lines are not dotted noise (raise `--threshold`), the face reads (lower `--detail`).

Only video the user has rights to. Real people's faces only with their consent.

## 3. Photo and video as material
- `Sketch.load({ p1: "refs/photo.jpg" })` -> `fx.piece(ctx, shape.torn(...), { img: Sketch.asset("p1"), tint: "a1" })`.
- Halftone over a photo: draw the photo into an offscreen canvas, `fx.halftone(ctx, off, { cell: 12 })`.
- A whole video layer: a regular `<video class="clip" data-start data-duration muted>` in `index.html`
  under the canvas (remove the paper fill in `post`, or use a separate layer).
- A real photo with a living camera, leaves, light and a 3D world: `--template photo3d` (`photo3d.md`).
