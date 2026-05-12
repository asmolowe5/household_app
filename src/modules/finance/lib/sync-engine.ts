import { db } from "@/db";
import { transactions, accounts, plaidItems } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { plaidClient } from "./plaid-client";
import { mapTransaction } from "./category-mapper";
import { getCategories, getCategoryRules } from "@/modules/finance/queries";
import type { RemovedTransaction } from "plaid";

export async function syncPlaidItem(
  plaidItemDbId: string,
  accessToken: string,
  cursor: string | null,
): Promise<{ added: number; modified: number; removed: number; newCursor: string }> {
  const cats = await getCategories();
  const rules = await getCategoryRules();

  let currentCursor = cursor ?? "";
  let hasMore = true;
  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor: currentCursor || undefined,
    });

    const { added, modified, removed, next_cursor, has_more } = response.data;

    for (const txn of added) {
      const plaidPrimary = txn.personal_finance_category?.primary ?? null;
      const plaidDetailed = txn.personal_finance_category?.detailed ?? null;
      const mapped = mapTransaction(
        txn.merchant_name ?? txn.name,
        plaidPrimary,
        plaidDetailed,
        cats,
        rules,
      );

      const [account] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.plaidAccountId, txn.account_id))
        .limit(1);

      if (!account) continue;

      await db
        .insert(transactions)
        .values({
          accountId: account.id,
          plaidTransactionId: txn.transaction_id,
          date: txn.date,
          amount: String(Math.abs(txn.amount)),
          merchantName: txn.merchant_name ?? txn.name,
          plaidCategory: txn.personal_finance_category
            ? [txn.personal_finance_category.primary, txn.personal_finance_category.detailed].filter(Boolean)
            : [],
          portalCategoryId: mapped.categoryId,
          transactionType: mapped.transactionType,
          isReviewed: mapped.isReviewed,
        })
        .onConflictDoUpdate({
          target: transactions.plaidTransactionId,
          set: {
            date: txn.date,
            amount: String(Math.abs(txn.amount)),
            merchantName: txn.merchant_name ?? txn.name,
            portalCategoryId: mapped.categoryId,
            transactionType: mapped.transactionType,
            isReviewed: mapped.isReviewed,
          },
        });
    }
    totalAdded += added.length;

    for (const txn of modified) {
      await db
        .update(transactions)
        .set({
          date: txn.date,
          amount: String(Math.abs(txn.amount)),
          merchantName: txn.merchant_name ?? txn.name,
        })
        .where(eq(transactions.plaidTransactionId, txn.transaction_id));
    }
    totalModified += modified.length;

    const removedIds = removed.map((r: RemovedTransaction) => r.transaction_id);
    if (removedIds.length > 0) {
      await db
        .delete(transactions)
        .where(inArray(transactions.plaidTransactionId, removedIds));
    }
    totalRemoved += removed.length;

    currentCursor = next_cursor;
    hasMore = has_more;
  }

  await db
    .update(plaidItems)
    .set({ cursor: currentCursor, lastSyncedAt: new Date() })
    .where(eq(plaidItems.id, plaidItemDbId));

  try {
    const balanceResponse = await plaidClient.accountsGet({ access_token: accessToken });
    for (const acct of balanceResponse.data.accounts) {
      await db
        .update(accounts)
        .set({
          currentBalance: acct.balances.current != null ? String(acct.balances.current) : null,
          availableBalance: acct.balances.available != null ? String(acct.balances.available) : null,
          lastBalanceUpdate: new Date(),
        })
        .where(eq(accounts.plaidAccountId, acct.account_id));
    }
  } catch {
    // Balance update is best-effort
  }

  return {
    added: totalAdded,
    modified: totalModified,
    removed: totalRemoved,
    newCursor: currentCursor,
  };
}
