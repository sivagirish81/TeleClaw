#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TEST_DIR="tmp/test-copy-examples"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
trap 'rm -rf "$TEST_DIR"' EXIT

cat > "$TEST_DIR/sample.env.example" <<'SAMPLE'
HELLO=world
SAMPLE

cat > "$TEST_DIR/runbook.example.yaml" <<'SAMPLE'
id: test.runbook
SAMPLE

./scripts/copy-examples.sh >/tmp/teleclaw-copy-examples-test.log

[[ -f "$TEST_DIR/sample.env" ]] || { echo "expected copied sample.env"; exit 1; }
[[ -f "$TEST_DIR/runbook.yaml" ]] || { echo "expected copied runbook.yaml"; exit 1; }

# Verify existing files are not overwritten.
echo "LOCAL=keep" > "$TEST_DIR/sample.env"
./scripts/copy-examples.sh >/tmp/teleclaw-copy-examples-test-2.log
if ! grep -q "LOCAL=keep" "$TEST_DIR/sample.env"; then
  echo "expected sample.env to remain unchanged"
  exit 1
fi

echo "copy-examples test passed"
