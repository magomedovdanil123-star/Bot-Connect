---
name: X11 portrait capture
description: Capture portrait videos from the VNC X11 desktop when output rotation is unsupported.
---

The workspace's VNC output can expose a 1920×1080 mode while rejecting hardware/output rotation. A larger virtual framebuffer can still render and capture a full-height browser window with x11grab; align the app content to the capture origin, hide browser overlays and scrollbars, and restore the original display state in a `finally` path.

**Why:** This Replit VNC output rejected `--rotate left`, but x11grab successfully captured a 1080×1920 region from an expanded virtual framebuffer.

**How to apply:** Verify the browser window's client area is exactly 1080×1920 inside the virtual framebuffer before a long render. Always restore the original VNC mode and framebuffer, even if Chromium or FFmpeg fails.
