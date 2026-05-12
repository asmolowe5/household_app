import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { syncPlaidItem } from "@/modules/finance/lib/sync-engine";
import { db } from "@/db";
import { plaidItems, transactions, categoryRules } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plaid_item_id } = await request.json();

  const [item] = await db
    .select({
      id: plaidItems.id,
      accessToken: plaidItems.accessToken,
      cursor: plaidItems.cursor,
    })
    .from(plaidItems)
    .where(and(eq(plaidItems.id, plaid_item_id), eq(plaidItems.userId, user.id)))
    .limit(1);

  if (!item || !item.accessToken) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const result = await syncPlaidItem(item.id, item.accessToken, item.cursor);

  return NextResponse.json({ success: true, ...result });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transaction_id, portal_category_id, transaction_type, notes, is_reviewed } =
    await request.json();

  if (!transaction_id) {
    return NextResponse.json({ error: "Missing transaction_id" }, { status: 400 });
  }

  const setValues: Record<string, unknown> = {};
  if (portal_category_id !== undefined) setValues.portalCategoryId = portal_category_id;
  if (transaction_type !== undefined) setValues.transactionType = transaction_type;
  if (notes !== undefined) setValues.notes = notes;
  if (is_reviewed !== undefined) setValues.isReviewed = is_reviewed;

  await db.update(transactions).set(setValues).where(eq(transactions.id, transaction_id));

  if (portal_category_id) {
    const [txn] = await db
      .select({ merchantName: transactions.merchantName })
      .from(transactions)
      .where(eq(transactions.id, transaction_id))
      .limit(1);

    if (txn?.merchantName) {
      await db
        .insert(categoryRules)
        .values({
          pattern: txn.merchantName.toLowerCase(),
          categoryId: portal_category_id,
          source: "user",
          createdBy: user.id,
        })
        .onConflictDoUpdate({
          target: categoryRules.pattern,
          set: { categoryId: portal_category_id, source: "user" },
        });
    }
  }

  return NextResponse.json({ success: true });
}
