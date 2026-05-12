export type TransactionType = "expense" | "income" | "savings_transfer" | "internal_transfer";
export type CategoryType = "fixed" | "discretionary";
export type PaceStatus = "green" | "yellow" | "orange" | "red";
export type AlertTriggerType = "merchant" | "category" | "amount" | "pace" | "savings_withdrawal";
export type AlertChannel = "sms" | "portal";
export type AiConversationChannel = "sms" | "portal";
export type ProfileUpdatedBy = "user" | "ai" | "system";

export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  theme_preference: "dark" | "light";
  created_at: string;
  updated_at: string;
}

export interface PlaidItem {
  id: string;
  user_id: string;
  access_token_vault_id: string | null;
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
  // Database fields (optional for UI queries)
  plaid_item_id?: string;
  plaid_account_id?: string;
  iso_currency_code?: string;
  last_balance_update?: string | null;
  created_at?: string;
  // Query result fields
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
  // Database fields (optional for UI queries)
  account_id?: string;
  plaid_transaction_id?: string | null;
  plaid_category?: string[] | null;
  portal_category_id?: string | null;
  is_anomaly?: boolean;
  project_id?: string | null;
  notes?: string | null;
  created_at?: string;
  // Query result fields
  category_name?: string | null;
  category_icon?: string | null;
  // Related objects
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
  // Database fields (optional for UI queries)
  is_active?: boolean;
  is_temporary?: boolean;
  created_at?: string;
}

export interface CategoryRule {
  id: string;
  pattern: string;
  category_id: string;
  source: "user" | "ai";
  // Database fields (optional for UI queries)
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

export interface FinancialProfile {
  id: string;
  content: string;
  version: number;
  updated_at: string;
  updated_by: ProfileUpdatedBy;
}

export interface AlertRule {
  id: string;
  user_id: string;
  trigger_type: AlertTriggerType;
  trigger_params: Record<string, unknown>;
  message_template: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AlertLog {
  id: string;
  alert_rule_id: string | null;
  user_id: string;
  message_sent: string;
  sent_at: string;
  channel: AlertChannel;
}

export interface CategoryBudgetStatus {
  category: Category;
  spent: number;
  budgeted: number;
  remaining: number;
  percentUsed: number;
  paceRatio: number;
  status: PaceStatus;
  projectedMonthEnd: number;
}

export interface BudgetSummary {
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  overallPaceRatio: number;
  overallStatus: PaceStatus;
  dayOfMonth: number;
  daysInMonth: number;
  percentOfMonth: number;
  dailyAllowance: number;
  categories: CategoryBudgetStatus[];
  incomeThisMonth: number;
  savingsThisMonth: number;
  savingsBalance: number | null;
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
