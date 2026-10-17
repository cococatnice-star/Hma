/*
 * Browser signing integration for CocoX Sign.
 * Uses the zsign WebAssembly runtime from Sylva Signer (MIT, AntonP29).
 * See ./LICENSES/ for Sylva, zsign, OpenSSL and compression library notices.
 * No network uploads, certificate persistence, DNS changes or revocation bypass.
 */
self.onmessage = async ({ data }) => {
  try {
    const root = new URL("./", self.location.href);
    importScripts(new URL("zsign-mobile.js", root).href);
    const metadata = {};
    const log = (message) => {
      let line = String(message).replace(/\x1b\[[0-9;]*[mK]/g, "").trim();
      for (const [label, key] of [["AppName", "title"], ["BundleId", "bundleId"], ["Version", "version"]]) {
        const match = line.match(new RegExp(`^>>>\\s*${label}:\\s*(.+)$`));
        if (match && !metadata[key]) metadata[key] = match[1].trim();
      }
      if (data.password) line = line.split(data.password).join("[redacted]");
      if (line) self.postMessage({ type: "log", line });
    };
    const module = await createZsignModule({
      noInitialRun: true,
      locateFile: (file) => new URL(file, root).href,
      print: log,
      printErr: log,
    });
    const { FS } = module;
    for (const path of ["/blob", "/output", "/work"]) FS.mkdir(path);
    FS.chdir("/work");
    FS.mount(module.WORKERFS, {
      blobs: [
        { name: "input.ipa", data: data.ipa },
        { name: "signing.p12", data: data.p12 },
        { name: "profile.mobileprovision", data: data.profile },
      ],
    }, "/blob");
    log("Signing locally. Keep this page open; large files may take several minutes.");
    const output = "/output/signed.ipa";
    const args = ["-f", "-k", "/blob/signing.p12", "-m", "/blob/profile.mobileprovision"];
    if (data.password) args.push("-p", data.password);
    args.push("-z", "6", "-o", output, "/blob/input.ipa");
    let exitCode = 0;
    try {
      exitCode = module.callMain(args) ?? 0;
    } catch (error) {
      if (Number.isInteger(error?.status)) exitCode = error.status;
      else throw error;
    }
    if (exitCode !== 0) throw new Error("Signing engine reported failure.");
    const node = FS.analyzePath(output).object;
    if (!node?.contents) throw new Error("No signed IPA was produced.");
    const size = Math.min(node.usedBytes ?? node.contents.byteLength, node.contents.byteLength);
    if (size < 4) throw new Error("The signed output is empty.");
    const bytes = node.contents.subarray(0, size);
    self.postMessage({ type: "success", bytes, metadata }, [bytes.buffer]);
  } catch {
    self.postMessage({ type: "error" });
  }
};
