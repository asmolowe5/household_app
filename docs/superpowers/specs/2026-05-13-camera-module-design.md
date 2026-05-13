# Camera Module — Live Webcam Viewer (v1)

**Date:** 2026-05-13
**Status:** Design approved, ready for implementation plan

## Background and scope

The portal's module registry already includes a "Cameras" module with `status: "coming-soon"`. The dashboard renders a static "Cameras" tile that is not yet a navigable link, and no `/cameras` route exists.

This spec covers **v1 of the camera module**: a live webcam viewer reachable from the dashboard, with placeholder tiles indicating future cameras. It is intentionally minimal — a foundation that will be extended later, not the full security system the household needs long-term.

## Non-goals (deferred to a future NVR spec)

- No recording, no snapshots, no clip export, no fullscreen mode.
- No real IP camera integration in v1.
- No motion detection, no schedules, no arm/disarm.
- No 48-hour rolling buffer, no NAS-side recording pipeline.
- No multi-user permission model — any signed-in portal user can view.

These all require server-side video infrastructure (likely Frigate or Synology Surveillance Station running on the NAS, with the portal acting as the UI) and will be designed in a separate spec.

## User flow

1. User signs in, lands on `/dashboard`.
2. Dashboard shows a "Cameras" tile. User clicks it.
3. Browser navigates to `/cameras`.
4. Browser prompts for camera permission (first visit only).
5. After approval, the webcam stream renders in tile 1 of a responsive grid.
6. Tiles 2–4 show static "Add camera" placeholders (visually muted, no action).
7. User clicks "← Dashboard" link at the top of the page to return to `/dashboard`.
8. On navigation away, the webcam stream is released and the browser's camera-indicator light turns off.

## Architecture

### Route

A new App Router page at `src/app/(portal)/cameras/page.tsx`. It sits inside the `(portal)` route group, so the existing server-side auth guard in `src/app/(portal)/layout.tsx` already applies — no separate gating.

The page itself is a thin server component that renders a client component (`<CameraGrid />`), because all camera-stream code requires the browser.

### Module code layout

Mirrors the finance module's structure:

```
src/modules/cameras/
  components/
    camera-grid.tsx              — client; renders tile grid + back link
    camera-tile.tsx              — client; one webcam tile (stream lifecycle)
    add-camera-placeholder.tsx   — client; static "Add camera" tile
  types/
    index.ts                     — shared camera types
```

### Module registry

In `src/modules/registry.ts`, the cameras entry flips from `status: "coming-soon"` to `status: "active"`. Description updates to reflect "live webcam viewer" rather than "Security camera feeds and recordings" (the latter is misleading for v1). No other registry fields change.

### Dashboard entry point

In `src/app/(portal)/dashboard/page.tsx`, the static "Cameras" `<ModuleCard>` becomes a `<Link href="/cameras">`. The card gains an interactive hover state (cursor pointer, subtle background lightening).

The other two dashboard `<ModuleCard>` entries ("Finances", "Home") remain non-interactive in v1 — their routes are not yet ready per `docs/current-state.md`.

### Cameras page layout

- Top of page: `← Dashboard` link (uses `next/link`).
- Page heading: "Cameras".
- Grid container: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.
- Four tiles total: tile 1 is the live webcam, tiles 2–4 are "Add camera" placeholders.

### Camera tile (webcam)

A 16:9 rounded card containing a `<video>` element with the live stream.

**Stream lifecycle:**

1. On mount, call `navigator.mediaDevices.getUserMedia({ video: true, audio: false })`.
2. Store the returned `MediaStream` in a ref.
3. Assign the stream to `videoRef.current.srcObject`.
4. On unmount, call `stream.getTracks().forEach(t => t.stop())` to release the camera so the browser's camera-indicator light turns off and the device is freed for other apps.

**Permission / error states:**

| State | UI |
|---|---|
| Requesting | "Requesting camera access…" placeholder |
| Granted | Live `<video>` plays the stream |
| Denied (`NotAllowedError`) | "Camera access denied" with a "Try again" button that retries `getUserMedia` |
| No camera (`NotFoundError`) | "No camera found" — no retry button (won't help without hardware) |
| Other (`NotReadableError`, etc.) | Show error name + "Try again" button |

The `<video>` element uses `autoPlay`, `muted`, and `playsInline` attributes. `playsInline` is required for iOS Safari to play inline rather than forcing fullscreen.

Tile footer shows the camera label ("Webcam") as a thin overlay at the bottom of the tile.

### Add-camera placeholder

A 16:9 tile with a dashed border, a centered `Plus` icon, and "Add camera" text. Visually muted (`opacity-50` or similar). Click does nothing in v1 — it's a layout placeholder so the grid feels intentional rather than empty.

## Error handling

- All `getUserMedia` rejections are caught and mapped to one of the states in the table above based on `error.name`.
- The tile tracks mount state via a `mounted` ref or `AbortController` so it does not call `setState` after unmount if the user navigates away while the permission prompt is still open.
- No telemetry, no logging beyond `console.error` for unexpected error types.

## Security context

- `getUserMedia` requires a secure context. Production runs through Cloudflare Tunnel (HTTPS) and `localhost` is treated as secure by browsers, so both environments work without extra configuration.
- The webcam stream is local to the browser only — nothing leaves the device. No network exposure of the feed, no server-side recording. This matches the v1 scope.

## Testing strategy

Manual testing is sufficient for v1. No automated tests for camera streams — the test-harness cost is not justified for a single-component prototype that will be replaced when real cameras land.

Verification checklist:

- Webcam stream appears in tile 1 within ~1 second of granting permission.
- Browser's camera-indicator light turns **off** when navigating to `/dashboard`.
- Camera-indicator light turns **off** when signing out from the cameras page.
- "← Dashboard" link returns to `/dashboard` without errors in the console.
- Dashboard "Cameras" tile navigates to `/cameras` on click.
- Permission-denied state shows the right message; "Try again" button works after revoking and re-granting in browser settings.
- "No camera found" state can be triggered by disabling the webcam in OS settings.
- Grid layout: 1 column on phone (< 640 px), 2 columns on tablet (640–1024 px), 3 columns on desktop (≥ 1024 px).
- `npm run lint` passes.
- `npm run build` passes.

## Files to add or modify

**Added:**

- `src/app/(portal)/cameras/page.tsx`
- `src/modules/cameras/components/camera-grid.tsx`
- `src/modules/cameras/components/camera-tile.tsx`
- `src/modules/cameras/components/add-camera-placeholder.tsx`
- `src/modules/cameras/types/index.ts`

**Modified:**

- `src/modules/registry.ts` — cameras status → `"active"`, refine description.
- `src/app/(portal)/dashboard/page.tsx` — wrap Cameras `<ModuleCard>` in `<Link href="/cameras">`.

## Future work (separate spec)

The full NVR system is out of scope for v1 but the design should not paint into a corner. Future work includes:

- Real IP cameras (RTSP) recorded by Frigate or Synology Surveillance Station on the NAS.
- 48-hour rolling buffer at 480p / 12fps (~6–7 GB per camera).
- Scheduled arm/disarm and motion-detection alerts.
- Server-side proxy routes for camera streams. Per `docs/current-state.md`: camera URLs and credentials must never be exposed to the browser. The portal acts as the authenticated gateway.
- Multi-user view permissions (e.g., one user can view but not arm/disarm).
- Audit events for arm/disarm and footage access.
