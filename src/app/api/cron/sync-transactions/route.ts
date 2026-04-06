// src/app/api/cron/sync-transactions/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { syncPlaidItem } from "@/modules/finance/lib/sync-engine";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: items } = await supabase
    .from("plaid_items")
    .select("id, access_token, cursor");

  if (!items || items.length === 0) {
    return NextResponse.json({ message: "No items to sync" });
  }

  const results = [];
  for (const item of items) {
    try {
      const result = await syncPlaidItem(
        supabase,
        item.id,
        item.access_token,
        item.cursor,
      );
      results.push({ id: item.id, ...result });
    } catch (err) {
      results.push({
        id: item.id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ synced: results });
}
