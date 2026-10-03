---
name: Premium Dynamic Finance V1.1 isolation
description: Project rule for experimenting with a V1.1 visual-diversity renderer without changing the active production path.
---

Keep `PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_DIVERSITY` in an isolated local/test path. Do not connect it to Telegram or modify production V1 routing/rendering unless the user separately instructs that integration.

**Why:** The user explicitly requires the visual-diversity work to be evaluated as an experiment before it can affect production videos.

**How to apply:** Build test adapters around the existing renderer, and keep Telegram and production modules free of V1.1 imports until the user authorizes a separate integration change.