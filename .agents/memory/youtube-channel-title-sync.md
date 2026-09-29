---
name: YouTube channel title sync
description: Durable rule for keeping Telegram channel labels aligned with renamed YouTube channels.
---

YouTube channel synchronization must refresh every saved OAuth connection and update the stored title for existing channel IDs. Syncing only the active or most recently updated connection leaves other renamed channels stale. Do not reuse credential snapshots after an earlier source has updated a saved connection; that can overwrite a fresh token with a revoked one.

**Why:** A project can store multiple channel connections, and each refresh token may expose a different set of channels. One successful account sync can refresh several saved rows; a stale snapshot can undo that update. The Telegram list is rendered from stored titles, not directly from YouTube.

**How to apply:** On a full sync, iterate all saved connections, use the latest credential state for each row, fetch current channel metadata, match by YouTube channel ID, update existing records, and insert only unseen channels. Continue past per-connection failures and report partial results with a reauthorization action when needed.