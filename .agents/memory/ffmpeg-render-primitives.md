---
name: FFmpeg render primitives
description: FFmpeg filter availability and drawing constraints in the API-server environment.
---

The API-server FFmpeg build does not include the `drawline` filter. Animated diagrams in rendered video should use supported primitives such as time-enabled `drawbox` segments, or another verified rendering path.

**Why:** A requested line-chart overlay could not use `drawline` in this environment; probing installed filters before choosing a visual primitive prevented a runtime render failure.

**How to apply:** Before adding filter-based motion graphics, check `ffmpeg -filters` in the current environment and keep a short FFmpeg smoke test for the resulting filter graph.