"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";

const subNavItems = [
  { href: "/finance", label: "Dashboard", exact: true },
  { href: "/finance/transactions", label: "Transactions" },
  { href: "/finance/trends", label: "Trends" },
];

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      <nav className="flex gap-1 mb-6 border-b border-border-default pb-3">
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
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
