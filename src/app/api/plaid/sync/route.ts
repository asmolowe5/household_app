import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { syncTransactions, getAccounts } from "@/modules/finance/lib/plaid-service";
import { categorizeTransaction } from "@/modules/finance/lib/categorizer";
import { classifyTransaction } from "@/modules/finance/lib/transaction-classifier";

export async function POST(request: NextRequest) {
  const admin = createAdminClient();
  const { plaid_item_id } = await request.json();

  const { data: plaidItem } = await admin
    .from("plaid_items")
    .select("*")
    .eq("id", plaid_item_id)
    .single();

  if (!plaidItem) {
    return NextResponse.json({ error: "Plaid item not found" }, { status: 404 });
  }

  const cursor = plaidItem.cursor;
  let syncCursor: string | undefined;

  if (!cursor?.startsWith("__token__")) {
    return NextResponse.json({ error: "No access token available" }, { status: 400 });
  }

  const accessToken: string = cursor.replace("__token__", "");
  syncCursor = undefined;

  try {
    const accounts = await getAccounts(accessToken);
    for (const account of accounts) {
      await admin.from("accounts").update({
        current_balance: account.balances.current,
        available_balance: account.balances.available,
        last_balance_update: new Date().toISOString(),
      }).eq("plaid_account_id", account.account_id);
    }

    const syncResult = await syncTransactions(accessToken, syncCursor);

    const { data: categories } = await admin.from("categories").select("*");
    const { data: rules } = await admin.from("category_rules").select("*");

    let newTransactionCount = 0;

    for (const txn of syncResult.added) {
      const account = accounts.find((a) => a.account_id === txn.account_id);
      const { data: dbAccount } = await admin
        .from("accounts")
        .select("id, name, type, subtype")
        .eq("plaid_account_id", txn.account_id)
        .single();

      if (!dbAccount) continue;

      const txnType = classifyTransaction({
        amount: txn.amount,
        accountType: account?.type ?? "",
        accountSubtype: account?.subtype ?? null,
        merchantName: txn.merchant_name ?? txn.name,
        plaidCategory: txn.personal_finance_category ? [txn.personal_finance_category.primary] : null,
        accountName: dbAccount.name,
      });

      const categoryId = txnType === "expense"
        ? categorizeTransaction(
            txn.merchant_name ?? txn.name,
            txn.personal_finance_category ? [txn.personal_finance_category.primary] : null,
            rules ?? [],
            categories ?? []
          )
        : null;

      await admin.from("transactions").upsert({
        account_id: dbAccount.id,
        plaid_transaction_id: txn.transaction_id,
        date: txn.date,
        amount: txn.amount,
        merchant_name: txn.merchant_name ?? txn.name,
        plaid_category: txn.personal_finance_category ? [txn.personal_finance_category.primary, txn.personal_finance_category.detailed] : null,
        portal_category_id: categoryId,
        transaction_type: txnType,
      }, { onConflict: "plaid_transaction_id" });

      newTransactionCount++;
    }

    for (const removed of syncResult.removed) {
      if (removed.transaction_id) {
        await admin.from("transactions").delete().eq("plaid_transaction_id", removed.transaction_id);
      }
    }

    await admin
      .from("plaid_items")
      .update({ cursor: syncResult.cursor, last_synced_at: new Date().toISOString() })
      .eq("id", plaid_item_id);

    if (newTransactionCount > 0) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/alerts/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaid_item_id }),
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      added: newTransactionCount,
      removed: syncResult.removed.length,
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
