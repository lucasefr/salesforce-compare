# Publishes Salesforce Compare to Open VSX (Cursor marketplace backend).
# Prerequisites: .env with OVSX_PAT. Create token at https://open-vsx.org/user-settings/tokens

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

. (Join-Path $PSScriptRoot "load-env.ps1")

$publisher = $env:VSCE_PUBLISHER
if (-not $publisher) {
    $publisher = "LeftConsult"
}

$pat = $env:OVSX_PAT
if (-not $pat) {
    Write-Host "OVSX_PAT is empty. Open .env and paste your Open VSX access token." -ForegroundColor Red
    Write-Host "Create token: https://open-vsx.org/user-settings/tokens" -ForegroundColor Yellow
    Write-Host "Create namespace (once): npx ovsx create-namespace $publisher -p <token>" -ForegroundColor Yellow
    exit 1
}

$nodeDir = "C:\Program Files\nodejs"
if (Test-Path $nodeDir) {
    $env:Path = "$nodeDir;$env:Path"
}

$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$vsixName = "salesforce-compare-$version.vsix"
$vsixPath = Join-Path $projectRoot $vsixName

Write-Host "Publisher/namespace: $publisher" -ForegroundColor Cyan
Write-Host "Target: Open VSX (Cursor marketplace)" -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath $vsixPath)) {
    Write-Host "Building and packaging $vsixName..." -ForegroundColor Cyan
    npm run package
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} else {
    Write-Host "Using existing package: $vsixName" -ForegroundColor Cyan
}

Write-Host "Ensuring Open VSX namespace '$publisher' exists..." -ForegroundColor Cyan
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
npx --yes ovsx create-namespace $publisher -p "$pat"
$ErrorActionPreference = $prevEap
# Namespace may already exist; continue to publish.

Write-Host "Publishing to Open VSX..." -ForegroundColor Cyan
$ErrorActionPreference = "Continue"
npx --yes ovsx publish $vsixPath -p "$pat"
$publishExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($publishExit -ne 0) {
    Write-Host "Open VSX publish failed." -ForegroundColor Red
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "  1. Generate token at https://open-vsx.org/user-settings/tokens" -ForegroundColor Yellow
    Write-Host "  2. Sign Eclipse Contributor Agreement if required by Open VSX" -ForegroundColor Yellow
    Write-Host "  3. Create namespace: npx ovsx create-namespace $publisher -p <token>" -ForegroundColor Yellow
    Write-Host "  4. Claim namespace ownership later via EclipseFdn/open-vsx.org if warned" -ForegroundColor Yellow
    exit $publishExit
}

$extensionId = "$publisher.salesforce-compare"
Write-Host ""
Write-Host "Published to Open VSX: $extensionId" -ForegroundColor Green
Write-Host "Open VSX: https://open-vsx.org/extension/$publisher/salesforce-compare" -ForegroundColor Green
Write-Host "In Cursor: Extensions → search Salesforce Compare → Install (may take a few minutes to appear)." -ForegroundColor Green
