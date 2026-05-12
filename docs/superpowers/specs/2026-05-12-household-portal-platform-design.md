# Smolowe Household Portal — Platform Redesign

**Date:** 2026-05-12
**Status:** Approved

## Problem

The portal started as a finance-only app deployed on Vercel. It needs to become a modular home management platform — the "brain of the home" — self-hosted on a Synology NAS. The current architecture (single-purpose Next.js app, cloud-hosted Supabase, Vercel deployment) doesn't support multiple modules, local hosting, or data sharing between modules.

## Goals

1. Restructure the app as a modular platform where new modules can be added without touching existing ones
2. Move entirely to self-hosted infrastructure on a Synology NAS (no cloud dependencies)
3. Build a responsive UI that works as a polished desktop app and a native-feeling PWA on iPhones
4. Establish a module data-sharing pattern so modules can consume each other's data without rewriting APIs
5. Keep the finance module fully functional throughout — no regressions

## Users

Alex and Emine Smolowe. Two equal-access users. System should support adding more users in the future without architectural changes.

## Non-Goals

- Camera module implementation (hardware not yet purchased — documented here for future reference only)
- Smart home device integration
- Investment property LLC module
- Native iOS app (PWA is sufficient)

---

## Architecture: Monolith + Sidecar Services

### Overview

One Next.js application handles all UI, module logic, and API routes. Specialized tools (Frigate for cameras, future heavy-processing services) run as separate Docker containers alongside it. All containers are orchestrated via Docker Compose on the Synology NAS.

### Why This Approach

- **vs. Modular Monolith (everything in one container):** Breaks down when heavy workloads like video processing enter the picture. The web app shouldn't be competing for CPU with camera recording.
- **vs. Microservices (everything in separate containers):** Massively over-engineered for a household app. Requires service discovery, inter-service auth, coordinated deployments. Thousands-of-engineers architecture for a two-person home.
- **Monolith + Sidecars** keeps one codebase for everything Claude builds, while letting purpose-built tools (Frigate, etc.) run independently. Matches how the home-server community actually deploys these setups.

### Container Layout

```
docker-compose.yml
├── app (Next.js — all UI, module logic, API routes)
├── db (PostgreSQL — self-hosted Supabase)
├── supabase-auth (Supabase Auth service)
├── supabase-rest (PostgREST — Supabase API layer)
├── supabase-storage (Supabase Storage — file uploads)
├── frigate (camera recording/detection — future, when cameras are purchased)
└── cloudflared (Cloudflare Tunnel for remote access)
```

All containers communicate over a shared Docker network. The app talks to Supabase via `http://db:5432` and to Frigate via `http://frigate:5000` — internal addresses only, nothing exposed to the internet.

---

## Module System

### Structure

Each module lives under `src/modules/<name>/` with a consistent internal structure:

```
src/modules/
├── finance/
│   ├── components/      # UI components
│   ├── lib/             # Business logic, services
│   ├── types.ts         # TypeScript interfaces
│   └── queries.ts       # Database query helpers
├── cameras/             # Future
│   ├── components/
│   ├── lib/
│   ├── types.ts
│   └── queries.ts
└── registry.ts          # Central module registry
```

Pages for each module live under `src/app/(portal)/<module-name>/`.

API routes live under `src/app/api/<module-name>/`.

### Module Registry

A central registry (`src/modules/registry.ts`) defines all modules:

```ts
type ModuleDefinition = {
  id: string
  name: string
  icon: LucideIcon
  basePath: string
  status: 'active' | 'coming-soon'
  description: string
}
```

The sidebar, mobile tab bar, and any dashboard overview read from this registry. Adding a new module means adding an entry here, creating its folder under `src/modules/`, and adding its page routes.

### Data Sharing Between Modules

Each module exposes a `services.ts` file with functions other modules can import:

```
src/modules/finance/lib/services.ts
  → getBudgetSummary()
  → getRecentTransactions(limit)
  → getCategorySpending(month)

src/modules/cameras/lib/services.ts  (future)
  → getCameras()
  → getFeed(cameraId)
  → getMotionEvents(cameraId, timeRange)
  → getSnapshot(cameraId)
```

