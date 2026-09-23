---
name: Finance topic semantics
description: Semantic constraints for the universal finance Shorts planner and renderer.
---

The universal finance renderer must receive topic-specific labels for the instrument definition, key metric, maturity or outcome, and final risk checklist. A generic bond caption is not safe for stocks, dividends, or future topics.

**Why:** The first universal stock render was visually correct but showed the bond phrase “вернуть деньги” and bond-oriented checks. The issue was semantic, not a layout failure.

**How to apply:** Keep semantic profiles in the finance topic planner and pass them into each beat; treat new finance topics as requiring an explicit definition caption and summary checklist before rendering.