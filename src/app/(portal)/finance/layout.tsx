"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { ModuleShell } from "@/shared/components/module-shell";
import { ArrowLeft } from "lucide-react";

const subNavItems = [
  { href: "/finance", label: "Dashboard", exact: true },
  { href: "/finance/transactions", label: "Transactions" },
  { href: "/finance/trends", label: "Trends" },
  { href: "/finance/insights", label: "Insight History" },
];

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const subNav = (
    <nav className="flex gap-1 border-b border-border-default pb-3">
      {subNavItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm transition-colors",
              isActive
                ? "bg-bg-tertiary text-text-primary font-medium"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={14} />
        Dashboard
      </Link>
      <ModuleShell title="Finance">
        {subNav}
        {children}
      </ModuleShell>
    </div>
  );
}
