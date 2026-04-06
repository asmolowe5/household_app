import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Transaction, Category, CategorySpend, MonthSummary, CategoryRule } from "./types";

export async function getAccounts(supabase: SupabaseClient): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, official_name, type, subtype, current_balance, available_balance, plaid_items(institution_name, last_synced_at)")
    .order("type")
    .order("name");

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    official_name: row.official_name as string | null,
    type: row.type as string,
    subtype: row.subtype as string | null,
    current_balance: row.current_balance as number | null,
    available_balance: row.available_balance as number | null,
    institution_name:
      (row.plaid_items as { institution_name: string; last_synced_at: string | null } | null)?.institution_name ?? "Unknown",
    last_synced_at:
      (row.plaid_items as { institution_name: string; last_synced_at: string | null } | null)?.last_synced_at ?? null,
  }));
}

export async function getRecentTransactions(
  supabase: SupabaseClient,
  limit = 15,
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, date, amount, merchant_name, transaction_type, is_reviewed, categories(name, icon)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => {
    const cat = row.categories as { name: string; icon: string | null } | null;
    return {
      id: row.id as string,
      date: row.date as string,
      amount: row.amount as number,
      merchant_name: row.merchant_name as string | null,
      transaction_type: row.transaction_type as Transaction["transaction_type"],
      is_reviewed: row.is_reviewed as boolean,
      category_name: cat?.name ?? null,
      category_icon: cat?.icon ?? null,
    };
  });
}

export async function getCategories(supabase: SupabaseClient): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, monthly_budget, type, icon, sort_order")
    .eq("is_active", true)
    .order("sort_order");

  if (error || !data) return [];
  return data as Category[];
}

interface RawTransaction {
  amount: number;
  portal_category_id: string | null;
  transaction_type: string;
}

export async function getMonthExpenses(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
): Promise<RawTransaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("amount, portal_category_id, transaction_type")
    .gte("date", startDate)
    .lte("date", endDate);

  if (error || !data) return [];
  return data as RawTransaction[];
}

export function buildCategorySpend(
  categories: Category[],
  transactions: RawTransaction[],
): CategorySpend[] {
  const spendMap = new Map<string, number>();

  for (const txn of transactions) {
    if (txn.transaction_type !== "expense" || !txn.portal_category_id) continue;
    const current = spendMap.get(txn.portal_category_id) ?? 0;
    spendMap.set(txn.portal_category_id, current + Math.abs(txn.amount));
  }

  return categories.map((cat) => ({
    ...cat,
    total_spent: spendMap.get(cat.id) ?? 0,
  }));
}

export function buildMonthSummary(
  categories: Category[],
  transactions: RawTransaction[],
): MonthSummary {
  let totalSpent = 0;
  let totalIncome = 0;

  for (const txn of transactions) {
    if (txn.transaction_type === "expense") {
      totalSpent += Math.abs(txn.amount);
    } else if (txn.transaction_type === "income") {
      totalIncome += Math.abs(txn.amount);
    }
  }

  const totalBudget = categories.reduce((sum, cat) => sum + cat.monthly_budget, 0);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();

  return { total_spent: totalSpent, total_budget: totalBudget, total_income: totalIncome, days_elapsed: daysElapsed, days_in_month: daysInMonth };
}

export async function getCategoryRules(
  supabase: SupabaseClient,
): Promise<CategoryRule[]> {
  const { data, error } = await supabase
    .from("category_rules")
    .select("id, pattern, category_id, source");

  if (error || !data) return [];
  return data as CategoryRule[];
}

export async function upsertCategoryRule(
  supabase: SupabaseClient,
  pattern: string,
  categoryId: string,
): Promise<void> {
  await supabase
    .from("category_rules")
    .upsert(
      { pattern: pattern.toLowerCase(), category_id: categoryId, source: "user" },
      { onConflict: "pattern" },
    );
}

export async function getReviewCount(
  supabase: SupabaseClient,
): Promise<number> {
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("is_reviewed", false);

  return count ?? 0;
}

export async function updateTransaction(
  supabase: SupabaseClient,
  id: string,
  updates: {
    portal_category_id?: string | null;
    transaction_type?: string;
    notes?: string;
    is_reviewed?: boolean;
  },
): Promise<void> {
  await supabase.from("transactions").update(updates).eq("id", id);
}
