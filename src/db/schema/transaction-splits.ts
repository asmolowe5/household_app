import { pgTable, uuid, numeric, text, timestamp, index } from "drizzle-orm/pg-core";
import { transactions } from "./transactions";
import { categories } from "./categories";
import { properties } from "./properties";

export const transactionSplits = pgTable("transaction_splits", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentTransactionId: uuid("parent_transaction_id")
    .references(() => transactions.id, { onDelete: "cascade" })
    .notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  portalCategoryId: uuid("portal_category_id").references(() => categories.id, { onDelete: "set null" }),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_transaction_splits_parent").on(table.parentTransactionId),
  index("idx_transaction_splits_property").on(table.propertyId),
  index("idx_transaction_splits_category").on(table.portalCategoryId),
]);
