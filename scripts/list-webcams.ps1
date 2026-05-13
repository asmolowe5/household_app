# List DirectShow video devices visible to ffmpeg.
# Copy the device name (the string after "video=") into stream-webcam.ps1.

& ffmpeg -hide_banner -list_devices true -f dshow -i dummy 2>&1
Read-Host -Prompt "Press Enter to close"
