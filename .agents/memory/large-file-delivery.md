---
name: Large file delivery
description: Size limit encountered when presenting large downloadable files.
---

Library asset registration rejects files larger than 104,857,600 bytes (100 MiB).

**Why:** An unchanged IPA copy exceeded this limit and returned TOO_LARGE, even though creating and validating the file succeeded.

**How to apply:** For large generated outputs, keep them in an ignored generated-artifacts directory and direct the user to download through project Files when a Library card cannot be registered. Do not claim a download card was delivered when registration fails.
