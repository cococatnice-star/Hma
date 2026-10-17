import { test as base, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const fixture = (name: string) => path.join(process.env.SIGNER_FIXTURES!, name);
const byId = (page: Page, id: string) => page.getByTestId(id);

// Every browser flow is subject to the same privacy and crash assertions.
const test = base.extend<{ privatePage: Page }>({
  privatePage: async ({ page, context }, use) => {
    const uploads: string[] = [];
    const runtimeRequests = new Set<string>();
    const crashes: string[] = [];
    const leakedLogs: string[] = [];
    context.on("request", request => {
      const url = new URL(request.url());
      const staticLocal = url.origin === "http://127.0.0.1:5189" && !url.search &&
        (/^\/assets\/[\w.-]+$/.test(url.pathname) ||
          ["/cocox-sign", "/cocox-sign-icon.png", "/favicon.svg", "/api/auth/user",
            "/cocox-sign-runtime/worker.js", "/cocox-sign-runtime/zsign-mobile.js",
            "/cocox-sign-runtime/zsign-mobile.wasm"].includes(url.pathname));
      const staticFont = [
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
        "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@400;500;600;700&display=swap",
      ].includes(request.url()) ||
        (url.origin === "https://fonts.gstatic.com" && /^\/s\/(inter|orbitron|rajdhani)\/[\w/.-]+\.woff2$/.test(url.pathname) && !url.search);
      if (url.pathname.startsWith("/cocox-sign-runtime/")) runtimeRequests.add(url.pathname);
      if (!["GET", "HEAD"].includes(request.method()) || request.postDataBuffer() ||
          (!staticLocal && !staticFont)) {
        uploads.push(`${request.method()} ${request.url()}`);
      }
    });
    page.on("pageerror", error => crashes.push(error.message));
    page.on("console", message => {
      if (message.text().includes("synthetic-password")) leakedLogs.push(message.text());
    });
    await page.addInitScript(() => {
      const state = { created: 0, terminated: 0, messages: [] as string[], storageWrites: [] as string[] };
      (window as any).__signerAudit = state;
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        private signingWorker: boolean;
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options);
          this.signingWorker = String(url).includes("/cocox-sign-runtime/worker.js");
          if (this.signingWorker) {
            state.created++;
            this.addEventListener("message", event => state.messages.push(event.data.type));
          }
        }
        terminate() { if (this.signingWorker) state.terminated++; super.terminate(); }
      };
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        state.storageWrites.push(`${key}:${value}`);
        return setItem.call(this, key, value);
      };
      const open = indexedDB.open.bind(indexedDB);
      indexedDB.open = (...args) => {
        state.storageWrites.push("indexedDB");
        return open(...args);
      };
    });
    await page.goto("/cocox-sign");
    await expect(byId(page, "status-signer")).toHaveText("Not ready");
    await use(page);
    expect(uploads, "No requests may upload files, credentials, or signing data").toEqual([]);
    expect(crashes).toEqual([]);
    expect(leakedLogs).toEqual([]);
    expect(await page.evaluate(() => (window as any).__signerAudit.storageWrites),
      "Signer must not persist credentials to browser storage").toEqual([]);
    const audit = await page.evaluate(() => (window as any).__signerAudit);
    expect([...runtimeRequests].sort()).toEqual(audit.created > 0 ? [
      "/cocox-sign-runtime/worker.js", "/cocox-sign-runtime/zsign-mobile.js",
      "/cocox-sign-runtime/zsign-mobile.wasm",
    ] : []);
  },
});

async function selectFiles(page: Page, ipa = "small.ipa", p12 = "blank.p12") {
  for (const [slot, file] of [["ipa", ipa], ["p12", p12], ["profile", "synthetic.mobileprovision"]]) {
    await byId(page, `input-${slot}`).setInputFiles(fixture(file));
  }
  await expect(byId(page, "status-signer")).toHaveText("Ready");
}

async function sign(page: Page) {
  await byId(page, "tab-sign").click();
  await expect(byId(page, "inspection-panel")).not.toContainText("Inspecting on this device");
  const acknowledgement = byId(page, "checkbox-inspection-warnings");
  if (await acknowledgement.count()) await acknowledgement.check();
  await byId(page, "button-sign").click();
}

async function signSuccessfully(page: Page) {
  await sign(page);
  await expect(byId(page, "status-signer")).toHaveText(/Signed|Failed/);
  expect(await byId(page, "status-signer").textContent(), await byId(page, "text-logs").textContent() || "").toBe("Signed");
  await expect(byId(page, "button-download")).toBeVisible();
}

