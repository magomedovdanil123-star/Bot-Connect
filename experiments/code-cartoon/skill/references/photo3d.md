# Photo + 3D template (`--template photo3d`)

Realism without fake people: the person and the place are a **real photo**; the magic is 3D built
from a picture (often a child's drawing). Code cannot animate a real face — it frames it.

## Layers (index.html, back to front)
1. `#photo` — the photo, moved by CSS transform (Ken Burns), prepared to cover the frame.
2. `#three-over` — transparent WebGL: falling leaves / snow over the photo, the final gold star.
3. `#three-main` — the 3D scenes: B (the picture on a bench, pop-ups) and C (the 3D world).
4. `#leak` (warm light leak), `#vignette`, `#shade` (dark gradient under captions), `#grain`, `#flash`.
5. `#cap` (captions from `caption`/`voice` cues), `#title` (poster), `<audio id="mix">`.
Crossfades are CSS opacity of `#three-main`; dives are cuts under `#flash`.

## Pictures
```bash
cartoon photo . --photo ../me_in_the_park.jpg --image ../drawing.jpg [--face 440,445,150]
```
- `assets/photo.jpg` covers the frame in any format; a small photo gets upscaled and soft — ask for the original.
- `assets/drawing.jpg` (longest side <= 2048): measure the pop-up ellipses in its pixels.
- `assets/face.png` (`--face X,Y,R` in the original photo): a round crop, e.g. for a porthole in 3D.
Never publish or upload a user's photo; keep it in the project folder.

## scene3d.js: what to change
- `POPUPS` — `{ id, cx, cy, rx, ry, rot, cue }` per object: an ellipse a bit larger than the object
  (the white paper halo is cut out too). Open the drawing and estimate centres and radii; check the
  sheet after the first snapshot. `HERO` = the card the camera dives into.
- `PHOTO_IN` / `PHOTO_OUT` — Ken Burns keys `[scale, x, y]` in photo fractions (the centre is clamped
  so no empty edge shows in any format). `STAR_AT` — where the souvenir glows in the final photo
  (put it where the person looks).
- `updateC(t)` — the 3D world: replace or extend with kit3d parts.
- Timing in `cues.js` (written for 12 s; `cartoon new` scales it to `--duration`).

## kit3d.js (import * as K from "./kit3d.js")
| part | use |
|---|---|
| `palette(name)` -> `{ col, hex, rgba }` | roles from palettes.js (cosmos has crayon + 3D roles) |
| `cueTimes()` -> `{ C, CE, events }` | cue times, the same file the sound reads |
| `mkRenderer(canvas, W, H, {alpha, shadows})`, `envMap(renderer)` | fixed pixel ratio; one PMREM per renderer |
| `camKeys([[t, pos, target, ease], ...])` | keyframed 3D camera |
| `starfield`, `nebula`, `bandedTexture`, `planet`, `ring`, `earth({continents})`, `atmosphere` | space kit; `earth` grows coastlines around your continents |
| `faceSprite(scene, centre, radius)` + `.update(camPos, {look, talk, wink, blink})` | a face on a ball that is never clipped |
| `drawSunFace(ctx, state)` | the default face painter (replace to draw another face) |
| `woodSurface`, `paperSheet(scene, tex, PW, PH)`, `popupCutouts(...)` | the pop-up book |
| `leavesOverlay(scene, P, W, H, {kind:"leaves"\|"snow"})` + `.update(t, visible, avoid)` | falling leaves/snow; `avoid` keeps a face clear |
| `goldStar`, `burst`, `glowSprite`, `glowTex`, `sparkTex`, `dotTex` | souvenirs and sparkles |
| `photoLayer(img, W, H).set(s, x, y)`, `fade(el, t, ...)`, `captions(el, events)` | DOM helpers |
| `screenToWorld(sx, sy, depth, W, H)` | place an overlay object at a screen position |

## Rules learned the hard way (see pitfalls)
- A flying object must move across the camera's view, not away from it, or you see only its nozzle.
- A sprite is screen-aligned: a face on an off-centre ball floats 1.7 R in front of it (`faceSprite` does it).
- Cut-out masks cover the whole sheet (alphaMap shares UVs with map) and need `customDepthMaterial`.
- Planets: ocean roughness >= 0.5, `envMapIntensity` ~0.1, soft atmosphere, or they look like glass.
- Keep falling leaves out of faces and text on the poster (`avoid`).
- Captions over a glowing object are unreadable: put them low with a dark shadow.
- Render size: screenshot capture + grain makes big files (~5 MB/s); hand over `cartoon share` copies.
