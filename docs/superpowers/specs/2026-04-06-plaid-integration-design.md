# Plaid Integration Design

**Date:** 2026-04-06
**Status:** Approved
**Scope:** Household accounts only (LLC out of scope)

## Overview

Integrate Plaid into the Smolowe Household Portal to connect real bank accounts, sync transactions daily, and auto-categorize spending with a review queue for manual oversight. All work stays within the existing Next.js + Supabase + Vercel stack.

## Architecture: Next.js API Routes + Vercel Cron

All Plaid logic lives in Next.js API routes. A Vercel cron job triggers the daily sync. No additional infrastructure.

## 1. Plaid Link Flow

### Connecting a bank account

1. User clicks "Connect Account" on the finances page (CTA shown when no accounts exist, or as a button in the account summary section).
2. Frontend calls `POST /api/plaid/create-link-token` to generate a Plaid Link token server-side.
3. Frontend opens the Plaid Link modal using `react-plaid-link`. Plaid's hosted UI handles bank selection, credentials, and MFA.
4. On success, Plaid returns a `public_token`. Frontend sends it to `POST /api/plaid/exchange-token`.
5. Server exchanges the public token for a permanent `access_token` via Plaid's `/item/public_token/exchange` endpoint.
6. Server stores the `access_token`, `item_id`, and institution info in the `plaid_items` table.
7. Server immediately triggers an initial transaction sync for that item.
8. Frontend redirects back to the finances page, now populated with accounts and transactions.

### Security

- Access tokens never reach the frontend.
- `plaid_items` table has RLS scoped to `user_id`.
- All API routes verify the Supabase session before proceeding.

## 2. Daily Transaction Sync

### Cron trigger

- Vercel cron hits `GET /api/cron/sync-transactions` once daily at 5:00 AM ET.
- The route is protected with a `CRON_SECRET` environment variable — requests without a valid `Authorization: Bearer <CRON_SECRET>` header are rejected.

### Sync process (per plaid item)

1. Call Plaid's `/transactions/sync` endpoint with the stored `access_token` and `cursor`.
2. Receive added, modified, and removed transactions since last sync.
3. Upsert added/modified transactions into the `transactions` table (keyed on `plaid_transaction_id`).
4. Delete removed transactions from the `transactions` table.
5. Update account balances in the `accounts` table via Plaid's `/accounts/get` (called as part of the sync response).
6. Save the new cursor back to `plaid_items.cursor`.
7. Update `plaid_items.last_synced_at`.

### Why `/transactions/sync`

Plaid's recommended approach. Incremental (only returns deltas), handles modifications and deletions, uses a cursor to avoid missing or double-counting transactions.

## 3. Auto-Categorization + Review Queue

### Categorization pipeline (runs on each new transaction)

**Priority 1 — Known merchant match:**
Check `category_rules` table for an existing rule where the transaction's `merchant_name` contains the rule's `pattern` (case-insensitive). If found, assign that category and set `is_reviewed = true`.

**Priority 2 — Plaid category mapping:**
If no merchant rule exists, map Plaid's category array (e.g., `["Food and Drink", "Restaurants"]`) to a portal category (e.g., "Dining/Delivery") using a static mapping defined in code. Assign the category but set `is_reviewed = false`.

**Priority 3 — No match:**
Leave `portal_category_id` null, set `is_reviewed = false`.

### Plaid-to-portal category mapping

Plaid's `/transactions/sync` returns `personal_finance_category` as an object with `primary` and `detailed` fields (e.g., `{ primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_RESTAURANTS" }`). We match on the `primary` field first, then refine with `detailed` where needed.

| Plaid `primary` | Plaid `detailed` (if needed) | Portal category / type |
|-----------------|------------------------------|----------------------|
| FOOD_AND_DRINK | * | Dining/Delivery |
| GENERAL_MERCHANDISE | GENERAL_MERCHANDISE_SUPERSTORES, GENERAL_MERCHANDISE_GROCERIES | Groceries |
| GENERAL_MERCHANDISE | (other) | Shopping |
| TRANSPORTATION | * | Transportation |
| ENTERTAINMENT | * | Entertainment |
| RENT_AND_UTILITIES | RENT_AND_UTILITIES_RENT, RENT_AND_UTILITIES_MORTGAGE | Rent/Mortgage |
| RENT_AND_UTILITIES | (other) | Utilities |
| LOAN_PAYMENTS | LOAN_PAYMENTS_INSURANCE_PAYMENT | Insurance |
| GENERAL_SERVICES | GENERAL_SERVICES_INSURANCE | Insurance |
| GENERAL_SERVICES | GENERAL_SERVICES_SUBSCRIPTION | Subscriptions |
| TRANSFER_IN / TRANSFER_OUT | TRANSFER_IN_ACCOUNT_TRANSFER / TRANSFER_OUT_ACCOUNT_TRANSFER | internal_transfer (transaction_type) |
| INCOME | * | income (transaction_type) |

