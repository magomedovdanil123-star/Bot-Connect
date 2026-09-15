---
name: Video cut audio policy
description: User-approved behavior for the autonomous Telegram video-cut flow.
---

The Telegram video-cut flow must keep the original video's audio. It must not add a generated narration or synthetic voiceover, and it must not generate YouTube thumbnails for cut publishing.

**Why:** The user explicitly confirmed that the cut should retain the source sound and that neither new narration nor thumbnails are wanted in this flow.

**How to apply:** Keep future cut-pipeline changes separate from the regular scripted-video pipeline, where voice generation and thumbnails may still be used.