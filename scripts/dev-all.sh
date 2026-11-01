#!/usr/bin/env bash
# Starts the whole stack locally: database, migrations, API, worker and web.
# Ctrl+C stops api/worker/web (the database container keeps running; `pnpm db:down` stops it).
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

API_PORT="${API_PORT:-3002}"
WEB_PORT="${WEB_PORT:-3000}"

export PORT="$API_PORT"
export WEB_ORIGIN="http://localhost:${WEB_PORT}"
export NEXT_PUBLIC_API_URL="http://localhost:${API_PORT}"

pnpm db:up
pnpm --filter api db:migrate

pids=()
cleanup() {
  trap - INT TERM EXIT
  for pid in "${pids[@]}"; do kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

run() {
  setsid "$@" &
  pids+=("$!")
}

run pnpm --filter api dev:api
run pnpm --filter api dev:worker
run pnpm --filter web exec next dev -p "$WEB_PORT"

echo "web: http://localhost:${WEB_PORT}  api: http://localhost:${API_PORT}"
wait -n