This mapping is a starting point. Unmapped Plaid categories fall through to Priority 3 (uncategorized, flagged for review).

### Review queue

- A filter on the finances page showing transactions where `is_reviewed = false`.
- Badge count displayed on the filter toggle (e.g., "Needs Review (7)").
- Each item shows the auto-assigned category (if any) with a confirm action, or a category picker if uncategorized.
- Confirming a transaction sets `is_reviewed = true` and creates/updates a `category_rules` entry for that merchant name, so the same merchant is auto-categorized in the future.
- Over time, the review queue shrinks as the system learns merchant patterns.

## 4. Transaction Detail / Edit

### Read-only by default

Tapping a transaction row opens a detail panel:
- **Desktop:** slide-over panel from the right.
- **Mobile:** full-screen push view.
- Displays: merchant name, amount, date, account, Plaid raw category, assigned portal category, transaction type, notes.

### Edit mode (intentional — requires explicit action)

- An "Edit" button in the detail panel enters edit mode.
- Editable fields: portal category, transaction type, notes.
- Save commits changes. Re-categorizing also updates `category_rules` for that merchant.
- Cancel returns to read-only view.
- No inline editing from the transaction list — prevents accidental edits.

## 5. Finances Page Layout Changes

The existing page structure is preserved. Changes:

### Empty state
When no accounts are connected, the hero area shows a "Connect your first bank account" CTA with the Plaid Link flow.

### Account summary section
- Add a "Connect Account" button to link additional banks.
- Show last synced timestamp per account.

### Recent transactions list
- Add a review queue filter toggle with badge count.
- Transaction rows are tappable to open the detail panel.

### No new pages
Everything lives on `/finances`. The detail panel is an overlay, not a new route.

## 6. API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/plaid/create-link-token` | POST | Generate Plaid Link token. Requires authenticated session. |
| `/api/plaid/exchange-token` | POST | Exchange public token for access token, store in DB, trigger initial sync. Requires authenticated session. |
| `/api/plaid/sync` | POST | Sync transactions + balances for a given plaid item. Requires authenticated session. Used by exchange-token and can be called manually. |
| `/api/cron/sync-transactions` | GET | Vercel cron entry point. Protected by `CRON_SECRET`. Iterates all plaid items and syncs each. |

## 7. Environment Variables

| Variable | Purpose |
|----------|---------|
| `PLAID_CLIENT_ID` | Plaid API client ID |
| `PLAID_SECRET` | Plaid API secret (sandbox or production) |
| `PLAID_ENV` | `sandbox` or `production` — controls which Plaid environment is used |
| `CRON_SECRET` | Protects the cron sync endpoint from unauthorized calls |

## 8. New Dependencies

| Package | Purpose |
|---------|---------|
| `plaid` | Official Plaid Node.js SDK |
| `react-plaid-link` | Plaid Link frontend component for React |

## 9. Database Changes

Migration 013 (already drafted) adds `plaid_item_id` and `access_token` columns to `plaid_items`. This will be finalized and applied. No new tables are needed — `category_rules` already exists for merchant-to-category mapping.

## 10. Out of Scope

- Plaid webhooks (can add later for real-time transaction updates)
- LLC / investment property accounts
- AI insights, SMS alerts, trend charts
- Dedicated settings pages (connect/disconnect lives on the finances page)
- Production Plaid environment (build and test entirely in sandbox first)

## 11. Cost Model

**Sandbox:** Free. All development and testing happens here.

**Production (when user explicitly switches `PLAID_ENV`):**
- $1.50 one-time per bank link (Auth product)
- $0.30/account/month (Transactions product)
- $0.12 per sync call (Transactions Refresh)
- Estimated total for 3-4 household accounts, daily sync: ~$3-5/month
