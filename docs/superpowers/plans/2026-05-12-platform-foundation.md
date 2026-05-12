# Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the existing finance-only app into a modular platform with responsive layout, module registry, and critical bug fixes — while keeping the finance module fully functional.

**Architecture:** Modular monolith with module registry pattern. Each module owns its folder under `src/modules/`, exposes services for cross-module data sharing, and registers itself in a central registry that drives navigation. The portal layout becomes responsive with a desktop sidebar and mobile bottom tab bar.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Supabase, Framer Motion

---

## File Structure

**New files:**
- `middleware.ts` — Root middleware to register Supabase auth
- `src/modules/registry.ts` — Central module registry
- `src/modules/finance/lib/services.ts` — Finance module's public API for cross-module use
- `src/shared/components/module-shell.tsx` — Shared wrapper for all module pages
- `src/shared/components/portal-shell.tsx` — Client-side layout shell (sidebar + header + tab bar)
- `src/shared/components/mobile-tab-bar.tsx` — Bottom navigation for mobile
- `src/shared/hooks/use-media-query.ts` — Responsive breakpoint hook
- `src/shared/hooks/use-sidebar.ts` — Sidebar collapsed state hook

**Modified files:**
- `src/shared/components/sidebar.tsx` — Responsive, collapsible, registry-driven
- `src/shared/components/header.tsx` — Page title, user context, mobile awareness
- `src/app/(portal)/layout.tsx` — Responsive layout shell with sidebar + tab bar
- `src/shared/lib/utils.ts` — Add missing `formatCurrencyPrecise`
- `src/modules/finance/queries.ts` — Fix import to use canonical types
- `src/app/globals.css` — Add layout CSS variables
- `src/app/layout.tsx` — Fix font (Inter → Geist Sans per design tokens)

**Deleted files:**
- `src/app/(portal)/finances/page.tsx` — Duplicate legacy page
- `src/modules/finance/types.ts` — Old simplified types (canonical version is `types/index.ts`)

---

### Task 1: Fix Missing Utility Function

**Files:**
- Modify: `src/shared/lib/utils.ts:24` (after `formatCurrencyCents`)

The `formatCurrencyPrecise` function is imported by `src/app/(portal)/finances/page.tsx` and `src/modules/finance/components/transaction-detail.tsx` but doesn't exist. This is a build-breaking bug.

- [ ] **Step 1: Add `formatCurrencyPrecise` to utils**

Add after line 24 in `src/shared/lib/utils.ts` (after `formatCurrencyCents`):

```typescript
export function formatCurrencyPrecise(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
}
```

Note: This is functionally identical to `formatCurrencyCents` but uses `Math.abs()` to handle negative amounts (balances can be negative). We keep both since they have different semantics — `formatCurrencyCents` is for display amounts, `formatCurrencyPrecise` is for account balances where sign is handled separately.

- [ ] **Step 2: Verify build passes**

Run: `npx next build`
Expected: Build succeeds (or at least this specific import error is resolved)

- [ ] **Step 3: Commit**

```bash
git add src/shared/lib/utils.ts
git commit -m "fix: add missing formatCurrencyPrecise utility function"
```

---

### Task 2: Unify Type System

**Files:**
- Delete: `src/modules/finance/types.ts`
- Modify: `src/modules/finance/queries.ts:2`

Two type files exist: `src/modules/finance/types.ts` (simplified, 51 lines) and `src/modules/finance/types/index.ts` (canonical, 149 lines). The queries file imports from the simplified version. We need one source of truth.

- [ ] **Step 1: Check all imports of the old types file**

Run: `grep -r "from.*finance/types" src/ --include="*.ts" --include="*.tsx" -l`

Identify every file importing from `@/modules/finance/types` vs `@/modules/finance/types/index`. Note: TypeScript resolves `@/modules/finance/types` to either `types.ts` or `types/index.ts` — with both present, `types.ts` wins. Deleting `types.ts` makes all existing imports resolve to `types/index.ts` automatically.

- [ ] **Step 2: Verify the canonical types are a superset**

The canonical `types/index.ts` must include all types used by `queries.ts`: `Account`, `Transaction`, `Category`, `CategorySpend`, `MonthSummary`, `CategoryRule`.

