---
name: Finance Long custom-script production
description: Telegram author-script routing and renderer-selection constraints.
---

Telegram Finance Long author-script flows, including coin-overview author scripts and previously saved author-script drafts, are pinned to `PREMIUM_DYNAMIC_FINANCE_V2_FINAL` and must use the Premium Dynamic production renderer. Keep the author's narration unchanged, preserve verified coin context, and require storyboard approval before video production. Do not fall back to V1, V1.1, or V4 when the V2 FINAL route fails; surface the error.

**Why:** The user later approved the migration of Finance Long routes to V2 FINAL; the earlier V1-only instruction is stale.

**How to apply:** Keep new Finance Long author-script work on V2 FINAL, leave the voice text as supplied, and fail clearly rather than selecting a legacy renderer.