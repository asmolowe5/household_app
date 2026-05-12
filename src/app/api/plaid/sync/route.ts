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
    item.id,
    item.access_token,
    item.cursor,
  );

  return NextResponse.json({ success: true, ...result });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transaction_id, portal_category_id, transaction_type, notes, is_reviewed } =
    await request.json();

  if (!transaction_id) {
    return NextResponse.json({ error: "Missing transaction_id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      ...(portal_category_id !== undefined && { portal_category_id }),
      ...(transaction_type !== undefined && { transaction_type }),
      ...(notes !== undefined && { notes }),
      ...(is_reviewed !== undefined && { is_reviewed }),
    })
    .eq("id", transaction_id);

  if (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  if (portal_category_id) {
    const { data: txn } = await supabase
      .from("transactions")
      .select("merchant_name")
      .eq("id", transaction_id)
      .single();

    if (txn?.merchant_name) {
      await supabase.from("category_rules").upsert(
        {
          pattern: txn.merchant_name.toLowerCase(),
          category_id: portal_category_id,
          source: "user",
          created_by: user.id,
        },
        { onConflict: "pattern" },
      );
    }
  }

  return NextResponse.json({ success: true });
}
