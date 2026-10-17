import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request } from "express";
import express from "express";
import cookieParser from "cookie-parser";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, ipShareAttemptsTable } from "@workspace/db";
import { issueIpConsent, validIpConsent, publicVisitorIp, lookupVisitorLocation, reserveIpShare } from "./ip-sharing";
import { createIpShareRouter } from "../routes/cocox-ip-share";
import type { VisitorIpReport } from "./ip-discord";

const secret = "synthetic-test-secret-not-a-user-credential";
const host = "coco-x-meow-cheatz--cococatnice.replit.app";

test("confirmation tokens reject tampering, expiry, trailing data, and other signing keys", () => {
  const now = Date.now();
  const token = issueIpConsent(secret, now);
  assert.equal(validIpConsent(token.nonce, secret, now), true);
  assert.equal(validIpConsent(token.nonce, "another-test-key", now), false);
  assert.equal(validIpConsent(token.nonce, secret, now + 600001), false);
  assert.equal(validIpConsent(token.nonce + ".extra", secret, now), false);
  assert.equal(validIpConsent(token.nonce.slice(0, -1) + (token.nonce.endsWith("a") ? "b" : "a"), secret, now), false);
});

test("only canonical public visitor addresses are eligible", () => {
  for (const ip of ["127.0.0.1", "::1", "10.0.0.1", "192.168.1.5", "::ffff:172.16.0.1", "fe80::1", "2001:db8::1", "invalid"]) {
    assert.equal(publicVisitorIp({ ip } as Request), null);
  }
  assert.equal(publicVisitorIp({ ip: "::ffff:8.8.8.8" } as Request), "8.8.8.8");
  assert.equal(publicVisitorIp({ ip: "2001:4860:4860::8888" } as Request), "2001:4860:4860::8888");
});

test("lookup uses HTTPS, returns approximate city/state, and explicitly fails when unavailable", async () => {
  let requests = 0;
  const fixtureFetch = (async (url: string | URL | Request) => {
    requests++;
    assert.match(String(url), /^https:\/\/ipwho\.is\/8\.8\.8\.8\?/);
    return new Response(JSON.stringify({ success: true, city: "Test City", region: "Test State" }));
  }) as typeof fetch;
  assert.deepEqual(await lookupVisitorLocation("8.8.8.8", fixtureFetch), { ip: "8.8.8.8", city: "Test City", state: "Test State" });
  assert.equal(requests, 1);
  await assert.rejects(lookupVisitorLocation("8.8.8.8", (async () => new Response("", { status: 429 })) as typeof fetch));
  await assert.rejects(lookupVisitorLocation("8.8.8.8", (async () => new Response('{"success":false}')) as typeof fetch));
});

test("the consent API never enriches or delivers before explicit valid confirmation", async t => {
  const lookups: string[] = [];
  const sent: VisitorIpReport[] = [];
  let failSend = false;
  let failLookup = false;
  let ready = true;
  const used = new Set<string>();
  const app = express().set("trust proxy", 1);
  app.use(cookieParser(), express.json());
  app.use("/api", createIpShareRouter({
    secret, ready: () => ready,
    reserve: async (_ip, nonce) => { if (used.has(nonce)) return "used"; used.add(nonce); return "allowed"; },
    lookup: async ip => { lookups.push(ip); if (failLookup) throw new Error("fixture lookup failure"); return { ip, city: "Test City", state: "Test State" }; },
    send: async report => { if (failSend) throw new Error("fixture DM failure"); sent.push(report); },
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.close(); server.closeAllConnections(); });
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}/api/cocox-ip-share`;
  const headers = { "x-forwarded-host": host, origin: `https://${host}`, "x-forwarded-for": "8.8.8.8" };
  const prepare = async () => {
    const response = await fetch(`${base}/consent`, { headers });
    assert.equal(response.status, 200);
    const body = await response.json() as { nonce: string };
    assert.match(response.headers.get("set-cookie") || "", /HttpOnly/);
    return { nonce: body.nonce, cookie: response.headers.get("set-cookie")!.split(";")[0] };
  };
  const post = (token: Awaited<ReturnType<typeof prepare>>, data: object, override = {}) => fetch(base, {
    method: "POST", headers: { ...headers, "content-type": "application/json", cookie: token.cookie, ...override }, body: JSON.stringify(data),
  });
  const token = await prepare();
  assert.equal(lookups.length, 0); assert.equal(sent.length, 0);
  assert.equal((await post(token, { consent: false, nonce: token.nonce })).status, 400);
  assert.equal((await post(token, { consent: true, nonce: token.nonce, ip: "1.1.1.1" })).status, 400);
  assert.equal((await post(token, { consent: true, nonce: token.nonce }, { origin: "https://another-website.example" })).status, 403);
  assert.equal((await post(token, { consent: true, nonce: token.nonce }, { cookie: "" })).status, 403);
  assert.equal(lookups.length, 0); assert.equal(sent.length, 0);
  const confirmed = await post(token, { consent: true, nonce: token.nonce });
  assert.equal(confirmed.status, 200);
  assert.deepEqual(await confirmed.json(), { ip: "8.8.8.8", city: "Test City", state: "Test State", delivered: true });
  assert.equal(sent.length, 1);
  assert.equal((await post(token, { consent: true, nonce: token.nonce })).status, 403);
  assert.equal(sent.length, 1);
  const privateToken = await prepare();
  assert.equal((await post(privateToken, { consent: true, nonce: privateToken.nonce }, { "x-forwarded-for": "127.0.0.1" })).status, 400);
  failLookup = true;
  const lookupToken = await prepare();
  assert.equal((await post(lookupToken, { consent: true, nonce: lookupToken.nonce })).status, 503);
  assert.equal(sent.length, 1);
  failLookup = false; failSend = true;
  const failureToken = await prepare();
  const failed = await post(failureToken, { consent: true, nonce: failureToken.nonce });
  assert.equal(failed.status, 503);
  assert.match(JSON.stringify(await failed.json()), /Nothing was posted to a public channel/);
  assert.equal(sent.length, 1);
  ready = false;
  assert.equal((await fetch(`${base}/consent`, { headers })).status, 503);
});

test("shared DB reservations reject replay and repeat sends across router instances", async () => {
  const token = issueIpConsent(secret);
  const nonceHash = createHash("sha256").update(token.nonce).digest("hex");
  try {
    assert.equal(await reserveIpShare("8.8.8.8", token.nonce, secret), "allowed");
    assert.equal(await reserveIpShare("8.8.8.8", token.nonce, secret), "used");
    assert.equal(await reserveIpShare("8.8.8.8", issueIpConsent(secret).nonce, secret), "limited");
  } finally {
    await db.delete(ipShareAttemptsTable).where(eq(ipShareAttemptsTable.nonceHash, nonceHash));
  }
});
