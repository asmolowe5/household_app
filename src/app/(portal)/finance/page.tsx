import { getAccounts, getRecentTransactions, getCategories, getReviewCount } from "@/modules/finance/queries";
import { FinancesEmptyState } from "@/modules/finance/components/empty-state";
import { FinanceDashboardClient } from "@/modules/finance/components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const accounts = await getAccounts();
  const categories = await getCategories();
  const recentTransactions = await getRecentTransactions(5);
  const reviewCount = await getReviewCount();

  if (accounts.length === 0) {
    return <FinancesEmptyState />;
  }

  return (
    <FinanceDashboardClient
      initialAccounts={accounts}
      initialRecentTransactions={recentTransactions}
      initialReviewCount={reviewCount}
      categories={categories}
    />
  );
}
