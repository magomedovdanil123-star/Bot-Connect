---
name: YouTube statistics semantics
description: Telegram statistics currently reports current view totals for videos published in a selected period; daily growth needs snapshots.
---

The Telegram statistics report must label its values as the current YouTube view counter for videos published in the selected period. Do not call this daily growth until the system stores regular per-video snapshots and compares them.

**Why:** YouTube Data API exposes the current `viewCount`, not a historical per-day delta. Presenting the current total as “views gained today” would mislead channel decisions.

**How to apply:** Keep the current report explicit about its period and metric; add a snapshot table and scheduled collector before promising daily growth, channel ranking by growth, or historical charts.