# Tests whether VSCE_PAT is valid for Azure DevOps (does not print the token).
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "load-env.ps1")

if (-not $env:VSCE_PAT) {
    Write-Host "VSCE_PAT is empty."
    exit 1
}

$bytes = [System.Text.Encoding]::ASCII.GetBytes(":$($env:VSCE_PAT)")
$basic = [Convert]::ToBase64String($bytes)
$headers = @{ Authorization = "Basic $basic" }

try {
    $profile = Invoke-RestMethod -Uri "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=6.0" -Headers $headers -Method Get
    Write-Host "PAT valid for Azure DevOps user: $($profile.displayName) ($($profile.emailAddress))"
} catch {
    Write-Host "PAT rejected by Azure DevOps: $($_.Exception.Message)"
    exit 1
}

try {
    $publishers = Invoke-RestMethod -Uri "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/LeftConsult?api-version=3.0-preview.1" -Method Get
    Write-Host "Publisher found: $($publishers.publisherName)"
} catch {
    Write-Host "Could not read publisher (public API): $($_.Exception.Message)"
}
