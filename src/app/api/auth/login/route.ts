import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts, users } from "@/db/schema";
import { getSession } from "@/shared/lib/auth/session";

const PIN_LENGTH = 8;
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const LOCKOUT_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const ipAddress = getClientIp(request);

  try {
    const lockout = await getActiveLockout(ipAddress);
    if (lockout) {
      return NextResponse.json(
        {
          error: "Too many failed attempts. Try again later.",
          retry_after_seconds: lockout.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(lockout.retryAfterSeconds),
          },
        },
      );
    }

    const { pin } = await request.json();

    if (!pin || typeof pin !== "string" || pin.length !== PIN_LENGTH) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 400 });
    }

    const allUsers = await db.select().from(users);

    const matchedUser = allUsers.find((user) =>
      bcrypt.compareSync(pin, user.pinHash),
    );

    if (!matchedUser) {
      await recordFailedAttempt(ipAddress);
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    await clearFailedAttempts(ipAddress);

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

function getClientIp(request: Request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;

  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();
  if (forwardedIp) return forwardedIp;

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

async function getActiveLockout(ipAddress: string) {
  const [attempt] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.ipAddress, ipAddress))
    .limit(1);

  const lockedUntil = attempt?.lockedUntil;
  if (!lockedUntil) return null;

  const now = Date.now();
  const unlockAt = lockedUntil.getTime();
  if (unlockAt <= now) return null;

  return {
    retryAfterSeconds: Math.ceil((unlockAt - now) / 1000),
  };
}

async function recordFailedAttempt(ipAddress: string) {
  const now = new Date();
  const [attempt] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.ipAddress, ipAddress))
    .limit(1);

  const previousFailure = attempt?.lastFailedAt?.getTime() ?? 0;
  const stillInWindow = now.getTime() - previousFailure < ATTEMPT_WINDOW_MS;
  const nextAttempts = stillInWindow ? (attempt?.attempts ?? 0) + 1 : 1;
  const lockedUntil =
    nextAttempts >= MAX_FAILED_ATTEMPTS
      ? new Date(now.getTime() + LOCKOUT_MS)
      : null;

  await db
    .insert(loginAttempts)
    .values({
      ipAddress,
      attempts: nextAttempts,
      lockedUntil,
      lastFailedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: loginAttempts.ipAddress,
      set: {
        attempts: nextAttempts,
        lockedUntil,
        lastFailedAt: now,
        updatedAt: now,
      },
    });
}

async function clearFailedAttempts(ipAddress: string) {
  await db
    .delete(loginAttempts)
    .where(eq(loginAttempts.ipAddress, ipAddress));
}
