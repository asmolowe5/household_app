import { createClient } from "@/shared/lib/supabase/server";
import { getAccounts, getReviewCount } from "@/modules/finance/queries";
import { calculateBudgetSummary } from "@/modules/finance/lib/budget-engine";
import type {
  Account,
  Transaction,
  Category,
  BudgetSummary,
} from "@/modules/finance/types";

export async function getFinanceAccounts(): Promise<Account[]> {
  const supabase = await createClient();
  return getAccounts(supabase);
}

export async function getFinanceTransactions(limit = 15): Promise<Transaction[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .order("date", { ascending: false })
    .limit(limit);
  return (data ?? []) as Transaction[];
}

export async function getFinanceBudgetSummary(): Promise<BudgetSummary> {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const [categoriesRes, transactionsRes, accountsRes] = await Promise.all([
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("transactions")
      .select("*, category:categories(*)")
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase.from("accounts").select("*"),
  ]);

  return calculateBudgetSummary(
    (categoriesRes.data ?? []) as Category[],
    (transactionsRes.data ?? []) as Transaction[],
    (accountsRes.data ?? []) as Account[],
    now,
  );
}

export async function getFinanceReviewCount(): Promise<number> {
  const supabase = await createClient();
  return getReviewCount(supabase);
}
