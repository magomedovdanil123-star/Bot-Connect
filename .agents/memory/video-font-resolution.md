---
name: Local video font resolution
description: Making downloaded variable fonts available to FFmpeg/libass in scratch renders.
---

When a downloaded variable font is not selected through FFmpeg/libass `fontsdir`, expose its directory through a temporary Fontconfig configuration and set `FONTCONFIG_FILE` for the render process.

**Why:** In this environment, `fontsdir` and `fc-cache` alone still caused libass to fall back to DejaVu Sans; a Fontconfig config pointing at the local font directory allowed Montserrat Bold to resolve.

**How to apply:** For isolated video previews, keep font setup temporary and verify libass's selected face in FFmpeg logs before accepting the render.