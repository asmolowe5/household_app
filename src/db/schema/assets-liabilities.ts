import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const assetsLiabilities = pgTable("assets_liabilities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  value: numeric("value", { precision: 12, scale: 2 }).notNull(),
  type: text("type").notNull(), // 'asset_real_estate', 'asset_vehicle', 'asset_investment', 'liability_mortgage', 'liability_loan', 'liability_other'
  notes: text("notes"),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
