import { pgTable, uuid, text, timestamp, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { namedScriptsTable } from "./named-scripts";

export const scriptKeysTable = pgTable("cocox_script_keys", {
  id: uuid("id").primaryKey(),
  scriptId: uuid("script_id").notNull().references(() => namedScriptsTable.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(),
  encryptedKey: text("encrypted_key").notNull(),
  redeemedBy: text("redeemed_by"),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  deviceHash: text("device_hash"),
  lastResetAt: timestamp("last_reset_at", { withTimezone: true }),
  checks: integer("checks").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("cocox_script_member_idx").on(table.scriptId, table.redeemedBy),
  index("cocox_script_keys_script_idx").on(table.scriptId),
]);

export const insertScriptKeySchema = createInsertSchema(scriptKeysTable);
export type ScriptKey = typeof scriptKeysTable.$inferSelect;
