---
name: Workspace install constraints
description: Replit package firewall and pnpm compatibility notes for this workspace.
---

The package firewall blocked `proxy-addr@2.0.7` but allowed compatible patch `2.0.8`. pnpm 12 requires `allowBuilds` instead of the older `onlyBuiltDependencies` field to permit the repository's approved install scripts. Publishing uses pnpm 10.26.1; an unpinned Corepack invocation selected 12.14.0, leaving a differently generated `node_modules` that made the publish install abort without a TTY.

**Why:** The original locked patch failed installation through the Replit package registry, pnpm 12 refused to run the required esbuild install script under the old config, and publishing could not clean up modules created by another pnpm version.

**How to apply:** Keep the compatible lockfile patch, narrow build-script allowlist, and root package-manager pin matching publishing. Reinstall with that pinned version before publishing; after any filtered install, run a full workspace install before the monorepo typecheck. Do not bypass the package firewall.
