import { getAccounts, getCategories, getReviewCount } from "@/modules/finance/queries";
import { db } from "@/db";
import { transactions, categories, accounts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import type { Transaction } from "@/modules/finance/types";
import { TransactionsListPageClient } from "@/modules/finance/components/transactions-list-page-client";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const accountList = await getAccounts();
  const categoryList = await getCategories();
  const reviewCount = await getReviewCount();

  // Fetch all transactions with categories and account information
  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      merchantName: transactions.merchantName,
      transactionType: transactions.transactionType,
      isReviewed: transactions.isReviewed,
      notes: transactions.notes,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      accountName: accounts.name,
      accountCustomName: accounts.customName,
      accountId: accounts.id,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.portalCategoryId, categories.id))
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));

  const txnData: (Transaction & { account_name: string; account_id: string; notes: string | null })[] = rows.map((r) => ({
    id: r.id,
    date: r.date,
    amount: Number(r.amount),
    merchant_name: r.merchantName,
    transaction_type: r.transactionType as Transaction["transaction_type"],
    is_reviewed: r.isReviewed ?? false,
    category_name: r.categoryName ?? null,
    category_icon: r.categoryIcon ?? null,
    account_name: r.accountCustomName ?? r.accountName,
    account_id: r.accountId,
    notes: r.notes ?? null,
  }));

  return (
    <Suspense fallback={<div className="text-xs text-text-tertiary">Loading transactions...</div>}>
      <TransactionsListPageClient
        transactions={txnData}
        accounts={accountList}
        categories={categoryList}
        reviewCount={reviewCount}
      />
    </Suspense>
  );
}
