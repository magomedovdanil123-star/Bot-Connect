---
name: Whale Radar isolation
description: Project scope boundary for the new Whale Radar Shorts format.
---

Treat Whale Radar as a standalone feature. Existing financial and crypto Shorts routes, renderers, prompts, SEO, data sources, tables, and upload behavior must remain unchanged. If integration requires editing any existing file, explain WHY, FILE, CHANGE, RISK, and ALTERNATIVE, then get explicit approval before editing.

**Why:** The user's Whale Radar format brief requires a separate pipeline and approval before changes to existing code.

**How to apply:** Put new functionality behind a unique `whale:` Telegram callback namespace, use separate whale-prefixed tables and modules, and verify existing growth formats remain unchanged.
