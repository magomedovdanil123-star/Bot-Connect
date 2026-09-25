---
name: Financial visual-plan enum resilience
description: Preserve financial-plan reliability when an AI visual director returns noncanonical presentation enums.
---

AI visual planners may return unsupported or cross-field strings for presentation values despite explicit allowed lists. Treat motion and layout as cosmetic: canonicalize known aliases and use stable, logged fallbacks for unsupported values. If a visual-kind value is invalid, derive an allowed replacement from the concept and its narration excerpt. Keep scene coverage, narration alignment, and financial value provenance as hard checks.

**Why:** Local stock QA produced an otherwise valid plan with entry-animation values such as `float` and `swap`, and a scene transition value `swipe`. Rejecting these cosmetic strings caused repeated plan retries without protecting financial accuracy.

**How to apply:** When adding AI visual-plan fields, separate presentation choices from content and source-of-truth checks. Use deterministic fallbacks with warnings for presentation enums; do not weaken narration synchronization or checks that prevent unsupported financial claims.