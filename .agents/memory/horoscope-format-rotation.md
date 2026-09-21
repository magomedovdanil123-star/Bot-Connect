---
name: Horoscope format rotation
description: Durable rule for avoiding repeated horoscope formats when stored history and planner output use different string forms.
---

Compare horoscope formats by their base name, not by the full display string. A stored history entry may contain the short format while the planner returns the same format with a channel suffix. When the latest format repeats and alternatives exist, select an available alternative before final validation.

**Why:** Exact string comparison allowed a repeated format to pass selection and then fail validation, causing the Content Plan to abort even though two valid alternatives were available.

**How to apply:** Normalize the format before history checks, candidate scoring, repair filtering, and final validation. Prefer automatic substitution over spending repair attempts on an otherwise valid plan.