---
name: Local CMS profile inspection
description: Why generic PKCS7 content helpers can silently lose embedded provisioning-profile metadata.
---

Treat an apparently empty PKCS7 helper result as inconclusive, not as evidence that a provisioning profile has no content. Decode the CMS SignedData encapsulated OCTET STRING structurally, including constructed octets.

**Why:** The node-forge PKCS7 helper accepted disposable OpenSSL-generated CMS profiles but returned an empty content buffer for their context-specific eContent wrapper. The profile payload was present; this happened in both Node and browser execution.

**How to apply:** When changing local profile metadata inspection, exercise actual CMS-wrapped XML and binary plists rather than bare XML fragments. Do not infer Apple trust, revocation status, or installation eligibility from successfully decoding CMS metadata.
