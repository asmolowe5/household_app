import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/shared/lib/auth/session";

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!pin || typeof pin !== "string" || pin.length !== 4) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 400 });
    }

    const allUsers = await db.select().from(users);

    const matchedUser = allUsers.find((u) =>
      bcrypt.compareSync(pin, u.pinHash),
    );

    if (!matchedUser) {
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    const session = await getSession();
    session.userId = matchedUser.id;
    session.userName = matchedUser.name;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ success: true, name: matchedUser.name });
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
