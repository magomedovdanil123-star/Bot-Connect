# Sketch engine — API (2D)

File: `engine/sketch.js` (global `Sketch`), loaded in `index.html` after `cues.js` and `palettes.js`,
before `scene.js`. The world is frame pixels (1080x1920 for 9:16); the camera is applied on top.

## Mounting
```js
Sketch.load({ photo: "refs/photo.jpg" });            // images — BEFORE mount, at top level
Sketch.roto.load("hero", window.ROTO["hero"]);       // rotoscope clips — also before mount

Sketch.mount({
  palette: "neon",                                    // a name from palettes.js
  palettes: ["lubok"],                                // other palettes used in this video (their paper is pre-rendered)
  fonts: ["700 80px Caveat", "800 80px Inter"],       // faces to wait for (default: Caveat, Inter, Ruslan Display)
  onTwos: true,                                       // false = draw every frame (tech style)
  fpsDraw: 12,                                        // drawings per second (8 = "on threes")
  camera: (t) => ({ fx: 540, fy: 960, zoom: 1, rot: 0, shake: 0.6 }),  // pure function of time
  setup: async (S) => { /* heavy preparation: offscreen canvases, precalculation */ },
  draw(d) { /* the whole frame */ },                  // or scenes: [...] — see "Several worlds"
  post(M, d) { /* optional: effects over the finished frame */ },
});
```
`mount` creates the layers, waits for fonts and images, renders the paper, registers a paused GSAP
timeline in `window.__timelines[id]` and `__hf.buildReady`; HyperFrames waits and seeks by time.
Preview in a normal browser: `index.html?t=3.5`.

## The frame object `d`
| field | meaning |
|---|---|
| `d.t` | time held to the drawing (on twos it changes 12 times/s). Animate with it. |
| `d.raw` | the real frame time |
| `d.k` | drawing index (int). Pass `k` to every pen — the lines boil with it |
| `d.ink`, `d.glow` | 2D contexts of the layers (camera applied). `glow` is drawn on top and gets bloom |
| `d.col(role, a)` | colour of a role: `d.col("a1", .5)` |
| `d.cue(id)`, `d.cueEnd(id)` | event time from `cues.js` (`t` and `t + dur`). Also `Sketch.cue(id)` |
| `d.W`, `d.H`, `d.pal`, `d.cam`, `d.zoom` | frame size, current palette, main camera, current zoom |
| `d.setPalette(name)` | switch this frame's world: roles **and** the paper under the ink |
| `d.useCamera(ctx, cam, scale)` | draw a world with its own camera (line widths follow its zoom) |
| `d.screen(ctx, fn)` | draw in frame pixels (frames, captions, flashes), whatever the camera |
| `d.paper(name)` | the paper canvas of a palette (to paint it inside an iris) |
| `d.caption(id)` | `{ text, p, alpha }` of a `caption`/`voice` cue, or null |

## Time and easing
`Sketch.prog(t, t0, t1)` -> 0..1 · `lerp(a,b,k)` · `clamp` · `ease.linear|in|out|inOut|outBack|outElastic|pop`
(`pop` = 0 -> 1.12 -> 1, a jump for appearances).

## Randomness
`Sketch.rng(...keys)` -> generator `r()` + `r.range(a,b)`, `r.int`, `r.pick`, `r.sign`, `r.gauss`.
Keys are the object's identity: `rng("star", i)` is stable; `rng("star", i, d.k)` changes every drawing
(boil). `Sketch.noise1(x, seed)` is smooth noise 0..1.

## Shapes -> point arrays `[{x,y}]`
`shape.line(x0,y0,x1,y1)` · `circle(cx,cy,r)` · `ellipse(cx,cy,rx,ry,{a0,sweep,n})` · `arc(cx,cy,r,a0,a1)` ·
`rect(x,y,w,h)` · `poly(cx,cy,r,sides)` · `star(cx,cy,r1,r2,spikes)` · `wave(x0,y,x1,amp,waves)` ·
`zigzag(x0,y0,x1,y1,teeth,amp)` · `torn(x,y,w,h,seed,rough)` (torn paper edge) ·
**`svg(d, {x,y,scale,step})`** -> sub-paths of an SVG path: any icon or logo.

Geometry: `geo.transform(pts,{x,y,scale,rot,ox,oy})` · `geo.morph(A,B,k,{n,closed})` (one shape becomes
another) · `geo.resample`, `geo.resampleN`, `geo.length`, `geo.bbox`.

