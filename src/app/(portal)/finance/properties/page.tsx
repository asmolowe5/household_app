import { getAccounts, getCategories, getProperties } from "@/modules/finance/queries";
import { FinancesEmptyState } from "@/modules/finance/components/empty-state";
import { PropertiesClient } from "@/modules/finance/components/properties-client";
import { db } from "@/db";
import { transactions, categories } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import type { Transaction } from "@/modules/finance/types";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const accountsList = await getAccounts();
  const categoryList = await getCategories();
  const propertyList = await getProperties();

  if (accountsList.length === 0) {
    return <FinancesEmptyState />;
  }

  // Fetch all transactions with categories to calculate property stats
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
      propertyId: transactions.propertyId,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.portalCategoryId, categories.id))
    .orderBy(desc(transactions.date));

  const txnData: Transaction[] = rows.map((r) => ({
    id: r.id,
    date: r.date,
    amount: Number(r.amount),
    merchant_name: r.merchantName,
    transaction_type: r.transactionType as Transaction["transaction_type"],
    is_reviewed: r.isReviewed ?? false,
    category_name: r.categoryName ?? null,
    category_icon: r.categoryIcon ?? null,
    notes: r.notes ?? null,
    property_id: r.propertyId,
  }));

  return (
    <Suspense fallback={<div className="text-xs text-text-tertiary">Loading property dashboard...</div>}>
      <PropertiesClient
        properties={propertyList}
        transactions={txnData}
        categories={categoryList}
      />
    </Suspense>
  );
}
