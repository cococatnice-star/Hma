import { rmSync } from "node:fs";

export default function teardown() {
  if (process.env.SIGNER_FIXTURES) rmSync(process.env.SIGNER_FIXTURES, { recursive: true, force: true });
}
