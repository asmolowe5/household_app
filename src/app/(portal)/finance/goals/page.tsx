import { getAccounts, getSavingsGoals } from "@/modules/finance/queries";
import { GoalsClient } from "@/modules/finance/components/goals-client";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const [accounts, goals] = await Promise.all([
    getAccounts(),
    getSavingsGoals(),
  ]);

  return (
    <Suspense fallback={<div className="text-xs text-text-tertiary">Loading Savings Goals...</div>}>
      <GoalsClient
        accounts={accounts}
        goals={goals}
      />
    </Suspense>
  );
}
