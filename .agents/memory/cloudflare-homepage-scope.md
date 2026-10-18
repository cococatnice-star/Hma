---
name: Cloudflare blocked-page scope
description: Domain restriction and browser-path coverage of the CocoX Security blocked page.
---

The user wants the cocox.wtf homepage to load Meow Cheatz normally. They explicitly confirmed that arbitrary paths such as cocox.wtf/234j must instead show the blocked page. The visible blocked-page name remains “CocoX Security”; renaming its code file is separate.

**Why:** the user restricted the change to this domain and clarified that blocking the homepage itself prevented the intended Meow Cheatz website from loading.

**How to apply:** keep the rule in the Cloudflare Worker: proxy the homepage, legitimate app routes, and their static assets to the same live Meow Cheatz origin; show CocoX Security for unknown browser page paths and script URLs. Preserve functional API, Lua-client, and installer requests. Do not change unrelated hostnames.

## Code delivery

Provide copyable Cloudflare code in chat when requested, not only the generated file's location.

**Why:** the user repeatedly asked for the Cloudflare code after replies that only pointed to the file.

**How to apply:** include a pasteable code block and exact placement instructions. If the existing embedded Lua makes the complete Worker too large for chat, provide the safe targeted update without claiming it replaces the entire Worker.
