---
name: Finance topic semantics
description: Semantic constraints for the universal finance Shorts planner and renderer.
---

The universal finance renderer must receive topic-specific labels for the instrument definition, key metric, maturity or outcome, final risk checklist, and visual metaphor. A generic bond caption or storyboard is not safe for stocks, funds, dividends, or future topics.

**Why:** The first universal stock render was visually correct but showed the bond phrase “вернуть деньги” and bond-oriented checks. The issue was semantic, not a layout failure; the same risk applies to reusing bond-flow composition for ownership, fund-pool, or payout explanations.

**How to apply:** Keep semantic profiles and concept-specific storyboard rules in the finance topic planner, pass motion metadata into each beat, and treat a new finance topic as requiring its own object sequence before rendering. Select the background and chart family per beat; use deterministic educational data unless a dated live-data source is explicitly requested. Choose a visual template in a separate AI step before writing the scene script, then enforce its required scene/chart sequence while allowing AI variation inside flexible steps. For derivatives, use contract, leverage, market, and payoff compositions rather than generic document/flow scenes, and keep motion visible at the start of each scene.