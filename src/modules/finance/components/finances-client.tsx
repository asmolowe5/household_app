"use client";

import { useState } from "react";
import type { Transaction, Category } from "@/modules/finance/types";
import { TransactionDetail } from "./transaction-detail";
import { ReviewBadge } from "./review-badge";
import { formatCurrencyPrecise, formatDate } from "@/shared/lib/utils";
import {
  UtensilsCrossed,
  ShoppingCart,
  ShoppingBag,
  Car,
  Film,
  Home,
  User,
  Building,
  Zap,
  Shield,
  Repeat,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  "utensils-crossed": UtensilsCrossed,
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  car: Car,
  film: Film,
  home: Home,
  user: User,
  building: Building,
  zap: Zap,
  shield: Shield,
  repeat: Repeat,
};

function getIcon(name: string | null | undefined): LucideIcon {
  if (!name) return HelpCircle;
  return iconMap[name] ?? HelpCircle;
}

interface TransactionListClientProps {
  transactions: Transaction[];
  categories: Category[];
  reviewCount: number;
}

export function TransactionListClient({
  transactions,
  categories,
  reviewCount,
}: TransactionListClientProps) {
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [showReviewOnly, setShowReviewOnly] = useState(false);

  const filtered = showReviewOnly
    ? transactions.filter((t) => !t.is_reviewed)
    : transactions;

  return (
    <>
      <div className="rounded-2xl border border-border-default bg-bg-secondary p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            Recent Transactions
          </h2>
          <button
            onClick={() => setShowReviewOnly(!showReviewOnly)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              showReviewOnly
                ? "bg-accent-muted text-accent"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Needs Review
            <ReviewBadge count={reviewCount} />
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm text-text-tertiary">
              {showReviewOnly ? "All caught up!" : "No transactions yet"}
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border-subtle">
            {filtered.map((txn) => {
              const Icon = getIcon(txn.category_icon);
              const isIncome = txn.transaction_type === "income";

              return (
                <button
                  key={txn.id}
                  onClick={() => setSelectedTxn(txn)}
                  className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-bg-tertiary/50 first:pt-0 last:pb-0"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-tertiary text-text-tertiary">
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-text-primary">
                      {txn.merchant_name ?? "Unknown"}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] text-text-tertiary">
                        {txn.category_name ?? "Uncategorized"}
                      </p>
                      {!txn.is_reviewed && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-[13px] font-medium tabular-nums ${
                        isIncome ? "text-status-green" : "text-text-primary"
                      }`}
                    >
                      {isIncome ? "+" : ""}
                      {formatCurrencyPrecise(Math.abs(txn.amount))}
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      {formatDate(txn.date)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedTxn && (
        <TransactionDetail
          transaction={selectedTxn}
          categories={categories}
          onClose={() => setSelectedTxn(null)}
        />
      )}
    </>
  );
}
