# Tests Marketplace API authorization for the configured publisher.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "load-env.ps1")

$publisher = if ($env:VSCE_PUBLISHER) { $env:VSCE_PUBLISHER } else { "LeftConsult" }
$basic = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes(":$($env:VSCE_PAT)"))
$headers = @{ Authorization = "Basic $basic" }

$uri = "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/$publisher/extensions?api-version=7.1-preview.1"
try {
    $response = Invoke-WebRequest -Uri $uri -Headers $headers -UseBasicParsing
    Write-Host "Marketplace API status: $($response.StatusCode)"
    $preview = $response.Content.Substring(0, [Math]::Min(800, $response.Content.Length))
    Write-Host $preview
} catch {
    Write-Host "Marketplace API error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        if ($body.Length -gt 0) {
            Write-Host $body.Substring(0, [Math]::Min(800, $body.Length))
        }
    }
    exit 1
}
