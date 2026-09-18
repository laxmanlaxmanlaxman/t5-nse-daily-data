# Start a public Cloudflare URL for the already-built frontend.
# The link works only while this script (and this PC) stay running.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location "$root\frontend"
if (-not (Test-Path "dist\index.html")) {
  npm run build
}
Start-Process -NoNewWindow npm -ArgumentList "run","preview","--","--host","127.0.0.1","--port","4173"
$exe = "$env:TEMP\cloudflared.exe"
if (-not (Test-Path $exe)) {
  Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $exe
}
& $exe tunnel --url http://127.0.0.1:4173
