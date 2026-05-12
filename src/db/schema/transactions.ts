import { pgTable, uuid, text, numeric, date, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { categories } from "./categories";

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  plaidTransactionId: text("plaid_transaction_id").unique(),
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  merchantName: text("merchant_name"),
  plaidCategory: text("plaid_category").array(),
  portalCategoryId: uuid("portal_category_id").references(() => categories.id, { onDelete: "set null" }),
  transactionType: text("transaction_type").default("expense"),
  isReviewed: boolean("is_reviewed").default(false),
  isAnomaly: boolean("is_anomaly").default(false),
  projectId: uuid("project_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_transactions_date").on(table.date),
  index("idx_transactions_account").on(table.accountId),
  index("idx_transactions_category").on(table.portalCategoryId),
  index("idx_transactions_type").on(table.transactionType),
]);
