# Smolowe Household Portal - Finance Module Implementation Plan

**Date:** 2026-04-01
**Source Spec:** `docs/superpowers/specs/2026-04-01-household-portal-finance-module-design.md`
**Repo Status Assumption:** Repository currently contains documentation only. No existing Next.js, Supabase, or service integration code was found.

## 1. Delivery Goals

Build the first production-ready module of the household portal as a single Next.js app with:

- secure household authentication for Alex and Emine
- Plaid-backed account and transaction syncing
- a finance dashboard focused on budget pacing and accountability
- deterministic financial query tools wrapped by Gemini
- Twilio SMS for alerts and conversational interactions
- a design system and shell that can support future modules

## 2. Recommended Release Strategy

Deliver in six phases. The goal is to get to a useful private beta quickly, then add AI and automation on top of a stable financial data foundation.

### Phase 0: Foundation and Project Bootstrap

**Objective:** Stand up the app, environments, and deployment pipeline.

**Work:**
- Initialize a Next.js 14+ App Router project with TypeScript, ESLint, Prettier, and basic test setup.
- Create top-level structure from the spec:
  - `src/app/(portal)/finance`
  - `src/app/(portal)/settings`
  - `src/app/api`
  - `src/modules/finance`
  - `src/shared`
- Set up Supabase project, local environment variables, and Vercel project configuration.
- Add a minimal design token system for dark-first theming, spacing, typography, status colors, and tabular numerals.
- Build a portal shell with auth guard, sidebar nav, header, theme toggle, and mobile-responsive layout.
- Add CI basics: typecheck, lint, test, and preview deployment.

**Deliverables:**
- deployable app shell
- environment configuration template
- initial design system primitives
- Supabase client/server wiring

**Exit criteria:**
- app deploys to Vercel
- authenticated user can log in and access placeholder Finance and Settings routes

### Phase 1: Data Model, Auth, and Manual Finance MVP

**Objective:** Make the portal usable before Plaid and AI by building the core schema and UI flow.

**Work:**
- Create Supabase schema and migrations for:
  - `profiles`
  - `budget_periods`
  - `categories`
  - `category_rules`
  - `projects`
  - `transactions`
  - `accounts`
  - `plaid_items`
  - `financial_profile`
  - `ai_conversations`
  - `alert_rules`
  - `alert_log`
- Implement RLS policies scoped to household users only.
- Add seed scripts for the two users, starter categories, default budget period, and an initial financial profile document.
- Build Finance pages:
  - Dashboard
  - Transactions
  - Trends placeholder
- Build Settings pages for profile, alert preferences, and connected accounts placeholders.
- Support manual transaction/category data entry or CSV import for early UI development and validation if Plaid setup lags.
- Implement budget math server-side:
  - monthly category spend
  - fixed vs. discretionary grouping
  - pace-adjusted status
  - hero metric
  - remaining-per-day calculations

**Deliverables:**
- working finance dashboard against real Supabase data
- transaction list with filtering and recategorization
- budget calculations exposed through typed server-side queries

**Exit criteria:**
- Alex and Emine can log in, see the dashboard, manage categories, and review transactions in a non-demo environment

### Phase 2: Plaid Integration and Transaction Sync

**Objective:** Replace manual data flow with reliable bank connectivity.

**Work:**
- Build shared Plaid service in `src/shared/plaid`.
- Implement Plaid Link flow for household account connection.
- Store access tokens through Supabase Vault integration and associate them with module context.
- Create account discovery and initial 90-day transaction sync.
- Add webhook endpoint for Plaid transaction updates.
- Add idempotent sync jobs for:
  - webhook-driven incremental sync
  - 4-hour cron fallback polling
- Implement transaction normalization:
  - classify income
  - classify savings transfers
  - classify internal transfers
  - preserve raw Plaid metadata
- Add connected accounts management UI in Settings.

**Deliverables:**
- end-to-end Plaid connection flow
- normalized accounts and transactions persisted in Supabase
- sync observability and error logging

**Exit criteria:**
- new card or bank activity appears in the portal within normal Plaid webhook timing
- duplicate transactions are prevented through idempotent sync logic

