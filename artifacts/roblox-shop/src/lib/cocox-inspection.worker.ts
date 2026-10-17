import { inspectSigningInputs, type InspectionInputs } from "./cocox-inspection";

self.onmessage = async ({ data }: MessageEvent<InspectionInputs>) => {
  try {
    self.postMessage(await inspectSigningInputs(data));
  } catch {
    // Never forward raw parser errors, private-key material or passwords.
    self.postMessage({ warnings: ["Local inspection failed. Certificate and profile metadata could not be checked."], bundleIds: [] });
  }
};
