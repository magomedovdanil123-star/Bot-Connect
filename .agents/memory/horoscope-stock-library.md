---
name: Horoscope stock library
description: Licensed horoscope visuals are persisted in Supabase and selected with topic-based rotation; AI image generation is not used for horoscope scenes.
---

The horoscope visual library uses real Openverse/Wikimedia/NASA media, stores source and license metadata alongside Supabase media assets, composites zodiac name and symbol onto each sign image, and rotates cosmic scene assets by topic so separate videos do not always reuse the same order.

**Why:** Provider rate limits make a single stock source unreliable, while horoscope scenes must remain reproducible, licensed, and independent of AI image generation.

**How to apply:** Preserve provenance fields and the stock-only guard when extending horoscope generation; treat provider fallbacks and topic-based diversity as part of the feature, not optional presentation details.