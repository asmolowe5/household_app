# Camera Streaming Pipeline — Phase 1 of NVR System

**Date:** 2026-05-13
**Status:** Design approved, ready for implementation plan
**Reference:** [v1 webcam viewer spec](./2026-05-13-camera-module-design.md) (predecessor — v1 viewer used `getUserMedia` per-device, which is fundamentally different from a centralized camera feed)

## Background

The portal currently has a "v1" cameras page (built earlier today) that uses the browser's `getUserMedia` API. This shows whatever camera is attached to the viewing device — not what the user actually wants. The real goal is a security-camera-style system where one (eventually many) physical cameras stream centrally to the NAS, and any device opening the portal sees that central feed.

This spec covers **Phase 1** of that larger system: a streaming pipeline that gets one camera feed from a source to all viewers, through the NAS, over the existing Cloudflare Tunnel. No recording, no schedules, no arm/disarm — those are Phases 2–4.

The user's eventual hardware target is PoE IP cameras. For Phase 1 testing, the source is a Windows laptop webcam, deliberately configured to behave like an RTSP camera so that the NAS-side and portal-side architecture stays unchanged when real cameras arrive.

## Non-goals (Phases 2–4)

- No recording. No rolling buffer. No history playback. (Phase 2)
- No arm/disarm UI. No schedules. (Phase 3)
- No motion detection. No notifications. (Phase 4)
- No multi-camera management UI. Phase 1 uses one hard-coded camera name (`webcam`); generalization waits until there's a second camera.
- No bandwidth-adaptive transcoding.
- No WebRTC playback (HLS only — sub-second latency is not a Phase 1 requirement).

## High-level architecture

```
┌──────────────────────────┐
│  Source                  │
│  (Windows laptop +       │
│   built-in webcam)       │     RTSP push
│                          │ ────────────────►
│  ffmpeg via PowerShell   │     (LAN only,
│  script                  │      port 8554)
└──────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │  NAS (Docker)               │
                    │                             │
                    │  ┌───────────────────────┐  │
                    │  │ mediamtx              │  │
                    │  │ - RTSP in :8554       │  │
                    │  │ - HLS out :8888       │  │
                    │  │   (internal-only)     │  │
                    │  └───────────────────────┘  │
                    │           ▲                 │
                    │           │ HLS proxy       │
                    │           │ (auth-gated)    │
                    │  ┌───────────────────────┐  │
                    │  │ portal                │  │
                    │  │ /api/streams/...      │  │
                    │  └───────────────────────┘  │
                    └─────────────────────────────┘
                                  │
                                  │ HTTPS via Cloudflare Tunnel
                                  ▼
                    ┌─────────────────────────────┐
                    │  Any device on axiominteract.com │
                    │  (Portal cameras page,      │
                    │   HLS playback)             │
                    └─────────────────────────────┘
```

The key property: **when PoE cameras replace the Windows source, only the leftmost box changes.** The middle and right are identical.

## Component responsibilities

### Source (Windows ffmpeg script)

- Capture the local webcam via DirectShow.
- Encode to H.264 at 640×480, 12 fps, low-latency preset.
- Push as RTSP to the NAS at `rtsp://192.168.0.120:8554/webcam`, authenticated with `MEDIAMTX_PUBLISH_SECRET`.
- Run as long as the user keeps the PowerShell window open. No service / no auto-start in Phase 1 — this is throwaway test infrastructure.

When real PoE cameras land in the future, this entire component disappears. PoE cameras push RTSP natively to the same `:8554` port with the same authentication.

### MediaMTX (new NAS Docker service)

- Single-binary RTSP / HLS / WebRTC server (image: `bluenviron/mediamtx:latest`).
- Accepts RTSP publishes on `:8554` from authenticated sources only.
- Exposes the stream as HLS at `http://mediamtx:8888/<stream-name>/index.m3u8` *within the Docker network only* — port `8888` is **not** exposed to the host, **not** routed through Cloudflare Tunnel.
- Configuration via a single mounted YAML file (`docker/mediamtx/mediamtx.yml`). Auth secret injected from `.env`.
- Stateless: no recording, no disk usage. Stream is in-memory and ephemeral.

### Portal HLS proxy (new API route)

- New route: `GET /api/streams/[name]/[...path]`
  - Examples: `/api/streams/webcam/index.m3u8`, `/api/streams/webcam/seg0.ts`
