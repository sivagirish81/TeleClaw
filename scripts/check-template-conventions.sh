#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

status=0

# 1) No tracked real runbooks/configs where .example is required.
tracked_bad="$(git ls-files | grep -E '(^|/)(runbooks/.+\.(ya?ml)|broker/configs/.+\.(ya?ml)|teleport/configs/.+\.(ya?ml)|\.env)$' | grep -Ev '\.example\.ya?ml$|\.env\.example$' || true)"
if [[ -n "$tracked_bad" ]]; then
  echo "ERROR: tracked real config/runbook files found:"
  echo "$tracked_bad"
  status=1
fi

# 2) Any runbook committed without .example should fail.
tracked_runbooks="$(git ls-files 'runbooks/**/*.yaml' 'runbooks/**/*.yml' || true)"
if [[ -n "$tracked_runbooks" ]]; then
  bad_runbooks="$(echo "$tracked_runbooks" | grep -Ev '\.example\.ya?ml$' || true)"
  if [[ -n "$bad_runbooks" ]]; then
    echo "ERROR: runbooks must be committed as .example files:"
    echo "$bad_runbooks"
    status=1
  fi
fi

# 3) .gitignore rule sanity checks for local variants.
check_ignored() {
  local path="$1"
  if ! git check-ignore -q --no-index "$path"; then
    echo "ERROR: expected ignored by .gitignore -> $path"
    status=1
  fi
}

check_not_ignored() {
  local path="$1"
  if git check-ignore -q --no-index "$path"; then
    echo "ERROR: expected trackable example file -> $path"
    status=1
  fi
}

check_ignored ".env"
check_ignored "runbooks/ssh/host_diagnose.yaml"
check_not_ignored "runbooks/ssh/host_diagnose.example.yaml"
check_ignored "broker/configs/broker.yaml"
check_not_ignored "broker/configs/broker.example.yaml"
check_ignored "teleport/configs/tbot.yaml"
check_not_ignored "teleport/configs/tbot.example.yaml"
check_ignored ".openclaw/state.json"
check_ignored ".tsh/profile"

exit $status
