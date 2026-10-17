# CocoX Code Redeemer

## Activate

1. Publish this Replit update, accepting its additive database migrations.
   These new Discord commands deliberately activate only in the published app, not the development preview, so issued keys use the same database as public loaders. Duplicate interaction deliveries across production instances are claimed once in PostgreSQL.
2. In your Discord server, use `/setup-script`. You need **Manage Server**. Choose the optional `channel`, or leave it empty to post in the current channel.
3. Enter a name and upload raw `.lua` or `.txt` code in the form, up to 1 MiB. The form discloses that a private source-code copy is sent to the CocoX owner and requires typing `AGREE`. Only upload code you own or may share; cancelling or refusing consent does not share any source.
4. The bot privately returns 90 keys and `cocoxoxoxox.js`. Copy that Worker into your existing Cloudflare Worker and deploy it. You can also find the generated Worker in the project Files at `generated-artifacts/cocoxoxoxox.js`.
5. Setup automatically posts the orange **Code Redeemer** panel in the selected channel. Run `/show panel` to repost it, choosing your script's name, an optional channel (current channel by default), and an optional normal access role. There is no Unlink Key button.

The bot checks that both the administrator and bot can view and send in the destination channel; the bot also needs Embed Links. Public panels never include source files or key files. Setup sends the source only by private DM to the configured CocoX owner. If the DM or panel delivery fails, the private setup reply explains which failed and still returns the successfully created script's keys. Reposting a panel does not resend source code.

## Keep the bot online

Use **Reserved VM** publishing for the API/bot service, then republish the update. Autoscale can stop when idle and cannot guarantee an always-connected Discord bot. Reserved VM has ongoing compute charges; choose its machine settings in Publishing before confirming. A running development preview is not a substitute for publishing. Keep the existing production database and encryption secret when changing hosting.

The optional role requires **Manage Roles** for you and the bot, and it must be below both users' highest roles. Privileged or managed roles cannot be used. Without a configured role, Get Role is disabled. Run `/show panel` with its `role` option to configure it and post an updated panel.

The original embedded Lua, both IPA manifests, website proxy, and `wsp.cocox.wtf` proxy in your supplied Worker remain intact. New named loaders use separate URLs.

## Member flow

Give each member one key from the private key file. They press **Redeem Key**, then **Get Script** to receive:

```lua
CocoX_Key = "THE-MEMBERS-REAL-GENERATED-KEY"
loadstring(game:HttpGet("https://cocox.wtf/RANDOMSLUG"))()
```

The real URL has eight lowercase letters/numbers, including at least one of each. The first member who redeems a key owns it; another member cannot redeem it. Each member can own one key per script. Keys do not automatically expire.

The public URL returns only a bootstrap. It POSTs the key and device identifier to `https://cocox.wtf/api/script-executions`. The server validates redemption and device binding before returning private Lua from App Storage. No raw HWID, key, or script source is written to request logs. Device and request-rate identifiers are security hashes.

**My Stats** shows key status, binding status, and successful key checks. **Reset HWID** allows the owning member to clear an existing binding once every 24 hours. First subsequent use binds the new device.

## Ownership and limits

- Script administration is scoped to the Discord server and requires Manage Server. Members' loader/key responses are ephemeral, not public panel messages.
- `/show panel` also privately re-exports the script's 90-key file and Worker, so a lost setup reply does not lose the keys.
- Source files remain in private App Storage. Keys are indexed by digest and encrypted with AES-GCM so their owner can retrieve their loader later. Back up and preserve `SESSION_SECRET`: rotating it without migrating key ciphertext makes existing keys unrecoverable.
- The loader does not remove another key system or external dependency already present in an uploaded Lua file.
- Once an authorized executor receives source, it can copy it. This is server-side access control, not copy-proof Lua DRM.
- A compatible executor must support HTTP POST and a stable device identifier (`gethwid` or Roblox client ID).
- Bot command registration requires the bot to be installed with application-command support. Commands are added to the servers the bot has joined; unrelated command registrations are not deleted.
