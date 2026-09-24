---
name: Finance topic semantics
description: Semantic constraints for the universal finance Shorts planner and renderer.
---

The universal finance renderer must receive topic-specific labels for the instrument definition, key metric, maturity or outcome, final risk checklist, and visual metaphor. Keep core finance claims and illustrative payoff examples deterministic: a generated futures script can contradict a risk instruction even when the prompt explicitly forbids the false claim.

**Why:** The first universal stock render was visually correct but showed the bond phrase “вернуть деньги” and bond-oriented checks. Later, a futures script described collateral both as a loss cap and as not a loss cap. These are content-safety failures, not layout failures.

**How to apply:** Keep semantic profiles and concept-specific storyboard rules in the finance topic planner, pass motion metadata into each beat, and treat a new finance topic as requiring its own object sequence before rendering. Select the background and chart family per beat; use deterministic educational data unless a dated live-data source is explicitly requested. Choose a visual template in a separate AI step, then enforce its required scene/chart sequence. Use AI for flexible visual direction, but use reviewed deterministic copy for financially consequential claims and examples. For derivatives, use contract, leverage, market, and payoff compositions rather than generic document/flow scenes, and keep motion visible at the start of each scene.