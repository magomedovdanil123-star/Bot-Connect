/* SINGLE SOURCE OF TRUTH FOR TIMING.
 * The scene reads these times with d.cue("id"); `cartoon audio` (scripts/synth_audio.py) reads the
 * same file and places every sound on the same time. Change a time here -> run `cartoon audio`
 * again -> picture and sound stay in sync (pitfall: "sound drifted").
 *
 * Event fields: id (unique), t (seconds; negative = "already drawing at frame 0"),
 *   type: scribble | write | hatch | erase | click | tick | thump | pop | whoosh | chime | sparkle |
 *         swell | paper | page | rumble | magic | wind | voice | caption | lyric | none
 *   dur (seconds, for continuous sounds), gain (dB), pan (-1..1)
 *   voice / caption: "text": "..." — `cartoon voice` speaks it, d.caption(id) shows it.
 * "music": synthesized bed — cold before the twist, warm after it.
 *          mood: musicbox (default) | folk | space.  "enabled": false when you bring your own music.
 * "voice": text-to-speech settings for `cartoon voice` (engine: piper | system | files).
 * "tracks": your own audio files mixed in, e.g. {"file": "audio/song.wav", "gain": -2}
 *           {"file": ..., "duck": true} lowers music and sfx under that track (narration).
 * "output": the mixed file the page plays.
 * The block between the markers must stay strict JSON.
 */
window.CUES = /*JSON-START*/{
  "duration": __DUR__,
  "fps_draw": 12,
  "output": "audio/mix.wav",
  "music": {"enabled": true, "mood": "musicbox", "bpm": 96, "root": "A", "twist": "twist", "gain": -6},
  "voice": {"engine": "piper", "model": "en_US-lessac-medium", "rate": 1.0},
  "tracks": [],
  "events": [
    {"id": "guides",   "t": -0.80, "type": "none",     "dur": 2.4},
    {"id": "outline",  "t": -0.55, "type": "scribble", "dur": 2.15},
    {"id": "write1",   "t": 0.60,  "type": "write",    "dur": 1.20, "gain": -3},
    {"id": "base",     "t": 1.40,  "type": "scribble", "dur": 0.80, "gain": -2},
    {"id": "filament", "t": 2.00,  "type": "scribble", "dur": 0.80, "gain": -4},
    {"id": "shade",    "t": 2.40,  "type": "hatch",    "dur": 1.00},
    {"id": "twist",    "t": 3.80,  "type": "click"},
    {"id": "boom",     "t": 3.82,  "type": "thump"},
    {"id": "shine",    "t": 3.84,  "type": "chime"},
    {"id": "erase1",   "t": 3.85,  "type": "erase",    "dur": 0.30},
    {"id": "rays",     "t": 3.90,  "type": "whoosh",   "dur": 0.55},
    {"id": "spark1",   "t": 4.05,  "type": "sparkle",  "pan": -0.4},
    {"id": "spark2",   "t": 4.40,  "type": "sparkle",  "pan": 0.5},
    {"id": "spark3",   "t": 4.80,  "type": "sparkle",  "pan": -0.2},
    {"id": "write2",   "t": 4.20,  "type": "write",    "dur": 1.00, "gain": -3},
    {"id": "title",    "t": 5.60,  "type": "write",    "dur": 1.00},
    {"id": "titlepop", "t": 6.60,  "type": "pop",      "gain": -4},
    {"id": "poster",   "t": 7.00,  "type": "none"}
  ]
}/*JSON-END*/;
