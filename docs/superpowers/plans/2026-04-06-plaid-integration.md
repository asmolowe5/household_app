# Plaid Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect real bank accounts via Plaid, sync transactions daily, and auto-categorize spending with a review queue.

**Architecture:** Next.js API routes handle all Plaid communication. Vercel cron triggers a daily sync. A categorization pipeline auto-assigns categories using merchant rules and Plaid's category data, flagging uncertain ones for manual review.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + Auth), Plaid Node SDK, react-plaid-link, Vercel cron, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-04-06-plaid-integration-design.md`

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `src/modules/finance/lib/plaid-client.ts` | Initialize and export the Plaid SDK client |
| `src/modules/finance/lib/category-mapper.ts` | Map Plaid categories to portal categories + merchant rule lookup |
| `src/modules/finance/lib/sync-engine.ts` | Core sync logic: pull transactions from Plaid, upsert into DB, run categorization |
| `src/app/api/plaid/create-link-token/route.ts` | API route: generate a Plaid Link token for the frontend |
| `src/app/api/plaid/exchange-token/route.ts` | API route: exchange public token for access token, store item, initial sync |
| `src/app/api/plaid/sync/route.ts` | API route: sync a single plaid item (used by cron and manual refresh) |
| `src/app/api/cron/sync-transactions/route.ts` | API route: Vercel cron entry point, syncs all plaid items |
| `src/modules/finance/components/plaid-link-button.tsx` | "Connect Account" button that opens the Plaid Link modal |
| `src/modules/finance/components/empty-state.tsx` | Shown on finances page when no accounts are connected |
| `src/modules/finance/components/review-badge.tsx` | Badge showing count of transactions needing review |
| `src/modules/finance/components/transaction-detail.tsx` | Slide-over panel for viewing/editing a single transaction |

### Existing files to modify

| File | Changes |
|------|---------|
| `package.json` | Add `plaid` and `react-plaid-link` dependencies |
| `.env.local` | Add `PLAID_CLIENT_ID`, `PLAID_SECRET` values (user does this manually) |
| `vercel.json` | Add cron schedule for daily sync |
| `src/modules/finance/queries.ts` | Add queries for category rules, review queue count, transaction updates; update `getAccounts` to include `last_synced_at` |
| `src/modules/finance/types.ts` | Add `last_synced_at` to Account type; add CategoryRule type |
| `src/app/(portal)/finances/page.tsx` | Add empty state, review filter, transaction tap handler, Plaid Link button |

---

## Task 1: Install Plaid dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the Plaid SDK and React Plaid Link**

```bash
cd C:/Users/asmol/Dev/Projects/Smolowe_Household_Portal
npm install plaid react-plaid-link
```

