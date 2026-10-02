---
name: Cross-channel Shorts republishes
description: Preserve publication history when a finished financial or crypto Short is posted to an additional YouTube channel.
---

When a finished finance/crypto Short needs to be published to another channel, reuse the same saved MP4 and factual metadata. Preserve the existing channel's video ID and status, and record the new channel's upload separately. Do not delete the original publication unless the user explicitly asks.

**Why:** A single-destination publication record cannot safely be overwritten for a second channel: it erases the original audit trail and makes duplicate protection unreliable. Ambiguous upload outcomes must not trigger blind retries.

**How to apply:** In a Telegram-first cross-channel repost flow, require an explicit target channel, store status and video ID per destination, and fail closed for published, in-flight, or unknown attempts.