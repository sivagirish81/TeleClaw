#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[bootstrap] preparing TeleClaw dev environment"

if command -v go >/dev/null 2>&1; then
  echo "[bootstrap] go mod tidy"
  (cd "$ROOT_DIR/broker" && go mod tidy)
else
  echo "[bootstrap] warning: go not found"
fi

if command -v npm >/dev/null 2>&1; then
  echo "[bootstrap] npm install for plugin"
  (cd "$ROOT_DIR/openclaw-plugin" && npm install)
else
  echo "[bootstrap] warning: npm not found"
fi

echo "[bootstrap] done"
