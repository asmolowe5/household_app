# Smolowe Household Portal — Finance Module Design

**Date:** 2026-04-01
**Status:** Review
**Users:** Alex and Emine Smolowe

## Problem Statement

Alex and Emine earn strong combined income but consistently overspend, pulling from savings monthly. Dining/delivery and premium purchases are the main culprits. Past attempts at budgeting (YNAB, reviewing statements together) have failed — statement review conversations tend to escalate emotionally.

The portal needs to be an accountability tool, not a passive information display. It should make spending visible in real time, use AI as a neutral third party for financial conversations, and be proactively annoying when spending goes off track.

## Architecture

### Overall: Modular Monolith

Single Next.js 14+ app (App Router) deployed on Vercel. Each feature area (household finance, LLC finance, cameras, calendar) is a self-contained module with its own routes, components, and API endpoints within the same codebase.

**Tech Stack:**
- **Frontend:** Next.js + React + TypeScript
- **Database:** Supabase (Postgres + Auth + Row Level Security)
- **Hosting:** Vercel
- **Banking:** Plaid API
- **AI:** Google Gemini API
- **SMS:** Twilio
- **PWA:** Service worker + web app manifest for iOS "Add to Home Screen"

### Module System

Next.js App Router structure:
- `src/app/(portal)/finance/` — Finance module pages (layout, dashboard, transactions, trends, chat, alerts, accounts)
- `src/app/(portal)/property/` — LLC module pages (future)
- `src/app/(portal)/settings/` — Settings pages
- `src/app/api/` — API routes (Plaid webhooks, Twilio webhooks, AI endpoints, cron jobs)
- `src/modules/finance/` — Finance module business logic, components, types
- `src/modules/property/` — LLC module (future)
- `src/shared/` — Shared infrastructure (auth, theming, Plaid service, AI service, SMS service, design system components)

## Accounts & Plaid Integration

### Household Accounts (this module)
- Chase Sapphire Reserve (primary credit card)
- Chase Amazon Visa (secondary credit card)
- Shared Chase checking (debit)
- Emine's Apple Card
- SoFi HYSA — joint high-yield savings, receives auto-deposit each paycheck

### LLC Accounts (separate future module, same Plaid infra)
- Chase business checking
- CBNA checking
- CBNA mortgage/loans
- USAA mortgage/loans

### Plaid Integration (shared service)

Plaid is a shared service used by both household and LLC modules.

