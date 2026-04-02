import { formatCurrency, formatDate, cn } from "@/shared/lib/utils";
import type { Transaction } from "@/modules/finance/types";

interface TransactionRowProps {
  transaction: Transaction;
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const isIncome = transaction.transaction_type === "income";
  const isSavings = transaction.transaction_type === "savings_transfer";

  return (
    <div className="flex items-center justify-between py-3 px-2 border-b border-border-subtle last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-primary truncate">
          {transaction.merchant_name ?? "Unknown"}
        </p>
        <p className="text-xs text-text-tertiary">
          {formatDate(transaction.date)}
          {transaction.category && (
            <span className="ml-2">· {transaction.category.name}</span>
          )}
        </p>
      </div>
      <span
        className={cn(
          "tabular-nums text-sm font-medium",
          isIncome ? "text-status-green" : isSavings ? "text-accent" : "text-text-primary"
        )}
      >
        {isIncome ? "+" : isSavings ? "→ " : "-"}
        {formatCurrency(Math.abs(transaction.amount))}
      </span>
    </div>
  );
}
