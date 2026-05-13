import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const loginAttempts = pgTable("login_attempts", {
  ipAddress: text("ip_address").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastFailedAt: timestamp("last_failed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
