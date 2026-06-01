import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { db } from "@/db";
import { transactions, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { saveTransactionSplits, getTransactionSplits } from "@/modules/finance/queries";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const transactionId = searchParams.get("transactionId");

  if (!transactionId) {
    return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });
  }

  try {
    const splits = await getTransactionSplits(transactionId);
    return NextResponse.json({ success: true, splits });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      date,
      amount,
      merchant_name,
      portal_category_id,
      property_id,
      notes,
      account_id,
      transaction_type,
    } = await request.json();

    if (!date || amount === undefined) {
      return NextResponse.json({ error: "Missing date or amount" }, { status: 400 });
    }

    let resolvedAccountId = account_id;
    if (!resolvedAccountId) {
      const [firstAccount] = await db.select({ id: accounts.id }).from(accounts).limit(1);
      if (!firstAccount) {
        return NextResponse.json({ error: "No bank account exists to map transaction" }, { status: 400 });
      }
      resolvedAccountId = firstAccount.id;
    }

    const [newTxn] = await db
      .insert(transactions)
      .values({
        accountId: resolvedAccountId,
        date: date, // 'YYYY-MM-DD'
        amount: String(amount),
        merchantName: merchant_name || "Manual Transaction",
        portalCategoryId: portal_category_id || null,
        propertyId: property_id || null,
        notes: notes || null,
        transactionType: transaction_type || "expense",
        isReviewed: true,
      })
      .returning();

    return NextResponse.json({ success: true, transaction: newTxn });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { transaction_id, splits } = await request.json();

    if (!transaction_id || !Array.isArray(splits)) {
      return NextResponse.json({ error: "Missing transaction_id or splits array" }, { status: 400 });
    }

    await saveTransactionSplits(transaction_id, splits);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
    }

    await db.delete(transactions).where(eq(transactions.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
