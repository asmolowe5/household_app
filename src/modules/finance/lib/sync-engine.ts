// src/modules/finance/lib/sync-engine.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { plaidClient } from "./plaid-client";
import { mapTransaction } from "./category-mapper";
import { getCategories, getCategoryRules } from "@/modules/finance/queries";
import type { RemovedTransaction } from "plaid";

export async function syncPlaidItem(
  supabase: SupabaseClient,
  plaidItemId: string,
  accessToken: string,
  cursor: string | null,
): Promise<{ added: number; modified: number; removed: number; newCursor: string }> {
  const categories = await getCategories(supabase);
  const rules = await getCategoryRules(supabase);

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
        categories,
        rules,
      );

      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("plaid_account_id", txn.account_id)
        .single();

      if (!account) continue;

      await supabase.from("transactions").upsert(
        {
          account_id: account.id,
          plaid_transaction_id: txn.transaction_id,
          date: txn.date,
          amount: Math.abs(txn.amount),
          merchant_name: txn.merchant_name ?? txn.name,
          plaid_category: txn.personal_finance_category
            ? [txn.personal_finance_category.primary, txn.personal_finance_category.detailed].filter(Boolean)
            : [],
          portal_category_id: mapped.categoryId,
          transaction_type: mapped.transactionType,
          is_reviewed: mapped.isReviewed,
        },
        { onConflict: "plaid_transaction_id" },
      );
    }
    totalAdded += added.length;

    for (const txn of modified) {
      await supabase
        .from("transactions")
        .update({
          date: txn.date,
          amount: Math.abs(txn.amount),
          merchant_name: txn.merchant_name ?? txn.name,
        })
        .eq("plaid_transaction_id", txn.transaction_id);
    }
    totalModified += modified.length;

    const removedIds = removed.map((r: RemovedTransaction) => r.transaction_id);
    if (removedIds.length > 0) {
      await supabase
        .from("transactions")
        .delete()
        .in("plaid_transaction_id", removedIds);
    }
    totalRemoved += removed.length;

    currentCursor = next_cursor;
    hasMore = has_more;
  }

  await supabase
    .from("plaid_items")
    .update({ cursor: currentCursor, last_synced_at: new Date().toISOString() })
    .eq("id", plaidItemId);

  try {
    const balanceResponse = await plaidClient.accountsGet({ access_token: accessToken });
    for (const acct of balanceResponse.data.accounts) {
      await supabase
        .from("accounts")
        .update({
          current_balance: acct.balances.current,
          available_balance: acct.balances.available,
          last_balance_update: new Date().toISOString(),
        })
        .eq("plaid_account_id", acct.account_id);
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
