# Premium Dynamic Finance V1.1 — Dogecoin render report

## Render

- File: `premium-dynamic-finance-v1-1-dogecoin.mp4`
- Duration: 120.000 seconds
- Video: h264, 1920×1080, 30/1 fps
- Audio: aac; music bed only, looped to 120 seconds
- Captions: authored script, timed to twelve ten-second scenes
- Visual pipeline: existing Premium Dynamic renderer for the base; V1.1 cards composited afterward by the local test runner

## Live market data

- Coin: Dogecoin (DOGE)
- Source: CoinGecko — https://www.coingecko.com/en/coins/dogecoin
- Data as of: 2026-10-03T13:34:20.000Z
- Retrieved at: 2026-10-03T13:36:59.182Z
- Current price: USD 0.092732
- Seven-day change: -4.538372834114767%
- Seven-day range: 0.09106128548394973–0.09864233938907437 USD
- Open interest: 99204948.108084 USD (Hyperliquid — https://hyperliquid.xyz)
- Market cap: 14481965277 USD
- Genesis date: not supplied; omitted from the timeline value
- Coin logo: embedded from the existing CoinGecko market-data resolver

## Visual-plan checks

- Semantic scenes: 12
- Adjacent repeated visual types: 0
- Fallback scenes: 0
- Count by visual type:
- COIN_INTRO: 1
- MARKET_DATA: 1
- PRICE_CHART: 1
- STAT_CARD: 1
- TIMELINE: 1
- COMPARISON: 1
- NEWS_CARD: 1
- UI_TERMINAL: 1
- ILLUSTRATION: 1
- ICON_CLUSTER: 1
- QUOTE: 1
- FULLSCREEN_IMPACT: 1
- News card label: “Illustrative · not news”
- Trading terminal label: “Fictional interface”; it shows no order book or executable quotes
- Network illustration label: “Illustration only”; it is not a live blockchain view
- Financial values are taken from resolved market data; no historical performance or return forecast was invented

## Isolation

- Executed through the local V1.1 test runner only
- Telegram routing was not invoked
- Production renderer and production Telegram routes were not changed for this render
- Report file: `premium-dynamic-finance-v1-1-dogecoin.report.md`
