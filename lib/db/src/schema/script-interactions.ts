import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const scriptInteractionsTable = pgTable("cocox_script_interactions", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertScriptInteractionSchema = createInsertSchema(scriptInteractionsTable);
