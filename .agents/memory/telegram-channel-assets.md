---
name: Telegram channel asset paths
description: Channel-specific YouTube character assets live at the workspace root, while the API workflow runs from its package directory.
---

The API must resolve shared attached assets from the workspace root as well as the package directory; otherwise approved channel images are missed and an old/generated character can be used.

**Why:** The pnpm-filtered API workflow runs with `artifacts/api-server` as its working directory, while selected channel images are stored in the root `attached_assets/generated_images` tree.

**How to apply:** When adding or changing channel asset lookup, support the workspace-root path explicitly and prefer the approved file before reading persisted fallback objects.