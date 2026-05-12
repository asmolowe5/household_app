import { createClient } from "@/shared/lib/supabase/server";
import {
  getAccounts,
  getRecentTransactions,
  getCategories,
  getMonthExpenses,
  buildCategorySpend,
  buildMonthSummary,
  getReviewCount,
} from "@/modules/finance/queries";
import { calculateBudgetSummary } from "@/modules/finance/lib/budget-engine";
import type {
  Account,
  Transaction,
  Category,
  CategorySpend,
  MonthSummary,
  BudgetSummary,
} from "@/modules/finance/types";

export async function getFinanceAccounts(): Promise<Account[]> {
  const supabase = await createClient();
  return getAccounts(supabase);
}

export async function getFinanceTransactions(limit = 15): Promise<Transaction[]> {
  const supabase = await createClient();
  return getRecentTransactions(supabase, limit);
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

  const [categories, transactions, accounts] = await Promise.all([
    getCategories(supabase),
    getMonthExpenses(supabase, monthStart, monthEnd),
    getAccounts(supabase),
  ]);

  return calculateBudgetSummary(categories, transactions, accounts, now);
}

export async function getFinanceReviewCount(): Promise<number> {
  const supabase = await createClient();
  return getReviewCount(supabase);
}
