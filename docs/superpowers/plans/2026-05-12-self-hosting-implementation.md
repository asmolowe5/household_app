# Self-Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase with Drizzle ORM + PostgreSQL and PIN-based auth, then containerize the app for deployment on a Synology NAS via Docker Compose + Cloudflare Tunnel.

**Architecture:** Two-container stack (Next.js + PostgreSQL) plus a Cloudflare Tunnel sidecar. Drizzle ORM for database access, iron-session for encrypted cookie auth with a 4-digit PIN login. No third-party runtime dependencies.

**Tech Stack:** Next.js 16, Drizzle ORM, postgres-js, iron-session, bcryptjs, Docker, PostgreSQL 16, Cloudflare Tunnel

**Key constraint:** `npx next build` MUST pass after every task. Verify before committing.

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `src/db/index.ts` | Drizzle client instance (postgres-js connection) |
| `src/db/schema/users.ts` | Users table (replaces Supabase auth.users) |
| `src/db/schema/plaid-items.ts` | Plaid items table |
| `src/db/schema/accounts.ts` | Accounts table |
| `src/db/schema/categories.ts` | Categories + category_rules tables |
| `src/db/schema/transactions.ts` | Transactions table |
| `src/db/schema/index.ts` | Re-export all schema tables |
| `src/shared/lib/auth/session.ts` | iron-session config, getSession/setSession helpers |
| `src/app/api/auth/login/route.ts` | POST: verify PIN, create session |
| `src/app/api/auth/logout/route.ts` | POST: destroy session |
| `drizzle.config.ts` | Drizzle Kit configuration |
| `Dockerfile` | Multi-stage Next.js production build |
| `docker-compose.yml` | portal + db + tunnel services |
| `.dockerignore` | Exclude node_modules, .next, .git |
| `scripts/seed.ts` | Seed users table with hashed PINs + categories |
| `scripts/backup.sh` | pg_dump with 7-day retention |

### Modified files

