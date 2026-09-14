---
name: Telegram video review
description: The Telegram approval gate between video rendering and manually entered YouTube publication data.
---

Completed renders should be sent from Object Storage to Telegram for human review before any publication metadata or thumbnail work begins. After approval, the creator enters the title, description, tags, and hashtags manually; the upload action must reuse the existing Object Storage path rather than upload the MP4 again, while redo starts a new pipeline for the same approved project.

**Why:** The creator wants to inspect the actual finished MP4, avoid manually downloading/re-uploading it, and keep full control over the YouTube text instead of accepting generated SEO copy.

**How to apply:** Keep the review state tied to the completed project/job, persist its Telegram chat and delivery timestamp, include both approval and redo actions, then request manual metadata before showing channel and privacy choices. On API restart, retry completed jobs without a delivery timestamp. Handle large Telegram payloads using the existing video/document fallback while preserving the inline keyboard.