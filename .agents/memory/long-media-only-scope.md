---
name: Long media-only cleanup scope
description: Preserve Long source functionality and database records when removing Long media from this project.
---

The user's cleanup scope is media-only: remove Long generated images and videos plus Long-specific design and research materials, while leaving database rows, audio, Shorts assets, and Long pipeline functionality/source code intact. The user also chose to keep the existing Long logic until a replacement is ready.

**Why:** The shared Telegram bot imports Long-specific modules during startup, so deleting source code along with media prevents the API server from compiling. The user wants the old path retained until the new one is verified.

**How to apply:** For future Long cleanup, remove only media and descriptions unless the user explicitly asks to retire functionality. Preserve audio, database rows, Shorts assets, and source imports. Keep old Long actions until a separate replacement path is integrated and verified; then switch routing deliberately. Run the API-server build and verify Telegram connects before completing.