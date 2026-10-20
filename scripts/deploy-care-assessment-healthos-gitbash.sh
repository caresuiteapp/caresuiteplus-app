#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
SKIP=false
VERIFY=false
APPLY=false
PUSH=false
VERCEL=false
YES=false
for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP=true ;;
    --verify-db) VERIFY=true ;;
    --apply-db) APPLY=true ;;
    --push) PUSH=true ;;
    --vercel-production) VERCEL=true ;;
    --yes) YES=true ;;
    --help|-h)
      echo "Optionen: --skip-install --verify-db --apply-db --push --vercel-production --yes"
      exit 0 ;;
    *) echo "Unbekannte Option: $arg" >&2; exit 2 ;;
  esac
done
if [[ "$APPLY" == true || "$PUSH" == true || "$VERCEL" == true ]]; then
  [[ "$YES" == true ]] || { echo "Schreibende Schritte benötigen --yes." >&2; exit 1; }
  [[ -z "$(git status --porcelain)" ]] || { echo "Arbeitsbaum muss sauber sein." >&2; exit 1; }
fi
echo "Branch: $(git branch --show-current)"
echo "Commit: $(git rev-parse --short HEAD)"
[[ "$SKIP" == true ]] || npm ci
git diff --check
npm run care-assessment:audit
npx vitest run src/__tests__/pflege/careAssessmentHealthOS.test.ts
EXPO_PUBLIC_DEMO_MODE=false EXPO_NO_TELEMETRY=1 CI=1 \
  NODE_OPTIONS=--max-old-space-size=4096 \
  npx expo export --platform web --output-dir dist-care-assessment --clear
if [[ "$VERIFY" == true ]]; then
  npx supabase migration list --linked
  echo "Nur lesende Datenbankprüfung abgeschlossen."
fi
if [[ "$APPLY" == true ]]; then
  npx supabase migration list --linked
  npx supabase db push --linked
fi
if [[ "$PUSH" == true ]]; then git push --set-upstream origin "$(git branch --show-current)"; fi
if [[ "$VERCEL" == true ]]; then npx vercel deploy --prod --yes; fi
echo "SIS / Assessment HealthOS abgeschlossen."
