import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { plaidClient } from "@/modules/finance/lib/plaid-client";
import { CountryCode, Products } from "plaid";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: user.id },
    client_name: "Household Portal",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });

  return NextResponse.json({ link_token: response.data.link_token });
}
