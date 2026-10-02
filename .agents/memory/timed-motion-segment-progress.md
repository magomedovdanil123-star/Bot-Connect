---
name: Timed motion segment progress
description: Prevent long-form motion graphics loops from stalling on event boundaries.
---

When splitting an animated beat at timed event boundaries, compare timestamps in integer milliseconds and ensure each iteration advances by a positive amount. A boundary derived from seconds can round back to the same millisecond and otherwise repeat forever.

**Why:** A stalled segment loop repeatedly appends FFmpeg filters until the Node process runs out of heap.

**How to apply:** Any renderer loop that subdivides a beat by motion-event end times needs normalized boundary comparisons plus a small positive-step fallback or an explicit non-progress guard.