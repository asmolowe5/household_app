import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TransactionRow } from "./transaction-row";
import type { Transaction } from "@/modules/finance/types";

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-secondary">Recent</h3>
        <Link
          href="/finance/transactions"
          className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          View all <ArrowRight size={12} />
        </Link>
      </div>
      <div className="rounded-lg border border-border bg-bg-secondary">
        {transactions.length === 0 ? (
          <div className="py-6 text-center text-sm text-text-tertiary">
            No transactions yet. Connect an account to get started.
          </div>
        ) : (
          transactions.slice(0, 3).map((txn) => (
            <TransactionRow key={txn.id} transaction={txn} />
          ))
        )}
      </div>
    </div>
  );
}
