import { db } from "@/db";
import { accounts, categories, categoryRules, transactions, properties, transactionSplits, assetsLiabilities, netWorthSnapshots, recurringBills, savingsGoals } from "@/db/schema";
import { plaidItems } from "@/db/schema";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import type { Account, Transaction, Category, CategorySpend, MonthSummary, CategoryRule, Property, TransactionSplit, AssetLiability, NetWorthSnapshot, RecurringBill, SavingsGoal } from "./types";

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
      customName: accounts.customName,
      isVisible: accounts.isVisible,
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
    custom_name: r.customName,
    is_visible: r.isVisible,
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
      accountId: transactions.accountId,
      propertyId: transactions.propertyId,
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
    account_id: r.accountId,
    property_id: r.propertyId,
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
    tax_category: r.taxCategory,
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
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        eq(accounts.isVisible, true)
      )
    );

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
    property_id?: string | null;
  },
): Promise<void> {
  const setValues: Record<string, unknown> = {};
  if (updates.portal_category_id !== undefined) setValues.portalCategoryId = updates.portal_category_id;
  if (updates.transaction_type !== undefined) setValues.transactionType = updates.transaction_type;
  if (updates.notes !== undefined) setValues.notes = updates.notes;
  if (updates.is_reviewed !== undefined) setValues.isReviewed = updates.is_reviewed;
  if (updates.property_id !== undefined) setValues.propertyId = updates.property_id;

  await db.update(transactions).set(setValues).where(eq(transactions.id, id));
}

export async function updateAccountSettings(
  id: string,
  updates: {
    custom_name?: string | null;
    is_visible?: boolean;
  },
): Promise<void> {
  const setValues: Record<string, unknown> = {};
  if (updates.custom_name !== undefined) setValues.customName = updates.custom_name;
  if (updates.is_visible !== undefined) setValues.isVisible = updates.is_visible;

  await db.update(accounts).set(setValues).where(eq(accounts.id, id));
}

export async function getProperties(): Promise<Property[]> {
  const rows = await db
    .select()
    .from(properties)
    .where(eq(properties.isActive, true))
    .orderBy(desc(properties.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    monthly_rent_target: Number(r.monthlyRentTarget ?? 0),
    is_active: r.isActive ?? true,
    notes: r.notes,
    tenant_name: r.tenantName,
    lease_start: r.leaseStart,
    lease_end: r.leaseEnd,
    security_deposit: r.securityDeposit ? Number(r.securityDeposit) : 0,
    monthly_mortgage: r.monthlyMortgage ? Number(r.monthlyMortgage) : 0,
    monthly_insurance: r.monthlyInsurance ? Number(r.monthlyInsurance) : 0,
    monthly_taxes: r.monthlyTaxes ? Number(r.monthlyTaxes) : 0,
    monthly_hoa: r.monthlyHoa ? Number(r.monthlyHoa) : 0,
    created_at: r.createdAt?.toISOString(),
  }));
}

export async function getPropertyTransactions(propertyId: string): Promise<Transaction[]> {
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
      accountId: transactions.accountId,
      notes: transactions.notes,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.portalCategoryId, categories.id))
    .where(eq(transactions.propertyId, propertyId))
    .orderBy(desc(transactions.date));

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    amount: Number(r.amount),
    merchant_name: r.merchantName,
    transaction_type: r.transactionType as Transaction["transaction_type"],
    is_reviewed: r.isReviewed ?? false,
    category_name: r.categoryName ?? null,
    category_icon: r.categoryIcon ?? null,
    account_id: r.accountId,
    property_id: propertyId,
    notes: r.notes,
  }));
}

