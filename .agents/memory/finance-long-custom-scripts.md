---
name: Finance Long custom-script production
description: Telegram author-script routing and renderer-selection constraints.
---

Telegram Finance Long author-script flows, including coin-overview author scripts and previously saved author-script drafts, are pinned to `PREMIUM_DYNAMIC_FINANCE_V1` and must use the Premium Dynamic production renderer. Treat V1 as immutable: future montage, visual, or renderer changes require a new version (for example V2), never a silent edit to V1. Do not retry with Finance Long V4 when rendering fails; surface the error. Keep the author's narration unchanged and require storyboard approval before video production.

**Why:** The user confirmed the completed E2E result as the production standard and explicitly said future changes must use a new version rather than changing V1.

**How to apply:** Stamp new author-script project metadata with V1 and keep it routed through `PREMIUM_DYNAMIC_FINANCE_PRODUCTION` / `renderLongformVisualVideo`. Before any future production change, introduce and explicitly select a new version; never alter V1 behavior or add a Finance Long V4 fallback.