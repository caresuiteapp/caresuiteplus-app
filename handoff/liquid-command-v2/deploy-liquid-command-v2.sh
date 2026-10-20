#!/usr/bin/env bash
set -euo pipefail

repo_path="${1:-}"

if [[ -z "$repo_path" || ! -d "$repo_path/.git" ]]; then
  echo "Verwendung: bash deploy-liquid-command-v2.sh <repo-pfad>" >&2
  exit 2
fi

if [[ -n "$(git -C "$repo_path" status --porcelain)" ]]; then
  echo "Der Arbeitsbaum ist nicht sauber. Push abgebrochen." >&2
  exit 3
fi

(
  cd "$repo_path"
  npm run liquid-command:audit
  npx vitest run src/__tests__/liquidCommand/liquidCommandFoundation.test.ts
  npx expo export --platform web
)

current_branch="$(git -C "$repo_path" branch --show-current)"
git -C "$repo_path" push origin "$current_branch"
echo "Geprüfter Branch gepusht: $current_branch"
