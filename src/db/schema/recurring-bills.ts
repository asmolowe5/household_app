import { pgTable, uuid, text, numeric, integer, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { categories } from "./categories";

export const recurringBills = pgTable("recurring_bills", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: text("frequency").notNull().default("monthly"), // 'monthly', 'yearly', 'weekly'
  dueDay: integer("due_day").notNull(), // day of month: 1-31
  portalCategoryId: uuid("portal_category_id").references(() => categories.id, { onDelete: "set null" }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  lastPaidDate: date("last_paid_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
