---
name: App Storage retention audit constraints
description: Distinguishes object metadata access, bucket lifecycle visibility, and signed-link expiry.
---

The running API can read individual Replit App Storage object metadata while lacking permission to inspect bucket-level lifecycle or retention policy. A signed download URL's expiry limits that URL; it does not imply that the stored object is deleted.

**Why:** In this project, object metadata was readable but bucket metadata returned a `storage.buckets.get` permission denial, and Replit's public documentation did not specify the configured bucket lifecycle.

**How to apply:** For future retention audits, treat bucket lifecycle as unknown until checked through an authorized App Storage surface. Never infer object deletion from signed-link TTL or apply cleanup based on an assumed bucket policy.