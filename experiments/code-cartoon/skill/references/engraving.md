# Engravings from pictures

Museum statues, frescoes, old prints, patent drawings, cloud photos and the user's own cover art, turned
into white engraver's lines on black and drawn with coloured light. Real pictures give faces, drapery and
marble that code cannot draw; the engraving makes them one world and keeps them from looking like
pasted photos. Tested on a 2.5-minute clip ("Hermes Brings AI": Prometheus, Zeus, Adam, a temple, the
user's cover, gold and violet light, 15 shots on bar lines).

## The pipeline
1. **Find sources with a licence you can publish** (below) and keep them in `refs/`, with a
   `refs/SOURCES.md` line per file: title, author or museum, licence, the Commons file name.
2. **Trace**: `cartoon engrave refs/zeus.jpg refs/zeus --grid 100` writes `refs/zeus-grid.jpg`, the
   source with a labelled grid in source pixels. Read `--crop` off it, and for a cut-out a polygon
   (`refs/zeus-mask.json`, `[[x, y], ...]` in source pixels).
3. **Engrave** into the project: `cartoon engrave refs/zeus.jpg assets/eng/zeus --height 1100 ...` writes
   3 variants (`zeus-0.png` .. `-2.png`): white lines with alpha. Make `--height` about the size it will
   have on screen (the largest one); `--preview` writes a jpg to look at. Keep the commands in a
   `tools/build_assets.sh` of the project: the look gets tuned many times.
4. **Draw** with `engine/engraving.js` (loaded by the template):
```js
const E = Sketch.engraving;
E.load(["zeus", "temple"]);                       // top level: assets/eng/<name>-0..2.png
Sketch.mount({ setup: E.decode, draw(d) {
  const Z = E.draw(d.ink, "zeus", { t: d.t, x: 960, y: 560, h: 1100,
    tint: [{ x: 600, y: 400, r: 700, color: "#9a6bff", a: 0.6 }],     // coloured light on the lines
    dark: { x: 1400, y: 300, r0: 300, r1: 1400, min: 0.1 },           // only what a light reaches
    reveal: Sketch.prog(d.t, -2, 2),                                   // printed from the top
    glitch: 30 * d.pulse({ grid: "bar", decay: 0.1 }) });             // CRT tearing on a hit
  const eye = Z.P(390, 400);                        // a pixel of the engraving -> view coords (anchor glows, sparks)
  E.crop(d.ink, ["zeus", 300, 330, 330, 130], 60, 60, 330, 130, { t: d.t, tint: "#9a6bff" });   // an eye in a window
}});
```
   The variants swap 6 times a second: the lines boil like a hand-pulled print. A flat colour tint
   (`color: "#050507", colorA: 1`) turns an engraving into a black silhouette: a shadow on a lit wall.

## Options that matter (`cartoon engrave --help`)
| option | when |
|---|---|
| `--style lines` (default) | engraver's lines along the rows: reads in video. `stipple` (dots) is sparse and noisy at 1080p |
| `--lo` / `--hi` / `--gamma` | the brightness that becomes black / full white. A museum backdrop (grey ~0.5) falls to black with `--lo 0.5–0.56`: the marble looks lit from one side |
| `--local 0.3–0.5` | faces and folds in shade (a cover painting, a fresco); without it a face in shade is mush |
| `--spacing` | line pitch: 3.0 for faces at ~1000–1500 px height, 3.4 for big plain things, 2.2–2.6 for small prints |
| `--edges 5–8` | adds light contours: thin details (fingers, a violin, insect legs) |
| `--mask poly.json --inset 6–9 --feather 3` | a cut-out from a busy picture. Without `--inset` a grey halo of the old background stays round the figure |
| `--bg 20–60` | a plain backdrop (white studio, paper). Fails on a gradient backdrop: use a mask |
| `--sky` | a blue sky behind a building |
| `--invert` | dark lines on paper (prints, patent drawings, natural-history plates) |
| `--fade 0.05–0.2` | a picture with a background (clouds, a relief): no hard rectangle |

## Sources that worked (check the licence of each file)
- **Wikimedia Commons** API, filtered by licence: `action=query&generator=search&gsrnamespace=6&gsrsearch=...
  &prop=imageinfo&iiprop=url|size|extmetadata&iiextmetadatafilter=LicenseShortName`; keep `Public domain`
  and `CC0`; `iiurlwidth=3000` gives a sized thumb. Send a User-Agent and wait 2–3 s between requests:
  when throttled the "image" is an HTML error page (check that Pillow opens it).
- **The Metropolitan Museum of Art** Open Access photos (`... MET DP....jpg`): CC0; statues, heads,
  lamps, lanterns, on plain backdrops.
- **NOAA Photo Library** (`Cumulus... - NOAA.jpg`): public domain clouds. Real cloud photos engrave far
  better than generated clouds (pitfalls).
- Paintings and prints old enough for the public domain (Michelangelo, Albin's moths), US patent drawings
  (Edison's lamp), photos of public-domain sculptures that the photographer released.
- The user's own cover or artwork: ask nothing more, it is theirs; cut the figure with a mask.
- A generated picture when nothing public fits (`cartoon gen image`, `references/generate.md`): ask for a
  plain black backdrop and a hard side light, engrave with `--bg 30`; it is recorded in `SOURCES.md` by
  itself. Not for real people or a named artist's style.
- A website or brand the user names as a model: take the techniques (engraving, rays, a grid, windows),
  never its images, logo or wordmark.
- Classical nudes: crop them (Adam at the waist) for a public clip.

## Motifs that go with engravings
- **Thin radiating rays** (a sunburst of 1 px lines) behind the subject; **a checker grid pulled into a
  point** (the world bends toward a gift); **CRT lines** over the finished frame (`post`, every 3rd row
  darker) and a vignette; **small windows** with a title bar showing crops of the engravings (eyes watch).
- **Light with meaning**: one accent colour per force (gold = the old fire, violet = the new gift);
  `tint` puts it on the lines, `dark` hides what the light does not reach.
- **Spreading, accelerating**: windows open from the centre in a wave whose radius grows like `u^2`,
  each wired to the one it came from, while the camera pulls back exponentially, until the net fills the
  frame. Reads as "it spreads and speeds up" in 7 s.
- **Ambivalence without a moral**: a moth circling the light, coming closer, staying beside it; the light
  turning the colour of the older, dangerous fire for the last chord.

## Cost
- 10 min to render 2:38 at 1080p with 3–5 full-size engravings per frame (Windows laptop).
- Line engravings compress badly: ~300 MB for 2.5 min at `looks`, ~160 MB after `cartoon share`.
