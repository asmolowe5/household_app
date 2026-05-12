import { getAccounts, getReviewCount } from "@/modules/finance/queries";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { categories } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import type { Account, Transaction } from "@/modules/finance/types";

export async function getFinanceAccounts(): Promise<Account[]> {
  return getAccounts();
}

export async function getFinanceTransactions(limit = 15): Promise<Transaction[]> {
  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      merchantName: transactions.merchantName,
      transactionType: transactions.transactionType,
      isReviewed: transactions.isReviewed,
      accountId: transactions.accountId,
      plaidTransactionId: transactions.plaidTransactionId,
      plaidCategory: transactions.plaidCategory,
      portalCategoryId: transactions.portalCategoryId,
      isAnomaly: transactions.isAnomaly,
      projectId: transactions.projectId,
      notes: transactions.notes,
      createdAt: transactions.createdAt,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.portalCategoryId, categories.id))
    .orderBy(desc(transactions.date))
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
    category: r.categoryName ? { id: r.portalCategoryId!, name: r.categoryName, monthly_budget: 0, type: "discretionary" as const, sort_order: 0, icon: r.categoryIcon } : undefined,
  }));
}

export async function getFinanceReviewCount(): Promise<number> {
  return getReviewCount();
}
