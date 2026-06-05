$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Out = Join-Path $Root "git-report.txt"

function W($text) { Add-Content -Path $Out -Value $text }

"" | Set-Content $Out
W "=== git status ==="
W (git status 2>&1 | Out-String)
W "=== git diff --stat ==="
W (git diff --stat 2>&1 | Out-String)
W "=== git log -5 ==="
W (git log -5 --oneline 2>&1 | Out-String)
W "=== git remote -v ==="
W (git remote -v 2>&1 | Out-String)
W "=== check-ignore ==="
W (git check-ignore -v .env .env.production 2>&1 | Out-String)
W "=== ls-files env ==="
W (git ls-files .env .env.production 2>&1 | Out-String)
