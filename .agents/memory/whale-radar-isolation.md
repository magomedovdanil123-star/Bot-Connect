---
name: Whale Radar isolation
description: Project scope boundary for the new Whale Radar Shorts format.
---

Keep Whale Radar separate from all existing financial and crypto Shorts routes, renderers, prompts, SEO, sources, tables, and publishing behavior. Its only approved shared integrations are the Finance main-menu entry and reuse of the existing Bybit banner in Whale Radar's CTA. The current Telegram bot is its entry point; do not publish automatically. A source must identify or label the wallet before the video calls it a whale; transaction size or DEX volume alone is not proof. If whale attribution is unavailable, report that clearly instead of silently substituting large swaps. Large-transfer coverage requires a user-selected token set.

**Why:** The user requires this format to stay isolated, selected Nansen Smart Money labels as its attribution source, and explicitly rejected treating large DEX swaps as whales; the two shared integrations were approved only for Whale Radar.

**How to apply:** Use the `whale:` Telegram callback namespace and whale-specific modules/tables. Keep scans and previews user-initiated, and verify existing growth formats remain unchanged.

Nansen Smart Money DEX Trades costs 5 credits per query, against a 10-credit daily free allowance. Reuse a successful scan for 24 hours; query OHLCV only after the user selects a trade for a video. A comparison coin must already have saved post-trade candles—do not spend more credits searching for a comparison.

**Why:** The user chose Nansen for actual Smart Money attribution and wants the free source to remain usable without repeated Telegram taps exhausting its small daily allowance.

**How to apply:** Preserve Nansen's explicit Smart Money labels, the daily scan cooldown, and lazy chart loading. Never substitute raw transfer size or DEX volume for wallet attribution.

Whale Radar Shorts may run up to 60 seconds. Give the narration a detailed, evidence-based account of the trade and show the coin's change from execution price to the latest available Nansen hourly close. Add a second coin only when there is a separate confirmed Nansen trade and usable post-trade candles; compare each coin from its own trade timestamp. Describe this as market-price movement, never wallet profit, and do not invent missing data.

**Why:** The user asked for a fuller one-minute story, animated real price charts, post-trade performance, and an optional second-coin comparison.

**How to apply:** Keep this richer format scoped to Whale Radar. Use one coin when a second confirmed event or usable post-trade data is unavailable.
