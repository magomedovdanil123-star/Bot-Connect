---
name: Image-free Finance Long motion
description: Cross-stage invariant for image-free Finance Long documentaries using Ethereum motion graphics.
---

When the explicit Ethereum motion profile is active on a Finance Long documentary, resolve `paletteMode` to `ethereum-motion`. The video pipeline skips generated images for this profile, while the renderer accepts an image-free job only when its palette mode matches the documentary motion renderer.

**Why:** A documentary profile skipped image generation but retained the general `pump-dynamic` palette, so the renderer rejected the otherwise valid motion-only job.

**How to apply:** When changing Finance Long profile resolution, keep image-generation eligibility and renderer composition mode aligned. Test both the resolved palette and FFmpeg color/filter output; never silently generate AI images as a fallback for this documentary mode.