test("blank password produces a downloadable, cryptographically signed IPA without uploads", async ({ privatePage: page }) => {
  await selectFiles(page);
  await byId(page, "tab-sign").click();
  await byId(page, "input-output-name").fill("Synthetic output.ipa");
  await signSuccessfully(page);
  const downloading = page.waitForEvent("download");
  await byId(page, "button-download").click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("Synthetic_output.ipa");
  expect(await download.failure()).toBeNull();
  const output = fixture("download.ipa");
  await download.saveAs(output);
  expect(readFileSync(output).subarray(0, 4)).toEqual(Buffer.from("PK\x03\x04", "binary"));
  execFileSync("python3", [path.join(import.meta.dirname, "verify-output.py"), output, process.env.SIGNER_FIXTURES!]);
  const audit = await page.evaluate(() => (window as any).__signerAudit);
  expect(audit.created).toBe(1);
  expect(audit.terminated).toBe(1);
  expect(audit.messages).toContain("success");
});

test("wrong password fails, does not leak the password, and allows a valid retry", async ({ privatePage: page }) => {
  await selectFiles(page, "small.ipa", "protected.p12");
  await byId(page, "tab-certs").click();
  await byId(page, "input-password").fill("synthetic-password-wrong");
  await sign(page);
  await expect(byId(page, "status-signer")).toHaveText("Failed");
  await expect(byId(page, "text-error")).toContainText("Signing failed");
  await expect(byId(page, "button-download")).toHaveCount(0);
  await expect(byId(page, "text-logs")).not.toContainText("synthetic-password");
  await byId(page, "tab-certs").click();
  await byId(page, "input-password").fill("synthetic-password");
  await signSuccessfully(page);
  await expect(byId(page, "text-logs")).not.toContainText("synthetic-password");
});

test("damaged IPA cannot produce a downloadable success", async ({ privatePage: page }) => {
  await selectFiles(page, "broken.ipa");
  await sign(page);
  await expect(byId(page, "status-signer")).toHaveText("Failed");
  await expect(byId(page, "button-download")).toHaveCount(0);
});

test("cancel terminates a worker doing a longer real signing run, clears state, and permits retry", async ({ privatePage: page }) => {
  await selectFiles(page, "long.ipa");
  await sign(page);
  // This log is posted immediately before the real synchronous WASM signing call.
  await expect(byId(page, "text-logs")).toContainText("Signing locally.");
  await expect(byId(page, "status-signer")).toHaveText("Signing");
  await byId(page, "button-cancel").click();
  await expect(byId(page, "status-signer")).toHaveText("Ready");
  await expect(byId(page, "text-logs")).toHaveCount(0);
  await expect(byId(page, "text-error")).toHaveCount(0);
  await expect(byId(page, "button-download")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__signerAudit.terminated)).toBe(1);
  // Observe longer than the normal small-fixture signing time to catch late results.
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).__signerAudit.messages)).not.toContain("success");
  await selectFiles(page);
  await signSuccessfully(page);
});

for (const slot of ["ipa", "p12", "profile"]) {
  test(`replacing ${slot} clears stale downloadable output and logs`, async ({ privatePage: page }) => {
    await selectFiles(page);
    await signSuccessfully(page);
    const filename = { ipa: "small.ipa", p12: "blank.p12", profile: "synthetic.mobileprovision" }[slot]!;
    await byId(page, `input-${slot}`).setInputFiles({
      name: `replacement-${filename}`, mimeType: "application/octet-stream", buffer: readFileSync(fixture(filename)),
    });
    await expect(byId(page, "status-signer")).toHaveText("Ready");
    await expect(byId(page, "button-download")).toHaveCount(0);
    await expect(byId(page, "text-logs")).toHaveCount(0);
    await signSuccessfully(page);
  });
}

test("deleting an input and changing password/output name invalidate results; clear session removes secrets", async ({ privatePage: page }) => {
  await selectFiles(page);
  await signSuccessfully(page);
  await byId(page, "input-output-name").fill("different");
  await expect(byId(page, "button-download")).toHaveCount(0);
  await signSuccessfully(page);
  await byId(page, "tab-certs").click();
  await byId(page, "input-password").fill("synthetic-password");
  await expect(byId(page, "status-signer")).toHaveText("Ready");
  await byId(page, "tab-sign").click();
  await expect(byId(page, "button-download")).toHaveCount(0);
  await byId(page, "tab-certs").click();
  await byId(page, "input-password").fill("");
  await signSuccessfully(page);
  await byId(page, "tab-files").click();
  await byId(page, "button-delete-ipa").click();
  await expect(byId(page, "status-signer")).toHaveText("Not ready");
  await byId(page, "tab-sign").click();
  await expect(byId(page, "button-download")).toHaveCount(0);
  // Missing-input hints use aria-disabled, not HTML disabled; exercise onClick.
  await byId(page, "button-sign").click({ force: true });
  await expect(byId(page, "text-error")).toContainText("Missing: app package");
  await byId(page, "tab-settings").click();
  await byId(page, "button-clear-session").click();
  await byId(page, "tab-certs").click();
  await expect(byId(page, "input-password")).toHaveValue("");
  await expect(byId(page, "text-file-p12")).toContainText("Choose .p12 or .pfx");
  await expect(byId(page, "text-file-profile")).toContainText("Choose .mobileprovision");
  await expect(byId(page, "button-delete-p12")).toHaveCount(0);
  await expect(byId(page, "button-delete-profile")).toHaveCount(0);
});

