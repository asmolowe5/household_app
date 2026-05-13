# Camera Streaming Pipeline Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a centralized streaming pipeline so one webcam (today: Windows laptop; eventually: PoE IP cameras) streams continuously to the NAS and is viewable in the portal from any device.

**Architecture:** ffmpeg on Windows pushes RTSP to a new MediaMTX Docker service on the NAS. MediaMTX re-serves the stream as HLS on an internal Docker-network port. A new auth-gated portal API route proxies HLS to the browser. A new `<HlsCameraTile>` component plays HLS via `hls.js`. The existing `<CameraTile>` (which uses `getUserMedia`) stays in the codebase but is no longer rendered.

**Tech Stack:** MediaMTX (bluenviron/mediamtx Docker image), Docker Compose, Next.js 16 App Router, hls.js, ffmpeg (Windows host), PowerShell.

**Reference:** [Phase 1 design spec](../specs/2026-05-13-camera-streaming-pipeline-design.md)

**Testing approach:** Per the spec, this phase uses manual verification only. Each task verifies via `npm run lint`. Task 5 verifies via `npm run build`, deployment to NAS, and the full manual smoke test from the spec.

---

## File Structure

**New files:**

- `docker/mediamtx/mediamtx.yml` — MediaMTX config: ports, auth, paths.
- `src/app/api/streams/[name]/[...path]/route.ts` — auth-gated HLS proxy. Validates stream name, validates path segments to prevent traversal, pipes upstream MediaMTX response back.
- `src/modules/cameras/components/hls-camera-tile.tsx` — client component. Plays HLS via hls.js, falls back to native Safari HLS, surfaces "Stream not available" on error.
- `scripts/stream-webcam.ps1` — Windows ffmpeg launcher. Reads publish secret from env var. Configurable webcam name / dimensions at top of file.
- `scripts/list-webcams.ps1` — one-line helper that prints DirectShow video device names.
- `docs/streaming.md` — runbook: install ffmpeg on Windows, set the secret env var, find the webcam name, run the script, troubleshooting.

**Modified files:**

- `docker-compose.yml` — add `mediamtx` service entry, RTSP port mapping.
- `package.json` + `package-lock.json` — add `hls.js` dependency.
- `src/modules/cameras/components/camera-grid.tsx` — replace `<CameraTile label="Webcam" />` with `<HlsCameraTile name="webcam" label="Webcam" />`.
- `.env.example` — add `MEDIAMTX_CONTAINER_NAME` and `MEDIAMTX_PUBLISH_SECRET` placeholders.
- `.env.local.example` — add the same with a note that local dev rarely needs them.
- `docs/deployment.md` — document the new container, env vars, and verification commands.

---

## Task 1: MediaMTX Docker service

**Files:**

- Create: `docker/mediamtx/mediamtx.yml`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `.env.local.example`

- [ ] **Step 1: Create the MediaMTX config**

Write `docker/mediamtx/mediamtx.yml`:

```yaml
# MediaMTX configuration for the household portal Phase 1 streaming pipeline.
# See https://github.com/bluenviron/mediamtx for full options.

logLevel: info

# RTSP server (LAN-only, port mapped to host so ffmpeg on Windows can publish).
rtspAddress: :8554
rtspTransports: [tcp]

# HLS server (Docker-network-internal, NOT mapped to host).
# Only the portal container reaches this via Docker DNS at http://mediamtx:8888.
hlsAddress: :8888
hlsAlwaysRemux: yes
hlsAllowOrigin: '*'

# Authentication.
authMethod: internal
authInternalUsers:
  # Publisher: must use this user + the shared secret to push RTSP.
  - user: publisher
    pass: ${MEDIAMTX_PUBLISH_SECRET}
    ips: []
    permissions:
      - action: publish
        path:
  # Reader: anonymous reads are allowed because the HLS port is Docker-internal
  # only. The portal's auth-gated proxy is the real reader-side security boundary.
  - user: any
    pass:
    ips: []
    permissions:
      - action: read
        path:

# Accept any stream name. The proxy validates names with a regex on the way in.
paths:
  all_others:
```

- [ ] **Step 2: Add the mediamtx service to docker-compose.yml**

