import { pgTable, uuid, varchar, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const cocoXInstallsTable = pgTable("cocox_installs", {
  id: uuid("id").primaryKey(),
  ownerId: varchar("owner_id").notNull().references(() => usersTable.id),
  objectPath: varchar("object_path", { length: 512 }).notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  size: integer("size").notNull(),
  bundleId: varchar("bundle_id", { length: 255 }).notNull(),
  version: varchar("version", { length: 60 }).notNull(),
  title: varchar("title", { length: 150 }).notNull(),
  ready: boolean("ready").notNull().default(false),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [index("cocox_install_owner_created").on(table.ownerId, table.createdAt), index("cocox_install_expiry").on(table.expiresAt)]);
