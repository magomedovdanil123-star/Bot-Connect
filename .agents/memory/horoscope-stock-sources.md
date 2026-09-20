---
name: Horoscope stock sources
description: Free horoscope visuals use open stock providers with license metadata instead of AI image generation.
---

Horoscope visual ingestion must prefer free stock: Openverse for images and Wikimedia Commons for videos, with Pexels as an optional provider when a project-managed key is available. Accept only commercial-compatible licenses (CC0, public domain, CC BY, or CC BY-SA); save provider, source URL, creator, license, and license URL with every downloaded asset.

**Why:** The user explicitly chose free stock photos and videos over the cost of AI-generated images.

**How to apply:** Keep stock retrieval separate from script generation, allow partial assets when one provider fails, and never silently fall back to paid or AI image generation.