Open `docker-compose.yml`. After the existing `portal:` service block and before the `tunnel:` service block, insert a new service:

```yaml
  mediamtx:
    image: bluenviron/mediamtx:latest
    container_name: ${MEDIAMTX_CONTAINER_NAME:?Set MEDIAMTX_CONTAINER_NAME in .env}
    restart: unless-stopped
    environment:
      MEDIAMTX_PUBLISH_SECRET: ${MEDIAMTX_PUBLISH_SECRET:?Set MEDIAMTX_PUBLISH_SECRET in .env}
    volumes:
      - ./docker/mediamtx/mediamtx.yml:/mediamtx.yml:ro
    ports:
      - "8554:8554"
```

Note: port `8888` is **not** mapped — that's intentional. The portal container reaches it via the Docker network.

- [ ] **Step 3: Add the env vars to .env.example**

Open `.env.example`. After the `# Cloudflare Tunnel` section and before any trailing newline, add:

```sh

# MediaMTX (camera streaming)
MEDIAMTX_CONTAINER_NAME=household-mediamtx
MEDIAMTX_PUBLISH_SECRET=replace-with-a-long-random-secret
```

- [ ] **Step 4: Add the env vars to .env.local.example**

Open `.env.local.example`. Add at the bottom:

```sh

# MediaMTX (camera streaming) — only needed if running MediaMTX locally for streaming tests
MEDIAMTX_CONTAINER_NAME=household-mediamtx
MEDIAMTX_PUBLISH_SECRET=replace-with-a-long-random-secret
```

- [ ] **Step 5: Verify docker-compose syntax**

Run: `docker compose --env-file .env.example config 1> $null`
Expected: command exits 0 (no parse errors). The `> $null` (PowerShell) suppresses the rendered output; if anything goes to stderr there's a problem.

If you're in Git Bash instead, use: `docker compose --env-file .env.example config > /dev/null`

- [ ] **Step 6: Verify lint still passes**

Run: `npm run lint`
Expected: passes.

- [ ] **Step 7: Commit**

```sh
git add docker/mediamtx/mediamtx.yml docker-compose.yml .env.example .env.local.example
git commit -m "Add MediaMTX Docker service for camera streaming"
```

---

## Task 2: HLS proxy route

**Files:**

- Create: `src/app/api/streams/[name]/[...path]/route.ts`

- [ ] **Step 1: Create the proxy route**

Write `src/app/api/streams/[name]/[...path]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";

const STREAM_NAME_PATTERN = /^[a-z][a-z0-9_-]*$/;
const SEGMENT_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MEDIAMTX_BASE =
  process.env.MEDIAMTX_INTERNAL_URL ?? "http://mediamtx:8888";

export async function GET(
  request: Request,
  context: { params: Promise<{ name: string; path: string[] }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, path } = await context.params;

  if (!STREAM_NAME_PATTERN.test(name)) {
    return NextResponse.json({ error: "Invalid stream name" }, { status: 400 });
  }

  if (path.some((segment) => !SEGMENT_PATTERN.test(segment))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const upstream = `${MEDIAMTX_BASE}/${name}/${path.join("/")}`;

  let response: Response;
  try {
    response = await fetch(upstream, {
      headers: { Accept: request.headers.get("Accept") ?? "*/*" },
    });
  } catch {
    return NextResponse.json({ error: "Stream unavailable" }, { status: 502 });
  }

  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: passes.

- [ ] **Step 3: Commit**

```sh
git add "src/app/api/streams/[name]/[...path]/route.ts"
git commit -m "Add auth-gated HLS proxy route for camera streams"
```

---

## Task 3: HLS viewer component and grid swap

**Files:**

- Modify: `package.json` + `package-lock.json` (via `npm install hls.js`)
- Create: `src/modules/cameras/components/hls-camera-tile.tsx`
- Modify: `src/modules/cameras/components/camera-grid.tsx`

- [ ] **Step 1: Install hls.js**

Run: `npm install hls.js`
Expected: `package.json` shows `"hls.js": "^1.x.x"` in dependencies. `package-lock.json` is updated. No errors.

- [ ] **Step 2: Create the HLS camera tile**

Write `src/modules/cameras/components/hls-camera-tile.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Video, VideoOff } from "lucide-react";

