---
name: ImageMagick montage fonts
description: Replit ImageMagick montage can fail without an explicit font path even when system fonts are installed.
---

Resolve DejaVu Sans with `fc-match -f '%{file}' 'DejaVu Sans'` and pass the returned readable path using ImageMagick's `-font` option before building a montage.

**Why:** ImageMagick `montage` failed with `unable to read font ''` while assembling a contact sheet, despite DejaVu Sans being installed and discoverable through Fontconfig.

**How to apply:** When generating contact sheets with ImageMagick in this environment, resolve and validate the font path before calling `montage`; do not rely on ImageMagick's blank default font.