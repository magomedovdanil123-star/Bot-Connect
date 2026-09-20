---
name: Horoscope content planner
description: Durable rules for distributing horoscope content across selected channels.
---

Horoscope generation has two user-facing modes: daily content where AI chooses the concepts, and manual topic where the user topic is a parent direction. Both modes must create one shared plan before individual scripts.

**Why:** A network of channels must not receive the same script with only the zodiac sign changed; manual inputs can also contain locked parameters that must survive distribution.

**How to apply:** Persist planner mode, plan items, and locked/flexible/expandable analysis with the run. Generate each package from its own plan item, validate channel coverage and semantic similarity, and resume planning or generation after API restarts.