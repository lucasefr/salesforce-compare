# Loads KEY=VALUE pairs from a .env file into the current process environment.
# Usage: . .\scripts\load-env.ps1 -EnvFilePath ".env"

param(
    [string]$EnvFilePath = (Join-Path (Split-Path -Parent $PSScriptRoot) ".env")
)

function Import-DotEnvFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Env file not found: $Path. Copy .env.example to .env and set VSCE_PAT."
    }

    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) {
            return
        }

        $eq = $line.IndexOf('=')
        if ($eq -lt 1) {
            return
        }

        $name = $line.Substring(0, $eq).Trim()
        $value = $line.Substring($eq + 1).Trim()

        if ($value.Length -ge 2) {
            if ($value.StartsWith('"') -and $value.EndsWith('"')) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            elseif ($value.StartsWith("'") -and $value.EndsWith("'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        $value = $value.Trim()

        Set-Item -Path "Env:$name" -Value $value
    }
}

Import-DotEnvFile -Path $EnvFilePath
