"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { getActiveModules, settingsModule, type ModuleDefinition } from "@/modules/registry";

export function MobileTabBar() {
  const pathname = usePathname();
  const activeModules = getActiveModules();
  const items: ModuleDefinition[] = [...activeModules, settingsModule];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 border-t border-border-default bg-bg-secondary z-40 md:hidden"
      style={{ height: "var(--tab-bar-height)" }}
    >
      <div className="flex items-center justify-around h-full px-2">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.basePath);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.basePath}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive
                  ? "text-accent"
                  : "text-text-tertiary",
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
