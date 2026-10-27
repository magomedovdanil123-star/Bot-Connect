# A clip to a song

A whole song (2–4 min, usually 16:9) and a cut of it for Reels / Shorts (15–60 s, 9:16) from ONE project.
The parts of the song (intro, verse, chorus, bridge, outro) are worlds; the chorus is a motif that grows
with every repeat; the lyrics are written on screen as they are sung. Everything is still a function of
time; the song only supplies the times.

## What to ask first (step 0)
- The song file (mp3/wav). Whose it is: on the free Suno plan the songs are for non-commercial use only;
  on paid plans the user owns them. Do not ask more about rights; mention it once if they plan to publish.
- The lyrics as text, with the tags exactly as in Suno/Udio (`[Verse 1]`, `[Chorus]`, `[Bridge]`, ...).
  Without tags the stanzas still work (a repeated stanza = the chorus).
- The vocal stem (Suno: "Get Stems" -> Vocals) — strongly recommended: the line timing becomes precise.
  Or an LRC file if they have one. With a speech service (`cartoon gen keys` shows it), the stem also
  gives word times: `cartoon gen transcribe audio/vocals.wav --lyrics audio/lyrics.txt` writes an
  enhanced `audio/song.lrc` (the user's text, Whisper's times), then `cartoon song --lrc audio/song.lrc`.
- The full clip, a cut for Reels, or both; formats (16:9 full + 9:16 cut is the usual pair).
- The worlds: which style for verses, which for the chorus (show `assets/themes.jpg`), the motif of the chorus.

