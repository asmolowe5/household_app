// src/modules/finance/components/empty-state.tsx
import { Landmark } from "lucide-react";
import { PlaidLinkButton } from "./plaid-link-button";

export function FinancesEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border-default bg-bg-secondary px-6 py-16">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted">
        <Landmark size={24} className="text-accent" />
      </div>
      <h2 className="text-base font-semibold text-text-primary">
        Connect your first bank account
      </h2>
      <p className="mt-2 max-w-xs text-center text-sm text-text-secondary">
        Link a bank account to start tracking your spending, budgets, and transactions automatically.
      </p>
      <div className="mt-6">
        <PlaidLinkButton />
      </div>
    </div>
  );
}
