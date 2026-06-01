import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { db } from "@/db";
import { recurringBills } from "@/db/schema";
import { detectRecurringSuggestions } from "@/modules/finance/queries";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "detect") {
      const suggestions = await detectRecurringSuggestions();
      return NextResponse.json({ success: true, suggestions });
    }

    return NextResponse.json({ success: true });
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
    const { name, amount, frequency, due_day, portal_category_id, notes } = await request.json();

    if (!name || amount === undefined || due_day === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [newBill] = await db
      .insert(recurringBills)
      .values({
        name,
        amount: String(amount),
        frequency: frequency || "monthly",
        dueDay: Number(due_day),
        portalCategoryId: portal_category_id || null,
        notes: notes || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ success: true, data: newBill });
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
    const { id, name, amount, frequency, due_day, portal_category_id, notes, is_active } = await request.json();

    if (!id || !name || amount === undefined || due_day === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [updated] = await db
      .update(recurringBills)
      .set({
        name,
        amount: String(amount),
        frequency,
        dueDay: Number(due_day),
        portalCategoryId: portal_category_id || null,
        notes: notes || null,
        isActive: is_active !== undefined ? is_active : true,
      })
      .where(eq(recurringBills.id, id))
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
      return NextResponse.json({ error: "Missing bill id" }, { status: 400 });
    }

    await db.delete(recurringBills).where(eq(recurringBills.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
