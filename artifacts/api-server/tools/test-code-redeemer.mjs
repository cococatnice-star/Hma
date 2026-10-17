import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildCloudflareWorker, cloudflareWorkerPlugin } from "./build-cloudflare-worker.mjs";

const worker = await buildCloudflareWorker();
const output = fileURLToPath(new URL("../../../generated-artifacts/script-tests/", import.meta.url));
await build({
  entryPoints: [
    fileURLToPath(new URL("../src/lib/named-scripts.test.ts", import.meta.url)),
    fileURLToPath(new URL("../src/lib/script-discord.test.ts", import.meta.url)),
  ],
  bundle: true, platform: "node", format: "esm", outdir: output, outExtension: { ".js": ".mjs" },
  plugins: [cloudflareWorkerPlugin(worker)],
  banner: { js: 'import { createRequire } from "node:module";const require=createRequire(import.meta.url);' },
});
const result = spawnSync(process.execPath, [
  "--test", "--test-concurrency=1",
  `${output}named-scripts.test.mjs`, `${output}script-discord.test.mjs`,
  fileURLToPath(new URL("./worker.test.mjs", import.meta.url)),
], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
