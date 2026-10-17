---
name: Launcher confirmation verification
description: Verification standard for confirmations opened above the full-screen install chooser.
---

Launcher confirmation changes need an actual open/cancel check and an interactability check for their controls in the production build, not just a screenshot of the initial chooser or a DOM-visibility assertion.

**Why:** A portalled dialog can exist and satisfy visibility assertions while a full-screen surface covers it. The initial page can look healthy even though users cannot see or click the confirmation.

**How to apply:** Check phone and desktop layouts with the warning open and ensure its controls receive pointer events. Verify the native-install link without launching an actual installation during automated checks.
