---
name: Futures explainer avatar
description: Approved recurring presenter and visual direction for the vertical futures explainer.
---

For this futures explainer, use a consistent 2D presenter based on the supplied references: dark textured hair, warm and clearly lit skin, beige jacket, dark shirt, and a neat short beard. Keep the studio dark with restrained warm-gold and green accents. Do not make the face nearly black or make the overall frame bright.

**Why:** The user rejected the earlier bright treatment and nearly black, frightening face, then explicitly chose the short beard from the new references and a 2D presenter throughout the video. The user clarified the narration issue was caused by headphones, so the voice track should stay unchanged.

**How to apply:** Use this direction only for future edits to this futures explainer or its scene variants. Preserve its existing narration and scene timing unless the user asks to change them.

For animation variants, make open/closed mouth pairs from the same pose and keep their framing aligned. Check that the checkerboard is transparent rather than baked into RGB; generated pose pairs can have small non-mouth differences, so avoid rapid sprite switching.

**Why:** Presenter image edits may retain a checkerboard background and vary slightly outside the requested mouth change, which can cause visible flicker when frames alternate quickly.

**How to apply:** Verify alpha at the image corners and inspect a rendered sample. If the background is baked in, remove it before compositing; use a short minimum hold when switching pose or mouth assets.