A future Garden Cam module would import `getSnapshot` from the camera services — no API rewrite needed. Modules can depend on each other's services, but never reach into each other's internal components or database queries directly.

### Database Convention

All modules share one PostgreSQL database. Tables are not prefixed by module name (existing finance tables like `transactions`, `categories`, `accounts` stay as-is). Each module's `queries.ts` is the only file that touches its own tables. Cross-module data access goes through services, not direct table queries.

---

## UI/UX Design System

### Design Principles

- **Linear/Vercel quality** — clean, modern, professional. No DIY home-server aesthetics
- **Dark mode as default** — premium feel, especially important when camera feeds are added
- **One design system, two layout modes** — same tokens and components, different shells for desktop and mobile
- **Restrained module differentiation** — same accent color (indigo) everywhere. Modules differ through content density and layout, not color schemes

### What Stays (Already Solid)

- Design tokens in `globals.css` — semantic color naming, 8px grid, tinted shadows
- Geist Sans typography with `tabular-nums` for financial figures
- Dual-theme (dark/light) token architecture
- Indigo accent color (`#6366F1` / `#818CF8`)

### Desktop Layout

```
┌─────────────────────────────────────────────────┐
│ Sidebar (220px)  │  Header (page title + user)  │
│                  │──────────────────────────────│
│ • Finance        │                              │
│ • Cameras        │     Module Content Area      │
│ • Settings       │                              │
│                  │                              │
│                  │                              │
│ [collapsed: 64px │                              │
│  icons only at   │                              │
│  <900px width]   │                              │
└─────────────────────────────────────────────────┘
```

- **Sidebar:** Fixed left, module navigation with icons and labels. Collapses to 64px icon-only at smaller desktop widths (~900px breakpoint). Module registry drives the nav items.
- **Header:** Page title on left, user identity / theme toggle on right. No empty space — the header earns its 56px.
- **Content area:** Filled by the active module's `ModuleShell` wrapper.

### Mobile Layout

```
┌──────────────────────┐
│   Header (compact)   │
│──────────────────────│
│                      │
│   Module Content     │
│   (full width)       │
│                      │
│                      │
│──────────────────────│
│ Finance │ Cameras │⚙ │
│  (tab)  │  (tab)  │  │
└──────────────────────┘
```

- **Bottom tab bar:** 4-5 slots for active modules. Faster than a launcher grid for 2-3 modules. Revisit the launcher concept when 6+ modules exist.
- **No sidebar on mobile** — the current 220px fixed sidebar breaks on phones. Replaced entirely by the bottom tab bar.
- **Header:** Compact, page title only.

### ModuleShell Component

Every module page wraps in a shared `ModuleShell` component:

```tsx
<ModuleShell
  title="Finance"
  actions={<SyncButton />}  // optional top-right actions
>
  {/* module content */}
</ModuleShell>
```

This keeps every module feeling like one product — consistent page title placement, consistent action button position, consistent content area behavior.

### Module Content Vocabulary

Modules feel different through their content, not their chrome:

- **Finance:** Data-dense tables, metric cards, charts. Lots of numbers in `tabular-nums`.
- **Cameras (future):** Full-bleed dark surfaces, minimal chrome. The feed IS the content.
- **Settings:** Form-based, spacious, straightforward.

Same tokens, same elevation system (`bg-primary` → `bg-secondary` → `bg-elevated`), different application.

---

## Infrastructure

### Docker Compose on Synology NAS

All services defined in one `docker-compose.yml`. The Synology runs Docker natively (via Container Manager / Docker package).

Key containers for Phase 1-2:
- `app` — Next.js application (port 3000 internally)
- `postgres` — PostgreSQL 15 database
- `supabase-auth` — GoTrue auth service (handles login, sessions, JWTs)
- `supabase-rest` — PostgREST (provides the Supabase client API on top of Postgres)
- `cloudflared` — Cloudflare Tunnel daemon

### Remote Access: Cloudflare Tunnel

- A free Cloudflare Tunnel connects the NAS to a domain (e.g., `home.smolowe.com`)
- Traffic is encrypted end-to-end, no ports opened on the router
- Cloudflare handles SSL certificates automatically
- The tunnel routes to the Next.js container on the internal Docker network

