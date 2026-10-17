import { db, cocoXInstallsTable } from "@workspace/db";
import { lt, eq } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

export const installStorage = new ObjectStorageService();
export const INSTALL_LIFETIME_MS = 24 * 60 * 60 * 1000;
let cleaning = false;

export async function removeInstallObject(objectPath: string) {
  try {
    const file = await installStorage.getObjectEntityFile(objectPath);
    await file.delete({ ignoreNotFound: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ObjectNotFoundError") return;
    throw error;
  }
}

export async function cleanupExpiredInstalls() {
  if (cleaning) return;
  cleaning = true;
  try {
    const expired = await db.select().from(cocoXInstallsTable)
      .where(lt(cocoXInstallsTable.expiresAt, new Date())).limit(100);
    for (const row of expired) {
      await removeInstallObject(row.objectPath);
      await db.delete(cocoXInstallsTable).where(eq(cocoXInstallsTable.id, row.id));
    }
  } catch (error) {
    logger.error({ err: error }, "Expired signer upload cleanup failed");
  } finally {
    cleaning = false;
  }
}

// Expiry is enforced on every download, independently of the cleanup schedule.
// Storage deletion is best-effort while the service is awake, not a hard timer.
setInterval(() => void cleanupExpiredInstalls(), 10 * 60 * 1000).unref();
