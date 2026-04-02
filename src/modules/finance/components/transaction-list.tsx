"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { TransactionRow } from "./transaction-row";
import { cn } from "@/shared/lib/utils";
import type { Transaction, TransactionType } from "@/modules/finance/types";

interface TransactionListProps {
  transactions: Transaction[];
}

const typeFilters: { label: string; value: TransactionType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Expenses", value: "expense" },
  { label: "Income", value: "income" },
  { label: "Savings", value: "savings_transfer" },
];

export function TransactionList({ transactions }: TransactionListProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");

  const filtered = useMemo(() => {
    return transactions.filter((txn) => {
      const matchesSearch = search === "" ||
        (txn.merchant_name ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || txn.transaction_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [transactions, search, typeFilter]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex gap-1">
          {typeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs transition-colors",
                typeFilter === f.value
                  ? "bg-bg-tertiary text-text-primary font-medium"
                  : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-bg-secondary">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-tertiary">
            No transactions found.
          </div>
        ) : (
          filtered.map((txn) => (
            <TransactionRow key={txn.id} transaction={txn} />
          ))
        )}
      </div>
    </div>
  );
}
