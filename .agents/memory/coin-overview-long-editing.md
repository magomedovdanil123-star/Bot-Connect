---
name: Long coin overview editing
description: User-approved typography and internal chunking approach for Finance long-form coin overview videos.
---

For Finance → Long Video → Coin Overview, use large phrase-synced kinetic typography with changing accent colors and placements inspired by the user's reference. Render in roughly two-minute parts at completed-voice scene boundaries, then concatenate them into one final MP4 before Telegram delivery. Keep user-provided narration unchanged; coin research supplies visual context only.

**Why:** The user wants varied, dynamic editing instead of repetitive one-word captions, but only one cohesive finished video in Telegram. Chunk seams must not split active narration. Large FFmpeg motion graphs can exceed Linux's per-argument limit when passed directly on the command line. A fresh generic video job may re-run voice/music stages even when finished assets exist, because its per-job stage map starts empty.

**How to apply:** Restrict this treatment to long coin overviews. For visual-only rerenders, use the saved active completed voice rows and completed mix directly rather than starting a fresh generic video job. Keep the full audio timeline continuous and send only the joined output, never the internal parts. Render roughly two-minute scene-safe chunks and pass each generated graph through `-filter_complex_script`, not a long `-vf` argument.