import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { logNetWorthSnapshot } from "@/modules/finance/queries";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { date, total_assets, total_liabilities } = await request.json();

    if (!date || total_assets === undefined || total_liabilities === undefined) {
      return NextResponse.json({ error: "Missing required snapshot data" }, { status: 400 });
    }

    await logNetWorthSnapshot(date, Number(total_assets), Number(total_liabilities));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