### Data Backup: Dropbox

- Automated PostgreSQL backups via `pg_dump` on a daily cron schedule
- Backup files written to a NAS folder synced to Dropbox via Synology Cloud Sync
- Retention: keep 30 days of daily backups locally, Dropbox retains indefinitely
- Camera recordings (future) backed up separately with configurable retention

### Environment Variables

Secrets stored in a `.env` file on the NAS (not committed to git):
- Database credentials
- Supabase service role key
- Plaid API keys
- Gemini API key
- Twilio credentials
- Cloudflare tunnel token

---

## Camera Module (Future Reference)

> **Not part of the immediate implementation.** Documented here so the architecture accounts for it.

### Hardware

- **Indoor:** PoE cameras (Reolink, Amcrest, or Dahua) connected via existing ethernet ports with PoE switches
- **Outdoor:** Battery/solar cameras (Reolink Argus-style) providing motion-triggered clips

### Software

- **Frigate** runs as a sidecar Docker container, handles indoor PoE camera recording, motion detection, and object recognition
- **Battery cameras** integrate through their local API or ONVIF protocol, separate from Frigate
- **Unified camera module** in the app presents all cameras in one interface regardless of backend

### Services Exposed

```
getCameras() → list all cameras with status
getFeed(cameraId) → live stream URL
getMotionEvents(cameraId, timeRange) → motion event list
getSnapshot(cameraId) → current still frame
getRecording(cameraId, timeRange) → recorded footage
```

### Storage

Recordings stored on NAS. Configurable retention (e.g., 30 days continuous, 90 days motion events).

---

## Migration Phases

### Phase 1: Platform Foundation (Immediate)

Restructure the existing app into the modular platform. No infrastructure changes yet — still runs on Vercel during this phase.

- Create module registry system
- Refactor `src/modules/finance/` to follow the new module conventions
- Build responsive layout shell:
  - Sidebar with collapsed state
  - Promoted header (page title + user context)
  - Mobile bottom tab bar
  - `ModuleShell` component
- Add responsive breakpoints (mobile: bottom tabs, desktop: sidebar, compact desktop: collapsed sidebar)
- Verify finance module works identically after restructuring

### Phase 2: Self-Hosting (After Phase 1 is verified)

Move everything off the cloud onto the Synology NAS.

- Create `docker-compose.yml` with app, PostgreSQL, Supabase services, and Cloudflare tunnel
- Migrate database from cloud Supabase to local PostgreSQL
- Set up Cloudflare Tunnel for remote access
- Configure Dropbox backup via Synology Cloud Sync
- Set up PWA with the new domain
- Verify everything works remotely on phones
- Decommission Vercel deployment

### Phase 3: Camera Module (When hardware is purchased)

- Set up Frigate container in Docker Compose
- Build camera module UI (live feeds, recordings, motion timeline)
- Integrate indoor PoE cameras through Frigate
- Integrate outdoor battery cameras through their local APIs
- Expose camera services for cross-module use

### Phase 4: Cross-Module Features (Future)

- Garden Cam timelapse (consumes camera module services)
- Additional modules as needed
- Launcher grid UI when module count warrants it

---

## Key Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Monolith + Sidecars | One codebase for app logic, separate containers for heavy tools |
| Hosting | Synology NAS + Docker | Local, private, no cloud costs, leverages existing hardware |
| Database | Self-hosted PostgreSQL | All data stays local, backed up to Dropbox |
| Remote access | Cloudflare Tunnel | Free, secure, real domain, no port forwarding |
| Mobile | PWA + bottom tab bar | Native-feeling without App Store, fast module switching |
| Desktop nav | Left sidebar | Persistent wayfinding for nested module views |
| Module identity | Same accent, different content | Restrained — no per-module color themes |
| Camera system | Frigate + battery hybrid | PoE for indoor (24/7), battery for outdoor (motion-triggered) |
| Backup | Dropbox via Synology Cloud Sync | Automated, off-site, leverages existing Dropbox account |
| Default theme | Dark mode | Premium feel, camera-friendly, matches Linear aesthetic |
