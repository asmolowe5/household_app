# Camera Module v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a live webcam viewer at `/cameras` reachable from the dashboard, with placeholder tiles for future cameras.

**Architecture:** A new App Router page at `src/app/(portal)/cameras/page.tsx` (inside the existing auth-gated route group) renders a `<CameraGrid />` from a new `src/modules/cameras/` module. The grid composes one webcam tile (using `navigator.mediaDevices.getUserMedia`) and three static placeholders. The dashboard's "Cameras" `<ModuleCard>` is refactored to accept an optional `href` so it links to `/cameras`. The module registry flips the cameras entry from `coming-soon` to `active`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, Lucide icons, `navigator.mediaDevices.getUserMedia` (browser MediaStream API).

**Reference:** [Design spec](../specs/2026-05-13-camera-module-design.md)

**Testing approach:** Per the spec, v1 uses manual verification only — no automated tests for camera streams. Each task verifies via `npm run lint` (fast type/lint check); the final task verifies via `npm run build` and a manual browser smoke test of the spec's verification checklist.

---

## File Structure

**New files:**

- `src/modules/cameras/types/index.ts` — `CameraStreamState` union type for the tile's state machine.
- `src/modules/cameras/components/add-camera-placeholder.tsx` — Static placeholder tile (dashed border, plus icon, "Add camera" label).
- `src/modules/cameras/components/camera-tile.tsx` — Client component. Handles `getUserMedia`, stream lifecycle, permission/error states, retry button.
- `src/modules/cameras/components/camera-grid.tsx` — Server component. Renders back link, page heading, and the 4-tile grid (1 webcam + 3 placeholders).
- `src/app/(portal)/cameras/page.tsx` — Thin route file that renders `<CameraGrid />`. Inherits auth from the `(portal)` layout.

**Modified files:**

- `src/modules/registry.ts` — Flip cameras status to `"active"`, refine description.
- `src/app/(portal)/dashboard/page.tsx` — Add optional `href` prop to `ModuleCard`; pass `href="/cameras"` for Cameras tile; update description text.

---

## Task 1: Module types and placeholder tile

**Files:**

- Create: `src/modules/cameras/types/index.ts`
- Create: `src/modules/cameras/components/add-camera-placeholder.tsx`

- [ ] **Step 1: Create the types file**

Write `src/modules/cameras/types/index.ts`:

```ts
export type CameraStreamState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "granted"; stream: MediaStream }
  | { status: "denied" }
  | { status: "not-found" }
  | { status: "error"; message: string };
```

- [ ] **Step 2: Create the placeholder tile**

Write `src/modules/cameras/components/add-camera-placeholder.tsx`:

```tsx
import { Plus } from "lucide-react";

export function AddCameraPlaceholder() {
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-subtle bg-bg-secondary opacity-50">
      <Plus size={24} className="text-text-tertiary" />
      <p className="text-xs font-medium text-text-tertiary">Add camera</p>
    </div>
  );
}
```

- [ ] **Step 3: Verify with lint**

Run: `npm run lint`
Expected: passes (no errors, no warnings for these new files).

- [ ] **Step 4: Commit**

```sh
git add src/modules/cameras/types/index.ts src/modules/cameras/components/add-camera-placeholder.tsx
git commit -m "Add camera module types and placeholder tile"
```

---

## Task 2: Camera tile with stream lifecycle

**Files:**

- Create: `src/modules/cameras/components/camera-tile.tsx`

This task implements the only piece with real runtime behavior. The component runs a single `useEffect` keyed on a `retryCount` state. The effect requests `getUserMedia`, updates state with the result, and cleans up on unmount (or before re-running) by stopping all stream tracks. A "Try again" button bumps `retryCount`, which triggers the effect to re-run.

- [ ] **Step 1: Create the camera tile component**

