---
name: Production-only context crashes
description: Shared React contexts can be duplicated by pnpm peer variants in production builds.
---

When the published site reports a missing provider that visibly exists in the source, check for duplicate runtime-library contexts before adding another provider.

**Why:** Different React peer resolutions in pnpm created separate React Query copies for the website and shared API hooks. The development preview worked, but the production bundle used different contexts for the provider and consumer and rendered only the background.

**How to apply:** Compare resolved package paths and the actual production bundle. Deduplicate context-owning libraries in the consuming app when necessary; a successful development screenshot alone does not rule out a production-only context split.