## Read the music before inventing the story
You cannot hear the song. Say so, then give a short reading from the numbers and let the user correct it
before any storyboard. `cartoon song` prints a table per part: key (major/minor), loudness, brightness,
bass share, notes per second, dynamics and stereo width, with words relative to the whole song
("louder, brighter", "darker, sparser"). Turn it into 3–5 sentences ("C minor all the way: tension,
not a triumph; the fourth part is the heaviest; the end is darker and sparser: it fades out, not a
final chord") and ask what numbers cannot tell, as one batch:
- the genre and the lead instrument (a violin over electronics reads differently from a guitar riff);
- the story the music tells: who, against whom or what, how it feels (in one sentence);
- how it ends: victory, loss, a draw with respect, a fade into the distance;
- what the cover or the title mean, if they gave one (often: only the palette and the mood).
Then check your storyboard against the reading and say where they disagree: on the test track the first
draft had a bright breakthrough over the darkest, heaviest part and a victory over a minor ending that
fades out; both were wrong. The reading was right about the mood and the shape, and only the user could say
"a duel of two WWII aces, both strong, wounded but not broken, respect at the end".

## Instrumentals and your own parts
- Without lyrics the parts come from the music alone. When the change is gradual (orchestral, cinematic),
  the boundary search can cut the song into many short parts; above 10 parts it looks for the
  changes between 4-bar phrases instead (parts of at least 8 bars).
- Set the parts yourself when the user knows them or the map shows them clearly:
  `cartoon song --parts "intro:0,fight:41.8,storm:1:23.1,clash:110.7,outro:138.3"` (label:seconds or
  m:ss; snapped to the nearest bar). The parts are stored and kept on reruns; `--auto-parts` forgets them.
- Every part is a world: `Sketch.songScenes` takes the labels you gave.

## Pipeline
```bash
cartoon new my-clip --template clip --format 16:9 --palette neon --title "TITLE" --lang ru \
    --song song.mp3 --lyrics lyrics.txt --vocals vocals.wav        # or --lrc song.lrc
# -> parts + lines in cues.js, audio/song.lrc, song.srt, song.map.png, lyrics-preview.mp4
```
1. **Look at `song.map.png`**: coloured bands = parts (check them against the tags), numbered bars = lines,
   red = where the stem sings. The console table marks doubtful parts ("weak change", "no voice?").
2. **Lyric timing before any rendering**: `lyrics-preview.mp4` (seconds to make) plays the song with
   karaoke lines over the map. You cannot listen: ask the user to watch it, or say honestly that the
   timing was checked only on the map. To fix: edit `audio/song.lrc` (any LRC editor works), then
   `cartoon song --lrc audio/song.lrc`. `cartoon song --auto` goes back to the automatic timing.
3. **Storyboard by parts** in `project.md` (`references/storyboard.md`, "Clips").
4. **Scene**: `Sketch.songScenes({...})`, one world per kind of part (engine-api, "Song clips").
5. `cartoon audio` (the song + your effects), `cartoon lint`, `cartoon snapshot --at` the start of every
   part + 0.3 s, the first chorus, the poster.
6. Render: `cartoon render --fps 24 --quality looks --output clip.mp4`, then `cartoon check clip.mp4
   --duration <song> ...` and `cartoon frames clip.mp4 --jumps --cues cues.js` (part starts and lines
   count as planned changes).
7. **The cut**: `cartoon cut reel --auto --format 9:16` -> `cuts/reel/` (generated, never edited), then
   inside it `cartoon snapshot` + `cartoon render --output reel.mp4`. After any change to the clip, run
   `cartoon cut reel` again (the settings are kept). `--from chorus2 --to chorus2`, `--len 20`,
   `--bars-before 2` choose another stretch.

## How the timing is found (and how sure it is)
| source | parts | lines | words |
|---|---|---|---|
| `--lrc` | from the first line of each tagged part | exact | exact with enhanced LRC `<mm:ss.xx>`, else by syllables |
| `--vocals` | tags placed by novelty + the voice | where the voice sings (demo: ~30 ms) | by syllables over the sung time |
| lyrics only | tags placed by novelty | spread over the bars of their part (rough) | by syllables |
| nothing | from the music alone (repeated + loudest = chorus) | — | — |
- Bars: the beat tracker of `cartoon beats`; the downbeat = the beat with the most bass and chord change.
  4/4 is assumed. A clip at half or double speed: `--bpm-min/--bpm-max` around the real tempo.
- Parts are placed on bar lines by dynamic programming: where the texture changes (spectral shape,
  loudness, drums; harmony per 4-bar phrase), where the voice is (no voice in [Intro]/[Instrumental]),
  and how long each part should be from its lines.
- Suno sometimes sings something else than its text (repeats a chorus, drops a line). Then fix
  `lyrics.txt` to what is sung — the timing follows the text you give.

## Song time, beats and the cut
- Every time in `cues.js` is song time. `d.cue("chorus2")` = the start of that part (`cueEnd` its end).
- `twist` (events with `"gen": "song"`) lands on the first chorus, `poster` on the outro. Your own
  events (sound effects) never carry `gen` and are kept when `cartoon song` runs again.
- **beatLock** (on by default with a song): on twos the drawings of a beat share it evenly and a new
  drawing starts exactly on the beat, so hits are never a drawing late. `mount({ beatLock: false })` off.
- A cut's `cues.js` has `"window": {"from", "to"}`; the engine adds `from` to the frame time and
  `cartoon audio` mixes that stretch (20 ms fade in, 1.5 s fade out). In the scene, `d.window.cut` and
  `d.window.left` let a cut end on its own poster (the starter writes the title in the last 2.4 s).

## Rules for clips
- The twist is the first chorus (not 35–45 %): before it cold and small, from it warm and big.
- The chorus motif grows: `sec.n` (0 = first), `sec.of`, `sec.last` — more rays, a bigger camera, a
  second ring; the last chorus is the payoff.
- Something new on every bar (an object, a star, a cut of the camera); small hits on beats (`d.pulse()`);
  big changes only on part boundaries.
- Lyrics: at most two rows, in `Sketch.safe()` (bottom 15 % of 9:16 stays empty); styles by world:
  `write` for pencil/chalk, `karaoke` for any, `stamp` for neon/halftone/collage, `ribbon` for lubok.
- The outro is the poster: the title written, nothing fast moves.
- A cut for Reels starts one bar before the chorus (the hook in the first 2 s) and ends with it.

## Show it in stages
A clip is long and the user wants to see it before 15 minutes of rendering: keyframes (one snapshot per
part + the key moments), then each part as a draft (`cartoon cut fight --from 41.8 --to 83.1 --size
1920x1080`, render inside `cuts/fight`), then the full render. Keep every version beside the last
one (`clip-v2.mp4`, sources in `versions/v2/`). Camera cuts inside a part are planned jumps: add them
as cue events (`{"id": "cut3", "t": 97.2, "type": "none"}`, a flash with its `dur`) so `cartoon frames
--jumps` checks only the rest, and look at each cut with `--around`.

## Render time
Measured on a Windows laptop: the 46.5 s demo clip in 16:9 renders in ~3 minutes (about 4x the length),
its 11 s 9:16 cut in 40 s — a 3-minute clip takes ~12 minutes. A clip with pencil 3D worlds (`references/pencil3d.md`) takes 4–6x
the length: 2.5 minutes rendered in 11–16 minutes. Check the parts with `cartoon snapshot`
first and render the cut before the full clip. A long render in segments that survives an interruption:
`HF_SEGMENTED_CAPTURE=true cartoon render --output clip.mp4`; if it stops, the same command with
`--resume` continues from the finished segments.