type HlsTileState =
  | { status: "connecting" }
  | { status: "playing" }
  | { status: "unavailable" };

interface HlsCameraTileProps {
  name: string;
  label: string;
}

export function HlsCameraTile({ name, label }: HlsCameraTileProps) {
  const [state, setState] = useState<HlsTileState>({ status: "connecting" });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const url = `/api/streams/${name}/index.m3u8`;
    let cancelled = false;

    if (Hls.isSupported()) {
      const hls = new Hls({ liveDurationInfinity: true });
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) setState({ status: "playing" });
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal && !cancelled) setState({ status: "unavailable" });
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      const onLoaded = () => {
        if (!cancelled) setState({ status: "playing" });
      };
      const onError = () => {
        if (!cancelled) setState({ status: "unavailable" });
      };
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);
      video.src = url;
    } else {
      queueMicrotask(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });
    }

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [name]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-border-default bg-bg-secondary">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`h-full w-full object-cover ${
          state.status === "playing" ? "" : "opacity-0"
        }`}
      />
      {state.status !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
          {state.status === "connecting" && (
            <>
              <Video size={20} className="text-text-tertiary" />
              <p className="text-xs text-text-tertiary">
                Connecting to stream&hellip;
              </p>
            </>
          )}
          {state.status === "unavailable" && (
            <>
              <VideoOff size={20} className="text-text-tertiary" />
              <p className="text-xs text-text-secondary">Stream not available</p>
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

- [ ] **Step 3: Swap the tile in camera-grid**

Open `src/modules/cameras/components/camera-grid.tsx`.

Find:

```tsx
import { CameraTile } from "./camera-tile";
import { AddCameraPlaceholder } from "./add-camera-placeholder";
```

Replace with:

```tsx
import { HlsCameraTile } from "./hls-camera-tile";
import { AddCameraPlaceholder } from "./add-camera-placeholder";
```

Find:

```tsx
<CameraTile label="Webcam" />
```

Replace with:

```tsx
<HlsCameraTile name="webcam" label="Webcam" />
```

The `<AddCameraPlaceholder />` lines stay unchanged.

Note: `src/modules/cameras/components/camera-tile.tsx` stays in the codebase (still useful for any future "use my device camera" experiment). Just no longer rendered.

- [ ] **Step 4: Verify lint**

Run: `npm run lint`
Expected: passes.

- [ ] **Step 5: Commit**

```sh
git add package.json package-lock.json src/modules/cameras/components/hls-camera-tile.tsx src/modules/cameras/components/camera-grid.tsx
git commit -m "Add HLS camera tile and swap webcam tile in grid"
```

---

## Task 4: Windows ffmpeg scripts and docs

**Files:**

- Create: `scripts/stream-webcam.ps1`
- Create: `scripts/list-webcams.ps1`
- Create: `docs/streaming.md`
- Modify: `docs/deployment.md`

- [ ] **Step 1: Create the webcam-listing helper**

Write `scripts/list-webcams.ps1`:

```powershell
# List DirectShow video devices visible to ffmpeg.
# Copy the device name (the string after "video=") into stream-webcam.ps1.

& ffmpeg -hide_banner -list_devices true -f dshow -i dummy 2>&1
Read-Host -Prompt "Press Enter to close"
```

- [ ] **Step 2: Create the streaming script**

Write `scripts/stream-webcam.ps1`:

```powershell
# Stream the local webcam to the NAS MediaMTX server.
# One-time setup:
#   1. Install ffmpeg:   winget install Gyan.FFmpeg   (or: scoop install ffmpeg)
#   2. Set the secret:   setx MEDIAMTX_PUBLISH_SECRET "<value-from-NAS-.env>"
#                        Close and reopen any open terminals after this.
#   3. Find your webcam name by running scripts/list-webcams.ps1 and pasting
#      the device name into $WebcamDevice below.

$ErrorActionPreference = "Stop"

# === Edit these values once for your setup ===
$WebcamDevice = "Integrated Camera"
$NasHost      = "192.168.0.120"
$StreamName   = "webcam"
$Width        = 640
$Height       = 480
$Framerate    = 12
# ============================================

