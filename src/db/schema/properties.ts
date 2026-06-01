import { pgTable, uuid, text, numeric, boolean, date, timestamp } from "drizzle-orm/pg-core";

export const properties = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  monthlyRentTarget: numeric("monthly_rent_target", { precision: 10, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  tenantName: text("tenant_name"),
  leaseStart: date("lease_start"),
  leaseEnd: date("lease_end"),
  securityDeposit: numeric("security_deposit", { precision: 10, scale: 2 }).default("0"),
  monthlyMortgage: numeric("monthly_mortgage", { precision: 10, scale: 2 }).default("0"),
  monthlyInsurance: numeric("monthly_insurance", { precision: 10, scale: 2 }).default("0"),
  monthlyTaxes: numeric("monthly_taxes", { precision: 10, scale: 2 }).default("0"),
  monthlyHoa: numeric("monthly_hoa", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
