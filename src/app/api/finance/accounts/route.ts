import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { account_id, custom_name, is_visible } = await request.json();

    if (!account_id) {
      return NextResponse.json({ error: "Missing account_id" }, { status: 400 });
    }

    const setValues: Record<string, unknown> = {};
    if (custom_name !== undefined) {
      // Allow empty string to reset custom name to default
      setValues.customName = custom_name === "" ? null : custom_name;
    }
    if (is_visible !== undefined) {
      setValues.isVisible = is_visible;
    }

    await db.update(accounts).set(setValues).where(eq(accounts.id, account_id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
