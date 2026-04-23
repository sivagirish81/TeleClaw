#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

required_fields=(
  id
  title
  kind
  description
  required_inputs
  optional_inputs
  access
  execution
  output
  redaction
)

status=0
found_any=0

while IFS= read -r file; do
  found_any=1
  echo "Validating $file"

  case "$file" in
    *.example.yaml|*.example.yml) ;;
    *)
      echo "ERROR: runbook file must use .example.yaml/.example.yml: $file"
      status=1
      continue
      ;;
  esac

  for field in "${required_fields[@]}"; do
    if ! grep -Eq "^${field}:" "$file"; then
      echo "ERROR: missing required field '${field}' in $file"
      status=1
    fi
  done

  if ! grep -Eq '^\s*mode:\s*read_only\s*$' "$file"; then
    echo "ERROR: access.mode must be read_only in $file"
    status=1
  fi
done < <(find runbooks -type f \( -name "*.example.yaml" -o -name "*.example.yml" \) | sort)

if [[ $found_any -eq 0 ]]; then
  echo "No runbook examples found under runbooks/."
  exit 1
fi

tracked_non_example="$(git ls-files 'runbooks/**/*.yaml' 'runbooks/**/*.yml' | grep -Ev '\.example\.ya?ml$' || true)"
if [[ -n "$tracked_non_example" ]]; then
  echo "ERROR: tracked non-example runbook files detected:"
  echo "$tracked_non_example"
  status=1
fi

exit $status
