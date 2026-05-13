import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await db.execute(sql`select 1`);

    return NextResponse.json({
      ok: true,
      app: "household-portal",
      version: process.env.APP_VERSION ?? "unknown",
      database: "ok",
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("Health check failed", error);

    return NextResponse.json(
      {
        ok: false,
        app: "household-portal",
        version: process.env.APP_VERSION ?? "unknown",
        database: "error",
        timestamp: new Date().toISOString(),
        latency_ms: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