export async function getTransactionSplits(parentTransactionId: string): Promise<TransactionSplit[]> {
  const rows = await db
    .select({
      id: transactionSplits.id,
      parentTransactionId: transactionSplits.parentTransactionId,
      amount: transactionSplits.amount,
      portalCategoryId: transactionSplits.portalCategoryId,
      propertyId: transactionSplits.propertyId,
      notes: transactionSplits.notes,
      categoryName: categories.name,
      propertyName: properties.name,
    })
    .from(transactionSplits)
    .leftJoin(categories, eq(transactionSplits.portalCategoryId, categories.id))
    .leftJoin(properties, eq(transactionSplits.propertyId, properties.id))
    .where(eq(transactionSplits.parentTransactionId, parentTransactionId));

  return rows.map((r) => ({
    id: r.id,
    parent_transaction_id: r.parentTransactionId,
    amount: Number(r.amount),
    portal_category_id: r.portalCategoryId,
    property_id: r.propertyId,
    notes: r.notes,
    category_name: r.categoryName,
    property_name: r.propertyName,
  }));
}

export async function saveTransactionSplits(
  parentTransactionId: string,
  splits: { amount: number; portal_category_id: string | null; property_id: string | null; notes: string | null }[]
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(transactionSplits).where(eq(transactionSplits.parentTransactionId, parentTransactionId));

    if (splits.length > 0) {
      await tx.insert(transactionSplits).values(
        splits.map((s) => ({
          parentTransactionId,
          amount: String(s.amount),
          portalCategoryId: s.portal_category_id,
          propertyId: s.property_id,
          notes: s.notes,
        }))
      );
    }
  });
}

export async function getAllTransactionSplits(): Promise<TransactionSplit[]> {
  const rows = await db
    .select({
      id: transactionSplits.id,
      parentTransactionId: transactionSplits.parentTransactionId,
      amount: transactionSplits.amount,
      portalCategoryId: transactionSplits.portalCategoryId,
      propertyId: transactionSplits.propertyId,
      notes: transactionSplits.notes,
      categoryName: categories.name,
      propertyName: properties.name,
    })
    .from(transactionSplits)
    .leftJoin(categories, eq(transactionSplits.portalCategoryId, categories.id))
    .leftJoin(properties, eq(transactionSplits.propertyId, properties.id));

  return rows.map((r) => ({
    id: r.id,
    parent_transaction_id: r.parentTransactionId,
    amount: Number(r.amount),
    portal_category_id: r.portalCategoryId,
    property_id: r.propertyId,
    notes: r.notes,
    category_name: r.categoryName,
    property_name: r.propertyName,
  }));
}

export async function getAssetsLiabilities(): Promise<AssetLiability[]> {
  const rows = await db.select().from(assetsLiabilities).orderBy(desc(assetsLiabilities.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    value: Number(r.value),
    type: r.type as AssetLiability["type"],
    notes: r.notes,
    property_id: r.propertyId,
    updated_at: r.updatedAt?.toISOString(),
    created_at: r.createdAt?.toISOString(),
  }));
}

export async function getNetWorthSnapshots(): Promise<NetWorthSnapshot[]> {
  const rows = await db.select().from(netWorthSnapshots).orderBy(netWorthSnapshots.date);
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    total_assets: Number(r.totalAssets),
    total_liabilities: Number(r.totalLiabilities),
    net_worth: Number(r.netWorth),
  }));
}

export async function logNetWorthSnapshot(
  date: string,
  totalAssets: number,
  totalLiabilities: number
): Promise<void> {
  const netWorth = totalAssets - totalLiabilities;
  await db
    .insert(netWorthSnapshots)
    .values({
      date,
      totalAssets: String(totalAssets),
      totalLiabilities: String(totalLiabilities),
      netWorth: String(netWorth),
    })
    .onConflictDoUpdate({
      target: netWorthSnapshots.date,
      set: {
        totalAssets: String(totalAssets),
        totalLiabilities: String(totalLiabilities),
        netWorth: String(netWorth),
      },
    });
}

