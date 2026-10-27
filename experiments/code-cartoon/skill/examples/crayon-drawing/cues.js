/* SINGLE SOURCE OF TRUTH FOR TIMING.
 * The scene reads these times with d.cue("id"); `cartoon audio` (scripts/synth_audio.py) reads the
 * same file and places every sound on the same time. Change a time here -> run `cartoon audio`
 * again -> picture and sound stay in sync (pitfall: "sound drifted").
 *
 * Event fields: id (unique), t (seconds; negative = "already drawing at frame 0"),
 *   type: scribble | write | hatch | erase | click | tick | thump | pop | whoosh | chime | sparkle |
 *         swell | paper | page | rumble | magic | wind | voice | caption | none
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
  "duration": 3,
  "fps_draw": 12,
  "output": "audio/mix.wav",
  "music": {"enabled": false, "mood": "musicbox", "bpm": 96, "root": "A", "twist": "twist", "gain": -6},
  "voice": {"engine": "piper", "model": "en_US-lessac-medium", "rate": 1.0},
  "tracks": [],
  "events": [
    {"id": "page", "t": 0.0, "type": "none", "dur": 3.0}
  ]
}/*JSON-END*/;
