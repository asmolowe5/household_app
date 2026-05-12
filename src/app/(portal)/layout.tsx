import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { PortalShellClient } from "./portal-shell-client";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <PortalShellClient>{children}</PortalShellClient>;
}
