---
name: Image letterboxing
description: Handling generated images that already contain black bars before video composition.
---

Generated image providers can return a portrait-looking canvas with black bars embedded inside the pixels, so fitting the image to 9:16 or 16:9 alone does not remove the bars.

**Why:** The renderer's normal scale-and-crop operates on the full image rectangle and preserves baked-in letterboxing when the outer image already matches the requested aspect ratio.

**How to apply:** Run FFmpeg crop detection on each still image, accept only a meaningful content-area reduction, crop the detected rectangle, then apply the target-format scale/crop. Use a looped input for single-image crop detection so FFmpeg emits stable detection frames.