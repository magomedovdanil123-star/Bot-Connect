# Recipes

Tested story patterns. Each names the parts to reuse; look at the bundled examples for working code.

## Bring a child's drawing to life
The child must recognise **their** drawing and **themselves**.
1. Ask for a photo of the drawing and (optionally) of the child; ask who and what is in the drawing.
   Never upload or publish these photos.
2. Choose the way:
   - **2D retelling** (template 2d): redraw the drawing with `pen.crayon` + `pen.marker` in a
     `Sketch.cache(..., { palette: "crayon" })`, objects at the same places as on the photo (measure
     them). The child appears as a drawn character with their recognisable traits (hair, clothes,
     a favourite toy). Example of the drawing technique: `cartoon example crayon-drawing`.
   - **Photo + 3D** (template photo3d): the real photo of the child, the real drawing popping up from
     a bench, a dive into a 3D world in the drawing's colours, the child's real face in a window or
     porthole (`cartoon photo --face`), back to the photo with a souvenir. `cartoon example photo3d-popup`.
3. The twist is the moment the drawing comes alive: it starts to boil, stars lift off the page, the
   camera dives in. Everything the child drew must appear in the story.
4. End on the child with a souvenir from the drawing (a star, a toy) and a warm poster line.

## Dive into a picture (one world inside another)
- The picture inside the first world is a cached canvas; push the camera into it with
  `Sketch.cam.keys` (zoom 1 -> 5+, ease `in`).
- At the moment the picture fills the frame, switch the world at the **same geometry** (the second
  world uses the picture's layout scaled up), under an iris or a short flash.
- Line widths follow the zoom (`zoomComp`); the picture is a raster and scales like paper.

## Two worlds (sketch -> print, yard -> fairy tale)
- `Sketch.sequence` with one scene per world; same layout, different palette, pens and music mood.
- The iris opens from the centre; the incoming world gets its own paper.
- The palette swap is the twist: cold pencil before, warm colour after. Example: `cartoon example lubok-sun-ship`.

## Photo + 3D story
- Real photo (living camera, leaves) -> the picture on a surface -> pop-ups -> push into the hero card ->
  gold flash -> 3D world -> flash -> the photo again with a glowing souvenir -> poster.
- Twist = the dive (35–45 %). The 3D world is toy-like on purpose: the realism is the photo.
- Narration: `voice` cues + `cartoon voice --fit` + `cartoon audio`.

## A short reel cut to their song (no lyrics on screen)
- Put the song in `audio/`, `cartoon beats audio/song.mp3 --snap cues.js --grid bar --twist`.
- Look at `song.beats.png`: bars, energy, the twist candidate (the strongest rise in the middle).
- Events marked `"snap": "beat"` or `"bar"` move onto the grid; the twist lands on the drop.
- `cartoon audio` mixes the song with soft effects (synthesized music is switched off).

## A clip to a song (parts, lyrics, a cut for Reels)
- `cartoon new my-clip --template clip --song s.mp3 --lyrics l.txt --vocals v.wav` (Suno: tags in the
  text, stems for the voice). Check `song.map.png` and `lyrics-preview.mp4` before any drawing.
- One world per kind of part (`Sketch.songScenes`): verses cold and travelling (a new thing per bar),
  the chorus a warm motif that grows with every repeat, the bridge a third world, the outro a poster.
- Lyrics with `Sketch.fx.lyric` in the style of the world. Then `cartoon cut reel --auto --format 9:16`.
- Example: `cartoon example song-clip` (a synthesized demo song). Full guide: `references/song-clip.md`.

## A duel in the sky to an instrumental (pencil 3D)
Tested on a 2.5-minute violin + electronics track: two WWII aces, 5 parts = 5 worlds.
- Read the music with the user first (`references/song-clip.md`): here minor all the way, a heavier
  fourth part, a darker sparse end -> "both strong, wounded, not broken; respect, nobody shot down".
- Parts by hand: `cartoon song --parts "intro:0,fight:41.8,storm:1:23.1,clash:1:50.7,outro:2:18.3"`.
- Intro in 2D pencil (the planes drawn on paper, then they come alive), then pencil 3D
  (`references/pencil3d.md`): the fight as a flight simulation (who attacks changes by phrase), the
  storm around a cloud tower, head-on passes (converge, fire, break: one always up, one always down),
  the outro wing to wing with a wing waggle, then they split.
- One planned hit each, snapped to a real alignment of the guns; damage as holes and smoke.
- Insignia from the period, never a swastika: a red star; a Balkenkreuz on the rear fuselage.
- Shown in stages: keyframes, then each part as a draft (`cartoon cut`), then the full render; every
  version kept beside the last.
