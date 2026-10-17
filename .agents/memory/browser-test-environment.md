---
name: Browser regression test environment
description: Why local Playwright tests should prefer the managed Chromium on Replit.
---

Use Replit's managed Chromium for local browser regression checks rather than assuming a freshly downloaded Playwright browser can launch on NixOS.

**Why:** Downloading Playwright Chromium succeeded here, but launching it failed because its shared-library loader could not find libglib-2.0.so.0. The managed Chromium launched successfully without modifying the project's system packages.

**How to apply:** Allow an explicit executable override for portability. Outside Replit, use Playwright's normal browser and system-dependency setup; do not hardcode Nix store library paths.
