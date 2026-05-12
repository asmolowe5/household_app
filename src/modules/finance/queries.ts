import { db } from "@/db";
import { accounts, categories, categoryRules, transactions } from "@/db/schema";
import { plaidItems } from "@/db/schema";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import type { Account, Transaction, Category, CategorySpend, MonthSummary, CategoryRule } from "./types";

export async function getAccounts(): Promise<Account[]> {
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      officialName: accounts.officialName,
      type: accounts.type,
      subtype: accounts.subtype,
      currentBalance: accounts.currentBalance,
      availableBalance: accounts.availableBalance,
      institutionName: plaidItems.institutionName,
      lastSyncedAt: plaidItems.lastSyncedAt,
    })
    .from(accounts)
    .leftJoin(plaidItems, eq(accounts.plaidItemId, plaidItems.id))
    .orderBy(accounts.type, accounts.name);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    official_name: r.officialName,
    type: r.type,
    subtype: r.subtype,
    current_balance: r.currentBalance ? Number(r.currentBalance) : null,
    available_balance: r.availableBalance ? Number(r.availableBalance) : null,
    institution_name: r.institutionName ?? "Unknown",
    last_synced_at: r.lastSyncedAt?.toISOString() ?? null,
  }));
}

export async function getRecentTransactions(limit = 15): Promise<Transaction[]> {
  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      merchantName: transactions.merchantName,
      transactionType: transactions.transactionType,
      isReviewed: transactions.isReviewed,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.portalCategoryId, categories.id))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    amount: Number(r.amount),
    merchant_name: r.merchantName,
    transaction_type: r.transactionType as Transaction["transaction_type"],
    is_reviewed: r.isReviewed ?? false,
    category_name: r.categoryName ?? null,
    category_icon: r.categoryIcon ?? null,
  }));
}

export async function getCategories(): Promise<Category[]> {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(categories.sortOrder);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    monthly_budget: Number(r.monthlyBudget),
    type: r.type as Category["type"],
    sort_order: r.sortOrder ?? 0,
    icon: r.icon,
    is_active: r.isActive ?? true,
    is_temporary: r.isTemporary ?? false,
  }));
}

interface RawTransaction {
  amount: number;
  portal_category_id: string | null;
  transaction_type: string;
}

export async function getMonthExpenses(
  startDate: string,
  endDate: string,
): Promise<RawTransaction[]> {
  const rows = await db
    .select({
      amount: transactions.amount,
      portalCategoryId: transactions.portalCategoryId,
      transactionType: transactions.transactionType,
    })
    .from(transactions)
    .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)));

  return rows.map((r) => ({
    amount: Number(r.amount),
    portal_category_id: r.portalCategoryId,
    transaction_type: r.transactionType ?? "expense",
  }));
}

export function buildCategorySpend(
  cats: Category[],
  txns: RawTransaction[],
): CategorySpend[] {
  const spendMap = new Map<string, number>();

  for (const txn of txns) {
    if (txn.transaction_type !== "expense" || !txn.portal_category_id) continue;
    const current = spendMap.get(txn.portal_category_id) ?? 0;
    spendMap.set(txn.portal_category_id, current + Math.abs(txn.amount));
  }

  return cats.map((cat) => ({
    ...cat,
    total_spent: spendMap.get(cat.id) ?? 0,
  }));
}

export function buildMonthSummary(
  cats: Category[],
  txns: RawTransaction[],
): MonthSummary {
  let totalSpent = 0;
  let totalIncome = 0;

  for (const txn of txns) {
    if (txn.transaction_type === "expense") {
      totalSpent += Math.abs(txn.amount);
    } else if (txn.transaction_type === "income") {
      totalIncome += Math.abs(txn.amount);
    }
  }

  const totalBudget = cats.reduce((sum, cat) => sum + cat.monthly_budget, 0);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();

  return { total_spent: totalSpent, total_budget: totalBudget, total_income: totalIncome, days_elapsed: daysElapsed, days_in_month: daysInMonth };
}

export async function getCategoryRules(): Promise<CategoryRule[]> {
  const rows = await db
    .select({
      id: categoryRules.id,
      pattern: categoryRules.pattern,
      categoryId: categoryRules.categoryId,
      source: categoryRules.source,
    })
    .from(categoryRules);

  return rows.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    category_id: r.categoryId,
    source: r.source as "user" | "ai",
  }));
}

export async function upsertCategoryRule(
  pattern: string,
  categoryId: string,
): Promise<void> {
  await db
    .insert(categoryRules)
    .values({ pattern: pattern.toLowerCase(), categoryId, source: "user" })
    .onConflictDoUpdate({
      target: categoryRules.pattern,
      set: { categoryId, source: "user" },
    });
}

export async function getReviewCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(eq(transactions.isReviewed, false));

  return Number(result[0]?.count ?? 0);
}

export async function updateTransaction(
  id: string,
  updates: {
    portal_category_id?: string | null;
    transaction_type?: string;
    notes?: string;
    is_reviewed?: boolean;
  },
): Promise<void> {
  const setValues: Record<string, unknown> = {};
  if (updates.portal_category_id !== undefined) setValues.portalCategoryId = updates.portal_category_id;
  if (updates.transaction_type !== undefined) setValues.transactionType = updates.transaction_type;
  if (updates.notes !== undefined) setValues.notes = updates.notes;
  if (updates.is_reviewed !== undefined) setValues.isReviewed = updates.is_reviewed;

  await db.update(transactions).set(setValues).where(eq(transactions.id, id));
}
