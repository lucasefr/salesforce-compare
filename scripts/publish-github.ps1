# Publishes the Salesforce Compare extension to GitHub.
# Prerequisites: GitHub CLI authenticated (`gh auth login`).

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

$repoName = "salesforce-compare"

Write-Host "Checking GitHub authentication..." -ForegroundColor Cyan
gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Run: gh auth login --web --git-protocol https" -ForegroundColor Yellow
    exit 1
}

$userLogin = gh api user -q ".login"
$userId = gh api user -q ".id"
$gitEmail = "$userId+$userLogin@users.noreply.github.com"
$gitName = $userLogin

Write-Host "GitHub user: $userLogin" -ForegroundColor Green

if (-not (git rev-parse --verify HEAD 2>$null)) {
    Write-Host "Creating initial commit..." -ForegroundColor Cyan
    git add -A
    $env:GIT_AUTHOR_NAME = $gitName
    $env:GIT_AUTHOR_EMAIL = $gitEmail
    $env:GIT_COMMITTER_NAME = $gitName
    $env:GIT_COMMITTER_EMAIL = $gitEmail
    git commit -m "Initial commit: Salesforce Compare VS Code extension." -m "Adds Org retrieve-only comparison, sync status decorations, diff with Org, and deploy/retrieve detection."
}

git branch -M main 2>$null

$remoteUrl = git remote get-url origin 2>$null
if (-not $remoteUrl) {
    Write-Host "Creating GitHub repository '$repoName'..." -ForegroundColor Cyan
    gh repo create $repoName --public --source=. --remote=origin --description "VS Code extension to compare Salesforce source files with the connected Org (retrieve-only)."
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Repository creation failed. If the name is taken, edit `$repoName in this script." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push -u origin main

$repoUrl = gh repo view --json url -q ".url"
Write-Host ""
Write-Host "Repository published: $repoUrl" -ForegroundColor Green
