import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { db, cocoXInstallsTable } from "@workspace/db";
import { and, eq, gt, sql } from "drizzle-orm";
import { CreateCocoXInstallBody } from "@workspace/api-zod";
import { installStorage, INSTALL_LIFETIME_MS, cleanupExpiredInstalls, removeInstallObject } from "../lib/cocoxInstallStorage";

const router: IRouter = Router();
const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const publicHost = "coco-x-meow-cheatz--cococatnice.replit.app";

function origin(req: Request) {
  const host = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  const url = new URL(`https://${host}`);
  if (url.hostname !== publicHost && !url.hostname.endsWith(".replit.dev")) {
    throw new Error("Installation requires the public HTTPS website.");
  }
  return url.origin;
}

function rejectCrossSite(req: Request, res: Response) {
  const requestOrigin = req.get("origin");
  let expectedOrigin: string;
  try { expectedOrigin = origin(req); } catch {
    res.status(400).json({ error: "Use the public HTTPS website to prepare an installation." });
    return true;
  }
  if (requestOrigin && requestOrigin !== expectedOrigin) {
    res.status(403).json({ error: "Use this website to prepare an installation." });
    return true;
  }
  return false;
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}

router.post("/cocox-installs", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Log in before uploading a signed IPA for installation." });
    return;
  }
  if (rejectCrossSite(req, res)) return;
  const parsed = CreateCocoXInstallBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A signed IPA with valid bundle details and a size under 500 MB is required." });
    return;
  }
  void cleanupExpiredInstalls();
  try {
    const ownerId = req.user.id;
    const upload = await db.transaction(async transaction => {
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))`);
      const [{ used }] = await transaction.select({ used: sql<number>`count(*)::int` })
        .from(cocoXInstallsTable).where(and(eq(cocoXInstallsTable.ownerId, ownerId),
          gt(cocoXInstallsTable.createdAt, new Date(Date.now() - INSTALL_LIFETIME_MS))));
      if (used >= 5) return null;
      const uploadUrl = await installStorage.getObjectEntityUploadURL();
      const id = randomUUID();
      const expiresAt = new Date(Date.now() + INSTALL_LIFETIME_MS);
      await transaction.insert(cocoXInstallsTable).values({
        id, ownerId, objectPath: installStorage.normalizeObjectEntityPath(uploadUrl),
        ...parsed.data, expiresAt,
      });
      return { id, uploadUrl, expiresAt: expiresAt.toISOString() };
    });
    if (!upload) {
      res.status(429).json({ error: "Installation uploads are limited to five per account in 24 hours. Local signing and downloads are still available." });
      return;
    }
    res.status(201).json(upload);
  } catch (error) {
    req.log.error({ err: error }, "Signer upload allocation failed");
    res.status(503).json({ error: "Hosted installation is unavailable. You can still download the signed IPA." });
  }
});

router.post("/cocox-installs/:id/complete", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Log in to finish installation preparation." }); return; }
  if (rejectCrossSite(req, res)) return;
  const id = String(req.params.id);
  if (!tokenPattern.test(id)) { res.status(404).end(); return; }
  try {
    const [row] = await db.select().from(cocoXInstallsTable).where(and(eq(cocoXInstallsTable.id, id),
      eq(cocoXInstallsTable.ownerId, req.user.id), eq(cocoXInstallsTable.revoked, false),
      gt(cocoXInstallsTable.expiresAt, new Date())));
    if (!row) { res.status(404).json({ error: "Upload not found or expired." }); return; }
    const file = await installStorage.getObjectEntityFile(row.objectPath);
    const [metadata] = await file.getMetadata();
    const [prefix] = await file.download({ start: 0, end: 3 });
    if (Number(metadata.size) !== row.size || prefix.toString("hex") !== "504b0304") {
      await removeInstallObject(row.objectPath);
      await db.update(cocoXInstallsTable).set({ revoked: true }).where(eq(cocoXInstallsTable.id, id));
      res.status(422).json({ error: "The uploaded file is incomplete or is not an IPA package." });
      return;
    }
    await db.update(cocoXInstallsTable).set({ ready: true }).where(eq(cocoXInstallsTable.id, id));
    const manifestUrl = `${origin(req)}/api/cocox-installs/${id}/manifest.plist`;
    res.json({ id, expiresAt: row.expiresAt.toISOString(),
      installUrl: `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}` });
  } catch (error) {
    req.log.error({ err: error }, "Signer installation preparation failed");
    res.status(503).json({ error: "The uploaded IPA could not be checked. Download your local signed IPA instead." });
  }
});

router.delete("/cocox-installs/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).end(); return; }
  if (rejectCrossSite(req, res)) return;
  const id = String(req.params.id);
  if (!tokenPattern.test(id)) { res.status(404).end(); return; }
  const [row] = await db.select().from(cocoXInstallsTable).where(and(eq(cocoXInstallsTable.id, id), eq(cocoXInstallsTable.ownerId, req.user.id)));
  if (!row) { res.status(404).end(); return; }
  try {
    // Revoke the public link first; retain the tombstone until expiry for the quota.
    await db.update(cocoXInstallsTable).set({ revoked: true }).where(eq(cocoXInstallsTable.id, id));
    await removeInstallObject(row.objectPath);
    res.status(204).end();
  } catch (error) {
    req.log.error({ err: error }, "Signer hosted-copy deletion failed");
    res.status(503).json({ error: "The link was revoked but file removal could not finish. Automatic cleanup will retry." });
  }
});

async function findReady(id: string) {
  if (!tokenPattern.test(id)) return undefined;
  const [row] = await db.select().from(cocoXInstallsTable).where(and(eq(cocoXInstallsTable.id, id),
    eq(cocoXInstallsTable.ready, true), eq(cocoXInstallsTable.revoked, false), gt(cocoXInstallsTable.expiresAt, new Date())));
  return row;
}

router.get("/cocox-installs/:id/manifest.plist", async (req, res) => {
  const row = await findReady(String(req.params.id));
  if (!row) { res.status(404).end(); return; }
  const packageUrl = escapeXml(`${origin(req)}/api/cocox-installs/${row.id}/app.ipa`);
  res.set({ "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>items</key><array><dict><key>assets</key><array>
<dict><key>kind</key><string>software-package</string><key>url</key><string>${packageUrl}</string></dict>
</array><key>metadata</key><dict><key>bundle-identifier</key><string>${escapeXml(row.bundleId)}</string>
<key>bundle-version</key><string>${escapeXml(row.version)}</string><key>kind</key><string>software</string>
<key>title</key><string>${escapeXml(row.title)}</string></dict></dict></array></dict></plist>`);
});

router.get("/cocox-installs/:id/app.ipa", async (req, res) => {
  const row = await findReady(String(req.params.id));
  if (!row) { res.status(404).end(); return; }
  try {
    const file = await installStorage.getObjectEntityFile(row.objectPath);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    let start = 0, end = size - 1;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) { res.set("Content-Range", `bytes */${size}`).status(416).end(); return; }
      if (!match[1]) start = Math.max(0, size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (start > end || start >= size) { res.set("Content-Range", `bytes */${size}`).status(416).end(); return; }
      res.status(206).set("Content-Range", `bytes ${start}-${end}/${size}`);
    }
    res.set({ "Content-Type": "application/octet-stream", "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${row.name.replace(/[^\w.-]/g, "_")}"` });
    if (req.method === "HEAD") { res.end(); return; }
    const stream = file.createReadStream({ start, end });
    stream.on("error", error => { req.log.error({ err: error }, "Signed IPA stream failed"); res.destroy(); });
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  } catch {
    if (!res.headersSent) res.status(404).end();
  }
});

export default router;
