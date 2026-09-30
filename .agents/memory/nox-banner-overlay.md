---
name: NOX banner overlay
description: The NOX campaign banner is a green-screen MP4 used only for explicit campaign/cut and horoscope workflows.
---

The NOX banner is a 1920×1080 video with a green background and no meaningful audio. Remove the green with chroma key, loop the visual layer for the full clip, and place it centered near the top so social controls do not cover it. Horoscope videos and explicit NOX campaign/cut workflows use the banner; ordinary financial explainers and coin reviews must not inherit story-banner metadata or assets.

**Why:** A plain rectangular overlay would hide the source video with a bright green block, while the banner text needs enough size to remain readable. A PUMP coin-review render also exposed that unrelated campaign metadata can leak into an ordinary financial video. Copied metadata and coincidental zodiac words in financial scripts are not reliable workflow classifiers.

**How to apply:** Determine horoscope/story eligibility from explicit project-to-workflow associations, not scene text or stale metadata. Only then may saved metadata supply that workflow's banner asset. Clear stale visual markers from unrelated projects and inspect a contact sheet for overlays before delivery. For applicable workflows, keep the banner visible from the start (well before 3–4 seconds), emit only the processed video stream after the FFmpeg overlay, preserve only the source video's audio, skip automatic channel greetings/character overlays for NOX cuts, and keep the manual profile-link step separate from video editing. Treat the banner as required for horoscope renders and fail clearly if the asset is unavailable.