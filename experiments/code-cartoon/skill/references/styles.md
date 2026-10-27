# Styles: DNA and recipes

DNA = 6–10 rules without which a style is not recognised. Take them from here instead of guessing.
If the user brought references, the rules from `cartoon analyze` beat this file.
Add a new style here with the same template.

Common to all hand-drawn styles:
- **On twos**: 24 fps video, 12 drawings/s (`fps_draw: 12`, `onTwos`). No motion blur.
- **Lines boil**: every drawing is traced again (`k` in every pen call). Even on the poster.
- **Human defects**: pencil lifts (`breaks`), pressure and tapered ends (`taper`, `pressure`), a second
  sketchy pass (`sketch`), a closed contour runs past its start (`overshoot`).
- **Hatching instead of fills**; paper with grain, fibres, stains, eraser ghosts.
- **Construction lines** at the start of a scene (`pen.guide`), then they fade (`fade`).
- Transitions by camera (`camera(t)`, `Sketch.cam.keys`) and by shape (`geo.morph`), not by cuts;
  between worlds by an iris (`Sketch.sequence`).

---

## Pencil / graphite — palettes `graphite`, `neon`, `mystic`
- Line 3–6 px, `wobble` 1.4–2.2, `breaks` 1, second pass on.
- Tone only by hatching `pen.hatch` (spacing 8–12), cross-hatching (`cross:true`) for deep shadows.
- Light paper: hatch the shadow. Dark paper: hatch the light; glow (`glow` in the palette) only on accents.
- Draw accents on `d.glow` (it gets bloom), the main line on `d.ink`.
- Text: Caveat 700, written on with `progress`.
- Sound: `scribble` for every contour being drawn, `hatch` for hatching, `write` for text.

## Chalk on a blackboard — `chalk`
- Thicker line (6–9 px), `pressure` 0.5 (chalk crumbles), engine `grain` 0.5–0.6 (`Sketch.config.grain`).
- Sparse, wide hatching (spacing 14–18, width 3).
- Old chalk smudges are already in the paper; add a couple of `pen.guide` with alpha 0.1 as "not erased".
- Pastel accents (a1–a3), almost no glow (0.25).
- Sound: `scribble` with `gain` −2 (chalk is louder), `tick` for dots.

## Blueprint — `blueprint`
- Thin even lines 2–3 px, `wobble` 0.8, `breaks` 0.5 — an engineer is neater than an artist.
- Many construction lines, dimension arrows, Inter 400 capitals, callouts.
- Even hatching at 45° (`jitter` 1).
- Appearance: axes grid, then contour, then dimensions. Twist: the part "comes alive" in `warm`.

## Squared notebook — `notebook`
- Ballpoint pen: 3 px line of even width (`taper:false`), `pressure` 0.1.
- Marker fill: `pen.fill` (dense hatching + translucent base), `style:"zigzag"` for a childish colouring.
- Caveat captions, hand arrows, circle what matters (`shape.ellipse` + `closed:true`).
- The red margin line is in the paper; text stays right of it.

## Kraft paper — `kraft`
- Dark brown line 4–6 px, white gel-pen highlights (role `a1` = white).
- Hatch the shadow in brown (`soft`), the light with short white strokes.
- Red and blue look like stamps: `fx.piece` with a thin torn shape.

## A child's crayon drawing — `crayon`
- White sheet, every object in a **white halo**: the child colours around objects, not up to them.
- Night/sky is a **scribble** of long zigzag strokes (navy with a few black ones), drawn once into a
  cache (`Sketch.cache(..., { palette: "crayon" })`); a second colour streak with a ragged edge.
- Objects: `pen.crayon` fill (wax base + zigzag strokes) + `pen.marker` black outline of even width.
- Simple faces: dot eyes, an arc smile, round cheeks in orange; rays as zigzag rings.
- Stars are crosses (+ and x) in yellow/orange; small dots.
- Before the drawing "comes alive" it is still (freeze `k`); when it comes alive the lines start to boil.
- Example: `cartoon example crayon-drawing`. Recipe: `recipes.md` → "Bring a drawing to life".

## Lubok / Bilibin print — `lubok`
- Cream paper, **flat colour** (`pen.flat`) with a **bold dark contour** (3–4 px, little wobble, no second pass).
- Colours: cinnabar red (`a1`), deep green (`a2`), indigo (`a3`), gold (`warm`), plus crayon roles.
- Ornament everywhere: dot rows on bands, zigzags on sails and noses, a ring of red dots in the sun.
- Water = rows of scalloped waves with white curls (Bilibin); sky = flat cream with a few outlined clouds.
- The sun has a face: almond eyes with pupils, brows, a nose line, red cheeks, a smile; rays alternate
  triangles and wavy flames.
