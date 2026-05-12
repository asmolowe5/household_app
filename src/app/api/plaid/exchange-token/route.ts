// src/app/api/plaid/exchange-token/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { plaidClient } from "@/modules/finance/lib/plaid-client";
import { syncPlaidItem } from "@/modules/finance/lib/sync-engine";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { public_token, institution } = await request.json();

  const exchangeResponse = await plaidClient.itemPublicTokenExchange({
    public_token,
  });

  const { access_token, item_id } = exchangeResponse.data;

  const { data: plaidItem, error: insertError } = await supabase
    .from("plaid_items")
    .insert({
      user_id: user.id,
      access_token,
      plaid_item_id: item_id,
      institution_name: institution?.name ?? "Unknown",
      institution_id: institution?.institution_id ?? null,
    })
    .select("id")
    .single();

  if (insertError || !plaidItem) {
    return NextResponse.json(
      { error: "Failed to save bank connection" },
      { status: 500 },
    );
  }

  const accountsResponse = await plaidClient.accountsGet({
    access_token,
  });

  for (const acct of accountsResponse.data.accounts) {
    await supabase.from("accounts").upsert(
      {
        plaid_item_id: plaidItem.id,
        plaid_account_id: acct.account_id,
        name: acct.name,
        official_name: acct.official_name,
        type: acct.type,
        subtype: acct.subtype,
        current_balance: acct.balances.current,
        available_balance: acct.balances.available,
        iso_currency_code: acct.balances.iso_currency_code ?? "USD",
        last_balance_update: new Date().toISOString(),
      },
      { onConflict: "plaid_account_id" },
    );
  }

  const syncResult = await syncPlaidItem(
    plaidItem.id,
    access_token,
    null,
  );

  return NextResponse.json({
    success: true,
    accounts: accountsResponse.data.accounts.length,
    transactions: syncResult.added,
  });
}
