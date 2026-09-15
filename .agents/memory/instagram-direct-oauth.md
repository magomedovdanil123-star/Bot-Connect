---
name: Instagram direct OAuth
description: The Instagram account connection path for users who do not have a Facebook Page
---

Use Instagram Login for professional Instagram accounts rather than the Facebook Login/Page-account discovery flow. Each OAuth completion represents one Instagram account and must be upserted by Instagram user ID so adding another account does not replace existing connections.

**Why:** Users may have only Instagram and no Facebook Page. The Facebook Page flow incorrectly rejects those accounts even when the Instagram profile is suitable.

**How to apply:** Require a Creator or Business Instagram account and a Meta/Instagram app's client credentials, but do not require the user's Instagram profile to be linked to a Facebook Page. Keep Instagram storage, UI, and Telegram controls separate from YouTube.