---
name: Video artifact export capture
description: Reliable full-frame-rate capture of browser-rendered video artifacts in this Replit workspace.
---

**Rule:** For frame-rate-sensitive browser animation exports in this workspace, prefer the existing X11/VNC display with FFmpeg `x11grab` over full-resolution headless CDP screencast frames.

**Why:** At 1080×1920, Chromium's headless screencast path produced roughly 7 fps here, making motion visibly stutter when converted to 30 fps. The X11 display captured at 30 fps without slowing page timers. Chrome's translation overlay can return after a reload and is burned into desktop captures.

**How to apply:** Check the VNC display resolution, set a temporary mode matching the target dimensions, launch one non-headless Chromium instance, dismiss any browser language-translation overlay after the final page load, hide the pointer, and record with FFmpeg `x11grab`. Restore the original display mode and stop the browser afterward. Verify dimensions, frame rate, duration, and audio with `ffprobe`.