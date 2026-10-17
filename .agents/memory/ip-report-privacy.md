---
name: IP report privacy
description: Consent and recipient restrictions for sharing visitor IP-based location through the existing Discord bot.
---

IP reports must go to the Discord bot application's owner's private messages, never the shop's purchase channel.

**Why:** The existing bot also serves the shop, but the requested IP report contains personal information. The visitor confirmation specifically promises private delivery; a public-channel fallback would violate that consent.

**How to apply:** Require meaningful privacy disclosures and explicit confirmation before location lookup or delivery. Placeholder warnings are not informed consent. Disclose the lookup provider, approximate city/state rather than GPS, and Discord retention. Never log raw IPs or message bodies or keep a raw location history in the website database. Keep only temporary security hashes for rate limiting; never fall back to posting in the purchase channel when private delivery fails.
