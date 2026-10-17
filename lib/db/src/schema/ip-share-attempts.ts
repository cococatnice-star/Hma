import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Only keyed security hashes, never raw IP addresses or location history.
export const ipShareAttemptsTable = pgTable("cocox_ip_share_attempts", {
  nonceHash: varchar("nonce_hash", { length: 64 }).primaryKey(),
  senderHash: varchar("sender_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("cocox_ip_share_sender_created_idx").on(table.senderHash, table.createdAt),
  index("cocox_ip_share_created_idx").on(table.createdAt),
]);
