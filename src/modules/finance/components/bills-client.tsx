"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, RecurringBill } from "@/modules/finance/types";
import { formatCurrencyPrecise } from "@/shared/lib/utils";
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Edit2,
  X,
  CreditCard,
  Check,
  AlertCircle,
  HelpCircle,
  Activity,
  Sparkles,
} from "lucide-react";

interface BillsClientProps {
  recurringBills: RecurringBill[];
  categories: Category[];
}

export function BillsClient({
  recurringBills,
  categories,
}: BillsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Calendar Math
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const monthName = now.toLocaleString("default", { month: "long" });

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Selected Day filters
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formFrequency, setFormFrequency] = useState<RecurringBill["frequency"]>("monthly");
  const [formDueDay, setFormDueDay] = useState("1");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load auto-detected recurring suggestions
  useEffect(() => {
    async function fetchSuggestions() {
      setLoadingSuggestions(true);
      try {
        const res = await fetch("/api/finance/recurring-bills?mode=detect");
        const data = await res.json();
        if (res.ok && data.success) {
          // Filter out suggestions that are already in our recurring bills
          const existingNames = new Set(recurringBills.map((b) => b.name.toLowerCase()));
          const filtered = (data.suggestions || []).filter(
            (s: any) => !existingNames.has(s.merchant_name.toLowerCase())
          );
          setSuggestions(filtered);
        }
      } catch (err) {
        console.error("Error fetching billing suggestions", err);
      } finally {
        setLoadingSuggestions(false);
      }
    }
    fetchSuggestions();
  }, [recurringBills]);

  function openCreateModal() {
    setModalMode("create");
    setEditingId(null);
    setFormName("");
    setFormAmount("");
    setFormFrequency("monthly");
    setFormDueDay("1");
    setFormCategoryId("");
    setFormNotes("");
    setFormIsActive(true);
    setErrorMsg(null);
    setShowModal(true);
  }

  function openEditModal(bill: RecurringBill) {
    setModalMode("edit");
    setEditingId(bill.id);
    setFormName(bill.name);
    setFormAmount(String(bill.amount));
    setFormFrequency(bill.frequency);
    setFormDueDay(String(bill.due_day));
    setFormCategoryId(bill.portal_category_id ?? "");
    setFormNotes(bill.notes ?? "");
    setFormIsActive(bill.is_active);
    setErrorMsg(null);
    setShowModal(true);
  }

  async function handleAddSuggestion(sug: any) {
    try {
      const res = await fetch("/api/finance/recurring-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sug.merchant_name,
          amount: sug.amount,
          frequency: "monthly",
          due_day: 1, // default
          portal_category_id: sug.portal_category_id || null,
          notes: "Auto-detected recurring subscription",
        }),
      });

      if (res.ok) {
        setSuggestions(suggestions.filter((s) => s.merchant_name !== sug.merchant_name));
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err) {
      console.error("Error adding suggested bill", err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const payload = {
      id: editingId,
      name: formName,
      amount: Number(formAmount),
      frequency: formFrequency,
      due_day: Number(formDueDay),
      portal_category_id: formCategoryId || null,
      notes: formNotes || null,
      is_active: formIsActive,
    };

    try {
      const url = "/api/finance/recurring-bills";
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
        setErrorMsg(data.error ?? "Failed to save recurring bill");
      }
    } catch {
      setErrorMsg("Network error saving bill");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this recurring bill/subscription?")) return;
    try {
      const res = await fetch("/api/finance/recurring-bills", {
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
      console.error("Error deleting recurring bill", err);
    }
  }

  // Monthly totals
  const totalMonthlyBills = recurringBills
    .filter((b) => b.is_active && b.frequency === "monthly")
    .reduce((sum, b) => sum + b.amount, 0);

  const dueBills = selectedDay
    ? recurringBills.filter((b) => b.due_day === selectedDay)
    : recurringBills;

  return (
    <div className="space-y-6">
      {/* Top Control Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            Bills & Subscriptions
          </h1>
          <p className="text-xs text-text-tertiary mt-1">
            Visual calendar of upcoming household overhead costs
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-slate-950 transition-opacity hover:opacity-90"
        >
          <Plus size={14} />
          Add Recurring Bill
        </button>
      </div>

      {/* Grid Indicators */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
            Monthly Recurring Overhead
          </span>
          <h2 className="mt-2 text-2xl font-bold tabular-nums text-text-primary">
            {formatCurrencyPrecise(totalMonthlyBills)}
          </h2>
          <div className="flex items-center gap-1 mt-1 text-xs text-text-tertiary">
            <Activity size={12} />
            <span>Combined utilities & services</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border-default bg-bg-secondary p-5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
            Total Active Subscriptions
          </span>
          <h2 className="mt-2 text-2xl font-bold tabular-nums text-accent">
            {recurringBills.filter((b) => b.is_active).length} Bills
          </h2>
          <div className="flex justify-between items-center mt-1 text-[11px] text-text-tertiary">
            <span>Inactive/Paused: {recurringBills.filter((b) => !b.is_active).length}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border-default bg-bg-secondary p-5 flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
            Calendar Filter
          </span>
          <p className="text-xs text-text-primary mt-1.5 font-medium">
            {selectedDay ? `Filtering bills due on Day ${selectedDay}` : "Showing all due dates"}
          </p>
          {selectedDay && (
            <button
              onClick={() => setSelectedDay(null)}
              className="text-[10px] text-accent font-semibold hover:underline mt-1 text-left"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Visual Due Calendar (Days grid) */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
              <CalendarIcon size={16} className="text-accent" />
              {monthName} Due Schedule
            </h3>
            <span className="text-[11px] text-text-tertiary">Select day to filter</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-text-tertiary border-b border-border-subtle pb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {/* Blank offset days */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`blank-${i}`} className="aspect-square bg-transparent rounded-lg" />
            ))}

            {/* Calendar Days */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const isSelected = selectedDay === day;
              const dueOnDay = recurringBills.filter((b) => b.is_active && b.due_day === day);

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`aspect-square rounded-xl flex flex-col justify-between p-1.5 border transition-all ${
                    isSelected
                      ? "bg-accent/15 border-accent text-accent"
                      : dueOnDay.length > 0
                      ? "bg-bg-tertiary/60 border-border-default hover:bg-bg-tertiary"
                      : "bg-bg-tertiary/20 border-transparent hover:bg-bg-tertiary/40"
                  }`}
                >
                  <span className={`text-[10px] font-bold ${isSelected ? "text-accent" : "text-text-primary"}`}>
                    {day}
                  </span>
                  <div className="flex flex-wrap gap-0.5 justify-end w-full">
                    {dueOnDay.slice(0, 3).map((bill) => (
                      <span
                        key={bill.id}
                        className="h-1.5 w-1.5 rounded-full bg-accent"
                        title={`${bill.name} ($${bill.amount})`}
                      />
                    ))}
                    {dueOnDay.length > 3 && (
                      <span className="text-[7px] font-black text-accent shrink-0">
                        +{dueOnDay.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Suggestion & Info Column */}
        <div className="space-y-6">
          {/* Smart Suggestions Box */}
          {suggestions.length > 0 && (
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 space-y-3">
              <h4 className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} />
                Smart Bills Detection
              </h4>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                We scanned your past bank deposits and detected recurring patterns. Link them as monthly bills?
              </p>
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {suggestions.map((sug, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center rounded-xl bg-bg-secondary border border-border-subtle p-2.5 text-[11px]"
                  >
                    <div>
                      <p className="font-semibold text-text-primary truncate max-w-[140px]">{sug.merchant_name}</p>
                      <p className="text-[9px] text-text-tertiary mt-0.5">Approx. {formatCurrencyPrecise(sug.amount)}/mo</p>
                    </div>
                    <button
                      onClick={() => handleAddSuggestion(sug)}
                      className="rounded bg-accent/15 px-2 py-1 text-[9px] font-bold text-accent hover:bg-accent/20 flex items-center gap-1"
                    >
                      <Check size={10} /> Link
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Bill List View */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
              {selectedDay ? `Due on Day ${selectedDay}` : "All Recurring Costs"}
            </h4>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {dueBills.length === 0 ? (
                <p className="text-xs text-text-tertiary italic">No bills due in this filter</p>
              ) : (
                dueBills.map((bill) => (
                  <div
                    key={bill.id}
                    className={`rounded-xl border border-border-default p-3 text-xs space-y-2 transition-opacity ${
                      bill.is_active ? "bg-bg-secondary" : "bg-bg-secondary/40 opacity-60"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} className="text-text-tertiary" />
                        <div>
                          <p className="font-semibold text-text-primary flex items-center gap-1">
                            {bill.name}
                            {!bill.is_active && (
                              <span className="text-[8px] bg-bg-tertiary px-1 rounded text-text-tertiary">
                                Paused
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-text-tertiary mt-0.5">
                            Due: Day {bill.due_day} • {bill.category_name ?? "Uncategorized"}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-text-primary tabular-nums">
                        {formatCurrencyPrecise(bill.amount)}
                      </span>
                    </div>

                    {bill.notes && <p className="text-[10px] text-text-tertiary italic">"{bill.notes}"</p>}

                    <div className="flex justify-end gap-2 border-t border-border-subtle pt-2 mt-2">
                      <button
                        onClick={() => openEditModal(bill)}
                        className="flex items-center gap-1 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
                      >
                        <Edit2 size={10} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(bill.id)}
                        className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-status-red transition-colors"
                      >
                        <Trash2 size={10} /> Delete
                      </button>
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
                {modalMode === "create" ? "Add Recurring Bill" : "Edit Recurring Bill"}
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
                <label className="text-xs font-medium text-text-secondary">Bill Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PGE Utility, Netflix subscription"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">Due Day (1-31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    placeholder="e.g. 15"
                    value={formDueDay}
                    onChange={(e) => setFormDueDay(e.target.value)}
                    className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">Frequency</label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value as RecurringBill["frequency"])}
                    className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-secondary">Category</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border-subtle pt-3">
                <span className="text-xs font-medium text-text-secondary">Bill Active status</span>
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formIsActive ? "bg-accent" : "bg-bg-tertiary border-border-default"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                      formIsActive ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Billing reference numbers, login details, pause terms..."
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
                  {saving ? "Saving..." : "Save Bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
