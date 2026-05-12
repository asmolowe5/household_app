"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { modules, settingsModule, type ModuleDefinition } from "@/modules/registry";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "h-screen fixed left-0 top-0 border-r border-border-default bg-bg-secondary flex flex-col transition-all duration-200 z-30",
      )}
      style={{ width: isCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)" }}
    >
      <div className={cn("flex items-center", isCollapsed ? "justify-center p-4" : "justify-between p-6")}>
        {!isCollapsed && (
          <h1 className="text-base font-semibold text-text-primary tracking-tight">
            Smolowe Portal
          </h1>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <nav className="flex-1 px-2">
        {modules.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            pathname={pathname}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>

      <div className="px-2 pb-4 border-t border-border-subtle pt-2">
        <NavItem
          item={settingsModule}
          pathname={pathname}
          isCollapsed={isCollapsed}
        />
      </div>
    </aside>
  );
}

function NavItem({
  item,
  pathname,
  isCollapsed,
}: {
  item: ModuleDefinition;
  pathname: string;
  isCollapsed: boolean;
}) {
  const isActive = pathname.startsWith(item.basePath);
  const isDisabled = item.status === "coming-soon";
  const Icon = item.icon;

  if (isDisabled) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-md text-sm mb-1 opacity-40 cursor-not-allowed",
          isCollapsed ? "justify-center px-2 py-2" : "px-3 py-2",
        )}
        title={isCollapsed ? `${item.name} (coming soon)` : undefined}
      >
        <Icon size={18} />
        {!isCollapsed && <span>{item.name}</span>}
      </div>
    );
  }

  return (
    <Link
      href={item.basePath}
      className={cn(
        "flex items-center gap-3 rounded-md text-sm transition-colors mb-1",
        isCollapsed ? "justify-center px-2 py-2" : "px-3 py-2",
        isActive
          ? "bg-bg-tertiary text-text-primary font-medium"
          : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary",
      )}
      title={isCollapsed ? item.name : undefined}
    >
      <Icon size={18} />
      {!isCollapsed && <span>{item.name}</span>}
    </Link>
  );
}
