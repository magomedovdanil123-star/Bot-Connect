---
name: Market leaders data source
description: Provider choice and attribution rules for the global seven-day crypto leaders format.
---

Use CoinGecko for the global top-100 seven-day market-leaders format. Every saved plan, video source card, and Telegram completion summary must identify CoinGecko. A Demo API key may be supplied through Secrets when unauthenticated market-data requests are rejected.

**Why:** The user chose to keep the existing CoinGecko source and fix its access rather than migrate the format to CoinMarketCap. The public ping endpoint is reachable from the workspace, but the market listings endpoint returns HTTP 403.

**How to apply:** Keep requests on CoinGecko and use its Demo API key only when configured. If CoinGecko still rejects market-data requests, explain the access failure rather than silently mixing providers.