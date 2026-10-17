import { Router, type IRouter } from "express";
import { db, deltaInstallCountsTable } from "@workspace/db";
import {
  GetDeltaInstallCountResponse,
  RecordDeltaInstallResponse,
} from "@workspace/api-zod";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();
const deltaInstallCounterId = 1;

router.get("/delta-install", async (_req, res) => {
  const [counter] = await db
    .select({ count: deltaInstallCountsTable.count })
    .from(deltaInstallCountsTable)
    .where(eq(deltaInstallCountsTable.id, deltaInstallCounterId))
    .limit(1);

  res.json(GetDeltaInstallCountResponse.parse({ count: counter?.count ?? 0 }));
});

router.post("/delta-install", async (_req, res) => {
  const [counter] = await db
    .update(deltaInstallCountsTable)
    .set({
      count: sql`${deltaInstallCountsTable.count} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(deltaInstallCountsTable.id, deltaInstallCounterId))
    .returning({ count: deltaInstallCountsTable.count });

  res.json(RecordDeltaInstallResponse.parse({ count: counter?.count ?? 0 }));
});

export default router;