## Pens
```js
pen.stroke(ctx, pts, { k, seed:"id", width:4, color:"line", alpha:1, progress:1,
  closed:false, wobble:1.6, breaks:1, taper:[.12,.18] | false, pressure:.25, sketch:true, overshoot:.05,
  zoomComp:true })                                 // -> pen tip {x,y} at `progress`
pen.strokes(ctx, [pts1, pts2, ...], {...})          // several lines in a row on one progress (svg icons)
pen.guide(ctx, pts, { k, seed, progress, fade })    // construction line, fades with `fade` 0..1
pen.hatch(ctx, polygon, { k, seed, angle:-.7, spacing:9, width:1.6, color:"soft", alpha:.85,
  progress, jitter:3, cross:false, style:"hatch"|"zigzag", tint:0 })   // tint: flat wash under the strokes
pen.fill(ctx, polygon, { k, seed, color:"a1", progress })               // marker fill for accents
pen.crayon(ctx, polygon, { k, seed, color:"sky", angle })               // child's wax crayon
pen.marker(ctx, pts, { k, seed, color:"black", closed })                 // felt-tip outline, even width
pen.flat(ctx, polygon, { k, seed, color:"a1", outline:3.6 })             // print colour + bold contour (lubok)
pen.text(ctx, "text", x, y, { k, font:"700 110px Caveat", color:"line", align:"center",
  progress /* write-on */, maxWidth, lineHeight:1.05, alpha, outline })
```
`seed` is unique per object. Without `k` a line does not boil. `progress` 0..1 is how much is drawn.
**Zoom-aware lines:** width, wobble and hatch spacing are multiplied by `zoom^-0.75` of the current
camera (`Sketch.config.zoomComp`, 0 = off; `zoomComp:false` per call). A 5x push-in does not turn
pencil lines into ropes. Offscreen caches and the paper are drawn without it.

## Paper and grain
The paper is rendered once per palette (`kind`: plain, grid, notebook, blueprint, chalk, kraft,
newsprint, dots) with a 30 % margin for camera moves. The paper grain knocks out the ink
(`Sketch.config.grain`, 0 = off). `Sketch.config.paperJitter` shakes the sheet between drawings (0.8 px).

## Cameras
A camera is `{ fx, fy, zoom, rot, shake }`: world point (fx, fy) at the frame centre. The old form
`{ x, y, zoom }` (offset from the centre) still works.
```js
const cam = Sketch.cam.keys([                       // keyframes; zoom moves in log space (even push-ins)
  [0,   { fx: 960, fy: 540, zoom: 1 }],
  [3.2, { fx: 1240, fy: 420, zoom: 1.22 }, "in"],   // the ease of a key = the segment that ends at it
]);
Sketch.cam.anchor(worldPt, screenPt, zoom)          // keep a world point at a screen point while zooming
Sketch.cam.zlerp(a, b, u)                           // zoom interpolation in log space
d.useCamera(d.ink, cam(t)); d.useCamera(d.glow, cam(t));  // a world with its own camera (worlds of other units: 3rd arg = scale)
```

## Several worlds: `Sketch.sequence`
```js
Sketch.mount({
  palette: "graphite", palettes: ["lubok"],
  scenes: [
    { id: "sketch", from: -1, to: Sketch.cue("twist"), palette: "graphite", camera: camA, draw: drawSketch },
    { id: "print",  from: Sketch.cue("twist"), to: 99, palette: "lubok", camera: camB, scale: 1,
      in: { type: "iris", dur: 0.8 }, draw: drawPrint },          // "cut" | "iris" | "flash"
  ],
});
// draw(d, s): s = { t: seconds since the scene started, p: 0..1 through it, scene }
```
Each scene gets its palette (roles + paper) and camera. During an iris both scenes are drawn; the
incoming one is painted with its own paper inside a growing circle with a gold ring. `flash` = a cut
under a soft flash. Example: `cartoon example lubok-sun-ship`.
Keep a picture of one world inside another (a drawing on a table, a TV screen) in
`Sketch.cache(key, w, h, (ctx, w, h) => {...}, { palette: "crayon" })` and draw the cached canvas; the
palette is pinned inside the cache, so a cache miss never repaints it in the wrong world's colours.

## Effects
```js
fx.iris(ctxOrList, r, fn, { cx, cy })              // fn draws only inside a screen-space circle
fx.irisRing(ctx, r, { color:"warm", alpha })       // the glowing edge of an iris
fx.flash(ctx, a, { color:"warm", radius, cx, cy }) // soft radial flash, keep a <= 0.6 on the glow layer
fx.ornamentFrame(ctx, p, { k, band:54 })           // lubok border, draws on with p 0..1 (screen space)
fx.ribbon(ctx, "TEXT", cx, cy, w, p, { k, out, font })   // lubok banner; p writes it, out fades it
fx.halftone(ctx, srcCanvas, { cell:10, angle:.26, color:"line", gain:1, useAlpha:false })
fx.misregister(ctx, layerCanvas, dx, dy, "a1", .8)      // second colour slightly off-register
fx.piece(ctx, polygon, { img, zoom, ix, iy, tint, color, edge, shadow })  // a collage piece
Sketch.asset("photo")                                   // a loaded image
Sketch.roto.draw(ctx, "hero", { k, t, x, y, w, h, color:"line", hatch:true, hatchColor:"soft", loop })
```

## Captions from cues
`caption` and `voice` cues carry `"text"`. `d.caption(id)` returns `{ text, p, alpha }` while it shows
(from `t` to `t + dur`, plus a short hold and fade); `Sketch.captionsAt(t)` returns all of them. Voice
cues get their `dur` from `cartoon voice --fit`, so the text matches the speech.

