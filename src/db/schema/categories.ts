import { pgTable, uuid, text, numeric, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  monthlyBudget: numeric("monthly_budget", { precision: 10, scale: 2 }).default("0"),
  type: text("type").notNull().default("discretionary"),
  isActive: boolean("is_active").default(true),
  isTemporary: boolean("is_temporary").default(false),
  sortOrder: integer("sort_order").default(0),
  icon: text("icon"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const categoryRules = pgTable("category_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  pattern: text("pattern").notNull().unique(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
  source: text("source").default("user"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
