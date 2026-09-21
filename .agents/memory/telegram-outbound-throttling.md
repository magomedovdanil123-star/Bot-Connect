---
name: Telegram outbound throttling
description: Durable constraint for Telegram status and media delivery during multi-channel horoscope runs.
---

All Telegram outbound status, photo, and video sends must use one paced queue and honor Telegram retry_after responses. A failed horoscope run can still contain completed or processing video jobs; recovery must deliver or reattach those jobs without rebuilding them.

**Why:** Parallel per-channel monitors triggered Telegram flood control, causing ready MP4 delivery tasks to fail even though the video files were already stored.

**How to apply:** Keep completed-job delivery independent from the parent run status, serialize outbound sends, and let startup recovery process completed and processing horoscope jobs from recoverable runs.