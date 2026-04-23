#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

created=0
skipped=0

while IFS= read -r src; do
  case "$src" in
    *.example.yaml) dest="${src%.example.yaml}.yaml" ;;
    *.example.yml) dest="${src%.example.yml}.yml" ;;
    *.example) dest="${src%.example}" ;;
    *) continue ;;
  esac

  if [[ -e "$dest" ]]; then
    echo "SKIP    $dest (already exists)"
    skipped=$((skipped + 1))
  else
    cp "$src" "$dest"
    echo "CREATE  $dest <- $src"
    created=$((created + 1))
  fi
done < <(find . -type f \( -name "*.example" -o -name "*.example.yaml" -o -name "*.example.yml" \) | sort)

echo "Completed: created=$created skipped=$skipped"
