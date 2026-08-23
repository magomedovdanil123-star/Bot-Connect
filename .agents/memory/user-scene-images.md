---
name: User scene images
description: Rules for replacing generated scene images with creator uploads.
---

Creators can upload a Telegram photo or image document for a selected scene before approving the project. The uploaded image becomes that scene's primary completed image while other scenes continue using generated assets.

**Why:** This preserves creator control over important visual moments without rebuilding the entire image set.

**How to apply:** Keep the upload scoped to a project and scene, preserve prior image versions as non-primary, and allow the video pipeline to reuse the completed upload. Music generation must fail explicitly if no usable track is available rather than silently rendering voice-only audio.