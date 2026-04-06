export interface Account {
  id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  current_balance: number | null;
  available_balance: number | null;
  institution_name: string;
  last_synced_at: string | null;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  merchant_name: string | null;
  transaction_type: "expense" | "income" | "savings_transfer" | "internal_transfer";
  is_reviewed: boolean;
  category_name: string | null;
  category_icon: string | null;
}

export interface Category {
  id: string;
  name: string;
  monthly_budget: number;
  type: "fixed" | "discretionary";
  icon: string | null;
  sort_order: number;
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

export interface CategoryRule {
  id: string;
  pattern: string;
  category_id: string;
  source: "user" | "ai";
}
