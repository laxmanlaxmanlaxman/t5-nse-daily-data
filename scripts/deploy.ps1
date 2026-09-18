# After `gh auth login`, run this to publish the UI and CSV release.
$ErrorActionPreference = "Stop"
$gh = "$env:ProgramFiles\GitHub CLI\gh.exe"
Set-Location $PSScriptRoot\..

& $gh auth status
if ($LASTEXITCODE -ne 0) { throw "Run gh auth login first." }

$name = "t5-nse-daily-data"
$existing = git remote get-url origin 2>$null
if (-not $existing) {
  & $gh repo create $name --public --source=. --remote=origin --push
} else {
  git push -u origin main
}

$user = & $gh api user --jq .login
& $gh api -X POST "repos/$user/$name/pages" -f build_type=workflow 2>$null
& $gh workflow run "Deploy frontend to GitHub Pages"
& $gh workflow run "Refresh NSE 2026 data"

Write-Host "UI (after Pages finishes): https://$user.github.io/$name/"
Write-Host "Release CSVs: https://github.com/$user/$name/releases/tag/nse-daily-2026"
