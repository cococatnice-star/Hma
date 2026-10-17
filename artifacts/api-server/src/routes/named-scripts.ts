import { Router } from "express";
import { ExecuteNamedScriptBody } from "@workspace/api-zod";
import { allowScriptAttempt, authorizeScriptExecution, findPublicScript, ScriptAccessError } from "../lib/named-scripts";
import { scriptBootstrap } from "../lib/script-bootstrap";
import { readScriptSource } from "../lib/script-source-storage";

const router = Router();
router.use(["/script-loaders", "/script-executions"], (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  next();
});
router.get("/script-loaders/:slug", async (req, res) => {
  if (!/^[a-z0-9]{8}$/.test(req.params.slug)) {
    res.status(404).json({ error: "Script not found." }); return;
  }
  try {
    if (!await findPublicScript(req.params.slug)) {
      res.status(404).json({ error: "Script not found." }); return;
    }
    res.type("text/plain").send(scriptBootstrap(req.params.slug));
  } catch {
    res.status(503).json({ error: "Script service is unavailable. Please try later." });
  }
});
router.post("/script-executions", async (req, res) => {
  const parsed = ExecuteNamedScriptBody.strict().safeParse(req.body);
  if (!parsed.success || !parsed.data.hwid.trim()) {
    res.status(400).json({ error: "Provide a valid script, key, and device identifier." }); return;
  }
  try {
    if (!await allowScriptAttempt(`http:${req.ip || "unknown"}`)) {
      res.set("Retry-After", "60").status(429).json({ error: "Too many attempts. Wait a minute." }); return;
    }
    const script = await authorizeScriptExecution(parsed.data.slug, parsed.data.key, parsed.data.hwid);
    const source = await readScriptSource(script.objectPath);
    res.type("text/plain").send(source);
  } catch (error) {
    if (error instanceof ScriptAccessError) {
      res.status(403).json({ error: error.message }); return;
    }
    // Never log request bodies, keys, device IDs, or private source.
    res.status(503).json({ error: "Private script delivery is unavailable. Please try later." });
  }
});
export default router;
