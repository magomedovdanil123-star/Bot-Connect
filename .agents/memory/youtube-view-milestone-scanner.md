---
name: YouTube view milestone scanner
description: Daily Telegram notification for same-day YouTube uploads that reach the view threshold.
---

The Telegram bot checks connected YouTube channels at or after 16:00 Europe/Moscow and reports videos published during the current Moscow day once they have at least 1,000 views.

**Why:** The creator wants an end-of-day signal for clips that perform well without receiving repeated notifications throughout the day.

**How to apply:** Keep the scan bounded to the current Moscow calendar day, query channel upload playlists and video statistics, notify configured Telegram chats only when matches exist, and guard the scan so it runs once per day per process.