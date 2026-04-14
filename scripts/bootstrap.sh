#!/usr/bin/env bash
# Bootstrap TokenTracker: start services, install deps, run migrations
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Starting Docker services (Postgres, OTel Collector)..."
docker compose up -d

echo "==> Waiting for Postgres..."
until docker compose exec -T postgres pg_isready -U tokentracker > /dev/null 2>&1; do
  sleep 1
done
echo "    Postgres ready."

echo "==> Installing Node dependencies..."
npm install

echo "==> Running migrations..."
npm run migrate

echo ""
echo "=== TokenTracker ready ==="
echo ""
echo "  Dashboard:       http://localhost:3046"
echo "  OTel gRPC:       localhost:4317"
echo "  OTel HTTP:       localhost:4318"
echo "  Postgres:        localhost:5433"
echo ""
echo "  Start dashboard: npm run dev"
echo ""
echo "  Configure Claude Code telemetry:"
echo "    export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318"
echo ""
