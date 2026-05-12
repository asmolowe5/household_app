import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { plaidItems } from "./plaid-items";

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  plaidItemId: uuid("plaid_item_id").references(() => plaidItems.id, { onDelete: "cascade" }).notNull(),
  plaidAccountId: text("plaid_account_id").notNull().unique(),
  name: text("name").notNull(),
  officialName: text("official_name"),
  type: text("type").notNull(),
  subtype: text("subtype"),
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 }),
  availableBalance: numeric("available_balance", { precision: 12, scale: 2 }),
  isoCurrencyCode: text("iso_currency_code").default("USD"),
  lastBalanceUpdate: timestamp("last_balance_update", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
