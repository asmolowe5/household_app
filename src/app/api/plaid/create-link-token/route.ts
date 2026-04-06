// src/app/api/plaid/create-link-token/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { plaidClient } from "@/modules/finance/lib/plaid-client";
import { CountryCode, Products } from "plaid";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: user.id },
    client_name: "Smolowe Portal",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });

  return NextResponse.json({ link_token: response.data.link_token });
}
