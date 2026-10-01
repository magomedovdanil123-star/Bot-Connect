---
name: ImageMagick SVG gradient artifacts
description: SVG radial gradients rasterized into transparent overlays can show strong banding.
---

Avoid large SVG radial gradients in transparent overlays rasterized with ImageMagick. The HYPE diagram's low-opacity radial gradient appeared as conspicuous, saturated concentric bands in the PNG; simple transparent fills and strokes rendered cleanly.

**Why:** SVG source appearance does not reliably predict the rasterized overlay in this environment.

**How to apply:** use restrained flat shapes for ImageMagick-rasterized overlays, and inspect the generated PNG before starting a long FFmpeg render.