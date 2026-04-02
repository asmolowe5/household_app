import { NextResponse } from "next/server";
import { evaluateAlerts } from "@/modules/finance/lib/alert-engine";

export async function POST() {
  try {
    await evaluateAlerts();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Alert evaluation error:", error);
    return NextResponse.json({ error: "Alert evaluation failed" }, { status: 500 });
  }
}
