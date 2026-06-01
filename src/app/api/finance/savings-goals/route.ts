import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { db } from "@/db";
import { savingsGoals } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, target_amount, current_amount, target_date, notes, account_id } = await request.json();

    if (!name || target_amount === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [newGoal] = await db
      .insert(savingsGoals)
      .values({
        name,
        targetAmount: String(target_amount),
        currentAmount: String(current_amount || 0),
        targetDate: target_date || null,
        notes: notes || null,
        accountId: account_id || null,
        isCompleted: false,
      })
      .returning();

    return NextResponse.json({ success: true, data: newGoal });
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
    const { id, name, target_amount, current_amount, target_date, notes, is_completed, account_id } = await request.json();

    if (!id || !name || target_amount === undefined || current_amount === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [updated] = await db
      .update(savingsGoals)
      .set({
        name,
        targetAmount: String(target_amount),
        currentAmount: String(current_amount),
        targetDate: target_date || null,
        notes: notes || null,
        isCompleted: is_completed !== undefined ? is_completed : false,
        accountId: account_id || null,
      })
      .where(eq(savingsGoals.id, id))
      .returning();

    return NextResponse.json({ success: true, data: updated });
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
      return NextResponse.json({ error: "Missing goal id" }, { status: 400 });
    }

    await db.delete(savingsGoals).where(eq(savingsGoals.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
