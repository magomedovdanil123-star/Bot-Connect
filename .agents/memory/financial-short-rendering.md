---
name: Financial short rendering
description: Operational constraints for the standalone financial explainer renderer and its voice path.
---

Long vertical financial explainers are rendered frame-by-frame from SVG and can take several minutes even when the final video is under two minutes. Universal topic renders also synthesize and concatenate one voice segment per scene so visual cuts follow the actual spoken scene.

**Why:** A real 72-second, 1080×1920 render with current voice synthesis completed successfully but took about six minutes. The SVG tag and presenter-layer mismatches also passed TypeScript and appeared only during FFmpeg rendering. A one-off esbuild bundle of the voice module needs a Node `createRequire` banner because the ElevenLabs SDK loads a CommonJS dependency.

**How to apply:** Keep the renderer separate from the production video pipeline, use the existing speech provider, keep long runs behind Telegram background tasks, and validate the final MP4 asynchronously with ffprobe. For SVG or overlay changes, render a short MP4 through the real FFmpeg path and inspect several frames; static checks cannot validate SVG strings or layer alignment.

The requested target duration is planning metadata, not a render-time cap: the final MP4 length comes from the synthesized and concatenated narration.

**Why:** Word-count estimates and AI-provided duration fields did not reliably predict the actual spoken runtime.

**How to apply:** Validate narration length before rendering, then use ffprobe on the produced MP4; never infer final runtime from the plan alone.

Standalone financial QA bundles must bundle workspace packages and preserve logger worker resolution; externalizing every package can make Node ESM reject TypeScript directory exports or resolve workers from the wrong path.

**Why:** Direct harness bundles failed on both workspace schema imports and a missing worker module even though the managed API build succeeded.

**How to apply:** Mirror the API build's bundling and Pino worker setup for local test harnesses, and include the Node `createRequire` banner used by the voice SDK.

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

Mixed raster media in financial Shorts is contextual only: stock imagery must be commercially usable without required attribution, and any financial values remain in verified narration or programmatic graphics.

**Why:** Raster images are embedded in SVG frames, increasing render cost; generated or photographed text can also introduce unsupported financial claims. FFmpeg's SVG renderer can silently omit external file URLs, while source links should remain visible in the Telegram plan preview.

**How to apply:** Keep raster layers to a small number per Short, preserve photo source/license metadata in the plan, keep embedded images compact and only in frames where their moment is active, and never use image content as a source for figures or market data.

Keyword overlays need a reserved band between infographic content and the presenter. Being above the face does not guarantee they are clear of a card's lower caption.

**Why:** A keyword badge placed above the presenter overlapped the lower caption of a centered risk infographic during local preview.

**How to apply:** Preview dense centered and hero moments as well as different presenter layouts. Adjust the visual region and keyword band together, and verify the badge clears both the graphic and the presenter.

Scene and moment progress may use normalized fractional boundaries as well as millisecond timestamps. Progress math must preserve spans smaller than one instead of flooring the denominator to one.

**Why:** A one-millisecond minimum made normalized scene spans behave like global clip progress, leaving later timed moments stuck on the first visual.

**How to apply:** Divide by the actual positive span and handle zero or reversed ranges explicitly. Preview a late moment in each scene to verify local progress reaches the expected visual.

Premium finance renders composite presenter art over the base SVG, then place subtitles in a later overlay. Persistent text that must stay visible above the presenter belongs in that top overlay.

**Why:** A footer drawn in the base frame was covered by the separately composited presenter in the final MP4, even though static inline previews looked correct.

**How to apply:** Put persistent disclosures in the final overlay plane and verify a rendered frame where the presenter crosses the target area.