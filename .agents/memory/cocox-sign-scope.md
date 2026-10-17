---
name: CocoX Sign scope
description: User's choice between native signing and a browser signer with a Home Screen shortcut.
---

The user chose “Web signer + Home Screen shortcut” for CocoX Sign, with orange branding, replacing the E Sign entry on Meow Cheatz.

**Why:** Their reference configuration profile combines DNS settings and a web clip, rather than installing a native signing app. After that distinction was explained, the user selected the web signer with a shortcut-only profile that does not change DNS.

**How to apply:** Keep the profile removable and shortcut-only unless the user explicitly changes this choice. Do not interpret the old native ESign starter or the anti-revoke reference as instructions to add DNS changes, native installation, or certificate-revocation bypasses.

The primary CocoX Sign button should start Home Screen shortcut installation, with an ESign-style app interface behind that shortcut.

**Why:** The user asked for pressing CocoX Sign to automatically put it on the Home Screen and to “look like e sign but better.”

**How to apply:** Start the shortcut-profile download from the primary entry; keep direct browser access available separately. Explain that iOS still requires Allow and installation approval in Settings rather than claiming a website can silently add an icon.

Signed IPA installation is a separate, optional upload; it does not turn CocoX Sign into a native signing app.

**Why:** The user asked to install the result after signing. iOS installation needs an HTTPS-hosted package and manifest, unlike local signing and downloading. Preserving local private-key handling avoids distributing the public certificate's private key to website visitors.

**How to apply:** Keep local signing and downloading available without login. Require login and clear consent for hosted installation, upload only the signed IPA (including its embedded provisioning profile), and never upload the P12 or password. Warn that login reloads the page and that anyone holding the installation link can download the hosted package until expiry. Keep a manual Install action because browsers can block an automatic install prompt.
