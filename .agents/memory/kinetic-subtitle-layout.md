---
name: Kinetic subtitle layout
description: Layout and visual-verification guidance for word-by-word ASS captions.
---

Use conservative glyph-width estimates and generous inter-word spacing for kinetic ASS captions. Keep phrases short enough to preserve large type, and inspect a representative rendered contact sheet; source-level position math alone did not catch perceived collisions in Russian uppercase.

**Why:** The font rendered Russian uppercase wider than the initial layout estimate, so neighboring words appeared joined even though their anchor coordinates were distinct.

**How to apply:** When positioning separate ASS events for each word, reserve extra width and review several seconds of actual output at full resolution before accepting the layout.

For Finance Long compositions, reserve a lower caption band and keep charts, network diagrams, and flow cards above it. Place kinetic subtitles within that band, then inspect rendered frames from the real graphics and caption builders together.

**Why:** Rendered Ethereum sample frames showed the captions crossing network lines and flow cards even though each layer rendered correctly on its own.

**How to apply:** Use bottom-anchored caption layouts and keep central graphics out of the lower caption band. Verify multiple full-resolution timestamps before approving a Finance Long visual change.

For this Finance Long style, the user wants no sentence punctuation in subtitles, one steady font size and position, and clearly visible illustrated shapes on the graphics layer.

**Why:** The user said punctuation and shifting typography weakened the sample, and asked that the scene figures be visibly drawn.

**How to apply:** Strip punctuation from rendered captions while preserving numeric separators, use a fixed caption anchor and size, and inspect burned-in frames to confirm that shapes remain visible above the background and clear of text.