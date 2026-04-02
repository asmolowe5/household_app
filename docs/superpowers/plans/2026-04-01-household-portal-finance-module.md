# Household Portal — Finance Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time household budget tracking portal with Plaid bank integration, Gemini AI advisor, and Twilio SMS alerts.

**Architecture:** Next.js App Router monolith on Vercel, Supabase for database/auth, Plaid for bank data, Gemini for AI, Twilio for SMS. Dark-first design system with Linear/Mercury aesthetic.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (Postgres + Auth + RLS), Plaid, @google/genai, Twilio, Framer Motion, Recharts, Lucide React, Serwist (PWA)

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                          # Root layout: providers, fonts, metadata
│   ├── page.tsx                            # Redirect to /finance
│   ├── globals.css                         # CSS variables, design tokens, base styles
│   ├── manifest.ts                         # PWA manifest
│   ├── (auth)/
│   │   ├── login/page.tsx                  # Login page
│   │   └── layout.tsx                      # Auth layout (no sidebar)
│   ├── (portal)/
│   │   ├── layout.tsx                      # Portal layout: sidebar + header + theme toggle
│   │   ├── finance/
│   │   │   ├── layout.tsx                  # Finance sub-nav: Dashboard / Transactions / Trends
│   │   │   ├── page.tsx                    # Dashboard (hero metric, category list, recent txns)
│   │   │   ├── transactions/page.tsx       # Full transaction list with search/filter
│   │   │   └── trends/page.tsx             # Charts: spending by category, income vs expenses
│   │   └── settings/
│   │       ├── page.tsx                    # Settings overview
│   │       ├── accounts/page.tsx           # Connected Plaid accounts
│   │       ├── alerts/page.tsx             # Alert rule management
│   │       └── profile/page.tsx            # User profile, phone, theme preference
│   └── api/
│       ├── plaid/
│       │   ├── create-link-token/route.ts  # Generate Plaid Link token
│       │   ├── exchange-token/route.ts     # Exchange public token for access token
│       │   ├── webhook/route.ts            # Plaid webhook receiver
│       │   └── sync/route.ts              # Manual transaction sync endpoint
│       ├── twilio/
│       │   └── webhook/route.ts            # Twilio inbound SMS receiver
│       ├── ai/
│       │   ├── chat/route.ts               # Portal AI chat endpoint
│       │   └── digest/route.ts             # Weekly digest generation endpoint
│       ├── alerts/
│       │   └── evaluate/route.ts           # Alert evaluation endpoint (called after new txns)
│       └── cron/
│           ├── sync-transactions/route.ts  # Fallback Plaid sync (every 4 hours)
│           └── weekly-digest/route.ts      # Weekly digest cron trigger
├── modules/
│   └── finance/
│       ├── components/
│       │   ├── hero-metric.tsx             # Big budget number + pace bar
│       │   ├── category-list.tsx           # Sorted category rows with progress bars
│       │   ├── category-row.tsx            # Single category: name, progress, amount
│       │   ├── recent-transactions.tsx     # Last 3 transactions summary
│       │   ├── transaction-row.tsx         # Single transaction display
│       │   ├── transaction-list.tsx        # Full filterable transaction table
│       │   ├── ai-insight-bar.tsx          # Ambient AI one-liner
│       │   ├── ai-chat-panel.tsx           # Floating slide-up chat panel
│       │   ├── ai-chat-message.tsx         # Single chat message bubble
│       │   ├── plaid-link-button.tsx       # Plaid Link integration button
│       │   ├── alert-rule-list.tsx         # Alert management list
│       │   ├── alert-rule-form.tsx         # Create/edit alert rule
│       │   ├── trend-chart.tsx             # Recharts wrapper with design system styling
│       │   └── category-form.tsx           # Create/edit category modal
│       ├── lib/
│       │   ├── budget-engine.ts            # Pace calculation, status colors, projections
│       │   ├── categorizer.ts              # Transaction categorization cascade
│       │   ├── plaid-service.ts            # Plaid API wrapper (sync, accounts, balances)
│       │   ├── ai-service.ts              # Gemini API: context building, function calling
│       │   ├── ai-tools.ts               # Structured tool definitions for Gemini function calling
│       │   ├── ai-context-builder.ts      # Builds context window from DB for AI interactions
│       │   ├── sms-service.ts             # Twilio send/receive helpers
│       │   ├── alert-engine.ts            # Evaluate alerts, check batching, send notifications
│       │   └── transaction-classifier.ts  # Classify transaction type (expense/income/savings/internal)
│       └── types/
│           └── index.ts                    # All finance module TypeScript types
├── shared/
│   ├── components/
│   │   ├── sidebar.tsx                     # Portal sidebar navigation
│   │   ├── header.tsx                      # Header with theme toggle + user info
│   │   ├── theme-toggle.tsx                # Dark/light mode switch
│   │   ├── progress-bar.tsx                # Animated progress bar (Framer Motion)
│   │   ├── status-badge.tsx                # Color-coded status indicator
│   │   ├── modal.tsx                       # Reusable modal
│   │   ├── empty-state.tsx                 # Empty state placeholder
│   │   └── loading-skeleton.tsx            # Skeleton loading states
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                   # Browser Supabase client
│   │   │   ├── server.ts                   # Server Component Supabase client
│   │   │   ├── middleware.ts               # Auth middleware for token refresh
│   │   │   └── admin.ts                    # Service role client for API routes
│   │   ├── utils.ts                        # cn() classname helper, formatCurrency, formatDate
│   │   └── constants.ts                    # Design tokens as JS, app-wide constants
│   ├── hooks/
│   │   ├── use-theme.ts                    # Theme context hook
│   │   └── use-user.ts                     # Current user context hook
│   └── providers/
│       ├── theme-provider.tsx              # Dark/light theme context provider
│       └── supabase-provider.tsx           # Supabase client context provider
├── middleware.ts                            # Next.js middleware: auth redirect + token refresh
supabase/
├── migrations/
│   ├── 001_profiles.sql                    # profiles table + RLS
│   ├── 002_plaid_items.sql                 # plaid_items table + RLS
│   ├── 003_accounts.sql                    # accounts table + RLS
│   ├── 004_categories.sql                  # categories table + seed data + RLS
│   ├── 005_transactions.sql                # transactions table + indexes + RLS
│   ├── 006_category_rules.sql              # category_rules table + RLS
│   ├── 007_projects.sql                    # projects table + RLS
│   ├── 008_budget_periods.sql              # budget_periods table + RLS
│   ├── 009_financial_profile.sql           # financial_profile table + RLS
│   ├── 010_ai_conversations.sql            # ai_conversations table + RLS
│   ├── 011_alert_rules.sql                 # alert_rules table + RLS
│   └── 012_alert_log.sql                   # alert_log table + RLS
└── seed.sql                                # Seed: two user profiles, starter categories
```

---

## Phase 1: Project Scaffolding & Design System

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env.local.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create Next.js project**

```bash
cd C:/Users/asmol/Dev/Projects/Smolowe_Household_Portal
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack
```

Accept defaults. This scaffolds the project with App Router and Tailwind.

- [ ] **Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install framer-motion lucide-react recharts
npm install clsx tailwind-merge
npm install -D @types/node
```

- [ ] **Step 3: Create environment variable template**

Create `.env.local.example`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Plaid
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret
PLAID_ENV=sandbox
NEXT_PUBLIC_PLAID_ENV=sandbox

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key

# Twilio
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Add `.env.local` and `.env` to `.gitignore` (should already be there from create-next-app).

- [ ] **Step 4: Verify the app runs**

```bash
npm run dev
```

Open http://localhost:3000 — should see the default Next.js page.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js project with core dependencies"
```

---

### Task 2: Design System — CSS Tokens & Utilities

**Files:**
- Create: `src/app/globals.css` (replace default), `src/shared/lib/utils.ts`, `src/shared/lib/constants.ts`, `tailwind.config.ts` (modify)

- [ ] **Step 1: Define CSS custom properties and design tokens**

Replace `src/app/globals.css` with:

```css
@import "tailwindcss";

:root {
  /* Dark theme (default) */
  --bg-primary: #0A0A0B;
  --bg-secondary: #141416;
  --bg-tertiary: #1C1C1F;
  --bg-elevated: #232326;

  --text-primary: #EDEDEF;
  --text-secondary: #A0A0A6;
  --text-tertiary: #6B6B73;

  --border-default: rgba(255, 255, 255, 0.08);
  --border-subtle: rgba(255, 255, 255, 0.04);

  /* Status colors — desaturated for dark backgrounds */
  --status-green: #4ADE80;
  --status-green-muted: rgba(74, 222, 128, 0.15);
  --status-yellow: #FACC15;
  --status-yellow-muted: rgba(250, 204, 21, 0.15);
  --status-orange: #FB923C;
  --status-orange-muted: rgba(251, 146, 60, 0.15);
  --status-red: #F87171;
  --status-red-muted: rgba(248, 113, 113, 0.15);

  --accent: #818CF8;
  --accent-muted: rgba(129, 140, 248, 0.15);

  /* Spacing: 8px grid */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Typography scale */
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 20px;
  --text-xl: 24px;
  --text-2xl: 32px;
  --text-3xl: 40px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* Shadows — tinted, not gray */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);

  /* Transitions */
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}

