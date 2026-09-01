# Diagnoses .env loading without printing secrets.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "load-env.ps1")

if (-not $env:VSCE_PAT) {
    Write-Host "VSCE_PAT: EMPTY"
    exit 1
}

Write-Host "VSCE_PAT length: $($env:VSCE_PAT.Length)"
if ($env:VSCE_PAT -match '\s') {
    Write-Host "WARNING: PAT contains whitespace (quotes or spaces?)"
}
if ($env:VSCE_PAT.Length -lt 20) {
    Write-Host "WARNING: PAT seems too short"
}
Write-Host "Publisher: $($env:VSCE_PUBLISHER)"
