import { getAccounts, getProperties, getAssetsLiabilities, getNetWorthSnapshots } from "@/modules/finance/queries";
import { NetWorthClient } from "@/modules/finance/components/net-worth-client";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function NetWorthPage() {
  const [accounts, properties, manualItems, snapshots] = await Promise.all([
    getAccounts(),
    getProperties(),
    getAssetsLiabilities(),
    getNetWorthSnapshots(),
  ]);

  return (
    <Suspense fallback={<div className="text-xs text-text-tertiary">Loading Net Worth...</div>}>
      <NetWorthClient
        accounts={accounts}
        properties={properties}
        manualItems={manualItems}
        snapshots={snapshots}
      />
    </Suspense>
  );
}
