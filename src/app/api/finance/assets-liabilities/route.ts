import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { db } from "@/db";
import { assetsLiabilities } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, value, type, notes, property_id } = await request.json();

    if (!name || value === undefined || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [newAsset] = await db
      .insert(assetsLiabilities)
      .values({
        name,
        value: String(value),
        type,
        notes: notes || null,
        propertyId: property_id || null,
      })
      .returning();

    return NextResponse.json({ success: true, data: newAsset });
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
    const { id, name, value, type, notes, property_id } = await request.json();

    if (!id || !name || value === undefined || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [updated] = await db
      .update(assetsLiabilities)
      .set({
        name,
        value: String(value),
        type,
        notes: notes || null,
        propertyId: property_id || null,
        updatedAt: new Date(),
      })
      .where(eq(assetsLiabilities.id, id))
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
      return NextResponse.json({ error: "Missing asset id" }, { status: 400 });
    }

    await db.delete(assetsLiabilities).where(eq(assetsLiabilities.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
