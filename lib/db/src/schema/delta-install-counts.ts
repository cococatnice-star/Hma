import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const deltaInstallCountsTable = pgTable("delta_install_counts", {
  id: integer("id").primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertDeltaInstallCountSchema = createInsertSchema(
  deltaInstallCountsTable,
).omit({ updatedAt: true });

export type InsertDeltaInstallCount = z.infer<
  typeof insertDeltaInstallCountSchema
>;
export type DeltaInstallCount = typeof deltaInstallCountsTable.$inferSelect;