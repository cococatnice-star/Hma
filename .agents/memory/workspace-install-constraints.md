---
name: Workspace install constraints
description: Replit package firewall and pnpm compatibility notes for this workspace.
---

The package firewall blocked `proxy-addr@2.0.7` but allowed compatible patch `2.0.8`. pnpm 12 requires `allowBuilds` instead of the older `onlyBuiltDependencies` field to permit the repository's approved install scripts.

**Why:** The original locked patch failed installation through the Replit package registry, and pnpm 12 refused to run the required esbuild install script under the old config.

**How to apply:** Keep the compatible lockfile patch and the existing narrow build-script allowlist. After any filtered install, run a full workspace install before the monorepo typecheck; do not bypass the package firewall.