| File | Change |
|------|--------|
| `package.json` | Add drizzle-orm, postgres, iron-session, bcryptjs; remove @supabase/* |
| `next.config.ts` | Add `output: "standalone"` |
| `middleware.ts` | Replace Supabase session check with iron-session |
| `src/app/(auth)/login/page.tsx` | Replace email/password form with PIN keypad |
| `src/app/(portal)/layout.tsx` | Replace `supabase.auth.getUser()` with session check |
| `src/modules/finance/queries.ts` | Replace all Supabase queries with Drizzle |
| `src/modules/finance/lib/services.ts` | Use Drizzle db import instead of Supabase createClient |
| `src/modules/finance/lib/sync-engine.ts` | Replace all Supabase calls with Drizzle |
| `src/app/api/plaid/create-link-token/route.ts` | Use session for auth, remove Supabase |
| `src/app/api/plaid/exchange-token/route.ts` | Use session + Drizzle |
| `src/app/api/plaid/sync/route.ts` | Use session + Drizzle |
| `src/app/api/cron/sync-transactions/route.ts` | Use Drizzle directly |
| `src/app/manifest.ts` | Update name/scope for axiominteract.com |
| `src/app/(portal)/dashboard/page.tsx` | Update status cards text |
| `src/modules/finance/types/index.ts` | Remove unused types (AlertRule, etc.) |

### Deleted files

| File | Reason |
|------|--------|
| `src/shared/lib/supabase/server.ts` | Replaced by `src/db/index.ts` |
| `src/shared/lib/supabase/client.ts` | Replaced by API routes (no browser DB access) |
| `src/shared/lib/supabase/admin.ts` | Replaced by `src/db/index.ts` |
| `src/shared/lib/supabase/middleware.ts` | Replaced by `src/shared/lib/auth/session.ts` |

---

## Task 1: Install dependencies and configure Drizzle

**Files:**
- Modify: `package.json`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Install new dependencies**

```bash
npm install drizzle-orm postgres iron-session bcryptjs
npm install -D drizzle-kit @types/bcryptjs
```

- [ ] **Step 2: Create `drizzle.config.ts`**

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

Expected: PASS — new packages installed, config file exists but nothing imports it yet.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts
git commit -m "chore: add drizzle, iron-session, bcryptjs dependencies"
```

---

## Task 2: Create Drizzle schema and database client

**Files:**
- Create: `src/db/schema/users.ts`
- Create: `src/db/schema/plaid-items.ts`
- Create: `src/db/schema/accounts.ts`
- Create: `src/db/schema/categories.ts`
- Create: `src/db/schema/transactions.ts`
- Create: `src/db/schema/index.ts`
- Create: `src/db/index.ts`

- [ ] **Step 1: Create `src/db/schema/users.ts`**

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  pinHash: text("pin_hash").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

- [ ] **Step 2: Create `src/db/schema/plaid-items.ts`**

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const plaidItems = pgTable("plaid_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  accessToken: text("access_token"),
  plaidItemId: text("plaid_item_id"),
  institutionName: text("institution_name").notNull(),
  institutionId: text("institution_id"),
  moduleContext: text("module_context").default("household"),
  cursor: text("cursor"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

- [ ] **Step 3: Create `src/db/schema/accounts.ts`**

```ts
import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { plaidItems } from "./plaid-items";

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  plaidItemId: uuid("plaid_item_id").references(() => plaidItems.id, { onDelete: "cascade" }).notNull(),
  plaidAccountId: text("plaid_account_id").notNull().unique(),
  name: text("name").notNull(),
  officialName: text("official_name"),
  type: text("type").notNull(),
  subtype: text("subtype"),
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 }),
  availableBalance: numeric("available_balance", { precision: 12, scale: 2 }),
  isoCurrencyCode: text("iso_currency_code").default("USD"),
  lastBalanceUpdate: timestamp("last_balance_update", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

- [ ] **Step 4: Create `src/db/schema/categories.ts`**

```ts
import { pgTable, uuid, text, numeric, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  monthlyBudget: numeric("monthly_budget", { precision: 10, scale: 2 }).default("0"),
  type: text("type").notNull().default("discretionary"),
  isActive: boolean("is_active").default(true),
  isTemporary: boolean("is_temporary").default(false),
  sortOrder: integer("sort_order").default(0),
  icon: text("icon"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const categoryRules = pgTable("category_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  pattern: text("pattern").notNull().unique(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
  source: text("source").default("user"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

- [ ] **Step 5: Create `src/db/schema/transactions.ts`**

```ts
import { pgTable, uuid, text, numeric, date, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { categories } from "./categories";
import { sql } from "drizzle-orm";

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }).notNull(),
  plaidTransactionId: text("plaid_transaction_id").unique(),
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  merchantName: text("merchant_name"),
  plaidCategory: text("plaid_category").array(),
  portalCategoryId: uuid("portal_category_id").references(() => categories.id, { onDelete: "set null" }),
  transactionType: text("transaction_type").default("expense"),
  isReviewed: boolean("is_reviewed").default(false),
  isAnomaly: boolean("is_anomaly").default(false),
  projectId: uuid("project_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_transactions_date").on(table.date),
  index("idx_transactions_account").on(table.accountId),
  index("idx_transactions_category").on(table.portalCategoryId),
  index("idx_transactions_type").on(table.transactionType),
]);
```

- [ ] **Step 6: Create `src/db/schema/index.ts`**

```ts
export { users } from "./users";
export { plaidItems } from "./plaid-items";
export { accounts } from "./accounts";
export { categories, categoryRules } from "./categories";
export { transactions } from "./transactions";
```

- [ ] **Step 7: Create `src/db/index.ts`**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });
```

- [ ] **Step 8: Verify build**

```bash
npx next build
```

Expected: PASS — schema files exist but no app code imports them yet.

- [ ] **Step 9: Commit**

```bash
git add src/db/
git commit -m "feat: add Drizzle ORM schema and database client"
```

---

## Task 3: Create auth session helpers and API routes

**Files:**
- Create: `src/shared/lib/auth/session.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`

- [ ] **Step 1: Create `src/shared/lib/auth/session.ts`**

```ts
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId: string;
  userName: string;
  isLoggedIn: boolean;
}

const sessionOptions: SessionOptions = {
  password: process.env.IRON_SESSION_SECRET!,
  cookieName: "portal-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.isLoggedIn) return null;
  return { id: session.userId, name: session.userName };
}
```

- [ ] **Step 2: Create `src/app/api/auth/login/route.ts`**

```ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/shared/lib/auth/session";

export async function POST(request: Request) {
  const { pin } = await request.json();

  if (!pin || typeof pin !== "string" || pin.length !== 4) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 400 });
  }

  const allUsers = await db.select().from(users);

  const matchedUser = allUsers.find((u) => bcrypt.compareSync(pin, u.pinHash));

  if (!matchedUser) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const session = await getSession();
  session.userId = matchedUser.id;
  session.userName = matchedUser.name;
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ success: true, name: matchedUser.name });
}
```

- [ ] **Step 3: Create `src/app/api/auth/logout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth/session";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Verify build**

```bash
npx next build
```

Expected: PASS — new API routes are standalone, nothing else imports them yet.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/auth/ src/app/api/auth/
git commit -m "feat: add iron-session auth with PIN login/logout API"
```

---

## Task 4: Replace middleware with iron-session

**Files:**
- Modify: `middleware.ts`
- Delete: `src/shared/lib/supabase/middleware.ts`

- [ ] **Step 1: Rewrite `middleware.ts`**

Replace the entire file:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/shared/lib/auth/session";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const session = await getIronSession<SessionData>(request, response, {
    password: process.env.IRON_SESSION_SECRET!,
    cookieName: "portal-session",
  });

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const isApi = request.nextUrl.pathname.startsWith("/api");

  // API routes handle their own auth — don't redirect them to /login
  if (isApi) {
    return response;
  }

  if (!session.isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session.isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Delete `src/shared/lib/supabase/middleware.ts`**

```bash
rm src/shared/lib/supabase/middleware.ts
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

Expected: PASS — the old middleware.ts was the only consumer of supabase/middleware.ts.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git rm src/shared/lib/supabase/middleware.ts
git commit -m "feat: replace Supabase middleware with iron-session check"
```

---

## Task 5: Replace login page with PIN keypad

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Rewrite login page**

Replace the entire file:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Landmark } from "lucide-react";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDigit = useCallback((digit: string) => {
    setError("");
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + digit;
      if (next.length === 4) {
        submitPin(next);
      }
      return next;
    });
  }, []);

  async function submitPin(code: string) {
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: code }),
    });

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError("Incorrect PIN");
      setPin("");
      setLoading(false);
    }
  }

  const handleBackspace = () => {
    setError("");
    setPin((prev) => prev.slice(0, -1));
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"];

  return (
    <div className="w-full max-w-xs px-6">
      <div className="mb-10 flex flex-col items-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-muted">
          <Landmark size={20} className="text-accent" strokeWidth={2.4} />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-text-primary">
          Smolowe Portal
        </h1>
        <p className="mt-1 text-sm text-text-tertiary">Enter your PIN</p>
      </div>

      <div className="mb-8 flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-3 w-3 rounded-full transition-colors ${
              i < pin.length ? "bg-accent" : "bg-bg-tertiary"
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="mb-4 text-center text-xs text-status-red">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {digits.map((d, i) => {
          if (d === "") return <div key={i} />;
          if (d === "←") {
            return (
              <button
                key={i}
                onClick={handleBackspace}
                disabled={loading || pin.length === 0}
                className="flex h-14 items-center justify-center rounded-xl text-lg text-text-secondary transition-colors hover:bg-bg-tertiary disabled:opacity-30"
              >
                ←
              </button>
            );
          }
          return (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              disabled={loading || pin.length >= 4}
              className="flex h-14 items-center justify-center rounded-xl text-lg font-medium text-text-primary transition-colors hover:bg-bg-tertiary active:bg-bg-elevated disabled:opacity-30"
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build
```

Expected: PASS — login page no longer imports from supabase/client.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/login/page.tsx"
git commit -m "feat: replace email/password login with PIN keypad"
```

---

## Task 6: Replace portal layout auth check

**Files:**
- Modify: `src/app/(portal)/layout.tsx`

- [ ] **Step 1: Rewrite portal layout**

Replace the entire file:

```tsx
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
```

- [ ] **Step 2: Delete `src/shared/lib/supabase/server.ts`**

No other files should import this now — the remaining consumers (queries.ts, services.ts, API routes) will be updated in the next tasks. But check first:

```bash
grep -r "supabase/server" src/ --include="*.ts" --include="*.tsx" -l
```

If files besides `layout.tsx` still import it, keep the file and delete it later in Task 9. Otherwise:

```bash
rm src/shared/lib/supabase/server.ts
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

Expected: If other files still import supabase/server.ts, keep it and the build passes. If deleted, verify those files aren't in the build path.

NOTE: Because `queries.ts`, `services.ts`, and the API routes still import `supabase/server`, DO NOT delete `server.ts` yet. Just update the layout and move on. The Supabase files will all be deleted in Task 9.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(portal)/layout.tsx"
git commit -m "feat: replace Supabase auth check with session in portal layout"
```

---

## Task 7: Rewrite finance queries and services with Drizzle

**Files:**
- Modify: `src/modules/finance/queries.ts`
- Modify: `src/modules/finance/lib/services.ts`

- [ ] **Step 1: Rewrite `src/modules/finance/queries.ts`**

Replace the entire file:

```ts
import { db } from "@/db";
import { accounts, categories, categoryRules, transactions } from "@/db/schema";
import { plaidItems } from "@/db/schema";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import type { Account, Transaction, Category, CategorySpend, MonthSummary, CategoryRule } from "./types";

export async function getAccounts(): Promise<Account[]> {
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      officialName: accounts.officialName,
      type: accounts.type,
      subtype: accounts.subtype,
      currentBalance: accounts.currentBalance,
      availableBalance: accounts.availableBalance,
      institutionName: plaidItems.institutionName,
      lastSyncedAt: plaidItems.lastSyncedAt,
    })
    .from(accounts)
    .leftJoin(plaidItems, eq(accounts.plaidItemId, plaidItems.id))
    .orderBy(accounts.type, accounts.name);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    official_name: r.officialName,
    type: r.type,
    subtype: r.subtype,
    current_balance: r.currentBalance ? Number(r.currentBalance) : null,
    available_balance: r.availableBalance ? Number(r.availableBalance) : null,
    institution_name: r.institutionName ?? "Unknown",
    last_synced_at: r.lastSyncedAt?.toISOString() ?? null,
  }));
}

export async function getRecentTransactions(limit = 15): Promise<Transaction[]> {
  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      merchantName: transactions.merchantName,
      transactionType: transactions.transactionType,
      isReviewed: transactions.isReviewed,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.portalCategoryId, categories.id))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    amount: Number(r.amount),
    merchant_name: r.merchantName,
    transaction_type: r.transactionType as Transaction["transaction_type"],
    is_reviewed: r.isReviewed ?? false,
    category_name: r.categoryName ?? null,
    category_icon: r.categoryIcon ?? null,
  }));
}

export async function getCategories(): Promise<Category[]> {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(categories.sortOrder);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    monthly_budget: Number(r.monthlyBudget),
    type: r.type as Category["type"],
    sort_order: r.sortOrder ?? 0,
    icon: r.icon,
    is_active: r.isActive ?? true,
    is_temporary: r.isTemporary ?? false,
  }));
}

interface RawTransaction {
  amount: number;
  portal_category_id: string | null;
  transaction_type: string;
}

export async function getMonthExpenses(
  startDate: string,
  endDate: string,
): Promise<RawTransaction[]> {
  const rows = await db
    .select({
      amount: transactions.amount,
      portalCategoryId: transactions.portalCategoryId,
      transactionType: transactions.transactionType,
    })
    .from(transactions)
    .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)));

  return rows.map((r) => ({
    amount: Number(r.amount),
    portal_category_id: r.portalCategoryId,
    transaction_type: r.transactionType ?? "expense",
  }));
}

export function buildCategorySpend(
  cats: Category[],
  txns: RawTransaction[],
): CategorySpend[] {
  const spendMap = new Map<string, number>();

  for (const txn of txns) {
    if (txn.transaction_type !== "expense" || !txn.portal_category_id) continue;
    const current = spendMap.get(txn.portal_category_id) ?? 0;
    spendMap.set(txn.portal_category_id, current + Math.abs(txn.amount));
  }

  return cats.map((cat) => ({
    ...cat,
    total_spent: spendMap.get(cat.id) ?? 0,
  }));
}

export function buildMonthSummary(
  cats: Category[],
  txns: RawTransaction[],
): MonthSummary {
  let totalSpent = 0;
  let totalIncome = 0;

  for (const txn of txns) {
    if (txn.transaction_type === "expense") {
      totalSpent += Math.abs(txn.amount);
    } else if (txn.transaction_type === "income") {
      totalIncome += Math.abs(txn.amount);
    }
  }

  const totalBudget = cats.reduce((sum, cat) => sum + cat.monthly_budget, 0);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();

  return { total_spent: totalSpent, total_budget: totalBudget, total_income: totalIncome, days_elapsed: daysElapsed, days_in_month: daysInMonth };
}

export async function getCategoryRules(): Promise<CategoryRule[]> {
  const rows = await db
    .select({
      id: categoryRules.id,
      pattern: categoryRules.pattern,
      categoryId: categoryRules.categoryId,
      source: categoryRules.source,
    })
    .from(categoryRules);

  return rows.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    category_id: r.categoryId,
    source: r.source as "user" | "ai",
  }));
}

export async function upsertCategoryRule(
  pattern: string,
  categoryId: string,
): Promise<void> {
  await db
    .insert(categoryRules)
    .values({ pattern: pattern.toLowerCase(), categoryId, source: "user" })
    .onConflictDoUpdate({
      target: categoryRules.pattern,
      set: { categoryId, source: "user" },
    });
}

export async function getReviewCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(eq(transactions.isReviewed, false));

  return Number(result[0]?.count ?? 0);
}

export async function updateTransaction(
  id: string,
  updates: {
    portal_category_id?: string | null;
    transaction_type?: string;
    notes?: string;
    is_reviewed?: boolean;
  },
): Promise<void> {
  const setValues: Record<string, unknown> = {};
  if (updates.portal_category_id !== undefined) setValues.portalCategoryId = updates.portal_category_id;
  if (updates.transaction_type !== undefined) setValues.transactionType = updates.transaction_type;
  if (updates.notes !== undefined) setValues.notes = updates.notes;
  if (updates.is_reviewed !== undefined) setValues.isReviewed = updates.is_reviewed;

  await db.update(transactions).set(setValues).where(eq(transactions.id, id));
}
```

- [ ] **Step 2: Rewrite `src/modules/finance/lib/services.ts`**

Replace the entire file:

```ts
import { getAccounts, getReviewCount } from "@/modules/finance/queries";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { categories } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import type { Account, Transaction } from "@/modules/finance/types";

export async function getFinanceAccounts(): Promise<Account[]> {
  return getAccounts();
}

export async function getFinanceTransactions(limit = 15): Promise<Transaction[]> {
  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      merchantName: transactions.merchantName,
      transactionType: transactions.transactionType,
      isReviewed: transactions.isReviewed,
      accountId: transactions.accountId,
      plaidTransactionId: transactions.plaidTransactionId,
      plaidCategory: transactions.plaidCategory,
      portalCategoryId: transactions.portalCategoryId,
      isAnomaly: transactions.isAnomaly,
      projectId: transactions.projectId,
      notes: transactions.notes,
      createdAt: transactions.createdAt,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.portalCategoryId, categories.id))
    .orderBy(desc(transactions.date))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    amount: Number(r.amount),
    merchant_name: r.merchantName,
    transaction_type: r.transactionType as Transaction["transaction_type"],
    is_reviewed: r.isReviewed ?? false,
    category_name: r.categoryName ?? null,
    category_icon: r.categoryIcon ?? null,
    category: r.categoryName ? { id: r.portalCategoryId!, name: r.categoryName, monthly_budget: 0, type: "discretionary" as const, sort_order: 0, icon: r.categoryIcon } : undefined,
  }));
}

export async function getFinanceReviewCount(): Promise<number> {
  return getReviewCount();
}
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

Expected: PASS — queries.ts and services.ts no longer import from Supabase. The old Supabase files still exist but are only imported by the API routes and sync-engine (updated next).

- [ ] **Step 4: Commit**

```bash
git add src/modules/finance/queries.ts src/modules/finance/lib/services.ts
git commit -m "feat: rewrite finance queries and services with Drizzle"
```

---

## Task 8: Rewrite sync engine with Drizzle

**Files:**
- Modify: `src/modules/finance/lib/sync-engine.ts`

- [ ] **Step 1: Rewrite `src/modules/finance/lib/sync-engine.ts`**

Replace the entire file:

```ts
import { db } from "@/db";
import { transactions, accounts, plaidItems } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { plaidClient } from "./plaid-client";
import { mapTransaction } from "./category-mapper";
import { getCategories, getCategoryRules } from "@/modules/finance/queries";
import type { RemovedTransaction } from "plaid";

export async function syncPlaidItem(
  plaidItemDbId: string,
  accessToken: string,
  cursor: string | null,
): Promise<{ added: number; modified: number; removed: number; newCursor: string }> {
  const cats = await getCategories();
  const rules = await getCategoryRules();

  let currentCursor = cursor ?? "";
  let hasMore = true;
  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor: currentCursor || undefined,
    });

    const { added, modified, removed, next_cursor, has_more } = response.data;

    for (const txn of added) {
      const plaidPrimary = txn.personal_finance_category?.primary ?? null;
      const plaidDetailed = txn.personal_finance_category?.detailed ?? null;
      const mapped = mapTransaction(
        txn.merchant_name ?? txn.name,
        plaidPrimary,
        plaidDetailed,
        cats,
        rules,
      );

      const [account] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.plaidAccountId, txn.account_id))
        .limit(1);

      if (!account) continue;

      await db
        .insert(transactions)
        .values({
          accountId: account.id,
          plaidTransactionId: txn.transaction_id,
          date: txn.date,
          amount: String(Math.abs(txn.amount)),
          merchantName: txn.merchant_name ?? txn.name,
          plaidCategory: txn.personal_finance_category
            ? [txn.personal_finance_category.primary, txn.personal_finance_category.detailed].filter(Boolean)
            : [],
          portalCategoryId: mapped.categoryId,
          transactionType: mapped.transactionType,
          isReviewed: mapped.isReviewed,
        })
        .onConflictDoUpdate({
          target: transactions.plaidTransactionId,
          set: {
            date: txn.date,
            amount: String(Math.abs(txn.amount)),
            merchantName: txn.merchant_name ?? txn.name,
            portalCategoryId: mapped.categoryId,
            transactionType: mapped.transactionType,
            isReviewed: mapped.isReviewed,
          },
        });
    }
    totalAdded += added.length;

    for (const txn of modified) {
      await db
        .update(transactions)
        .set({
          date: txn.date,
          amount: String(Math.abs(txn.amount)),
          merchantName: txn.merchant_name ?? txn.name,
        })
        .where(eq(transactions.plaidTransactionId, txn.transaction_id));
    }
    totalModified += modified.length;

    const removedIds = removed.map((r: RemovedTransaction) => r.transaction_id);
    if (removedIds.length > 0) {
      await db
        .delete(transactions)
        .where(inArray(transactions.plaidTransactionId, removedIds));
    }
    totalRemoved += removed.length;

    currentCursor = next_cursor;
    hasMore = has_more;
  }

  await db
    .update(plaidItems)
    .set({ cursor: currentCursor, lastSyncedAt: new Date() })
    .where(eq(plaidItems.id, plaidItemDbId));

  try {
    const balanceResponse = await plaidClient.accountsGet({ access_token: accessToken });
    for (const acct of balanceResponse.data.accounts) {
      await db
        .update(accounts)
        .set({
          currentBalance: acct.balances.current != null ? String(acct.balances.current) : null,
          availableBalance: acct.balances.available != null ? String(acct.balances.available) : null,
          lastBalanceUpdate: new Date(),
        })
        .where(eq(accounts.plaidAccountId, acct.account_id));
    }
  } catch {
    // Balance update is best-effort
  }

  return {
    added: totalAdded,
    modified: totalModified,
    removed: totalRemoved,
    newCursor: currentCursor,
  };
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build
```

Expected: PASS — sync-engine now uses Drizzle. Note: API routes still import Supabase but those files still exist.

- [ ] **Step 3: Commit**

```bash
git add src/modules/finance/lib/sync-engine.ts
git commit -m "feat: rewrite sync engine with Drizzle"
```

---

## Task 9: Rewrite all API routes with Drizzle + session auth

**Files:**
- Modify: `src/app/api/plaid/create-link-token/route.ts`
- Modify: `src/app/api/plaid/exchange-token/route.ts`
- Modify: `src/app/api/plaid/sync/route.ts`
- Modify: `src/app/api/cron/sync-transactions/route.ts`

- [ ] **Step 1: Rewrite `src/app/api/plaid/create-link-token/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { plaidClient } from "@/modules/finance/lib/plaid-client";
import { CountryCode, Products } from "plaid";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: user.id },
    client_name: "Smolowe Portal",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });

  return NextResponse.json({ link_token: response.data.link_token });
}
```

- [ ] **Step 2: Rewrite `src/app/api/plaid/exchange-token/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { plaidClient } from "@/modules/finance/lib/plaid-client";
import { syncPlaidItem } from "@/modules/finance/lib/sync-engine";
import { db } from "@/db";
import { plaidItems, accounts } from "@/db/schema";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { public_token, institution } = await request.json();

  const exchangeResponse = await plaidClient.itemPublicTokenExchange({
    public_token,
  });

  const { access_token, item_id } = exchangeResponse.data;

  const [plaidItem] = await db
    .insert(plaidItems)
    .values({
      userId: user.id,
      accessToken: access_token,
      plaidItemId: item_id,
      institutionName: institution?.name ?? "Unknown",
      institutionId: institution?.institution_id ?? null,
    })
    .returning({ id: plaidItems.id });

  if (!plaidItem) {
    return NextResponse.json(
      { error: "Failed to save bank connection" },
      { status: 500 },
    );
  }

  const accountsResponse = await plaidClient.accountsGet({ access_token });

  for (const acct of accountsResponse.data.accounts) {
    await db
      .insert(accounts)
      .values({
        plaidItemId: plaidItem.id,
        plaidAccountId: acct.account_id,
        name: acct.name,
        officialName: acct.official_name,
        type: acct.type,
        subtype: acct.subtype,
        currentBalance: acct.balances.current != null ? String(acct.balances.current) : null,
        availableBalance: acct.balances.available != null ? String(acct.balances.available) : null,
        isoCurrencyCode: acct.balances.iso_currency_code ?? "USD",
        lastBalanceUpdate: new Date(),
      })
      .onConflictDoUpdate({
        target: accounts.plaidAccountId,
        set: {
          currentBalance: acct.balances.current != null ? String(acct.balances.current) : null,
          availableBalance: acct.balances.available != null ? String(acct.balances.available) : null,
          lastBalanceUpdate: new Date(),
        },
      });
  }

  const syncResult = await syncPlaidItem(plaidItem.id, access_token, null);

  return NextResponse.json({
    success: true,
    accounts: accountsResponse.data.accounts.length,
    transactions: syncResult.added,
  });
}
```

- [ ] **Step 3: Rewrite `src/app/api/plaid/sync/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { syncPlaidItem } from "@/modules/finance/lib/sync-engine";
import { db } from "@/db";
import { plaidItems, transactions, categoryRules } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plaid_item_id } = await request.json();

  const [item] = await db
    .select({
      id: plaidItems.id,
      accessToken: plaidItems.accessToken,
      cursor: plaidItems.cursor,
    })
    .from(plaidItems)
    .where(and(eq(plaidItems.id, plaid_item_id), eq(plaidItems.userId, user.id)))
    .limit(1);

  if (!item || !item.accessToken) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const result = await syncPlaidItem(item.id, item.accessToken, item.cursor);

  return NextResponse.json({ success: true, ...result });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transaction_id, portal_category_id, transaction_type, notes, is_reviewed } =
    await request.json();

  if (!transaction_id) {
    return NextResponse.json({ error: "Missing transaction_id" }, { status: 400 });
  }

  const setValues: Record<string, unknown> = {};
  if (portal_category_id !== undefined) setValues.portalCategoryId = portal_category_id;
  if (transaction_type !== undefined) setValues.transactionType = transaction_type;
  if (notes !== undefined) setValues.notes = notes;
  if (is_reviewed !== undefined) setValues.isReviewed = is_reviewed;

  await db.update(transactions).set(setValues).where(eq(transactions.id, transaction_id));

  if (portal_category_id) {
    const [txn] = await db
      .select({ merchantName: transactions.merchantName })
      .from(transactions)
      .where(eq(transactions.id, transaction_id))
      .limit(1);

    if (txn?.merchantName) {
      await db
        .insert(categoryRules)
        .values({
          pattern: txn.merchantName.toLowerCase(),
          categoryId: portal_category_id,
          source: "user",
          createdBy: user.id,
        })
        .onConflictDoUpdate({
          target: categoryRules.pattern,
          set: { categoryId: portal_category_id, source: "user" },
        });
    }
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Rewrite `src/app/api/cron/sync-transactions/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { plaidItems } from "@/db/schema";
import { syncPlaidItem } from "@/modules/finance/lib/sync-engine";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db
    .select({
      id: plaidItems.id,
      accessToken: plaidItems.accessToken,
      cursor: plaidItems.cursor,
    })
    .from(plaidItems);

  if (items.length === 0) {
    return NextResponse.json({ message: "No items to sync" });
  }

  const results = [];
  for (const item of items) {
    if (!item.accessToken) continue;
    try {
      const result = await syncPlaidItem(item.id, item.accessToken, item.cursor);
      results.push({ id: item.id, ...result });
    } catch (err) {
      results.push({
        id: item.id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ synced: results });
}
```

- [ ] **Step 5: Verify build**

```bash
npx next build
```

Expected: PASS — all API routes now use Drizzle + session. No app code imports Supabase anymore.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/
git commit -m "feat: rewrite all API routes with Drizzle and session auth"
```

---

## Task 10: Remove Supabase completely

**Files:**
- Delete: `src/shared/lib/supabase/server.ts`
- Delete: `src/shared/lib/supabase/client.ts`
- Delete: `src/shared/lib/supabase/admin.ts`
- Modify: `package.json` (remove Supabase packages)

- [ ] **Step 1: Verify no remaining Supabase imports**

```bash
grep -r "supabase" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: No files found (or only `types/index.ts` which uses the word in comments, not imports).

- [ ] **Step 2: Delete Supabase library files**

```bash
rm src/shared/lib/supabase/server.ts
rm src/shared/lib/supabase/client.ts
rm src/shared/lib/supabase/admin.ts
rmdir src/shared/lib/supabase
```

- [ ] **Step 3: Remove Supabase packages**

```bash
npm uninstall @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 4: Verify build**

```bash
npx next build
```

Expected: PASS — Supabase is fully removed.

- [ ] **Step 5: Commit**

```bash
git rm -r src/shared/lib/supabase/
git add package.json package-lock.json
git commit -m "chore: remove Supabase dependencies completely"
```

---

## Task 11: Docker and standalone configuration

**Files:**
- Modify: `next.config.ts`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Update `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 2: Create `.dockerignore`**

```
node_modules
.next
.git
.claude
.env
.env.local
*.md
```

- [ ] **Step 3: Create `Dockerfile`**

```dockerfile
FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx next build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

- [ ] **Step 4: Create `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: smolowe-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: portal
      POSTGRES_USER: portal
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U portal"]
      interval: 5s
      timeout: 3s
      retries: 5

  portal:
    build: .
    container_name: smolowe-portal
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://portal:${DB_PASSWORD}@db:5432/portal
      IRON_SESSION_SECRET: ${IRON_SESSION_SECRET}
      PLAID_CLIENT_ID: ${PLAID_CLIENT_ID}
      PLAID_SECRET: ${PLAID_SECRET}
      PLAID_ENV: ${PLAID_ENV}
      CRON_SECRET: ${CRON_SECRET}
    ports:
      - "3000:3000"

  tunnel:
    image: cloudflare/cloudflared:latest
    container_name: smolowe-tunnel
    restart: unless-stopped
    command: tunnel run
    environment:
      TUNNEL_TOKEN: ${CLOUDFLARE_TOKEN}
    depends_on:
      - portal

volumes:
  pgdata:
```

- [ ] **Step 5: Verify build**

```bash
npx next build
```

Expected: PASS — standalone output mode enabled.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts Dockerfile docker-compose.yml .dockerignore
git commit -m "feat: add Docker and standalone configuration for NAS deployment"
```

---

## Task 12: Update PWA manifest and dashboard

**Files:**
- Modify: `src/app/manifest.ts`
- Modify: `src/app/(portal)/dashboard/page.tsx`

- [ ] **Step 1: Update `src/app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smolowe Household Portal",
    short_name: "Portal",
    description: "Smolowe household management",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0A0A0B",
    theme_color: "#0A0A0B",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
```

- [ ] **Step 2: Update `src/app/(portal)/dashboard/page.tsx`**

```tsx
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border-default bg-bg-secondary p-6 sm:p-8">
        <h2 className="text-base font-semibold tracking-tight text-text-primary">
          Welcome home
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Your household portal is running on the NAS. Add modules and
          pages from here.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <StatusCard label="Auth" value="PIN Login" status="green" />
        <StatusCard label="Database" value="PostgreSQL" status="green" />
        <StatusCard label="Hosting" value="Self-hosted" status="green" />
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "green" | "red";
}) {
  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary px-5 py-4">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            status === "green" ? "bg-status-green" : "bg-status-red"
          }`}
        />
        <p className="text-xs font-medium text-text-tertiary">{label}</p>
      </div>
      <p className="mt-1.5 text-base font-semibold tracking-tight text-text-primary">
        {value}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/manifest.ts "src/app/(portal)/dashboard/page.tsx"
git commit -m "feat: update PWA manifest and dashboard for self-hosted deployment"
```

---

## Task 13: Create seed script and backup script

**Files:**
- Create: `scripts/seed.ts`
- Create: `scripts/backup.sh`

- [ ] **Step 1: Create `scripts/seed.ts`**

```ts
import postgres from "postgres";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function seed() {
  console.log("Seeding users...");

  const alexHash = bcrypt.hashSync("1152", 10);
  const emineHash = bcrypt.hashSync("5238", 10);

  await sql`
    INSERT INTO users (name, pin_hash, role)
    VALUES ('Alex', ${alexHash}, 'admin'), ('Emine', ${emineHash}, 'admin')
    ON CONFLICT DO NOTHING
  `;

  console.log("Seeding categories...");

  await sql`
    INSERT INTO categories (name, type, sort_order, icon)
    VALUES
      ('Dining/Delivery', 'discretionary', 1, 'utensils-crossed'),
      ('Groceries', 'discretionary', 2, 'shopping-cart'),
      ('Shopping', 'discretionary', 3, 'shopping-bag'),
      ('Transportation', 'discretionary', 4, 'car'),
      ('Entertainment', 'discretionary', 5, 'film'),
      ('Home', 'discretionary', 6, 'home'),
      ('Personal', 'discretionary', 7, 'user'),
      ('Rent/Mortgage', 'fixed', 10, 'building'),
      ('Utilities', 'fixed', 11, 'zap'),
      ('Insurance', 'fixed', 12, 'shield'),
      ('Subscriptions', 'fixed', 13, 'repeat')
    ON CONFLICT DO NOTHING
  `;

  console.log("Seed complete.");
  await sql.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Create `scripts/backup.sh`**

```bash
#!/bin/bash
# Daily pg_dump backup with 7-day retention
# Schedule via Synology DSM Task Scheduler at 3:00 AM

BACKUP_DIR="/volume1/backups/portal"
CONTAINER="smolowe-db"
DB_USER="portal"
DB_NAME="portal"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

FILENAME="portal-$(date +%Y%m%d).sql.gz"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/$FILENAME"

if [ $? -eq 0 ]; then
  echo "Backup saved: $BACKUP_DIR/$FILENAME"
else
  echo "Backup FAILED" >&2
  exit 1
fi

find "$BACKUP_DIR" -name "portal-*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
echo "Cleaned backups older than $RETENTION_DAYS days"
```

- [ ] **Step 3: Make backup script executable**

```bash
chmod +x scripts/backup.sh
```

- [ ] **Step 4: Add a seed npm script to `package.json`**

Add to the `"scripts"` section:

```json
"seed": "npx tsx scripts/seed.ts"
```

- [ ] **Step 5: Install tsx as dev dependency**

```bash
npm install -D tsx
```

- [ ] **Step 6: Verify build**

```bash
npx next build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/ package.json package-lock.json
git commit -m "feat: add database seed script and backup script"
```

---

## Task 14: Clean up unused types

**Files:**
- Modify: `src/modules/finance/types/index.ts`

- [ ] **Step 1: Remove unused types from `src/modules/finance/types/index.ts`**

Remove types that referenced deleted Supabase features: `Profile`, `AlertTriggerType`, `AlertChannel`, `AiConversationChannel`, `ProfileUpdatedBy`, `FinancialProfile`, `AlertRule`, `AlertLog`, `BudgetSummary`, `CategoryBudgetStatus`.

Keep: `TransactionType`, `CategoryType`, `PaceStatus`, `PlaidItem`, `Account`, `Transaction`, `Category`, `CategoryRule`, `Project`, `CategorySpend`, `MonthSummary`.

```ts
export type TransactionType = "expense" | "income" | "savings_transfer" | "internal_transfer";
export type CategoryType = "fixed" | "discretionary";
export type PaceStatus = "green" | "yellow" | "orange" | "red";

export interface PlaidItem {
  id: string;
  user_id: string;
  access_token: string | null;
  plaid_item_id: string | null;
  institution_name: string;
  institution_id: string | null;
  module_context: "household" | "llc";
  cursor: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface Account {
  id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  current_balance: number | null;
  available_balance: number | null;
  plaid_item_id?: string;
  plaid_account_id?: string;
  iso_currency_code?: string;
  last_balance_update?: string | null;
  created_at?: string;
  institution_name?: string;
  last_synced_at?: string | null;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  merchant_name: string | null;
  transaction_type: TransactionType;
  is_reviewed: boolean;
  account_id?: string;
  plaid_transaction_id?: string | null;
  plaid_category?: string[] | null;
  portal_category_id?: string | null;
  is_anomaly?: boolean;
  project_id?: string | null;
  notes?: string | null;
  created_at?: string;
  category_name?: string | null;
  category_icon?: string | null;
  category?: Category;
  account?: Account;
}

export interface Category {
  id: string;
  name: string;
  monthly_budget: number;
  type: CategoryType;
  sort_order: number;
  icon: string | null;
  is_active?: boolean;
  is_temporary?: boolean;
  created_at?: string;
}

export interface CategoryRule {
  id: string;
  pattern: string;
  category_id: string;
  source: "user" | "ai";
  created_by?: string | null;
  created_at?: string;
}

export interface Project {
  id: string;
  name: string;
  estimated_budget: number | null;
  is_active: boolean;
  created_at: string;
  closed_at: string | null;
  notes: string | null;
}

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

- [ ] **Step 2: Verify build**

```bash
npx next build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/modules/finance/types/index.ts
git commit -m "chore: remove unused Supabase-era types"
```
