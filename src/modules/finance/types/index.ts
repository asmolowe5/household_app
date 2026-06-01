export type TransactionType = "expense" | "income" | "savings_transfer" | "internal_transfer";
export type CategoryType = "fixed" | "discretionary";
export type PaceStatus = "green" | "yellow" | "orange" | "red";

export interface PlaidItem {
  id: string;
  user_id: string;
  access_token: string | null;
  plaid_item_id: string | null;
  institution_name: string;
  institution_id: string | null;
  module_context: "household" | "llc";
  cursor: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface Account {
  id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  current_balance: number | null;
  available_balance: number | null;
  plaid_item_id?: string;
  plaid_account_id?: string;
  iso_currency_code?: string;
  last_balance_update?: string | null;
  created_at?: string;
  institution_name?: string;
  last_synced_at?: string | null;
  custom_name: string | null;
  is_visible: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  merchant_name: string | null;
  transaction_type: TransactionType;
  is_reviewed: boolean;
  account_id?: string;
  plaid_transaction_id?: string | null;
  plaid_category?: string[] | null;
  portal_category_id?: string | null;
  is_anomaly?: boolean;
  property_id?: string | null;
  notes?: string | null;
  created_at?: string;
  category_name?: string | null;
  category_icon?: string | null;
  category?: Category;
  account?: Account;
  property?: Property;
  splits?: TransactionSplit[];
}

export interface Category {
  id: string;
  name: string;
  monthly_budget: number;
  type: CategoryType;
  sort_order: number;
  icon: string | null;
  tax_category?: string | null;
  is_active?: boolean;
  is_temporary?: boolean;
  created_at?: string;
}

export interface CategoryRule {
  id: string;
  pattern: string;
  category_id: string;
  source: "user" | "ai";
  created_by?: string | null;
  created_at?: string;
}

export interface Property {
  id: string;
  name: string;
  address: string | null;
  monthly_rent_target: number;
  is_active: boolean;
  notes: string | null;
  tenant_name?: string | null;
  lease_start?: string | null;
  lease_end?: string | null;
  security_deposit?: number;
  monthly_mortgage?: number;
  monthly_insurance?: number;
  monthly_taxes?: number;
  monthly_hoa?: number;
  created_at?: string;
}

export interface TransactionSplit {
  id: string;
  parent_transaction_id: string;
  amount: number;
  portal_category_id: string | null;
  property_id: string | null;
  notes: string | null;
  category_name?: string | null;
  property_name?: string | null;
}

export interface CategorySpend extends Category {
  total_spent: number;
}

export interface MonthSummary {
  total_spent: number;
  total_budget: number;
  total_income: number;
  days_elapsed: number;
  days_in_month: number;
}

export interface AssetLiability {
  id: string;
  name: string;
  value: number;
  type: "asset_real_estate" | "asset_vehicle" | "asset_investment" | "liability_mortgage" | "liability_loan" | "liability_other";
  notes: string | null;
  property_id: string | null;
  updated_at?: string;
  created_at?: string;
}

export interface NetWorthSnapshot {
  id: string;
  date: string;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
}

export interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  frequency: "monthly" | "yearly" | "weekly";
  due_day: number;
  portal_category_id: string | null;
  notes: string | null;
  is_active: boolean;
  last_paid_date: string | null;
  category_name?: string | null;
  created_at?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  notes: string | null;
  is_completed: boolean;
  account_id: string | null;
  account_name?: string | null;
  created_at?: string;
}