test("local inspection shows expiration, matching identity and coverage before any signing worker starts", async ({ privatePage: page }) => {
  await selectFiles(page);
  await byId(page, "tab-sign").click();
  await expect(byId(page, "inspection-certificate")).toContainText("Synthetic Regression Only");
  await expect(byId(page, "inspection-profile")).toContainText("TESTTEAM01.test.synthetic");
  await expect(byId(page, "inspection-profile")).toContainText("1 listed device");
  await expect(byId(page, "inspection-bundles")).toContainText("test.synthetic");
  await expect(byId(page, "inspection-match")).toContainText("Matches the selected certificate");
  await expect(byId(page, "inspection-warnings")).toContainText("expires within 7 days");
  await expect(byId(page, "inspection-panel")).toContainText("do not verify Apple revocation status");
  await expect(byId(page, "button-sign")).toBeDisabled();
  expect(await page.evaluate(() => (window as any).__signerAudit.created)).toBe(0);
  await byId(page, "checkbox-inspection-warnings").check();
  await expect(byId(page, "button-sign")).toBeEnabled();
  await byId(page, "input-profile").setInputFiles(fixture("mismatch.mobileprovision"));
  await expect(byId(page, "checkbox-inspection-warnings")).not.toBeChecked();
  await expect(byId(page, "inspection-warnings")).toContainText("Certificate/profile mismatch");
  await expect(byId(page, "inspection-match")).toContainText("Does not match");
  await expect(byId(page, "button-sign")).toBeDisabled();
});

for (const [profile, warning] of [
  ["expired", "Provisioning profile has expired"],
  ["wrong-bundle", "does not cover app bundle ID test.synthetic"],
  ["wrong-team", "Team mismatch"],
  ["no-devices", "lists no devices"],
  ["missing-dates", "expiration could not be read"],
  ["damaged", "Provisioning profile could not be inspected"],
]) {
  test(`warn before signing with ${profile} profile`, async ({ privatePage: page }) => {
    await selectFiles(page);
    await byId(page, "input-profile").setInputFiles(fixture(`${profile}.mobileprovision`));
    await byId(page, "tab-sign").click();
    await expect(byId(page, "inspection-warnings")).toContainText(warning);
    await expect(byId(page, "button-sign")).toBeDisabled();
    expect(await page.evaluate(() => (window as any).__signerAudit.created)).toBe(0);
  });
}

test("expired certificate warns independently of a profile's dates", async ({ privatePage: page }) => {
  await selectFiles(page, "small.ipa", "expired.p12");
  await byId(page, "tab-sign").click();
  await expect(byId(page, "inspection-warnings")).toContainText("Certificate has expired");
  await expect(byId(page, "inspection-warnings")).toContainText("Certificate/profile mismatch");
});

test("binary compressed app plist and binary wildcard profile are inspected locally", async ({ privatePage: page }) => {
  await selectFiles(page, "binary.ipa");
  await byId(page, "input-profile").setInputFiles(fixture("wildcard.mobileprovision"));
  await byId(page, "tab-sign").click();
  await expect(byId(page, "inspection-bundles")).toContainText("test.synthetic");
  await expect(byId(page, "inspection-match")).toContainText("Matches the selected certificate");
  await expect(byId(page, "inspection-warnings")).not.toContainText("does not cover");
  await expect(byId(page, "inspection-warnings")).not.toContainText("could not be inspected");
});

test("shortcut-only API sends a removable Web Clip attachment with no DNS or trust payloads", async ({ request }) => {
  const response = await request.get("http://127.0.0.1:5190/api/cocox-sign-profile");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/x-apple-aspen-config");
  expect(response.headers()["content-disposition"]).toBe('attachment; filename="CocoX-Sign.mobileconfig"');
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  const file = fixture("shortcut.mobileconfig");
  writeFileSync(file, await response.body());
  execFileSync("python3", ["-c", `
import plistlib, sys, urllib.parse
p = plistlib.load(open(sys.argv[1], "rb"))
assert p["PayloadType"] == "Configuration"
assert p["PayloadRemovalDisallowed"] is False
assert len(p["PayloadContent"]) == 1
clip = p["PayloadContent"][0]
assert clip["PayloadType"] == "com.apple.webClip.managed"
assert clip["IsRemovable"] is True
assert clip["FullScreen"] is True
assert clip["Label"] == "CocoX Sign"
url = urllib.parse.urlparse(clip["URL"])
assert url.scheme == "https" and url.path == "/cocox-sign"
assert not url.query and not url.fragment
assert clip["Icon"].startswith(b"\\x89PNG")
`, file]);
});
