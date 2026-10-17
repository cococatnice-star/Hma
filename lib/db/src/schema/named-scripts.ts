import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const namedScriptsTable = pgTable("cocox_named_scripts", {
  id: uuid("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  creatorId: text("creator_id").notNull(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  slug: text("slug").notNull().unique(),
  objectPath: text("object_path").notNull(),
  roleId: text("role_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("cocox_script_guild_name_idx").on(table.guildId, table.normalizedName)]);

export const insertNamedScriptSchema = createInsertSchema(namedScriptsTable);
export type NamedScript = typeof namedScriptsTable.$inferSelect;
