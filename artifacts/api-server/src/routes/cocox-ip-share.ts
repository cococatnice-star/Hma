import { Router, type Request, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { SendIpShareBody } from "@workspace/api-zod";
import { isIpReportBotReady, sendPrivateIpReport, type VisitorIpReport } from "../lib/ip-discord";
import { publicVisitorIp, lookupVisitorLocation, issueIpConsent, validIpConsent, reserveIpShare } from "../lib/ip-sharing";

const COOKIE = "cocox_ip_consent";
const LIFETIME = 10 * 60 * 1000;
const productionHost = "coco-x-meow-cheatz--cococatnice.replit.app";

function requestOrigin(req: Request) {
  const host = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  const url = new URL(`https://${host}`);
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (local) url.protocol = req.protocol === "https" ? "https:" : "http:";
  else if (url.hostname !== productionHost && url.hostname !== process.env.REPLIT_DEV_DOMAIN) throw new Error("Unexpected website");
  return url.origin;
}

type Dependencies = {
  ready: () => boolean;
  lookup: (ip: string) => Promise<VisitorIpReport>;
  send: (report: VisitorIpReport) => Promise<void>;
  secret?: string;
  reserve?: (ip: string, nonce: string, secret: string) => Promise<"allowed" | "used" | "limited">;
};

export function createIpShareRouter(dependencies: Dependencies): IRouter {
  const router = Router();
  const secret = dependencies.secret || process.env.SESSION_SECRET;
  const reserve = dependencies.reserve || reserveIpShare;

  router.use("/cocox-ip-share", (req, res, next) => {
    try {
      const expected = requestOrigin(req);
      if (req.get("origin") && req.get("origin") !== expected) {
        res.status(403).json({ error: "Open Get IP on this website to confirm sharing." });
        return;
      }
      res.set("Cache-Control", "no-store");
      next();
    } catch {
      res.status(403).json({ error: "Open Get IP on the public website to confirm sharing." });
    }
  });

  router.get("/cocox-ip-share/consent", (req, res) => {
    if (!dependencies.ready() || !secret) {
      res.status(503).json({ error: "IP sharing is unavailable. Nothing has been shared." }); return;
    }
    const token = issueIpConsent(secret);
    res.cookie(COOKIE, token.nonce, {
      httpOnly: true, secure: requestOrigin(req).startsWith("https:"), sameSite: "strict",
      maxAge: LIFETIME, path: "/api/cocox-ip-share",
    });
    // Preparing the dialog never calls the geolocation service or Discord.
    res.json(token);
  });

  router.post("/cocox-ip-share", async (req, res) => {
    const parsed = SendIpShareBody.strict().safeParse(req.body);
    if (!parsed.success || parsed.data.consent !== true) {
      res.status(400).json({ error: "Explicit confirmation is required. Nothing has been shared." }); return;
    }
    const { nonce } = parsed.data;
    const cookie: unknown = req.cookies?.[COOKIE];
    if (typeof cookie !== "string" || Buffer.byteLength(cookie) !== Buffer.byteLength(nonce) ||
      !timingSafeEqual(Buffer.from(cookie), Buffer.from(nonce)) || !secret || !validIpConsent(nonce, secret)) {
      res.status(403).json({ error: "Confirmation expired. Close and reopen Get IP to try again." }); return;
    }
    res.clearCookie(COOKIE, { path: "/api/cocox-ip-share" });
    const ip = publicVisitorIp(req);
    if (!ip) {
      res.status(400).json({ error: "A public visitor IP could not be identified. Use the public website; nothing has been shared." }); return;
    }
    if (!dependencies.ready()) {
      res.status(503).json({ error: "The Discord bot is unavailable. Nothing has been shared." }); return;
    }
    let reservation: "allowed" | "used" | "limited";
    try { reservation = await reserve(ip, nonce, secret); } catch {
      res.status(503).json({ error: "Sharing is temporarily unavailable. No IP lookup or Discord message was sent." }); return;
    }
    if (reservation === "used") {
      res.status(403).json({ error: "This confirmation has already been used. Nothing was sent again." }); return;
    }
    if (reservation === "limited") {
      res.status(429).json({ error: "Please wait 10 minutes before another attempt. This attempt was not shared." }); return;
    }
    let report: VisitorIpReport;
    try {
      report = await dependencies.lookup(ip);
    } catch {
      // Do not log errors that can contain an IP in a request URL.
      res.status(503).json({ error: "IP location lookup failed. No Discord message was sent. Please try again later." }); return;
    }
    try {
      await dependencies.send(report);
      res.json({ ...report, delivered: true });
    } catch {
      // Discord exceptions may include the complete message body. Do not log them.
      res.status(503).json({ error: "Discord could not confirm private delivery. The bot owner may need to enable direct messages. Nothing was posted to a public channel." });
    }
  });
  return router;
}

export default createIpShareRouter({ ready: isIpReportBotReady, lookup: lookupVisitorLocation, send: sendPrivateIpReport });
