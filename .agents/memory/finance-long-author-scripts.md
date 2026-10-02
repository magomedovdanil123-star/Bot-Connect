---
name: Finance Long author scripts
description: Workflow rules for user-supplied Finance Long narration, coin context, pre-approval voice preparation, and manual YouTube covers.
---

For user-authored Finance Long videos, collect every script message before starting. Prefer a leading `Монета: TICKER` metadata line and remove only that line from narration; if the coin is missing or ambiguous, ask for its exact name or ticker, then resolve it before continuing. Use verified coin data only as visual context and do not rewrite the user's narration.

Do not reject a user-authored Finance Long script because its estimated runtime exceeds 20 minutes. Keep the existing input-size safety limit; generated scripts retain their separate duration rules.

Prepare the scene voice before showing the Finance Long storyboard. Keep video production behind the explicit storyboard approval; when those exact scene texts already have completed active voice rows, reuse them rather than generating duplicates.

After final video approval, let the user select one or all YouTube channels, then require a manually uploaded JPEG cover before publication. Never generate or substitute the cover. Persist the selected channel IDs and cover storage path with the publication draft so a process restart does not lose the user's choices.

**Why:** The user wants one multipart script flow with coin identification inside the submission, a prepared voice before storyboard review, final rendering only after approval, and control over the cover and publication targets.

**How to apply:** Keep these behaviors scoped to Finance Long author scripts and their YouTube publication flow. Do not change Shorts or story workflows.

For Telegram Finance Long creation, make the coin-overview-plus-user-script route the primary entry; keep automatic coin overview and standalone user scripts as separate alternatives.

**Why:** The user requested that “обзор монет + свой сценарий” be the main Long-creation path and have its own button.

**How to apply:** Keep a direct shortcut to the dedicated coin-and-script flow and list it first in the Long options menu. Do not merge the alternate flows into it.