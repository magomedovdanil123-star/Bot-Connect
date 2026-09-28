---
name: API workflow orphan process
description: Recover the API artifact workflow when a previous Node child still occupies its port after a failed restart.
---

A failed API artifact workflow restart with `EADDRINUSE` can coexist with the previous `dist/index.mjs` Node process still serving on port 8080. The new process fails while the old child remains under its former shell process tree.

**Why:** A restart reported `EADDRINUSE` even though the previous API process remained alive and answered HTTP requests.

**How to apply:** Check the listener PID, process command line, and `/proc/<pid>/cwd` before acting. Send SIGTERM only to a verified API-server child, confirm the port is released, then restart the managed artifact workflow once.