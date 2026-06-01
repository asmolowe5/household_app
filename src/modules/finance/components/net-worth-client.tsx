"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Account, Property, AssetLiability, NetWorthSnapshot } from "@/modules/finance/types";
import { formatCurrencyPrecise, formatDate } from "@/shared/lib/utils";
import {
  TrendingUp,
  Plus,
  Trash2,
  Edit2,
  X,
  Building,
  Car,
  PiggyBank,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  Calendar,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface NetWorthClientProps {
  accounts: Account[];
  properties: Property[];
  manualItems: AssetLiability[];
  snapshots: NetWorthSnapshot[];
}

export function NetWorthClient({
  accounts,
  properties,
  manualItems,
  snapshots,
}: NetWorthClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formType, setFormType] = useState<AssetLiability["type"]>("asset_real_estate");
  const [formNotes, setFormNotes] = useState("");
  const [formPropertyId, setFormPropertyId] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Compute Plaid totals
  const syncedAssets = accounts
    .filter((a) => a.is_visible && a.type !== "credit card" && a.type !== "loan")
    .reduce((sum, a) => sum + (a.current_balance ?? 0), 0);

  const syncedLiabilities = accounts
    .filter((a) => a.is_visible && (a.type === "credit card" || a.type === "loan"))
    .reduce((sum, a) => sum + (a.current_balance ?? 0), 0);

  // Compute Manual totals
  const manualAssets = manualItems
    .filter((i) => i.type.startsWith("asset_"))
    .reduce((sum, i) => sum + i.value, 0);

  const manualLiabilities = manualItems
    .filter((i) => i.type.startsWith("liability_"))
    .reduce((sum, i) => sum + i.value, 0);

  const totalAssets = syncedAssets + manualAssets;
  const totalLiabilities = syncedLiabilities + manualLiabilities;
  const netWorth = totalAssets - totalLiabilities;

  // Auto-log today's snapshot on load
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const exists = snapshots.some((s) => s.date === today);
    if (!exists && (totalAssets > 0 || totalLiabilities > 0)) {
      fetch("/api/finance/net-worth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          total_assets: totalAssets,
          total_liabilities: totalLiabilities,
        }),
      }).then(() => {
        router.refresh();
      });
    }
  }, [totalAssets, totalLiabilities, snapshots, router]);

  // Construct charts data
  const chartData =
    snapshots.length > 0
      ? snapshots.map((s) => ({
          name: s.date.slice(5), // YYYY-MM-DD -> MM-DD
          Assets: s.total_assets,
          Liabilities: s.total_liabilities,
          "Net Worth": s.net_worth,
        }))
      : [
          { name: "Jan", Assets: totalAssets * 0.9, Liabilities: totalLiabilities * 0.95, "Net Worth": totalAssets * 0.9 - totalLiabilities * 0.95 },
          { name: "Feb", Assets: totalAssets * 0.92, Liabilities: totalLiabilities * 0.93, "Net Worth": totalAssets * 0.92 - totalLiabilities * 0.93 },
          { name: "Mar", Assets: totalAssets * 0.95, Liabilities: totalLiabilities * 0.92, "Net Worth": totalAssets * 0.95 - totalLiabilities * 0.92 },
          { name: "Apr", Assets: totalAssets * 0.98, Liabilities: totalLiabilities * 1.01, "Net Worth": totalAssets * 0.98 - totalLiabilities * 1.01 },
          { name: "Current", Assets: totalAssets, Liabilities: totalLiabilities, "Net Worth": netWorth },
        ];

  function openCreateModal() {
    setModalMode("create");
    setEditingId(null);
    setFormName("");
    setFormValue("");
    setFormType("asset_real_estate");
    setFormNotes("");
    setFormPropertyId("");
    setErrorMsg(null);
    setShowModal(true);
  }

  function openEditModal(item: AssetLiability) {
    setModalMode("edit");
    setEditingId(item.id);
    setFormName(item.name);
    setFormValue(String(item.value));
    setFormType(item.type);
    setFormNotes(item.notes ?? "");
    setFormPropertyId(item.property_id ?? "");
    setErrorMsg(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const payload = {
      id: editingId,
      name: formName,
      value: Number(formValue),
      type: formType,
      notes: formNotes || null,
      property_id: formPropertyId || null,
    };

    try {
      const url = "/api/finance/assets-liabilities";
      const method = modalMode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowModal(false);
        startTransition(() => {
          router.refresh();
        });
      } else {
        setErrorMsg(data.error ?? "Failed to save manual asset");
      }
    } catch {
      setErrorMsg("Network error saving entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this item?")) return;
    try {
      const res = await fetch("/api/finance/assets-liabilities", {
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
      console.error("Error deleting manual item", err);
    }
  }

  function getTypeIcon(type: AssetLiability["type"]) {
    switch (type) {
      case "asset_real_estate":
        return <Building size={14} className="text-accent" />;
      case "asset_vehicle":
        return <Car size={14} className="text-status-green" />;
      case "liability_mortgage":
        return <Building size={14} className="text-status-red" />;
      default:
        return <PiggyBank size={14} className="text-text-secondary" />;
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Control Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            Net Worth Engine
          </h1>
          <p className="text-xs text-text-tertiary mt-1">
            Tracking your total assets and liabilities
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-slate-950 transition-opacity hover:opacity-90"
        >
          <Plus size={14} />
          Add Manual Asset/Liability
        </button>
      </div>

      {/* Grid Indicators */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
            Current Net Worth
          </span>
          <h2 className="mt-2 text-2xl font-bold tabular-nums text-text-primary">
            {formatCurrencyPrecise(netWorth)}
          </h2>
          <div className="flex items-center gap-1 mt-1 text-xs text-status-green">
            <TrendingUp size={12} />
            <span>Assets minus Liabilities</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border-default bg-bg-secondary p-5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
            Total Assets
          </span>
          <h2 className="mt-2 text-2xl font-bold tabular-nums text-status-green">
            {formatCurrencyPrecise(totalAssets)}
          </h2>
          <div className="flex justify-between items-center mt-1 text-[11px] text-text-tertiary">
            <span>Synced: {formatCurrencyPrecise(syncedAssets)}</span>
            <span>Manual: {formatCurrencyPrecise(manualAssets)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border-default bg-bg-secondary p-5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
            Total Liabilities
          </span>
          <h2 className="mt-2 text-2xl font-bold tabular-nums text-status-red">
            {formatCurrencyPrecise(totalLiabilities)}
          </h2>
          <div className="flex justify-between items-center mt-1 text-[11px] text-text-tertiary">
            <span>Synced: {formatCurrencyPrecise(syncedLiabilities)}</span>
            <span>Manual: {formatCurrencyPrecise(manualLiabilities)}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border-default bg-bg-secondary p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-5">Net Worth Trend</h3>
        <div className="h-64 w-full">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d9f99d" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#d9f99d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#22252a" />
                <XAxis dataKey="name" stroke="#8892b0" fontSize={10} />
                <YAxis
                  stroke="#8892b0"
                  fontSize={10}
                  tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#17181c",
                    borderColor: "#2a2d35",
                    borderRadius: "12px",
                    color: "#f8fafc",
                    fontSize: "11px",
                  }}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, ""]}
                />
                <Area
                  type="monotone"
                  dataKey="Net Worth"
                  stroke="#d9f99d"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorNetWorth)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-text-tertiary">
              Loading Chart...
            </div>
          )}
        </div>
      </div>

      {/* Assets and Liabilities Lists */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Assets Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-status-green" />
            Assets Ledger
          </h3>

          <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 space-y-3">
            {/* Synced Plaid Assets */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary block">
                Synced Accounts
              </span>
              {accounts
                .filter((a) => a.is_visible && a.type !== "credit card" && a.type !== "loan")
                .map((a) => (
                  <div
                    key={a.id}
                    className="flex justify-between items-center rounded-xl bg-bg-tertiary/40 border border-border-subtle p-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-text-primary">
                        {a.custom_name ?? a.name}
                      </p>
                      <p className="text-[10px] text-text-tertiary mt-0.5 capitalize">
                        {a.institution_name} • {a.subtype ?? a.type}
                      </p>
                    </div>
                    <span className="font-bold text-text-primary tabular-nums">
                      {formatCurrencyPrecise(a.current_balance ?? 0)}
                    </span>
                  </div>
                ))}
            </div>

            {/* Manual Assets */}
            <div className="space-y-2 border-t border-border-subtle pt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary block">
                Manually Tracked Assets
              </span>
              {manualItems.filter((i) => i.type.startsWith("asset_")).length === 0 ? (
                <p className="text-xs text-text-tertiary italic">No manual assets logged</p>
              ) : (
                manualItems
                  .filter((i) => i.type.startsWith("asset_"))
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center rounded-xl bg-bg-tertiary/40 border border-border-subtle p-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {getTypeIcon(item.type)}
                        <div>
                          <p className="font-semibold text-text-primary">{item.name}</p>
                          {item.notes && <p className="text-[10px] text-text-tertiary">{item.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-text-primary tabular-nums">
                          {formatCurrencyPrecise(item.value)}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1 hover:bg-bg-tertiary rounded text-text-secondary transition-colors"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 hover:bg-bg-tertiary rounded text-text-tertiary hover:text-status-red transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Liabilities Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-status-red" />
            Liabilities Ledger
          </h3>

          <div className="rounded-2xl border border-border-default bg-bg-secondary p-4 space-y-3">
            {/* Synced Plaid Liabilities */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary block">
                Synced Cards & Loans
              </span>
              {accounts
                .filter((a) => a.is_visible && (a.type === "credit card" || a.type === "loan"))
                .map((a) => (
                  <div
                    key={a.id}
                    className="flex justify-between items-center rounded-xl bg-bg-tertiary/40 border border-border-subtle p-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-text-primary">
                        {a.custom_name ?? a.name}
                      </p>
                      <p className="text-[10px] text-text-tertiary mt-0.5 capitalize">
                        {a.institution_name} • {a.subtype ?? a.type}
                      </p>
                    </div>
                    <span className="font-bold text-text-primary tabular-nums">
                      {formatCurrencyPrecise(a.current_balance ?? 0)}
                    </span>
                  </div>
                ))}
            </div>

            {/* Manual Liabilities */}
            <div className="space-y-2 border-t border-border-subtle pt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary block">
                Manually Tracked Liabilities
              </span>
              {manualItems.filter((i) => i.type.startsWith("liability_")).length === 0 ? (
                <p className="text-xs text-text-tertiary italic">No manual liabilities logged</p>
              ) : (
                manualItems
                  .filter((i) => i.type.startsWith("liability_"))
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center rounded-xl bg-bg-tertiary/40 border border-border-subtle p-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {getTypeIcon(item.type)}
                        <div>
                          <p className="font-semibold text-text-primary">{item.name}</p>
                          {item.notes && <p className="text-[10px] text-text-tertiary">{item.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-text-primary tabular-nums">
                          {formatCurrencyPrecise(item.value)}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1 hover:bg-bg-tertiary rounded text-text-secondary transition-colors"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 hover:bg-bg-tertiary rounded text-text-tertiary hover:text-status-red transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CRUD Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-border-default bg-bg-secondary p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-default pb-4 mb-4">
              <h2 className="text-sm font-semibold text-text-primary">
                {modalMode === "create" ? "Add Asset/Liability" : "Edit Asset/Liability"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Primary Residence, Mortage Loan"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Value ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Category Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as AssetLiability["type"])}
                  className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none"
                >
                  <optgroup label="Assets">
                    <option value="asset_real_estate">Real Estate (Home/Land)</option>
                    <option value="asset_vehicle">Vehicle (Car/Boat)</option>
                    <option value="asset_investment">Cash/Other Investments</option>
                  </optgroup>
                  <optgroup label="Liabilities">
                    <option value="liability_mortgage">Mortgage principal balance</option>
                    <option value="liability_loan">Car/Student/Personal Loan</option>
                    <option value="liability_other">Other Debt</option>
                  </optgroup>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Linked Property (Optional)</label>
                <select
                  value={formPropertyId}
                  onChange={(e) => setFormPropertyId(e.target.value)}
                  className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none"
                >
                  <option value="">None / General</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="A/C details, account numbers, valuation date..."
                  className="w-full h-20 rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary resize-none focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-border-default px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
