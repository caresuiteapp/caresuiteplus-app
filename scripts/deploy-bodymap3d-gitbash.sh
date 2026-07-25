#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATION_FILE="supabase/migrations/20260725083000_bodymap_3d_medical.sql"
TEST_FILES=(
  "src/__tests__/pflege/bodyMap3dDomain.test.ts"
  "src/__tests__/pflege/bodyMapMedicalMeshPipeline.test.ts"
  "src/__tests__/pflege/bodyMapAdultMaleReferenceMesh.test.ts"
  "src/__tests__/pflege/bodyMapAdultFemaleReferenceMesh.test.ts"
  "src/__tests__/pflege/bodyMapAgeReferenceMeshes.test.ts"
  "src/__tests__/pflege/bodyMapGlbInspector.test.ts"
  "src/__tests__/pflege/bodyMapMeshWorkbench.test.ts"
  "src/__tests__/pflege/bodyMap3dViewerContract.test.ts"
  "src/__tests__/pflege/bodyMap3dPersistence.test.ts"
  "src/__tests__/pflege/bodyMapClinicalService.test.ts"
  "src/__tests__/pflege/bodyMapLive.test.ts"
  "src/__tests__/pflege/bodyMapVisualQa.test.ts"
)

SKIP_INSTALL=false
PUSH_BRANCH=false
VERCEL_PRODUCTION=false
CONFIRMED=false

usage() {
  printf '%s\n' \
    "CareSuite 3D-Bodymap – Git-Bash Build und Deployment" \
    "" \
    "Aufruf:" \
    "  bash scripts/deploy-bodymap3d-gitbash.sh [Optionen]" \
    "" \
    "Ohne Optionen: reproduzierbarer Preflight + Web-Export nach dist-bodymap3d." \
    "" \
    "Optionen:" \
    "  --skip-install       npm ci überspringen" \
    "  --verify-db          Bodymap-Migrationsstand nur lesend anzeigen" \
    "  --push               aktuellen Git-Branch zu origin pushen" \
    "  --vercel-production  dist als Vercel-Produktionsdeployment veröffentlichen" \
    "  --yes                notwendige Bestätigung für schreibende Optionen" \
    "  --help               diese Hilfe anzeigen" \
    "" \
    "Beispiel nur Build:" \
    "  bash scripts/deploy-bodymap3d-gitbash.sh --skip-install" \
    "" \
    "Beispiel nach manuellem Review:" \
    "  bash scripts/deploy-bodymap3d-gitbash.sh --verify-db --push --yes"
}

VERIFY_DB=false
for argument in "$@"; do
  case "${argument}" in
    --skip-install) SKIP_INSTALL=true ;;
    --verify-db) VERIFY_DB=true ;;
    --push) PUSH_BRANCH=true ;;
    --vercel-production) VERCEL_PRODUCTION=true ;;
    --yes) CONFIRMED=true ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'Unbekannte Option: %s\n\n' "${argument}" >&2
      usage >&2
      exit 2
      ;;
  esac
done

cd "${REPO_ROOT}"

if [[ ! -d .git ]]; then
  printf 'Fehler: Kein Git-Repository unter %s\n' "${REPO_ROOT}" >&2
  exit 1
fi
if [[ ! -f "${MIGRATION_FILE}" ]]; then
  printf 'Fehler: Bodymap-Migration fehlt: %s\n' "${MIGRATION_FILE}" >&2
  exit 1
fi
if { [[ "${PUSH_BRANCH}" == true ]] || [[ "${VERCEL_PRODUCTION}" == true ]]; } \
  && [[ "${CONFIRMED}" != true ]]; then
  printf 'Abbruch: --push und --vercel-production benötigen --yes.\n' >&2
  exit 1
fi

BRANCH="$(git branch --show-current)"
COMMIT="$(git rev-parse --short HEAD)"
printf 'Repository: %s\nBranch: %s\nCommit: %s\n' "${REPO_ROOT}" "${BRANCH}" "${COMMIT}"

if [[ -n "$(git status --porcelain)" ]]; then
  printf 'Hinweis: Der Arbeitsbaum enthält nicht eingecheckte Änderungen.\n'
  if [[ "${PUSH_BRANCH}" == true ]] || [[ "${VERCEL_PRODUCTION}" == true ]]; then
    printf 'Abbruch: Push/Produktionsdeploy nur aus einem sauberen Arbeitsbaum.\n' >&2
    exit 1
  fi
fi

if [[ "${SKIP_INSTALL}" != true ]]; then
  npm ci
fi

git diff --check
npm run bodymap3d:mesh:calibration
npm run bodymap3d:mesh:verify-portable
npm run bodymap3d:mesh:verify-female-portable
npm run bodymap3d:mesh:verify-age-portable
npm run bodymap3d:audit
npx vitest run "${TEST_FILES[@]}"

export EXPO_PUBLIC_DEMO_MODE=false
export EXPO_PUBLIC_BODYMAP_MESH_WORKBENCH=true
export EXPO_PUBLIC_BODYMAP_VISUAL_QA=true
export EXPO_NO_TELEMETRY=1
export CI=1
NODE_OPTIONS=--max-old-space-size=4096 \
  npx expo export --platform web --output-dir dist-bodymap3d --clear

if [[ "${BODYMAP_RUN_HEADLESS_QA:-false}" == true ]]; then
  npm run bodymap3d:mesh:capture-workbench -- \
    --build=dist-bodymap3d \
    --variant=body-erwachsener-maennlich
fi

printf '\nPreflight und Web-Export erfolgreich: dist-bodymap3d\n'

if [[ "${VERIFY_DB}" == true ]]; then
  printf '\nSupabase-Migrationsstand (nur lesend):\n'
  npx supabase migration list --linked
  printf '\nEs wurden keine Supabase-Migrationen verändert.\n'
fi

if [[ "${PUSH_BRANCH}" == true ]]; then
  git push --set-upstream origin "${BRANCH}"
fi

if [[ "${VERCEL_PRODUCTION}" == true ]]; then
  npx vercel deploy --prod --yes
fi

printf '\nBodymap-3D-Ablauf abgeschlossen.\n'