- [ ] **Step 2: Verify the build still works**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add plaid and react-plaid-link dependencies"
```

---

## Task 2: Create the Plaid client

**Files:**
- Create: `src/modules/finance/lib/plaid-client.ts`

This file initializes the Plaid SDK so every API route can import it.

- [ ] **Step 1: Create the Plaid client module**

```ts
// src/modules/finance/lib/plaid-client.ts
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const configuration = new Configuration({
  basePath:
    PlaidEnvironments[
      (process.env.PLAID_ENV as "sandbox" | "production") ?? "sandbox"
    ],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
      "PLAID-SECRET": process.env.PLAID_SECRET!,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
```

- [ ] **Step 2: Verify the build still works**

```bash
npm run build
```

Expected: Build succeeds. The module only runs server-side (API routes), so missing env vars during build are fine — they're read at runtime.

- [ ] **Step 3: Commit**

```bash
git add src/modules/finance/lib/plaid-client.ts
git commit -m "feat: Plaid SDK client initialization"
```

---

## Task 3: Create Link Token API route

**Files:**
- Create: `src/app/api/plaid/create-link-token/route.ts`

This route generates a temporary token that the frontend needs to open the Plaid bank-connection popup.

- [ ] **Step 1: Create the route**

```ts
// src/app/api/plaid/create-link-token/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { plaidClient } from "@/modules/finance/lib/plaid-client";
import { CountryCode, Products } from "plaid";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

- [ ] **Step 2: Verify the build still works**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/plaid/create-link-token/route.ts
git commit -m "feat: API route to create Plaid Link token"
```

---

## Task 4: Create Exchange Token API route + initial sync

**Files:**
- Create: `src/app/api/plaid/exchange-token/route.ts`
- Create: `src/modules/finance/lib/sync-engine.ts`
- Create: `src/modules/finance/lib/category-mapper.ts`
- Modify: `src/modules/finance/types.ts`
- Modify: `src/modules/finance/queries.ts`

This is the biggest task. When the user finishes connecting their bank in the Plaid popup, this route receives a temporary token, swaps it for a permanent one, saves the bank info, and pulls in all the transactions.

- [ ] **Step 1: Add new types**

Add to the bottom of `src/modules/finance/types.ts`:

```ts
export interface CategoryRule {
  id: string;
  pattern: string;
  category_id: string;
  source: "user" | "ai";
}
```

Also add `last_synced_at` to the existing `Account` interface:

```ts
export interface Account {
  id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  current_balance: number | null;
  available_balance: number | null;
  institution_name: string;
  last_synced_at: string | null;
}
```

- [ ] **Step 2: Add new queries**

Add to the bottom of `src/modules/finance/queries.ts`:

```ts
export async function getCategoryRules(
  supabase: SupabaseClient,
): Promise<CategoryRule[]> {
  const { data, error } = await supabase
    .from("category_rules")
    .select("id, pattern, category_id, source");

  if (error || !data) return [];
  return data as CategoryRule[];
}

export async function upsertCategoryRule(
  supabase: SupabaseClient,
  pattern: string,
  categoryId: string,
): Promise<void> {
  await supabase
    .from("category_rules")
    .upsert(
      { pattern: pattern.toLowerCase(), category_id: categoryId, source: "user" },
      { onConflict: "pattern" },
    );
}

export async function getReviewCount(
  supabase: SupabaseClient,
): Promise<number> {
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("is_reviewed", false);

  return count ?? 0;
}

export async function updateTransaction(
  supabase: SupabaseClient,
  id: string,
  updates: {
    portal_category_id?: string | null;
    transaction_type?: string;
    notes?: string;
    is_reviewed?: boolean;
  },
): Promise<void> {
  await supabase.from("transactions").update(updates).eq("id", id);
}
```

Note: this requires adding `import type { CategoryRule } from "./types";` to the imports at the top of `queries.ts`.

Also update the existing `getAccounts` function to include `last_synced_at` from the parent `plaid_items` row. Change the select to:

```ts
.select("id, name, official_name, type, subtype, current_balance, available_balance, plaid_items(institution_name, last_synced_at)")
```

And in the `.map()` return, add:

```ts
last_synced_at:
  (row.plaid_items as { institution_name: string; last_synced_at: string | null } | null)?.last_synced_at ?? null,
```

- [ ] **Step 3: Create the category mapper**

```ts
// src/modules/finance/lib/category-mapper.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, CategoryRule } from "@/modules/finance/types";

// Maps Plaid's personal_finance_category.primary to portal category names
const PRIMARY_MAP: Record<string, string> = {
  FOOD_AND_DRINK: "Dining/Delivery",
  TRANSPORTATION: "Transportation",
  ENTERTAINMENT: "Entertainment",
};

// More specific: maps Plaid detailed categories to portal category names
const DETAILED_MAP: Record<string, string> = {
  GENERAL_MERCHANDISE_SUPERSTORES: "Groceries",
  GENERAL_MERCHANDISE_GROCERIES: "Groceries",
  RENT_AND_UTILITIES_RENT: "Rent/Mortgage",
  RENT_AND_UTILITIES_MORTGAGE: "Rent/Mortgage",
  RENT_AND_UTILITIES_GAS: "Utilities",
  RENT_AND_UTILITIES_ELECTRIC: "Utilities",
  RENT_AND_UTILITIES_WATER: "Utilities",
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: "Utilities",
  RENT_AND_UTILITIES_TELEPHONE: "Utilities",
  RENT_AND_UTILITIES_INTERNET: "Utilities",
  LOAN_PAYMENTS_INSURANCE_PAYMENT: "Insurance",
  GENERAL_SERVICES_INSURANCE: "Insurance",
  GENERAL_SERVICES_SUBSCRIPTION: "Subscriptions",
};

// Plaid categories that indicate transaction type, not spending category
const TYPE_MAP: Record<string, string> = {
  INCOME: "income",
  TRANSFER_IN: "internal_transfer",
  TRANSFER_OUT: "internal_transfer",
};

interface MapResult {
  categoryId: string | null;
  transactionType: "expense" | "income" | "internal_transfer" | "savings_transfer";
  isReviewed: boolean;
}

export function mapTransaction(
  merchantName: string | null,
  plaidPrimary: string | null,
  plaidDetailed: string | null,
  categories: Category[],
  rules: CategoryRule[],
): MapResult {
  const defaultResult: MapResult = {
    categoryId: null,
    transactionType: "expense",
    isReviewed: false,
  };

  // Check if this is a non-expense transaction type
  if (plaidPrimary && TYPE_MAP[plaidPrimary]) {
    return {
      categoryId: null,
      transactionType: TYPE_MAP[plaidPrimary] as MapResult["transactionType"],
      isReviewed: true,
    };
  }

  // Priority 1: Known merchant rule
  if (merchantName) {
    const lowerMerchant = merchantName.toLowerCase();
    const rule = rules.find((r) => lowerMerchant.includes(r.pattern.toLowerCase()));
    if (rule) {
      return {
        categoryId: rule.category_id,
        transactionType: "expense",
        isReviewed: true,
      };
    }
  }

  // Priority 2: Plaid detailed category mapping
  if (plaidDetailed && DETAILED_MAP[plaidDetailed]) {
    const portalName = DETAILED_MAP[plaidDetailed];
    const cat = categories.find((c) => c.name === portalName);
    if (cat) {
      return { categoryId: cat.id, transactionType: "expense", isReviewed: false };
    }
  }

  // Priority 3: Plaid primary category mapping
  if (plaidPrimary && PRIMARY_MAP[plaidPrimary]) {
    const portalName = PRIMARY_MAP[plaidPrimary];
    const cat = categories.find((c) => c.name === portalName);
    if (cat) {
      return { categoryId: cat.id, transactionType: "expense", isReviewed: false };
    }
  }

  // Priority 4: No match — uncategorized, needs review
  return defaultResult;
}
```

- [ ] **Step 4: Create the sync engine**

```ts
// src/modules/finance/lib/sync-engine.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { plaidClient } from "./plaid-client";
import { mapTransaction } from "./category-mapper";
import { getCategories, getCategoryRules } from "@/modules/finance/queries";
import type { RemovedTransaction } from "plaid";

export async function syncPlaidItem(
  supabase: SupabaseClient,
  plaidItemId: string,
  accessToken: string,
  cursor: string | null,
): Promise<{ added: number; modified: number; removed: number; newCursor: string }> {
  const categories = await getCategories(supabase);
  const rules = await getCategoryRules(supabase);

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

    // Upsert added transactions
    for (const txn of added) {
      const plaidPrimary = txn.personal_finance_category?.primary ?? null;
      const plaidDetailed = txn.personal_finance_category?.detailed ?? null;
      const mapped = mapTransaction(
        txn.merchant_name ?? txn.name,
        plaidPrimary,
        plaidDetailed,
        categories,
        rules,
      );

      // Find the account in our DB by Plaid account ID
      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("plaid_account_id", txn.account_id)
        .single();

      if (!account) continue;

      await supabase.from("transactions").upsert(
        {
          account_id: account.id,
          plaid_transaction_id: txn.transaction_id,
          date: txn.date,
          amount: Math.abs(txn.amount),
          merchant_name: txn.merchant_name ?? txn.name,
          plaid_category: txn.personal_finance_category
            ? [txn.personal_finance_category.primary, txn.personal_finance_category.detailed].filter(Boolean)
            : [],
          portal_category_id: mapped.categoryId,
          transaction_type: mapped.transactionType,
          is_reviewed: mapped.isReviewed,
        },
        { onConflict: "plaid_transaction_id" },
      );
    }
    totalAdded += added.length;

    // Upsert modified transactions
    for (const txn of modified) {
      await supabase
        .from("transactions")
        .update({
          date: txn.date,
          amount: Math.abs(txn.amount),
          merchant_name: txn.merchant_name ?? txn.name,
        })
        .eq("plaid_transaction_id", txn.transaction_id);
    }
    totalModified += modified.length;

    // Remove deleted transactions
    const removedIds = removed.map((r: RemovedTransaction) => r.transaction_id);
    if (removedIds.length > 0) {
      await supabase
        .from("transactions")
        .delete()
        .in("plaid_transaction_id", removedIds);
    }
    totalRemoved += removed.length;

    currentCursor = next_cursor;
    hasMore = has_more;
  }

  // Update the cursor and last synced time on the plaid item
  await supabase
    .from("plaid_items")
    .update({ cursor: currentCursor, last_synced_at: new Date().toISOString() })
    .eq("id", plaidItemId);

  // Update account balances
  try {
    const balanceResponse = await plaidClient.accountsGet({ access_token: accessToken });
    for (const acct of balanceResponse.data.accounts) {
      await supabase
        .from("accounts")
        .update({
          current_balance: acct.balances.current,
          available_balance: acct.balances.available,
          last_balance_update: new Date().toISOString(),
        })
        .eq("plaid_account_id", acct.account_id);
    }
  } catch {
    // Balance update is best-effort; don't fail the whole sync
  }

  return {
    added: totalAdded,
    modified: totalModified,
    removed: totalRemoved,
    newCursor: currentCursor,
  };
}
```

- [ ] **Step 5: Create the exchange token route**

```ts
// src/app/api/plaid/exchange-token/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { plaidClient } from "@/modules/finance/lib/plaid-client";
import { syncPlaidItem } from "@/modules/finance/lib/sync-engine";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { public_token, institution } = await request.json();

  // Exchange the public token for a permanent access token
  const exchangeResponse = await plaidClient.itemPublicTokenExchange({
    public_token,
  });

  const { access_token, item_id } = exchangeResponse.data;

  // Save the plaid item
  const { data: plaidItem, error: insertError } = await supabase
    .from("plaid_items")
    .insert({
      user_id: user.id,
      access_token,
      plaid_item_id: item_id,
      institution_name: institution?.name ?? "Unknown",
      institution_id: institution?.institution_id ?? null,
    })
    .select("id")
    .single();

  if (insertError || !plaidItem) {
    return NextResponse.json(
      { error: "Failed to save bank connection" },
      { status: 500 },
    );
  }

  // Fetch and save the accounts for this item
  const accountsResponse = await plaidClient.accountsGet({
    access_token,
  });

  for (const acct of accountsResponse.data.accounts) {
    await supabase.from("accounts").upsert(
      {
        plaid_item_id: plaidItem.id,
        plaid_account_id: acct.account_id,
        name: acct.name,
        official_name: acct.official_name,
        type: acct.type,
        subtype: acct.subtype,
        current_balance: acct.balances.current,
        available_balance: acct.balances.available,
        iso_currency_code: acct.balances.iso_currency_code ?? "USD",
        last_balance_update: new Date().toISOString(),
      },
      { onConflict: "plaid_account_id" },
    );
  }

  // Run the initial transaction sync
  const syncResult = await syncPlaidItem(
    supabase,
    plaidItem.id,
    access_token,
    null,
  );

  return NextResponse.json({
    success: true,
    accounts: accountsResponse.data.accounts.length,
    transactions: syncResult.added,
  });
}
```

- [ ] **Step 6: Verify the build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/modules/finance/lib/plaid-client.ts src/modules/finance/lib/category-mapper.ts src/modules/finance/lib/sync-engine.ts src/app/api/plaid/exchange-token/route.ts src/modules/finance/types.ts src/modules/finance/queries.ts
git commit -m "feat: Plaid token exchange, sync engine, and auto-categorization"
```

