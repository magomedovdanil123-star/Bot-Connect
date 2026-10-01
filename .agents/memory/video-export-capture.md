---
name: Video artifact export capture
description: Reliable full-frame-rate capture of browser-rendered video artifacts in this Replit workspace.
---

**Rule:** For frame-rate-sensitive browser animation exports in this workspace, prefer the existing X11/VNC display with FFmpeg `x11grab` over full-resolution headless CDP screencast frames, keep the display mode fixed throughout each capture, and use a fresh Chromium profile with `--disable-gpu` if its GPU process fails.

**Why:** At 1080×1920, Chromium's headless screencast path produced roughly 7 fps here, making motion visibly stutter when converted to 30 fps. X11 can capture at 30 fps, but changing resolution or opening another browser during an active capture can trigger shared-memory errors and truncate the output. Chromium's GPU process also exited in the VNC environment without an out-of-memory event; a fresh profile with `--disable-gpu` stayed stable through a full-length capture. FFmpeg's average speed includes any scheduled pre-roll, so judge capture rate after subtracting that wait. Chrome's translation overlay can return after a reload and is burned into desktop captures.

**How to apply:** Check the VNC display resolution, set a temporary mode matching the target dimensions, launch one non-headless Chromium instance with a fresh profile (add `--disable-gpu` if GPU initialization fails), dismiss any browser language-translation overlay after the final page load, hide the pointer, and record with FFmpeg `x11grab`. For scheduled starts, align the page's epoch start to the relative X11 PTS; use wall-clock input timestamps and CFR output when capture timing can jitter. Do not run another display test until capture finishes. Restore the original mode and stop the browser afterward. Verify dimensions, frame rate, duration, and audio with `ffprobe`.

**Large-file delivery rule:** `presentAsset` rejects files larger than 100 MiB. Do not silently reduce a full-quality export to fit; offer the user a compressed attachment or a private App Storage upload with a temporary signed download link. Explain usage-based storage and transfer charges, that anyone with the link can use it while valid, and that link expiry does not remove the stored object.

**Why:** A verified full-resolution MP4 exceeded the attachment limit. App Storage accepted it, but the object remains billable until deleted even after its seven-day signed URL expires.

**How to apply:** For the storage option, upload beneath `PRIVATE_OBJECT_DIR`, verify remote size, test the signed GET link with a one-byte Range request, and disclose the retention and access tradeoffs. Never put the signed URL in source control or project memory; remove temporary logs containing it after delivery.