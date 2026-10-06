---
name: Scribe numeric tokenization
description: Scribe may transcribe spoken Russian years as numerals and hyphenated compounds as single words.
---

When aligning immutable Russian narration captions to Scribe v2 word timestamps, keep approved caption text unchanged even when Scribe writes a Russian year as digits or an ordinal/cardinal phrase. Scribe may split compounds such as `мемкоин` into adjacent words or hyphenate them. Join only a complete observed span whose concatenated normalized text equals an approved compound; use its first and last Scribe boundaries. If an approved Arabic integer is spoken as Russian number words, match the full phrase only when its parsed value is identical, keeping separately captioned scale/unit words separate.

**Why:** Scribe tokenization varied across retries: it split/hyphenated financial compounds and could represent spoken numbers differently from approved captions (for example, `170` as `сто семьдесят` and `239 миллионов` as `двухсот тридцати девяти миллионов`). Exact value matching and phrase boundaries preserve captions without inventing timing.

**How to apply:** compare actual transcript tokens before rendering, preserve the approved caption text, and keep strict production alignment. Fold `ё`/`е` only for matching, allow exact adjacent-word concatenation for approved compounds, and map spoken numbers only when the entire cardinal/ordinal phrase parses to the expected integer. Do not match a shorter prefix of a different number or interpolate timestamps inside a rendered interval. For cropped samples, include adjacent scenes needed to establish the crop boundary and scope coverage to those scenes.