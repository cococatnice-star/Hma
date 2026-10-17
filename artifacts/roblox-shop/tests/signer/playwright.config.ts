import { defineConfig } from "@playwright/test";
import path from "node:path";
import { existsSync } from "node:fs";

export const outputs = path.resolve(import.meta.dirname, "../../../../generated-artifacts/signer-tests");

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "*.spec.ts",
  outputDir: path.join(outputs, "results"),
  globalSetup: "./setup.ts",
  globalTeardown: "./teardown.ts",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 60_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5189",
    viewport: { width: 1200, height: 900 },
    headless: true,
    launchOptions: {
      executablePath: process.env.SIGNER_CHROMIUM_PATH ||
        (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined),
    },
    // Never retain traces containing uploaded synthetic keys.
    trace: "off",
  },
  webServer: [
    {
      cwd: path.resolve(import.meta.dirname, "../.."),
      command: "PORT=5189 BASE_PATH=/ pnpm run build && PORT=5189 BASE_PATH=/ pnpm run serve",
      url: "http://127.0.0.1:5189",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      cwd: path.resolve(import.meta.dirname, "../.."),
      command: "node tests/signer/profile-server.mjs",
      url: "http://127.0.0.1:5190/health",
      reuseExistingServer: false,
    },
  ],
});