[data-theme="light"] {
  --bg-primary: #FAFAFA;
  --bg-secondary: #FFFFFF;
  --bg-tertiary: #F4F4F5;
  --bg-elevated: #FFFFFF;

  --text-primary: #18181B;
  --text-secondary: #52525B;
  --text-tertiary: #A1A1AA;

  --border-default: rgba(0, 0, 0, 0.08);
  --border-subtle: rgba(0, 0, 0, 0.04);

  --status-green: #16A34A;
  --status-green-muted: rgba(22, 163, 74, 0.1);
  --status-yellow: #CA8A04;
  --status-yellow-muted: rgba(202, 138, 4, 0.1);
  --status-orange: #EA580C;
  --status-orange-muted: rgba(234, 88, 12, 0.1);
  --status-red: #DC2626;
  --status-red-muted: rgba(220, 38, 38, 0.1);

  --accent: #6366F1;
  --accent-muted: rgba(99, 102, 241, 0.1);

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

/* Tabular numerals for financial figures */
.tabular-nums {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

- [ ] **Step 2: Create utility helpers**

Create `src/shared/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyCents(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateFull(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function daysInMonth(date: Date = new Date()): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function dayOfMonth(date: Date = new Date()): number {
  return date.getDate();
}

export function percentOfMonth(date: Date = new Date()): number {
  return dayOfMonth(date) / daysInMonth(date);
}
```

- [ ] **Step 3: Create constants file**

Create `src/shared/lib/constants.ts`:

```typescript
export const APP_NAME = "Smolowe Portal";

export const PACE_THRESHOLDS = {
  /** Spending rate / budget rate ratio thresholds */
  GREEN_MAX: 1.2,    // up to 20% ahead of pace = green
  YELLOW_MAX: 1.5,   // 20-50% ahead of pace = yellow
  ORANGE_MAX: Infinity, // 50%+ ahead = orange (SMS alert)
  // Budget exceeded = red (SMS alert) — checked separately
} as const;

export const ALERT_LIMITS = {
  MAX_PER_CATEGORY_PER_DAY: 1,
  MAX_PER_PERSON_PER_DAY: 5,
} as const;

export type PaceStatus = "green" | "yellow" | "orange" | "red";
```

- [ ] **Step 4: Update Tailwind config to use CSS variables**

Update `tailwind.config.ts` to extend theme with our tokens:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary: "var(--bg-tertiary)",
          elevated: "var(--bg-elevated)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },
        border: {
          DEFAULT: "var(--border-default)",
          subtle: "var(--border-subtle)",
        },
        status: {
          green: "var(--status-green)",
          "green-muted": "var(--status-green-muted)",
          yellow: "var(--status-yellow)",
          "yellow-muted": "var(--status-yellow-muted)",
          orange: "var(--status-orange)",
          "orange-muted": "var(--status-orange-muted)",
          red: "var(--status-red)",
          "red-muted": "var(--status-red-muted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          muted: "var(--accent-muted)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      fontSize: {
        xs: "var(--text-xs)",
        sm: "var(--text-sm)",
        base: "var(--text-base)",
        lg: "var(--text-lg)",
        xl: "var(--text-xl)",
        "2xl": "var(--text-2xl)",
        "3xl": "var(--text-3xl)",
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: design system tokens, CSS variables, Tailwind config, utility helpers"
```

---

### Task 3: Supabase Client Setup & Auth Middleware

**Files:**
- Create: `src/shared/lib/supabase/client.ts`, `src/shared/lib/supabase/server.ts`, `src/shared/lib/supabase/admin.ts`, `src/shared/lib/supabase/middleware.ts`, `src/middleware.ts`

- [ ] **Step 1: Create browser Supabase client**

Create `src/shared/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server Supabase client**

Create `src/shared/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from Server Component — ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create admin (service role) client for API routes**

Create `src/shared/lib/supabase/admin.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 4: Create middleware helper for auth token refresh**

Create `src/shared/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except for auth pages and API routes)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/api")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/finance";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 5: Create Next.js middleware**

Create `src/middleware.ts`:

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/shared/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, manifest, icons
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest|icons).*)",
  ],
};
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Supabase client setup (browser, server, admin) and auth middleware"
```

---

### Task 4: Theme Provider & Shared UI Components

**Files:**
- Create: `src/shared/providers/theme-provider.tsx`, `src/shared/providers/supabase-provider.tsx`, `src/shared/hooks/use-theme.ts`, `src/shared/components/theme-toggle.tsx`, `src/shared/components/progress-bar.tsx`, `src/shared/components/status-badge.tsx`, `src/shared/components/loading-skeleton.tsx`

- [ ] **Step 1: Create theme provider**

Create `src/shared/providers/theme-provider.tsx`:

```typescript
"use client";

import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 2: Create theme hook**

Create `src/shared/hooks/use-theme.ts`:

```typescript
"use client";

import { useContext } from "react";
import { ThemeContext } from "@/shared/providers/theme-provider";

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 3: Create theme toggle component**

Create `src/shared/components/theme-toggle.tsx`:

```typescript
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/shared/hooks/use-theme";
import { cn } from "@/shared/lib/utils";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "p-2 rounded-md transition-colors",
        "hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
      )}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
```

- [ ] **Step 4: Create animated progress bar**

Create `src/shared/components/progress-bar.tsx`:

```typescript
"use client";

import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import type { PaceStatus } from "@/shared/lib/constants";

interface ProgressBarProps {
  value: number; // 0-100
  status: PaceStatus;
  className?: string;
}

const statusColors: Record<PaceStatus, string> = {
  green: "bg-status-green",
  yellow: "bg-status-yellow",
  orange: "bg-status-orange",
  red: "bg-status-red",
};

const trackColors: Record<PaceStatus, string> = {
  green: "bg-status-green-muted",
  yellow: "bg-status-yellow-muted",
  orange: "bg-status-orange-muted",
  red: "bg-status-red-muted",
};

export function ProgressBar({ value, status, className }: ProgressBarProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div
      className={cn("h-2 rounded-full overflow-hidden", trackColors[status], className)}
    >
      <motion.div
        className={cn("h-full rounded-full", statusColors[status])}
        initial={{ width: 0 }}
        animate={{ width: `${clampedValue}%` }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Create status badge**

Create `src/shared/components/status-badge.tsx`:

```typescript
import { cn } from "@/shared/lib/utils";
import type { PaceStatus } from "@/shared/lib/constants";

interface StatusBadgeProps {
  status: PaceStatus;
  label?: string;
}

const badgeStyles: Record<PaceStatus, string> = {
  green: "bg-status-green-muted text-status-green",
  yellow: "bg-status-yellow-muted text-status-yellow",
  orange: "bg-status-orange-muted text-status-orange",
  red: "bg-status-red-muted text-status-red",
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const displayLabel = label ?? (status === "green" ? "On track" : status === "yellow" ? "Watch" : status === "orange" ? "Ahead" : "Over");

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium",
        badgeStyles[status]
      )}
    >
      {displayLabel}
    </span>
  );
}
```

- [ ] **Step 6: Create loading skeleton**

Create `src/shared/components/loading-skeleton.tsx`:

```typescript
import { cn } from "@/shared/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-bg-tertiary",
        className
      )}
    />
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: theme provider, toggle, progress bar, status badge, skeleton components"
```

---

### Task 5: Portal Shell — Layout, Sidebar, Header

**Files:**
- Create: `src/app/(portal)/layout.tsx`, `src/shared/components/sidebar.tsx`, `src/shared/components/header.tsx`, `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Update root layout with providers and fonts**

Replace `src/app/layout.tsx`:

```typescript
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/shared/providers/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smolowe Portal",
  description: "Household management portal",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create root redirect**

Replace `src/app/page.tsx`:

```typescript
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/finance");
}
```

- [ ] **Step 3: Create sidebar**

Create `src/shared/components/sidebar.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Settings, Building2, Camera, Calendar } from "lucide-react";
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
    <aside className="w-[220px] h-screen fixed left-0 top-0 border-r border-border bg-bg-secondary flex flex-col">
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
```

- [ ] **Step 4: Create header**

Create `src/shared/components/header.tsx`:

```typescript
import { ThemeToggle } from "@/shared/components/theme-toggle";

export function Header() {
  return (
    <header className="h-14 border-b border-border bg-bg-secondary flex items-center justify-end px-6">
      <ThemeToggle />
    </header>
  );
}
```

- [ ] **Step 5: Create portal layout**

Create `src/app/(portal)/layout.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { Sidebar } from "@/shared/components/sidebar";
import { Header } from "@/shared/components/header";

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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[220px]">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create auth layout and login page**

Create `src/app/(auth)/layout.tsx`:

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      {children}
    </div>
  );
}
```

Create `src/app/(auth)/login/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { createClient } from "@/shared/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/finance");
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold text-text-primary mb-8 text-center">
        Smolowe Portal
      </h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm text-text-secondary mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-bg-tertiary border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm text-text-secondary mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-bg-tertiary border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
            required
          />
        </div>
        {error && (
          <p className="text-sm text-status-red">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 7: Create finance layout with sub-nav**

Create `src/app/(portal)/finance/layout.tsx`:

```typescript
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
      <nav className="flex gap-1 mb-6 border-b border-border pb-3">
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
```

- [ ] **Step 8: Create placeholder finance page**

Create `src/app/(portal)/finance/page.tsx`:

```typescript
export default function FinanceDashboard() {
  return (
    <div className="text-text-secondary">
      <p>Finance dashboard — coming in Phase 3.</p>
    </div>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: portal shell — sidebar, header, auth layout, finance sub-nav"
```

---

## Phase 2: Database Schema & Plaid Integration

### Task 6: Supabase Database Schema

**Files:**
- Create: All files under `supabase/migrations/`, `supabase/seed.sql`

This task creates all database tables via Supabase MCP. Run each migration in order.

- [ ] **Step 1: Identify your Supabase project**

Use the Supabase MCP `list_projects` tool to find your project ID. If no project exists yet, create one via the Supabase dashboard or MCP.

- [ ] **Step 2: Apply migration 001 — profiles**

```sql
-- 001_profiles
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text not null,
  phone text,
  theme_preference text default 'dark' check (theme_preference in ('dark', 'light')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Apply migration 002 — plaid_items**

```sql
-- 002_plaid_items
create table public.plaid_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  access_token_vault_id uuid,
  institution_name text not null,
  institution_id text,
  module_context text default 'household' check (module_context in ('household', 'llc')),
  cursor text, -- Plaid sync cursor for incremental sync
  last_synced_at timestamptz,
  created_at timestamptz default now()
);

alter table public.plaid_items enable row level security;

create policy "Users can view own plaid items"
  on public.plaid_items for select
  using (auth.uid() = user_id);

create policy "Users can insert own plaid items"
  on public.plaid_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update own plaid items"
  on public.plaid_items for update
  using (auth.uid() = user_id);
```

- [ ] **Step 4: Apply migration 003 — accounts**

```sql
-- 003_accounts
create table public.accounts (
  id uuid default gen_random_uuid() primary key,
  plaid_item_id uuid references public.plaid_items(id) on delete cascade not null,
  plaid_account_id text not null unique,
  name text not null,
  official_name text,
  type text not null, -- depository, credit, loan, investment
  subtype text, -- checking, savings, credit card, etc.
  current_balance numeric(12,2),
  available_balance numeric(12,2),
  iso_currency_code text default 'USD',
  last_balance_update timestamptz,
  created_at timestamptz default now()
);

alter table public.accounts enable row level security;

create policy "Users can view own accounts"
  on public.accounts for select
  using (
    exists (
      select 1 from public.plaid_items
      where plaid_items.id = accounts.plaid_item_id
      and plaid_items.user_id = auth.uid()
    )
  );
```

- [ ] **Step 5: Apply migration 004 — categories with seed data**

```sql
-- 004_categories
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  monthly_budget numeric(10,2) default 0,
  type text not null default 'discretionary' check (type in ('fixed', 'discretionary')),
  is_active boolean default true,
  is_temporary boolean default false,
  sort_order integer default 0,
  icon text, -- Lucide icon name
  created_at timestamptz default now()
);

alter table public.categories enable row level security;

-- All authenticated users can view categories (household-wide)
create policy "Authenticated users can view categories"
  on public.categories for select
  to authenticated
  using (true);

create policy "Authenticated users can manage categories"
  on public.categories for all
  to authenticated
  using (true)
  with check (true);

-- Seed starter categories
insert into public.categories (name, type, sort_order, icon) values
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
  ('Subscriptions', 'fixed', 13, 'repeat');
```

- [ ] **Step 6: Apply migration 005 — transactions**

```sql
-- 005_transactions
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts(id) on delete cascade not null,
  plaid_transaction_id text unique,
  date date not null,
  amount numeric(10,2) not null, -- positive = money out (expense), negative = money in (income/refund)
  merchant_name text,
  plaid_category text[],
  portal_category_id uuid references public.categories(id) on delete set null,
  transaction_type text default 'expense' check (transaction_type in ('expense', 'income', 'savings_transfer', 'internal_transfer')),
  is_reviewed boolean default false,
  is_anomaly boolean default false,
  project_id uuid,
  notes text,
  created_at timestamptz default now()
);

create index idx_transactions_date on public.transactions(date desc);
create index idx_transactions_account on public.transactions(account_id);
create index idx_transactions_category on public.transactions(portal_category_id);
create index idx_transactions_type on public.transactions(transaction_type);

alter table public.transactions enable row level security;

create policy "Users can view own transactions"
  on public.transactions for select
  using (
    exists (
      select 1 from public.accounts a
      join public.plaid_items pi on pi.id = a.plaid_item_id
      where a.id = transactions.account_id
      and pi.user_id = auth.uid()
    )
  );
```

- [ ] **Step 7: Apply migration 006 — category_rules**

```sql
-- 006_category_rules
create table public.category_rules (
  id uuid default gen_random_uuid() primary key,
  pattern text not null, -- merchant name pattern (case-insensitive match)
  category_id uuid references public.categories(id) on delete cascade not null,
  source text default 'user' check (source in ('user', 'ai')),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.category_rules enable row level security;

create policy "Authenticated users can manage category rules"
  on public.category_rules for all
  to authenticated
  using (true)
  with check (true);
```

- [ ] **Step 8: Apply migration 007 — projects**

```sql
-- 007_projects
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  estimated_budget numeric(10,2),
  is_active boolean default true,
  created_at timestamptz default now(),
  closed_at timestamptz,
  notes text
);

alter table public.projects enable row level security;

create policy "Authenticated users can manage projects"
  on public.projects for all
  to authenticated
  using (true)
  with check (true);

