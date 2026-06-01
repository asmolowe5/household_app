"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, CategoryRule } from "@/modules/finance/types";
import { formatCurrencyPrecise } from "@/shared/lib/utils";
import {
  Plus,
  Tag,
  Trash2,
  Edit2,
  Check,
  X,
  Target,
  Wrench,
  Zap,
  Building,
  Shield,
  Briefcase,
  Play,
  Settings,
  Sparkles,
} from "lucide-react";

interface CategoriesClientProps {
  categories: Category[];
  rules: CategoryRule[];
}

const TAX_CATEGORIES = [
  "Rent / Mortgage",
  "Repairs & Maintenance",
  "Utilities",
  "Insurance",
  "Taxes (Property)",
  "Legal & Professional",
  "Management Fees",
  "Advertising",
  "Travel & Auto",
  "Supplies",
  "Other / Miscellaneous",
];

export function CategoriesClient({
  categories,
  rules,
}: CategoriesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Category Edit State
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editType, setEditType] = useState<Category["type"]>("discretionary");
  const [editTaxCategory, setEditTaxCategory] = useState("");

  // Add Category form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [newType, setNewType] = useState<Category["type"]>("discretionary");
  const [newTaxCategory, setNewTaxCategory] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Add Rule form state
  const [showAddRule, setShowAddRule] = useState(false);
  const [rulePattern, setRulePattern] = useState("");
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Save category updates
  async function handleSaveCategory(catId: string) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/finance/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: catId,
          name: editName,
          monthly_budget: parseFloat(editBudget) || 0,
          type: editType,
          tax_category: editTaxCategory || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update category");
      }

      setEditingCategoryId(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving updates");
    } finally {
      setSubmitting(false);
    }
  }

  const startEditing = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditName(cat.name);
    setEditBudget(String(cat.monthly_budget));
    setEditType(cat.type);
    setEditTaxCategory(cat.tax_category ?? "");
  };

  // Add category handler
  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setFormError("Name is required");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/finance/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          monthly_budget: parseFloat(newBudget) || 0,
          type: newType,
          tax_category: newTaxCategory || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create category");
      }

      setNewName("");
      setNewBudget("");
      setNewType("discretionary");
      setNewTaxCategory("");
      setShowAddModal(false);

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // Delete category handler
  async function handleDeleteCategory(catId: string) {
    if (!confirm("Are you sure you want to delete this category? Past logs will stay uncategorized.")) return;
    try {
      const res = await fetch("/api/finance/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: catId }),
      });

      if (!res.ok) throw new Error("Failed to delete category");

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting category");
    }
  }

  // Create mapping rule
  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!rulePattern.trim() || !ruleCategoryId) {
      setRuleError("Pattern and category are required");
      return;
    }

    setSubmitting(true);
    setRuleError(null);
    try {
      const res = await fetch("/api/finance/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: rulePattern.trim(),
          category_id: ruleCategoryId,
        }),
      });

      if (!res.ok) throw new Error("Failed to save mapping rule");

      setRulePattern("");
      setRuleCategoryId("");
      setShowAddRule(false);

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : "Error saving rule");
    } finally {
      setSubmitting(false);
    }
  }

  // Delete rule
  async function handleDeleteRule(ruleId: string) {
    try {
      const res = await fetch("/api/finance/rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ruleId }),
      });

      if (!res.ok) throw new Error("Failed to delete rule");

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting rule");
    }
  }

  // Calculate tax rolled budgets
  const taxRollups = categories.reduce((acc, cat) => {
    const taxCat = cat.tax_category || "Unassigned / Personal";
    const budgetVal = cat.monthly_budget || 0;
    acc[taxCat] = (acc[taxCat] || 0) + budgetVal;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            Category Budgets & Rules
          </h1>
          <p className="text-xs text-text-tertiary mt-1">
            Manage your budget limits, tax classifications, and Plaid auto-categorization mapping rules
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-slate-950 transition-opacity hover:opacity-90"
        >
          <Plus size={14} />
          Add Category
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Categories List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border-default bg-bg-secondary p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Settings size={15} className="text-text-secondary" />
              Budget Categories
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-text-primary border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-text-tertiary uppercase font-bold text-[10px] tracking-wider">
                    <th className="pb-3 pr-2">Category Name</th>
                    <th className="pb-3 pr-2">Monthly Budget</th>
                    <th className="pb-3 pr-2">Type</th>
                    <th className="pb-3 pr-2">Tax Category</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {categories.map((cat) => {
                    const isEditing = editingCategoryId === cat.id;

                    return (
                      <tr key={cat.id} className="hover:bg-bg-tertiary/20">
                        {isEditing ? (
                          <>
                            <td className="py-2.5 pr-2">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full max-w-xs rounded-lg border border-border-default bg-bg-tertiary px-2.5 py-1 text-xs text-text-primary focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 pr-2">
                              <input
                                type="number"
                                value={editBudget}
                                onChange={(e) => setEditBudget(e.target.value)}
                                className="w-20 rounded-lg border border-border-default bg-bg-tertiary px-2.5 py-1 text-xs text-text-primary focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 pr-2">
                              <select
                                value={editType}
                                onChange={(e) => setEditType(e.target.value as Category["type"])}
                                className="rounded-lg border border-border-default bg-bg-tertiary px-2 py-1 text-xs text-text-primary focus:outline-none"
                              >
                                <option value="discretionary">Discretionary</option>
                                <option value="fixed">Fixed</option>
                              </select>
                            </td>
                            <td className="py-2.5 pr-2">
                              <select
                                value={editTaxCategory}
                                onChange={(e) => setEditTaxCategory(e.target.value)}
                                className="w-full max-w-[150px] rounded-lg border border-border-default bg-bg-tertiary px-2 py-1 text-xs text-text-primary focus:outline-none"
                              >
                                <option value="">Personal / Unassigned</option>
                                {TAX_CATEGORIES.map((tax) => (
                                  <option key={tax} value={tax}>
                                    {tax}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2.5 text-right flex justify-end gap-1.5 mt-0.5">
                              <button
                                onClick={() => handleSaveCategory(cat.id)}
                                disabled={submitting}
                                className="text-status-green hover:bg-status-green/10 p-1 rounded transition-colors"
                                title="Save"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setEditingCategoryId(null)}
                                className="text-text-tertiary hover:bg-bg-tertiary p-1 rounded transition-colors"
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 font-semibold pr-2">{cat.name}</td>
                            <td className="py-3 pr-2 tabular-nums">
                              {formatCurrencyPrecise(cat.monthly_budget)}
                            </td>
                            <td className="py-3 pr-2 capitalize text-text-secondary">
                              {cat.type}
                            </td>
                            <td className="py-3 pr-2">
                              {cat.tax_category ? (
                                <span className="inline-block rounded-md bg-accent/10 px-2 py-0.5 text-[10px] text-accent font-semibold border border-accent/20">
                                  {cat.tax_category}
                                </span>
                              ) : (
                                <span className="text-text-tertiary italic">Personal</span>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => startEditing(cat)}
                                  className="text-text-tertiary hover:text-text-primary p-1 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteCategory(cat.id)}
                                  className="text-status-red hover:bg-status-red/10 p-1 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rules Manager Card */}
          <div className="rounded-2xl border border-border-default bg-bg-secondary p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Tag size={15} className="text-text-secondary" />
                Merchant Mapping Rules (Plaid)
              </h2>
              <button
                onClick={() => setShowAddRule(!showAddRule)}
                className="flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-tertiary/50 px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                <Plus size={12} />
                Add Rule
              </button>
            </div>

            {showAddRule && (
              <form onSubmit={handleAddRule} className="p-4 rounded-xl bg-bg-tertiary/20 border border-border-subtle grid gap-3 sm:grid-cols-3 items-end">
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
                    Merchant Name Contains
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. netflix"
                    value={rulePattern}
                    onChange={(e) => setRulePattern(e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-bg-tertiary px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
                    Map to Category
                  </label>
                  <select
                    value={ruleCategoryId}
                    onChange={(e) => setRuleCategoryId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-border-default bg-bg-tertiary px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="">Select category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => setShowAddRule(false)}
                    className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-bg-tertiary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-slate-950 hover:opacity-90 disabled:opacity-50"
                  >
                    Save Rule
                  </button>
                </div>
                {ruleError && (
                  <p className="text-[10px] text-status-red sm:col-span-3 mt-1">{ruleError}</p>
                )}
              </form>
            )}

            {rules.length === 0 ? (
              <p className="text-xs text-text-tertiary italic py-6 text-center border border-dashed border-border-default rounded-xl bg-bg-tertiary/10">
                No custom merchant rules defined yet. System will auto-create rules when you edit categories in transaction detail view.
              </p>
            ) : (
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                {rules.map((rule) => {
                  const mappedCat = categories.find((c) => c.id === rule.category_id);
                  return (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-tertiary/20 p-3 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-semibold text-text-primary block truncate">
                          "{rule.pattern}"
                        </span>
                        <span className="text-[10px] text-text-tertiary block mt-0.5">
                          maps to: <strong className="text-text-secondary font-medium">{mappedCat?.name ?? "Unknown"}</strong>
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-text-tertiary hover:text-status-red p-1.5 rounded-lg hover:bg-status-red/10 transition-colors"
                        title="Delete Rule"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tax Categories Summary */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-border-default bg-bg-secondary p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Target size={15} className="text-accent" />
              Tax Budget Rollup
            </h2>
            <p className="text-[11px] text-text-tertiary">
              Below is the sum of your monthly budgets grouped by their assigned tax classifications.
            </p>

            <div className="border-t border-border-subtle/50 my-2" />

            <div className="space-y-3.5 pt-1">
              {Object.entries(taxRollups).map(([taxCat, amount]) => {
                const totalRollupBudget = categories.reduce((sum, c) => sum + (c.monthly_budget || 0), 0);
                const percent = totalRollupBudget > 0 ? (amount / totalRollupBudget) * 100 : 0;

                return (
                  <div key={taxCat} className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-text-secondary">
                      <span className="truncate">{taxCat}</span>
                      <span className="tabular-nums">{formatCurrencyPrecise(amount)}</span>
                    </div>
                    {/* Tiny progress visualizer */}
                    <div className="h-1 w-full rounded-full bg-bg-tertiary overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />

          <div className="relative w-full max-w-sm rounded-2xl bg-bg-secondary border border-border-default p-6 shadow-2xl space-y-4 text-xs font-medium">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <Sparkles size={16} className="text-accent" />
                Add Custom Category
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <p className="text-[10px] text-status-red bg-status-red/10 border border-status-red/20 rounded-lg p-2">
                {formError}
              </p>
            )}

            <form onSubmit={handleAddCategory} className="space-y-4 text-xs">
              <div>
                <label className="block text-text-tertiary mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HOA Fees, Property Tax"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-text-tertiary mb-1">Monthly Budget Limit ($)</label>
                <input
                  type="number"
                  placeholder="200"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-text-tertiary mb-1">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as Category["type"])}
                  className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none"
                >
                  <option value="discretionary">Discretionary</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>

              <div>
                <label className="block text-text-tertiary mb-1">Tax Category Alignment</label>
                <select
                  value={newTaxCategory}
                  onChange={(e) => setNewTaxCategory(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none"
                >
                  <option value="">Personal / Unassigned</option>
                  {TAX_CATEGORIES.map((tax) => (
                    <option key={tax} value={tax}>
                      {tax}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-border-default py-2 text-xs font-semibold text-text-secondary hover:bg-bg-tertiary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-accent py-2 text-xs font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Add Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
