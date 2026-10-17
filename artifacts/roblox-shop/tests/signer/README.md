# CocoX Sign regression checks

From the workspace root:

```sh
pnpm --filter @workspace/roblox-shop run test:signer
```

Prerequisites: Node/pnpm, Python 3, OpenSSL, and Chromium. Replit uses its
managed `/repl/tools/bin/chromium`; elsewhere install Playwright's browser
with `pnpm --filter @workspace/roblox-shop exec playwright install chromium`
(on Linux, install its system dependencies too). Set `SIGNER_CHROMIUM_PATH`
to explicitly select another compatible Chromium.

The suite typechecks its test code, builds the actual web artifact and serves
the production build on port 5189. A minimal Express server on port 5190
loads the real `/api/cocox-sign-profile` router at its production bundle
location. It does not start the Discord bot, database, or use account secrets.
These temporary test servers exit with the test runner; no workflow or
deployment is created. Ports must be free.

## What is checked

- Real browser Worker + the shipped zsign JS/WASM, without mocked signing:
  blank-password success, encrypted P12 wrong-password failure and retry,
  damaged input failure, cancellation during a 32 MiB signing job and retry.
- The real Download button: filename, completed download, ZIP CRCs, expected
  entries, embedded provisioning-profile bytes/CMS, preserved resource bytes,
  CodeResources hashes, Mach-O CodeDirectory page/special-slot hashes,
  entitlements, and a CMS signature verified using the generated leaf certificate.
- Replacement of each input, deletion, password/name changes and session clearing
  remove stale results; canceled workers do not return a late success.
- Local metadata inspection before the signing worker starts: certificate/profile
  expiration, matching certificate bytes and team, bundle-ID coverage, device-list
  limitations, damaged/missing metadata, and compressed binary app/profile plists.
  Warnings require acknowledgement; replacing inputs clears that acknowledgement.
- Every page test observes page and worker requests, rejects uploads (all
  non-GET/HEAD requests and request bodies) and non-allowlisted requests
  (including GET query-string uploads), and checks for passwords in logs
  and secret persistence through Web Storage/IndexedDB.
  The only allowlisted API request is the existing bodyless, queryless
  `/api/auth/user` GET used by the optional installation panel.
- The actual API response's MIME type, attachment filename, no-store/nosniff
  headers, and parsed plist: exactly one removable fullscreen Web Clip, no DNS,
  VPN, CA, or other trust/network payloads.

## Disposable fixtures and trust boundary

Fixtures are generated for every run in a unique, ignored
`generated-artifacts/signer-tests/fixtures-*` directory, permissions restricted
to the current user, and removed on teardown (including failing tests).
If the process is forcibly killed, delete its leftover fixture directory.
Reports live under `generated-artifacts/signer-tests/results`; traces are off
to avoid retaining file uploads. No private keys, provisioning profiles,
binary IPAs, or generated outputs belong in Git.

The tiny arm64 Mach-O is built from documented binary structures; it contains
no proprietary code and is not a runnable iOS application. Its larger variant
adds random resources to make cancellation observable during real WASM work.
The synthetic leaf certificate is signed by a disposable self-signed authority.
The authority's **public distinguished name** matches the WWDR G3 name because
the bundled zsign chooses CMS generation by issuer-name hash. It does **not**
have Apple's key or trust. `openssl cms -verify -noverify -nointern -certfile`
checks the actual signature against our generated leaf, not Apple trust.
The generated profile is also CMS-signed by that synthetic leaf.

These checks prove download/signature integrity and browser state behavior,
not Apple acceptance, certificate revocation status, device installation,
or iOS Safari memory limits. Never replace synthetic fixtures with real user
certificates or IPAs to make a test pass.