$secret = $env:MEDIAMTX_PUBLISH_SECRET
if ([string]::IsNullOrWhiteSpace($secret)) {
  Write-Error "MEDIAMTX_PUBLISH_SECRET is not set. Run: setx MEDIAMTX_PUBLISH_SECRET ""<secret>"" then open a new terminal."
}

$rtspUrl = "rtsp://publisher:$secret@${NasHost}:8554/$StreamName"

Write-Host "Streaming '$WebcamDevice' to $NasHost as '$StreamName' at ${Width}x${Height}@${Framerate}fps"
Write-Host "Press Ctrl+C to stop."

& ffmpeg `
  -f dshow `
  -framerate $Framerate `
  -video_size "${Width}x${Height}" `
  -i "video=$WebcamDevice" `
  -c:v libx264 `
  -preset veryfast `
  -tune zerolatency `
  -pix_fmt yuv420p `
  -g $($Framerate * 2) `
  -f rtsp `
  -rtsp_transport tcp `
  $rtspUrl
```

- [ ] **Step 3: Create the streaming runbook**

Write `docs/streaming.md`:

````markdown
# Camera Streaming Runbook

This document covers running the Phase 1 camera streaming pipeline. Today
the source is a Windows machine's webcam pushed via ffmpeg. When PoE cameras
are added, this runbook applies only to those PoE cameras (which speak RTSP
natively), and the Windows-side steps below can be retired.

## One-time Windows setup

1. Install ffmpeg on Windows:

   ```sh
   winget install Gyan.FFmpeg
   ```

   Or with Scoop: `scoop install ffmpeg`. Either way, restart your terminal
   after install so `ffmpeg` is on PATH.

2. Set the MediaMTX publish secret as a user env var. Use the exact value
   from the NAS `.env`'s `MEDIAMTX_PUBLISH_SECRET`:

   ```sh
   setx MEDIAMTX_PUBLISH_SECRET "your-actual-secret-here"
   ```

   Close and reopen every terminal afterward — `setx` only affects new
   shells.

3. Find your webcam's exact DirectShow name. Run:

   ```sh
   powershell -File scripts\list-webcams.ps1
   ```

   You'll see a list like:

   ```text
   [dshow @ ...]  "Integrated Camera"
   [dshow @ ...]   Alternative name "@device_..."
   ```

   Copy the human-readable name (the one inside quotes after the bracket).

4. Open `scripts/stream-webcam.ps1` in a text editor. At the top, set
   `$WebcamDevice = "Integrated Camera"` (replace with your name from step 3).
   Save.

## Starting the stream

Double-click `scripts/stream-webcam.ps1`, or run it from a PowerShell terminal:

```sh
powershell -File scripts\stream-webcam.ps1
```

You should see ffmpeg start encoding. Lines like
`frame=  120 fps= 12 bitrate=...` print continuously. Leave the window open.

In the portal at https://axiominteract.com, the Cameras page now plays the
live feed within ~10 seconds.

## Stopping the stream

Close the PowerShell window or press Ctrl+C inside it. The portal tile
falls back to "Stream not available" within ~30 seconds.

## Troubleshooting

**Script says `MEDIAMTX_PUBLISH_SECRET is not set`:** `setx` only affects new
terminals. Close every open terminal, including any IDE built-in terminals,
and try again.

**ffmpeg says `Could not enumerate video devices` or `Could not find video device`:**
The `$WebcamDevice` name in the script doesn't match a real device. Re-run
`scripts/list-webcams.ps1`. Names are case-sensitive and must match exactly.

**ffmpeg connects but immediately disconnects with `401 Unauthorized`:** the
secret on Windows doesn't match the one in the NAS `.env`. Reset both to the
same value.

**Portal shows "Stream not available" even though ffmpeg is running:** SSH to
the NAS and run `sudo docker compose logs mediamtx --tail=20`. If MediaMTX
isn't logging incoming connections, the Windows machine cannot reach
192.168.0.120:8554 (check VPN, firewall, or that you're on the home network).

**Portal shows "Connecting to stream..." forever:** the proxy can't reach
MediaMTX, or MediaMTX can't see your publish. SSH to NAS and check
`sudo docker compose ps` — `smolowe-mediamtx` (or whatever your
`MEDIAMTX_CONTAINER_NAME` is) should be `Up`.
````

- [ ] **Step 4: Update deployment doc**

Open `docs/deployment.md`. Find the `## Required NAS \`.env\`` section. In the existing env block, after the `CLOUDFLARE_TOKEN=...` line, add two new lines:

