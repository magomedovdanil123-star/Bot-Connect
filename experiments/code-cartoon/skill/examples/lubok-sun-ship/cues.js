/* EXAMPLE «lubok-sun-ship» — 8 s, 16:9. A pencil sketch of a boat under the sun; at the twist an iris
 * opens the same scene as a lubok print (Bilibin waves, a sun with a face, ornament frame, ribbon).
 * Timing is shared with the sound: run `cartoon audio` after any change. Strict JSON between markers. */
window.CUES = /*JSON-START*/{
  "duration": 8,
  "fps_draw": 12,
  "output": "audio/mix.wav",
  "music": {"enabled": true, "mood": "folk", "bpm": 100, "root": "D", "twist": "twist", "gain": -6},
  "voice": {"engine": "piper", "model": "ru_RU-irina-medium", "rate": 1.0},
  "tracks": [],
  "events": [
    {"id": "guides", "t": -1.2, "type": "none", "dur": 1.0},
    {"id": "horizon", "t": -1.0, "type": "scribble", "dur": 0.8, "gain": -6},
    {"id": "sun", "t": -0.5, "type": "scribble", "dur": 1.1},
    {"id": "waves", "t": 0.5, "type": "scribble", "dur": 1.4, "gain": -3},
    {"id": "boat", "t": 1.6, "type": "scribble", "dur": 1.0},
    {"id": "shade", "t": 2.3, "type": "hatch", "dur": 0.8, "gain": -5},
    {"id": "swell", "t": 2.5, "type": "swell", "dur": 0.7, "gain": -4},
    {"id": "twist", "t": 3.2, "type": "magic", "dur": 1.0},
    {"id": "boom", "t": 3.2, "type": "thump", "gain": -6},
    {"id": "frame", "t": 3.7, "type": "paper", "dur": 0.8},
    {"id": "ribbon", "t": 4.3, "type": "pop", "dur": 0.8, "gain": -3},
    {"id": "ribbontext", "t": 4.5, "type": "write", "dur": 0.6, "gain": -4},
    {"id": "poster", "t": 5.0, "type": "none"},
    {"id": "wink", "t": 5.8, "type": "tick"},
    {"id": "final", "t": 6.2, "type": "chime", "gain": -4}
  ]
}/*JSON-END*/;