Write `src/modules/cameras/components/camera-tile.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Video, VideoOff, AlertCircle } from "lucide-react";
import type { CameraStreamState } from "../types";

interface CameraTileProps {
  label: string;
}

export function CameraTile({ label }: CameraTileProps) {
  const [state, setState] = useState<CameraStreamState>({ status: "idle" });
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "requesting" });

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setState({ status: "granted", stream });
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError") {
          setState({ status: "denied" });
        } else if (name === "NotFoundError") {
          setState({ status: "not-found" });
        } else {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [retryCount]);

  useEffect(() => {
    if (state.status === "granted" && videoRef.current) {
      videoRef.current.srcObject = state.stream;
    }
  }, [state]);

  const handleRetry = () => setRetryCount((c) => c + 1);

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-border-default bg-bg-secondary">
      {state.status === "granted" ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
          {state.status === "requesting" && (
            <>
              <Video size={20} className="text-text-tertiary" />
              <p className="text-xs text-text-tertiary">
                Requesting camera access&hellip;
              </p>
            </>
          )}
          {state.status === "denied" && (
            <>
              <VideoOff size={20} className="text-status-red" />
              <p className="text-xs text-text-secondary">Camera access denied</p>
              <button
                onClick={handleRetry}
                className="rounded-md border border-border-default px-3 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-bg-tertiary"
              >
                Try again
              </button>
            </>
          )}
          {state.status === "not-found" && (
            <>
              <VideoOff size={20} className="text-text-tertiary" />
              <p className="text-xs text-text-secondary">No camera found</p>
            </>
          )}
          {state.status === "error" && (
            <>
              <AlertCircle size={20} className="text-status-red" />
              <p className="text-xs text-text-secondary">{state.message}</p>
              <button
                onClick={handleRetry}
                className="rounded-md border border-border-default px-3 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-bg-tertiary"
              >
                Try again
              </button>
            </>
          )}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
        <p className="text-xs font-medium text-white">{label}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify with lint**

Run: `npm run lint`
Expected: passes.

- [ ] **Step 3: Commit**

```sh
git add src/modules/cameras/components/camera-tile.tsx
git commit -m "Add webcam tile with getUserMedia lifecycle"
```

---

## Task 3: Camera grid and route page

**Files:**

- Create: `src/modules/cameras/components/camera-grid.tsx`
- Create: `src/app/(portal)/cameras/page.tsx`

The grid is a server component (no client state of its own). It composes one `<CameraTile>` with three `<AddCameraPlaceholder>` tiles in a responsive grid, and renders the back link plus page heading.

- [ ] **Step 1: Create the camera grid component**

Write `src/modules/cameras/components/camera-grid.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CameraTile } from "./camera-tile";
import { AddCameraPlaceholder } from "./add-camera-placeholder";

