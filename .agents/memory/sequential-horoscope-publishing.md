---
name: Sequential horoscope publishing
description: Product rule for the horoscope pipeline to avoid parallel generation and Telegram flood control.
---

Horoscope runs should prepare and render one selected channel at a time. The next channel starts only after the current MP4 is approved and published publicly; private publication does not advance the queue.

**Why:** Parallel multi-channel generation overwhelmed Telegram delivery and made it difficult to know which ready video belonged to which channel.

**How to apply:** Reuse the sequential run state with nextIndex and activeItemId for daily, manual, weekly, and single-channel horoscope flows. Keep one active video job per run and preserve recovery across API restarts.