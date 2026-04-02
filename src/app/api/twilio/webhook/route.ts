import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { chat } from "@/modules/finance/lib/ai-service";
import { sendSms } from "@/modules/finance/lib/sms-service";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const from = formData.get("From") as string;
  const body = formData.get("Body") as string;

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, phone")
    .eq("phone", from)
    .single();

  if (!profile) {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  const { data: existingConvo } = await admin
    .from("ai_conversations")
    .select("id, messages")
    .eq("user_id", profile.id)
    .eq("channel", "sms")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  const history = existingConvo?.messages ?? [];

  try {
    const reply = await chat(profile.id, body, history as any[]);

    const updatedMessages = [
      ...history,
      { role: "user", content: body },
      { role: "model", content: reply },
    ];

    if (existingConvo) {
      await admin
        .from("ai_conversations")
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq("id", existingConvo.id);
    } else {
      await admin.from("ai_conversations").insert({
        user_id: profile.id,
        channel: "sms",
        messages: updatedMessages,
      });
    }

    await sendSms(from, reply);
  } catch (error) {
    console.error("SMS AI error:", error);
    await sendSms(from, "Sorry, I had trouble processing that. Try again in a moment.");
  }

  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { "Content-Type": "text/xml" } }
  );
}
