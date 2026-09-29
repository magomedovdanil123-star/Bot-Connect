---
name: Market leaders data source
description: Provider choice and attribution rules for the global seven-day crypto leaders format.
---

Use CoinMarketCap for the global top-100 seven-day market-leaders format. Keep the separate single-coin overview on CoinGecko. Every saved plan, video source card, and Telegram completion summary for market leaders must identify CoinMarketCap.

**Why:** CoinGecko returned a CloudFront HTTP 403 from the project environment. The user approved CoinMarketCap as the replacement source for this format, but not for other crypto formats.

**How to apply:** Do not silently mix ranking, prices, and history across providers. If CoinMarketCap access or historical OHLCV is unavailable, explain the specific access failure instead of falling back to another provider.