---
name: Market leaders data source
description: Provider choice and attribution rules for the global seven-day crypto leaders format.
---

Use CoinGecko for the global top-100 seven-day market-leaders format. Every saved plan, video source card, and Telegram completion summary must identify CoinGecko. A Demo API key may be supplied through Secrets when unauthenticated market-data requests are rejected.

**Why:** The user chose to keep the existing CoinGecko source rather than migrate to CoinMarketCap. From the workspace, `/ping` and `/coins/{id}/market_chart` are reachable, while `/coins/markets` and `/simple/price` return HTTP 403 without Demo authentication.

**How to apply:** Keep requests on CoinGecko and use its Demo API key only when configured. If CoinGecko still rejects market-data requests, explain the access failure rather than silently mixing providers.