/* SINGLE SOURCE OF TRUTH FOR TIMING — a clip to a song.
 * `cartoon song` fills this file from the song: "song" (bpm, bar lines, beat grid, energy, parts of the
 * song) and one "lyric" event per line; "twist" lands on the first chorus, "poster" on the outro.
 * Events with "gen": "song" belong to `cartoon song` and are rewritten by it; add your own events
 * (sound effects, one-off moments) without "gen" and they stay.
 *
 * The scene reads the parts with Sketch.songScenes / d.sec, the beat with d.beat / d.pulse(), the
 * lines with d.lyric(); d.cue("chorus2") gives the start of a part. `cartoon audio` mixes the song
 * (in "tracks") with your effects; run it after every change here.
 *
 * Event fields: id, t (song seconds), type (scribble | write | hatch | erase | click | tick | thump | pop |
 *   whoosh | chime | sparkle | swell | paper | page | rumble | magic | wind | voice | caption | lyric | none),
 *   dur, gain (dB), pan. "lyric": "text", "words": [[t, "word"], ...], "section", "backing".
 * "window": {"from": s, "to": s} — set by `cartoon cut` in a cut: the video shows that part of the song.
 * The block between the markers must stay strict JSON.
 */
window.CUES = /*JSON-START*/{
  "duration": __DUR__,
  "fps_draw": 12,
  "output": "audio/mix.wav",
  "music": {"enabled": false, "mood": "musicbox", "bpm": 120, "root": "A", "twist": "twist", "gain": -6},
  "voice": {"engine": "piper", "model": "en_US-lessac-medium", "rate": 1.0},
  "tracks": [],
  "events": [
    {"id": "twist", "t": 0, "type": "none", "gen": "song"},
    {"id": "poster", "t": 0, "type": "none", "gen": "song"}
  ]
}/*JSON-END*/;
