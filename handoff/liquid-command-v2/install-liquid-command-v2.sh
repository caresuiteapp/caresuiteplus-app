#!/usr/bin/env bash
set -euo pipefail

repo_path="${1:-}"
bundle_path="${2:-./caresuite-liquid-command-masterspec-v2-20260727.bundle}"
source_branch="feat/liquid-command-masterspec-v2-20260727"

if [[ -z "$repo_path" ]]; then
  echo "Verwendung: bash install-liquid-command-v2.sh <repo-pfad> [bundle-pfad]" >&2
  exit 2
fi

if [[ ! -d "$repo_path/.git" ]]; then
  echo "Kein Git-Repository: $repo_path" >&2
  exit 2
fi

if [[ ! -f "$bundle_path" ]]; then
  echo "Bundle nicht gefunden: $bundle_path" >&2
  exit 2
fi

if [[ -n "$(git -C "$repo_path" status --porcelain)" ]]; then
  echo "Der Arbeitsbaum ist nicht sauber. Änderungen zuerst committen oder stashen." >&2
  exit 3
fi

current_branch="$(git -C "$repo_path" branch --show-current)"
if [[ -z "$current_branch" ]]; then
  echo "Bitte zuerst einen lokalen Arbeitsbranch auschecken." >&2
  exit 3
fi

backup_branch="backup/pre-liquid-command-v2-$(date +%Y%m%d-%H%M%S)"
git -C "$repo_path" branch "$backup_branch" HEAD

git -C "$repo_path" fetch "$bundle_path" \
  "refs/heads/$source_branch:refs/remotes/liquid-command/v2"
liquid_commit="$(git -C "$repo_path" rev-parse refs/remotes/liquid-command/v2)"

echo "Backup: $backup_branch"
echo "Übernehme Liquid Command $liquid_commit auf $current_branch"
git -C "$repo_path" cherry-pick "$liquid_commit"

(
  cd "$repo_path"
  npm ci
  npm run liquid-command:audit
  npx vitest run src/__tests__/liquidCommand/liquidCommandFoundation.test.ts
  npx expo export --platform web
)

echo "Liquid Command V2 wurde übernommen und geprüft."
