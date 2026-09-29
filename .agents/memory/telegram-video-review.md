---
name: YouTube SEO publication
description: Telegram YouTube SEO, explicit public channel selection, and the remaining specialized review paths.
---

For completed project videos and financial/crypto Shorts, generate a factual, clickable YouTube title, SEO description, tags, and hashtags automatically after Telegram delivers the finished MP4. Show the full SEO preview and connected channel choices. Selecting one channel is explicit consent to publish publicly immediately; do not add a second approval, privacy, or scheduling step. Keep SEO edits and video redo available.

**Why:** The creator requested automatic SEO metadata and immediate public publication after channel selection. This replaces the earlier manual-metadata approval flow for these video types.

**How to apply:** Treat the selected channel button as the final confirmation and label it clearly as public/immediate. Persist job-linked draft and publication status, reject stale or repeated callbacks, and retain the existing Object Storage video path. Finance/crypto metadata must avoid story/delivery language and unsupported market claims. Keep horoscope and cut-batch workflows on their specialized review paths unless explicitly changed. For a failed draft, retry only when the recorded error proves failure happened before upload (such as OAuth refresh failure), no video ID exists, and the selected channel has no matching video since the attempt; persist `publishing` before retry. Do not blindly retry ambiguous upload-stage errors. Telegram MP4 delivery still needs restart recovery, 429 handling, and the existing video/document fallback with inline buttons.

**Why:** A YouTube upload may succeed even if the app fails before saving its video ID. Retrying an uncertain outcome can create a public duplicate, while a refresh-token failure occurs before upload starts.