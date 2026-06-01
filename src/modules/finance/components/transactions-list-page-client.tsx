"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Account, Transaction, Category, Property } from "@/modules/finance/types";
import { TransactionDetail } from "./transaction-detail";
import { formatCurrencyPrecise, formatDate } from "@/shared/lib/utils";
import {
  Search,
  Filter,
  BrainCircuit,
  AlertCircle,
  CheckCircle,
  HelpCircle,
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
  X,
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

interface ExtendedTransaction extends Transaction {
  account_name: string;
  account_id: string;
  notes: string | null;
}

interface TransactionsListPageClientProps {
  transactions: ExtendedTransaction[];
  accounts: Account[];
  categories: Category[];
  properties?: Property[];
  reviewCount: number;
}

export function TransactionsListPageClient({
  transactions,
  accounts,
  categories,
  properties = [],
  reviewCount,
}: TransactionsListPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountParam = searchParams.get("accountId") ?? "all";
  const [isPending, startTransition] = useTransition();

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState(accountParam);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all"); // 'all', 'needs_review', 'reviewed'
  const [selectedType, setSelectedType] = useState("all"); // 'all', 'expense', 'income'

  // Keep state in sync if URL query parameter changes
  useEffect(() => {
    if (accountParam) {
      setSelectedAccountId(accountParam);
    }
  }, [accountParam]);

  // AI Categorize state
  const [runningAI, setRunningAI] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);

  // Selected details transaction
  const [selectedTxn, setSelectedTxn] = useState<ExtendedTransaction | null>(null);

  // Manual transaction form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTxnDate, setNewTxnDate] = useState(new Date().toISOString().split("T")[0]);
  const [newTxnMerchant, setNewTxnMerchant] = useState("");
  const [newTxnAmount, setNewTxnAmount] = useState("");
  const [newTxnType, setNewTxnType] = useState<Transaction["transaction_type"]>("expense");
  const [newTxnAccountId, setNewTxnAccountId] = useState("");
  const [newTxnCategoryId, setNewTxnCategoryId] = useState("");
  const [newTxnPropertyId, setNewTxnPropertyId] = useState("");
  const [newTxnNotes, setNewTxnNotes] = useState("");
  const [addingTxn, setAddingTxn] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Set default account id on modal open or mount
  useEffect(() => {
    if (accounts.length > 0 && !newTxnAccountId) {
      setNewTxnAccountId(accounts[0].id);
    }
  }, [accounts, newTxnAccountId]);

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    setAddingTxn(true);
    setAddError(null);
    try {
      const res = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newTxnDate,
          amount: Number(newTxnAmount),
          merchant_name: newTxnMerchant,
          portal_category_id: newTxnCategoryId || null,
          property_id: newTxnPropertyId || null,
          notes: newTxnNotes || null,
          account_id: newTxnAccountId || null,
          transaction_type: newTxnType,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowAddModal(false);
        // Reset form
        setNewTxnMerchant("");
        setNewTxnAmount("");
        setNewTxnNotes("");
        setNewTxnCategoryId("");
        setNewTxnPropertyId("");
        startTransition(() => {
          router.refresh();
        });
      } else {
        setAddError(data.error ?? "Failed to add manual transaction");
      }
    } catch {
      setAddError("Network error adding manual transaction");
    } finally {
      setAddingTxn(false);
    }
  }

  // Filter transactions
  const visibleAccounts = accounts.filter((a) => a.is_visible);
  const visibleAccountIds = new Set(visibleAccounts.map((a) => a.id));

  const filteredTransactions = transactions.filter((txn) => {
    // 0. Filter hidden accounts
    if (txn.account_id && !visibleAccountIds.has(txn.account_id)) {
      return false;
    }
    // 1. Search text
    if (search.trim() !== "") {
      const matchText = search.toLowerCase();
      const nameMatch = txn.merchant_name?.toLowerCase().includes(matchText);
      const amountMatch = String(txn.amount).includes(matchText);
      const catMatch = txn.category_name?.toLowerCase().includes(matchText);
      const notesMatch = txn.notes?.toLowerCase().includes(matchText);
      if (!nameMatch && !amountMatch && !catMatch && !notesMatch) {
        return false;
      }
    }

    // 2. Account
    if (selectedAccountId !== "all" && txn.account_id !== selectedAccountId) {
      return false;
    }

    // 3. Category
    if (selectedCategoryId !== "all") {
      if (selectedCategoryId === "uncategorized") {
        if (txn.category_name !== null) return false;
      } else {
        const cat = categories.find((c) => c.id === selectedCategoryId);
        if (txn.category_name !== cat?.name) return false;
      }
    }

    // 4. Status
    if (selectedStatus === "needs_review" && txn.is_reviewed) return false;
    if (selectedStatus === "reviewed" && !txn.is_reviewed) return false;

    // 5. Type
    if (selectedType !== "all" && txn.transaction_type !== selectedType) return false;

    return true;
  });

  async function handleRunAI() {
    setRunningAI(true);
    setAiSuccessMessage(null);
    setAiErrorMessage(null);
    try {
      const res = await fetch("/api/plaid/ai-categorize", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setAiSuccessMessage(`Successfully categorized ${data.count} transaction(s)!`);
        startTransition(() => {
          router.refresh();
        });
      } else {
        setAiErrorMessage(data.error ?? "Failed to run AI categorization");
      }
    } catch {
      setAiErrorMessage("Network error syncing AI suggestions");
    } finally {
      setRunningAI(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Control Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            Transactions Log
          </h1>
          <p className="text-xs text-text-tertiary mt-1">
            {reviewCount} transaction(s) require review
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-bg-tertiary"
          >
            <span>+ Add Transaction</span>
          </button>

          <button
            onClick={handleRunAI}
            disabled={runningAI || isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <BrainCircuit size={14} className={runningAI ? "animate-pulse" : ""} />
            {runningAI ? "Running AI..." : "Run AI Categorization"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {aiSuccessMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-status-green/10 border border-status-green/20 p-4 text-xs text-status-green">
          <CheckCircle size={14} />
          <span>{aiSuccessMessage}</span>
        </div>
      )}
      {aiErrorMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-status-red/10 border border-status-red/20 p-4 text-xs text-status-red">
          <AlertCircle size={14} />
          <span>{aiErrorMessage}</span>
        </div>
      )}

      {/* Search and Filters Drawer */}
      <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-5 shadow-sm space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search merchant, amount, category or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border-default bg-bg-tertiary pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
          />
        </div>

        {/* Filter selectors */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          {/* Account */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs text-text-primary focus:outline-none truncate"
            >
              <option value="all">All Accounts</option>
              {visibleAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.custom_name ?? acc.name} ({acc.institution_name})
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Category
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs text-text-primary focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="uncategorized">Uncategorized</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Review Status */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Review Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs text-text-primary focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="needs_review">Needs Review</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>

          {/* Transaction Type */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs text-text-primary focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="savings_transfer">Savings Transfer</option>
              <option value="internal_transfer">Internal Transfer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="rounded-2xl border border-border-default bg-bg-secondary p-3 sm:p-6">
        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Filter size={32} className="text-text-tertiary mb-3" />
            <p className="text-sm font-medium text-text-secondary">
              No transactions match your search/filters
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              Try adjusting your query inputs above
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {filteredTransactions.map((txn) => {
              const Icon = getIcon(txn.category_icon);
              const isIncome = txn.transaction_type === "income";

              return (
                <button
                  key={txn.id}
                  onClick={() => setSelectedTxn(txn)}
                  className="flex w-full items-center gap-4 py-3.5 text-left transition-colors hover:bg-bg-tertiary/40 first:pt-0 last:pb-0"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg-tertiary text-text-tertiary">
                    <Icon size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {txn.merchant_name ?? "Unknown Merchant"}
                      </p>
                      {!txn.is_reviewed && (
                        <span className="inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold text-accent">
                          Review
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-text-tertiary">
                      <span>{txn.account_name}</span>
                      <span>•</span>
                      <span>{txn.category_name ?? "Uncategorized"}</span>
                      {txn.notes && (
                        <>
                          <span>•</span>
                          <span className="truncate italic max-w-xs">{txn.notes}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-bold tabular-nums ${
                        isIncome ? "text-status-green" : "text-text-primary"
                      }`}
                    >
                      {isIncome ? "+" : ""}
                      {formatCurrencyPrecise(Math.abs(txn.amount))}
                    </p>
                    <p className="text-[11px] text-text-tertiary mt-0.5">
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
          properties={properties}
          onClose={() => setSelectedTxn(null)}
        />
      )}

      {/* Manual Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border-default bg-bg-secondary p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-default pb-4 mb-4">
              <h2 className="text-base font-semibold text-text-primary">Add Manual Transaction</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {addError && (
              <div className="mb-4 rounded-lg bg-status-red/10 border border-status-red/20 p-3 text-xs text-status-red">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">Date</label>
                  <input
                    type="date"
                    required
                    value={newTxnDate}
                    onChange={(e) => setNewTxnDate(e.target.value)}
                    className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none [color-scheme:dark]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={newTxnAmount}
                    onChange={(e) => setNewTxnAmount(e.target.value)}
                    className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Merchant / Payee</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Home Depot, Target, Rent payment"
                  value={newTxnMerchant}
                  onChange={(e) => setNewTxnMerchant(e.target.value)}
                  className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">Type</label>
                  <select
                    value={newTxnType}
                    onChange={(e) => setNewTxnType(e.target.value as Transaction["transaction_type"])}
                    className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="savings_transfer">Savings Transfer</option>
                    <option value="internal_transfer">Internal Transfer</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">Account</label>
                  <select
                    required
                    value={newTxnAccountId}
                    onChange={(e) => setNewTxnAccountId(e.target.value)}
                    className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none"
                  >
                    <option value="" disabled>Select Account</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.custom_name ?? acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">Category</label>
                  <select
                    value={newTxnCategoryId}
                    onChange={(e) => setNewTxnCategoryId(e.target.value)}
                    className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">Property Link</label>
                  <select
                    value={newTxnPropertyId}
                    onChange={(e) => setNewTxnPropertyId(e.target.value)}
                    className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none"
                  >
                    <option value="">None / Personal</option>
                    {properties.map((prop) => (
                      <option key={prop.id} value={prop.id}>
                        {prop.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Notes</label>
                <textarea
                  placeholder="Additional transaction details..."
                  value={newTxnNotes}
                  onChange={(e) => setNewTxnNotes(e.target.value)}
                  className="w-full h-20 rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary resize-none focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-lg border border-border-default px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTxn}
                  className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {addingTxn ? "Adding..." : "Add Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