### Phase 3: Budget Operations and Alerts

**Objective:** Turn transaction visibility into active budget accountability.

**Work:**
- Implement category budgets, budget period handling, and fixed/discretionary presentation rules.
- Add rule-based categorization cascade:
  - user rules
  - approved AI rules
  - Plaid fallback mapping
  - unbudgeted catch-all
- Build transaction review flows:
  - recategorize
  - create merchant rule
  - bulk actions
- Implement alert evaluation engine for:
  - pace-based budget warnings
  - budget exceeded
  - savings withdrawals
  - anomaly candidates
  - personal merchant/category/amount triggers
- Enforce alert throttling:
  - max one SMS per person per category per day
  - max five alerts per person per day
- Build Settings UI for alert rule CRUD and recipient controls.

**Deliverables:**
- actionable budget dashboard
- alert rule engine
- alert management UI

**Exit criteria:**
- budget status and SMS eligibility are computed deterministically and auditable from stored data

### Phase 4: Twilio SMS and AI Query Layer

**Objective:** Add conversational access without allowing the model to invent financial facts.

**Work:**
- Build Twilio inbound webhook and outbound messaging service.
- Map phone numbers to user profiles and conversation threads.
- Implement Gemini integration through an application service layer, not directly from UI routes.
- Define structured tool/function contracts for factual finance queries:
  - spend by category/date range
  - merchant totals
  - budget status
  - savings balance and transfers
  - recent transaction lookups
  - affordability checks based on deterministic data
- Build SMS conversation orchestration:
  - incoming message ingestion
  - context assembly
  - Gemini response generation
  - structured action confirmation and execution
- Log all AI-proposed or AI-triggered actions with context.
- Add portal chat slide-up panel backed by the same conversation service.

**Deliverables:**
- SMS bot for household finance questions
- deterministic finance query tool layer
- portal chat panel

**Exit criteria:**
- factual questions are answered only from query functions
- structured actions require explicit confirmation before mutating data

### Phase 5: AI Advisor, Projects, and Weekly Digest

**Objective:** Add the higher-value advisory layer once trustable data and messaging exist.

**Work:**
- Implement financial profile versioning and update workflows.
- Build anomaly detection jobs on new transaction batches.
- Add temporary project creation, tracking, and archive flows.
- Generate weekly digest with positive-first framing and daily allowance calculation.
- Add AI-assisted category recommendations and merge/archive suggestions.
- Add "what if" analysis against historical spend and current budgets.
- Add streaks, wins, and progress narrative elements to dashboard and digest surfaces.

**Deliverables:**
- living financial profile
- anomaly-to-conversation workflow
- project budgeting support
- weekly digest automation

**Exit criteria:**
- AI adds behavioral support without owning financial truth or unrestricted database writes

### Phase 6: Hardening, PWA, and Launch Readiness

**Objective:** Make the system dependable for daily use.

**Work:**
- Add service worker, manifest, installability, and offline cached views.
- Improve loading states, empty states, and sync freshness indicators.
- Add audit logging and admin diagnostics for sync jobs, alerts, and AI actions.
- Add monitoring, tracing, and alerting for Plaid/Twilio/Gemini failures.
- Run security review on auth, secrets, RLS, and webhook verification.
- Complete responsive polish, motion polish, and chart design integration.
- Add backup/export paths for key finance data.

**Deliverables:**
- installable PWA
- production monitoring and security baseline
- polished private launch candidate

**Exit criteria:**
- system is stable enough to be the household's primary budgeting surface

## 3. Suggested MVP Scope

The best first usable release is not the full spec. Recommended MVP:

- Phase 0
- Phase 1
- core parts of Phase 2
- core parts of Phase 3
- limited Phase 4 for factual SMS queries only

Specifically, MVP should include:

- auth for Alex and Emine
- Plaid connection for household accounts
- transaction sync and normalization
- dashboard with hero metric, category pacing, recent transactions, and savings signal
- transaction review and category rules
- pace-based SMS alerts
- deterministic factual SMS queries

