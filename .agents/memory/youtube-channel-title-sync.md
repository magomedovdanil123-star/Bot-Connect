---
name: YouTube channel title sync
description: Durable rule for keeping Telegram channel labels aligned with renamed YouTube channels.
---

YouTube channel synchronization must refresh every saved OAuth connection and update the stored title for existing channel IDs. Syncing only the active or most recently updated connection leaves other renamed channels stale.

**Why:** A project can store multiple channel connections, and each refresh token may expose a different set of channels. The Telegram list is rendered from stored titles, not directly from YouTube.

**How to apply:** On a full sync, iterate all saved connections, fetch their current channel metadata, match by YouTube channel ID, update existing records, and insert only unseen channels. Surface authorization failures clearly rather than silently treating the partial result as complete.