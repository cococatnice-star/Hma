import { Router, type IRouter } from "express";
import { readFile } from "node:fs/promises";

const router: IRouter = Router();

// The static web artifact includes the profile in its production build.
// Serve through the API so Safari receives Apple's configuration-profile MIME type.
router.get("/cocox-sign-profile", async (req, res) => {
  try {
    const profile = await readFile(
      new URL("../../roblox-shop/dist/public/cocox-sign.mobileconfig", import.meta.url),
    );
    res.set({
      "Content-Type": "application/x-apple-aspen-config",
      "Content-Disposition": 'attachment; filename="CocoX-Sign.mobileconfig"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.send(profile);
  } catch (error) {
    req.log.error({ err: error }, "CocoX Sign shortcut profile unavailable");
    res.status(503).json({ error: "The shortcut profile is temporarily unavailable." });
  }
});

export default router;
