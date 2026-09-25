---
name: Financial short rendering
description: Operational constraints for the standalone financial explainer renderer and its voice path.
---

Long vertical financial explainers are rendered frame-by-frame from SVG and can take several minutes even when the final video is under two minutes. Universal topic renders also synthesize and concatenate one voice segment per scene so visual cuts follow the actual spoken scene.

**Why:** A real 72-second, 1080×1920 render with current voice synthesis completed successfully but took about six minutes. The SVG tag and presenter-layer mismatches also passed TypeScript and appeared only during FFmpeg rendering. A one-off esbuild bundle of the voice module needs a Node `createRequire` banner because the ElevenLabs SDK loads a CommonJS dependency.

**How to apply:** Keep the renderer separate from the production video pipeline, use the existing speech provider, keep long runs behind Telegram background tasks, and validate the final MP4 asynchronously with ffprobe. For SVG or overlay changes, render a short MP4 through the real FFmpeg path and inspect several frames; static checks cannot validate SVG strings or layer alignment.

The premium creator look is the default for every production financial Short, not only futures. Keep it scoped to financial rendering; unrelated bot video formats and the isolated object-animation prototype retain their own styles.

**Why:** The user approved the local-preview treatment for financial Shorts as a category while excluding other video formats.

**How to apply:** Select the theme at the financial-plan boundary rather than moving it into shared video code.

Generated presenter art with a checkerboard background can retain disconnected opaque patches after a single-corner flood fill, even when the upper-left corner is transparent.

**Why:** A real FFmpeg render exposed a lower-edge white patch that the corner-only asset check missed.

**How to apply:** Clean background regions from all four corners and inspect at least one rendered frame on the final dark background.

Financial Shorts visual prompts are handled one numbered point at a time. The user supplies production topics; do not generate topic examples or send test MP4s through Telegram.

**Why:** The user explicitly requested staged implementation and review, and prior example-topic generation was unwanted.

**How to apply:** Finish and verify only the current numbered point, then stop. Use neutral local FFmpeg previews for visual checks when needed.

For graphics-only checks, use the direct frame-preview path instead of the full topic render, which enters speech synthesis. Keep FFmpeg MP4 runs for changes that need audio, codec, compositor, or final-output validation.

**Why:** A local full-render preview synthesized voice and the multi-scene audio path required scene-boundary timestamps; neither was needed to inspect the visual concepts.

**How to apply:** Render static frames for theme and layout checks. Use a short local FFmpeg video when validating audio/video integration, and never send QA media through Telegram.