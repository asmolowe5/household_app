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
