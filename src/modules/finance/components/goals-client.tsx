"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Account, SavingsGoal } from "@/modules/finance/types";
import { formatCurrencyPrecise } from "@/shared/lib/utils";
import {
  PiggyBank,
  Plus,
  Trash2,
  Edit2,
  X,
  Target,
  ChevronRight,
  PlusCircle,
  MinusCircle,
  HelpCircle,
  CheckCircle,
} from "lucide-react";

interface GoalsClientProps {
  accounts: Account[];
  goals: SavingsGoal[];
}

export function GoalsClient({
  accounts,
  goals,
}: GoalsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Modal states
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalModalMode, setGoalModalMode] = useState<"create" | "edit">("create");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formTargetAmount, setFormTargetAmount] = useState("");
  const [formCurrentAmount, setFormCurrentAmount] = useState("");
  const [formTargetDate, setFormTargetDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formIsCompleted, setFormIsCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Transaction Ledger State for quick deposit/withdraw
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerGoal, setLedgerGoal] = useState<SavingsGoal | null>(null);
  const [ledgerAmount, setLedgerAmount] = useState("");
  const [ledgerAction, setLedgerAction] = useState<"deposit" | "withdraw">("deposit");
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  // Overall metrics
  const activeGoals = goals.filter((g) => !g.is_completed);
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.target_amount, 0);
  const totalSaved = activeGoals.reduce((sum, g) => sum + g.current_amount, 0);
  const overallPercent = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  function openCreateModal() {
    setGoalModalMode("create");
    setEditingGoalId(null);
    setFormName("");
    setFormTargetAmount("");
    setFormCurrentAmount("0");
    setFormTargetDate("");
    setFormNotes("");
    setFormAccountId("");
    setFormIsCompleted(false);
    setErrorMsg(null);
    setShowGoalModal(true);
  }

  function openEditModal(goal: SavingsGoal) {
    setGoalModalMode("edit");
    setEditingGoalId(goal.id);
    setFormName(goal.name);
    setFormTargetAmount(String(goal.target_amount));
    setFormCurrentAmount(String(goal.current_amount));
    setFormTargetDate(goal.target_date ?? "");
    setFormNotes(goal.notes ?? "");
    setFormAccountId(goal.account_id ?? "");
    setFormIsCompleted(goal.is_completed);
    setErrorMsg(null);
    setShowGoalModal(true);
  }

  function openLedgerModal(goal: SavingsGoal, action: "deposit" | "withdraw") {
    setLedgerGoal(goal);
    setLedgerAction(action);
    setLedgerAmount("");
    setLedgerError(null);
    setShowLedgerModal(true);
  }

  async function handleGoalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const payload = {
      id: editingGoalId,
      name: formName,
      target_amount: Number(formTargetAmount),
      current_amount: Number(formCurrentAmount),
      target_date: formTargetDate || null,
      notes: formNotes || null,
      account_id: formAccountId || null,
      is_completed: formIsCompleted,
    };

    try {
      const url = "/api/finance/savings-goals";
      const method = goalModalMode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowGoalModal(false);
        startTransition(() => {
          router.refresh();
        });
      } else {
        setErrorMsg(data.error ?? "Failed to save goal");
      }
    } catch {
      setErrorMsg("Network error saving goal");
    } finally {
      setSaving(false);
    }
  }

  async function handleLedgerSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ledgerGoal) return;
    setSaving(true);
    setLedgerError(null);

    const amountNum = Number(ledgerAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setLedgerError("Please enter a valid amount greater than 0");
      setSaving(false);
      return;
    }

    let nextAmount = ledgerGoal.current_amount;
    if (ledgerAction === "deposit") {
      nextAmount += amountNum;
    } else {
      nextAmount = Math.max(0, nextAmount - amountNum);
    }

    const payload = {
      id: ledgerGoal.id,
      name: ledgerGoal.name,
      target_amount: ledgerGoal.target_amount,
      current_amount: nextAmount,
      target_date: ledgerGoal.target_date,
      notes: ledgerGoal.notes,
      account_id: ledgerGoal.account_id,
      is_completed: nextAmount >= ledgerGoal.target_amount,
    };

    try {
      const res = await fetch("/api/finance/savings-goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowLedgerModal(false);
        startTransition(() => {
          router.refresh();
        });
      } else {
        setLedgerError(data.error ?? "Failed to update savings allocation");
      }
    } catch {
      setLedgerError("Network error updating balance");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this savings goal?")) return;
    try {
      const res = await fetch("/api/finance/savings-goals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err) {
      console.error("Error deleting goal", err);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Control Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            Savings Envelopes & Vaults
          </h1>
          <p className="text-xs text-text-tertiary mt-1">
            Allocate and track progress toward your financial targets
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-slate-950 transition-opacity hover:opacity-90"
        >
          <Plus size={14} />
          Create Savings Vault
        </button>
      </div>

      {/* Summary Indicator */}
      <div className="rounded-2xl border border-border-default bg-bg-secondary p-5 flex flex-col md:flex-row gap-6 md:items-center justify-between">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
            Combined Target Progress
          </span>
          <h2 className="text-2xl font-bold tabular-nums text-text-primary">
            {formatCurrencyPrecise(totalSaved)} / {formatCurrencyPrecise(totalTarget)}
          </h2>
          <p className="text-xs text-text-tertiary">
            Earmarked allocations across {activeGoals.length} active vaults
          </p>
        </div>

        <div className="flex-1 max-w-md space-y-1">
          <div className="flex justify-between text-xs font-bold text-text-secondary">
            <span>Overall saved percentage</span>
            <span>{overallPercent}%</span>
          </div>
          <div className="w-full bg-bg-tertiary rounded-full h-3.5 border border-border-default p-0.5">
            <div
              className="bg-accent h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, overallPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Grid List of Goals */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {goals.map((goal) => {
          const isCompleted = goal.current_amount >= goal.target_amount || goal.is_completed;
          const percent = goal.target_amount > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 0;

          return (
            <div
              key={goal.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between space-y-4 transition-all ${
                isCompleted
                  ? "border-status-green/30 bg-status-green/5 opacity-90"
                  : "border-border-default bg-bg-secondary"
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Target size={16} className={isCompleted ? "text-status-green" : "text-accent"} />
                    <h3 className="font-semibold text-sm text-text-primary truncate max-w-[160px]">
                      {goal.name}
                    </h3>
                  </div>
                  {isCompleted && (
                    <span className="flex items-center gap-0.5 rounded-full bg-status-green/10 px-2 py-0.5 text-[9px] font-bold text-status-green">
                      <CheckCircle size={10} /> Saved
                    </span>
                  )}
                </div>

                {goal.account_name && (
                  <span className="text-[10px] bg-bg-tertiary px-2 py-0.5 rounded text-text-secondary border border-border-subtle inline-block">
                    🏦 Vault Linked: {goal.account_name}
                  </span>
                )}

                {goal.notes && <p className="text-xs text-text-tertiary leading-relaxed truncate">{goal.notes}</p>}
              </div>

              {/* Progress visual */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold tabular-nums text-text-secondary">
                  <span>{formatCurrencyPrecise(goal.current_amount)}</span>
                  <span>{percent}% of {formatCurrencyPrecise(goal.target_amount)}</span>
                </div>
                <div className="w-full bg-bg-tertiary rounded-full h-2 p-0.5">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${
                      isCompleted ? "bg-status-green" : "bg-accent"
                    }`}
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
                {goal.target_date && (
                  <p className="text-[10px] text-text-tertiary text-right mt-1">
                    Target due: {new Date(goal.target_date).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="border-t border-border-subtle pt-3 flex justify-between items-center gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => openLedgerModal(goal, "deposit")}
                    className="p-1.5 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors flex items-center gap-1 text-[10px] font-bold"
                    title="Deposit Cash"
                  >
                    <PlusCircle size={12} /> Add
                  </button>
                  <button
                    onClick={() => openLedgerModal(goal, "withdraw")}
                    className="p-1.5 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80 transition-colors flex items-center gap-1 text-[10px] font-bold"
                    title="Withdraw Cash"
                  >
                    <MinusCircle size={12} /> Take
                  </button>
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => openEditModal(goal)}
                    className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-tertiary hover:text-status-red transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGoalModal(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-border-default bg-bg-secondary p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-default pb-4 mb-4">
              <h2 className="text-sm font-semibold text-text-primary">
                {goalModalMode === "create" ? "Create Savings Vault" : "Edit Savings Vault"}
              </h2>
              <button
                onClick={() => setShowGoalModal(false)}
                className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 rounded-lg bg-status-red/10 border border-status-red/20 p-3 text-xs text-status-red">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleGoalSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Vault Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Europe Vacation Fund, Home Repairs"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">Target ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formTargetAmount}
                    onChange={(e) => setFormTargetAmount(e.target.value)}
                    className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">Current Balance ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formCurrentAmount}
                    onChange={(e) => setFormCurrentAmount(e.target.value)}
                    className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Target Due Date</label>
                <input
                  type="date"
                  value={formTargetDate}
                  onChange={(e) => setFormTargetDate(e.target.value)}
                  className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none [color-scheme:dark]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Earmark Synced Account (Optional)</label>
                <select
                  value={formAccountId}
                  onChange={(e) => setFormAccountId(e.target.value)}
                  className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none"
                >
                  <option value="">None / General Cash</option>
                  {accounts
                    .filter((a) => a.is_visible)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.custom_name ?? acc.name} ({acc.institution_name})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Details, purchase listings, links..."
                  className="w-full h-20 rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary resize-none focus:outline-none"
                />
              </div>

              {goalModalMode === "edit" && (
                <div className="flex items-center justify-between border-t border-border-subtle pt-3">
                  <span className="text-xs font-medium text-text-secondary">Goal Completed</span>
                  <button
                    type="button"
                    onClick={() => setFormIsCompleted(!formIsCompleted)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formIsCompleted ? "bg-status-green" : "bg-bg-tertiary border-border-default"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                        formIsCompleted ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="flex-1 rounded-lg border border-border-default px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Vault"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ledger Deposit/Withdraw Modal */}
      {showLedgerModal && ledgerGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLedgerModal(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-border-default bg-bg-secondary p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-default pb-4 mb-4">
              <h2 className="text-sm font-semibold text-text-primary capitalize">
                {ledgerAction} Cash: {ledgerGoal.name}
              </h2>
              <button
                onClick={() => setShowLedgerModal(false)}
                className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {ledgerError && (
              <div className="mb-4 rounded-lg bg-status-red/10 border border-status-red/20 p-3 text-xs text-status-red">
                {ledgerError}
              </div>
            )}

            <form onSubmit={handleLedgerSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={ledgerAmount}
                  onChange={(e) => setLedgerAmount(e.target.value)}
                  className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
                <p className="text-[10px] text-text-tertiary mt-1">
                  Current Vault Standing: {formatCurrencyPrecise(ledgerGoal.current_amount)}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLedgerModal(false)}
                  className="flex-1 rounded-lg border border-border-default px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : ledgerAction === "deposit" ? "Allocate Deposit" : "Confirm Withdrawal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
