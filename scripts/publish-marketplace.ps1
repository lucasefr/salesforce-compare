# Publishes Salesforce Compare to the Visual Studio Marketplace.
# Prerequisites: .env with VSCE_PAT (Marketplace Manage scope). See .env.example.

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

. (Join-Path $PSScriptRoot "load-env.ps1")

$publisher = $env:VSCE_PUBLISHER
if (-not $publisher) {
    $publisher = "LeftConsult"
}

$pat = $env:VSCE_PAT
if (-not $pat) {
    Write-Host "VSCE_PAT is empty. Open .env and paste your Azure DevOps PAT (Marketplace Manage scope)." -ForegroundColor Red
    Write-Host "See .env.example for the expected format." -ForegroundColor Yellow
    exit 1
}

$nodeDir = "C:\Program Files\nodejs"
if (Test-Path $nodeDir) {
    $env:Path = "$nodeDir;$env:Path"
}

Write-Host "Publisher: $publisher" -ForegroundColor Cyan
Write-Host "Building and packaging..." -ForegroundColor Cyan
npm run package
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Publishing to Visual Studio Marketplace..." -ForegroundColor Cyan
npx @vscode/vsce publish --pat "$pat"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Publish failed." -ForegroundColor Red
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "  1. Regenerate PAT at https://dev.azure.com/_usersSettings/tokens" -ForegroundColor Yellow
    Write-Host "     Scope: Custom -> Marketplace -> Manage (organization: All accessible)" -ForegroundColor Yellow
    Write-Host "  2. Confirm your account is Owner/Member of publisher '$publisher' at:" -ForegroundColor Yellow
    Write-Host "     https://marketplace.visualstudio.com/manage/publishers/$publisher" -ForegroundColor Yellow
    Write-Host "  3. Or upload the .vsix manually: Manage -> + New extension -> Visual Studio Code" -ForegroundColor Yellow
    exit $LASTEXITCODE
}

$extensionId = "$publisher.salesforce-compare"
Write-Host ""
Write-Host "Published: $extensionId" -ForegroundColor Green
Write-Host "Manage: https://marketplace.visualstudio.com/manage/publishers/$publisher" -ForegroundColor Green
Write-Host "Marketplace: https://marketplace.visualstudio.com/items?itemName=$extensionId" -ForegroundColor Green