---

## Task 5: Create the manual sync and cron API routes

**Files:**
- Create: `src/app/api/plaid/sync/route.ts`
- Create: `src/app/api/cron/sync-transactions/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the manual sync route**

```ts
// src/app/api/plaid/sync/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { syncPlaidItem } from "@/modules/finance/lib/sync-engine";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plaid_item_id } = await request.json();

  const { data: item } = await supabase
    .from("plaid_items")
    .select("id, access_token, cursor")
    .eq("id", plaid_item_id)
    .eq("user_id", user.id)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const result = await syncPlaidItem(
    supabase,
    item.id,
    item.access_token,
    item.cursor,
  );

  return NextResponse.json({ success: true, ...result });
}
```

- [ ] **Step 2: Create the cron sync route**

```ts
// src/app/api/cron/sync-transactions/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { syncPlaidItem } from "@/modules/finance/lib/sync-engine";

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use admin client since cron has no user session
  const supabase = createAdminClient();

  const { data: items } = await supabase
    .from("plaid_items")
    .select("id, access_token, cursor");

  if (!items || items.length === 0) {
    return NextResponse.json({ message: "No items to sync" });
  }

  const results = [];
  for (const item of items) {
    try {
      const result = await syncPlaidItem(
        supabase,
        item.id,
        item.access_token,
        item.cursor,
      );
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

- [ ] **Step 3: Update vercel.json with the cron schedule**

Replace the contents of `vercel.json` with:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-transactions",
      "schedule": "0 10 * * *"
    }
  ]
}
```

Note: `0 10 * * *` is 10:00 UTC = 5:00 AM ET (during daylight saving time) / 6:00 AM ET (standard time).

- [ ] **Step 4: Verify the build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/plaid/sync/route.ts src/app/api/cron/sync-transactions/route.ts vercel.json
git commit -m "feat: manual sync route and Vercel cron daily sync"
```

