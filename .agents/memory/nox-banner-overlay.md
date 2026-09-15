---
name: NOX banner overlay
description: The NOX campaign banner is a green-screen MP4 that should be keyed and placed above the main vertical video.
---

The NOX banner is a 1920×1080 video with a green background and no meaningful audio. Remove the green with chroma key, loop the visual layer for the full clip, and place it centered near the top so social controls do not cover it.

**Why:** A plain rectangular overlay would hide the source video with a bright green block, while the banner text needs enough size to remain readable.

**How to apply:** Keep the banner visible from the start (well before 3–4 seconds), emit only the processed video stream after the FFmpeg overlay, preserve only the source video's audio, skip automatic channel greetings/character overlays for NOX cuts, and keep the manual profile-link step separate from video editing.