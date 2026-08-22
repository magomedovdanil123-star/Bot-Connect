---
name: Author script voice separation
description: Durable rule for separating screenplay directions from spoken audio in author-submitted series scripts.
---

Author-submitted screenplay text must be preserved for Telegram and scene planning, but the voice track should contain only dialogue, explicit narration, and the system CTA. Scene actions, character labels, scene headings, end markers, and on-screen text are visual or editorial metadata, not spoken audio.

**Why:** Sending every screenplay line to voice caused actions and production notes to be read aloud, while sending scenes independently created unnecessary provider requests and long queues.

**How to apply:** Keep the full author text in the script representation, derive spoken text immediately before voice generation, and generate the spoken track as one request while retaining scene-level timings for captions and image montage.