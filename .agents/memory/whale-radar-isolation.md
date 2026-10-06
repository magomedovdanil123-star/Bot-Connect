---
name: Whale Radar isolation
description: Project scope boundary for the new Whale Radar Shorts format.
---

Keep Whale Radar separate from all existing financial and crypto Shorts routes, renderers, prompts, SEO, sources, tables, and publishing behavior. Its only approved shared integrations are the Finance main-menu entry and reuse of the existing Bybit banner in Whale Radar's CTA. Use Nansen as its MVP source and the current Telegram bot as its entry point; do not publish automatically. Large-transfer coverage requires a user-selected token set.

**Why:** The user requires this format to stay isolated; the two shared integrations were approved only for Whale Radar.

**How to apply:** Use the `whale:` Telegram callback namespace and whale-specific modules/tables. Keep scans and previews user-initiated, and verify existing growth formats remain unchanged.

Whale Radar Shorts may run up to 60 seconds. Give the narration a detailed, evidence-based account of the trade and show the coin's change from execution price to the latest available Nansen hourly close. Add a second coin only when there is a separate confirmed Nansen trade and usable post-trade candles; compare each coin from its own trade timestamp. Describe this as market-price movement, never wallet profit, and do not invent missing data.

**Why:** The user asked for a fuller one-minute story, animated real price charts, post-trade performance, and an optional second-coin comparison.

**How to apply:** Keep this richer format scoped to Whale Radar. Use one coin when a second confirmed event or usable post-trade data is unavailable.
