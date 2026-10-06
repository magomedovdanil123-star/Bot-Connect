---
name: Scribe numeric tokenization
description: Scribe may transcribe spoken Russian years as numerals and hyphenated compounds as single words.
---

When aligning immutable Russian narration captions to Scribe v2 word timestamps, spell years as numerals in the approved script when that is how the transcript represents the spoken year. Scribe may also keep a hyphenated compound as one token. If an approved Arabic integer is spoken as Russian cardinal words, match the complete parsed number only when its value is identical; use the first and last Scribe word boundaries for that caption token. Keep any following scale/unit word as its own exact match when the approved script contains it separately.

**Why:** spoken-number tokenization can differ from approved captions (for example, `170` becomes `сто семьдесят` and `239 миллионов` becomes `двухсот тридцати девяти миллионов`). Correct value parsing preserves the approved caption while exact phrase boundaries avoid invented word timing.

**How to apply:** compare actual transcript tokens before rendering, preserve the approved caption text, require exact matches for production alignment, and accept a spelled-out integer only when the whole cardinal phrase parses to exactly that integer. Do not match a shorter prefix of a different number. For cropped samples, include adjacent scenes needed to establish the crop boundary, scope coverage to those scenes, and never use interpolated timestamps inside the rendered interval as a fallback.