---

## Task 6: Plaid Link button component

**Files:**
- Create: `src/modules/finance/components/plaid-link-button.tsx`

This is the button that opens the Plaid bank-connection popup in the browser.

- [ ] **Step 1: Create the component**

```tsx
// src/modules/finance/components/plaid-link-button.tsx
"use client";

import { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

interface PlaidLinkButtonProps {
  variant?: "primary" | "secondary";
}

export function PlaidLinkButton({ variant = "primary" }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function fetchLinkToken() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const data = await res.json();
      if (data.link_token) {
        setLinkToken(data.link_token);
      } else {
        setError("Could not connect to Plaid");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const onSuccess = useCallback(
    async (publicToken: string, metadata: { institution?: { name?: string; institution_id?: string } | null }) => {
      setLoading(true);
      try {
        await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution: metadata.institution,
          }),
        });
        router.refresh();
      } catch {
        setError("Failed to connect account");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  // If we have a link token and Plaid is ready, open the modal
  if (linkToken && ready) {
    // Auto-open on next render
    setTimeout(() => open(), 0);
  }

  if (variant === "secondary") {
    return (
      <button
        onClick={fetchLinkToken}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent-muted disabled:opacity-50"
      >
        <Plus size={14} />
        {loading ? "Connecting..." : "Add Account"}
      </button>
    );
  }

  return (
    <div className="text-center">
      <button
        onClick={fetchLinkToken}
        disabled={loading}
        className="rounded-xl bg-gradient-to-r from-accent to-accent-strong px-6 py-3 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Connecting..." : "Connect Your Bank"}
      </button>
      {error && <p className="mt-2 text-xs text-status-red">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/modules/finance/components/plaid-link-button.tsx
git commit -m "feat: Plaid Link button component"
```

