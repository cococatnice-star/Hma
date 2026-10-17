import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, pool, namedScriptsTable, scriptKeysTable, scriptRequestLimitsTable, scriptInteractionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import express from "express";
import { canonicalKey, decryptScriptKey, keyDigest, privateFingerprint } from "./script-key-crypto";
import {
  allowScriptAttempt, authorizeScriptExecution, claimScriptInteraction, createNamedScript, memberLoader,
  memberScriptKey, redeemScriptKey, resetScriptDevice,
} from "./named-scripts";
import { readScriptSource, removeScriptSource, storeScriptSource, validateLuaSource } from "./script-source-storage";
import namedScriptRouter from "../routes/named-scripts";
import { scriptBootstrap } from "./script-bootstrap";

const guildId = `test-${randomUUID()}`;
const source = "-- synthetic licensing test, never executed\nreturn 'fixture-only'";
let fixture: Awaited<ReturnType<typeof createNamedScript>>;
let objectPath: string;
before(async () => {
  objectPath = await storeScriptSource(source, "synthetic-test-owner");
  fixture = await createNamedScript({ guildId, creatorId: "admin", name: "Fixture Script", roleId: null, objectPath });
});
after(async () => {
  if (fixture) await db.delete(namedScriptsTable).where(eq(namedScriptsTable.guildId, guildId));
  if (objectPath) await removeScriptSource(objectPath);
  await db.delete(scriptRequestLimitsTable).where(eq(scriptRequestLimitsTable.bucketHash, privateFingerprint("script-request", guildId)));
  await db.delete(scriptInteractionsTable).where(eq(scriptInteractionsTable.id, guildId));
  await pool.end();
});
test("creation makes exactly 90 valid unique encrypted keys and private persistent source", async () => {
  assert.equal(fixture.keys.length, 90);
  assert.equal(new Set(fixture.keys).size, 90);
  assert.match(fixture.script.slug, /^[a-z0-9]{8}$/);
  assert.match(fixture.script.slug, /[a-z]/);
  assert.match(fixture.script.slug, /[0-9]/);
  for (const key of fixture.keys) assert.equal(canonicalKey(key), key);
  const rows = await db.select().from(scriptKeysTable).where(eq(scriptKeysTable.scriptId, fixture.script.id));
  assert.equal(rows.length, 90);
  for (const row of rows) {
    assert.equal(row.keyHash, keyDigest(decryptScriptKey(row.encryptedKey, row.id)));
    assert.equal(fixture.keys.some(key => row.encryptedKey.includes(key)), false);
  }
  assert.equal(await readScriptSource(objectPath), source);
  await assert.rejects(createNamedScript({ guildId, creatorId: "admin", name: "  fixture   SCRIPT ", roleId: null, objectPath }));
  assert.throws(() => validateLuaSource("const LUA_CODE = 'not raw Lua';"));
  assert.throws(() => validateLuaSource("\0binary"));
  assert.throws(() => validateLuaSource("x".repeat(1024 * 1024 + 1)));
});
test("one member wins a concurrent redemption; unredeemed and wrong-script keys fail", async () => {
  await assert.rejects(authorizeScriptExecution(fixture.script.slug, fixture.keys[0], "device"));
  const result = await Promise.allSettled([
    redeemScriptKey(fixture.script.id, fixture.keys[0], "member-a"),
    redeemScriptKey(fixture.script.id, fixture.keys[0], "member-b"),
  ]);
  assert.equal(result.filter(item => item.status === "fulfilled").length, 1);
  const row = await db.select().from(scriptKeysTable).where(and(
    eq(scriptKeysTable.scriptId, fixture.script.id), eq(scriptKeysTable.keyHash, keyDigest(fixture.keys[0])),
  ));
  const winner = row[0].redeemedBy!;
  await redeemScriptKey(fixture.script.id, fixture.keys[0], winner); // idempotent, not another consumed key
  await assert.rejects(redeemScriptKey(fixture.script.id, fixture.keys[1], winner));
  await assert.rejects(memberScriptKey(fixture.script.id, "not-the-owner"));
  assert.match(memberLoader(fixture.script.slug, row[0].encryptedKey, row[0].id), /CocoX_Key = "COCOX-/);
});
test("device binding is atomic and only the owning Discord member can reset once per day", async () => {
  const [license] = await db.select().from(scriptKeysTable).where(eq(scriptKeysTable.keyHash, keyDigest(fixture.keys[0])));
  const owner = license.redeemedBy!;
  await authorizeScriptExecution(fixture.script.slug, fixture.keys[0], "device-a");
  await authorizeScriptExecution(fixture.script.slug, fixture.keys[0], "device-a");
  await assert.rejects(authorizeScriptExecution(fixture.script.slug, fixture.keys[0], "device-b"));
  await assert.rejects(resetScriptDevice(fixture.script.id, "not-the-owner"));
  await resetScriptDevice(fixture.script.id, owner);
  await authorizeScriptExecution(fixture.script.slug, fixture.keys[0], "device-b");
  await assert.rejects(resetScriptDevice(fixture.script.id, owner));
  const owned = await memberScriptKey(fixture.script.id, owner);
  assert.notEqual(owned.deviceHash, "device-b");
  assert.equal(owned.checks, 3);
});
test("public GET returns only a POST bootstrap; source is delivered only to an authorized POST", async () => {
  const app = express().use(express.json()).use("/api", namedScriptRouter);
  const server = await new Promise<ReturnType<typeof app.listen>>(resolve => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api`;
  try {
    const response = await fetch(`${base}/script-loaders/${fixture.script.slug}`);
    const bootstrap = await response.text();
    assert.equal(response.status, 200);
    assert.match(bootstrap, /Method = "POST"/);
    assert.match(bootstrap, /https:\/\/cocox\.wtf\/api\/script-executions/);
    assert.equal(bootstrap.includes(source), false);
    assert.equal(fixture.keys.some(key => bootstrap.includes(key)), false);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.throws(() => scriptBootstrap('bad"slug'));
    assert.equal((await fetch(`${base}/script-loaders/unknown0`)).status, 404);
    const send = (data: unknown) => fetch(`${base}/script-executions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    assert.equal((await send({ slug: fixture.script.slug, key: fixture.keys[0], hwid: "device-b", extra: true })).status, 400);
    assert.equal((await send({ slug: fixture.script.slug, key: fixture.keys[1], hwid: "device-b" })).status, 403);
    assert.equal((await send({ slug: fixture.script.slug, key: fixture.keys[0], hwid: "other-device" })).status, 403);
    const authorized = await send({ slug: fixture.script.slug, key: fixture.keys[0], hwid: "device-b" });
    assert.equal(authorized.status, 200);
    assert.equal(await authorized.text(), source);
    assert.equal(authorized.headers.get("cache-control"), "no-store");
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.delete(scriptRequestLimitsTable).where(eq(scriptRequestLimitsTable.bucketHash, privateFingerprint("script-request", "http:127.0.0.1")));
  }
});
test("request quotas use a shared database rather than per-process memory", async () => {
  assert.equal(await allowScriptAttempt(guildId, 2), true);
  assert.equal(await allowScriptAttempt(guildId, 2), true);
  assert.equal(await allowScriptAttempt(guildId, 2), false);
});
test("duplicate Discord gateway deliveries across replicas are handled only once", async () => {
  const result = await Promise.all([claimScriptInteraction(guildId), claimScriptInteraction(guildId)]);
  assert.equal(result.filter(Boolean).length, 1);
});
