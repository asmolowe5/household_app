"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Landmark,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Settings as SettingsIcon,
  HelpCircle,
} from "lucide-react";
import type { Account } from "@/modules/finance/types";
import { formatCurrencyPrecise } from "@/shared/lib/utils";

interface SettingsClientProps {
  initialAccounts: Account[];
}

export function SettingsClient({ initialAccounts }: SettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local state for account custom names and visibility
  const [accountsList, setAccountsList] = useState<Account[]>(initialAccounts);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  // Group accounts by institution name
  const groupedAccounts = accountsList.reduce((acc, curr) => {
    const key = curr.institution_name ?? "Other Connections";
    if (!acc[key]) acc[key] = [];
    acc[key].push(curr);
    return acc;
  }, {} as Record<string, Account[]>);

  // Toggle Visibility
  async function handleToggleVisibility(id: string, currentVisible: boolean) {
    setSavingId(id);
    setErrorId(null);
    setSuccessId(null);

    const nextVisible = !currentVisible;

    // Optimistically update UI
    setAccountsList((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, is_visible: nextVisible } : acc))
    );

    try {
      const res = await fetch("/api/finance/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: id,
          is_visible: nextVisible,
        }),
      });

      if (!res.ok) throw new Error("Failed to update visibility");

      setSuccessId(id);
      setTimeout(() => setSuccessId(null), 1500);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      // Revert optimistic update
      setAccountsList((prev) =>
        prev.map((acc) => (acc.id === id ? { ...acc, is_visible: currentVisible } : acc))
      );
      setErrorId(id);
      setTimeout(() => setErrorId(null), 3000);
    } finally {
      setSavingId(null);
    }
  }

  // Handle Custom Name Blur / Save
  async function handleSaveCustomName(id: string, nameInput: string, originalCustomName: string | null) {
    const cleanedName = nameInput.trim();
    if (cleanedName === (originalCustomName ?? "")) {
      return; // No change
    }

    setSavingId(id);
    setErrorId(null);
    setSuccessId(null);

    // Optimistically update UI
    setAccountsList((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, custom_name: cleanedName || null } : acc))
    );

    try {
      const res = await fetch("/api/finance/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: id,
          custom_name: cleanedName,
        }),
      });

      if (!res.ok) throw new Error("Failed to update custom name");

      setSuccessId(id);
      setTimeout(() => setSuccessId(null), 1500);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      // Revert optimistic update
      setAccountsList((prev) =>
        prev.map((acc) => (acc.id === id ? { ...acc, custom_name: originalCustomName } : acc))
      );
      setErrorId(id);
      setTimeout(() => setErrorId(null), 3000);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-24 sm:px-6">
      {/* Top Header Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-accent"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
          <SettingsIcon className="text-accent" size={22} />
          Portal Settings
        </h1>
        <p className="mt-1 text-xs text-text-tertiary">
          Manage your connected modules, configure Plaid accounts, and update preferences.
        </p>
      </div>

      {/* Main Settings Panel */}
      <div className="space-y-8">
        {/* Finance Settings Card */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Landmark size={16} className="text-accent" />
                Finance Module Accounts
              </h2>
              <p className="text-[11px] text-text-tertiary">
                Choose which accounts are visible in the Finance dashboard and rename them for easier tracking.
              </p>
            </div>
          </div>

          <div className="space-y-8">
            {Object.entries(groupedAccounts).map(([institution, accounts]) => (
              <div key={institution} className="space-y-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5 border-b border-border-subtle/50 pb-1.5">
                  <Landmark size={12} />
                  {institution}
                </h3>
                <div className="grid gap-4">
                  {accounts.map((account) => {
                    const isDebt =
                      account.type === "credit" ||
                      account.type === "loan" ||
                      account.subtype === "credit card";
                    const isSaving = savingId === account.id;
                    const isSuccess = successId === account.id;
                    const isError = errorId === account.id;

                    return (
                      <div
                        key={account.id}
                        className={`relative rounded-xl border p-4 transition-all duration-200 ${
                          account.is_visible
                            ? "border-border-subtle bg-bg-tertiary/20"
                            : "border-border-subtle/30 bg-bg-tertiary/5 opacity-60"
                        }`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          {/* Info Column */}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${
                                  account.is_visible ? "bg-status-green" : "bg-text-tertiary/40"
                                }`}
                              />
                              <p className="text-xs font-semibold text-text-primary">
                                {account.custom_name ?? account.name}
                              </p>
                              {account.custom_name && (
                                <span className="text-[9px] text-text-tertiary truncate">
                                  (Plaid: {account.name})
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                              {account.subtype ?? account.type} • Balance:{" "}
                              <span className={isDebt ? "text-text-secondary" : "text-status-green"}>
                                {formatCurrencyPrecise(account.current_balance ?? 0)}
                              </span>
                            </p>
                          </div>

                          {/* Action Controls */}
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Custom Name Editor */}
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-medium text-text-tertiary">
                                Display Name
                              </label>
                              <input
                                type="text"
                                defaultValue={account.custom_name ?? ""}
                                placeholder={account.name}
                                onBlur={(e) =>
                                  handleSaveCustomName(account.id, e.target.value, account.custom_name)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-full max-w-[180px] rounded-lg border border-border-default bg-bg-tertiary px-2.5 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                              />
                            </div>

                            {/* Visibility Toggle Button */}
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-medium text-text-tertiary text-center">
                                Visible
                              </label>
                              <button
                                onClick={() => handleToggleVisibility(account.id, account.is_visible)}
                                className={`flex items-center justify-center rounded-lg border px-3 py-1 text-xs font-medium transition-all ${
                                  account.is_visible
                                    ? "border-accent/40 bg-accent/5 text-accent hover:bg-accent/10"
                                    : "border-border-default bg-bg-tertiary text-text-tertiary hover:bg-bg-tertiary/75"
                                }`}
                              >
                                {account.is_visible ? (
                                  <span className="flex items-center gap-1">
                                    <Eye size={12} /> Yes
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <EyeOff size={12} /> No
                                  </span>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Status overlays inside card */}
                        <div className="absolute right-3 top-3 flex items-center gap-1.5">
                          {isSaving && (
                            <span className="flex items-center gap-1 text-[9px] text-accent animate-pulse">
                              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" />
                              saving...
                            </span>
                          )}
                          {isSuccess && (
                            <span className="flex items-center gap-1 text-[9px] text-status-green">
                              <CheckCircle2 size={10} />
                              saved
                            </span>
                          )}
                          {isError && (
                            <span className="flex items-center gap-1 text-[9px] text-status-red">
                              <AlertCircle size={10} />
                              error
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Informative Tip */}
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 flex gap-3">
          <HelpCircle size={18} className="text-accent shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-text-primary">
              Where do hidden accounts go?
            </h4>
            <p className="text-[11px] leading-relaxed text-text-secondary">
              Hidden accounts are temporarily removed from your Dashboard metrics, charts, accounts list, and transactions log. This is perfect for secondary or unused accounts that clutter your dashboard. You can always toggle them back on here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