---

## Task 7: Empty state and review badge components

**Files:**
- Create: `src/modules/finance/components/empty-state.tsx`
- Create: `src/modules/finance/components/review-badge.tsx`

- [ ] **Step 1: Create the empty state component**

Shown when the user has no bank accounts connected yet.

```tsx
// src/modules/finance/components/empty-state.tsx
import { Landmark } from "lucide-react";
import { PlaidLinkButton } from "./plaid-link-button";

export function FinancesEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border-default bg-bg-secondary px-6 py-16">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted">
        <Landmark size={24} className="text-accent" />
      </div>
      <h2 className="text-base font-semibold text-text-primary">
        Connect your first bank account
      </h2>
      <p className="mt-2 max-w-xs text-center text-sm text-text-secondary">
        Link a bank account to start tracking your spending, budgets, and transactions automatically.
      </p>
      <div className="mt-6">
        <PlaidLinkButton />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the review badge component**

```tsx
// src/modules/finance/components/review-badge.tsx
interface ReviewBadgeProps {
  count: number;
}

export function ReviewBadge({ count }: ReviewBadgeProps) {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-medium text-accent">
      {count > 99 ? "99+" : count}
    </span>
  );
}
```

- [ ] **Step 3: Verify the build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/modules/finance/components/empty-state.tsx src/modules/finance/components/review-badge.tsx
git commit -m "feat: finances empty state and review badge components"
```

---

## Task 8: Transaction detail slide-over panel

**Files:**
- Create: `src/modules/finance/components/transaction-detail.tsx`

This is the panel that opens when you tap a transaction. Read-only by default, with an explicit Edit button.

- [ ] **Step 1: Create the component**

```tsx
// src/modules/finance/components/transaction-detail.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil } from "lucide-react";
import type { Transaction, Category } from "@/modules/finance/types";
import { formatCurrencyPrecise, formatDate } from "@/shared/lib/utils";

interface TransactionDetailProps {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
}

export function TransactionDetail({
  transaction,
  categories,
  onClose,
}: TransactionDetailProps) {
  const [editing, setEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(
    transaction.category_name ?? "",
  );
  const [txnType, setTxnType] = useState(transaction.transaction_type);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    const category = categories.find((c) => c.name === selectedCategory);
    await fetch("/api/plaid/sync", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction_id: transaction.id,
        portal_category_id: category?.id ?? null,
        transaction_type: txnType,
        is_reviewed: true,
      }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-bg-secondary shadow-xl sm:rounded-l-2xl">
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <h2 className="text-sm font-semibold text-text-primary">
            Transaction Details
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Merchant & amount */}
          <div>
            <p className="text-lg font-semibold text-text-primary">
              {transaction.merchant_name ?? "Unknown"}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
              {transaction.transaction_type === "income" ? "+" : ""}
              {formatCurrencyPrecise(Math.abs(transaction.amount))}
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              {formatDate(transaction.date)}
            </p>
          </div>

          {/* Category */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-tertiary">
              Category
            </p>
            {editing ? (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
              >
                <option value="">Uncategorized</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-text-primary">
                {transaction.category_name ?? "Uncategorized"}
              </p>
            )}
          </div>

          {/* Transaction type */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-tertiary">
              Type
            </p>
            {editing ? (
              <select
                value={txnType}
                onChange={(e) => setTxnType(e.target.value as Transaction["transaction_type"])}
                className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="savings_transfer">Savings Transfer</option>
                <option value="internal_transfer">Internal Transfer</option>
              </select>
            ) : (
              <p className="text-sm capitalize text-text-primary">
                {txnType.replace("_", " ")}
              </p>
            )}
          </div>

          {/* Review status */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-tertiary">
              Status
            </p>
            <p className="text-sm text-text-primary">
              {transaction.is_reviewed ? "Reviewed" : "Needs Review"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-border-default px-5 py-4">
          {editing ? (
            <div className="flex gap-3">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded-lg border border-border-default px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-default px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/modules/finance/components/transaction-detail.tsx
git commit -m "feat: transaction detail slide-over panel"
```

---

## Task 9: Transaction update API route

**Files:**
- Modify: `src/app/api/plaid/sync/route.ts` (add PATCH handler)

The transaction detail panel needs an endpoint to save edits. We'll add a PATCH handler to the existing sync route.

- [ ] **Step 1: Add the PATCH handler**

Add this to the bottom of `src/app/api/plaid/sync/route.ts`, after the existing `POST` function:

