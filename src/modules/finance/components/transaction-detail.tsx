"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil } from "lucide-react";
import type { Transaction, Category } from "@/modules/finance/types";
import { formatCurrencyPrecise, formatDate } from "@/shared/lib/utils";

interface TransactionDetailProps {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
}

export function TransactionDetail({
  transaction,
  categories,
  onClose,
}: TransactionDetailProps) {
  const [editing, setEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(
    transaction.category_name ?? "",
  );
  const [txnType, setTxnType] = useState(transaction.transaction_type);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    const category = categories.find((c) => c.name === selectedCategory);
    await fetch("/api/plaid/sync", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction_id: transaction.id,
        portal_category_id: category?.id ?? null,
        transaction_type: txnType,
        is_reviewed: true,
      }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-bg-secondary shadow-xl sm:rounded-l-2xl">
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <h2 className="text-sm font-semibold text-text-primary">
            Transaction Details
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Merchant & amount */}
          <div>
            <p className="text-lg font-semibold text-text-primary">
              {transaction.merchant_name ?? "Unknown"}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
              {transaction.transaction_type === "income" ? "+" : ""}
              {formatCurrencyPrecise(Math.abs(transaction.amount))}
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              {formatDate(transaction.date)}
            </p>
          </div>

          {/* Category */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-tertiary">
              Category
            </p>
            {editing ? (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
              >
                <option value="">Uncategorized</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-text-primary">
                {transaction.category_name ?? "Uncategorized"}
              </p>
            )}
          </div>

          {/* Transaction type */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-tertiary">
              Type
            </p>
            {editing ? (
              <select
                value={txnType}
                onChange={(e) => setTxnType(e.target.value as Transaction["transaction_type"])}
                className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="savings_transfer">Savings Transfer</option>
                <option value="internal_transfer">Internal Transfer</option>
              </select>
            ) : (
              <p className="text-sm capitalize text-text-primary">
                {txnType.replace("_", " ")}
              </p>
            )}
          </div>

          {/* Review status */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-tertiary">
              Status
            </p>
            <p className="text-sm text-text-primary">
              {transaction.is_reviewed ? "Reviewed" : "Needs Review"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-border-default px-5 py-4">
          {editing ? (
            <div className="flex gap-3">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded-lg border border-border-default px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-default px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
