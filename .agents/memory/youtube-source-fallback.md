---
name: YouTube source fallback
description: Environment-specific limitation and fallback for downloading source videos.
---

YouTube links can return a bot/authentication or PO-token requirement even when the URL is public. The cut flow should try supported yt-dlp clients, then offer a Telegram-uploaded MP4 instead of treating the failure as an AI or editing error.

**Why:** The hosted server IP may be challenged by YouTube and cannot use a browser session or user cookies automatically.

**How to apply:** Keep the direct Telegram MP4 path available for video cutting, and show a clear user-facing explanation when all YouTube download attempts fail.