-- Add foreign key on transactions.project_id now that projects table exists
alter table public.transactions
  add constraint fk_transactions_project
  foreign key (project_id) references public.projects(id) on delete set null;
```

- [ ] **Step 9: Apply migrations 008-012 — remaining tables**

**008_budget_periods:**
```sql
create table public.budget_periods (
  id uuid default gen_random_uuid() primary key,
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz default now()
);

alter table public.budget_periods enable row level security;

create policy "Authenticated users can manage budget periods"
  on public.budget_periods for all
  to authenticated
  using (true) with check (true);
```

**009_financial_profile:**
```sql
create table public.financial_profile (
  id uuid default gen_random_uuid() primary key,
  content text not null default '',
  version integer default 1,
  updated_at timestamptz default now(),
  updated_by text default 'system' check (updated_by in ('user', 'ai', 'system'))
);

alter table public.financial_profile enable row level security;

create policy "Authenticated users can view financial profile"
  on public.financial_profile for select
  to authenticated using (true);

create policy "Authenticated users can update financial profile"
  on public.financial_profile for all
  to authenticated using (true) with check (true);

-- Seed initial profile
insert into public.financial_profile (content, updated_by) values (
'# Smolowe Financial Profile

## Spending Identity
New profile — spending patterns will be analyzed after the first month of data.

## Patterns & Triggers
No data yet.

## Active Projects
None.

## Goals & Aspirations
To be defined during initial budget setup.

## Progress Narrative
Just getting started.
', 'system');
```

**010_ai_conversations:**
```sql
create table public.ai_conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  channel text default 'portal' check (channel in ('sms', 'portal')),
  messages jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ai_conversations enable row level security;

create policy "Users can manage own conversations"
  on public.ai_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

**011_alert_rules:**
```sql
create table public.alert_rules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  trigger_type text not null check (trigger_type in ('merchant', 'category', 'amount', 'pace', 'savings_withdrawal')),
  trigger_params jsonb not null default '{}'::jsonb,
  message_template text,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.alert_rules enable row level security;

create policy "Users can manage own alert rules"
  on public.alert_rules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

**012_alert_log:**
```sql
create table public.alert_log (
  id uuid default gen_random_uuid() primary key,
  alert_rule_id uuid references public.alert_rules(id) on delete set null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  message_sent text not null,
  sent_at timestamptz default now(),
  channel text default 'sms' check (channel in ('sms', 'portal'))
);

create index idx_alert_log_user_date on public.alert_log(user_id, sent_at desc);

alter table public.alert_log enable row level security;

create policy "Users can view own alert log"
  on public.alert_log for select
  using (auth.uid() = user_id);
```

- [ ] **Step 10: Commit migration files locally**

Save all SQL above as individual files under `supabase/migrations/` for version control:

```bash
git add supabase/
git commit -m "feat: complete database schema — 12 migrations with RLS policies"
```

---

### Task 7: Finance Module Types

**Files:**
- Create: `src/modules/finance/types/index.ts`

- [ ] **Step 1: Define all TypeScript types for the finance module**

Create `src/modules/finance/types/index.ts`:

```typescript
export type TransactionType = "expense" | "income" | "savings_transfer" | "internal_transfer";
export type CategoryType = "fixed" | "discretionary";
export type PaceStatus = "green" | "yellow" | "orange" | "red";
export type AlertTriggerType = "merchant" | "category" | "amount" | "pace" | "savings_withdrawal";
export type AlertChannel = "sms" | "portal";
export type AiConversationChannel = "sms" | "portal";
export type ProfileUpdatedBy = "user" | "ai" | "system";

export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  theme_preference: "dark" | "light";
  created_at: string;
  updated_at: string;
}

export interface PlaidItem {
  id: string;
  user_id: string;
  access_token_vault_id: string | null;
  institution_name: string;
  institution_id: string | null;
  module_context: "household" | "llc";
  cursor: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface Account {
  id: string;
  plaid_item_id: string;
  plaid_account_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  current_balance: number | null;
  available_balance: number | null;
  iso_currency_code: string;
  last_balance_update: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  plaid_transaction_id: string | null;
  date: string;
  amount: number;
  merchant_name: string | null;
  plaid_category: string[] | null;
  portal_category_id: string | null;
  transaction_type: TransactionType;
  is_reviewed: boolean;
  is_anomaly: boolean;
  project_id: string | null;
  notes: string | null;
  created_at: string;
  // Joined fields
  category?: Category;
  account?: Account;
}

export interface Category {
  id: string;
  name: string;
  monthly_budget: number;
  type: CategoryType;
  is_active: boolean;
  is_temporary: boolean;
  sort_order: number;
  icon: string | null;
  created_at: string;
}

export interface CategoryRule {
  id: string;
  pattern: string;
  category_id: string;
  source: "user" | "ai";
  created_by: string | null;
  created_at: string;
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

export interface FinancialProfile {
  id: string;
  content: string;
  version: number;
  updated_at: string;
  updated_by: ProfileUpdatedBy;
}

export interface AlertRule {
  id: string;
  user_id: string;
  trigger_type: AlertTriggerType;
  trigger_params: Record<string, unknown>;
  message_template: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AlertLog {
  id: string;
  alert_rule_id: string | null;
  user_id: string;
  message_sent: string;
  sent_at: string;
  channel: AlertChannel;
}

/** Computed budget status for a single category */
export interface CategoryBudgetStatus {
  category: Category;
  spent: number;
  budgeted: number;
  remaining: number;
  percentUsed: number;
  paceRatio: number; // percentUsed / percentOfMonth — >1 means ahead of pace
  status: PaceStatus;
  projectedMonthEnd: number;
}

/** Overall budget summary */
export interface BudgetSummary {
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  overallPaceRatio: number;
  overallStatus: PaceStatus;
  dayOfMonth: number;
  daysInMonth: number;
  percentOfMonth: number;
  dailyAllowance: number; // remaining / days left
  categories: CategoryBudgetStatus[];
  incomeThisMonth: number;
  savingsThisMonth: number;
  savingsBalance: number | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: finance module TypeScript types"
```

---

### Task 8: Budget Engine — Pace Calculations

**Files:**
- Create: `src/modules/finance/lib/budget-engine.ts`

- [ ] **Step 1: Implement the budget engine**

Create `src/modules/finance/lib/budget-engine.ts`:

```typescript
import type {
  Category,
  CategoryBudgetStatus,
  BudgetSummary,
  PaceStatus,
  Transaction,
  Account,
} from "@/modules/finance/types";
import { PACE_THRESHOLDS } from "@/shared/lib/constants";

export function calculatePaceStatus(percentUsed: number, percentOfMonth: number): PaceStatus {
  if (percentUsed >= 100) return "red";
  if (percentOfMonth === 0) return percentUsed > 0 ? "orange" : "green";

  const paceRatio = percentUsed / (percentOfMonth * 100);
  if (paceRatio <= PACE_THRESHOLDS.GREEN_MAX) return "green";
  if (paceRatio <= PACE_THRESHOLDS.YELLOW_MAX) return "yellow";
  return "orange";
}

export function calculateCategoryBudget(
  category: Category,
  transactions: Transaction[],
  percentOfMonth: number
): CategoryBudgetStatus {
  const spent = transactions
    .filter((t) => t.portal_category_id === category.id && t.transaction_type === "expense")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const budgeted = category.monthly_budget;
  const remaining = Math.max(budgeted - spent, 0);
  const percentUsed = budgeted > 0 ? (spent / budgeted) * 100 : 0;
  const paceRatio = percentOfMonth > 0 ? (percentUsed / 100) / percentOfMonth : 0;
  const status = calculatePaceStatus(percentUsed, percentOfMonth);
  const projectedMonthEnd = percentOfMonth > 0 ? spent / percentOfMonth : spent;

  return {
    category,
    spent,
    budgeted,
    remaining,
    percentUsed,
    paceRatio,
    status,
    projectedMonthEnd,
  };
}

export function calculateBudgetSummary(
  categories: Category[],
  transactions: Transaction[],
  accounts: Account[],
  now: Date = new Date()
): BudgetSummary {
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const percentOfMonth = dayOfMonth / daysInMonth;
  const daysRemaining = daysInMonth - dayOfMonth;

  const discretionary = categories.filter((c) => c.type === "discretionary" && c.is_active);
  const categoryStatuses = discretionary.map((c) =>
    calculateCategoryBudget(c, transactions, percentOfMonth)
  );

  // Sort: problem categories first (red > orange > yellow > green), then by sort_order
  const statusOrder: Record<PaceStatus, number> = { red: 0, orange: 1, yellow: 2, green: 3 };
  categoryStatuses.sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.category.sort_order - b.category.sort_order;
  });

  const totalBudgeted = categoryStatuses.reduce((s, c) => s + c.budgeted, 0);
  const totalSpent = categoryStatuses.reduce((s, c) => s + c.spent, 0);
  const totalRemaining = Math.max(totalBudgeted - totalSpent, 0);
  const overallPercentUsed = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const overallPaceRatio = percentOfMonth > 0 ? (overallPercentUsed / 100) / percentOfMonth : 0;
  const overallStatus = calculatePaceStatus(overallPercentUsed, percentOfMonth);
  const dailyAllowance = daysRemaining > 0 ? totalRemaining / daysRemaining : 0;

  const incomeThisMonth = transactions
    .filter((t) => t.transaction_type === "income")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const savingsThisMonth = transactions
    .filter((t) => t.transaction_type === "savings_transfer")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Find savings account balance (SoFi HYSA or similar)
  const savingsAccount = accounts.find(
    (a) => a.subtype === "savings" || a.name.toLowerCase().includes("savings")
  );

