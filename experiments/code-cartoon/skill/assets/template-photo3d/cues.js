/* SINGLE SOURCE OF TRUTH FOR TIMING — photo3d starter (written for 12 s; `cartoon new` scales it).
 *   0 – xfade     the real photo, living camera, falling leaves, a caption
 *   xfade – push  the picture lies on a bench; its objects stand up like a pop-up book (pop1..pop6)
 *   twist         dive into the hero card -> 3D space (35-45 % of the length)
 *   twist – home  the 3D world; the face on the sun talks ("hello" caption) and winks
 *   home – end    back to the photo, a golden star glows; poster in the last 3 s
 * Event types and fields: see the comment in the 2D template's cues.js. "caption" cues are silent
 * text for the #cap line; "voice" cues are spoken by `cartoon voice` and shown there too.
 * The block between the markers must stay strict JSON.
 */
window.CUES = /*JSON-START*/{
  "duration": __DUR__,
  "fps_draw": 24,
  "output": "audio/mix.wav",
  "music": {"enabled": true, "mood": "space", "bpm": 92, "root": "D", "twist": "twist", "gain": -6},
  "voice": {"engine": "piper", "model": "en_US-lessac-medium", "rate": 1.0},
  "tracks": [],
  "events": [
    {"id": "cap1", "t": 0.5, "type": "caption", "dur": 1.6, "text": "Once upon a time there was a drawing…"},
    {"id": "xfade", "t": 2.4, "type": "swell", "dur": 0.6, "gain": -10},
    {"id": "paperin", "t": 2.9, "type": "paper"},
    {"id": "pop1", "t": 3.2, "type": "paper", "gain": -2, "pan": -0.5},
    {"id": "pop2", "t": 3.45, "type": "pop", "gain": -5, "pan": -0.1},
    {"id": "pop3", "t": 3.7, "type": "paper", "gain": -3, "pan": 0.5},
    {"id": "pop4", "t": 3.95, "type": "pop", "gain": -5, "pan": 0.2},
    {"id": "pop5", "t": 4.2, "type": "page", "gain": -3, "pan": -0.4},
    {"id": "pop6", "t": 4.45, "type": "sparkle", "pan": 0.5},
    {"id": "push", "t": 4.6, "type": "whoosh", "dur": 0.5},
    {"id": "twist", "t": 5.1, "type": "thump"},
    {"id": "shine", "t": 5.12, "type": "magic", "dur": 1.0},
    {"id": "hello", "t": 6.2, "type": "caption", "dur": 1.0, "text": "Hello!"},
    {"id": "hellochime", "t": 6.2, "type": "chime", "gain": -4},
    {"id": "wink", "t": 7.4, "type": "tick"},
    {"id": "home", "t": 8.7, "type": "thump", "gain": -3},
    {"id": "homechime", "t": 8.72, "type": "chime"},
    {"id": "star", "t": 9.0, "type": "sparkle"},
    {"id": "poster", "t": 9.0, "type": "none"},
    {"id": "title", "t": 9.3, "type": "none", "dur": 0.8}
  ]
}/*JSON-END*/;
