import { NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createLinkToken } from "@/modules/finance/lib/plaid-service";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const linkToken = await createLinkToken(user.id);
    return NextResponse.json({ link_token: linkToken });
  } catch (error) {
    console.error("Failed to create link token:", error);
    return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
  }
}
