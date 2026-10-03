---
name: API test isolation
description: Node test bundling quirks and cleanup constraints for the API server.
---

Keep focused API-server Node tests on pure helper modules. Importing the YouTube service module can pull the workspace database's TypeScript directory entry into an esbuild bundle; Node ESM rejects that directory import with `ERR_UNSUPPORTED_DIR_IMPORT`.

**Why:** A pure metadata helper test failed before executing because its service-module import loaded unrelated database wiring.

**How to apply:** For unit tests, depend on pure metadata/data helpers rather than service modules that initialize the database or external APIs.

The API server's `.test-build` directory contains a tracked generated fixture, while an existing test script removes that entire directory after running.

**Why:** Running that cleanup deleted the tracked fixture even though the test itself passed.

**How to apply:** New test scripts should emit to and remove a dedicated subdirectory, not the shared `.test-build` root.