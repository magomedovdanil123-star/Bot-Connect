---
name: Financial volume chart units
description: Keep market-focus volume comparisons dimensionally consistent.
---

Compare daily volume totals with daily baselines over the same unit and duration. Do not place hourly volume bars against a daily-average reference line. If both granularities are useful, label and show the intraday profile separately from the daily-total comparison.

**Why:** A QNT visual once combined 24 hourly buckets with a seven-day average daily total on the same axis, which implied a comparison the chart did not support.

**How to apply:** Before rendering a finance volume chart, state the unit and time window represented by every bar, average, marker, and axis. Aggregate matching intervals or use a separate, clearly labeled panel.