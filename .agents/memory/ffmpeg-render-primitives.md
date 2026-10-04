---
name: FFmpeg render primitives
description: FFmpeg filter availability and drawing constraints in the API-server environment.
---

The API-server FFmpeg build does not include the `drawline` filter. In FFmpeg 6.1, `crop` accepts time-based `x` and `y` expressions but has no `eval` option; omit `eval=frame`.

**Why:** The API FFmpeg build rejects both `drawline` and `crop`'s unsupported `eval=frame` option; a test-only layered render caught the latter before producing an MP4.

**How to apply:** Before adding filter-based motion graphics, check the installed filter options and keep a short FFmpeg smoke test for the resulting filter graph. Animate crop drift with `x`/`y` expressions using `t`, without `eval=frame`.