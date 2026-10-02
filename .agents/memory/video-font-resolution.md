---
name: Local video font resolution
description: Making downloaded variable fonts available to FFmpeg/libass in scratch renders.
---

When a downloaded variable font is not selected through FFmpeg/libass `fontsdir`, expose its directory through a temporary Fontconfig configuration and set `FONTCONFIG_FILE` for the render process.

**Why:** In this environment, `fontsdir` and `fc-cache` alone still caused libass to fall back to DejaVu Sans; a Fontconfig config pointing at the local font directory allowed Montserrat Bold to resolve. Passing this font directory as libass `fontsdir` also logs an error when it tries to load the bundled `OFL-Montserrat.txt` license as a font.

**How to apply:** For isolated video previews and caption compositing, keep font setup temporary and set `FONTCONFIG_FILE` on the FFmpeg process; do not also pass the full font directory as subtitle `fontsdir`. Verify the rendered caption face before accepting the render.