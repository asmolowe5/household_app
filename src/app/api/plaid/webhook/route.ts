import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const admin = createAdminClient();

  if (body.webhook_type === "TRANSACTIONS") {
    if (body.webhook_code === "SYNC_UPDATES_AVAILABLE") {
      const itemId = body.item_id;

      const { data: plaidItem } = await admin
        .from("plaid_items")
        .select("id")
        .eq("institution_id", itemId)
        .single();

      if (plaidItem) {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plaid_item_id: plaidItem.id }),
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
