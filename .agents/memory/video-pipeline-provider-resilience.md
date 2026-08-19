---
name: Video pipeline provider resilience
description: Durable provider and retry constraints for the topic-to-video pipeline.
---

Long-running video generation must persist each stage and retry transient provider failures with bounded backoff; completed image, voice, audio, and subtitle stages should be reusable during a retry.

**Why:** Real runs encountered transient OpenRouter rate limits/provider errors and would otherwise fail a later stage despite all earlier artifacts being valid.

**How to apply:** Keep provider retries bounded and explicit, preserve stage outputs, and let a failed job resume from its last completed stage rather than silently regenerating everything.