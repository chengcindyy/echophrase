# Redeploy frontend only (skip SAM). Use after web-only fixes.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
. (Join-Path $PSScriptRoot "resolve-tools.ps1")
Initialize-DeployTools

Write-Host "==> Reading stack outputs..." -ForegroundColor Cyan
$outputs = aws cloudformation describe-stacks `
    --stack-name echophrase `
    --region us-west-2 `
    --query "Stacks[0].Outputs" `
    --output json | ConvertFrom-Json

$bucket = ($outputs | Where-Object { $_.OutputKey -eq "WebBucketName" }).OutputValue
$cloudFront = ($outputs | Where-Object { $_.OutputKey -eq "CloudFrontUrl" }).OutputValue

if (-not $bucket) {
    Write-Error "WebBucketName not found. Run pnpm deploy:aws first."
}

Write-Host "==> Building web (production, same-origin API)..." -ForegroundColor Cyan
$env:VITE_API_BASE_URL = ""
pnpm build:web
if ($LASTEXITCODE -ne 0) {
    Write-Error "Web build failed. Fix the error above and rerun pnpm deploy:web"
}

Write-Host "==> Uploading web/dist to s3://$bucket ..." -ForegroundColor Cyan
aws s3 sync web/dist "s3://$bucket" --delete

Write-Host "==> Invalidating CloudFront cache..." -ForegroundColor Cyan
$distId = aws cloudformation describe-stack-resources `
    --stack-name echophrase `
    --region us-west-2 `
    --logical-resource-id WebDistribution `
    --query "StackResources[0].PhysicalResourceId" `
    --output text
aws cloudfront create-invalidation --distribution-id $distId --paths "/*" | Out-Null

Write-Host ""
Write-Host "Web deploy complete!" -ForegroundColor Green
Write-Host "  App URL : $cloudFront"
Write-Host "On phone: close the PWA, reopen from browser, or clear Safari cache."
