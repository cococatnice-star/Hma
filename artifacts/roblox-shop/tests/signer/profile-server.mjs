// Exercise the real API router in isolation: no database, bot, or account secrets.
import { createRequire } from "node:module";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const api = path.resolve(import.meta.dirname, "../../../api-server");
const require = createRequire(path.join(api, "package.json"));
const { build } = require("esbuild");
const express = require("express");
// Match the production bundle's import.meta.url directory for profile lookup.
const bundle = path.join(api, "dist/signer-profile-regression.mjs");
await mkdir(path.dirname(bundle), { recursive: true });
await build({
  entryPoints: [path.join(api, "src/routes/cocox-sign.ts")],
  outfile: bundle, bundle: true, packages: "external", platform: "node", format: "esm",
});
const { default: router } = await import(pathToFileURL(bundle).href);
const app = express();
app.use((req, _res, next) => { req.log = { error: console.error }; next(); });
app.get("/health", (_req, res) => res.send("ready"));
app.use("/api", router);
const server = app.listen(5190, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(async () => { await rm(bundle, { force: true }); process.exit(); }));
}
