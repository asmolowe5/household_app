"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil, Plus, Trash2 } from "lucide-react";
import type { Transaction, Category, Property } from "@/modules/finance/types";
import { formatCurrencyPrecise, formatDate } from "@/shared/lib/utils";

interface TransactionDetailProps {
  transaction: Transaction;
  categories: Category[];
  properties?: Property[];
  onClose: () => void;
}

export function TransactionDetail({
  transaction,
  categories,
  properties = [],
  onClose,
}: TransactionDetailProps) {
  const [editing, setEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(
    transaction.category_name ?? "",
  );
  const [txnType, setTxnType] = useState(transaction.transaction_type);
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    transaction.property_id ?? "",
  );
  const [notes, setNotes] = useState(transaction.notes ?? "");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const [splits, setSplits] = useState<any[]>([]);
  const [loadingSplits, setLoadingSplits] = useState(false);
  const [showSplitsEditor, setShowSplitsEditor] = useState(false);

  useEffect(() => {
    async function loadSplits() {
      setLoadingSplits(true);
      try {
        const res = await fetch(`/api/finance/transactions?transactionId=${transaction.id}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setSplits(data.splits || []);
          if (data.splits && data.splits.length > 0) {
            setShowSplitsEditor(true);
          }
        }
      } catch (err) {
        console.error("Error loading splits", err);
      } finally {
        setLoadingSplits(false);
      }
    }
    loadSplits();
  }, [transaction.id]);

  async function handleSave() {
    setSaving(true);
    try {
      const category = categories.find((c) => c.name === selectedCategory);
      await fetch("/api/plaid/sync", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: transaction.id,
          portal_category_id: showSplitsEditor ? null : (category?.id ?? null),
          transaction_type: txnType,
          notes: notes || null,
          is_reviewed: true,
          property_id: showSplitsEditor ? null : (selectedPropertyId || null),
        }),
      });

      await fetch("/api/finance/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: transaction.id,
          splits: showSplitsEditor
            ? splits.map((s) => ({
                amount: Number(s.amount),
                portal_category_id: s.portal_category_id || null,
                property_id: s.property_id || null,
                notes: s.notes || null,
              }))
            : [],
        }),
      });

      setSaving(false);
      setEditing(false);
      router.refresh();
    } catch (err) {
      console.error("Error saving transaction", err);
      setSaving(false);
    }
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

        <div className="space-y-5 px-5 py-5 overflow-y-auto max-h-[calc(100vh-145px)]">
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

          {/* Category OR Splits Breakdown (View Mode) / Category Selector (Edit Mode) */}
          {!editing ? (
            splits.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-tertiary">
                  Splits Breakdown ({splits.length} items)
                </p>
                <div className="space-y-2">
                  {splits.map((split, index) => (
                    <div key={split.id || index} className="rounded-xl border border-border-default bg-bg-tertiary p-3 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-text-primary">
                          {split.category_name ?? "Uncategorized"}
                        </span>
                        <span className="font-bold text-text-primary tabular-nums">
                          {formatCurrencyPrecise(split.amount)}
                        </span>
                      </div>
                      {(split.property_name || split.notes) && (
                        <div className="flex flex-wrap gap-x-2 text-[11px] text-text-tertiary mt-1">
                          {split.property_name && (
                            <span className="bg-bg-secondary px-1.5 py-0.5 rounded text-[10px] border border-border-subtle text-text-secondary">
                              🏠 {split.property_name}
                            </span>
                          )}
                          {split.notes && <span className="italic">"{split.notes}"</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-tertiary">
                  Category
                </p>
                <p className="text-sm text-text-primary">
                  {transaction.category_name ?? "Uncategorized"}
                </p>
              </div>
            )
          ) : (
            !showSplitsEditor && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-tertiary">
                  Category
                </p>
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
              </div>
            )
          )}

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

          {/* Property (View Mode if no splits / Edit Mode if splits editor disabled) */}
          {!editing ? (
            splits.length === 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-tertiary">
                  Property Link
                </p>
                <p className="text-sm text-text-primary">
                  {properties.find((p) => p.id === selectedPropertyId)?.name ?? (
                    <span className="italic text-text-tertiary">None / Personal</span>
                  )}
                </p>
              </div>
            )
          ) : (
            !showSplitsEditor && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-tertiary">
                  Property Link
                </p>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none"
                >
                  <option value="">None / Personal</option>
                  {properties.map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          )}

          {/* Review status */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-tertiary">
              Status
            </p>
            <p className="text-sm text-text-primary">
              {transaction.is_reviewed ? "Reviewed" : "Needs Review"}
            </p>
          </div>

          {/* Edit Mode Splits Toggle & Editor */}
          {editing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-t border-border-default pt-3 mt-3">
                <span className="text-xs font-medium text-text-secondary">Split Transaction</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !showSplitsEditor;
                    setShowSplitsEditor(nextVal);
                    if (nextVal && splits.length === 0) {
                      setSplits([
                        { id: Math.random().toString(), amount: Math.abs(transaction.amount) / 2, portal_category_id: "", property_id: "", notes: "" },
                        { id: Math.random().toString(), amount: Math.abs(transaction.amount) / 2, portal_category_id: "", property_id: "", notes: "" },
                      ]);
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    showSplitsEditor ? "bg-accent" : "bg-bg-tertiary border-border-default"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                      showSplitsEditor ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {showSplitsEditor && (
                <div className="space-y-3 border-t border-border-default pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Line Splits</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setSplits([
                          ...splits,
                          { id: Math.random().toString(), amount: 0, portal_category_id: "", property_id: "", notes: "" }
                        ]);
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                    >
                      <Plus size={12} /> Add Split
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {splits.map((split, index) => (
                      <div key={split.id || index} className="rounded-xl border border-border-default bg-bg-tertiary p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-text-tertiary">Line #{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSplits(splits.filter((_, idx) => idx !== index));
                            }}
                            className="text-text-tertiary hover:text-status-red transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-medium text-text-secondary">Amount ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={split.amount}
                              onChange={(e) => {
                                const newSplits = [...splits];
                                newSplits[index].amount = e.target.value;
                                setSplits(newSplits);
                              }}
                              className="w-full mt-1 rounded-md border border-border-default bg-bg-secondary px-2 py-1 text-xs text-text-primary focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-medium text-text-secondary">Category</label>
                            <select
                              value={split.portal_category_id || ""}
                              onChange={(e) => {
                                const newSplits = [...splits];
                                newSplits[index].portal_category_id = e.target.value;
                                setSplits(newSplits);
                              }}
                              className="w-full mt-1 rounded-md border border-border-default bg-bg-secondary px-2 py-1 text-xs text-text-primary focus:outline-none"
                            >
                              <option value="">Uncategorized</option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-medium text-text-secondary">Property</label>
                            <select
                              value={split.property_id || ""}
                              onChange={(e) => {
                                const newSplits = [...splits];
                                newSplits[index].property_id = e.target.value;
                                setSplits(newSplits);
                              }}
                              className="w-full mt-1 rounded-md border border-border-default bg-bg-secondary px-2 py-1 text-xs text-text-primary focus:outline-none"
                            >
                              <option value="">None / Personal</option>
                              {properties.map((prop) => (
                                <option key={prop.id} value={prop.id}>
                                  {prop.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-medium text-text-secondary">Memo</label>
                            <input
                              type="text"
                              placeholder="Memo notes..."
                              value={split.notes || ""}
                              onChange={(e) => {
                                const newSplits = [...splits];
                                newSplits[index].notes = e.target.value;
                                setSplits(newSplits);
                              }}
                              className="w-full mt-1 rounded-md border border-border-default bg-bg-secondary px-2 py-1 text-xs text-text-primary focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Validation Summary */}
                  <div className="rounded-xl bg-bg-tertiary p-3 border border-border-default text-xs space-y-1 tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Total Amount:</span>
                      <span className="font-semibold text-text-primary">${Math.abs(transaction.amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Allocated:</span>
                      <span className="font-semibold text-text-primary">
                        ${splits.reduce((sum, s) => sum + Number(s.amount || 0), 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border-subtle pt-1 mt-1">
                      <span className="text-text-tertiary font-medium">Remaining:</span>
                      <span
                        className={`font-bold ${
                          Math.abs(Math.abs(transaction.amount) - splits.reduce((sum, s) => sum + Number(s.amount || 0), 0)) < 0.005
                            ? "text-status-green"
                            : "text-status-red"
                        }`}
                      >
                        ${(Math.abs(transaction.amount) - splits.reduce((sum, s) => sum + Number(s.amount || 0), 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-tertiary">
              Notes / AI Explanation
            </p>
            {editing ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter notes or explanation..."
                className="w-full h-20 rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary resize-none focus:outline-none"
              />
            ) : (
              <p className="text-sm text-text-primary whitespace-pre-wrap">
                {notes || <span className="italic text-text-tertiary">No notes entered</span>}
              </p>
            )}
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
                disabled={
                  saving ||
                  (showSplitsEditor &&
                    Math.abs(
                      Math.abs(transaction.amount) -
                        splits.reduce((sum, s) => sum + Number(s.amount || 0), 0)
                    ) >= 0.005)
                }
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