  return {
    totalBudgeted,
    totalSpent,
    totalRemaining,
    overallPaceRatio,
    overallStatus,
    dayOfMonth,
    daysInMonth,
    percentOfMonth,
    dailyAllowance,
    categories: categoryStatuses,
    incomeThisMonth,
    savingsThisMonth,
    savingsBalance: savingsAccount?.current_balance ?? null,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: budget engine with pace-adjusted calculations"
```

---

### Task 9: Transaction Categorizer

**Files:**
- Create: `src/modules/finance/lib/categorizer.ts`, `src/modules/finance/lib/transaction-classifier.ts`

- [ ] **Step 1: Create transaction type classifier**

Create `src/modules/finance/lib/transaction-classifier.ts`:

```typescript
import type { TransactionType } from "@/modules/finance/types";

interface ClassifierInput {
  amount: number; // Plaid: positive = debit, negative = credit
  accountType: string; // "depository", "credit"
  accountSubtype: string | null; // "checking", "savings", "credit card"
  merchantName: string | null;
  plaidCategory: string[] | null;
  accountName: string;
}

/**
 * Classifies a Plaid transaction into our transaction types.
 *
 * Plaid convention: positive amount = money left the account (debit/expense),
 * negative amount = money entered the account (credit/deposit).
 */
export function classifyTransaction(input: ClassifierInput): TransactionType {
  const { amount, accountSubtype, plaidCategory, merchantName, accountName } = input;

  // Negative amount on checking = money coming in
  if (amount < 0 && accountSubtype === "checking") {
    // Check if it's a transfer from savings
    const name = (merchantName ?? "").toLowerCase();
    if (name.includes("sofi") || name.includes("savings") || name.includes("transfer from")) {
      return "savings_transfer"; // withdrawal from savings
    }
    // Paycheck / direct deposit
    const categories = plaidCategory ?? [];
    if (
      categories.some((c) => c.toLowerCase().includes("payroll")) ||
      name.includes("direct dep") ||
      name.includes("payroll")
    ) {
      return "income";
    }
    return "income"; // Default: money in to checking = income
  }

  // Positive amount on savings = money leaving savings (transfer out)
  if (amount > 0 && (accountSubtype === "savings" || accountName.toLowerCase().includes("savings"))) {
    return "savings_transfer";
  }

  // Negative amount on savings = money entering savings (auto-deposit)
  if (amount < 0 && (accountSubtype === "savings" || accountName.toLowerCase().includes("savings"))) {
    return "savings_transfer";
  }

  // Internal transfers between own accounts
  const name = (merchantName ?? "").toLowerCase();
  if (name.includes("transfer") && !name.includes("venmo") && !name.includes("zelle")) {
    return "internal_transfer";
  }

  return "expense";
}
```

- [ ] **Step 2: Create categorizer (priority cascade)**

Create `src/modules/finance/lib/categorizer.ts`:

```typescript
import type { CategoryRule, Category } from "@/modules/finance/types";

/**
 * Maps Plaid's category hierarchy to our category names.
 * This is a rough mapping — user rules take priority.
 */
const PLAID_CATEGORY_MAP: Record<string, string> = {
  "food and drink": "Dining/Delivery",
  "restaurants": "Dining/Delivery",
  "groceries": "Groceries",
  "shops": "Shopping",
  "transportation": "Transportation",
  "entertainment": "Entertainment",
  "recreation": "Entertainment",
  "service": "Personal",
  "healthcare": "Personal",
  "utilities": "Utilities",
  "rent": "Rent/Mortgage",
  "mortgage": "Rent/Mortgage",
  "insurance": "Insurance",
  "subscription": "Subscriptions",
};

/**
 * Categorize a transaction using the priority cascade:
 * 1. User rules (pattern match on merchant name)
 * 2. AI-suggested rules
 * 3. Plaid category mapping
 * 4. null (Unbudgeted)
 */
export function categorizeTransaction(
  merchantName: string | null,
  plaidCategories: string[] | null,
  rules: CategoryRule[],
  categories: Category[]
): string | null {
  const merchant = (merchantName ?? "").toLowerCase();

  // 1 & 2: Check user rules first, then AI rules
  const userRules = rules.filter((r) => r.source === "user");
  const aiRules = rules.filter((r) => r.source === "ai");

  for (const rule of [...userRules, ...aiRules]) {
    if (merchant.includes(rule.pattern.toLowerCase())) {
      return rule.category_id;
    }
  }

  // 3: Plaid category fallback
  if (plaidCategories && plaidCategories.length > 0) {
    for (const plaidCat of plaidCategories) {
      const mapped = PLAID_CATEGORY_MAP[plaidCat.toLowerCase()];
      if (mapped) {
        const category = categories.find((c) => c.name === mapped);
        if (category) return category.id;
      }
    }
  }

  // 4: Unbudgeted
  return null;
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: transaction classifier and categorization cascade"
```

---

### Task 10: Plaid Integration — Link & Sync

**Files:**
- Create: `src/modules/finance/lib/plaid-service.ts`, `src/app/api/plaid/create-link-token/route.ts`, `src/app/api/plaid/exchange-token/route.ts`, `src/app/api/plaid/sync/route.ts`, `src/app/api/plaid/webhook/route.ts`, `src/modules/finance/components/plaid-link-button.tsx`

- [ ] **Step 1: Install Plaid packages**

```bash
npm install plaid react-plaid-link
```

- [ ] **Step 2: Create Plaid service**

Create `src/modules/finance/lib/plaid-service.ts`:

```typescript
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] ?? PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
      "PLAID-SECRET": process.env.PLAID_SECRET!,
    },
  },
});

export const plaidClient = new PlaidApi(config);