Check: `CategorySpend` and `MonthSummary` exist in `types.ts` but NOT in `types/index.ts`. We need to add them.

Add to `src/modules/finance/types/index.ts` at the bottom:

```typescript
export interface CategorySpend extends Category {
  total_spent: number;
}

export interface MonthSummary {
  total_spent: number;
  total_budget: number;
  total_income: number;
  days_elapsed: number;
  days_in_month: number;
}
```

- [ ] **Step 3: Delete the old types file**

Delete `src/modules/finance/types.ts`.

- [ ] **Step 4: Verify build passes**

Run: `npx next build`
Expected: Build succeeds. All imports now resolve to `types/index.ts`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: unify finance types into single canonical source"
```

---

### Task 3: Delete Duplicate Finances Page

**Files:**
- Delete: `src/app/(portal)/finances/page.tsx`

The `/finances` page is an older duplicate of `/finance`. The `/finance` page uses the modern component pattern (`HeroMetric`, `CategoryList`, `calculateBudgetSummary`). The `/finances` page uses inline components and imports the missing `formatCurrencyPrecise`. We keep `/finance` and delete `/finances`.

- [ ] **Step 1: Check for any links to `/finances`**

Run: `grep -r '"/finances"' src/ --include="*.ts" --include="*.tsx"`
Run: `grep -r "'/finances'" src/ --include="*.ts" --include="*.tsx"`

If any links reference `/finances`, update them to `/finance`.

- [ ] **Step 2: Delete the duplicate page**

Delete the entire `src/app/(portal)/finances/` directory.

- [ ] **Step 3: Verify build passes**

Run: `npx next build`
Expected: Build succeeds. No references to `/finances` remain.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove duplicate /finances page, keep canonical /finance"
```

---

### Task 4: Register Root Middleware

**Files:**
- Create: `middleware.ts` (project root)

The Supabase auth middleware exists at `src/shared/lib/supabase/middleware.ts` but is never registered. Next.js requires a `middleware.ts` at the project root.

- [ ] **Step 1: Create root middleware**

Create `middleware.ts` at project root:

```typescript
import { updateSession } from "@/shared/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

The matcher pattern excludes static assets from middleware processing.

- [ ] **Step 2: Verify build passes**

Run: `npx next build`
Expected: Build succeeds. Middleware is registered.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "fix: register Supabase auth middleware at project root"
```

---

### Task 5: Module Registry

**Files:**
- Create: `src/modules/registry.ts`

The registry is the central config that tells the app what modules exist. The sidebar and mobile tab bar read from it.

- [ ] **Step 1: Create the registry**

Create `src/modules/registry.ts`:

```typescript
import { BarChart3, Camera, Settings, type LucideIcon } from "lucide-react";

export type ModuleStatus = "active" | "coming-soon";

export interface ModuleDefinition {
  id: string;
  name: string;
  icon: LucideIcon;
  basePath: string;
  status: ModuleStatus;
  description: string;
}

export const modules: ModuleDefinition[] = [
  {
    id: "finance",
    name: "Finance",
    icon: BarChart3,
    basePath: "/finance",
    status: "active",
    description: "Budget tracking, transactions, and spending insights",
  },
  {
    id: "cameras",
    name: "Cameras",
    icon: Camera,
    basePath: "/cameras",
    status: "coming-soon",
    description: "Security camera feeds and recordings",
  },
];

export const settingsModule: ModuleDefinition = {
  id: "settings",
  name: "Settings",
  icon: Settings,
  basePath: "/settings",
  status: "active",
  description: "Profile, accounts, and app preferences",
};

export function getActiveModules(): ModuleDefinition[] {
  return modules.filter((m) => m.status === "active");
}

export function getAllModules(): ModuleDefinition[] {
  return modules;
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/modules/registry.ts
git commit -m "feat: add central module registry"
```

---

### Task 6: Media Query and Sidebar State Hooks

**Files:**
- Create: `src/shared/hooks/use-media-query.ts`
- Create: `src/shared/hooks/use-sidebar.ts`

These hooks power the responsive layout — detecting screen size and managing sidebar collapsed/expanded state.

- [ ] **Step 1: Create the media query hook**

Create `src/shared/hooks/use-media-query.ts`:

```typescript
"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    function handleChange(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 768px)");
}

export function useIsCompactDesktop(): boolean {
  return !useMediaQuery("(min-width: 900px)") && useMediaQuery("(min-width: 768px)");
}
```

- [ ] **Step 2: Create the sidebar state hook**

Create `src/shared/hooks/use-sidebar.ts`:

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
import { useIsCompactDesktop } from "./use-media-query";

const SIDEBAR_WIDTH = 220;
const SIDEBAR_COLLAPSED_WIDTH = 64;

export function useSidebar() {
  const isCompact = useIsCompactDesktop();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setIsCollapsed(isCompact);
  }, [isCompact]);

  const toggle = useCallback(() => setIsCollapsed((prev) => !prev), []);

  return {
    isCollapsed,
    toggle,
    width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
    SIDEBAR_WIDTH,
    SIDEBAR_COLLAPSED_WIDTH,
  };
}
```

- [ ] **Step 3: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/shared/hooks/use-media-query.ts src/shared/hooks/use-sidebar.ts
git commit -m "feat: add responsive hooks for media query and sidebar state"
```

---

### Task 7: Add Layout CSS Variables

**Files:**
- Modify: `src/app/globals.css`

Add CSS variables for layout dimensions so they're consistent everywhere.

- [ ] **Step 1: Add layout variables to globals.css**

Add inside the `:root` block, after the transition variables (after line 65):

```css
  /* Layout dimensions */
  --sidebar-width: 220px;
  --sidebar-collapsed-width: 64px;
  --header-height: 56px;
  --tab-bar-height: 56px;
```

- [ ] **Step 2: Register them in the `@theme inline` block**

Add inside the `@theme inline` block (after the font family entries):

```css
  /* Layout */
  --spacing-sidebar: var(--sidebar-width);
  --spacing-sidebar-collapsed: var(--sidebar-collapsed-width);
  --spacing-header: var(--header-height);
  --spacing-tab-bar: var(--tab-bar-height);
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add layout dimension CSS variables"
```

---

### Task 8: ModuleShell Component

**Files:**
- Create: `src/shared/components/module-shell.tsx`

The shared wrapper that every module page uses. Provides consistent page title, optional action buttons, and content area.

- [ ] **Step 1: Create ModuleShell**

Create `src/shared/components/module-shell.tsx`:

```tsx
import type { ReactNode } from "react";

interface ModuleShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ModuleShell({ title, subtitle, actions, children }: ModuleShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/module-shell.tsx
git commit -m "feat: add ModuleShell component for consistent module page layout"
```

---

### Task 9: Responsive Sidebar

**Files:**
- Modify: `src/shared/components/sidebar.tsx` (full rewrite)

Replace the current hard-coded sidebar with a responsive, registry-driven sidebar that supports collapsed state.

- [ ] **Step 1: Rewrite the sidebar**

Replace `src/shared/components/sidebar.tsx` entirely:

```tsx
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
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/sidebar.tsx
git commit -m "feat: responsive sidebar with collapse state and module registry"
```

---

### Task 10: Responsive Header

**Files:**
- Modify: `src/shared/components/header.tsx` (full rewrite)

Promote the header: page title on left, theme toggle on right. On mobile, no title (the tab bar handles module context).

- [ ] **Step 1: Rewrite the header**

Replace `src/shared/components/header.tsx` entirely:

```tsx
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
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/header.tsx
git commit -m "feat: responsive header with page title from module registry"
```

---

### Task 11: Mobile Bottom Tab Bar

**Files:**
- Create: `src/shared/components/mobile-tab-bar.tsx`

Bottom navigation for mobile — shows active modules plus settings.

- [ ] **Step 1: Create the tab bar**

Create `src/shared/components/mobile-tab-bar.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/shared/components/mobile-tab-bar.tsx
git commit -m "feat: mobile bottom tab bar driven by module registry"
```

---

### Task 12: Responsive Portal Layout

**Files:**
- Modify: `src/app/(portal)/layout.tsx` (full rewrite)

The portal layout needs to:
1. Show sidebar on desktop, bottom tab bar on mobile
2. Manage sidebar collapsed state
3. Remove the hard-coded `marginLeft: '220px'`
4. Account for bottom tab bar padding on mobile

