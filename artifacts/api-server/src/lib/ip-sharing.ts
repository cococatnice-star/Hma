import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import type { Request } from "express";
import type { VisitorIpReport } from "./ip-discord";
import { db, ipShareAttemptsTable } from "@workspace/db";
import { and, eq, gt, lt, sql } from "drizzle-orm";

export function publicVisitorIp(req: Request) {
  const raw = req.ip || "";
  if (!isIP(raw)) return null;
  const address = ipaddr.process(raw);
  if (address.range() !== "unicast") return null;
  return address.toString();
}

export async function lookupVisitorLocation(ip: string, request: typeof fetch = fetch): Promise<VisitorIpReport> {
  const response = await request(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("IP lookup is unavailable");
  const body = await response.json() as { success?: unknown; city?: unknown; region?: unknown };
  if (body.success !== true) throw new Error("IP lookup could not identify this address");
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().slice(0, 128) : null;
  return { ip, city: text(body.city), state: text(body.region) };
}

export function issueIpConsent(secret: string, now = Date.now()) {
  const expiresAt = now + 10 * 60 * 1000;
  const payload = `${expiresAt}.${randomBytes(32).toString("hex")}`;
  const signature = createHmac("sha256", secret).update(`ip-consent:${payload}`).digest("hex");
  return { nonce: `${payload}.${signature}`, expiresAt: new Date(expiresAt).toISOString() };
}

export function validIpConsent(nonce: string, secret: string, now = Date.now()) {
  const parts = nonce.split(".");
  if (parts.length !== 3) return false;
  const [expiry, random, signature] = parts;
  if (!/^\d{13}$/.test(expiry || "") || !/^[0-9a-f]{64}$/.test(random || "") ||
    !/^[0-9a-f]{64}$/.test(signature || "")) return false;
  const expiresAt = Number(expiry);
  if (expiresAt <= now || expiresAt > now + 11 * 60 * 1000) return false;
  const expected = createHmac("sha256", secret).update(`ip-consent:${expiry}.${random}`).digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function reserveIpShare(ip: string, nonce: string, secret: string): Promise<"allowed" | "used" | "limited"> {
  const senderHash = createHmac("sha256", secret).update(`ip-rate:${ip}`).digest("hex");
  const nonceHash = createHash("sha256").update(nonce).digest("hex");
  const now = Date.now();
  return db.transaction(async transaction => {
    // Serialize the brief quota check across all autoscale instances.
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext('cocox-ip-share-quota'))`);
    await transaction.delete(ipShareAttemptsTable).where(lt(ipShareAttemptsTable.createdAt, new Date(now - 86400000)));
    const [used] = await transaction.select().from(ipShareAttemptsTable).where(eq(ipShareAttemptsTable.nonceHash, nonceHash)).limit(1);
    if (used) return "used";
    const [recent] = await transaction.select().from(ipShareAttemptsTable)
      .where(and(eq(ipShareAttemptsTable.senderHash, senderHash), gt(ipShareAttemptsTable.createdAt, new Date(now - 10 * 60 * 1000)))).limit(1);
    const [{ count }] = await transaction.select({ count: sql<number>`count(*)::int` }).from(ipShareAttemptsTable);
    if (recent || count >= 500) return "limited";
    await transaction.insert(ipShareAttemptsTable).values({ nonceHash, senderHash });
    return "allowed";
  });
}