```sh
MEDIAMTX_CONTAINER_NAME=household-mediamtx
MEDIAMTX_PUBLISH_SECRET=...
```

Then find the `## Health Check` section. After the existing `If health fails, inspect:` block (the one with `docker compose logs --tail=100 portal/db/tunnel`), add a new entry for the mediamtx logs in that same code block. The block should now read:

```sh
sudo docker-compose ps
sudo docker-compose logs --tail=100 portal
sudo docker-compose logs --tail=100 db
sudo docker-compose logs --tail=100 tunnel
sudo docker-compose logs --tail=100 mediamtx
```

Then at the very end of the file, add a new section:

```markdown
## Camera Streaming

The portal's camera streaming pipeline depends on the `mediamtx` container.
See `docs/streaming.md` for end-to-end runbook (Windows-side setup, starting
streams, troubleshooting).

To verify MediaMTX is up:

```sh
sudo docker-compose ps mediamtx
sudo docker-compose logs --tail=20 mediamtx
```

MediaMTX listens for RTSP publishes on `:8554` (LAN-only) and serves HLS on
`:8888` (Docker-network-only — never exposed to the host or to Cloudflare).
The portal proxies HLS through `/api/streams/<name>/...` and applies session
auth.
```

- [ ] **Step 5: Verify lint**

Run: `npm run lint`
Expected: passes.

- [ ] **Step 6: Commit**

```sh
git add scripts/stream-webcam.ps1 scripts/list-webcams.ps1 docs/streaming.md docs/deployment.md
git commit -m "Add Windows streaming scripts and streaming runbook"
```

---

## Task 5: Build verification, merge, deploy, smoke test

No new code in this task. Run the full build, merge to main, and walk through the spec's verification checklist on the real deployment.

- [ ] **Step 1: Run lint and build**

Run: `npm run lint`
Expected: passes.

Run: `npm run build`
Expected: build completes successfully. Output shows the new `/api/streams/[name]/[...path]` route registered as a dynamic (server-rendered) route alongside the existing `/cameras` route. No errors or warnings related to MediaMTX, hls.js, or the new components.

- [ ] **Step 2: Merge feature branch to main**

Run:

```sh
git checkout main
git pull --ff-only origin main
git merge --ff-only claude/streaming-phase1-design
git push origin main
```

Expected: fast-forward merge with no conflicts. Push succeeds. GitHub Actions begins building the new image automatically.

- [ ] **Step 3: Wait for GitHub Actions image build**

Watch https://github.com/asmolowe5/household_app/actions until the "Build portal image" workflow on the new commit shows green. Usually 2–3 minutes.

- [ ] **Step 4: Update NAS .env**

SSH to NAS:

```sh
ssh asmolowe5@192.168.0.120
cd /volume1/docker/smolowe-portal
```

Generate a strong random secret (use a password manager or run `openssl rand -hex 32`). Edit `.env` and add two new lines:

```sh
MEDIAMTX_CONTAINER_NAME=smolowe-mediamtx
MEDIAMTX_PUBLISH_SECRET=<the-generated-secret>
```

Save the file. Confirm both keys are present without printing the secret:

```sh
awk -F= '/^(MEDIAMTX_CONTAINER_NAME|MEDIAMTX_PUBLISH_SECRET)=/ { print $1, length($2) " chars" }' .env
```

Expected: prints two lines, the secret line showing at least 32 chars.

- [ ] **Step 5: Pull and deploy on NAS**

Run:

```sh
sudo git pull
sh scripts/deploy.sh
```

Expected: deploy script pulls the new portal image, starts the new `smolowe-mediamtx` container alongside the existing services, runs the health check successfully, and prints `Deployment healthy.`

- [ ] **Step 6: Verify MediaMTX is running on NAS**

Run:

