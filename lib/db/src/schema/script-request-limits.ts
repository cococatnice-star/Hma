import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const scriptRequestLimitsTable = pgTable("cocox_script_request_limits", {
  bucketHash: text("bucket_hash").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(1),
});
export const insertScriptRequestLimitSchema = createInsertSchema(scriptRequestLimitsTable);