export async function getRecurringBills(): Promise<RecurringBill[]> {
  const rows = await db
    .select({
      id: recurringBills.id,
      name: recurringBills.name,
      amount: recurringBills.amount,
      frequency: recurringBills.frequency,
      dueDay: recurringBills.dueDay,
      portalCategoryId: recurringBills.portalCategoryId,
      notes: recurringBills.notes,
      isActive: recurringBills.isActive,
      lastPaidDate: recurringBills.lastPaidDate,
      createdAt: recurringBills.createdAt,
      categoryName: categories.name,
    })
    .from(recurringBills)
    .leftJoin(categories, eq(recurringBills.portalCategoryId, categories.id))
    .orderBy(recurringBills.dueDay);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    frequency: r.frequency as RecurringBill["frequency"],
    due_day: r.dueDay,
    portal_category_id: r.portalCategoryId,
    notes: r.notes,
    is_active: r.isActive,
    last_paid_date: r.lastPaidDate,
    category_name: r.categoryName,
    created_at: r.createdAt?.toISOString(),
  }));
}

export async function detectRecurringSuggestions(): Promise<{ merchant_name: string; amount: number; portal_category_id: string | null }[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 120);
  const cutoffString = cutoffDate.toISOString().split("T")[0];

  const txns = await db
    .select({
      merchantName: transactions.merchantName,
      amount: transactions.amount,
      date: transactions.date,
      portalCategoryId: transactions.portalCategoryId,
    })
    .from(transactions)
    .where(gte(transactions.date, cutoffString))
    .orderBy(transactions.merchantName, transactions.date);

  const merchantGroups = new Map<string, { date: string; amount: number; catId: string | null }[]>();
  for (const t of txns) {
    if (!t.merchantName) continue;
    const current = merchantGroups.get(t.merchantName) ?? [];
    current.push({ date: t.date, amount: Number(t.amount), catId: t.portalCategoryId });
    merchantGroups.set(t.merchantName, current);
  }

  const suggestions: { merchant_name: string; amount: number; portal_category_id: string | null }[] = [];

  for (const [name, dates] of merchantGroups.entries()) {
    if (dates.length < 2) continue;
    let intervalsOfMonth = 0;
    let avgAmount = 0;
    let countOfIntervals = 0;

    for (let i = 1; i < dates.length; i++) {
      const d1 = new Date(dates[i - 1].date);
      const d2 = new Date(dates[i].date);
      const diffDays = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= 25 && diffDays <= 35) {
        intervalsOfMonth++;
        avgAmount += dates[i].amount;
        countOfIntervals++;
      }
    }

    if (intervalsOfMonth >= 1) {
      suggestions.push({
        merchant_name: name,
        amount: Math.abs(avgAmount / countOfIntervals),
        portal_category_id: dates[dates.length - 1].catId,
      });
    }
  }

  return suggestions;
}

export async function getSavingsGoals(): Promise<SavingsGoal[]> {
  const rows = await db
    .select({
      id: savingsGoals.id,
      name: savingsGoals.name,
      targetAmount: savingsGoals.targetAmount,
      currentAmount: savingsGoals.currentAmount,
      targetDate: savingsGoals.targetDate,
      notes: savingsGoals.notes,
      isCompleted: savingsGoals.isCompleted,
      accountId: savingsGoals.accountId,
      createdAt: savingsGoals.createdAt,
      accountName: accounts.name,
      accountCustomName: accounts.customName,
    })
    .from(savingsGoals)
    .leftJoin(accounts, eq(savingsGoals.accountId, accounts.id))
    .orderBy(savingsGoals.targetDate);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    target_amount: Number(r.targetAmount),
    current_amount: Number(r.currentAmount),
    target_date: r.targetDate,
    notes: r.notes,
    is_completed: r.isCompleted,
    account_id: r.accountId,
    account_name: r.accountCustomName ?? r.accountName ?? null,
    created_at: r.createdAt?.toISOString(),
  }));
}
