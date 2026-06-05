$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Out = Join-Path $Root "git-status-check.txt"
@(
  "=== git version ==="
  (git --version 2>&1 | Out-String)
  "=== git status ==="
  (git status 2>&1 | Out-String)
  "=== git remote ==="
  (git remote -v 2>&1 | Out-String)
  "=== git log ==="
  (git log -3 --oneline 2>&1 | Out-String)
) | Set-Content $Out
