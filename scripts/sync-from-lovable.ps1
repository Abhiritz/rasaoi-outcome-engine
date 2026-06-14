# MIG-001 — Sync personal Supabase after pulling Lovable changes from GitHub
# Usage: .\scripts\sync-from-lovable.ps1 [-SkipPull] [-DeployAll]

param(
  [switch]$SkipPull,
  [switch]$DeployAll
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "`n=== Rasaoi upstream sync (MIG-001) ===" -ForegroundColor Cyan

if (-not $SkipPull) {
  Write-Host "`n[1/5] git pull origin main" -ForegroundColor Yellow
  git fetch origin
  git pull origin main
}

Write-Host "`n[2/5] Checking supabase/migrations for new files..." -ForegroundColor Yellow
$migrations = Get-ChildItem "supabase\migrations\*.sql" -ErrorAction SilentlyContinue
Write-Host "  Found $($migrations.Count) migration file(s)."

Write-Host "`n[3/5] supabase db diff --linked (safety check)" -ForegroundColor Yellow
npx supabase db diff --linked 2>&1

Write-Host "`n[4/5] supabase db push" -ForegroundColor Yellow
npx supabase db push

Write-Host "`n[5/5] Deploy edge functions" -ForegroundColor Yellow
if ($DeployAll) {
  npm run supabase:deploy:all
} else {
  Write-Host "  Skipping deploy (pass -DeployAll to run npm run supabase:deploy:all)" -ForegroundColor DarkGray
  Write-Host "  Or deploy manually: npx supabase functions deploy parse-intent --no-verify-jwt"
}

Write-Host "`n=== Sync complete. Run: npm run dev ===" -ForegroundColor Green
