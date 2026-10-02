---
name: Runtime database access
description: Prefer the running API process for one-off database operations when direct workspace access is unreliable.
---

For runtime database operations, do not assume an ad-hoc workspace Node import or direct PostgreSQL connection will work. Prefer an existing API route or a guarded one-time path through the running API process.

**Why:** Direct imports of the workspace database package failed under the local ESM resolver, and a shell database request timed out, while the API process successfully connected and performed the required operation.

**How to apply:** Use the app's established database connection and business logic for operational reads or writes. Keep one-off triggers narrowly scoped and idempotent, and remove them after use.