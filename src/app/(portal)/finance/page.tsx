import { getAccounts, getRecentTransactions, getCategories, getReviewCount, getProperties } from "@/modules/finance/queries";
import { FinancesEmptyState } from "@/modules/finance/components/empty-state";
import { FinanceDashboardClient } from "@/modules/finance/components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const [accounts, categories, recentTransactions, reviewCount, properties] = await Promise.all([
    getAccounts(),
    getCategories(),
    getRecentTransactions(5),
    getReviewCount(),
    getProperties(),
  ]);

  if (accounts.length === 0) {
    return <FinancesEmptyState />;
  }

  return (
    <FinanceDashboardClient
      initialAccounts={accounts}
      initialRecentTransactions={recentTransactions}
      initialReviewCount={reviewCount}
      categories={categories}
      properties={properties}
    />
  );
}
