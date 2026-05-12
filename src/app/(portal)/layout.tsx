import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { PortalShell } from "@/shared/components/portal-shell";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <PortalShell>{children}</PortalShell>;
}
