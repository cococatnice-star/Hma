import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { outputs } from "./playwright.config";

export default function setup() {
  mkdirSync(outputs, { recursive: true });
  // Unique run directory prevents retries/concurrent runs sharing credentials.
  process.env.SIGNER_FIXTURES = mkdtempSync(path.join(outputs, "fixtures-"));
  try {
    execFileSync("python3", [path.join(import.meta.dirname, "fixtures.py"), process.env.SIGNER_FIXTURES]);
  } catch (error) {
    rmSync(process.env.SIGNER_FIXTURES, { recursive: true, force: true });
    throw error;
  }
}
