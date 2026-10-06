---
name: Whale Radar isolation
description: Project scope boundary for the new Whale Radar Shorts format.
---

Treat Whale Radar as a standalone feature. Existing financial and crypto Shorts routes, renderers, prompts, SEO, data sources, tables, and upload behavior must remain unchanged. The user explicitly approved a Finance main-menu entry and reuse of the existing Bybit banner in Whale Radar's CTA only; do not treat this as broader approval to change other formats.

**Why:** The original format brief requires a separate pipeline; the user later requested these two narrowly scoped integrations.

The user selected Nansen as the MVP data source and the existing Telegram bot as the entry point. Do not publish generated Whale Radar videos automatically. Large-transfer coverage needs an explicitly chosen token set; do not infer one.

**How to apply:** Put new functionality behind a unique `whale:` Telegram callback namespace, use separate whale-prefixed tables and modules, and verify existing growth formats remain unchanged. Keep scans, previews, and any publication user-initiated; expand transfer coverage only after the user chooses the tracked tokens.