```ts
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transaction_id, portal_category_id, transaction_type, notes, is_reviewed } =
    await request.json();

  if (!transaction_id) {
    return NextResponse.json({ error: "Missing transaction_id" }, { status: 400 });
  }

  // Update the transaction
  const { error } = await supabase
    .from("transactions")
    .update({
      ...(portal_category_id !== undefined && { portal_category_id }),
      ...(transaction_type !== undefined && { transaction_type }),
      ...(notes !== undefined && { notes }),
      ...(is_reviewed !== undefined && { is_reviewed }),
    })
    .eq("id", transaction_id);

  if (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // If a category was assigned, update category rules for this merchant
  if (portal_category_id) {
    const { data: txn } = await supabase
      .from("transactions")
      .select("merchant_name")
      .eq("id", transaction_id)
      .single();

    if (txn?.merchant_name) {
      await supabase.from("category_rules").upsert(
        {
          pattern: txn.merchant_name.toLowerCase(),
          category_id: portal_category_id,
          source: "user",
          created_by: user.id,
        },
        { onConflict: "pattern" },
      );
    }
  }

  return NextResponse.json({ success: true });
}
```

Note: this also requires adding `import { createClient } from "@/shared/lib/supabase/server";` to the imports at the top of the file if not already present.

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/plaid/sync/route.ts
git commit -m "feat: PATCH endpoint for transaction edits with category rule learning"
```

---

## Task 10: Wire up the finances page

**Files:**
- Modify: `src/app/(portal)/finances/page.tsx`

This is where it all comes together. The finances page needs to:
- Show the empty state when no accounts exist
- Show the review filter toggle with badge
- Make transactions tappable to open the detail panel
- Show a "Connect Account" button in the accounts section

Since the page is a server component but needs interactive elements (transaction clicks, Plaid Link), we'll extract the interactive parts into a client wrapper.

- [ ] **Step 1: Create the client-side finances wrapper**

Create a new file `src/modules/finance/components/finances-client.tsx`:

```tsx
// src/modules/finance/components/finances-client.tsx
"use client";

import { useState } from "react";
import type { Transaction, Category } from "@/modules/finance/types";
import { TransactionDetail } from "./transaction-detail";
import { ReviewBadge } from "./review-badge";
import { formatCurrencyPrecise, formatDate } from "@/shared/lib/utils";
import {
  UtensilsCrossed,
  ShoppingCart,
  ShoppingBag,
  Car,
  Film,
  Home,
  User,
  Building,
  Zap,
  Shield,
  Repeat,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  "utensils-crossed": UtensilsCrossed,
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  car: Car,
  film: Film,
  home: Home,
  user: User,
  building: Building,
  zap: Zap,
  shield: Shield,
  repeat: Repeat,
};

function getIcon(name: string | null): LucideIcon {
  if (!name) return HelpCircle;
  return iconMap[name] ?? HelpCircle;
}

interface TransactionListClientProps {
  transactions: Transaction[];
  categories: Category[];
  reviewCount: number;
}