export async function createLinkToken(userId: string) {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Smolowe Portal",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
    webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook`,
  });
  return response.data.link_token;
}

export async function exchangePublicToken(publicToken: string) {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });
  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  };
}

export async function syncTransactions(accessToken: string, cursor?: string | null) {
  const allAdded: any[] = [];
  const allModified: any[] = [];
  const allRemoved: any[] = [];
  let hasMore = true;
  let nextCursor = cursor ?? undefined;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor: nextCursor,
    });

    allAdded.push(...response.data.added);
    allModified.push(...response.data.modified);
    allRemoved.push(...response.data.removed);
    hasMore = response.data.has_more;
    nextCursor = response.data.next_cursor;
  }

  return {
    added: allAdded,
    modified: allModified,
    removed: allRemoved,
    cursor: nextCursor,
  };
}

export async function getAccounts(accessToken: string) {
  const response = await plaidClient.accountsGet({
    access_token: accessToken,
  });
  return response.data.accounts;
}
```

- [ ] **Step 3: Create API route — create link token**

Create `src/app/api/plaid/create-link-token/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createLinkToken } from "@/modules/finance/lib/plaid-service";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const linkToken = await createLinkToken(user.id);
    return NextResponse.json({ link_token: linkToken });
  } catch (error) {
    console.error("Failed to create link token:", error);
    return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create API route — exchange token**

Create `src/app/api/plaid/exchange-token/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { exchangePublicToken, getAccounts, syncTransactions } from "@/modules/finance/lib/plaid-service";
import { categorizeTransaction } from "@/modules/finance/lib/categorizer";
import { classifyTransaction } from "@/modules/finance/lib/transaction-classifier";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { public_token, institution } = await request.json();

  try {
    // Exchange for access token
    const { accessToken, itemId } = await exchangePublicToken(public_token);

    // Store plaid item (access token stored as plain text for now — Vault integration is a future enhancement)
    const { data: plaidItem, error: itemError } = await admin
      .from("plaid_items")
      .insert({
        user_id: user.id,
        access_token_vault_id: null, // TODO: store in Vault
        institution_name: institution.name,
        institution_id: institution.institution_id,
        module_context: "household",
      })
      .select()
      .single();

    if (itemError) throw itemError;

    // We need to store the access token somewhere accessible for sync
    // For now, store it in a metadata column (we'll migrate to Vault later)
    // Using a separate approach: store encrypted in plaid_items
    await admin
      .from("plaid_items")
      .update({ cursor: `__token__${accessToken}` }) // Temporary: piggyback on cursor field
      .eq("id", plaidItem.id);

    // Fetch and store accounts
    const accounts = await getAccounts(accessToken);
    for (const account of accounts) {
      await admin.from("accounts").upsert({
        plaid_item_id: plaidItem.id,
        plaid_account_id: account.account_id,
        name: account.name,
        official_name: account.official_name,
        type: account.type,
        subtype: account.subtype,
        current_balance: account.balances.current,
        available_balance: account.balances.available,
        iso_currency_code: account.balances.iso_currency_code,
        last_balance_update: new Date().toISOString(),
      }, { onConflict: "plaid_account_id" });
    }

    // Initial transaction sync
    const syncResult = await syncTransactions(accessToken);

    // Get categories and rules for auto-categorization
    const { data: categories } = await admin.from("categories").select("*");
    const { data: rules } = await admin.from("category_rules").select("*");

    // Store transactions
    for (const txn of syncResult.added) {
      const account = accounts.find((a) => a.account_id === txn.account_id);
      const { data: dbAccount } = await admin
        .from("accounts")
        .select("id, name, type, subtype")
        .eq("plaid_account_id", txn.account_id)
        .single();

      if (!dbAccount) continue;

      const txnType = classifyTransaction({
        amount: txn.amount,
        accountType: account?.type ?? "",
        accountSubtype: account?.subtype ?? null,
        merchantName: txn.merchant_name ?? txn.name,
        plaidCategory: txn.personal_finance_category ? [txn.personal_finance_category.primary] : null,
        accountName: dbAccount.name,
      });

      const categoryId = txnType === "expense"
        ? categorizeTransaction(
            txn.merchant_name ?? txn.name,
            txn.personal_finance_category ? [txn.personal_finance_category.primary] : null,
            rules ?? [],
            categories ?? []
          )
        : null;

      await admin.from("transactions").upsert({
        account_id: dbAccount.id,
        plaid_transaction_id: txn.transaction_id,
        date: txn.date,
        amount: txn.amount,
        merchant_name: txn.merchant_name ?? txn.name,
        plaid_category: txn.personal_finance_category ? [txn.personal_finance_category.primary, txn.personal_finance_category.detailed] : null,
        portal_category_id: categoryId,
        transaction_type: txnType,
      }, { onConflict: "plaid_transaction_id" });
    }

    // Update cursor
    await admin
      .from("plaid_items")
      .update({ cursor: syncResult.cursor, last_synced_at: new Date().toISOString() })
      .eq("id", plaidItem.id);

    return NextResponse.json({
      success: true,
      accounts: accounts.length,
      transactions: syncResult.added.length,
    });
  } catch (error) {
    console.error("Failed to exchange token:", error);
    return NextResponse.json({ error: "Failed to connect account" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create Plaid Link button component**

Create `src/modules/finance/components/plaid-link-button.tsx`:

```typescript
"use client";

import { useCallback, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Plus } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function PlaidLinkButton({ onSuccess }: { onSuccess?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLinkToken = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
    const data = await res.json();
    setLinkToken(data.link_token);
    setLoading(false);
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_token: publicToken,
          institution: metadata.institution,
        }),
      });
      onSuccess?.();
    },
  });

  const handleClick = async () => {
    if (!linkToken) {
      await fetchLinkToken();
    }
    // usePlaidLink will auto-open when token is set, but we also try manual open
    if (ready) open();
  };

  // Auto-open when link token is fetched
  if (linkToken && ready) {
    open();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
        "bg-accent text-white hover:opacity-90 disabled:opacity-50"
      )}
    >
      <Plus size={16} />
      {loading ? "Connecting..." : "Connect Account"}
    </button>
  );
}
```

- [ ] **Step 6: Create Plaid webhook handler**

Create `src/app/api/plaid/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const admin = createAdminClient();

  // Plaid sends various webhook types
  if (body.webhook_type === "TRANSACTIONS") {
    if (body.webhook_code === "SYNC_UPDATES_AVAILABLE") {
      // Trigger a sync for this item
      const itemId = body.item_id;

      // Find the plaid item in our DB
      const { data: plaidItem } = await admin
        .from("plaid_items")
        .select("id")
        .eq("institution_id", itemId)
        .single();

      if (plaidItem) {
        // Trigger sync via our sync endpoint
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plaid_item_id: plaidItem.id }),
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 7: Create sync endpoint (used by webhook and cron)**

Create `src/app/api/plaid/sync/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { syncTransactions, getAccounts } from "@/modules/finance/lib/plaid-service";
import { categorizeTransaction } from "@/modules/finance/lib/categorizer";
import { classifyTransaction } from "@/modules/finance/lib/transaction-classifier";

export async function POST(request: NextRequest) {
  const admin = createAdminClient();
  const { plaid_item_id } = await request.json();

  // Get plaid item with access token
  const { data: plaidItem } = await admin
    .from("plaid_items")
    .select("*")
    .eq("id", plaid_item_id)
    .single();

  if (!plaidItem) {
    return NextResponse.json({ error: "Plaid item not found" }, { status: 404 });
  }

  // Extract access token (temporary: stored in cursor field with prefix)
  const cursor = plaidItem.cursor;
  let accessToken: string | null = null;
  let syncCursor: string | undefined;

  if (cursor?.startsWith("__token__")) {
    accessToken = cursor.replace("__token__", "");
    syncCursor = undefined;
  } else {
    // Need to retrieve access token from a stored location
    // For now, we can't sync without the token
    return NextResponse.json({ error: "No access token available" }, { status: 400 });
  }

  try {
    // Update account balances
    const accounts = await getAccounts(accessToken);
    for (const account of accounts) {
      await admin.from("accounts").update({
        current_balance: account.balances.current,
        available_balance: account.balances.available,
        last_balance_update: new Date().toISOString(),
      }).eq("plaid_account_id", account.account_id);
    }

    // Sync transactions
    const syncResult = await syncTransactions(accessToken, syncCursor);

    // Get categories and rules
    const { data: categories } = await admin.from("categories").select("*");
    const { data: rules } = await admin.from("category_rules").select("*");

    let newTransactionCount = 0;

    for (const txn of syncResult.added) {
      const account = accounts.find((a) => a.account_id === txn.account_id);
      const { data: dbAccount } = await admin
        .from("accounts")
        .select("id, name, type, subtype")
        .eq("plaid_account_id", txn.account_id)
        .single();

      if (!dbAccount) continue;

      const txnType = classifyTransaction({
        amount: txn.amount,
        accountType: account?.type ?? "",
        accountSubtype: account?.subtype ?? null,
        merchantName: txn.merchant_name ?? txn.name,
        plaidCategory: txn.personal_finance_category ? [txn.personal_finance_category.primary] : null,
        accountName: dbAccount.name,
      });

      const categoryId = txnType === "expense"
        ? categorizeTransaction(
            txn.merchant_name ?? txn.name,
            txn.personal_finance_category ? [txn.personal_finance_category.primary] : null,
            rules ?? [],
            categories ?? []
          )
        : null;

      await admin.from("transactions").upsert({
        account_id: dbAccount.id,
        plaid_transaction_id: txn.transaction_id,
        date: txn.date,
        amount: txn.amount,
        merchant_name: txn.merchant_name ?? txn.name,
        plaid_category: txn.personal_finance_category ? [txn.personal_finance_category.primary, txn.personal_finance_category.detailed] : null,
        portal_category_id: categoryId,
        transaction_type: txnType,
      }, { onConflict: "plaid_transaction_id" });

      newTransactionCount++;
    }

    // Handle removed transactions
    for (const removed of syncResult.removed) {
      if (removed.transaction_id) {
        await admin.from("transactions").delete().eq("plaid_transaction_id", removed.transaction_id);
      }
    }

    // Update sync cursor
    await admin
      .from("plaid_items")
      .update({ cursor: syncResult.cursor, last_synced_at: new Date().toISOString() })
      .eq("id", plaid_item_id);

    // Trigger alert evaluation for new transactions
    if (newTransactionCount > 0) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/alerts/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaid_item_id }),
      }).catch(() => {}); // Fire and forget
    }

    return NextResponse.json({
      success: true,
      added: newTransactionCount,
      removed: syncResult.removed.length,
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Plaid integration — link token, exchange, sync, webhook, categorization"
```

---

## Phase 3: Dashboard UI

### Task 11: Hero Metric Component

**Files:**
- Create: `src/modules/finance/components/hero-metric.tsx`

- [ ] **Step 1: Build the hero metric**

Create `src/modules/finance/components/hero-metric.tsx`:

```typescript
"use client";

import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { formatCurrency } from "@/shared/lib/utils";
import { ProgressBar } from "@/shared/components/progress-bar";
import type { BudgetSummary } from "@/modules/finance/types";

interface HeroMetricProps {
  summary: BudgetSummary;
}

const statusBgColors = {
  green: "bg-status-green-muted",
  yellow: "bg-status-yellow-muted",
  orange: "bg-status-orange-muted",
  red: "bg-status-red-muted",
};

export function HeroMetric({ summary }: HeroMetricProps) {
  const { totalSpent, totalBudgeted, overallStatus, dayOfMonth, daysInMonth, dailyAllowance, savingsBalance, percentOfMonth } = summary;

  return (
    <div className={cn("rounded-lg p-6 mb-6", statusBgColors[overallStatus])}>
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <span className="tabular-nums text-3xl font-semibold text-text-primary">
            {formatCurrency(totalSpent)}
          </span>
          <span className="text-text-secondary text-lg ml-2">
            of {formatCurrency(totalBudgeted)}
          </span>
        </div>
        <span className="text-sm text-text-tertiary">
          Day {dayOfMonth} of {daysInMonth}
        </span>
      </div>

      <ProgressBar
        value={Math.min((totalSpent / totalBudgeted) * 100, 100)}
        status={overallStatus}
        className="mb-3"
      />

      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">
          {formatCurrency(dailyAllowance)}/day remaining
        </span>
        {savingsBalance !== null && (
          <span className="text-text-tertiary">
            Savings: {formatCurrency(savingsBalance)}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: hero metric component with pace-adjusted status"
```

---

### Task 12: Category List & Recent Transactions

**Files:**
- Create: `src/modules/finance/components/category-row.tsx`, `src/modules/finance/components/category-list.tsx`, `src/modules/finance/components/transaction-row.tsx`, `src/modules/finance/components/recent-transactions.tsx`, `src/modules/finance/components/ai-insight-bar.tsx`

- [ ] **Step 1: Create category row**

Create `src/modules/finance/components/category-row.tsx`:

```typescript
import { ProgressBar } from "@/shared/components/progress-bar";
import { StatusBadge } from "@/shared/components/status-badge";
import { formatCurrency } from "@/shared/lib/utils";
import type { CategoryBudgetStatus } from "@/modules/finance/types";

interface CategoryRowProps {
  item: CategoryBudgetStatus;
}

export function CategoryRow({ item }: CategoryRowProps) {
  const { category, spent, budgeted, remaining, percentUsed, status } = item;

  return (
    <div className="flex items-center gap-4 py-3 px-2 border-b border-border-subtle last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-text-primary truncate">
            {category.name}
          </span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums text-sm text-text-secondary">
              {formatCurrency(spent)} / {formatCurrency(budgeted)}
            </span>
            <StatusBadge status={status} />
          </div>
        </div>
        <ProgressBar value={Math.min(percentUsed, 100)} status={status} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create category list**

Create `src/modules/finance/components/category-list.tsx`:

```typescript
import { CategoryRow } from "./category-row";
import type { CategoryBudgetStatus } from "@/modules/finance/types";

interface CategoryListProps {
  categories: CategoryBudgetStatus[];
}

export function CategoryList({ categories }: CategoryListProps) {
  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-text-tertiary text-sm">
        No budget categories set up yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-secondary">
      {categories.map((item) => (
        <CategoryRow key={item.category.id} item={item} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create transaction row**

Create `src/modules/finance/components/transaction-row.tsx`:

```typescript
import { formatCurrency, formatDate } from "@/shared/lib/utils";
import { cn } from "@/shared/lib/utils";
import type { Transaction } from "@/modules/finance/types";

interface TransactionRowProps {
  transaction: Transaction;
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const isIncome = transaction.transaction_type === "income";
  const isSavings = transaction.transaction_type === "savings_transfer";

  return (
    <div className="flex items-center justify-between py-3 px-2 border-b border-border-subtle last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-primary truncate">
          {transaction.merchant_name ?? "Unknown"}
        </p>
        <p className="text-xs text-text-tertiary">
          {formatDate(transaction.date)}
          {transaction.category && (
            <span className="ml-2 text-text-tertiary">
              · {transaction.category.name}
            </span>
          )}
        </p>
      </div>
      <span
        className={cn(
          "tabular-nums text-sm font-medium",
          isIncome ? "text-status-green" : isSavings ? "text-accent" : "text-text-primary"
        )}
      >
        {isIncome ? "+" : isSavings ? "→ " : "-"}
        {formatCurrency(Math.abs(transaction.amount))}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Create recent transactions**

Create `src/modules/finance/components/recent-transactions.tsx`:

```typescript
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TransactionRow } from "./transaction-row";
import type { Transaction } from "@/modules/finance/types";

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-secondary">Recent</h3>
        <Link
          href="/finance/transactions"
          className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          View all <ArrowRight size={12} />
        </Link>
      </div>
      <div className="rounded-lg border border-border bg-bg-secondary">
        {transactions.length === 0 ? (
          <div className="py-6 text-center text-sm text-text-tertiary">
            No transactions yet. Connect an account to get started.
          </div>
        ) : (
          transactions.slice(0, 3).map((txn) => (
            <TransactionRow key={txn.id} transaction={txn} />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create AI insight bar**

Create `src/modules/finance/components/ai-insight-bar.tsx`:

```typescript
import { Sparkles } from "lucide-react";

interface AiInsightBarProps {
  insight: string | null;
}

export function AiInsightBar({ insight }: AiInsightBarProps) {
  if (!insight) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent-muted text-sm text-text-secondary mb-6">
      <Sparkles size={14} className="text-accent shrink-0" />
      <span>{insight}</span>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: category list, transaction row, recent transactions, AI insight bar"
```

---

### Task 13: Finance Dashboard Page (Wire It All Together)

**Files:**
- Modify: `src/app/(portal)/finance/page.tsx`

- [ ] **Step 1: Build the dashboard page with server-side data fetching**

Replace `src/app/(portal)/finance/page.tsx`:

```typescript
import { createClient } from "@/shared/lib/supabase/server";
import { calculateBudgetSummary } from "@/modules/finance/lib/budget-engine";
import { HeroMetric } from "@/modules/finance/components/hero-metric";
import { CategoryList } from "@/modules/finance/components/category-list";
import { RecentTransactions } from "@/modules/finance/components/recent-transactions";
import { AiInsightBar } from "@/modules/finance/components/ai-insight-bar";
import { PlaidLinkButton } from "@/modules/finance/components/plaid-link-button";
import type { Transaction, Category, Account } from "@/modules/finance/types";

export const dynamic = "force-dynamic";

export default async function FinanceDashboard() {
  const supabase = await createClient();

  // Fetch current month's data
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [categoriesRes, transactionsRes, accountsRes, plaidItemsRes] = await Promise.all([
    supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("transactions")
      .select("*, category:categories(*)")
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .order("date", { ascending: false }),
    supabase.from("accounts").select("*"),
    supabase.from("plaid_items").select("id"),
  ]);

  const categories = (categoriesRes.data ?? []) as Category[];
  const transactions = (transactionsRes.data ?? []) as Transaction[];
  const accounts = (accountsRes.data ?? []) as Account[];
  const hasAccounts = (plaidItemsRes.data?.length ?? 0) > 0;

  const summary = calculateBudgetSummary(categories, transactions, accounts, now);

  // Get recent transactions (all types, last 5)
  const { data: recentTxns } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .order("date", { ascending: false })
    .limit(5);

  return (
    <div className="max-w-2xl">
      {!hasAccounts ? (
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            Connect your first account
          </h2>
          <p className="text-text-secondary mb-6 text-sm">
            Link a bank account or credit card to start tracking your budget.
          </p>
          <PlaidLinkButton />
        </div>
      ) : (
        <>
          <AiInsightBar insight={null} />
          <HeroMetric summary={summary} />
          <CategoryList categories={summary.categories} />
          <RecentTransactions transactions={(recentTxns ?? []) as Transaction[]} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: finance dashboard page — hero metric, categories, recent transactions"
```

---

### Task 14: Transactions Page

**Files:**
- Create: `src/modules/finance/components/transaction-list.tsx`, `src/app/(portal)/finance/transactions/page.tsx`

- [ ] **Step 1: Create transaction list with search/filter**

Create `src/modules/finance/components/transaction-list.tsx`:

```typescript
"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { TransactionRow } from "./transaction-row";
import { cn } from "@/shared/lib/utils";
import type { Transaction, TransactionType } from "@/modules/finance/types";

interface TransactionListProps {
  transactions: Transaction[];
}

const typeFilters: { label: string; value: TransactionType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Expenses", value: "expense" },
  { label: "Income", value: "income" },
  { label: "Savings", value: "savings_transfer" },
];

export function TransactionList({ transactions }: TransactionListProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");

  const filtered = useMemo(() => {
    return transactions.filter((txn) => {
      const matchesSearch = search === "" ||
        (txn.merchant_name ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || txn.transaction_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [transactions, search, typeFilter]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex gap-1">
          {typeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs transition-colors",
                typeFilter === f.value
                  ? "bg-bg-tertiary text-text-primary font-medium"
                  : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-bg-secondary">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-tertiary">
            No transactions found.
          </div>
        ) : (
          filtered.map((txn) => (
            <TransactionRow key={txn.id} transaction={txn} />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create transactions page**

Create `src/app/(portal)/finance/transactions/page.tsx`:

```typescript
import { createClient } from "@/shared/lib/supabase/server";
import { TransactionList } from "@/modules/finance/components/transaction-list";
import type { Transaction } from "@/modules/finance/types";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .order("date", { ascending: false })
    .limit(200);

  return (
    <div className="max-w-3xl">
      <TransactionList transactions={(data ?? []) as Transaction[]} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: transactions page with search and type filtering"
```

---

### Task 15: Trends Page

**Files:**
- Create: `src/modules/finance/components/trend-chart.tsx`, `src/app/(portal)/finance/trends/page.tsx`

- [ ] **Step 1: Create trend chart wrapper**

Create `src/modules/finance/components/trend-chart.tsx`:

```typescript
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface TrendChartProps {
  data: { month: string; amount: number }[];
  title: string;
  color?: string;
}

export function TrendChart({ data, title, color = "var(--accent)" }: TrendChartProps) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border-default)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
              color: "var(--text-primary)",
            }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, "Amount"]}
          />
          <Bar dataKey="amount" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Create trends page**

Create `src/app/(portal)/finance/trends/page.tsx`:

```typescript
import { createClient } from "@/shared/lib/supabase/server";
import { TrendChart } from "@/modules/finance/components/trend-chart";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const supabase = await createClient();

  // Get last 6 months of transactions
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startDate = sixMonthsAgo.toISOString().split("T")[0];

  const { data: transactions } = await supabase
    .from("transactions")
    .select("date, amount, transaction_type")
    .gte("date", startDate)
    .order("date");

  // Aggregate by month
  const monthlySpending: Record<string, number> = {};
  const monthlyIncome: Record<string, number> = {};

  for (const txn of transactions ?? []) {
    const month = txn.date.substring(0, 7); // YYYY-MM
    const label = new Date(txn.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" });
    const key = `${month}|${label}`;

    if (txn.transaction_type === "expense") {
      monthlySpending[key] = (monthlySpending[key] ?? 0) + Math.abs(txn.amount);
    } else if (txn.transaction_type === "income") {
      monthlyIncome[key] = (monthlyIncome[key] ?? 0) + Math.abs(txn.amount);
    }
  }

  const spendingData = Object.entries(monthlySpending)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => ({ month: key.split("|")[1], amount: Math.round(amount) }));

  const incomeData = Object.entries(monthlyIncome)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => ({ month: key.split("|")[1], amount: Math.round(amount) }));

  return (
    <div className="max-w-3xl space-y-6">
      <TrendChart data={spendingData} title="Monthly Spending" color="var(--status-orange)" />
      <TrendChart data={incomeData} title="Monthly Income" color="var(--status-green)" />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: trends page with monthly spending and income charts"
```

---

## Phase 4: AI Advisor & SMS Bot

### Task 16: AI Service — Gemini Integration with Function Calling

**Files:**
- Create: `src/modules/finance/lib/ai-tools.ts`, `src/modules/finance/lib/ai-context-builder.ts`, `src/modules/finance/lib/ai-service.ts`

- [ ] **Step 1: Install Gemini package**

```bash
npm install @google/genai
```

- [ ] **Step 2: Define AI tool (function) definitions**

Create `src/modules/finance/lib/ai-tools.ts`:

```typescript
/**
 * Structured tool definitions for Gemini function calling.
 * These let the AI query the database for precise answers
 * instead of computing from context.
 */
export const AI_TOOLS = [
  {
    name: "get_category_spending",
    description: "Get the total spending for a specific budget category in the current month",
    parameters: {
      type: "object" as const,
      properties: {
        category_name: {
          type: "string",
          description: "The category name, e.g. 'Dining/Delivery', 'Groceries'",
        },
      },
      required: ["category_name"],
    },
  },
  {
    name: "get_merchant_spending",
    description: "Get total spending at a specific merchant in the current month",
    parameters: {
      type: "object" as const,
      properties: {
        merchant_name: {
          type: "string",
          description: "The merchant name or partial match, e.g. 'DoorDash', 'Amazon'",
        },
      },
      required: ["merchant_name"],
    },
  },
  {
    name: "get_budget_summary",
    description: "Get the overall budget summary including all categories, total spent, remaining, and daily allowance",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_savings_balance",
    description: "Get the current savings account balance",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_recent_transactions",
    description: "Get the most recent transactions, optionally filtered by merchant or category",
    parameters: {
      type: "object" as const,
      properties: {
        merchant_filter: {
          type: "string",
          description: "Optional merchant name to filter by",
        },
        limit: {
          type: "number",
          description: "Number of transactions to return (default 10)",
        },
      },
    },
  },
  {
    name: "create_category",
    description: "Create a new budget category",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Category name" },
        type: { type: "string", enum: ["fixed", "discretionary"], description: "Category type" },
        monthly_budget: { type: "number", description: "Monthly budget amount" },
        is_temporary: { type: "boolean", description: "Whether this is a temporary project category" },
      },
      required: ["name", "type", "monthly_budget"],
    },
  },
  {
    name: "recategorize_transaction",
    description: "Move a transaction to a different category",
    parameters: {
      type: "object" as const,
      properties: {
        transaction_id: { type: "string", description: "The transaction ID" },
        category_name: { type: "string", description: "Target category name" },
        create_rule: { type: "boolean", description: "Whether to create a rule for this merchant" },
      },
      required: ["transaction_id", "category_name"],
    },
  },
  {
    name: "update_budget",
    description: "Update the monthly budget amount for a category",
    parameters: {
      type: "object" as const,
      properties: {
        category_name: { type: "string", description: "Category name" },
        new_budget: { type: "number", description: "New monthly budget amount" },
      },
      required: ["category_name", "new_budget"],
    },
  },
];
```

- [ ] **Step 3: Create context builder**

Create `src/modules/finance/lib/ai-context-builder.ts`:

```typescript
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { calculateBudgetSummary } from "./budget-engine";
import { formatCurrency } from "@/shared/lib/utils";
import type { Category, Transaction, Account } from "@/modules/finance/types";

export async function buildAiContext(userId: string): Promise<string> {
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  // Fetch everything in parallel
  const [profileRes, categoriesRes, transactionsRes, accountsRes] = await Promise.all([
    admin.from("financial_profile").select("content").order("version", { ascending: false }).limit(1).single(),
    admin.from("categories").select("*").eq("is_active", true),
    admin.from("transactions").select("*").gte("date", monthStart).lte("date", monthEnd),
    admin.from("accounts").select("*"),
  ]);

  const profile = profileRes.data?.content ?? "No financial profile yet.";
  const categories = (categoriesRes.data ?? []) as Category[];
  const transactions = (transactionsRes.data ?? []) as Transaction[];
  const accounts = (accountsRes.data ?? []) as Account[];

  const summary = calculateBudgetSummary(categories, transactions, accounts, now);

  // Build aggregated spending by category
  const categoryLines = summary.categories
    .map((c) => `- ${c.category.name}: ${formatCurrency(c.spent)} / ${formatCurrency(c.budgeted)} (${c.status})`)
    .join("\n");

  // Top merchants this month
  const merchantTotals: Record<string, number> = {};
  for (const txn of transactions.filter((t) => t.transaction_type === "expense")) {
    const name = txn.merchant_name ?? "Unknown";
    merchantTotals[name] = (merchantTotals[name] ?? 0) + Math.abs(txn.amount);
  }
  const topMerchants = Object.entries(merchantTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, total]) => `- ${name}: ${formatCurrency(total)}`)
    .join("\n");

  // Look up user name
  const { data: userProfile } = await admin.from("profiles").select("name").eq("id", userId).single();

  return `You are a financial advisor for the Smolowe household (Alex and Emine). You are talking to ${userProfile?.name ?? "a household member"}.

## Financial Profile
${profile}

## Current Month Budget Status (${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })})
Day ${summary.dayOfMonth} of ${summary.daysInMonth} (${Math.round(summary.percentOfMonth * 100)}% through month)

Overall: ${formatCurrency(summary.totalSpent)} of ${formatCurrency(summary.totalBudgeted)} spent (${summary.overallStatus})
Daily allowance remaining: ${formatCurrency(summary.dailyAllowance)}/day
Income this month: ${formatCurrency(summary.incomeThisMonth)}
Savings transfers this month: ${formatCurrency(summary.savingsThisMonth)}
${summary.savingsBalance !== null ? `Savings balance: ${formatCurrency(summary.savingsBalance)}` : ""}

### Category Breakdown (discretionary)
${categoryLines}

### Top Merchants This Month
${topMerchants}

## Your Role
- Answer financial questions using the tool functions for precise data. NEVER guess numbers.
- Be direct, supportive, and specific. Lead with wins when possible.
- Aim for a 3:1 positive-to-corrective ratio.
- When asked about spending, always include context (pace, days remaining, daily allowance).
- You can suggest creating categories, recategorizing transactions, or adjusting budgets.
- For "what if" questions, use actual spending data to model scenarios.`;
}
```

- [ ] **Step 4: Create AI service**

Create `src/modules/finance/lib/ai-service.ts`:

```typescript
import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { buildAiContext } from "./ai-context-builder";
import { AI_TOOLS } from "./ai-tools";
import { formatCurrency } from "@/shared/lib/utils";
import type { Category } from "@/modules/finance/types";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/** Execute a tool call from the AI */
async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  switch (name) {
    case "get_category_spending": {
      const { data } = await admin
        .from("categories")
        .select("id, name, monthly_budget")
        .ilike("name", `%${args.category_name}%`)
        .limit(1)
        .single();
      if (!data) return `Category "${args.category_name}" not found.`;

      const { data: txns } = await admin
        .from("transactions")
        .select("amount")
        .eq("portal_category_id", data.id)
        .eq("transaction_type", "expense")
        .gte("date", monthStart)
        .lte("date", monthEnd);

      const spent = (txns ?? []).reduce((s, t) => s + Math.abs(t.amount), 0);
      return `${data.name}: ${formatCurrency(spent)} spent of ${formatCurrency(data.monthly_budget)} budget. ${formatCurrency(data.monthly_budget - spent)} remaining.`;
    }

    case "get_merchant_spending": {
      const { data: txns } = await admin
        .from("transactions")
        .select("amount, merchant_name")
        .ilike("merchant_name", `%${args.merchant_name}%`)
        .eq("transaction_type", "expense")
        .gte("date", monthStart)
        .lte("date", monthEnd);

      const total = (txns ?? []).reduce((s, t) => s + Math.abs(t.amount), 0);
      const count = txns?.length ?? 0;
      return `${args.merchant_name}: ${formatCurrency(total)} across ${count} transactions this month.`;
    }

    case "get_budget_summary": {
      const { data: categories } = await admin.from("categories").select("*").eq("is_active", true);
      const { data: transactions } = await admin
        .from("transactions")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd);
      const { data: accounts } = await admin.from("accounts").select("*");

      const { calculateBudgetSummary } = await import("./budget-engine");
      const summary = calculateBudgetSummary(
        (categories ?? []) as Category[],
        transactions ?? [],
        accounts ?? [],
        now
      );

      return `Overall: ${formatCurrency(summary.totalSpent)} of ${formatCurrency(summary.totalBudgeted)} (${summary.overallStatus}). Daily allowance: ${formatCurrency(summary.dailyAllowance)}/day for ${summary.daysInMonth - summary.dayOfMonth} remaining days.`;
    }

    case "get_savings_balance": {
      const { data: accounts } = await admin.from("accounts").select("*");
      const savings = accounts?.find(
        (a) => a.subtype === "savings" || a.name?.toLowerCase().includes("savings")
      );
      return savings
        ? `Savings balance: ${formatCurrency(savings.current_balance ?? 0)}`
        : "No savings account connected.";
    }

    case "get_recent_transactions": {
      let query = admin
        .from("transactions")
        .select("date, amount, merchant_name, transaction_type")
        .order("date", { ascending: false })
        .limit(args.limit ?? 10);

      if (args.merchant_filter) {
        query = query.ilike("merchant_name", `%${args.merchant_filter}%`);
      }

      const { data: txns } = await query;
      return (txns ?? [])
        .map((t) => `${t.date} | ${t.merchant_name} | ${formatCurrency(Math.abs(t.amount))} (${t.transaction_type})`)
        .join("\n");
    }

    case "create_category": {
      const { error } = await admin.from("categories").insert({
        name: args.name,
        type: args.type,
        monthly_budget: args.monthly_budget,
        is_temporary: args.is_temporary ?? false,
      });
      return error ? `Error creating category: ${error.message}` : `Created category "${args.name}" with budget ${formatCurrency(args.monthly_budget)}.`;
    }

    case "recategorize_transaction": {
      const { data: cat } = await admin
        .from("categories")
        .select("id")
        .ilike("name", `%${args.category_name}%`)
        .limit(1)
        .single();
      if (!cat) return `Category "${args.category_name}" not found.`;

      await admin
        .from("transactions")
        .update({ portal_category_id: cat.id })
        .eq("id", args.transaction_id);

      if (args.create_rule) {
        const { data: txn } = await admin
          .from("transactions")
          .select("merchant_name")
          .eq("id", args.transaction_id)
          .single();
        if (txn?.merchant_name) {
          await admin.from("category_rules").insert({
            pattern: txn.merchant_name.toLowerCase(),
            category_id: cat.id,
            source: "ai",
          });
        }
      }
      return `Transaction recategorized to "${args.category_name}".`;
    }

    case "update_budget": {
      const { error } = await admin
        .from("categories")
        .update({ monthly_budget: args.new_budget })
        .ilike("name", `%${args.category_name}%`);
      return error ? `Error: ${error.message}` : `Updated "${args.category_name}" budget to ${formatCurrency(args.new_budget)}/month.`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

export async function chat(
  userId: string,
  message: string,
  conversationHistory: { role: string; content: string }[] = []
): Promise<string> {
  const systemPrompt = await buildAiContext(userId);

  const messages = [
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "model",
      parts: [{ text: m.content }],
    })),
    { role: "user" as const, parts: [{ text: message }] },
  ];

  const response = await genai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: messages,
    config: {
      systemInstruction: systemPrompt,
      tools: [{
        functionDeclarations: AI_TOOLS,
      }],
    },
  });

  // Handle function calls
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  for (const part of parts) {
    if (part.functionCall) {
      const toolResult = await executeTool(
        part.functionCall.name,
        part.functionCall.args as Record<string, any>
      );

      // Send tool result back to get final response
      const followUp = await genai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          ...messages,
          { role: "model" as const, parts: [{ functionCall: part.functionCall }] },
          { role: "user" as const, parts: [{ functionResponse: { name: part.functionCall.name, response: { result: toolResult } } }] },
        ],
        config: {
          systemInstruction: systemPrompt,
        },
      });

      return followUp.candidates?.[0]?.content?.parts?.[0]?.text ?? "I couldn't generate a response.";
    }
  }

  return parts[0]?.text ?? "I couldn't generate a response.";
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Gemini AI service with function calling for factual queries"
```

---

### Task 17: AI Chat Panel

**Files:**
- Create: `src/modules/finance/components/ai-chat-message.tsx`, `src/modules/finance/components/ai-chat-panel.tsx`, `src/app/api/ai/chat/route.ts`

- [ ] **Step 1: Create chat API route**

Create `src/app/api/ai/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { chat } from "@/modules/finance/lib/ai-service";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, conversation_id } = await request.json();

  // Load conversation history if exists
  let history: { role: string; content: string }[] = [];
  if (conversation_id) {
    const { data } = await supabase
      .from("ai_conversations")
      .select("messages")
      .eq("id", conversation_id)
      .single();
    history = data?.messages ?? [];
  }

  try {
    const reply = await chat(user.id, message, history);

    // Save conversation
    const updatedMessages = [
      ...history,
      { role: "user", content: message },
      { role: "model", content: reply },
    ];

    if (conversation_id) {
      await supabase
        .from("ai_conversations")
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq("id", conversation_id);
    } else {
      const { data: newConvo } = await supabase
        .from("ai_conversations")
        .insert({
          user_id: user.id,
          channel: "portal",
          messages: updatedMessages,
        })
        .select("id")
        .single();

      return NextResponse.json({
        reply,
        conversation_id: newConvo?.id,
      });
    }

    return NextResponse.json({ reply, conversation_id });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json({ error: "AI service error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create chat message component**

Create `src/modules/finance/components/ai-chat-message.tsx`:

```typescript
import { cn } from "@/shared/lib/utils";
import { Sparkles, User } from "lucide-react";

interface AiChatMessageProps {
  role: "user" | "model";
  content: string;
}

export function AiChatMessage({ role, content }: AiChatMessageProps) {
  return (
    <div className={cn("flex gap-3 py-3", role === "user" ? "flex-row-reverse" : "")}>
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
          role === "user" ? "bg-accent-muted" : "bg-bg-tertiary"
        )}
      >
        {role === "user" ? <User size={14} /> : <Sparkles size={14} className="text-accent" />}
      </div>
      <div
        className={cn(
          "rounded-lg px-3 py-2 text-sm max-w-[80%]",
          role === "user"
            ? "bg-accent-muted text-text-primary"
            : "bg-bg-tertiary text-text-primary"
        )}
      >
        {content}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create floating chat panel**

Create `src/modules/finance/components/ai-chat-panel.tsx`:

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send } from "lucide-react";
import { AiChatMessage } from "./ai-chat-message";
import { cn } from "@/shared/lib/utils";

interface Message {
  role: "user" | "model";
  content: string;
}

export function AiChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: conversationId,
        }),
      });
      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [...prev, { role: "model", content: data.reply }]);
      }
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "model", content: "Sorry, something went wrong." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors",
          isOpen ? "bg-bg-tertiary" : "bg-accent"
        )}
      >
        {isOpen ? <X size={20} /> : <MessageCircle size={20} className="text-white" />}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-20 right-6 z-50 w-96 h-[500px] rounded-lg border border-border bg-bg-secondary shadow-lg flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">AI Advisor</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {messages.length === 0 && (
                <div className="text-center text-text-tertiary text-sm py-8">
                  Ask anything about your budget, spending, or finances.
                </div>
              )}
              {messages.map((msg, i) => (
                <AiChatMessage key={i} role={msg.role} content={msg.content} />
              ))}
              {loading && (
                <div className="flex gap-3 py-3">
                  <div className="w-7 h-7 rounded-full bg-bg-tertiary flex items-center justify-center">
                    <span className="animate-pulse text-accent text-xs">···</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask about your finances..."
                  className="flex-1 px-3 py-2 rounded-md bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="p-2 rounded-md bg-accent text-white disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 4: Add chat panel to portal layout**

Modify `src/app/(portal)/layout.tsx` — add the chat panel import and render it:

After the `</main>` closing tag, before the closing `</div>`, add:

```typescript
import { AiChatPanel } from "@/modules/finance/components/ai-chat-panel";

// ... inside the return, after </main>:
<AiChatPanel />
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: AI chat panel with Gemini function calling — floating slide-up UI"
```

---

### Task 18: SMS Bot — Twilio Integration

**Files:**
- Create: `src/modules/finance/lib/sms-service.ts`, `src/app/api/twilio/webhook/route.ts`

- [ ] **Step 1: Install Twilio**

```bash
npm install twilio
```

- [ ] **Step 2: Create SMS service**

Create `src/modules/finance/lib/sms-service.ts`:

```typescript
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function sendSms(to: string, body: string): Promise<void> {
  await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
  });
}

export async function sendAlertToAll(
  phones: string[],
  message: string
): Promise<void> {
  await Promise.all(phones.map((phone) => sendSms(phone, message)));
}
```

- [ ] **Step 3: Create Twilio webhook handler**

Create `src/app/api/twilio/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { chat } from "@/modules/finance/lib/ai-service";
import { sendSms } from "@/modules/finance/lib/sms-service";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const from = formData.get("From") as string;
  const body = formData.get("Body") as string;

  const admin = createAdminClient();

  // Look up user by phone number
  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, phone")
    .eq("phone", from)
    .single();

  if (!profile) {
    // Unknown number — ignore
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  // Load or create SMS conversation
  const { data: existingConvo } = await admin
    .from("ai_conversations")
    .select("id, messages")
    .eq("user_id", profile.id)
    .eq("channel", "sms")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  const history = existingConvo?.messages ?? [];

  try {
    const reply = await chat(profile.id, body, history as any[]);

    // Save conversation
    const updatedMessages = [
      ...history,
      { role: "user", content: body },
      { role: "model", content: reply },
    ];

    if (existingConvo) {
      await admin
        .from("ai_conversations")
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq("id", existingConvo.id);
    } else {
      await admin.from("ai_conversations").insert({
        user_id: profile.id,
        channel: "sms",
        messages: updatedMessages,
      });
    }

    // Send reply via SMS (Twilio TwiML response is limited, so we send directly)
    await sendSms(from, reply);
  } catch (error) {
    console.error("SMS AI error:", error);
    await sendSms(from, "Sorry, I had trouble processing that. Try again in a moment.");
  }

  // Return empty TwiML (we already sent the response directly)
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { "Content-Type": "text/xml" } }
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Twilio SMS bot — inbound webhook with AI-powered responses"
```

---

### Task 19: Alert Engine

**Files:**
- Create: `src/modules/finance/lib/alert-engine.ts`, `src/app/api/alerts/evaluate/route.ts`

- [ ] **Step 1: Create alert engine**

Create `src/modules/finance/lib/alert-engine.ts`:

```typescript
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { calculateBudgetSummary } from "./budget-engine";
import { sendSms } from "./sms-service";
import { formatCurrency } from "@/shared/lib/utils";
import { ALERT_LIMITS } from "@/shared/lib/constants";
import type { Category, Transaction, Account, AlertRule, Profile } from "@/modules/finance/types";

export async function evaluateAlerts(): Promise<void> {
  const admin = createAdminClient();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  // Fetch all needed data
  const [categoriesRes, transactionsRes, accountsRes, profilesRes, rulesRes, logRes] = await Promise.all([
    admin.from("categories").select("*").eq("is_active", true),
    admin.from("transactions").select("*").gte("date", monthStart).lte("date", monthEnd),
    admin.from("accounts").select("*"),
    admin.from("profiles").select("*"),
    admin.from("alert_rules").select("*").eq("is_active", true),
    admin.from("alert_log").select("user_id, alert_rule_id, sent_at").gte("sent_at", `${today}T00:00:00`),
  ]);

  const categories = (categoriesRes.data ?? []) as Category[];
  const transactions = (transactionsRes.data ?? []) as Transaction[];
  const accounts = (accountsRes.data ?? []) as Account[];
  const profiles = (profilesRes.data ?? []) as Profile[];
  const alertRules = (rulesRes.data ?? []) as AlertRule[];
  const todayLogs = logRes.data ?? [];

  const summary = calculateBudgetSummary(categories, transactions, accounts, now);

  for (const profile of profiles) {
    if (!profile.phone) continue;

    // Count today's alerts for this user
    const todayCount = todayLogs.filter((l) => l.user_id === profile.id).length;
    if (todayCount >= ALERT_LIMITS.MAX_PER_PERSON_PER_DAY) continue;

    // Check pace-based alerts for each category
    for (const catStatus of summary.categories) {
      // Check if already alerted for this category today
      const alreadyAlerted = todayLogs.some(
        (l) => l.user_id === profile.id && l.alert_rule_id === `pace-${catStatus.category.id}`
      );
      if (alreadyAlerted) continue;

      let message: string | null = null;

      if (catStatus.status === "red") {
        message = `🔴 Budget exceeded: ${catStatus.category.name} is at ${formatCurrency(catStatus.spent)} of ${formatCurrency(catStatus.budgeted)}. Consider pausing spending in this category for the rest of the month.`;
      } else if (catStatus.status === "orange") {
        const projected = Math.round(catStatus.projectedMonthEnd);
        message = `🟠 ${catStatus.category.name} is at ${formatCurrency(catStatus.spent)} of ${formatCurrency(catStatus.budgeted)} — but you're only ${summary.dayOfMonth} days in. At this rate you'll hit ${formatCurrency(projected)} by month end.`;
      }

      if (message) {
        await sendSms(profile.phone, message);
        await admin.from("alert_log").insert({
          alert_rule_id: `pace-${catStatus.category.id}`,
          user_id: profile.id,
          message_sent: message,
          channel: "sms",
        });
      }
    }

    // Check custom alert rules for this user
    const userRules = alertRules.filter((r) => r.user_id === profile.id);
    for (const rule of userRules) {
      const alreadyAlerted = todayLogs.some(
        (l) => l.user_id === profile.id && l.alert_rule_id === rule.id
      );
      if (alreadyAlerted) continue;

      // Evaluate rule (simplified — merchant and amount triggers)
      if (rule.trigger_type === "merchant") {
        const merchant = (rule.trigger_params as any).merchant_name;
        const recentMerchantTxns = transactions.filter(
          (t) => t.merchant_name?.toLowerCase().includes(merchant?.toLowerCase())
        );
        if (recentMerchantTxns.length > 0) {
          const latest = recentMerchantTxns[recentMerchantTxns.length - 1];
          const catSpent = summary.categories.find(
            (c) => c.category.id === latest.portal_category_id
          );
          const msg = `${latest.merchant_name}: ${formatCurrency(Math.abs(latest.amount))}. ${catSpent ? `${catSpent.category.name} budget: ${formatCurrency(catSpent.spent)} of ${formatCurrency(catSpent.budgeted)} used.` : ""}`;

          await sendSms(profile.phone, msg);
          await admin.from("alert_log").insert({
            alert_rule_id: rule.id,
            user_id: profile.id,
            message_sent: msg,
            channel: "sms",
          });
        }
      }
    }
  }
}
```

- [ ] **Step 2: Create alert evaluation endpoint**

Create `src/app/api/alerts/evaluate/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { evaluateAlerts } from "@/modules/finance/lib/alert-engine";

export async function POST() {
  try {
    await evaluateAlerts();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Alert evaluation error:", error);
    return NextResponse.json({ error: "Alert evaluation failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: alert engine with pace-based thresholds, batching, and custom rules"
```

---

## Phase 5: Settings, Cron Jobs & PWA

### Task 20: Settings Pages

**Files:**
- Create: `src/app/(portal)/settings/page.tsx`, `src/app/(portal)/settings/accounts/page.tsx`, `src/app/(portal)/settings/alerts/page.tsx`, `src/app/(portal)/settings/profile/page.tsx`, `src/modules/finance/components/alert-rule-list.tsx`, `src/modules/finance/components/alert-rule-form.tsx`

- [ ] **Step 1: Create settings overview page**

Create `src/app/(portal)/settings/page.tsx`:

```typescript
import Link from "next/link";
import { User, Bell, CreditCard } from "lucide-react";

const settingsItems = [
  { href: "/settings/profile", label: "Profile", description: "Name, phone, theme", icon: User },
  { href: "/settings/alerts", label: "Alerts", description: "Notification rules", icon: Bell },
  { href: "/settings/accounts", label: "Connected Accounts", description: "Manage Plaid connections", icon: CreditCard },
];

export default function SettingsPage() {
  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-text-primary mb-6">Settings</h2>
      <div className="space-y-2">
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 p-4 rounded-lg border border-border bg-bg-secondary hover:bg-bg-tertiary transition-colors"
          >
            <item.icon size={20} className="text-text-tertiary" />
            <div>
              <p className="text-sm font-medium text-text-primary">{item.label}</p>
              <p className="text-xs text-text-tertiary">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create connected accounts page**

Create `src/app/(portal)/settings/accounts/page.tsx`:

```typescript
import { createClient } from "@/shared/lib/supabase/server";
import { PlaidLinkButton } from "@/modules/finance/components/plaid-link-button";
import { formatCurrencyCents } from "@/shared/lib/utils";

export const dynamic = "force-dynamic";

export default async function AccountsSettingsPage() {
  const supabase = await createClient();

  const { data: plaidItems } = await supabase
    .from("plaid_items")
    .select("*, accounts:accounts(*)");

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text-primary">Connected Accounts</h2>
        <PlaidLinkButton />
      </div>

      {(plaidItems ?? []).length === 0 ? (
        <p className="text-sm text-text-tertiary">No accounts connected yet.</p>
      ) : (
        <div className="space-y-4">
          {(plaidItems ?? []).map((item: any) => (
            <div key={item.id} className="rounded-lg border border-border bg-bg-secondary p-4">
              <h3 className="text-sm font-medium text-text-primary mb-2">
                {item.institution_name}
              </h3>
              <div className="space-y-1">
                {(item.accounts ?? []).map((account: any) => (
                  <div key={account.id} className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">{account.name}</span>
                    <span className="tabular-nums text-text-primary">
                      {account.current_balance !== null
                        ? formatCurrencyCents(account.current_balance)
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create alert management page**

Create `src/app/(portal)/settings/alerts/page.tsx`:

```typescript
import { createClient } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AlertsSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: alertRules } = await supabase
    .from("alert_rules")
    .select("*")
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-text-primary mb-2">Alert Rules</h2>
      <p className="text-sm text-text-tertiary mb-6">
        Pace-based budget alerts are active by default. Add custom rules below.
      </p>

      {(alertRules ?? []).length === 0 ? (
        <p className="text-sm text-text-tertiary">No custom alert rules yet. Default pace-based alerts are active.</p>
      ) : (
        <div className="space-y-2">
          {(alertRules ?? []).map((rule: any) => (
            <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-bg-secondary">
              <div>
                <p className="text-sm text-text-primary">
                  {rule.trigger_type}: {JSON.stringify(rule.trigger_params)}
                </p>
              </div>
              <span className={`text-xs ${rule.is_active ? "text-status-green" : "text-text-tertiary"}`}>
                {rule.is_active ? "Active" : "Paused"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create profile settings page**

Create `src/app/(portal)/settings/profile/page.tsx`:

```typescript
import { createClient } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-text-primary mb-6">Profile</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Name</label>
          <p className="text-sm text-text-primary">{profile?.name}</p>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Email</label>
          <p className="text-sm text-text-primary">{profile?.email}</p>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Phone</label>
          <p className="text-sm text-text-primary">{profile?.phone ?? "Not set"}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: settings pages — profile, connected accounts, alert rules"
```

---

### Task 21: Cron Jobs

**Files:**
- Create: `src/app/api/cron/sync-transactions/route.ts`, `src/app/api/cron/weekly-digest/route.ts`, `vercel.json`

- [ ] **Step 1: Create transaction sync cron**

Create `src/app/api/cron/sync-transactions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: plaidItems } = await admin.from("plaid_items").select("id");

  for (const item of plaidItems ?? []) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaid_item_id: item.id }),
      });
    } catch (error) {
      console.error(`Sync failed for ${item.id}:`, error);
    }
  }

  return NextResponse.json({ success: true, items_synced: plaidItems?.length ?? 0 });
}
```

- [ ] **Step 2: Create weekly digest cron**

Create `src/app/api/cron/weekly-digest/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { chat } from "@/modules/finance/lib/ai-service";
import { sendSms } from "@/modules/finance/lib/sms-service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profiles } = await admin.from("profiles").select("id, phone");

  for (const profile of profiles ?? []) {
    if (!profile.phone) continue;

    try {
      const digest = await chat(
        profile.id,
        "Generate the weekly financial digest. Lead with wins, then areas to watch. Include daily spending allowance for remaining days. Keep it concise — this is an SMS.",
        []
      );

      await sendSms(profile.phone, digest);
    } catch (error) {
      console.error(`Digest failed for ${profile.id}:`, error);
    }
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create Vercel cron config**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-transactions",
      "schedule": "0 */4 * * *"
    },
    {
      "path": "/api/cron/weekly-digest",
      "schedule": "0 14 * * 6"
    }
  ]
}
```

Add `CRON_SECRET` to `.env.local.example`:

```
CRON_SECRET=your-cron-secret
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Vercel cron jobs — transaction sync (4h) and weekly digest (Saturday)"
```

---

### Task 22: PWA Setup

**Files:**
- Create: `src/app/manifest.ts`, `public/icons/` (placeholder), update `src/app/layout.tsx`

- [ ] **Step 1: Create PWA manifest**

Create `src/app/manifest.ts`:

```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smolowe Portal",
    short_name: "Portal",
    description: "Smolowe Household Portal",
    start_url: "/finance",
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

- [ ] **Step 2: Create placeholder icons**

```bash
mkdir -p public/icons
```

Generate simple placeholder icons (192x192 and 512x512 PNGs). These can be replaced with proper branding later. For now, create simple colored squares.

- [ ] **Step 3: Update root layout metadata for PWA**

Add to `src/app/layout.tsx` metadata:

```typescript
export const metadata: Metadata = {
  title: "Smolowe Portal",
  description: "Household management portal",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Portal",
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: PWA manifest and iOS Add to Home Screen support"
```

---

### Task 23: Final Wiring & Deployment Prep

**Files:**
- Modify: various files for final integration

- [ ] **Step 1: Create .env.local with real values**

Copy `.env.local.example` to `.env.local` and fill in real credentials:
- Supabase URL + keys (from your Supabase project)
- Plaid keys (sign up at dashboard.plaid.com — sandbox is free)
- Gemini API key (Alex already has one)
- Twilio credentials (sign up at twilio.com)
- CRON_SECRET (generate a random string)
- NEXT_PUBLIC_APP_URL (http://localhost:3000 for dev, your Vercel URL for prod)

- [ ] **Step 2: Create two user accounts in Supabase**

Via the Supabase dashboard Auth section, create:
- Alex Smolowe's account (with email + password)
- Emine Smolowe's account (with email + password)

Then update the `profiles` table to add phone numbers for SMS.

- [ ] **Step 3: Verify the app runs locally**

```bash
npm run dev
```

- Open http://localhost:3000 — should redirect to /login
- Sign in with one of the accounts
- Should see finance dashboard (empty state with "Connect Account" button)
- Click Connect Account → Plaid Link should open (sandbox mode)
- Connect a sandbox account → transactions should populate
- Check theme toggle, sidebar nav, sub-nav

- [ ] **Step 4: Deploy to Vercel**

```bash
npx vercel
```

Follow prompts. Set all environment variables in Vercel dashboard. Make sure NEXT_PUBLIC_APP_URL points to your Vercel deployment URL.

- [ ] **Step 5: Configure Plaid webhook URL**

In Plaid dashboard, set the webhook URL to `https://your-app.vercel.app/api/plaid/webhook`.

- [ ] **Step 6: Configure Twilio webhook URL**

In Twilio console, set the SMS webhook for your phone number to `https://your-app.vercel.app/api/twilio/webhook` (POST).

- [ ] **Step 7: Final commit and push**

```bash
git add -A
git commit -m "feat: deployment configuration and environment setup"
git push origin main
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Modular monolith architecture
- ✅ Plaid integration (link, sync, webhook, fallback cron)
- ✅ Budget system (categories, rules, pace-adjusted alerts)
- ✅ Income & savings tracking (transaction classifier)
- ✅ Fixed vs. discretionary categories
- ✅ AI advisor (Gemini with function calling, factual queries via DB)
- ✅ Financial profile (living document in DB)
- ✅ SMS bot (Twilio inbound/outbound)
- ✅ Alert engine (pace-based, batching, custom rules)
- ✅ Dashboard (hero metric, category list, recent transactions, AI insight)
- ✅ Transactions page (search, filter)
- ✅ Trends page (charts)
- ✅ AI chat panel (floating, accessible from any view)
- ✅ Settings (profile, accounts, alerts)
- ✅ Dark-first design system
- ✅ PWA manifest
- ✅ Weekly digest cron
- ✅ Auth (Supabase, middleware, RLS)

**Deferred to post-v1 iteration:**
- Supabase Vault for Plaid access tokens (using a temporary storage approach)
- Offline PWA with service worker caching (manifest only in v1)
- Profile settings editing (currently read-only display)
- Alert rule creation form UI (page exists, form is basic)
- Temporary projects UI (AI creates them, no dedicated management page yet)
- Anomaly detection runs (alert engine checks pace, but anomaly detection via AI is conversational)
