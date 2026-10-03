---
name: Finance Long custom-script production
description: Telegram author-script routing and renderer-selection constraints.
---

Telegram Finance Long author-script flows, including coin-overview author scripts and previously saved author-script drafts, must use the Premium Dynamic production renderer. Do not retry with Finance Long V4 when rendering fails; surface the error. Keep the author's narration unchanged and require storyboard approval before video production.

**Why:** The user explicitly requires these Telegram routes to use the same Premium Dynamic pipeline as the approved preview, with renderer failures visible rather than hidden by a legacy fallback.

**How to apply:** Preserve this rule when changing Telegram callbacks, storyboard retries or edits, Finance Long profile resolution, and video-pipeline routing. Verify both the Telegram route contract and a real MP4 render.