**Connection flow:**
1. User initiates Plaid Link from the portal UI
2. Plaid Link widget handles bank auth
3. On success, access token stored in Supabase via Vault (Supabase's built-in secrets management), associated with module context: household or LLC
4. Initial transaction sync pulls 90 days of history

**Ongoing sync:**
- **Primary:** Plaid webhooks → Next.js API route → fetch new transactions → store in Supabase. Near real-time (typically within minutes of a card swipe).
- **Fallback:** Vercel cron job polls Plaid every 4 hours as a safety net for missed webhooks.

**Income & Savings Tracking:**
- Paychecks detected as inbound transactions to checking → tagged as income
- Auto-deposits to SoFi HYSA detected as savings transfers
- System computes: income in, savings out, spending (credit + debit), and net cash flow
- Savings balance monitored — any withdrawal from SoFi to checking triggers an alert ("You pulled $X from savings")
- Dashboard shows: "Income: $X → Savings: $Y → Available for spending: $Z → Spent: $W"

**Data stored per transaction:**
- Plaid transaction ID, account ID, date, amount, merchant name, Plaid category
- Portal category (auto-assigned or manually set)
- Module context (household vs. LLC)
- Transaction type: expense, income, savings_transfer, internal_transfer
- Flags: reviewed, anomaly-flagged, project-tagged

## Budget System

### Categories

Categories are split into two types:

**Fixed (tracked but not actively budgeted against — these are obligations):**
- Rent/Mortgage, Utilities, Insurance, Subscriptions

**Discretionary (the focus of active budgeting and alerts):**
- Dining/Delivery, Groceries, Shopping, Transportation, Entertainment, Home, Personal

Starter set is intentionally small (~7 discretionary + ~4 fixed). AI suggests new categories based on actual spending patterns rather than pre-loading a long list.

- Users can create, rename, merge, and archive categories
- AI can propose category changes via SMS or chat — applied through structured actions, not freeform

### Category Assignment

Priority cascade:
1. **User rules** (highest priority): Merchant name patterns → category. E.g., "DoorDash" → Dining/Delivery. Created manually or when user recategorizes and confirms "always categorize [merchant] as [category]?"
2. **AI-suggested rules**: The AI may propose rules based on patterns. Applied only after user confirmation.
3. **Plaid categories** (fallback): Used when no user rule or AI rule matches.
4. **Unbudgeted** (catch-all): Anything that falls through all three tiers. Surfaces as items needing review on the dashboard.

### Budget Cycle

- Monthly, starting on the 1st (configurable household-wide — both users share the same budget cycle).
- Each category has a monthly target amount.
- Dashboard shows per-category: budgeted, spent, remaining, percentage, progress bar.
- Overall budget health: total budgeted vs. total spent, with days remaining in cycle.

### Alert Thresholds

Alerts are **pace-adjusted** — thresholds factor in how much of the month has elapsed. 80% spent at day 25 is fine; 80% spent at day 10 is a problem. The key metric is spend rate vs. budget rate (% budget used / % month elapsed).

**Dashboard status (discretionary categories only — fixed categories don't trigger alerts):**
- **On pace or under** → Green
- **Spending 20%+ ahead of pace** → Yellow
- **Spending 50%+ ahead of pace** → Orange + SMS alert
- **Budget exceeded** → Red + SMS alert

**SMS alerts include pace context:** "Dining is at $960 of $1,200 (80%) — but you're only 15 days in. At this rate you'll hit $1,920 by month end."

**Alert batching:** Max one SMS per person per category per day. Daily cap of 5 alerts per person. Prevents notification fatigue during high-spend days.

Thresholds and recipients are configurable per category.

### Temporary Projects

When the AI detects anomalous spending at a specific merchant cluster (e.g., multiple Home Depot trips), it initiates a conversation:
- "I noticed $380 at Home Depot across 4 trips. What's going on?"
- User explains → AI creates a temporary project category with an estimated budget
- Project spending is tracked separately — doesn't pollute regular budget categories
- AI advises on timing ("If some of this can wait until next month, you'd stay within regular budget")
- User marks project as done → category archived, spending remains in history

## AI Advisor (Gemini)

### Financial Profile (Living Document)

A markdown document stored in Supabase, versioned over time. The AI reads it before every interaction and updates it after meaningful conversations or month-end reviews.

**Sections:**
- **Spending Identity** — Who the Smolowes are as spenders. Tendencies, preferences, patterns.
- **Patterns & Triggers** — Temporal patterns (weeknight delivery spikes), merchant patterns, seasonal trends.
- **Active Projects** — Ongoing temporary spending contexts (patio project, upcoming trip).
- **Goals & Aspirations** — What they want to change. Specific targets.
- **Progress Narrative** — Month-over-month arc. What's working, what's not. Written in natural language.

**Future: Master/Module Profile Hierarchy**
When additional modules come online (cameras, calendar), the profile splits:
- **Master Profile** — Household-level context, cross-module awareness (a vacation affects budget AND calendar)
- **Finance Profile** — Spending-specific memory (this document)
- **[Module] Profile** — Each module gets its own AI memory

For now, only the finance profile exists.

### AI Context Window

Every AI interaction (SMS or portal chat) includes:
- The full financial profile markdown
- Current month's budget status (all categories, % used, days remaining, pace status)
- Transaction summary (aggregated by category and merchant — not raw transactions, to manage token limits)
- Active temporary projects
- Who is asking (Alex vs. Emine)
- Conversation history for the current thread
- Income and savings flow for the current month

### Factual Queries vs. Advisory Queries

**Critical architecture decision:** The AI never computes financial numbers from context. All factual queries ("how much on dining?", "what's our savings balance?", "what did we spend at Amazon?") are answered by **deterministic database queries** executed via structured function calls. The AI provides the natural language wrapper and interpretation — not the math. This prevents hallucinated numbers, which would instantly destroy trust.

**Flow:** User question → AI determines intent → if factual, AI calls a query function → function returns precise data → AI wraps result in natural language with advice/context.

### AI Capabilities

- **Answer questions** — via SMS or portal chat. "How much have we spent on dining?" "Can we afford a $200 purchase this week?" Factual answers always sourced from database queries.
- **Anomaly detection** — Runs on each new transaction batch. Flags unusual spending for conversation.
- **Weekly digest** — Configurable day/time (default: Saturday morning). Leads with wins and positive progress before addressing areas of concern. Includes a daily spending allowance for remaining days ("You have $840 left across discretionary categories — that's $42/day for the next 20 days").
- **Profile updates** — Rewrites relevant profile sections after meaningful interactions or month-end.
- **Category management** — Propose new categories, merge overlapping ones, archive unused ones.
- **"What if" modeling** — "What if we cut dining to $600?" Modeled against actual historical data.
- **Budget recommendations** — Based on spending trends and stated goals.
- **Timing advice** — "You can afford X now, but it would mean Y for the rest of the month."
- **Positive reinforcement** — Celebrate wins proactively. Under-budget months, improved categories, streaks ("3 weeks under dining budget"). Weekly digest leads with wins. AI aims for ~3:1 positive-to-corrective ratio in communications. Dashboard shows streaks and positive trends, not just problems.

### Guardrails

- AI suggests changes; structured actions execute them. No freeform database mutations.
- Every AI-initiated change is logged with timestamp and context.
- AI cannot delete data — only create, categorize, and flag.

## SMS Bot (Twilio)

### Setup

- One Twilio phone number. Both Alex and Emine save it as a contact.
- System identifies who is texting by phone number.
- Individual text threads — each person has their own conversation with the bot.

### Inbound (User → Bot)

User texts a question → Next.js API route receives it → builds context (financial profile + budget status + recent transactions + who's asking) → sends to Gemini → responds via SMS.

The AI can take structured actions from SMS:
- "Create a Patio Project category" → confirmed and executed
- "Recategorize that last Amazon charge as Gift" → confirmed and executed
- "Set my dining budget to $1,200" → confirmed and executed

### Outbound (Bot → User)

**Global alerts** (same message sent individually to both):
- Pace-based budget warnings (spending 50%+ ahead of pace, budget exceeded) — with pace context in the message
- Anomaly detection ("4 Home Depot transactions this month — what's going on?")
- Savings withdrawal detection ("You pulled $500 from savings to checking")
- Weekly digest (configurable day/time, default Saturday morning) — leads with wins
- Alert batching: max 1 per person per category per day, daily cap of 5 total

**Personal alert subscriptions** (configurable per person from portal):
- Merchant-specific: "Notify Emine every time there's a Rockenwagner charge" → message includes transaction amount + category budget remaining ("Coffee #14 this month — $84 of $120 coffee budget used")
- Category-specific: "Notify Alex when Dining/Delivery crosses $500"
- Amount-specific: "Notify both when any single transaction exceeds $100"
- Each alert rule has: who, trigger type, trigger parameters, message format, active toggle

### Alert Management

Lives under Settings. Simple list view:
- Each alert is one row: trigger description, on/off toggle, delete
- Create new alerts via a simple form (merchant, category, amount, or time-based triggers)
- Default pace-based threshold alerts work out of the box — no setup required

## Portal Shell

### Navigation

Sidebar navigation:
- **Home** — Dashboard with module widgets (initially redirects to Finance)
- **Finance** — Household budget module (active). Sub-nav: Dashboard / Transactions / Trends
- **Property** — LLC/investment module (future, hidden until built)
- **Cameras** — Security camera module (future, hidden until built)
- **Calendar** — Household calendar (future, hidden until built)
- **Settings** — Account, alerts, Plaid connections, notification preferences, connected accounts

### Authentication

- Supabase Auth with email/password or magic link
- Two accounts only: Alex and Emine
- No public registration — accounts created via Supabase dashboard or seed script
- Row Level Security on all tables — users can only access household data

### Theming

- **Dark-first design.** Dark mode is the primary design target; light mode derived from it.
- Toggle in header, preference persisted per user in Supabase.
- Design system with consistent tokens: colors, spacing, typography, border radius, shadows.
- Aesthetic direction: Linear/Vercel/Mercury-inspired. Clean, modern, generous whitespace, quality typography. No cartoon budget-app aesthetics. Emine is an architect and visual designer — the design bar is high.

**Design specifics:**
- Near-black background (`#0A0A0B` range, not pure black)
- Desaturated status colors (sage green, amber, soft coral, muted red) — saturated colors vibrate on dark backgrounds
- 8px spatial grid for all spacing/padding/margins
- Strict type scale (12/14/16/20/24/32/40) — weight contrast over size contrast
- Tabular (monospaced) numerals for all financial figures — non-negotiable for alignment
- Subtle border-radius (6-8px), 1px borders with low-opacity colors, tinted shadows
- Framer Motion for micro-animations (progress bar fills, number count-up, view transitions — all 150-250ms)
- Single icon set (Lucide) — no mixing
- Custom-styled charts (Recharts with full design system integration — no default library aesthetics)
- Responsive density: phone gets single-column; desktop uses side-by-side layouts (e.g., category list + transaction detail)

### PWA

- Web app manifest with app icon, splash screen, theme colors
- Service worker for caching static assets and recent data
- iOS "Add to Home Screen" gives native-app experience
- Offline: shows cached data with "last updated" indicator

## Finance Dashboard Layout

### Primary View: Budget Overview

Designed for a single-glance answer to "are we on track?" Information hierarchy is strict — most important information is largest and highest.

1. **Hero metric** — One dominant number: "$4,200 of $6,500 spent" with color-coded background (green/yellow/orange/red based on pace). Month progress ("Day 15 of 30") integrated as a subtle annotation on the budget bar, not a separate element. Savings balance shown as a secondary figure below.
2. **Category list** — Compact vertical list (not cards) with inline progress bars. Sorted by status: problem categories float to top. Categories on pace recede visually. Only discretionary categories shown by default; fixed expenses collapsed/hidden.
3. **Recent transactions** — Last 3 transactions with merchant, amount, category. Tap for full list.
4. **AI insight** — Ambient one-liner at top or bottom, not a boxed card. "Dining is trending 15% lower than last month." Feels like a status bar, not a widget.

### Secondary Views

- **Transactions** — full searchable/filterable transaction list. Bulk recategorize, create rules. Income and savings transfers visible here with distinct styling.
- **Trends** — month-over-month charts (custom-styled, not default library aesthetics). Spending by category over time. Income vs. expenses. Savings rate. Net cash flow.

### AI Chat

AI Chat is a **floating slide-up panel** accessible from any view (via a persistent button), not a dedicated page. This allows asking questions in context — e.g., tapping a transaction and asking "what's this?" without navigating away. Full conversation history available within the panel.

### Settings (consolidated)

Alert management, connected accounts/Plaid, and preferences all live under Settings — not as top-level finance views. This keeps the finance nav clean: **Dashboard / Transactions / Trends.**

## Data Model (Supabase Tables)

### Core Tables

- `profiles` — id (references auth.users), email, name, phone, theme_preference (extends Supabase Auth)
- `plaid_items` — id, user_id, access_token_vault_id (reference to Supabase Vault secret), institution_name, module_context (household/llc)
- `accounts` — id, plaid_item_id, plaid_account_id, name, type, subtype, current_balance
- `transactions` — id, account_id, plaid_transaction_id, date, amount, merchant_name, plaid_category, portal_category_id, transaction_type (expense/income/savings_transfer/internal_transfer), is_reviewed, is_anomaly, project_id
- `categories` — id, name, monthly_budget, type (fixed/discretionary), is_active, is_temporary, sort_order
- `category_rules` — id, pattern (merchant name match), category_id, source (user/ai), created_by
- `projects` — id, name, estimated_budget, actual_spent, is_active, created_at, closed_at, notes
- `budget_periods` — id, start_date, end_date, notes

### AI & Messaging Tables

- `financial_profile` — id, content (markdown text), version, updated_at, updated_by (user/ai/system)
- `ai_conversations` — id, user_id, channel (sms/portal), messages (jsonb array), created_at
- `alert_rules` — id, user_id, trigger_type (merchant/category/amount/time), trigger_params (jsonb), message_template, is_active
- `alert_log` — id, alert_rule_id, user_id, message_sent, sent_at, channel

## External Services & Keys Required

- **Plaid** — API keys (client_id, secret). Development environment free, production requires approval.
- **Google Gemini** — API key (Alex has one).
- **Twilio** — Account SID, auth token, phone number. Pay-as-you-go pricing.
- **Supabase** — Project with Postgres, Auth, Edge Functions.
- **Vercel** — Deployment target.

## Out of Scope (Future Modules)

- LLC/investment property finance module (separate design cycle)
- Security cameras / Blink integration / local NAS recording
- Calendar hub
- Master AI profile (introduced when second module comes online)
- Wall-mounted touch screen interface
