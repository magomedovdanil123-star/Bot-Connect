---
name: Delayed film outros
description: Reliable timing for final-scene geometry and loop handoffs in browser-rendered short films.
---

For final-scene geometry that must stay hidden until a precise outro beat, use an explicit CSS animation delay and `forwards` fill. A simple delayed opacity transition can fade the copy; the CSS animation can then move and scale the closing shape into its exact loop position. Avoid relying on repeated leading keyframe values plus `times` for a critical delayed reveal unless captured frames confirm the timing.

**Why:** Browser captures showed an animated ring overlapping disclosure copy before the intended outro, while its position and scale lagged. A delayed CSS keyframe kept it hidden, then produced the expected centered closing shape.

**How to apply:** Keep ordinary entrances in Framer Motion. For a finale with a strict handoff time, capture an early frame, a readable middle frame, and the last 15% of the scene; verify the closing shape's final bounds and opacity before delivery.