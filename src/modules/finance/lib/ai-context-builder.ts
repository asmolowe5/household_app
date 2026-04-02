import { createAdminClient } from "@/shared/lib/supabase/admin";
import { calculateBudgetSummary } from "./budget-engine";
import { formatCurrency } from "@/shared/lib/utils";
import type { Category, Transaction, Account } from "@/modules/finance/types";

export async function buildAiContext(userId: string): Promise<string> {
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [profileRes, categoriesRes, transactionsRes, accountsRes] = await Promise.all([
    admin.from("financial_profile").select("content").order("version", { ascending: false }).limit(1).single(),
    admin.from("categories").select("*").eq("is_active", true),
    admin.from("transactions").select("*").gte("date", monthStart).lte("date", monthEnd),
    admin.from("accounts").select("*"),
  ]);

  const profile = profileRes.data?.content ?? "No financial profile yet.";
  const categories = (categoriesRes.data ?? []) as Category[];
  const transactions = (transactionsRes.data ?? []) as Transaction[];
  const accounts = (accountsRes.data ?? []) as Account[];

  const summary = calculateBudgetSummary(categories, transactions, accounts, now);

  const categoryLines = summary.categories
    .map((c) => `- ${c.category.name}: ${formatCurrency(c.spent)} / ${formatCurrency(c.budgeted)} (${c.status})`)
    .join("\n");

  const merchantTotals: Record<string, number> = {};
  for (const txn of transactions.filter((t) => t.transaction_type === "expense")) {
    const name = txn.merchant_name ?? "Unknown";
    merchantTotals[name] = (merchantTotals[name] ?? 0) + Math.abs(txn.amount);
  }
  const topMerchants = Object.entries(merchantTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, total]) => `- ${name}: ${formatCurrency(total)}`)
    .join("\n");

  const { data: userProfile } = await admin.from("profiles").select("name").eq("id", userId).single();

  return `You are a financial advisor for the Smolowe household (Alex and Emine). You are talking to ${userProfile?.name ?? "a household member"}.

## Financial Profile
${profile}

## Current Month Budget Status (${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })})
Day ${summary.dayOfMonth} of ${summary.daysInMonth} (${Math.round(summary.percentOfMonth * 100)}% through month)

Overall: ${formatCurrency(summary.totalSpent)} of ${formatCurrency(summary.totalBudgeted)} spent (${summary.overallStatus})
Daily allowance remaining: ${formatCurrency(summary.dailyAllowance)}/day
Income this month: ${formatCurrency(summary.incomeThisMonth)}
Savings transfers this month: ${formatCurrency(summary.savingsThisMonth)}
${summary.savingsBalance !== null ? `Savings balance: ${formatCurrency(summary.savingsBalance)}` : ""}

### Category Breakdown (discretionary)
${categoryLines}

### Top Merchants This Month
${topMerchants}

## Your Role
- Answer financial questions using the tool functions for precise data. NEVER guess numbers.
- Be direct, supportive, and specific. Lead with wins when possible.
- Aim for a 3:1 positive-to-corrective ratio.
- When asked about spending, always include context (pace, days remaining, daily allowance).
- You can suggest creating categories, recategorizing transactions, or adjusting budgets.
- For "what if" questions, use actual spending data to model scenarios.`;
}
