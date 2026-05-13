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
