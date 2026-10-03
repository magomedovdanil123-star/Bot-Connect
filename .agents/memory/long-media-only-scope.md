---
name: Long media-only cleanup scope
description: Preserve Long source functionality and database records when removing Long media from this project.
---

The user's cleanup scope is media-only: remove Long generated images and videos plus Long-specific design and research materials, while leaving database rows, audio, Shorts assets, and Long pipeline functionality/source code intact.

**Why:** The shared Telegram bot imports Long-specific modules during startup, so deleting source code along with media prevents the API server from compiling.

**How to apply:** For future Long cleanup, remove only media and descriptions unless the user explicitly asks to retire functionality. Preserve audio, database rows, Shorts assets, and source imports; run the API-server build and verify Telegram connects before completing.