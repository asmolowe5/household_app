import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const list = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(categories.sortOrder);

    return NextResponse.json({ success: true, categories: list });
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
    const { name, monthly_budget, type, icon, tax_category } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Missing category name" }, { status: 400 });
    }

    const [newCategory] = await db
      .insert(categories)
      .values({
        name,
        monthlyBudget: monthly_budget ? String(monthly_budget) : "0",
        type: type || "discretionary",
        icon: icon || "tag",
        taxCategory: tax_category || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ success: true, category: newCategory });
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
    const { id, name, monthly_budget, type, icon, tax_category, is_active } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Missing category id" }, { status: 400 });
    }

    const setValues: Record<string, unknown> = {};
    if (name !== undefined) setValues.name = name;
    if (monthly_budget !== undefined) setValues.monthlyBudget = monthly_budget ? String(monthly_budget) : "0";
    if (type !== undefined) setValues.type = type;
    if (icon !== undefined) setValues.icon = icon;
    if (tax_category !== undefined) setValues.taxCategory = tax_category || null;
    if (is_active !== undefined) setValues.isActive = is_active;

    const [updatedCategory] = await db
      .update(categories)
      .set(setValues)
      .where(eq(categories.id, id))
      .returning();

    return NextResponse.json({ success: true, category: updatedCategory });
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
      return NextResponse.json({ error: "Missing category id" }, { status: 400 });
    }

    // Soft delete to protect references
    await db
      .update(categories)
      .set({ isActive: false })
      .where(eq(categories.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
