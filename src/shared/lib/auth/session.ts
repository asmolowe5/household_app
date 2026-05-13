import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId: string;
  userName: string;
  isLoggedIn: boolean;
}

const sessionOptions: SessionOptions = {
  password: process.env.IRON_SESSION_SECRET!,
  cookieName: "portal-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getCurrentUser() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) return null;
    return { id: session.userId, name: session.userName };
  } catch (error) {
    console.warn("Invalid portal session", error);
    return null;
  }
}