export function CameraGrid() {
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={14} />
        Dashboard
      </Link>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cameras</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Live feeds from connected cameras.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CameraTile label="Webcam" />
        <AddCameraPlaceholder />
        <AddCameraPlaceholder />
        <AddCameraPlaceholder />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the cameras page**

Write `src/app/(portal)/cameras/page.tsx`:

```tsx
import { CameraGrid } from "@/modules/cameras/components/camera-grid";

export default function CamerasPage() {
  return <CameraGrid />;
}
```

- [ ] **Step 3: Verify with lint**

Run: `npm run lint`
Expected: passes.

- [ ] **Step 4: Commit**

```sh
git add src/modules/cameras/components/camera-grid.tsx src/app/\(portal\)/cameras/page.tsx
git commit -m "Add /cameras route and camera grid"
```

---

## Task 4: Wire dashboard entry and flip registry

**Files:**

- Modify: `src/app/(portal)/dashboard/page.tsx`
- Modify: `src/modules/registry.ts`

The dashboard's `ModuleCard` currently always renders a `<div>`. Refactor it to accept an optional `href`: when present, render a `<Link>` with hover state; when absent, render the existing static `<div>`. Then pass `href="/cameras"` for the Cameras card and update its description. The Finances and Home cards stay non-interactive (no `href`).

- [ ] **Step 1: Modify the dashboard page**

Open `src/app/(portal)/dashboard/page.tsx`.

Add an import at the top:

```tsx
import Link from "next/link";
```

Replace the existing `ModuleCard` function with:

```tsx
function ModuleCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-text-tertiary">
        {description}
      </p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-md border border-border-subtle bg-bg-primary p-4 transition-colors hover:bg-bg-secondary"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-md border border-border-subtle bg-bg-primary p-4">
      {content}
    </div>
  );
}
```

Replace the Cameras `ModuleCard` usage in `DashboardPage`. Find:

```tsx
<ModuleCard title="Cameras" description="NAS-hosted camera feeds." />
```

Replace with:

```tsx
<ModuleCard
  title="Cameras"
  description="Live webcam viewer."
  href="/cameras"
/>
```

The Finances and Home cards remain unchanged (no `href`).

- [ ] **Step 2: Flip the cameras module in the registry**

Open `src/modules/registry.ts`.

Find the cameras module entry:

```ts
{
  id: "cameras",
  name: "Cameras",
  icon: Camera,
  basePath: "/cameras",
  status: "coming-soon",
  description: "Security camera feeds and recordings",
},
```

Replace with:

```ts
{
  id: "cameras",
  name: "Cameras",
  icon: Camera,
  basePath: "/cameras",
  status: "active",
  description: "Live webcam viewer",
},
```

- [ ] **Step 3: Verify with lint**

Run: `npm run lint`
Expected: passes.

- [ ] **Step 4: Commit**

```sh
git add src/app/\(portal\)/dashboard/page.tsx src/modules/registry.ts
git commit -m "Wire dashboard Cameras card to /cameras and activate module"
```

---

## Task 5: Final verification

No new code in this task. Run the full build and walk through the spec's verification checklist in a browser.

- [ ] **Step 1: Run lint and build**

Run: `npm run lint`
Expected: passes.

Run: `npm run build`
Expected: build completes successfully. No new errors or warnings related to the camera module.

- [ ] **Step 2: Start dev server**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000`.

- [ ] **Step 3: Manual smoke test**

In a browser, open `http://localhost:3000`. Sign in with a valid 8-digit PIN. Verify each of these from the spec:

- Dashboard "Cameras" tile shows a hover state and is clickable.
- Clicking it navigates to `/cameras`.
- Browser prompts for camera permission on first visit.
- After granting, tile 1 shows the live webcam stream within ~1 second.
- Tiles 2–4 show muted "Add camera" placeholders.
- The "← Dashboard" link returns to `/dashboard` and the browser's camera-indicator light turns **off**.
- Signing out from `/cameras` also turns the camera-indicator light **off**.
- Browser console has no new errors from the camera page.
- Resize the browser to phone width (≤ 640 px): grid is 1 column.
- Resize to tablet width (640–1024 px): grid is 2 columns.
- Resize to desktop width (≥ 1024 px): grid is 3 columns.
- In the browser settings, revoke camera permission for `localhost:3000`, then reload `/cameras`: tile 1 shows "Camera access denied" with a "Try again" button.
- Click "Try again": the browser re-prompts for permission.

- [ ] **Step 4: If everything passes, no additional commit needed**

The plan is complete. The implementation is on branch `claude/friendly-bartik-643ff9` and can be merged to `main` when ready.

If the manual smoke test surfaces issues, address them as additional small commits before merging.

---

## Self-review

**Spec coverage check:**

- v1 user flow (sign in → dashboard → cameras → grid → back) → Tasks 1–4 collectively.
- `getUserMedia` + lifecycle cleanup → Task 2.
- Permission states (requesting / granted / denied / not-found / error) with retry → Task 2.
- Multi-camera grid with webcam as tile 1 + 3 placeholders → Tasks 1 and 3.
- Module code at `src/modules/cameras/` mirroring finance structure → Tasks 1–3.
- Route at `(portal)/cameras/page.tsx` under existing auth gate → Task 3.
- Dashboard "Cameras" `ModuleCard` becomes clickable → Task 4.
- Module registry flips to `active` with refined description → Task 4.
- Responsive grid (1/2/3 columns at phone/tablet/desktop) → Task 3 (grid classes) and Task 5 (verification).
- Manual testing checklist → Task 5.

No gaps.

**Placeholder scan:** No TBDs, no "implement later", no "add appropriate error handling" — every error branch has explicit code.

**Type consistency:** `CameraStreamState` defined in Task 1 is the only shared type, used in Task 2. Method/prop names (`CameraTile`'s `label` prop, `ModuleCard`'s `href` prop, `streamRef`, `videoRef`, `retryCount`, `cancelled`) are consistent within and across tasks.
