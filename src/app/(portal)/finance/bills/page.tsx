import { getRecurringBills, getCategories } from "@/modules/finance/queries";
import { BillsClient } from "@/modules/finance/components/bills-client";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const [recurringBillsList, categoriesList] = await Promise.all([
    getRecurringBills(),
    getCategories(),
  ]);

  return (
    <Suspense fallback={<div className="text-xs text-text-tertiary">Loading Bills...</div>}>
      <BillsClient
        recurringBills={recurringBillsList}
        categories={categoriesList}
      />
    </Suspense>
  );
}
