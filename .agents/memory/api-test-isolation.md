---
name: API test isolation
description: Node test bundling quirks and cleanup constraints for the API server.
---

Keep focused API-server Node tests on pure helper modules. Importing the YouTube service module can pull the workspace database's TypeScript directory entry into an esbuild bundle; Node ESM rejects that directory import with `ERR_UNSUPPORTED_DIR_IMPORT`.

**Why:** A pure metadata helper test failed before executing because its service-module import loaded unrelated database wiring.

**How to apply:** For unit tests, depend on pure metadata/data helpers rather than service modules that initialize the database or external APIs.

FFmpeg color probes on yuv420 video cannot reliably use a 1×1 crop; subsampling can reduce it to an invalid zero-sized frame.

**Why:** A rendered-frame color assertion failed in FFmpeg before it could read a pixel.

**How to apply:** Use an even 2×2 crop and average its RGB values when a test needs a single-point color sample.

The API server's `.test-build` directory contains a tracked generated fixture, while an existing test script removes that entire directory after running.

**Why:** Running that cleanup deleted the tracked fixture even though the test itself passed.

**How to apply:** New test scripts should emit to and remove a dedicated subdirectory, not the shared `.test-build` root.