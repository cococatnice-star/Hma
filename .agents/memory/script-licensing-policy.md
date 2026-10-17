---
name: Script licensing policy
description: User-selected ownership policy and why script licensing must stay production-bound and recoverable.
---

## Ownership

The user selected “One Discord member per key”: the first member who redeems a key owns it.

**Why:** the user explicitly chose this policy for the 90-key script batches rather than shared keys.

**How to apply:** preserve member ownership when adding key replacement, revocation, script updates, or alternate redemption interfaces. Do not silently turn keys into shared licenses.

## Production-bound bot actions

Public named loaders and the Discord actions that create/redeem their keys must use the same published database. A development bot using the same token must ignore these interactions, not compete to answer them. Production replicas also need persistent interaction deduplication.

**Why:** development and production share the bot identity. A development reply can hand out a valid-looking key that does not exist in the database checked by the public loader; multiple production gateway sessions can also receive one interaction.

**How to apply:** preserve environment isolation and cross-instance claims when changing bot startup, hosting, or interaction delivery. Synthetic service tests can use development storage without issuing real Discord licenses.

## Encryption-secret continuity

Treat the secret used to recover stored license keys as persistent business data, not a disposable login-session setting.

**Why:** members and administrators must retrieve their keys after the original private setup reply is gone. Rotating or removing the shared session secret without migrating the encrypted keys makes that recovery fail.

**How to apply:** migrate encrypted key material before secret rotation or an authentication-provider migration; do not assume invalidating browser sessions is the only effect.

## Always-on hosting

The user wants the Discord bot available 24/7.

**Why:** the user explicitly requested continuous bot operation, not availability only while the website has traffic.

**How to apply:** use always-running production hosting for the gateway connection. Do not treat an active development workflow or an idle-stopping Autoscale deployment as proof of 24/7 availability. Explain ongoing hosting charges before the user confirms publishing.

## Sharing uploaded source

Keep advance disclosure and explicit uploader agreement when forwarding uploaded Lua to the CocoX owner.

**Why:** source uploads may belong to other script creators; the owner's request for a private copy must not silently expose someone else's private code.

**How to apply:** retain consent before any source download or forwarding, keep source out of public panels and logs, and report delivery failures without hiding successfully created keys.