This file is currently a server component (it checks auth). We need to split it: keep auth in a server component, move the layout shell to a client component.

- [ ] **Step 1: Create the client layout shell**

Create `src/shared/components/portal-shell.tsx`:

```tsx
"use client";

import { type ReactNode } from "react";
import { Sidebar } from "@/shared/components/sidebar";
import { Header } from "@/shared/components/header";
import { MobileTabBar } from "@/shared/components/mobile-tab-bar";
import { useIsMobile } from "@/shared/hooks/use-media-query";
import { useSidebar } from "@/shared/hooks/use-sidebar";

export function PortalShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { isCollapsed, toggle, width } = useSidebar();

  return (
    <div className="flex min-h-screen">
      {!isMobile && <Sidebar isCollapsed={isCollapsed} onToggle={toggle} />}
      <div
        className="flex-1 flex flex-col min-h-screen transition-all duration-200"
        style={{ marginLeft: isMobile ? 0 : width }}
      >
        <Header />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>
      {isMobile && <MobileTabBar />}
    </div>
  );
}
```

- [ ] **Step 2: Simplify the portal layout to server-only auth + shell**

Replace `src/app/(portal)/layout.tsx` entirely:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { PortalShell } from "@/shared/components/portal-shell";

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

  return <PortalShell>{children}</PortalShell>;
}
```

Note: The `AiChatPanel` import has been removed from the layout. It should be re-added inside the finance module's own layout if it's finance-specific, or in the PortalShell if it's app-wide. For now, removing it keeps the layout clean — the AI chat panel can be re-integrated as a module-level concern in a follow-up.

- [ ] **Step 3: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 4: Test in browser**

Run: `npm run dev`

Test on desktop (>900px):
- Sidebar visible at 220px width
- Sidebar collapse button works, shrinks to 64px with icons only
- Header shows page title on left, theme toggle on right
- Content area adjusts margin when sidebar toggles

Test at compact desktop (768-900px):
- Sidebar auto-collapses to 64px

Test at mobile (<768px):
- No sidebar visible
- Bottom tab bar shows Finance + Settings
- Content uses full width
- Extra bottom padding so content isn't hidden behind tab bar

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/portal-shell.tsx src/app/(portal)/layout.tsx
git commit -m "feat: responsive portal layout with sidebar, tab bar, and collapse"
```

---

### Task 13: Finance Module Services Layer

**Files:**
- Create: `src/modules/finance/lib/services.ts`

The public API that other modules can import to access finance data. This is the cross-module data sharing pattern.

- [ ] **Step 1: Create the services file**

Create `src/modules/finance/lib/services.ts`:

```typescript
import { createClient } from "@/shared/lib/supabase/server";
import {
  getAccounts,
  getRecentTransactions,
  getCategories,
  getMonthExpenses,
  buildCategorySpend,
  buildMonthSummary,
  getReviewCount,
} from "@/modules/finance/queries";
import { calculateBudgetSummary } from "@/modules/finance/lib/budget-engine";
import type {
  Account,
  Transaction,
  Category,
  CategorySpend,
  MonthSummary,
  BudgetSummary,
} from "@/modules/finance/types";

export async function getFinanceAccounts(): Promise<Account[]> {
  const supabase = await createClient();
  return getAccounts(supabase);
}

export async function getFinanceTransactions(limit = 15): Promise<Transaction[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .order("date", { ascending: false })
    .limit(limit);
  return (data ?? []) as Transaction[];
}

export async function getFinanceBudgetSummary(): Promise<BudgetSummary> {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const [categories, transactions, accounts] = await Promise.all([
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("transactions")
      .select("*, category:categories(*)")
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase.from("accounts").select("*"),
  ]);

  return calculateBudgetSummary(
    (categories.data ?? []) as Category[],
    (transactions.data ?? []) as Transaction[],
    (accounts.data ?? []) as Account[],
    now,
  );
}

export async function getFinanceReviewCount(): Promise<number> {
  const supabase = await createClient();
  return getReviewCount(supabase);
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/modules/finance/lib/services.ts
git commit -m "feat: finance module services layer for cross-module data sharing"
```

---

### Task 14: Wrap Finance Pages in ModuleShell

