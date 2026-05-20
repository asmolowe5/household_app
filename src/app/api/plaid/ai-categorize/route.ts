import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { db } from "@/db";
import { transactions, accounts, plaidItems } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCategories } from "@/modules/finance/queries";
import { categorizeTransactionWithAI } from "@/modules/finance/lib/ai-categorizer";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cats = await getCategories();
    const availableCategories = cats.map((c) => ({ id: c.id, name: c.name }));

    // Find all uncategorized transactions for this user
    const uncatTxns = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        merchantName: transactions.merchantName,
        plaidCategory: transactions.plaidCategory,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .innerJoin(plaidItems, eq(accounts.plaidItemId, plaidItems.id))
      .where(
        and(
          eq(plaidItems.userId, user.id),
          eq(transactions.isReviewed, false),
          isNull(transactions.portalCategoryId),
        ),
      );

    if (uncatTxns.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "No uncategorized transactions found" });
    }

    let processedCount = 0;
    for (const txn of uncatTxns) {
      const amount = txn.amount ? Number(txn.amount) : 0;
      const merchantName = txn.merchantName ?? "Unknown Merchant";
      const plaidCategory = txn.plaidCategory ?? [];

      const aiResult = await categorizeTransactionWithAI(
        merchantName,
        plaidCategory,
        amount,
        availableCategories,
      );

      if (aiResult && aiResult.categoryId) {
        await db
          .update(transactions)
          .set({
            portalCategoryId: aiResult.categoryId,
            notes: `AI suggested: ${aiResult.reasoning}`,
          })
          .where(eq(transactions.id, txn.id));

        processedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      count: processedCount,
      totalChecked: uncatTxns.length,
    });
  } catch (error) {
    console.error("Manual AI categorization route error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
