import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: plaidItems } = await admin.from("plaid_items").select("id");

  for (const item of plaidItems ?? []) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaid_item_id: item.id }),
      });
    } catch (error) {
      console.error(`Sync failed for ${item.id}:`, error);
    }
  }

  return NextResponse.json({ success: true, items_synced: plaidItems?.length ?? 0 });
}
