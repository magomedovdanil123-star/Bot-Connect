---
name: CSS clip reveal holds
description: Prevent CSS mask-revealed text from clipping back during its visible hold.
---

**Rule:** When a CSS animation reveals content by changing `clip-path` from a hidden base value, set `clip-path` explicitly on every visible hold and exit keyframe. Omitted properties can interpolate back toward the element's hidden base state even while opacity remains high.

**Why:** Rendered copy became progressively clipped during its hold, despite opacity keyframes keeping it visible. Computed keyframes showed the missing clip-path values falling back toward the base style.

**How to apply:** Define the open clip-path value at reveal, each hold, and fade/exit keyframes. Inspect computed keyframes and sample rendered frames across the hold.