- Authentication: re-uses existing `getCurrentUser()`. Unauthenticated → 401 (no redirect — this is an API, not a page).
- Forwards the request to `http://mediamtx:8888/<name>/<path>` (Docker-internal DNS).
- Pipes the response body back without buffering (HLS segments are ~1 MB each and must stream).
- Stream name is validated against a tight regex (`^[a-z][a-z0-9_-]*$`) to prevent path-traversal abuse.

Why proxy rather than expose MediaMTX through Cloudflare Tunnel directly? Single source of truth for authentication: the portal's session is the only credential anywhere in the system. There's no second hostname to manage, no CORS, and no public stream endpoint that could be guessed.

### Portal cameras page (modified)

The current `<CameraTile>` (which uses `getUserMedia`) is replaced for the "Webcam" position with a new `<HlsCameraTile>` component that:
- Takes a `name` prop (the stream name, e.g., `"webcam"`).
- Uses [`hls.js`](https://github.com/video-dev/hls.js) to play HLS in browsers that don't natively support it (every browser except Safari).
- On Safari, falls back to native `<video>` HLS support (no hls.js needed).
- Loads from `/api/streams/<name>/index.m3u8` (relative URL — same origin).
- Shows a "Stream not available" placeholder when the stream isn't being published (e.g., user hasn't started the Windows script).
- Reuses the same 16:9 tile chrome and "Webcam" label overlay from v1.

The placeholder tiles (`<AddCameraPlaceholder>` ×3) are unchanged.

The old `<CameraTile>` component stays in the codebase for now — we don't delete it as part of Phase 1 because it might be useful for future "use my phone camera" experiments. It just isn't rendered.

## Data flow

**At publish time (Windows → NAS):**
1. User runs `scripts/stream-webcam.ps1` on Windows.
2. The script first runs `ffmpeg -list_devices true -f dshow -i dummy` so the user can copy their webcam's DirectShow name into a variable in the script (one-time setup).
3. The script then runs ffmpeg with the configured device name, encoding settings, and the RTSP destination URL (including the publish secret in the URL: `rtsp://publisher:<secret>@192.168.0.120:8554/webcam`).
4. ffmpeg connects, MediaMTX authenticates the publisher, the stream begins.

**At view time (portal viewer):**
1. User opens https://axiominteract.com/cameras (already authenticated via portal session).
2. Browser fetches the cameras page. The page contains `<HlsCameraTile name="webcam" label="Webcam" />`.
3. `hls.js` (or native Safari) requests `/api/streams/webcam/index.m3u8`.
4. Portal validates session, validates stream-name regex, proxies the request to `http://mediamtx:8888/webcam/index.m3u8`.
5. MediaMTX returns the HLS playlist. The proxy pipes it back.
6. The browser fetches HLS segments (`/api/streams/webcam/seg0.ts`, etc.) the same way.
7. Video plays with ~5–10 second latency.

**At stream stop:**
1. User closes the PowerShell window or hits Ctrl+C. ffmpeg exits.
2. RTSP connection closes. MediaMTX stops serving the stream.
3. Any in-flight HLS segment requests for that stream start returning 404.
4. `hls.js` retries a few times, then surfaces an error. The `<HlsCameraTile>` catches this and shows "Stream not available".

## Security model

- **RTSP publish secret (`MEDIAMTX_PUBLISH_SECRET`):** A long random string. Required to push streams. Stored in NAS `.env`. The Windows script reads it from a Windows user environment variable of the same name (set once via `setx MEDIAMTX_PUBLISH_SECRET "..."`), so the script file itself stays free of secrets and remains safe to commit. Prevents anyone else on the home LAN from publishing rogue streams.
- **RTSP port 8554:** Exposed on the NAS host (`192.168.0.120:8554`) but not on the public internet. Only the home LAN can reach it. PoE cameras live on the home LAN so this is the right boundary.
- **MediaMTX HLS port 8888:** Internal to Docker network. Never exposed to host. Only the `portal` container can reach it (via Docker DNS `mediamtx:8888`).
- **Portal HLS proxy:** Requires a valid `iron-session` cookie. Same auth as the rest of the portal. No additional credentials needed.
- **Cloudflare Tunnel:** Already terminates HTTPS for the portal. The HLS proxy inherits this — `.m3u8` and `.ts` fetches go through the same TLS-terminated tunnel as everything else.

