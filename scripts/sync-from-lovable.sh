#!/usr/bin/env bash
# MIG-001 — Sync personal Supabase after pulling Lovable changes from GitHub
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "=== Rasaoi upstream sync (MIG-001) ==="

echo ""
echo "[1/5] git pull origin main"
git fetch origin
git pull origin main

echo ""
echo "[2/5] Migration files in supabase/migrations/"
ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l | xargs echo "  count:"

echo ""
echo "[3/5] supabase db diff --linked (safety check)"
npx supabase db diff --linked || true

echo ""
echo "[4/5] supabase db push"
npx supabase db push

echo ""
echo "[5/5] Deploy edge functions"
if [[ "${DEPLOY_ALL:-}" == "1" ]]; then
  npm run supabase:deploy:all
else
  echo "  Set DEPLOY_ALL=1 to run npm run supabase:deploy:all"
fi

echo ""
echo "=== Sync complete. Run: npm run dev ==="
