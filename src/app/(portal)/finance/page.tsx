import { createClient } from "@/shared/lib/supabase/server";
import { calculateBudgetSummary } from "@/modules/finance/lib/budget-engine";
import { HeroMetric } from "@/modules/finance/components/hero-metric";
import { CategoryList } from "@/modules/finance/components/category-list";
import { RecentTransactions } from "@/modules/finance/components/recent-transactions";
import { AiInsightBar } from "@/modules/finance/components/ai-insight-bar";
import { PlaidLinkButton } from "@/modules/finance/components/plaid-link-button";
import type { Transaction, Category, Account } from "@/modules/finance/types";

export const dynamic = "force-dynamic";

export default async function FinanceDashboard() {
  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [categoriesRes, transactionsRes, accountsRes, plaidItemsRes] = await Promise.all([
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("transactions")
      .select("*, category:categories(*)")
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .order("date", { ascending: false }),
    supabase.from("accounts").select("*"),
    supabase.from("plaid_items").select("id"),
  ]);

  const categories = (categoriesRes.data ?? []) as Category[];
  const transactions = (transactionsRes.data ?? []) as Transaction[];
  const accounts = (accountsRes.data ?? []) as Account[];
  const hasAccounts = (plaidItemsRes.data?.length ?? 0) > 0;

  const summary = calculateBudgetSummary(categories, transactions, accounts, now);

  const { data: recentTxns } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .order("date", { ascending: false })
    .limit(5);

  return (
    <div className="max-w-2xl">
      {!hasAccounts ? (
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            Connect your first account
          </h2>
          <p className="text-text-secondary mb-6 text-sm">
            Link a bank account or credit card to start tracking your budget.
          </p>
          <PlaidLinkButton />
        </div>
      ) : (
        <>
          <AiInsightBar insight={null} />
          <HeroMetric summary={summary} />
          <CategoryList categories={summary.categories} />
          <RecentTransactions transactions={(recentTxns ?? []) as Transaction[]} />
        </>
      )}
    </div>
  );
}
