import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { exchangePublicToken, getAccounts, syncTransactions } from "@/modules/finance/lib/plaid-service";
import { categorizeTransaction } from "@/modules/finance/lib/categorizer";
import { classifyTransaction } from "@/modules/finance/lib/transaction-classifier";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { public_token, institution } = await request.json();

  try {
    const { accessToken, itemId } = await exchangePublicToken(public_token);

    // Store plaid item
    const { data: plaidItem, error: itemError } = await admin
      .from("plaid_items")
      .insert({
        user_id: user.id,
        institution_name: institution.name,
        institution_id: institution.institution_id,
        module_context: "household",
      })
      .select()
      .single();

    if (itemError) throw itemError;

    // Store access token temporarily in cursor field (Vault integration future)
    await admin
      .from("plaid_items")
      .update({ cursor: `__token__${accessToken}` })
      .eq("id", plaidItem.id);

    // Fetch and store accounts
    const accounts = await getAccounts(accessToken);
    for (const account of accounts) {
      await admin.from("accounts").upsert({
        plaid_item_id: plaidItem.id,
        plaid_account_id: account.account_id,
        name: account.name,
        official_name: account.official_name,
        type: account.type,
        subtype: account.subtype,
        current_balance: account.balances.current,
        available_balance: account.balances.available,
        iso_currency_code: account.balances.iso_currency_code,
        last_balance_update: new Date().toISOString(),
      }, { onConflict: "plaid_account_id" });
    }

    // Initial transaction sync
    const syncResult = await syncTransactions(accessToken);

    // Get categories and rules for auto-categorization
    const { data: categories } = await admin.from("categories").select("*");
    const { data: rules } = await admin.from("category_rules").select("*");

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
    }

    // Update cursor for future syncs
    await admin
      .from("plaid_items")
      .update({ cursor: syncResult.cursor, last_synced_at: new Date().toISOString() })
      .eq("id", plaidItem.id);

    return NextResponse.json({
      success: true,
      accounts: accounts.length,
      transactions: syncResult.added.length,
    });
  } catch (error) {
    console.error("Failed to exchange token:", error);
    return NextResponse.json({ error: "Failed to connect account" }, { status: 500 });
  }
}
