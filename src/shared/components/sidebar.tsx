"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Settings, Building2, Camera, Calendar } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const navItems = [
  { href: "/finance", label: "Finance", icon: BarChart3, active: true },
  { href: "/property", label: "Property", icon: Building2, active: false },
  { href: "/cameras", label: "Cameras", icon: Camera, active: false },
  { href: "/calendar", label: "Calendar", icon: Calendar, active: false },
  { href: "/settings", label: "Settings", icon: Settings, active: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-screen fixed left-0 top-0 border-r border-border-default bg-bg-secondary flex flex-col" style={{ width: '220px' }}>
      <div className="p-6">
        <h1 className="text-base font-semibold text-text-primary tracking-tight">
          Smolowe Portal
        </h1>
      </div>
      <nav className="flex-1 px-3">
        {navItems
          .filter((item) => item.active)
          .map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors mb-1",
                  isActive
                    ? "bg-bg-tertiary text-text-primary font-medium"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
