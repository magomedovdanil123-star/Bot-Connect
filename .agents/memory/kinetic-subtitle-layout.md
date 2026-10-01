---
name: Kinetic subtitle layout
description: Layout and visual-verification guidance for word-by-word ASS captions.
---

Use conservative glyph-width estimates and generous inter-word spacing for kinetic ASS captions. Keep phrases short enough to preserve large type, and inspect a representative rendered contact sheet; source-level position math alone did not catch perceived collisions in Russian uppercase.

**Why:** The font rendered Russian uppercase wider than the initial layout estimate, so neighboring words appeared joined even though their anchor coordinates were distinct.

**How to apply:** When positioning separate ASS events for each word, reserve extra width and review several seconds of actual output at full resolution before accepting the layout.