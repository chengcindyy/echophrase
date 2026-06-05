# EchoPhrase deploy: AWS SAM stack + S3/CloudFront web upload
# Prerequisites: aws configure, pnpm install, .env with AZURE_SPEECH_KEY

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

if (-not $azureKey) {
    Write-Error "AZURE_SPEECH_KEY missing. Set it in .env or environment."
}

Write-Host "==> Building API handlers…" -ForegroundColor Cyan
pnpm build:api
node scripts/package-api.mjs

Write-Host "==> Deploying SAM stack (echophrase)…" -ForegroundColor Cyan
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

Write-Host "==> Reading stack outputs…" -ForegroundColor Cyan
if ($LASTEXITCODE -ne 0) {
    Write-Error "SAM deploy failed. Fix the error above and rerun pnpm deploy:aws"
}

$outputs = aws cloudformation describe-stacks `
    --stack-name echophrase `
    --region us-west-2 `
    --query "Stacks[0].Outputs" `
    --output json | ConvertFrom-Json

$bucket = ($outputs | Where-Object { $_.OutputKey -eq "WebBucketName" }).OutputValue
$cloudFront = ($outputs | Where-Object { $_.OutputKey -eq "CloudFrontUrl" }).OutputValue
$api = ($outputs | Where-Object { $_.OutputKey -eq "ApiEndpoint" }).OutputValue

if (-not $bucket -or -not $cloudFront) {
    Write-Error "Missing CloudFormation outputs. Check stack deployment."
}

Write-Host "==> Building web (same-origin API via CloudFront)…" -ForegroundColor Cyan
$env:VITE_API_BASE_URL = ""
pnpm build:web

Write-Host "==> Uploading web/dist to s3://$bucket …" -ForegroundColor Cyan
aws s3 sync web/dist "s3://$bucket" --delete

Write-Host "==> Invalidating CloudFront cache…" -ForegroundColor Cyan
$distId = aws cloudformation describe-stack-resources `
    --stack-name echophrase `
    --region us-west-2 `
    --logical-resource-id WebDistribution `
    --query "StackResources[0].PhysicalResourceId" `
    --output text
aws cloudfront create-invalidation --distribution-id $distId --paths "/*" | Out-Null

Write-Host ""
Write-Host "Deploy complete!" -ForegroundColor Green
Write-Host "  App URL : $cloudFront"
Write-Host "  API URL : $api"
Write-Host ""
Write-Host "Phone: open App URL in Safari/Chrome, then Add to Home Screen."
Write-Host "Tonight: export CSV on desktop, import on phone tomorrow."
