import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { db } from "@/db";
import { categoryRules } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const list = await db
      .select()
      .from(categoryRules)
      .orderBy(categoryRules.pattern);

    return NextResponse.json({ success: true, rules: list });
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
    const { pattern, category_id } = await request.json();

    if (!pattern || !category_id) {
      return NextResponse.json({ error: "Missing pattern or category_id" }, { status: 400 });
    }

    const [newRule] = await db
      .insert(categoryRules)
      .values({
        pattern: pattern.toLowerCase().trim(),
        categoryId: category_id,
        source: "user",
        createdBy: user.id,
      })
      .onConflictDoUpdate({
        target: categoryRules.pattern,
        set: { categoryId: category_id, source: "user" },
      })
      .returning();

    return NextResponse.json({ success: true, rule: newRule });
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
      return NextResponse.json({ error: "Missing rule id" }, { status: 400 });
    }

    await db.delete(categoryRules).where(eq(categoryRules.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
