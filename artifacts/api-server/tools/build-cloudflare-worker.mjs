import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export async function buildCloudflareWorker() {
  const result = await build({
    entryPoints: [fileURLToPath(new URL("./cocox-worker.ts", import.meta.url))],
    bundle: true, platform: "browser", format: "esm", write: false,
    logLevel: "silent",
  });
  const source = result.outputFiles[0].text;
  const output = fileURLToPath(new URL("../../../generated-artifacts/cocoxoxoxox.js", import.meta.url));
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, source);
  return source;
}
export function cloudflareWorkerPlugin(source) {
  return {
    name: "private-cloudflare-worker-attachment",
    setup(build) {
      build.onResolve({ filter: /^cocox:cloudflare-worker$/ }, () => ({ path: "worker", namespace: "cocox-worker" }));
      build.onLoad({ filter: /.*/, namespace: "cocox-worker" }, () => ({
        contents: `export default ${JSON.stringify(source)};`, loader: "js",
      }));
    },
  };
}
