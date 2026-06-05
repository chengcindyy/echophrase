param(
    [string]$GithubUsername = "",
    [ValidateSet("private", "public")]
    [string]$Visibility = "private"
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Report = Join-Path $Root "git-upload-report.txt"

function Log([string]$msg) {
    Add-Content -Path $Report -Value $msg
    Write-Output $msg
}

function Test-GhAvailable {
    return [bool](Get-Command gh -ErrorAction SilentlyContinue)
}

"" | Set-Content $Report
Log "=== EchoPhrase GitHub Upload ==="
Log "Time: $(Get-Date -Format o)"
Log ""

$hasGh = Test-GhAvailable
Log "=== 1. tooling ==="
Log "gh installed: $hasGh"

if ($hasGh) {
    Log (gh auth status 2>&1 | Out-String).TrimEnd()
    if ($LASTEXITCODE -ne 0) {
        Log ""
        Log "BLOCKER: gh is installed but not logged in. Run: gh auth login"
        exit 2
    }
} else {
    Log "gh not found — will use git push only (create repo on github.com first)."
}

Log ""
Log "=== 2. git status ==="
Log (git status 2>&1 | Out-String).TrimEnd()

Log ""
Log "=== 3. secret checks ==="
Log (git check-ignore -v .env .env.production 2>&1 | Out-String).TrimEnd()
Log "tracked env:"
Log (git ls-files .env .env.production 2>&1 | Out-String).TrimEnd()

$needsCommit = $false
git rev-parse HEAD 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { $needsCommit = $true }
$porcelain = git status --porcelain 2>&1
if ($porcelain) { $needsCommit = $true }

if ($needsCommit) {
    Log ""
    Log "=== 4. stage and commit ==="
    git add -A
    if (Test-Path ".env") { git restore --staged .env 2>$null }
    if (Test-Path ".env.production") { git restore --staged .env.production 2>$null }

    $staged = @(git diff --cached --name-only 2>&1)
    Log "staged ($($staged.Count) files):"
    foreach ($f in $staged) { Log "  $f" }

    $bad = $staged | Where-Object { $_ -match '^\.env(\.|$)' -and $_ -ne '.env.example' }
    if ($bad) {
        Log ""
        Log "BLOCKER: secret files staged: $($bad -join ', ')"
        exit 3
    }

    if ($staged.Count -eq 0) {
        Log "Nothing to commit."
    } else {
        $msg = @'
EchoPhrase: French pronunciation PWA with iOS audio fix
'@
        git commit -m $msg 2>&1 | ForEach-Object { Log $_ }
        if ($LASTEXITCODE -ne 0) {
            Log "BLOCKER: git commit failed (exit $LASTEXITCODE)"
            exit 4
        }
        Log "COMMIT_OK"
    }
} else {
    Log ""
    Log "=== 4. commit skipped (clean tree) ==="
}

$sha = (git rev-parse HEAD 2>&1 | Out-String).Trim()
Log ""
Log "COMMIT_SHA: $sha"

git branch -M main 2>$null | Out-Null

Log ""
Log "=== 5. remote / push ==="
git remote get-url origin 2>$null | Out-Null
$hasRemote = $LASTEXITCODE -eq 0

if (-not $hasRemote) {
    if ($hasGh) {
        Log "Creating $Visibility repo echophrase via gh..."
        gh repo create echophrase --$Visibility --source=. --remote=origin --push 2>&1 | ForEach-Object { Log $_ }
        if ($LASTEXITCODE -ne 0) {
            Log "BLOCKER: gh repo create failed (exit $LASTEXITCODE)"
            exit 5
        }
    } elseif ($GithubUsername) {
        $remoteUrl = "https://github.com/$GithubUsername/echophrase.git"
        Log "Adding remote: $remoteUrl"
        git remote add origin $remoteUrl 2>&1 | ForEach-Object { Log $_ }
        git push -u origin main 2>&1 | ForEach-Object { Log $_ }
        if ($LASTEXITCODE -ne 0) {
            Log "BLOCKER: git push failed (exit $LASTEXITCODE)"
            exit 6
        }
    } else {
        Log ""
        Log "BLOCKER: No git remote and gh is not installed."
        Log "1) Open https://github.com/new and create an empty repo named: echophrase"
        Log "2) Rerun with your username:"
        Log '   powershell -ExecutionPolicy Bypass -File scripts\git-upload.ps1 -GithubUsername YOUR_USERNAME'
        exit 7
    }
} else {
    Log "Remote exists: $((git remote get-url origin 2>&1 | Out-String).Trim())"
    git push -u origin main 2>&1 | ForEach-Object { Log $_ }
    if ($LASTEXITCODE -ne 0) {
        Log "BLOCKER: git push failed (exit $LASTEXITCODE)"
        exit 6
    }
}

if ($hasGh) {
    $url = (gh repo view --json url -q .url 2>&1 | Out-String).Trim()
} else {
    $remote = (git remote get-url origin 2>&1 | Out-String).Trim()
    $url = $remote -replace '\.git$', '' -replace 'git@github\.com:', 'https://github.com/'
}

Log ""
Log "GITHUB_REPO_URL: $url"
Log "SUCCESS"
