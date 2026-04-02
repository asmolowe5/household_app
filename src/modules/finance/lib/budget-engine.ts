import type {
  Category,
  CategoryBudgetStatus,
  BudgetSummary,
  PaceStatus,
  Transaction,
  Account,
} from "@/modules/finance/types";
import { PACE_THRESHOLDS } from "@/shared/lib/constants";

export function calculatePaceStatus(percentUsed: number, percentOfMonth: number): PaceStatus {
  if (percentUsed >= 100) return "red";
  if (percentOfMonth === 0) return percentUsed > 0 ? "orange" : "green";

  const paceRatio = percentUsed / (percentOfMonth * 100);
  if (paceRatio <= PACE_THRESHOLDS.GREEN_MAX) return "green";
  if (paceRatio <= PACE_THRESHOLDS.YELLOW_MAX) return "yellow";
  return "orange";
}

export function calculateCategoryBudget(
  category: Category,
  transactions: Transaction[],
  percentOfMonth: number
): CategoryBudgetStatus {
  const spent = transactions
    .filter((t) => t.portal_category_id === category.id && t.transaction_type === "expense")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const budgeted = category.monthly_budget;
  const remaining = Math.max(budgeted - spent, 0);
  const percentUsed = budgeted > 0 ? (spent / budgeted) * 100 : 0;
  const paceRatio = percentOfMonth > 0 ? (percentUsed / 100) / percentOfMonth : 0;
  const status = calculatePaceStatus(percentUsed, percentOfMonth);
  const projectedMonthEnd = percentOfMonth > 0 ? spent / percentOfMonth : spent;

  return {
    category,
    spent,
    budgeted,
    remaining,
    percentUsed,
    paceRatio,
    status,
    projectedMonthEnd,
  };
}

export function calculateBudgetSummary(
  categories: Category[],
  transactions: Transaction[],
  accounts: Account[],
  now: Date = new Date()
): BudgetSummary {
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const percentOfMonth = dayOfMonth / daysInMonth;
  const daysRemaining = daysInMonth - dayOfMonth;

  const discretionary = categories.filter((c) => c.type === "discretionary" && c.is_active);
  const categoryStatuses = discretionary.map((c) =>
    calculateCategoryBudget(c, transactions, percentOfMonth)
  );

  const statusOrder: Record<PaceStatus, number> = { red: 0, orange: 1, yellow: 2, green: 3 };
  categoryStatuses.sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.category.sort_order - b.category.sort_order;
  });

  const totalBudgeted = categoryStatuses.reduce((s, c) => s + c.budgeted, 0);
  const totalSpent = categoryStatuses.reduce((s, c) => s + c.spent, 0);
  const totalRemaining = Math.max(totalBudgeted - totalSpent, 0);
  const overallPercentUsed = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const overallPaceRatio = percentOfMonth > 0 ? (overallPercentUsed / 100) / percentOfMonth : 0;
  const overallStatus = calculatePaceStatus(overallPercentUsed, percentOfMonth);
  const dailyAllowance = daysRemaining > 0 ? totalRemaining / daysRemaining : 0;

  const incomeThisMonth = transactions
    .filter((t) => t.transaction_type === "income")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const savingsThisMonth = transactions
    .filter((t) => t.transaction_type === "savings_transfer")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const savingsAccount = accounts.find(
    (a) => a.subtype === "savings" || a.name.toLowerCase().includes("savings")
  );

  return {
    totalBudgeted,
    totalSpent,
    totalRemaining,
    overallPaceRatio,
    overallStatus,
    dayOfMonth,
    daysInMonth,
    percentOfMonth,
    dailyAllowance,
    categories: categoryStatuses,
    incomeThisMonth,
    savingsThisMonth,
    savingsBalance: savingsAccount?.current_balance ?? null,
  };
}
