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
  Calendar,
  User,
  CreditCard,
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
  const [newTenantName, setNewTenantName] = useState("");
  const [newLeaseStart, setNewLeaseStart] = useState("");
  const [newLeaseEnd, setNewLeaseEnd] = useState("");
  const [newSecurityDeposit, setNewSecurityDeposit] = useState("");
  const [newMortgage, setNewMortgage] = useState("");
  const [newInsurance, setNewInsurance] = useState("");
  const [newTaxes, setNewTaxes] = useState("");
  const [newHoa, setNewHoa] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit states for selected property
  const [isEditingProperty, setIsEditingProperty] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editRentTarget, setEditRentTarget] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTenantName, setEditTenantName] = useState("");
  const [editLeaseStart, setEditLeaseStart] = useState("");
  const [editLeaseEnd, setEditLeaseEnd] = useState("");
  const [editSecurityDeposit, setEditSecurityDeposit] = useState("");
  const [editMortgage, setEditMortgage] = useState("");
  const [editInsurance, setEditInsurance] = useState("");
  const [editTaxes, setEditTaxes] = useState("");
  const [editHoa, setEditHoa] = useState("");

  // Helper: Get transaction stats and monthly cash flows for a property
  const getPropertyStats = (prop: Property) => {
    const propTxns = transactions.filter((t) => t.property_id === prop.id);
    
    // Total income (rent received)
    const income = propTxns
      .filter((t) => t.transaction_type === "income")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
    // Total expenses (maintenance, utilities, etc. mapped via transactions)
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

    const thisMonthExpenses = propTxns
      .filter((t) => {
        const d = new Date(t.date);
        return (
          t.transaction_type === "expense" &&
          d.getMonth() === currentMonth &&
          d.getFullYear() === currentYear
        );
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Fixed bills sum
    const monthlyFixedBills =
      (prop.monthly_mortgage ?? 0) +
      (prop.monthly_insurance ?? 0) +
      (prop.monthly_taxes ?? 0) +
      (prop.monthly_hoa ?? 0);

    // Cash flow formula: rent income minus transactional expenses and fixed monthly bills
    const thisMonthCashFlow = thisMonthRent - thisMonthExpenses - monthlyFixedBills;

    return {
      income,
      expenses,
      net,
      thisMonthRent,
      thisMonthExpenses,
      thisMonthCashFlow,
      monthlyFixedBills,
      txns: propTxns,
    };
  };

  // Portfolio level stats
  const portfolioStats = properties.reduce(
    (acc, prop) => {
      const stats = getPropertyStats(prop);
      return {
        income: acc.income + stats.income,
        expenses: acc.expenses + stats.expenses,
        net: acc.net + stats.net,
        targetRent: acc.targetRent + prop.monthly_rent_target,
        thisMonthRent: acc.thisMonthRent + stats.thisMonthRent,
        thisMonthCashFlow: acc.thisMonthCashFlow + stats.thisMonthCashFlow,
        monthlyFixedBills: acc.monthlyFixedBills + stats.monthlyFixedBills,
      };
    },
    { income: 0, expenses: 0, net: 0, targetRent: 0, thisMonthRent: 0, thisMonthCashFlow: 0, monthlyFixedBills: 0 }
  );

  const activePropertyStats = selectedProperty ? getPropertyStats(selectedProperty) : null;

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
          tenantName: newTenantName || null,
          leaseStart: newLeaseStart || null,
          leaseEnd: newLeaseEnd || null,
          securityDeposit: parseFloat(newSecurityDeposit) || 0,
          monthlyMortgage: parseFloat(newMortgage) || 0,
          monthlyInsurance: parseFloat(newInsurance) || 0,
          monthlyTaxes: parseFloat(newTaxes) || 0,
          monthlyHoa: parseFloat(newHoa) || 0,
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
      setNewTenantName("");
      setNewLeaseStart("");
      setNewLeaseEnd("");
      setNewSecurityDeposit("");
      setNewMortgage("");
      setNewInsurance("");
      setNewTaxes("");
      setNewHoa("");
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
          tenantName: editTenantName || null,
          leaseStart: editLeaseStart || null,
          leaseEnd: editLeaseEnd || null,
          securityDeposit: parseFloat(editSecurityDeposit) || 0,
          monthlyMortgage: parseFloat(editMortgage) || 0,
          monthlyInsurance: parseFloat(editInsurance) || 0,
          monthlyTaxes: parseFloat(editTaxes) || 0,
          monthlyHoa: parseFloat(editHoa) || 0,
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
    setEditTenantName(selectedProperty.tenant_name ?? "");
    setEditLeaseStart(selectedProperty.lease_start ?? "");
    setEditLeaseEnd(selectedProperty.lease_end ?? "");
    setEditSecurityDeposit(String(selectedProperty.security_deposit ?? 0));
    setEditMortgage(String(selectedProperty.monthly_mortgage ?? 0));
    setEditInsurance(String(selectedProperty.monthly_insurance ?? 0));
    setEditTaxes(String(selectedProperty.monthly_taxes ?? 0));
    setEditHoa(String(selectedProperty.monthly_hoa ?? 0));
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
            Manage performance, leases, and cash flows for your real estate properties
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
        {/* Net Monthly Cashflow */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">Portfolio Cash Flow (This Month)</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-green/10 text-status-green">
              <Coins size={16} />
            </div>
          </div>
          <p className={`mt-2 text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${portfolioStats.thisMonthCashFlow >= 0 ? "text-status-green" : "text-status-red"}`}>
            {portfolioStats.thisMonthCashFlow >= 0 ? "+" : ""}
            {formatCurrencyPrecise(portfolioStats.thisMonthCashFlow)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-[11px] text-text-tertiary">
            <span>Rent minus bills and repairs</span>
          </div>
        </div>

        {/* Current Month Rent vs Target */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">Rent Collected (This Month)</p>
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

        {/* Fixed monthly bills */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">Monthly Fixed Costs</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-red/10 text-status-red">
              <TrendingDown size={16} />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-text-primary tabular-nums">
            {formatCurrencyPrecise(portfolioStats.monthlyFixedBills)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-[11px] text-text-tertiary">
            <span>Mortgage, HOA, insurance, taxes</span>
          </div>
        </div>
      </div>

      {/* Properties list */}
      {properties.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-bg-secondary flex flex-col items-center justify-center py-20 text-center">
          <Building2 size={40} className="text-text-tertiary mb-3 animate-pulse" />
          <p className="text-sm font-semibold text-text-primary">No properties added yet</p>
          <p className="text-xs text-text-tertiary mt-1 max-w-sm">
            Add a property using the button above to start tracking lease agreements, fixed costs, and cash flows.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {properties.map((prop) => {
            const stats = getPropertyStats(prop);
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
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                      {prop.name}
                    </h3>
                    {prop.address && (
                      <p className="flex items-center gap-1 text-[11px] text-text-tertiary mt-0.5 truncate">
                        <MapPin size={11} className="shrink-0" />
                        {prop.address}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-text-tertiary group-hover:text-accent transition-transform group-hover:translate-x-0.5" />
                </div>

                <div className="border-t border-border-subtle/50 my-3.5 w-full" />

                {/* Lease status and details */}
                <div className="flex justify-between items-center text-[11px] text-text-secondary w-full mb-3.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <User size={12} className="text-text-tertiary" />
                    {prop.tenant_name ? (
                      <span className="font-semibold text-text-primary truncate">Tenant: {prop.tenant_name}</span>
                    ) : (
                      <span className="italic text-text-tertiary">Vacant / No Lease</span>
                    )}
                  </div>
                  {prop.lease_end && (
                    <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
                      <Calendar size={11} />
                      Lease ends {formatDate(prop.lease_end)}
                    </div>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 w-full text-xs">
                  <div>
                    <span className="text-[10px] text-text-tertiary uppercase font-semibold tracking-wider block">
                      Rent Collected (Month)
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
                    <span className="text-[10px] text-text-tertiary uppercase font-semibold tracking-wider block">
                      Cash Flow (Month)
                    </span>
                    <p className={`font-bold mt-0.5 tabular-nums ${stats.thisMonthCashFlow >= 0 ? "text-status-green" : "text-status-red"}`}>
                      {stats.thisMonthCashFlow >= 0 ? "+" : ""}
                      {formatCurrencyPrecise(stats.thisMonthCashFlow)}
                    </p>
                    <p className="text-[10px] text-text-tertiary mt-1">
                      Fixed bills: {formatCurrencyPrecise(stats.monthlyFixedBills)}
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
                  {/* General */}
                  <div className="space-y-3.5">
                    <h4 className="text-[10px] font-bold text-accent uppercase tracking-wider border-b border-border-subtle pb-1">
                      General Details
                    </h4>
                    <div className="grid gap-3 grid-cols-2">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                          Property Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                          Address
                        </label>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Lease */}
                  <div className="space-y-3.5 pt-2">
                    <h4 className="text-[10px] font-bold text-accent uppercase tracking-wider border-b border-border-subtle pb-1">
                      Lease Details
                    </h4>
                    <div className="grid gap-3 grid-cols-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                          Tenant Name
                        </label>
                        <input
                          type="text"
                          value={editTenantName}
                          onChange={(e) => setEditTenantName(e.target.value)}
                          className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                          Monthly Rent Target ($)
                        </label>
                        <input
                          type="number"
                          value={editRentTarget}
                          onChange={(e) => setEditRentTarget(e.target.value)}
                          className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                          Lease Start Date
                        </label>
                        <input
                          type="date"
                          value={editLeaseStart}
                          onChange={(e) => setEditLeaseStart(e.target.value)}
                          className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                          Lease End Date
                        </label>
                        <input
                          type="date"
                          value={editLeaseEnd}
                          onChange={(e) => setEditLeaseEnd(e.target.value)}
                          className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                          Security Deposit ($)
                        </label>
                        <input
                          type="number"
                          value={editSecurityDeposit}
                          onChange={(e) => setEditSecurityDeposit(e.target.value)}
                          className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Monthly Bills */}
                  <div className="space-y-3.5 pt-2">
                    <h4 className="text-[10px] font-bold text-accent uppercase tracking-wider border-b border-border-subtle pb-1">
                      Monthly Fixed Bills ($)
                    </h4>
                    <div className="grid gap-3 grid-cols-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                          Mortgage
                        </label>
                        <input
                          type="number"
                          value={editMortgage}
                          onChange={(e) => setEditMortgage(e.target.value)}
                          className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                          HOA Fees
                        </label>
                        <input
                          type="number"
                          value={editHoa}
                          onChange={(e) => setEditHoa(e.target.value)}
                          className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                          Property Taxes
                        </label>
                        <input
                          type="number"
                          value={editTaxes}
                          onChange={(e) => setEditTaxes(e.target.value)}
                          className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                          Insurance
                        </label>
                        <input
                          type="number"
                          value={editInsurance}
                          onChange={(e) => setEditInsurance(e.target.value)}
                          className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">
                      Notes
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full h-20 rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary resize-none focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProperty(false)}
                      className="flex-1 rounded-xl border border-border-default py-2 text-xs font-medium text-text-secondary hover:bg-bg-tertiary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 rounded-xl bg-accent py-2 text-xs font-semibold text-slate-950 hover:opacity-90 transition-opacity disabled:opacity-50"
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
                        Monthly Cash Flow
                      </span>
                      <span className={`text-sm font-bold block mt-1 tabular-nums ${activePropertyStats.thisMonthCashFlow >= 0 ? "text-status-green" : "text-status-red"}`}>
                        {activePropertyStats.thisMonthCashFlow >= 0 ? "+" : ""}
                        {formatCurrencyPrecise(activePropertyStats.thisMonthCashFlow)}
                      </span>
                    </div>

                    <div className="rounded-xl bg-bg-tertiary/40 border border-border-subtle p-3.5">
                      <span className="text-[9px] uppercase font-bold text-text-tertiary tracking-wider block">
                        Rent Received
                      </span>
                      <span className="text-sm font-bold text-text-primary block mt-1 tabular-nums">
                        {formatCurrencyPrecise(activePropertyStats.thisMonthRent)}
                      </span>
                    </div>

                    <div className="rounded-xl bg-bg-tertiary/40 border border-border-subtle p-3.5">
                      <span className="text-[9px] uppercase font-bold text-text-tertiary tracking-wider block">
                        Month Expenses
                      </span>
                      <span className="text-sm font-bold text-status-red block mt-1 tabular-nums">
                        {formatCurrencyPrecise(activePropertyStats.thisMonthExpenses)}
                      </span>
                    </div>
                  </div>

                  {/* Lease metadata block */}
                  <div className="rounded-xl bg-bg-tertiary/20 p-4 border border-border-subtle grid gap-3 grid-cols-2 text-xs">
                    <div className="col-span-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary border-b border-border-subtle/50 pb-1">
                      <User size={13} />
                      Lease Information
                    </div>
                    <div>
                      <span className="text-text-tertiary block">Tenant Name</span>
                      <span className="font-semibold text-text-primary mt-0.5 block">
                        {selectedProperty.tenant_name || <span className="italic text-text-tertiary">Vacant</span>}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary block">Monthly Rent Target</span>
                      <span className="font-semibold text-text-primary mt-0.5 block">
                        {formatCurrencyPrecise(selectedProperty.monthly_rent_target)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary block">Lease Duration</span>
                      <span className="font-semibold text-text-primary mt-0.5 block">
                        {selectedProperty.lease_start ? (
                          `${formatDate(selectedProperty.lease_start)} - ${selectedProperty.lease_end ? formatDate(selectedProperty.lease_end) : "Indefinite"}`
                        ) : (
                          <span className="italic text-text-tertiary">No lease term</span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary block">Security Deposit</span>
                      <span className="font-semibold text-text-primary mt-0.5 block">
                        {formatCurrencyPrecise(selectedProperty.security_deposit ?? 0)}
                      </span>
                    </div>
                  </div>

                  {/* Monthly Bills breakdown */}
                  <div className="rounded-xl bg-bg-tertiary/20 p-4 border border-border-subtle grid gap-3 grid-cols-2 text-xs">
                    <div className="col-span-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-tertiary border-b border-border-subtle/50 pb-1">
                      <CreditCard size={13} />
                      Monthly Bills Baseline
                    </div>
                    <div>
                      <span className="text-text-tertiary">Mortgage:</span>
                      <span className="font-bold text-text-primary ml-1.5 tabular-nums">
                        {formatCurrencyPrecise(selectedProperty.monthly_mortgage ?? 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">HOA Fees:</span>
                      <span className="font-bold text-text-primary ml-1.5 tabular-nums">
                        {formatCurrencyPrecise(selectedProperty.monthly_hoa ?? 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Property Taxes:</span>
                      <span className="font-bold text-text-primary ml-1.5 tabular-nums">
                        {formatCurrencyPrecise(selectedProperty.monthly_taxes ?? 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Insurance:</span>
                      <span className="font-bold text-text-primary ml-1.5 tabular-nums">
                        {formatCurrencyPrecise(selectedProperty.monthly_insurance ?? 0)}
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
          <div className="relative w-full max-w-lg rounded-2xl bg-bg-secondary border border-border-default p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
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
              {/* General info */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-accent uppercase tracking-wider border-b border-border-subtle pb-0.5">
                  General Details
                </h4>
                <div className="grid gap-3 grid-cols-2">
                  <div className="col-span-2">
                    <label className="block text-text-tertiary mb-1">Property Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Greenwood Condo, Unit B"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-text-tertiary mb-1">Address</label>
                    <input
                      type="text"
                      placeholder="Street, City, State ZIP"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Lease */}
              <div className="space-y-3 pt-1">
                <h4 className="text-[10px] font-bold text-accent uppercase tracking-wider border-b border-border-subtle pb-0.5">
                  Lease Terms
                </h4>
                <div className="grid gap-3 grid-cols-2">
                  <div>
                    <label className="block text-text-tertiary mb-1">Tenant Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={newTenantName}
                      onChange={(e) => setNewTenantName(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-text-tertiary mb-1">Monthly Rent Target ($)</label>
                    <input
                      type="number"
                      placeholder="1450"
                      value={newRentTarget}
                      onChange={(e) => setNewRentTarget(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-text-tertiary mb-1">Lease Start</label>
                    <input
                      type="date"
                      value={newLeaseStart}
                      onChange={(e) => setNewLeaseStart(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-text-tertiary mb-1">Lease End</label>
                    <input
                      type="date"
                      value={newLeaseEnd}
                      onChange={(e) => setNewLeaseEnd(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-text-tertiary mb-1">Security Deposit ($)</label>
                    <input
                      type="number"
                      placeholder="1500"
                      value={newSecurityDeposit}
                      onChange={(e) => setNewSecurityDeposit(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Monthly Bills */}
              <div className="space-y-3 pt-1">
                <h4 className="text-[10px] font-bold text-accent uppercase tracking-wider border-b border-border-subtle pb-0.5">
                  Monthly Fixed Bills ($)
                </h4>
                <div className="grid gap-3 grid-cols-2">
                  <div>
                    <label className="block text-text-tertiary mb-1">Mortgage</label>
                    <input
                      type="number"
                      placeholder="850"
                      value={newMortgage}
                      onChange={(e) => setNewMortgage(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-text-tertiary mb-1">HOA Fees</label>
                    <input
                      type="number"
                      placeholder="40"
                      value={newHoa}
                      onChange={(e) => setNewHoa(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-text-tertiary mb-1">Taxes (Property)</label>
                    <input
                      type="number"
                      placeholder="110"
                      value={newTaxes}
                      onChange={(e) => setNewTaxes(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-text-tertiary mb-1">Insurance</label>
                    <input
                      type="number"
                      placeholder="75"
                      value={newInsurance}
                      onChange={(e) => setNewInsurance(e.target.value)}
                      className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-text-tertiary mb-1">Notes</label>
                <textarea
                  placeholder="Tenant notes, contact info, escrow bank particulars..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full h-16 rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary resize-none focus:border-accent focus:outline-none"
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