export function TransactionListClient({
  transactions,
  categories,
  reviewCount,
}: TransactionListClientProps) {
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [showReviewOnly, setShowReviewOnly] = useState(false);

  const filtered = showReviewOnly
    ? transactions.filter((t) => !t.is_reviewed)
    : transactions;

  return (
    <>
      <div className="rounded-2xl border border-border-default bg-bg-secondary p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            Recent Transactions
          </h2>
          <button
            onClick={() => setShowReviewOnly(!showReviewOnly)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              showReviewOnly
                ? "bg-accent-muted text-accent"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Needs Review
            <ReviewBadge count={reviewCount} />
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm text-text-tertiary">
              {showReviewOnly ? "All caught up!" : "No transactions yet"}
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border-subtle">
            {filtered.map((txn) => {
              const Icon = getIcon(txn.category_icon);
              const isIncome = txn.transaction_type === "income";

              return (
                <button
                  key={txn.id}
                  onClick={() => setSelectedTxn(txn)}
                  className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-bg-tertiary/50 first:pt-0 last:pb-0"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-tertiary text-text-tertiary">
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-text-primary">
                      {txn.merchant_name ?? "Unknown"}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] text-text-tertiary">
                        {txn.category_name ?? "Uncategorized"}
                      </p>
                      {!txn.is_reviewed && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-[13px] font-medium tabular-nums ${
                        isIncome ? "text-status-green" : "text-text-primary"
                      }`}
                    >
                      {isIncome ? "+" : ""}
                      {formatCurrencyPrecise(Math.abs(txn.amount))}
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      {formatDate(txn.date)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedTxn && (
        <TransactionDetail
          transaction={selectedTxn}
          categories={categories}
          onClose={() => setSelectedTxn(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Rewrite the finances page**

Replace the entire contents of `src/app/(portal)/finances/page.tsx` with:

```tsx
// src/app/(portal)/finances/page.tsx
import { createClient } from "@/shared/lib/supabase/server";
import { formatCurrency, formatCurrencyPrecise } from "@/shared/lib/utils";
import {
  getAccounts,
  getRecentTransactions,
  getCategories,
  getMonthExpenses,
  buildCategorySpend,
  buildMonthSummary,
  getReviewCount,
} from "@/modules/finance/queries";
import type { Account, MonthSummary, CategorySpend } from "@/modules/finance/types";
import { FinancesEmptyState } from "@/modules/finance/components/empty-state";
import { PlaidLinkButton } from "@/modules/finance/components/plaid-link-button";
import { TransactionListClient } from "@/modules/finance/components/finances-client";
import {
  UtensilsCrossed,
  ShoppingCart,
  ShoppingBag,
  Car,
  Film,
  Home,
  User,
  Building,
  Zap,
  Shield,
  Repeat,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  "utensils-crossed": UtensilsCrossed,
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  car: Car,
  film: Film,
  home: Home,
  user: User,
  building: Building,
  zap: Zap,
  shield: Shield,
  repeat: Repeat,
};

function getIcon(name: string | null): LucideIcon {
  if (!name) return HelpCircle;
  return iconMap[name] ?? HelpCircle;
}

export default async function FinancesPage() {
  const supabase = await createClient();

  const accounts = await getAccounts(supabase);

  // If no accounts, show empty state
  if (accounts.length === 0) {
    return <FinancesEmptyState />;
  }

  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const endDate = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, "0")}-${String(endOfMonth.getDate()).padStart(2, "0")}`;

  const [recentTransactions, categories, monthTransactions, reviewCount] =
    await Promise.all([
      getRecentTransactions(supabase),
      getCategories(supabase),
      getMonthExpenses(supabase, startDate, endDate),
      getReviewCount(supabase),
    ]);

  const categorySpend = buildCategorySpend(categories, monthTransactions);
  const summary = buildMonthSummary(categories, monthTransactions);

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <div className="space-y-6">
      <HeroSpend summary={summary} monthLabel={monthLabel} />
      <CategoryBreakdown categories={categorySpend} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <TransactionListClient
          transactions={recentTransactions}
          categories={categories}
          reviewCount={reviewCount}
        />
        <AccountSummary accounts={accounts} />
      </div>
    </div>
  );
}

/* ---------- Hero Spend ---------- */

function HeroSpend({
  summary,
  monthLabel,
}: {
  summary: MonthSummary;
  monthLabel: string;
}) {
  const hasBudget = summary.total_budget > 0;
  const spendPercent = hasBudget
    ? (summary.total_spent / summary.total_budget) * 100
    : 0;
  const pacePercent = (summary.days_elapsed / summary.days_in_month) * 100;
  const isAhead = spendPercent > pacePercent + 5;
  const isOver = spendPercent > 100;

  return (
    <div className="rounded-2xl border border-border-default bg-bg-secondary p-6 sm:p-8">
      <p className="text-xs font-medium text-text-tertiary">{monthLabel}</p>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-3xl font-bold tracking-tight text-text-primary">
          {formatCurrency(summary.total_spent)}
        </span>
        {hasBudget && (
          <span className="text-sm text-text-tertiary">
            of {formatCurrency(summary.total_budget)} budget
          </span>
        )}
      </div>

      {hasBudget && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
            <div
              className={`h-full rounded-full transition-all ${
                isOver ? "bg-status-red" : "bg-accent"
              }`}
              style={{ width: `${Math.min(100, spendPercent)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isOver
                  ? "bg-status-red"
                  : isAhead
                    ? "bg-status-red"
                    : "bg-status-green"
              }`}
            />
            <span className="text-xs text-text-secondary">
              {isOver
                ? "Over budget"
                : isAhead
                  ? "Ahead of pace"
                  : "On track"}
              {" \u2014 "}
              {Math.round(pacePercent)}% of month elapsed
            </span>
          </div>
        </div>
      )}

      {!hasBudget && (
        <p className="mt-3 text-xs text-text-tertiary">
          No budget set for this month
        </p>
      )}

      {summary.total_income > 0 && (
        <p className="mt-3 text-xs text-text-secondary">
          +{formatCurrency(summary.total_income)} income this month
        </p>
      )}
    </div>
  );
}

/* ---------- Category Breakdown ---------- */

function CategoryBreakdown({ categories }: { categories: CategorySpend[] }) {
  const discretionary = categories.filter((c) => c.type === "discretionary");
  const fixed = categories.filter((c) => c.type === "fixed");
  const hasAnySpend = categories.some((c) => c.total_spent > 0);

  return (
    <div className="rounded-2xl border border-border-default bg-bg-secondary p-6 sm:p-8">
      <h2 className="text-sm font-semibold text-text-primary">
        Budget by Category
      </h2>

      {!hasAnySpend && categories.length > 0 && (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm text-text-tertiary">No spending this month</p>
        </div>
      )}

      {categories.length === 0 && (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm text-text-tertiary">
            No categories configured
          </p>
        </div>
      )}

      {hasAnySpend && (
        <div className="mt-5 space-y-6">
          {discretionary.length > 0 && (
            <CategoryGroup label="Discretionary" items={discretionary} />
          )}
          {fixed.length > 0 && (
            <CategoryGroup label="Fixed" items={fixed} />
          )}
        </div>
      )}
    </div>
  );
}

function CategoryGroup({
  label,
  items,
}: {
  label: string;
  items: CategorySpend[];
}) {
  const active = items.filter(
    (c) => c.total_spent > 0 || c.monthly_budget > 0,
  );
  if (active.length === 0) return null;

  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      <div className="space-y-3">
        {active.map((cat) => {
          const Icon = getIcon(cat.icon);
          const percent =
            cat.monthly_budget > 0
              ? (cat.total_spent / cat.monthly_budget) * 100
              : 0;
          const isOver = percent > 100;

          return (
            <div key={cat.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Icon size={15} className="shrink-0 text-text-tertiary" />
                  <span className="text-[13px] font-medium text-text-primary">
                    {cat.name}
                  </span>
                </div>
                <span className="text-[13px] tabular-nums text-text-secondary">
                  {formatCurrency(cat.total_spent)}
                  {cat.monthly_budget > 0 && (
                    <span className="text-text-tertiary">
                      {" "}
                      / {formatCurrency(cat.monthly_budget)}
                    </span>
                  )}
                </span>
              </div>
              {cat.monthly_budget > 0 && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-tertiary">
                  <div
                    className={`h-full rounded-full ${
                      isOver ? "bg-status-red" : "bg-accent"
                    }`}
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Account Summary ---------- */

function AccountSummary({ accounts }: { accounts: Account[] }) {
  return (
    <div className="rounded-2xl border border-border-default bg-bg-secondary p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Accounts</h2>
        <PlaidLinkButton variant="secondary" />
      </div>

      {accounts.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm text-text-tertiary">No accounts connected</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {accounts.map((acct) => (
            <div
              key={acct.id}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-text-primary">
                  {acct.name}
                </p>
                <p className="text-[11px] text-text-tertiary">
                  {acct.institution_name}
                  {acct.last_synced_at && (
                    <> &middot; Synced {formatDate(acct.last_synced_at)}</>
                  )}
                </p>
              </div>
              <p className="shrink-0 text-[13px] font-medium tabular-nums text-text-primary">
                {acct.current_balance != null
                  ? formatCurrencyPrecise(acct.current_balance)
                  : "\u2014"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify the build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/modules/finance/components/finances-client.tsx src/app/(portal)/finances/page.tsx
git commit -m "feat: wire up finances page with empty state, review queue, and transaction detail"
```

---

## Task 11: Add unique constraint on category_rules.pattern

**Files:**
- Create: `supabase/migrations/014_category_rules_unique_pattern.sql`

The PATCH endpoint and categorizer use `upsert` with `onConflict: "pattern"`, which requires a unique constraint.

- [ ] **Step 1: Create the migration**

```sql
-- 014_category_rules_unique_pattern
create unique index if not exists category_rules_pattern_idx
  on public.category_rules (pattern);
```

- [ ] **Step 2: Apply the migration to Supabase**

Run this via the Supabase dashboard SQL editor or MCP tool.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/014_category_rules_unique_pattern.sql
git commit -m "feat: unique constraint on category_rules.pattern for upsert support"
```

---

## Task 12: Environment variables and sandbox testing

This task is about getting everything configured so you can actually test it.

- [ ] **Step 1: Add Plaid credentials to .env.local**

Open `.env.local` and fill in:

```
PLAID_CLIENT_ID=<your client id from Plaid dashboard>
PLAID_SECRET=<your sandbox secret from Plaid dashboard>
PLAID_ENV=sandbox
NEXT_PUBLIC_PLAID_ENV=sandbox
CRON_SECRET=any-random-string-you-choose
```

(User does this manually — do not commit secrets.)

- [ ] **Step 2: Apply migration 013 and 014**

Run both migrations against your Supabase database (via dashboard SQL editor or MCP tool):
- `supabase/migrations/013_plaid_credentials_and_item_id.sql`
- `supabase/migrations/014_category_rules_unique_pattern.sql`

- [ ] **Step 3: Start the dev server and test**

```bash
npm run dev
```

1. Navigate to `/finances`
2. Should see the empty state with "Connect your first bank account"
3. Click "Connect Your Bank" — Plaid Link modal should open
4. In sandbox mode, use test credentials: user `user_good` / password `pass_good`
5. Select any bank, connect accounts
6. After connecting, the page should refresh and show accounts + transactions

- [ ] **Step 4: Test the review queue**

1. Some transactions should appear with an orange dot (needs review)
2. Click the "Needs Review" filter — should show only unreviewed transactions
3. Click a transaction — detail panel should open
4. Click "Edit" — should enter edit mode
5. Change the category and save — transaction should update and dot should disappear

---

## Summary

| Task | What it does |
|------|-------------|
| 1 | Install Plaid packages |
| 2 | Create Plaid SDK client |
| 3 | Link token API route (starts the bank connection flow) |
| 4 | Exchange token route + sync engine + categorizer (the big one) |
| 5 | Manual sync + daily cron routes |
| 6 | Plaid Link button component |
| 7 | Empty state + review badge components |
| 8 | Transaction detail slide-over panel |
| 9 | Transaction update API endpoint |
| 10 | Wire everything into the finances page |
| 11 | Database migration for category rules |
| 12 | Configure env vars and test in sandbox |
