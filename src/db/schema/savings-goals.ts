import { pgTable, uuid, text, numeric, date, boolean, timestamp } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";

export const savingsGoals = pgTable("savings_goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  targetDate: date("target_date"),
  notes: text("notes"),
  isCompleted: boolean("is_completed").default(false).notNull(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
