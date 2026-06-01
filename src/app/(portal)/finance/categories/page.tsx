import { getAccounts, getCategories, getCategoryRules } from "@/modules/finance/queries";
import { FinancesEmptyState } from "@/modules/finance/components/empty-state";
import { CategoriesClient } from "@/modules/finance/components/categories-client";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [accountsList, categoryList, ruleList] = await Promise.all([
    getAccounts(),
    getCategories(),
    getCategoryRules(),
  ]);

  if (accountsList.length === 0) {
    return <FinancesEmptyState />;
  }

  return (
    <Suspense fallback={<div className="text-xs text-text-tertiary">Loading category settings...</div>}>
      <CategoriesClient
        categories={categoryList}
        rules={ruleList}
      />
    </Suspense>
  );
}