## Configuration

**New environment variable** (added to `.env.example`, `.env.local.example`, `docs/deployment.md`):

```
MEDIAMTX_PUBLISH_SECRET=<long-random-string>
```

Required on the NAS `.env`. Used by both:
- `docker-compose.yml` → passed to the `mediamtx` container as an env var.
- The Windows ffmpeg script → embedded in the RTSP URL.

**No new database migrations.** No schema changes. Phase 1 is pure infra + a viewer component.

## Files added or modified

**Added:**

- `docker/mediamtx/mediamtx.yml` — MediaMTX config (auth, paths, ports).
- `src/app/api/streams/[name]/[...path]/route.ts` — auth-gated HLS proxy.
- `src/modules/cameras/components/hls-camera-tile.tsx` — HLS playback tile.
- `scripts/stream-webcam.ps1` — Windows ffmpeg launcher (with device-listing one-liner at top).
- `docs/streaming.md` — runbook: install ffmpeg on Windows, fill in webcam name, run the script, troubleshooting.

**Modified:**

- `docker-compose.yml` — add `mediamtx` service definition, environment for the publish secret, port mapping for 8554/tcp.
- `package.json` — add `hls.js` dependency.
- `src/modules/cameras/components/camera-grid.tsx` — replace `<CameraTile label="Webcam" />` with `<HlsCameraTile name="webcam" label="Webcam" />`.
- `.env.example`, `.env.local.example` — add `MEDIAMTX_PUBLISH_SECRET=...`.
- `docs/deployment.md` — document the new env var, the new container, and how to verify the stream from the NAS.

## Verification (manual smoke test)

After implementation and deploy:

1. **NAS side:** `ssh asmolowe5@192.168.0.120` → `cd /volume1/docker/smolowe-portal` → `sudo docker compose ps` — `smolowe-mediamtx` (or whatever the new container is named) shows as healthy/running.
2. **NAS side:** `sudo docker compose logs mediamtx --tail=20` — MediaMTX startup logs show RTSP listening on `:8554` and HLS on `:8888`.
3. **Windows side:** Install ffmpeg if not already (`winget install ffmpeg` or scoop). Open `scripts/stream-webcam.ps1` in a text editor. The first time, uncomment the "list devices" line and run it to get the exact webcam name. Paste the name into the device variable. Save.
4. **Windows side:** Double-click `stream-webcam.ps1`. PowerShell window opens, ffmpeg starts encoding. Output shows `frame=`, `fps=`, `bitrate=` lines updating continuously. No connection errors.
5. **NAS side:** `sudo docker compose logs mediamtx --tail=5` — shows a new connection from the Windows machine and a new path/stream named `webcam`.
6. **Browser:** open https://axiominteract.com on any device (laptop, phone, second laptop). Sign in. Navigate to Cameras. Within ~10 seconds, tile 1 plays the live webcam feed from the Windows machine. Wave your hand in front of the webcam; verify it shows up on the screen with ~5–10s lag.
7. **Browser (second device):** simultaneously verify the same feed plays on another device.
8. **Stop test:** Ctrl+C the Windows PowerShell. Within ~30s, the portal tile should show "Stream not available".
9. **Restart test:** Re-run the script. Within ~10s, the tile recovers and plays again.

## Future work (Phases 2–4)

This section is informational, not part of Phase 1's scope:

- **Phase 2 — Recording with 48-hour rolling buffer.** MediaMTX has a recording mode. Add a recording config block, mount a volume on the NAS (`/volume1/portal-footage`), set a 48-hour retention policy, and add a "recent footage" page to the portal that lists and plays back segments.
- **Phase 3 — Arm/disarm + schedules.** Add a state model (armed / disarmed) and a schedule editor. Recording is gated on state. Probably a small `system_state` table + a settings page.
- **Phase 4 — Motion detection + notifications.** Either upgrade MediaMTX → Frigate (full NVR with AI object detection) or layer motion detection on top of MediaMTX with a separate tool. Add SMS/email notifications via existing Twilio integration when motion is detected during an armed window.

When PoE cameras arrive, the Windows ffmpeg script is decommissioned. The PoE cameras push RTSP to MediaMTX on the same port with their own credentials. Adding a second camera means adding a row to the MediaMTX paths config and a new `<HlsCameraTile>` to the grid.
