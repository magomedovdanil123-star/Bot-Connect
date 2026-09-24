---
name: Financial short rendering
description: Operational constraints for the standalone financial explainer renderer and its voice path.
---

Long vertical financial explainers are rendered frame-by-frame from SVG and can take several minutes even when the final video is under two minutes. Universal topic renders also synthesize and concatenate one voice segment per scene so visual cuts follow the actual spoken scene.

**Why:** A real 72-second, 1080×1920 render with current voice synthesis completed successfully but took about six minutes. The SVG tag and presenter-layer mismatches also passed TypeScript and appeared only during FFmpeg rendering. A one-off esbuild bundle of the voice module needs a Node `createRequire` banner because the ElevenLabs SDK loads a CommonJS dependency.

**How to apply:** Keep the renderer separate from the production video pipeline, use the existing speech provider, keep long runs behind Telegram background tasks, and validate the final MP4 asynchronously with ffprobe. For SVG or overlay changes, render a short MP4 through the real FFmpeg path and inspect several frames; static checks cannot validate SVG strings or layer alignment.