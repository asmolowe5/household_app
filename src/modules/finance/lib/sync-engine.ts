import { db } from "@/db";
import { transactions, accounts, plaidItems } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { plaidClient } from "./plaid-client";
import { mapTransaction } from "./category-mapper";
import { getCategories, getCategoryRules } from "@/modules/finance/queries";
import { categorizeTransactionsWithAIBatch } from "./ai-categorizer";
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

    // 1. Optimize Accounts Lookup (Avoid N+1 queries)
    const plaidAccountIds = Array.from(new Set(added.map((t) => t.account_id)));
    const matchedAccounts = plaidAccountIds.length > 0
      ? await db
          .select({ id: accounts.id, plaidAccountId: accounts.plaidAccountId })
          .from(accounts)
          .where(inArray(accounts.plaidAccountId, plaidAccountIds))
      : [];

    const accountMap = new Map<string, string>();
    for (const acc of matchedAccounts) {
      if (acc.plaidAccountId) {
        accountMap.set(acc.plaidAccountId, acc.id);
      }
    }

    // 2. Map Transactions with Rules
    const mappedTxns = added.map((txn) => {
      const dbAccountId = accountMap.get(txn.account_id);
      if (!dbAccountId) return null;

      const plaidPrimary = txn.personal_finance_category?.primary ?? null;
      const plaidDetailed = txn.personal_finance_category?.detailed ?? null;
      const mapped = mapTransaction(
        txn.merchant_name ?? txn.name,
        plaidPrimary,
        plaidDetailed,
        cats,
        rules,
      );

      return {
        txn,
        dbAccountId,
        mapped,
        finalCategoryId: mapped.categoryId,
        finalIsReviewed: mapped.isReviewed,
        notes: null as string | null,
      };
    }).filter((t): t is Exclude<typeof t, null> => t !== null);

    // 3. Batch AI Categorization (Avoid sequential single model calls)
    const toAICategorize = mappedTxns.filter((t) => !t.finalCategoryId);
    if (toAICategorize.length > 0) {
      try {
        const aiInputs = toAICategorize.map((t) => ({
          id: t.txn.transaction_id,
          merchantName: t.txn.merchant_name ?? t.txn.name,
          plaidCategories: t.txn.personal_finance_category
            ? [t.txn.personal_finance_category.primary, t.txn.personal_finance_category.detailed].filter(Boolean)
            : [],
          amount: t.txn.amount,
        }));

        const aiResults = await categorizeTransactionsWithAIBatch(
          aiInputs,
          cats.map((c) => ({ id: c.id, name: c.name })),
        );

        for (const item of toAICategorize) {
          const aiResult = aiResults.get(item.txn.transaction_id);
          if (aiResult && aiResult.categoryId) {
            item.finalCategoryId = aiResult.categoryId;
            item.finalIsReviewed = false;
            item.notes = `AI suggested: ${aiResult.reasoning}`;
          }
        }
      } catch (e) {
        console.error("Failed to run batch AI categorization during sync", e);
      }
    }

    // 4. Bulk Insert/Upsert (Avoid individual insert queries)
    if (mappedTxns.length > 0) {
      const insertValues = mappedTxns.map((item) => ({
        accountId: item.dbAccountId,
        plaidTransactionId: item.txn.transaction_id,
        date: item.txn.date,
        amount: String(Math.abs(item.txn.amount)),
        merchantName: item.txn.merchant_name ?? item.txn.name,
        plaidCategory: item.txn.personal_finance_category
          ? [item.txn.personal_finance_category.primary, item.txn.personal_finance_category.detailed].filter(Boolean)
          : [],
        portalCategoryId: item.finalCategoryId,
        transactionType: item.mapped.transactionType,
        isReviewed: item.finalIsReviewed,
        notes: item.notes,
      }));

      await db
        .insert(transactions)
        .values(insertValues)
        .onConflictDoUpdate({
          target: transactions.plaidTransactionId,
          set: {
            date: sql`excluded.date`,
            amount: sql`excluded.amount`,
            merchantName: sql`excluded.merchant_name`,
            portalCategoryId: sql`excluded.portal_category_id`,
            transactionType: sql`excluded.transaction_type`,
            isReviewed: sql`excluded.is_reviewed`,
            notes: sql`excluded.notes`,
          },
        });
    }
    totalAdded += added.length;

    // 5. Parallelized Modifications
    if (modified.length > 0) {
      await Promise.all(
        modified.map((txn) =>
          db
            .update(transactions)
            .set({
              date: txn.date,
              amount: String(Math.abs(txn.amount)),
              merchantName: txn.merchant_name ?? txn.name,
            })
            .where(eq(transactions.plaidTransactionId, txn.transaction_id))
        )
      );
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
