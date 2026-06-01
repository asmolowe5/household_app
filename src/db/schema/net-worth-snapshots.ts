import { pgTable, uuid, numeric, date } from "drizzle-orm/pg-core";

export const netWorthSnapshots = pgTable("net_worth_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull().unique(),
  totalAssets: numeric("total_assets", { precision: 14, scale: 2 }).notNull(),
  totalLiabilities: numeric("total_liabilities", { precision: 14, scale: 2 }).notNull(),
  netWorth: numeric("net_worth", { precision: 14, scale: 2 }).notNull(),
});
