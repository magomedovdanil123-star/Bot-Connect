---
name: FFmpeg drawtext static expansion
description: Prevent literal percent signs from disappearing in static FFmpeg drawtext labels.
---

Use `expansion=none` for generated static labels. Escaping a percent sign once as `\%` in the filter script can be consumed by FFmpeg's outer parser, leaving drawtext to report “Stray %” and omit the label.

**Why:** The LINK supply graphic silently lost its “7% per year” label until drawtext expansion was disabled.

**How to apply:** For generated literal text, disable drawtext expansion; keep animation in the filter's `x`, `y`, and `enable` expressions rather than text expansion.