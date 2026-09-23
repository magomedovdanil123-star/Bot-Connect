---
name: Financial short rendering
description: Operational constraints for the standalone financial explainer renderer and its voice path.
---

Long vertical financial explainers are rendered frame-by-frame from SVG and can take several minutes even when the final video is under two minutes. Keep this work behind the Telegram background-task path instead of blocking an interactive callback.

**Why:** A real 72-second, 1080×1920 render with current voice synthesis completed successfully but took about six minutes. A one-off esbuild bundle of the voice module also needs a Node `createRequire` banner because the ElevenLabs SDK loads a CommonJS dependency.

**How to apply:** Keep the renderer separate from the production video pipeline, use the existing speech provider, and validate long runs asynchronously with ffprobe after completion.