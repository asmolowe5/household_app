"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Account, Transaction, Category } from "@/modules/finance/types";
import { TransactionListClient } from "./finances-client";
import { PlaidLinkButton } from "./plaid-link-button";
import { formatCurrencyPrecise } from "@/shared/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Scale,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Landmark,
} from "lucide-react";

interface FinanceDashboardClientProps {
  initialAccounts: Account[];
  initialRecentTransactions: Transaction[];
  initialReviewCount: number;
  categories: Category[];
}

export function FinanceDashboardClient({
  initialAccounts,
  initialRecentTransactions,
  initialReviewCount,
  categories,
}: FinanceDashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Aggregate metrics
  const cashAccounts = initialAccounts.filter(
    (a) => a.type === "depository" || a.subtype === "checking" || a.subtype === "savings"
  );
  const creditAccounts = initialAccounts.filter(
    (a) => a.type === "credit" || a.type === "loan" || a.subtype === "credit card"
  );

  const totalCash = cashAccounts.reduce(
    (sum, a) => sum + (a.current_balance ?? 0),
    0
  );
  const totalDebt = creditAccounts.reduce(
    (sum, a) => sum + (a.current_balance ?? 0),
    0
  );
  const netWorth = totalCash - totalDebt;

  // Poll for updates every 3 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      void triggerSilentSync();
    }, 180000); // 3 minutes

    return () => clearInterval(interval);
  }, []);

  async function triggerSilentSync() {
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      if (res.ok) {
        startTransition(() => {
          router.refresh();
          setLastSyncTime(new Date());
        });
      }
    } catch (e) {
      console.error("Auto-sync background check failed:", e);
    }
  }

  async function handleManualSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/plaid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        startTransition(() => {
          router.refresh();
          setLastSyncTime(new Date());
        });
      } else {
        setSyncError(data.error ?? "Failed to sync accounts");
      }
    } catch {
      setSyncError("Network error. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Control Area */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            Finances Overview
          </h1>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-text-tertiary">
            <Clock size={12} />
            <span>
              Last updated: {lastSyncTime.toLocaleTimeString()}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <PlaidLinkButton variant="secondary" />
          <button
            onClick={handleManualSync}
            disabled={syncing || isPending}
            className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={syncing || isPending ? "animate-spin" : ""}
            />
            {syncing ? "Syncing..." : "Sync Accounts"}
          </button>
        </div>
      </div>

      {syncError && (
        <div className="flex items-center gap-2 rounded-xl bg-status-red/10 border border-status-red/20 p-4 text-xs text-status-red">
          <AlertCircle size={14} />
          <span>{syncError}</span>
        </div>
      )}

      {/* Bird's Eye Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Net Worth */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">Net Worth</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-muted text-accent">
              <Scale size={16} />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-text-primary tabular-nums">
            {formatCurrencyPrecise(netWorth)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-[11px] text-text-tertiary">
            <span>Assets minus Liabilities</span>
          </div>
        </div>

        {/* Cash Assets */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">Total Cash Assets</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-green/10 text-status-green">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-text-primary tabular-nums">
            {formatCurrencyPrecise(totalCash)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-[11px] text-text-tertiary">
            <span>{cashAccounts.length} accounts linked</span>
          </div>
        </div>

        {/* Credit Debt */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">Credit Card Debt</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-red/10 text-status-red">
              <TrendingDown size={16} />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-text-primary tabular-nums">
            {formatCurrencyPrecise(totalDebt)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-[11px] text-text-tertiary">
            <span>{creditAccounts.length} cards linked</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Bank Accounts List */}
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Landmark size={16} className="text-text-secondary" />
              Connected Accounts
            </h2>
            <div className="space-y-3">
               {initialAccounts.map((account) => {
                const isDebt =
                  account.type === "credit" ||
                  account.type === "loan" ||
                  account.subtype === "credit card";
                return (
                  <Link
                    key={account.id}
                    href={`/finance/transactions?accountId=${account.id}`}
                    className="block rounded-xl border border-border-subtle bg-bg-tertiary/40 p-3 transition-all hover:bg-bg-tertiary/80 hover:border-accent group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-text-primary group-hover:text-accent transition-colors">
                          {account.name}
                        </p>
                        <span className="shrink-0 text-[9px] text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
                          View Txns →
                        </span>
                      </div>
                      <p className="text-[10px] text-text-tertiary truncate">
                        {account.institution_name} • <span className="capitalize">{account.subtype ?? account.type}</span>
                      </p>
                      
                      <div className="border-t border-border-subtle/50 my-2" />
                      
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[9px] text-text-tertiary uppercase font-medium tracking-wider">
                          Balance
                        </span>
                        <span className={`text-xs font-bold tabular-nums ${isDebt ? "text-text-primary" : "text-status-green"}`}>
                          {formatCurrencyPrecise(account.current_balance ?? 0)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Transactions Review Area */}
        <div className="lg:col-span-2">
          <TransactionListClient
            transactions={initialRecentTransactions}
            categories={categories}
            reviewCount={initialReviewCount}
          />
        </div>
      </div>
    </div>
  );
}
