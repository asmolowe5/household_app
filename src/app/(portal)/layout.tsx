import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { Sidebar } from "@/shared/components/sidebar";
import { Header } from "@/shared/components/header";
import { AiChatPanel } from "@/modules/finance/components/ai-chat-panel";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1" style={{ marginLeft: '220px' }}>
        <Header />
        <main className="p-6">{children}</main>
      </div>
      <AiChatPanel />
    </div>
  );
}
