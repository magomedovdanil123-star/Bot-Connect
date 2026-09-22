---
name: Telegram agent architecture
description: The personal agent is an isolated, approval-first Telegram workflow over whitelisted existing actions.
---

The personal agent must stay isolated behind `menu:agent` and `agent:*` callbacks, persist tasks and audit events in its own tables, and require user approval before execution. It may call existing video preparation, YouTube synchronization, and reporting flows, but publishing, deletion, branding changes, code edits, and deployment remain manual or separately approved.

**Why:** The bot has many existing side-effectful flows and volatile in-memory sessions. A separate durable task/plan boundary prevents an experimental agent from changing established workflows or repeating external side effects after a restart.

**How to apply:** Add new agent capabilities as explicit whitelisted actions with durable status transitions and user-visible errors; do not let the LLM invent direct API calls or bypass existing approval/pipeline guards.

When an execution fails, the bot should create a review packet in Telegram and keep the task resumable. The user can forward the packet to Replit Agent for a code fix, then use the Telegram resume action after the fix; there is no supported direct injection into the active Replit Agent chat.