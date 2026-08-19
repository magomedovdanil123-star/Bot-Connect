---
name: Openverse audio quirks
description: Empirically observed Openverse audio metadata units and availability behavior.
---

Treat Openverse audio `duration` values as milliseconds. A sampled response reported `117000` for a track independently verified as 117 seconds.

**Why:** Interpreting the field as seconds creates invalid timelines, while treating every search result as reliably downloadable makes one unavailable asset fail an otherwise valid sound-design pass. Some canonical audio downloads also time out even when search metadata is returned.

**How to apply:** Keep duration conversion explicit at the provider boundary. Treat individual unavailable assets as skippable provider failures, but do not silently fall back to client-supplied or non-canonical URLs.