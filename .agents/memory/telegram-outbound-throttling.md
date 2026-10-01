---
name: Telegram outbound throttling
description: Durable constraint for Telegram status and media delivery during multi-channel horoscope runs.
---

All Telegram outbound status, photo, and video sends must use one paced queue and honor Telegram retry_after responses. A failed horoscope run can still contain completed or processing video jobs; recovery must deliver or reattach those jobs without rebuilding them.

For a user-requested one-off media delivery, resolve exactly one saved private chat and stop if the recipient is ambiguous. Use the bot's existing video-send path; do not add an unauthenticated endpoint or broadcast to every saved chat.

**Why:** Parallel per-channel monitors triggered Telegram flood control, and sending to an ambiguous saved destination could expose user media. The established sender handles upload limits and retry behavior.

**How to apply:** Keep completed-job delivery independent from the parent run status, serialize outbound sends, and let startup recovery process completed and processing horoscope jobs from recoverable runs. For manual media, require one private recipient, send through the bot's paced helper, and verify Telegram accepted the expected dimensions.

When the user asks to send an original video that exceeds Telegram's Bot API upload limit, send a single inline-button message with its private, time-limited download link instead of attempting a media upload. Make clear that it is a link, not an attachment, and disclose expiry and storage retention.

**Why:** A full-quality export can exceed Telegram's upload limit by a wide margin; a link preserves the source without a destructive recompression.

**How to apply:** Resolve exactly one saved chat, verify its Telegram type is `private`, confirm the signed URL works, then send one paced `sendMessage` with a URL button and honor `retry_after`. Never broadcast the link or store its signed URL in project files.