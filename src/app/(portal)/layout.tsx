import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <header className="border-b border-border-default bg-bg-secondary px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-sm font-semibold tracking-tight">
              Smolowe Portal
            </p>
            <p className="text-xs text-text-tertiary">Signed in as {user.name}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-md border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}
