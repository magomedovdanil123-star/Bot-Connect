---
name: Scribe numeric tokenization
description: Scribe may transcribe spoken Russian years as numerals and hyphenated compounds as single words.
---

When aligning immutable Russian narration captions to Scribe v2 word timestamps, spell years as numerals in the approved script when that is how the transcript represents the spoken year. Scribe may also keep a hyphenated compound as one token.

**Why:** a spelled-out year was transcribed as one Arabic numeral, leaving several approved words without exact Scribe timestamps; the shared aligner could interpolate those missing times.

**How to apply:** compare the actual transcript tokens before rendering, preserve the intended meaning in the script, and require exact per-word matches for strict test renders. Do not accept interpolated timestamps as a fallback.