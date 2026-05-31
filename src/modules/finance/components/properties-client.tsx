"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Property, Transaction, Category } from "@/modules/finance/types";
import { TransactionDetail } from "./transaction-detail";
import { formatCurrencyPrecise, formatDate } from "@/shared/lib/utils";
import {
  Plus,
  Building,
  MapPin,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Trash2,
  Edit2,
  X,
  FileText,
  Check,
  Building2,
  Coins,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface PropertiesClientProps {
  properties: Property[];
  transactions: Transaction[];
  categories: Category[];
}

export function PropertiesClient({
  properties,
  transactions,
  categories,
}: PropertiesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog States
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  // Form states for new property
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newRentTarget, setNewRentTarget] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit states for selected property
  const [isEditingProperty, setIsEditingProperty] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editRentTarget, setEditRentTarget] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Helper: Get transaction stats for a specific property
  const getPropertyStats = (propertyId: string) => {
    const propTxns = transactions.filter((t) => t.property_id === propertyId);
    
    // Total income (rent received)
    const income = propTxns
      .filter((t) => t.transaction_type === "income")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
    // Total expenses (maintenance, taxes, etc.)
    const expenses = propTxns
      .filter((t) => t.transaction_type === "expense")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const net = income - expenses;

    // Current month rent collected
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonthRent = propTxns
      .filter((t) => {
        const d = new Date(t.date);
        return (
          t.transaction_type === "income" &&
          d.getMonth() === currentMonth &&
          d.getFullYear() === currentYear
        );
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      income,
      expenses,
      net,
      thisMonthRent,
      txns: propTxns,
    };
  };

  // Portfolio level stats
  const portfolioStats = properties.reduce(
    (acc, prop) => {
      const stats = getPropertyStats(prop.id);
      return {
        income: acc.income + stats.income,
        expenses: acc.expenses + stats.expenses,
        net: acc.net + stats.net,
        targetRent: acc.targetRent + prop.monthly_rent_target,
        thisMonthRent: acc.thisMonthRent + stats.thisMonthRent,
      };
    },
    { income: 0, expenses: 0, net: 0, targetRent: 0, thisMonthRent: 0 }
  );

  const activePropertyStats = selectedProperty ? getPropertyStats(selectedProperty.id) : null;

  async function handleAddProperty(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setFormError("Property name is required.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/finance/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          address: newAddress,
          monthly_rent_target: parseFloat(newRentTarget) || 0,
          notes: newNotes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create property");
      }

      // Reset states
      setNewName("");
      setNewAddress("");
      setNewRentTarget("");
      setNewNotes("");
      setShowAddModal(false);

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateProperty(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProperty) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/finance/properties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedProperty.id,
          name: editName,
          address: editAddress,
          monthly_rent_target: parseFloat(editRentTarget) || 0,
          notes: editNotes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update property");
      }

      const updated = await res.json();
      setSelectedProperty(updated.property);
      setIsEditingProperty(false);

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      alert("Failed to update property");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteProperty() {
    if (!selectedProperty) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/finance/properties", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedProperty.id }),
      });

      if (!res.ok) {
        throw new Error("Failed to delete property");
      }

      setShowDeleteConfirm(false);
      setSelectedProperty(null);

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      alert("Failed to delete property");
    } finally {
      setSubmitting(false);
    }
  }

  const startEditMode = () => {
    if (!selectedProperty) return;
    setEditName(selectedProperty.name);
    setEditAddress(selectedProperty.address ?? "");
    setEditRentTarget(String(selectedProperty.monthly_rent_target));
    setEditNotes(selectedProperty.notes ?? "");
    setIsEditingProperty(true);
  };

  return (
    <div className="space-y-6">
      {/* Portfolio header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            Real Estate Properties
          </h1>
          <p className="text-xs text-text-tertiary mt-1">
            Manage performance and logs for your real estate holdings
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-slate-950 transition-opacity hover:opacity-90"
        >
          <Plus size={14} />
          Add Property
        </button>
      </div>

      {/* Bird's Eye Portfolio Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Net Rental Cashflow */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">Portfolio Cash Flow</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-green/10 text-status-green">
              <Coins size={16} />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-text-primary tabular-nums">
            {formatCurrencyPrecise(portfolioStats.net)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-[11px] text-text-tertiary">
            <span>All-time Net Income</span>
          </div>
        </div>

        {/* Current Month Rent vs Target */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">This Month's rent</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-muted text-accent">
              <Building size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary tabular-nums">
              {formatCurrencyPrecise(portfolioStats.thisMonthRent)}
            </span>
            <span className="text-xs text-text-tertiary tabular-nums">
              / {formatCurrencyPrecise(portfolioStats.targetRent)} target
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-bg-tertiary overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  portfolioStats.targetRent > 0
                    ? (portfolioStats.thisMonthRent / portfolioStats.targetRent) * 100
                    : 0
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Total expenses */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">Total Expenses</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-red/10 text-status-red">
              <TrendingDown size={16} />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-text-primary tabular-nums">
            {formatCurrencyPrecise(portfolioStats.expenses)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-[11px] text-text-tertiary">
            <span>Maintenance, taxes, repairs</span>
          </div>
        </div>
      </div>

      {/* Properties list */}
      {properties.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-bg-secondary flex flex-col items-center justify-center py-20 text-center">
          <Building2 size={40} className="text-text-tertiary mb-3 animate-pulse" />
          <p className="text-sm font-semibold text-text-primary">No properties added yet</p>
          <p className="text-xs text-text-tertiary mt-1 max-w-sm">
            Add a property using the button above to start tracking rent income, maintenance costs, and taxes.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {properties.map((prop) => {
            const stats = getPropertyStats(prop.id);
            const rentProgress =
              prop.monthly_rent_target > 0
                ? (stats.thisMonthRent / prop.monthly_rent_target) * 100
                : 0;

            return (
              <button
                key={prop.id}
                onClick={() => {
                  setSelectedProperty(prop);
                  setIsEditingProperty(false);
                }}
                className="flex flex-col text-left rounded-2xl border border-border-default bg-bg-secondary p-5 transition-all hover:bg-bg-tertiary/20 hover:border-accent hover:shadow-md group"
              >
                <div className="flex w-full items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                      {prop.name}
                    </h3>
                    {prop.address && (
                      <p className="flex items-center gap-1 text-xs text-text-tertiary mt-0.5 truncate">
                        <MapPin size={11} />
                        {prop.address}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-text-tertiary group-hover:text-accent transition-transform group-hover:translate-x-0.5" />
                </div>

                <div className="border-t border-border-subtle/50 my-4 w-full" />

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 w-full text-xs">
                  <div>
                    <span className="text-[10px] text-text-tertiary uppercase font-semibold tracking-wider">
                      This Month Rent
                    </span>
                    <p className="font-bold text-text-primary mt-0.5 tabular-nums">
                      {formatCurrencyPrecise(stats.thisMonthRent)}
                      <span className="text-[10px] font-normal text-text-tertiary ml-1">
                        / {formatCurrencyPrecise(prop.monthly_rent_target)}
                      </span>
                    </p>
                    {/* Progress slider */}
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-bg-tertiary overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{ width: `${Math.min(100, rentProgress)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-text-tertiary uppercase font-semibold tracking-wider font-medium">
                      Net Income (All-time)
                    </span>
                    <p className={`font-bold mt-0.5 tabular-nums ${stats.net >= 0 ? "text-status-green" : "text-status-red"}`}>
                      {stats.net >= 0 ? "+" : ""}
                      {formatCurrencyPrecise(stats.net)}
                    </p>
                    <p className="text-[10px] text-text-tertiary mt-1">
                      Exp: {formatCurrencyPrecise(stats.expenses)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Property Details Side-Over Panel */}
      {selectedProperty && activePropertyStats && (
        <div className="fixed inset-0 z-40 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedProperty(null)}
          />

          {/* Drawer container */}
          <div className="relative w-full max-w-lg bg-bg-secondary shadow-2xl sm:rounded-l-3xl flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-default px-6 py-4 shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Property Dashboard
                </h2>
              </div>
              <button
                onClick={() => setSelectedProperty(null)}
                className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable details area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isEditingProperty ? (
                /* Edit property form */
                <form onSubmit={handleUpdateProperty} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                      Property Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                      Monthly Rent Target ($)
                    </label>
                    <input
                      type="number"
                      value={editRentTarget}
                      onChange={(e) => setEditRentTarget(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                      Notes
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full h-24 rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary resize-none focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProperty(false)}
                      className="flex-1 rounded-xl border border-border-default py-2.5 text-xs font-medium text-text-secondary hover:bg-bg-tertiary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 rounded-xl bg-accent py-2.5 text-xs font-semibold text-slate-950 hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {submitting ? "Updating..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              ) : (
                /* Stats view */
                <>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-lg font-bold text-text-primary">
                        {selectedProperty.name}
                      </h3>
                      <button
                        onClick={startEditMode}
                        className="text-text-tertiary hover:text-text-primary p-1 rounded transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                    {selectedProperty.address && (
                      <p className="text-xs text-text-tertiary flex items-center gap-1">
                        <MapPin size={12} />
                        {selectedProperty.address}
                      </p>
                    )}
                  </div>

                  {/* Summary widgets */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-bg-tertiary/40 border border-border-subtle p-3.5">
                      <span className="text-[9px] uppercase font-bold text-text-tertiary tracking-wider block">
                        Net Income
                      </span>
                      <span className={`text-sm font-bold block mt-1 tabular-nums ${activePropertyStats.net >= 0 ? "text-status-green" : "text-status-red"}`}>
                        {formatCurrencyPrecise(activePropertyStats.net)}
                      </span>
                    </div>

                    <div className="rounded-xl bg-bg-tertiary/40 border border-border-subtle p-3.5">
                      <span className="text-[9px] uppercase font-bold text-text-tertiary tracking-wider block">
                        Rent Collected
                      </span>
                      <span className="text-sm font-bold text-text-primary block mt-1 tabular-nums">
                        {formatCurrencyPrecise(activePropertyStats.thisMonthRent)}
                      </span>
                    </div>

                    <div className="rounded-xl bg-bg-tertiary/40 border border-border-subtle p-3.5">
                      <span className="text-[9px] uppercase font-bold text-text-tertiary tracking-wider block">
                        Expenses
                      </span>
                      <span className="text-sm font-bold text-status-red block mt-1 tabular-nums">
                        {formatCurrencyPrecise(activePropertyStats.expenses)}
                      </span>
                    </div>
                  </div>

                  {selectedProperty.notes && (
                    <div className="rounded-xl bg-bg-tertiary/20 p-3.5 border border-border-subtle">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1 mb-1.5">
                        <FileText size={12} />
                        Notes
                      </h4>
                      <p className="text-xs text-text-secondary whitespace-pre-wrap">
                        {selectedProperty.notes}
                      </p>
                    </div>
                  )}

                  {/* Property transactions */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-text-primary">
                      Property Transaction Logs
                    </h4>
                    {activePropertyStats.txns.length === 0 ? (
                      <p className="text-xs text-text-tertiary italic py-6 text-center border border-dashed border-border-default rounded-xl bg-bg-tertiary/10">
                        No transactions linked to this property yet. Select transactions from the log and assign them here.
                      </p>
                    ) : (
                      <div className="divide-y divide-border-subtle rounded-xl border border-border-default bg-bg-tertiary/25 px-4">
                        {activePropertyStats.txns.map((txn) => {
                          const isIncome = txn.transaction_type === "income";
                          return (
                            <button
                              key={txn.id}
                              onClick={() => setSelectedTxn(txn)}
                              className="flex w-full items-center justify-between py-3 text-left transition-colors hover:bg-bg-tertiary/50 group"
                            >
                              <div className="min-w-0 pr-3">
                                <p className="truncate text-xs font-semibold text-text-primary group-hover:text-accent transition-colors">
                                  {txn.merchant_name ?? "Unknown Merchant"}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-tertiary">
                                  <span>{formatDate(txn.date)}</span>
                                  <span>•</span>
                                  <span>{txn.category_name ?? "Uncategorized"}</span>
                                </div>
                              </div>
                              <span className={`text-xs font-bold shrink-0 tabular-nums ${isIncome ? "text-status-green" : "text-text-primary"}`}>
                                {isIncome ? "+" : ""}
                                {formatCurrencyPrecise(Math.abs(txn.amount))}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Actions footer inside drawer */}
                  <div className="border-t border-border-default pt-4 flex justify-between items-center shrink-0">
                    {showDeleteConfirm ? (
                      <div className="flex items-center gap-2 w-full bg-status-red/10 border border-status-red/20 rounded-xl p-3 text-xs">
                        <span className="text-status-red font-medium flex-1">
                          Delete property? Hist. logs will remain.
                        </span>
                        <button
                          onClick={handleDeleteProperty}
                          disabled={submitting}
                          className="bg-status-red text-white font-semibold rounded-lg px-2.5 py-1"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="text-text-secondary hover:text-text-primary font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-1.5 rounded-lg text-xs font-medium text-status-red hover:bg-status-red/10 px-2.5 py-1.5 transition-colors"
                      >
                        <Trash2 size={13} />
                        Archive Property
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Property Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddModal(false)}
          />

          {/* Modal Panel */}
          <div className="relative w-full max-w-md rounded-2xl bg-bg-secondary border border-border-default p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <Sparkles size={16} className="text-accent" />
                Add New Real Estate Property
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <p className="text-xs text-status-red bg-status-red/10 border border-status-red/20 rounded-lg p-2.5">
                {formError}
              </p>
            )}

            <form onSubmit={handleAddProperty} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-text-tertiary mb-1">Property Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Greenwood Condo, Unit B"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-text-tertiary mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Street, City, State ZIP"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-text-tertiary mb-1">Monthly Rent Target ($)</label>
                <input
                  type="number"
                  placeholder="1450"
                  value={newRentTarget}
                  onChange={(e) => setNewRentTarget(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-text-tertiary mb-1">Notes</label>
                <textarea
                  placeholder="e.g., Tenant names, lease dates, escrow particulars..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full h-20 rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary resize-none focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-border-default py-2.5 text-xs font-semibold text-text-secondary hover:bg-bg-tertiary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-accent py-2.5 text-xs font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Add Property"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Detail Overlay inside slideover logs */}
      {selectedTxn && (
        <TransactionDetail
          transaction={selectedTxn}
          categories={categories}
          properties={properties}
          onClose={() => setSelectedTxn(null)}
        />
      )}
    </div>
  );
}