Defer until post-MVP:

- portal AI chat panel
- anomaly-driven project workflow
- weekly digest
- financial profile rewriting
- advanced what-if modeling
- full PWA offline support

## 4. Cross-Cutting Technical Decisions

### A. Keep finance calculations deterministic

All budget, pacing, savings, and affordability calculations should live in typed server-side services or SQL views/RPCs. Gemini should never compute source-of-truth numbers from prompt context.

### B. Separate ingestion from presentation

Use a pipeline:

1. raw Plaid sync
2. normalization/classification
3. budget/alert computation
4. UI/API consumption

This will make debugging and future LLC reuse much easier.

### C. Prefer shared infrastructure early

Even though only finance is shipping now, create reusable shared layers for:

- auth/session handling
- external service adapters
- notification delivery
- design tokens/components
- AI orchestration

The module split in the spec is only valuable if these boundaries exist from the start.

### D. Store AI memory as explicit domain data

Keep the financial profile, AI messages, AI action logs, and alert logs in first-class tables. Do not hide critical behavior in prompt templates or transient memory only.

## 5. Major Risks and Mitigations

### Risk 1: Plaid edge cases delay the whole project

**Mitigation:** Build the dashboard and budget engine against seeded/manual data first so UI and finance logic can progress independently.

### Risk 2: AI trust is lost through incorrect numbers

**Mitigation:** Ship deterministic factual query tools before any broad advisory workflows. Add tests that prove AI answer paths cannot bypass query functions for factual intents.

### Risk 3: Alerting becomes noisy and gets ignored

**Mitigation:** Implement throttling and daily caps as part of the first alert engine release, not as a follow-up.

### Risk 4: Dark-mode UI quality slips under backend pressure

**Mitigation:** Lock design tokens, typography, spacing, and chart standards in Phase 0 so later features inherit the correct visual system.

### Risk 5: Future modules force rework

**Mitigation:** Keep module context on data models and use shared service boundaries now, but do not overbuild hidden modules yet.

## 6. Testing Strategy

Testing should be added as each phase lands, not deferred.

- **Unit tests:** budget math, pacing thresholds, transaction normalization, alert throttling
- **Integration tests:** Supabase-backed finance queries, Plaid webhook processing, Twilio webhook processing, AI tool call routing
- **E2E tests:** login, dashboard load, connect account, review transaction, receive/send SMS query
- **Contract tests:** service adapters for Plaid, Gemini, and Twilio
- **Migration tests:** schema migrations and RLS validation

Highest-priority automated test targets:

- pace-adjusted alert classification
- savings withdrawal detection
- transaction deduplication during sync
- factual AI query execution path
- category rule precedence

## 7. Proposed Build Order by Week

Assuming part-time but focused delivery:

- **Week 1:** Phase 0 foundation, auth shell, design tokens, Supabase setup
- **Week 2:** schema, seed data, dashboard skeleton, transaction list
- **Week 3:** budget calculations, category management, manual finance MVP completion
- **Week 4:** Plaid Link, account sync, webhook ingestion
- **Week 5:** normalization, rules, alert engine
- **Week 6:** Twilio SMS, deterministic finance query tools
- **Week 7+:** anomaly workflows, profile memory, weekly digest, PWA hardening

## 8. Immediate Next Actions

1. Scaffold the Next.js app and shared folder structure from the spec.
2. Stand up Supabase locally and create the first migration set for auth-adjacent tables and finance core tables.
3. Define the deterministic finance query layer before integrating Gemini.
4. Build the dashboard against seed data before starting Plaid webhook work.
5. Add Plaid only after the finance domain model and dashboard contracts are stable.

## 9. Definition of Done for the First Private Beta

The first private beta is complete when:

- Alex and Emine can log in securely
- household accounts connect through Plaid
- current month spending and savings flow are visible in the dashboard
- category pacing status is accurate and understandable
- transactions can be reviewed and recategorized
- SMS alerts fire with throttling and correct pace context
- SMS factual questions return precise, database-backed answers
- failures in Plaid/Twilio/Gemini are logged and diagnosable
