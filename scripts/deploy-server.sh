#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Build shared..."
cd "$ROOT/shared"
npm run build

echo "==> Build server..."
cd "$ROOT/server"
npm run build

echo "==> Restart pm2..."
pm2 restart sync-claude-usage

echo "==> Deploy concluído."
