---
name: Telegram video review
description: The Telegram approval gate between video rendering and YouTube SEO preparation.
---

Completed renders should be sent from Object Storage to Telegram for human review before any SEO or thumbnail work begins. The approval action must reuse the existing Object Storage path rather than upload the MP4 again; the redo action starts a new pipeline for the same approved project.

**Why:** The creator wants to inspect the actual finished MP4 and avoid manually downloading/re-uploading it, while keeping the existing SEO flow unchanged after approval.

**How to apply:** Keep the review state tied to the completed project/job and include both approval and redo actions on the Telegram message. Handle large Telegram payloads using the existing video/document fallback while preserving the inline keyboard.