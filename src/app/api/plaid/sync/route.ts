import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { syncPlaidItem } from "@/modules/finance/lib/sync-engine";
import { db } from "@/db";
import { plaidItems, transactions, categoryRules } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let plaid_item_id: string | undefined;
  try {
    const body = await request.json();
    plaid_item_id = body.plaid_item_id;
  } catch {
    // Gracefully handle empty body and default to syncing all items
  }

  if (plaid_item_id) {
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
  } else {
    const items = await db
      .select({
        id: plaidItems.id,
        accessToken: plaidItems.accessToken,
        cursor: plaidItems.cursor,
      })
      .from(plaidItems)
      .where(eq(plaidItems.userId, user.id));

    if (items.length === 0) {
      return NextResponse.json({ success: true, message: "No items connected", added: 0, modified: 0, removed: 0 });
    }

    const results = [];
    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;

    for (const item of items) {
      if (!item.accessToken) continue;
      try {
        const result = await syncPlaidItem(item.id, item.accessToken, item.cursor);
        totalAdded += result.added;
        totalModified += result.modified;
        totalRemoved += result.removed;
        results.push({ id: item.id, ...result });
      } catch (err) {
        results.push({
          id: item.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
      synced: results,
    });
  }
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

      // Retroactively categorize other uncategorized transactions with the same merchant name
      await db
        .update(transactions)
        .set({
          portalCategoryId: portal_category_id,
          isReviewed: true,
          notes: "Auto-categorized by user rule memory",
        })
        .where(
          and(
            eq(transactions.merchantName, txn.merchantName),
            isNull(transactions.portalCategoryId)
          )
        );
    }
  }

  return NextResponse.json({ success: true });
}
