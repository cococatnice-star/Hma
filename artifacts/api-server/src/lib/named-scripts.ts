import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, namedScriptsTable as scripts, scriptKeysTable as keys, scriptRequestLimitsTable as limits, scriptInteractionsTable } from "@workspace/db";
import { canonicalKey, decryptScriptKey, encryptScriptKey, keyDigest, newScriptKey, privateFingerprint } from "./script-key-crypto";

export class ScriptAccessError extends Error {}
export function normalizedScriptName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
export async function findGuildScript(guildId: string, name: string) {
  const [script] = await db.select().from(scripts).where(and(
    eq(scripts.guildId, guildId), eq(scripts.normalizedName, normalizedScriptName(name)),
  )).limit(1);
  return script;
}
export async function findPublicScript(slug: string) {
  const [script] = await db.select().from(scripts).where(eq(scripts.slug, slug)).limit(1);
  return script;
}
export async function createNamedScript(input: {
  guildId: string; creatorId: string; name: string; objectPath: string; roleId: string | null;
}) {
  const name = input.name.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) throw new ScriptAccessError("Use a script name between 1 and 80 characters.");
  const id = randomUUID();
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug: string;
  do {
    slug = [...randomBytes(8)].map(value => alphabet[value % alphabet.length]).join("");
  } while (!/[a-z]/.test(slug) || !/[0-9]/.test(slug));
  const batch = Array.from({ length: 90 }, () => {
    const key = newScriptKey();
    const keyId = randomUUID();
    return { key, row: { id: keyId, scriptId: id, keyHash: keyDigest(key), encryptedKey: encryptScriptKey(key, keyId) } };
  });
  try {
    const script = await db.transaction(async tx => {
      const [created] = await tx.insert(scripts).values({
        ...input, id, name, slug, normalizedName: normalizedScriptName(name),
      }).returning();
      await tx.insert(keys).values(batch.map(item => item.row));
      return created;
    });
    return { script, keys: batch.map(item => item.key) };
  } catch (error) {
    if ((error as { cause?: { code?: string }; code?: string }).cause?.code === "23505" ||
        (error as { code?: string }).code === "23505") {
      throw new ScriptAccessError("That script name already exists in this server. Choose a different name.");
    }
    throw error;
  }
}
export async function redeemScriptKey(scriptId: string, rawKey: string, userId: string) {
  const key = canonicalKey(rawKey);
  if (!key) throw new ScriptAccessError("That key format is invalid.");
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`script-redeem:${scriptId}:${userId}`}))`);
    const [license] = await tx.select().from(keys).where(and(
      eq(keys.scriptId, scriptId), eq(keys.keyHash, keyDigest(key)),
    )).for("update");
    if (!license) throw new ScriptAccessError("That key does not belong to this script.");
    if (license.redeemedBy && license.redeemedBy !== userId) {
      throw new ScriptAccessError("This key has already been redeemed by another Discord member.");
    }
    const [owned] = await tx.select().from(keys).where(and(
      eq(keys.scriptId, scriptId), eq(keys.redeemedBy, userId),
    )).limit(1);
    if (owned && owned.id !== license.id) throw new ScriptAccessError("You already own a key for this script. Press Get Script.");
    if (!license.redeemedBy) {
      await tx.update(keys).set({ redeemedBy: userId, redeemedAt: new Date() }).where(eq(keys.id, license.id));
    }
    return license.id;
  });
}
export async function memberScriptKey(scriptId: string, userId: string) {
  const [license] = await db.select().from(keys).where(and(
    eq(keys.scriptId, scriptId), eq(keys.redeemedBy, userId),
  )).limit(1);
  if (!license) throw new ScriptAccessError("Redeem a key for this script first.");
  return license;
}
export async function resetScriptDevice(scriptId: string, userId: string) {
  return db.transaction(async tx => {
    const [license] = await tx.select().from(keys).where(and(
      eq(keys.scriptId, scriptId), eq(keys.redeemedBy, userId),
    )).for("update");
    if (!license) throw new ScriptAccessError("Redeem a key for this script first.");
    if (!license.deviceHash) throw new ScriptAccessError("Your key has not been linked to a device yet.");
    if (license.lastResetAt && Date.now() - license.lastResetAt.getTime() < 86_400_000) {
      throw new ScriptAccessError("You can reset HWID once every 24 hours. Please try later.");
    }
    await tx.update(keys).set({ deviceHash: null, lastResetAt: new Date() }).where(eq(keys.id, license.id));
  });
}
export async function authorizeScriptExecution(slug: string, rawKey: string, hwid: string) {
  const canonical = canonicalKey(rawKey);
  if (!canonical) throw new ScriptAccessError("Invalid key.");
  return db.transaction(async tx => {
    const [script] = await tx.select().from(scripts).where(eq(scripts.slug, slug)).limit(1);
    if (!script) throw new ScriptAccessError("Script not found.");
    const [license] = await tx.select().from(keys).where(and(
      eq(keys.scriptId, script.id), eq(keys.keyHash, keyDigest(canonical)),
    )).for("update");
    if (!license?.redeemedBy) throw new ScriptAccessError("Redeem this script's key in Discord first.");
    const deviceHash = privateFingerprint("script-device", hwid);
    if (license.deviceHash && license.deviceHash !== deviceHash) {
      throw new ScriptAccessError("This key is bound to another device. Its Discord owner can use Reset HWID.");
    }
    await tx.update(keys).set({ deviceHash, checks: sql`${keys.checks} + 1` }).where(eq(keys.id, license.id));
    return script;
  });
}
export function memberLoader(slug: string, encryptedKey: string, keyId: string) {
  const key = decryptScriptKey(encryptedKey, keyId);
  return `CocoX_Key = "${key}"\nloadstring(game:HttpGet("https://cocox.wtf/${slug}"))()`;
}
export async function allowScriptAttempt(identity: string, maximum = 120) {
  const bucketHash = privateFingerprint("script-request", identity);
  const [entry] = await db.insert(limits).values({ bucketHash, windowStart: new Date(), count: 1 })
    .onConflictDoUpdate({
      target: limits.bucketHash,
      set: {
        windowStart: sql`case when ${limits.windowStart} < now() - interval '1 minute' then now() else ${limits.windowStart} end`,
        count: sql`case when ${limits.windowStart} < now() - interval '1 minute' then 1 else ${limits.count} + 1 end`,
      },
    }).returning();
  // Bound transient security metadata; no raw IP, HWID, or key is stored here.
  await db.delete(limits).where(sql`${limits.windowStart} < now() - interval '24 hours'`);
  return entry.count <= maximum;
}
export async function claimScriptInteraction(id: string) {
  const result = await db.insert(scriptInteractionsTable).values({ id })
    .onConflictDoNothing().returning({ id: scriptInteractionsTable.id });
  await db.delete(scriptInteractionsTable).where(sql`${scriptInteractionsTable.createdAt} < now() - interval '24 hours'`);
  return result.length === 1;
}
