import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../../../generated-artifacts/cocoxoxoxox.js", import.meta.url), "utf8");
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const websiteOrigin = "https://hmfndndend-without-esign-mobile--cocoxwtfauth.replit.app";
test("unknown browser paths are blocked, while real Meow Cheatz pages stay usable", async () => {
  for (const pathname of ["/234j", "/234j/", "/random/nested/path", "/a2jb2c3d"]) {
  for (const headers of [{ accept: "text/html" }, { "sec-fetch-dest": "document" }]) {
    const blocked = await worker.fetch(new Request(`https://cocox.wtf${pathname}`, { headers }));
    assert.equal(blocked.status, 403);
    assert.match(blocked.headers.get("content-type"), /^text\/html/);
    assert.equal(blocked.headers.get("cache-control"), "no-store");
    const html = await blocked.text();
    assert.match(html, /You have been<br><span>blocked/);
    assert.match(html, /<div class="brand">CocoX Security<\/div>/);
    assert.match(html, /<title>Blocked · CocoX Security<\/title>/);
    assert.match(html, /CocoX Security has restricted access/);
    assert.match(html, /PROTECTED BY COCOX SECURITY/);
    assert.equal(html.includes("hhhh"), false);
    assert.match(html, /prefers-reduced-motion/);
    assert.match(html, /@keyframes/);
    assert.equal(/<script|https?:\/\//.test(html), false);
  }
  }
  for (const pathname of ["/manifest.plist", "/api/manifest.plist", "/api/script"]) {
    const resource = await worker.fetch(new Request(`https://cocox.wtf${pathname}`, {
      headers: { accept: "text/html", "sec-fetch-dest": "document" },
    }));
    assert.equal(resource.status, 200);
    assert.equal((await resource.text()).includes("<title>Blocked · CocoX Security</title>"), false);
  }
  const lua = await worker.fetch(new Request("https://cocox.wtf/"));
  assert.equal(lua.status, 200);
  assert.match(await lua.text(), /local /);
  const realFetch = globalThis.fetch;
  const pageRequests = [];
  globalThis.fetch = async input => {
    const request = input instanceof Request ? input : new Request(input);
    pageRequests.push(request.url);
    return new Response("<!doctype html><title>Meow Cheatz</title>", {
      headers: { "Content-Type": "text/html" },
    });
  };
  try {
    for (const pathname of ["/", "/?from=homepage", "/products", "/products/1", "/cocox-sign"]) {
      for (const headers of [{ accept: "text/html" }, { "sec-fetch-dest": "document" }]) {
        const page = await worker.fetch(new Request(`https://cocox.wtf${pathname}`, { headers }));
        assert.equal(page.status, 200);
        assert.match(await page.text(), /<title>Meow Cheatz<\/title>/);
        assert.equal(pageRequests.at(-1), `${websiteOrigin}${pathname}`);
      }
    }
    for (const [pathname, destination] of [
      ["/assets/index-DQlbesac.js", "script"],
      ["/assets/index-D1gQR3vw.css", "style"],
    ]) {
      const asset = await worker.fetch(new Request(`https://cocox.wtf${pathname}`, {
        headers: { "sec-fetch-dest": destination },
      }));
      assert.equal(asset.status, 200);
      assert.equal(pageRequests.at(-1), `${websiteOrigin}${pathname}`);
    }
    const other = await worker.fetch(new Request("https://www.cocox.wtf/", {
      headers: { accept: "text/html", "sec-fetch-dest": "document" },
    }));
    assert.equal(other.status, 200);
    assert.match(await other.text(), /<title>Meow Cheatz<\/title>/);
  } finally { globalThis.fetch = realFetch; }
});
test("edited Worker retains manifests and legacy Lua, and forwards named GET/POST without recursion or caching", async () => {
  const rootManifest = await worker.fetch(new Request("https://cocox.wtf/manifest.plist"));
  const deltaManifest = await worker.fetch(new Request("https://cocox.wtf/api/manifest.plist"));
  assert.equal(rootManifest.status, 200);
  assert.equal(deltaManifest.status, 200);
  assert.match(await rootManifest.text(), /CocoX_signed\.ipa/);
  assert.match(await deltaManifest.text(), /dl\.ipas\.cc/);
  const legacy = await worker.fetch(new Request("https://cocox.wtf/api/script"));
  assert.equal(legacy.status, 200);
  assert.match(await legacy.text(), /COCOX AUTO JOINER/);
  const realFetch = globalThis.fetch;
  const forwarded = [];
  globalThis.fetch = async input => {
    const request = input instanceof Request ? input : new Request(input);
    forwarded.push({ url: request.url, method: request.method, body: request.method === "POST" ? await request.text() : null });
    return new Response("return 'fixture'", { headers: { "Content-Type": "text/plain" } });
  };
  try {
    const bootstrap = await worker.fetch(new Request("https://cocox.wtf/a2jb2c3d"));
    assert.equal(forwarded.at(-1).url, `${websiteOrigin}/api/script-loaders/a2jb2c3d`);
    assert.equal(bootstrap.headers.get("cache-control"), "no-store");
    const body = JSON.stringify({ slug: "a2jb2c3d", key: "synthetic-test-value", hwid: "synthetic-device" });
    const execution = await worker.fetch(new Request("https://cocox.wtf/api/script-executions", {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
    }));
    assert.equal(forwarded.at(-1).url, `${websiteOrigin}/api/script-executions`);
    assert.equal(forwarded.at(-1).body, body);
    assert.equal(execution.headers.get("cache-control"), "no-store");
    await worker.fetch(new Request("https://cocox.wtf/products"));
    assert.equal(forwarded.at(-1).url, `${websiteOrigin}/products`);
    await worker.fetch(new Request("https://wsp.cocox.wtf/a2jb2c3d"));
    assert.equal(new URL(forwarded.at(-1).url).hostname, "broomg-faithful-git-hub-copy--mynorguerra939.replit.app");
  } finally { globalThis.fetch = realFetch; }
});
