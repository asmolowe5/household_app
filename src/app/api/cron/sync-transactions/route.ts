import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/db";
import { plaidItems } from "@/db/schema";
import { syncPlaidItem } from "@/modules/finance/lib/sync-engine";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const authorized =
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db
    .select({
      id: plaidItems.id,
      accessToken: plaidItems.accessToken,
      cursor: plaidItems.cursor,
    })
    .from(plaidItems);

  if (!items || items.length === 0) {
    return NextResponse.json({ message: "No items to sync" });
  }

  const results = [];
  for (const item of items) {
    if (!item.accessToken) continue;
    try {
      const result = await syncPlaidItem(
        item.id,
        item.accessToken,
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
