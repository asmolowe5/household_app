// src/app/api/plaid/sync/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { syncPlaidItem } from "@/modules/finance/lib/sync-engine";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plaid_item_id } = await request.json();

  const { data: item } = await supabase
    .from("plaid_items")
    .select("id, access_token, cursor")
    .eq("id", plaid_item_id)
    .eq("user_id", user.id)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const result = await syncPlaidItem(
    supabase,
    item.id,
    item.access_token,
    item.cursor,
  );

  return NextResponse.json({ success: true, ...result });
}
