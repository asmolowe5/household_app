import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { chat } from "@/modules/finance/lib/ai-service";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, conversation_id } = await request.json();

  let history: { role: string; content: string }[] = [];
  if (conversation_id) {
    const { data } = await supabase
      .from("ai_conversations")
      .select("messages")
      .eq("id", conversation_id)
      .single();
    history = data?.messages ?? [];
  }

  try {
    const reply = await chat(user.id, message, history);

    const updatedMessages = [
      ...history,
      { role: "user", content: message },
      { role: "model", content: reply },
    ];

    if (conversation_id) {
      await supabase
        .from("ai_conversations")
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq("id", conversation_id);
    } else {
      const { data: newConvo } = await supabase
        .from("ai_conversations")
        .insert({
          user_id: user.id,
          channel: "portal",
          messages: updatedMessages,
        })
        .select("id")
        .single();

      return NextResponse.json({
        reply,
        conversation_id: newConvo?.id,
      });
    }

    return NextResponse.json({ reply, conversation_id });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json({ error: "AI service error" }, { status: 500 });
  }
}
