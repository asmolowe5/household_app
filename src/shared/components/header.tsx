"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { modules, settingsModule } from "@/modules/registry";

export function Header() {
  const pathname = usePathname();

  const currentModule = [...modules, settingsModule].find((m) =>
    pathname.startsWith(m.basePath),
  );
  const pageTitle = currentModule?.name ?? "Portal";

  return (
    <header className="h-14 border-b border-border-default bg-bg-secondary flex items-center justify-between px-6">
      <h2 className="text-sm font-semibold text-text-primary hidden md:block">
        {pageTitle}
      </h2>
      <div className="flex items-center gap-2 ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