```sh
sudo docker compose ps mediamtx
sudo docker compose logs --tail=20 mediamtx
```

Expected: `smolowe-mediamtx` is `Up`. Logs show MediaMTX started, including a line about the RTSP server listening on `:8554` and the HLS server listening on `:8888`.

- [ ] **Step 7: One-time Windows setup**

On the Windows machine:

```sh
winget install Gyan.FFmpeg
```

After install, close all terminals and reopen one. Confirm with:

```sh
ffmpeg -version
```

Then:

```sh
setx MEDIAMTX_PUBLISH_SECRET "<same-secret-from-NAS-.env>"
```

Close all terminals and reopen.

- [ ] **Step 8: Find webcam name and configure the script**

In the Windows machine, navigate to the project (or pull latest from GitHub) and run:

```sh
powershell -File scripts\list-webcams.ps1
```

Note the device name. Open `scripts/stream-webcam.ps1` in a text editor. Set `$WebcamDevice` to your exact device name. Save.

- [ ] **Step 9: Start the stream**

Double-click `scripts/stream-webcam.ps1`, or run it from PowerShell. Expected: ffmpeg shows continuous `frame=...` output. No `Connection refused` or `401 Unauthorized` errors.

- [ ] **Step 10: Verify in the portal**

Open https://axiominteract.com on the Windows machine (or any other device). Sign in. Navigate to Cameras.

Expected:
- Tile 1 first shows "Connecting to stream…" (briefly).
- Within ~10 seconds, the live webcam plays in tile 1.
- Waving a hand in front of the camera shows up on screen with ~5–10s lag.
- Tiles 2–4 show muted "Add camera" placeholders (unchanged).

Open the site simultaneously on a second device (phone, second browser). Expected: the same live feed plays on both devices simultaneously.

- [ ] **Step 11: Verify "stream stopped" behavior**

In the Windows PowerShell window, press Ctrl+C to stop ffmpeg. Wait ~30 seconds.

Expected: the portal tile transitions from playing to "Stream not available".

- [ ] **Step 12: Verify restart**

Re-run `scripts/stream-webcam.ps1`. Wait ~10 seconds. Refresh the portal page.

Expected: stream recovers and plays again.

- [ ] **Step 13: Done**

If every check passes, Phase 1 is complete. No more code commits needed in this phase.

If any check fails, fix the underlying issue. For source-code fixes, create small follow-up commits on `main` (or another branch + PR). For config/env issues, document the fix and update `docs/streaming.md` or `docs/deployment.md` so the runbook reflects reality.

---

## Self-review

**Spec coverage check:**

- MediaMTX as new Docker service → Task 1.
- `docker/mediamtx/mediamtx.yml` config → Task 1.
- RTSP on 8554 exposed to host, HLS on 8888 Docker-internal-only → Task 1.
- `MEDIAMTX_PUBLISH_SECRET` env var, used by both `docker-compose.yml` and the Windows script → Task 1 (NAS side) and Task 4 (Windows side).
- HLS proxy at `/api/streams/[name]/[...path]` with auth + stream-name regex + path-segment regex → Task 2.
- `<HlsCameraTile>` with hls.js and Safari native fallback → Task 3.
- Camera grid swap → Task 3.
- Windows ffmpeg push script with publish secret from env var → Task 4.
- `docs/streaming.md` runbook covering install, setup, stop, troubleshoot → Task 4.
- `docs/deployment.md` updates (new container, new env vars, log inspection) → Task 4.
- Full manual smoke test (NAS deploy → ffmpeg start → portal play → stop → restart) → Task 5.

No gaps.

**Placeholder scan:** No "TBD", no "implement later", no "add appropriate error handling". Each error path has explicit code or explicit user-action text.

**Type consistency:** `HlsCameraTile` props `name: string` and `label: string` are used consistently across the component definition and the camera-grid swap. Stream name `"webcam"` is hard-coded consistently in both the portal client (Task 3) and the Windows script (`$StreamName = "webcam"` in Task 4). Env var names `MEDIAMTX_PUBLISH_SECRET` and `MEDIAMTX_CONTAINER_NAME` match across `.env.example`, `.env.local.example`, `docker-compose.yml`, and `docs/deployment.md`.
