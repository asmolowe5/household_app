import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const financeInsights = pgTable("finance_insights", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
