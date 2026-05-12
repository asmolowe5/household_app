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
  project_id?: string | null;
  notes?: string | null;
  created_at?: string;
  category_name?: string | null;
  category_icon?: string | null;
  category?: Category;
  account?: Account;
}

export interface Category {
  id: string;
  name: string;
  monthly_budget: number;
  type: CategoryType;
  sort_order: number;
  icon: string | null;
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

export interface Project {
  id: string;
  name: string;
  estimated_budget: number | null;
  is_active: boolean;
  created_at: string;
  closed_at: string | null;
  notes: string | null;
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
