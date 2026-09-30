---
name: Rolling 30-day market focus
description: Snapshot consistency and sparse Binance candle handling for rolling monthly coin-focus videos.
---

The 30-day Telegram ranking and selected video must use the same Binance snapshot: window boundaries, opening price, current ticker price, and period return. Keep the 30-day visual theme and its duplicate history separate from the 24-hour format.

**Why:** Recalculating after coin selection can make the video percentage disagree with the ranking the user chose, and silently changes a financial claim. Binance can omit 1-minute candles when no trades occurred, so requiring a fully contiguous minute series can reject otherwise valid markets.

**How to apply:** Carry the selected ranking snapshot through saved plans and retries. For 30-day aggregation only, preserve all 30 rolling daily buckets across missing minutes, carry forward the last close for empty periods, and count volume only from returned candles. Keep strict candle validation in the 24-hour path.