- Frame: `fx.ornamentFrame` drawing on around the screen; title on `fx.ribbon` in Ruslan Display.
- Music `folk` (plucked strings over a drone). Example: `cartoon example lubok-sun-ship`.

## Retro halftone — `retro`
- Draw the illustration in an offscreen canvas with solid shapes (gradients/fills), print it with
  `fx.halftone` (cell 10–18, angle 0.26) in a role colour.
- Misregistration: `fx.misregister` with a second colour 4–8 px off.
- Contour in thick ink (`line`, 6–8 px, `wobble` 1), no second pass.
- Jerky motion on twos or threes (`fps_draw: 8` for an old-print feeling).
- Text: Inter 800 capitals, slightly rotated.

## Newspaper collage — `collage`
- Every object is `fx.piece(ctx, shape.torn(...), {img|color})`: torn edge, white rim, shadow.
- Load the user's photo with `Sketch.load({key:"refs/photo.jpg"})`, tint it `tint:"a1"`.
- Stop-motion: positions change only on drawings (on twos/threes), a slight ±1–2° turn every drawing (`rng(id, k)`).
- Titles are letters from different "newspapers": each word with its own font/plate.
- Sound: `paper` when a piece appears, `pop` when it sticks.

## Tech motion / glass and chrome 3D — `--template 3d`
- Three.js, scene = f(t), `renderer.setPixelRatio(1)`, fixed size.
- Materials: chrome `MeshStandardMaterial{metalness:1, roughness:.1}`, glass
  `MeshPhysicalMaterial{transmission:1, thickness, ior:1.45}`, environment `RoomEnvironment`.
- Particles: positions from a seeded generator, motion a pure function of t (no simulation).
- Twist: particles snap into a shape/ring, the camera punches in, the light turns `warm`.
- Text: HTML over the canvas (GSAP tweens on the same timeline), Inter 800.
- These are particles, geometry and logos — not characters with facial animation.

## Coloured-pencil 3D — `engine/pencil3d.js`, palettes `sky`, `storm`, `dusk`
- Real 3D meshes (bodies, airfoil wings, plates) projected onto the pencil canvas: flat sunlit fills,
  coloured-pencil hatching on every face, cross-hatching in the shade, boiling outlines along
  silhouettes and creases, on twos like the rest. Insignia and damage as decals.
- Cumulus clouds from flattened bumpy puffs with a pencil rim on the sunlit tops; the sun behind.
- Comes after a 2D pencil intro (an iris or a flash into the 3D world); the camera changes with the
  parts (side, chase, over the tail, into the sun). Details: `pencil3d.md`.

## Engravings from pictures — `engine/engraving.js`, `cartoon engrave`, a dark palette
- Museum statues, frescoes, old prints, cloud photos, the user's own cover: white engraver's lines on
  black (`cartoon engrave`), three variants that swap 6 times a second (the lines boil).
- Coloured light on the lines (`tint`), darkness round a light (`dark`), printed from the top
  (`reveal`), CRT tearing on hits (`glitch`); one accent colour per force.
- Around them: thin radiating rays, a checker grid pulled into a point, small windows with crops,
  circuit traces, CRT lines in `post`. Titles in a Garamond-like serif. Details: `engraving.md`.

## Photo + 3D — `--template photo3d`
- A **real photo** with a living camera (slow Ken Burns), falling leaves in front (blurred near ones),
  a warm light leak, film grain, vignette: realism comes from the photo, not from 3D people.
- A picture (a child's drawing, a poster, a map) lies on a wooden surface and **pops up** like a book.
- A dive into a card under a gold flash leads into a 3D world built from the picture's colours
  (planets, a sun with a face, stars, nebulae), then back to the photo with a souvenir (a gold star).
- Captions in Lora; narration through `cartoon voice`. Details: `photo3d.md`.

## Hybrid: live motion + style — any palette
- A video (your own, licensed stock or generated by a video model) -> `cartoon roto` -> lines at 12
  drawings/s -> `Sketch.roto.draw` with boil and hatched shadows.
- Your own drawn elements on top (captions, arrows, accents).
- Dark background in the source -> `--shadow 0` (otherwise the whole background gets hatched).
- Details: `references-and-hybrid.md`.

## Drawn infographics
- Charts are drawn by pen from data: axes `pen.guide` -> the line `pen.stroke` with `progress` ->
  star points on key values -> Caveat labels.
- Counting numbers: `Math.round(lerp(a, b, ease.out(prog(t, t0, t1))))` in `pen.text`.
- One main number per frame, the rest faded (`soft`).
