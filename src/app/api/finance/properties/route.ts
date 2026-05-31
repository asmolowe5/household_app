import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const list = await db
      .select()
      .from(properties)
      .where(eq(properties.isActive, true))
      .orderBy(properties.name);

    return NextResponse.json({ success: true, properties: list });
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
    const { name, address, monthly_rent_target, notes } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Missing property name" }, { status: 400 });
    }

    const [newProperty] = await db
      .insert(properties)
      .values({
        name,
        address: address || null,
        monthlyRentTarget: monthly_rent_target ? String(monthly_rent_target) : "0",
        notes: notes || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ success: true, property: newProperty });
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
    const { id, name, address, monthly_rent_target, notes, is_active } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Missing property id" }, { status: 400 });
    }

    const setValues: Record<string, unknown> = {};
    if (name !== undefined) setValues.name = name;
    if (address !== undefined) setValues.address = address || null;
    if (monthly_rent_target !== undefined) {
      setValues.monthlyRentTarget = monthly_rent_target ? String(monthly_rent_target) : "0";
    }
    if (notes !== undefined) setValues.notes = notes || null;
    if (is_active !== undefined) setValues.isActive = is_active;

    const [updatedProperty] = await db
      .update(properties)
      .set(setValues)
      .where(eq(properties.id, id))
      .returning();

    return NextResponse.json({ success: true, property: updatedProperty });
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
      return NextResponse.json({ error: "Missing property id" }, { status: 400 });
    }

    // Instead of hard deleting, we can soft-delete by setting isActive to false.
    // This preserves historical transactions mapped to it.
    await db
      .update(properties)
      .set({ isActive: false })
      .where(eq(properties.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