## Song clips (cues "song" from `cartoon song`)
```js
Sketch.mount({
  palette: "neon",
  scenes: Sketch.songScenes({                       // one world per kind of part; "*" = everything else
    verse:  { palette: "graphite", camera: (t, l) => cam, draw: (d, l) => {} },
    chorus: { palette: "neon", draw(d, l) { const big = 1 + 0.2 * l.sec.n; /* l.sec.last = the payoff */ } },
    "*":    { palette: "graphite", draw: drawVerse },
  }),
});
```
| call | returns |
|---|---|
| `d.beat` / `Sketch.beat(t)` | `{ i, t0, len, phase, bar, beatInBar, barPhase, bpm }` on the song's grid (extended before/after) |
| `d.pulse(o)` / `Sketch.pulse(t, o)` | 1 on a hit, decaying: `{ grid: "beat"\|"bar"\|"half", decay: 0.22, accent: [1,.55,.8,.55] }` |
| `d.energy` / `Sketch.energy(t)` | loudness of the song 0..1 |
| `d.sec` / `Sketch.section(t)` | `{ id: "chorus2", label, n, of, last, i, from, to, bars, t, p }` |
| `d.cue("chorus2")`, `d.cueEnd(...)` | start / end of a part (events with that id win) |
| `d.lyric(o)` / `Sketch.lyrics.at(t, o)` | the line on screen: `{ text, words: [{w,t0,t1,p}], sung, p, alpha, next, backing }` or null |
| `Sketch.fx.lyric(ctx, line, o)` | draws it, frame pixels (inside `d.screen`): `style: "write"\|"karaoke"\|"stamp"\|"ribbon"`, `x, y, font, color, sungColor, restColor, maxWidth` |
| `Sketch.safe()` | `{ x, y, w, h }` the area platform interfaces leave free (9:16: bottom 15 %, right 12 %, top 8 %) |
| `Sketch.cam.kick(cam, pulse, 0.03)` | the camera punches in on a hit |
| `d.window` | `{ from, to, cut, left }` — in a cut (`cartoon cut`) the stretch of song it shows |
Transitions of `songScenes`: into a chorus a soft flash (1 beat), into another kind an iris (2 beats), the
same kind again a cut; `in:` per kind (or `(sec, prev) => ...`) overrides. **beatLock** (on with a song,
`mount({ beatLock: false })`): on twos a new drawing starts exactly on every beat. Example and starter:
`cartoon example song-clip`, `--template clip`; the whole pipeline: `references/song-clip.md`.

## Pencil 3D
`engine/pencil3d.js` (loaded by the template after `sketch.js`) adds `P3`: meshes (`P3.mesh().loft()
.wing().slab().fin().decal().rod().done()`), `P3.camera`, `P3.object`, `P3.puff`, `P3.cumulus`,
`P3.flight` (a banked attitude from a path; its window stops where the path jumps), `P3.track` (a path from
simulated samples), `P3.lag` (a camera aim that lags), `P3.horizon` (a sky gradient that tilts with the
camera), `P3.line` (trails) and `P3.draw(d, cam, list, world)`
(`world.keep`: puffs never hide these points). Draw it inside a normal scene; full guide: `pencil3d.md`.

## Engravings
`engine/engraving.js` (loaded by the template) adds `Sketch.engraving`: `load(names)`, `decode` (as
`setup`), `draw(ctx, name, { t, x, y, h, tint, dark, reveal, glitch, flip, color })` -> `{ P(px, py) }`,
`crop(ctx, [name, sx, sy, sw, sh], x, y, w, h, { t, tint })`, `variant(t)`. Pictures come from
`cartoon engrave`; full guide: `engraving.md`.

## Palettes
`Sketch.usePalette(name)`, `Sketch.withPalette(name, fn)`, `Sketch.col(role, a)`, `Sketch.has(role)`,
`Sketch.mix(hex1, hex2, k)`, `Sketch.rgba(hex, a)`. Roles: `paper tooth line soft guide a1 a2 a3 warm` +
`glow` (0..1), `shade` (dark|light), `kind`. `crayon`, `lubok` and `cosmos` add crayon roles
(`sheet navy violet sun orange red sky green grey black brown hair skin cheek`); `cosmos` also has 3D
roles. A new palette = a new object in `palettes.js` (strict JSON between the markers); check it with
`cartoon palettes .`.

## Minimal scene
```js
const PALETTE = "graphite";
const { pen, shape, ease, prog } = Sketch;
const house = shape.svg("M10 80 L50 20 L90 80 Z M25 80 L25 120 L75 120 L75 80", { x: 290, y: 600, scale: 5 });
Sketch.mount({
  palette: PALETTE,
  camera: (t) => ({ fx: 540, fy: 960, zoom: 1 + 0.05 * ease.inOut(prog(t, 0, 10)) }),
  draw(d) {
    const { k, t, ink } = d;
    pen.strokes(ink, house, { k, seed: "house", width: 5, progress: prog(t, d.cue("house"), d.cueEnd("house")) });
    pen.text(ink, "Home", 540, 1400, { k, font: "700 120px Caveat", progress: prog(t, d.cue("title"), d.cueEnd("title")) });
  },
});
```