**Files:**
- Modify: `src/app/(portal)/finance/page.tsx`
- Modify: `src/app/(portal)/finance/layout.tsx`

Wrap the finance dashboard in ModuleShell and integrate the sub-nav into the module layout cleanly.

- [ ] **Step 1: Update finance layout to use ModuleShell**

Replace `src/app/(portal)/finance/layout.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { ModuleShell } from "@/shared/components/module-shell";

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
    <ModuleShell title="Finance">
      {subNav}
      {children}
    </ModuleShell>
  );
}
```

- [ ] **Step 2: Remove the duplicate title from finance page**

In `src/app/(portal)/finance/page.tsx`, remove the `max-w-2xl` wrapper class since ModuleShell now handles the page structure. The page should just return its content:

The page currently returns `<div className="max-w-2xl">`. Keep this — it constrains finance content width which is a module-level layout decision, not a shell concern.

No change needed to the page itself.

- [ ] **Step 3: Verify build passes and test**

Run: `npx next build`
Run: `npm run dev`

Test: Finance page shows "Finance" title via ModuleShell, sub-nav tabs work, content renders correctly.

- [ ] **Step 4: Commit**

```bash
git add src/app/(portal)/finance/layout.tsx
git commit -m "feat: integrate finance layout with ModuleShell"
```

---

### Task 15: Fix Root Layout Font

**Files:**
- Modify: `src/app/layout.tsx`

The design tokens reference `--font-geist-sans` but the root layout imports Inter. The spec calls for Geist Sans (the Linear/Vercel typeface). Next.js 16 has Geist built in via `next/font/google`.

- [ ] **Step 1: Switch from Inter to Geist Sans**

Replace the font import in `src/app/layout.tsx`:

```tsx
import { GeistSans } from "geist/font/sans";
```

And update the body class:

```tsx
<body className={`${GeistSans.variable} font-sans`}>
```

- [ ] **Step 2: Install the geist font package**

Run: `npm install geist`

- [ ] **Step 3: Verify build passes**

Run: `npx next build`
Expected: Build succeeds. Font renders as Geist Sans.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx package.json package-lock.json
git commit -m "feat: switch from Inter to Geist Sans per design system spec"
```

---

### Task 16: Final Build Verification and Visual Test

**Files:** None (verification only)

- [ ] **Step 1: Full build**

Run: `npx next build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Visual test — desktop**

Run: `npm run dev`

Verify on desktop browser (>900px):
- [ ] Sidebar shows "Smolowe Portal" title, Finance (active), Cameras (grayed out, not clickable), Settings at bottom
- [ ] Sidebar collapse button works — toggles between 220px and 64px
- [ ] Header shows current module name on left, theme toggle on right
- [ ] Finance page renders with ModuleShell title, sub-nav tabs, budget data
- [ ] Theme toggle works (dark ↔ light)
- [ ] Settings pages accessible

- [ ] **Step 3: Visual test — compact desktop**

Resize browser to 800px width:
- [ ] Sidebar auto-collapses to icon-only mode
- [ ] Content area takes up more space
- [ ] Everything still functional

- [ ] **Step 4: Visual test — mobile**

Resize browser to 375px width (or use dev tools mobile emulation):
- [ ] No sidebar visible
- [ ] Bottom tab bar shows Finance, Settings icons with labels
- [ ] Tapping Finance tab navigates to finance
- [ ] Tapping Settings tab navigates to settings
- [ ] Content has proper padding, no overlap with tab bar
- [ ] Finance sub-nav tabs are usable on mobile width

- [ ] **Step 5: Commit any final adjustments**

If any visual issues are found, fix them and commit:

```bash
git add -A
git commit -m "fix: visual adjustments from responsive layout testing"
```

---

## Summary

**16 tasks total.** Tasks 1-4 fix critical bugs (missing function, duplicate types, duplicate page, unregistered middleware). Tasks 5-12 build the platform foundation (registry, hooks, responsive layout). Tasks 13-14 establish the module pattern (services layer, ModuleShell integration). Task 15 fixes the font. Task 16 is final verification.

After this plan is complete, the app will be:
- A modular platform with a central registry
- Responsive across desktop, compact desktop, and mobile
- Free of the critical bugs identified during exploration
- Ready for Phase 2 (self-hosting on Synology NAS) as a separate plan
