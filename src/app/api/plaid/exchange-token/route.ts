import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { plaidClient } from "@/modules/finance/lib/plaid-client";
import { syncPlaidItem } from "@/modules/finance/lib/sync-engine";
import { db } from "@/db";
import { plaidItems, accounts } from "@/db/schema";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { public_token, institution } = await request.json();

  const exchangeResponse = await plaidClient.itemPublicTokenExchange({
    public_token,
  });

  const { access_token, item_id } = exchangeResponse.data;

  const [plaidItem] = await db
    .insert(plaidItems)
    .values({
      userId: user.id,
      accessToken: access_token,
      plaidItemId: item_id,
      institutionName: institution?.name ?? "Unknown",
      institutionId: institution?.institution_id ?? null,
    })
    .returning({ id: plaidItems.id });

  if (!plaidItem) {
    return NextResponse.json(
      { error: "Failed to save bank connection" },
      { status: 500 },
    );
  }

  const accountsResponse = await plaidClient.accountsGet({ access_token });

  for (const acct of accountsResponse.data.accounts) {
    await db
      .insert(accounts)
      .values({
        plaidItemId: plaidItem.id,
        plaidAccountId: acct.account_id,
        name: acct.name,
        officialName: acct.official_name,
        type: acct.type,
        subtype: acct.subtype,
        currentBalance: acct.balances.current != null ? String(acct.balances.current) : null,
        availableBalance: acct.balances.available != null ? String(acct.balances.available) : null,
        isoCurrencyCode: acct.balances.iso_currency_code ?? "USD",
        lastBalanceUpdate: new Date(),
      })
      .onConflictDoUpdate({
        target: accounts.plaidAccountId,
        set: {
          currentBalance: acct.balances.current != null ? String(acct.balances.current) : null,
          availableBalance: acct.balances.available != null ? String(acct.balances.available) : null,
          lastBalanceUpdate: new Date(),
        },
      });
  }

  const syncResult = await syncPlaidItem(plaidItem.id, access_token, null);

  return NextResponse.json({
    success: true,
    accounts: accountsResponse.data.accounts.length,
    transactions: syncResult.added,
  });
}
