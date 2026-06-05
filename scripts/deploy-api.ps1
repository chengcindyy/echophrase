# Redeploy Lambda API only (skip web upload).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Read-DotEnvValue([string]$Name) {
    $envFile = Join-Path $Root ".env"
    if (-not (Test-Path $envFile)) { return $null }
    foreach ($line in Get-Content $envFile) {
        if ($line -match "^\s*$Name=(.*)$") {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

$azureKey = $env:AZURE_SPEECH_KEY
if (-not $azureKey) { $azureKey = Read-DotEnvValue "AZURE_SPEECH_KEY" }
$azureRegion = $env:AZURE_SPEECH_REGION
if (-not $azureRegion) { $azureRegion = Read-DotEnvValue "AZURE_SPEECH_REGION" }
if (-not $azureRegion) { $azureRegion = "eastus" }
if (-not $azureKey) { Write-Error "AZURE_SPEECH_KEY missing" }

pnpm build:api
node scripts/package-api.mjs

$templateFile = Join-Path $Root "infra\template.yaml"
sam deploy `
    --template-file $templateFile `
    --stack-name echophrase `
    --resolve-s3 `
    --capabilities CAPABILITY_IAM `
    --region us-west-2 `
    --parameter-overrides "AzureSpeechKey=$azureKey AzureSpeechRegion=$azureRegion" `
    --no-confirm-changeset `
    --no-fail-on-empty-changeset

Write-Host "API deploy complete." -ForegroundColor Green
