import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { chat } from "@/modules/finance/lib/ai-service";
import { sendSms } from "@/modules/finance/lib/sms-service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profiles } = await admin.from("profiles").select("id, phone");

  for (const profile of profiles ?? []) {
    if (!profile.phone) continue;

    try {
      const digest = await chat(
        profile.id,
        "Generate the weekly financial digest. Lead with wins, then areas to watch. Include daily spending allowance for remaining days. Keep it concise — this is an SMS.",
        []
      );

      await sendSms(profile.phone, digest);
    } catch (error) {
      console.error(`Digest failed for ${profile.id}:`, error);
    }
  }

  return NextResponse.json({ success: true });
}
