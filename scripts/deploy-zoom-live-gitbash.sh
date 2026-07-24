#!/usr/bin/env bash
set -Eeuo pipefail

# CareSuite HealthOS — Zoom Live Deployment
# Ausführen in Git Bash im Repository:
#   bash scripts/deploy-zoom-live-gitbash.sh

PROJECT_REF="${SUPABASE_PROJECT_REF:-euagyyztvmemuaiumvxm}"
PUBLIC_URL="${CARESUITE_PUBLIC_URL:-https://caresuiteplus.app}"
YES_MODE=false
SKIP_SECRETS=false
SKIP_FRONTEND=false

for arg in "$@"; do
  case "$arg" in
    --yes) YES_MODE=true ;;
    --skip-secrets) SKIP_SECRETS=true ;;
    --skip-frontend) SKIP_FRONTEND=true ;;
    --project-ref=*) PROJECT_REF="${arg#*=}" ;;
    --public-url=*) PUBLIC_URL="${arg#*=}" ;;
    *)
      echo "Unbekannte Option: $arg" >&2
      exit 2
      ;;
  esac
done

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT_DIR" ]]; then
  echo "Fehler: Das Skript muss in einem CareSuite-Git-Repository ausgeführt werden." >&2
  exit 1
fi
cd "$ROOT_DIR"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Fehler: '$1' ist nicht installiert oder nicht im PATH." >&2
    exit 1
  fi
}

require_command git
require_command node
require_command npm
require_command openssl

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Fehler: Das Repository enthält lokale Änderungen. Bitte zuerst committen oder sichern." >&2
  git status --short
  exit 1
fi

echo "CareSuite Zoom Live Deployment"
echo "Repository: $ROOT_DIR"
echo "Branch: $(git branch --show-current)"
echo "Commit: $(git rev-parse --short HEAD)"
echo "Supabase-Projekt: $PROJECT_REF"
echo "Öffentliche CareSuite-URL: $PUBLIC_URL"

if [[ "$SKIP_SECRETS" == false ]]; then
  echo
  echo "Zoom Marketplace-Zugangsdaten werden verdeckt abgefragt und direkt als Supabase-Secrets gespeichert."
  read -r -p "ZOOM_CLIENT_ID: " ZOOM_CLIENT_ID
  read -r -s -p "ZOOM_CLIENT_SECRET: " ZOOM_CLIENT_SECRET
  echo
  read -r -p "ZOOM_MEETING_SDK_KEY: " ZOOM_MEETING_SDK_KEY
  read -r -s -p "ZOOM_MEETING_SDK_SECRET: " ZOOM_MEETING_SDK_SECRET
  echo
  read -r -s -p "ZOOM_WEBHOOK_SECRET_TOKEN: " ZOOM_WEBHOOK_SECRET_TOKEN
  echo

  if [[ -z "$ZOOM_CLIENT_ID" || -z "$ZOOM_CLIENT_SECRET" || -z "$ZOOM_MEETING_SDK_KEY" || -z "$ZOOM_MEETING_SDK_SECRET" || -z "$ZOOM_WEBHOOK_SECRET_TOKEN" ]]; then
    echo "Fehler: Alle Zoom-Zugangsdaten sind erforderlich." >&2
    exit 1
  fi

  ZOOM_REDIRECT_URI="https://${PROJECT_REF}.supabase.co/functions/v1/zoom-auth"
  ZOOM_TOKEN_ENCRYPTION_KEY="$(openssl rand -base64 32 | tr -d '\r\n')"
  ZOOM_OAUTH_SCOPES="${ZOOM_OAUTH_SCOPES:-meeting:read meeting:write user:read recording:read}"

  npx supabase secrets set --project-ref "$PROJECT_REF" \
    "ZOOM_CLIENT_ID=$ZOOM_CLIENT_ID" \
    "ZOOM_CLIENT_SECRET=$ZOOM_CLIENT_SECRET" \
    "ZOOM_REDIRECT_URI=$ZOOM_REDIRECT_URI" \
    "ZOOM_TOKEN_ENCRYPTION_KEY=$ZOOM_TOKEN_ENCRYPTION_KEY" \
    "ZOOM_MEETING_SDK_KEY=$ZOOM_MEETING_SDK_KEY" \
    "ZOOM_MEETING_SDK_SECRET=$ZOOM_MEETING_SDK_SECRET" \
    "ZOOM_WEBHOOK_SECRET_TOKEN=$ZOOM_WEBHOOK_SECRET_TOKEN" \
    "ZOOM_OAUTH_SCOPES=$ZOOM_OAUTH_SCOPES" \
    "ZOOM_RETURN_ORIGINS=$PUBLIC_URL" \
    "CARESUITE_PUBLIC_URL=$PUBLIC_URL"

  unset ZOOM_CLIENT_ID ZOOM_CLIENT_SECRET ZOOM_MEETING_SDK_KEY
  unset ZOOM_MEETING_SDK_SECRET ZOOM_WEBHOOK_SECRET_TOKEN ZOOM_TOKEN_ENCRYPTION_KEY
fi

echo
echo "1/6 Abhängigkeiten installieren"
npm ci --legacy-peer-deps

echo
echo "2/6 Zoom-Regressionsprüfungen"
npx vitest run \
  src/__tests__/connect/zoomIntegration.test.ts \
  src/__tests__/connect/googleWorkspaceIntegration.test.ts \
  --no-file-parallelism

echo
echo "3/6 Supabase-Projekt verknüpfen und ausstehende Migrationen prüfen"
npx supabase link --project-ref "$PROJECT_REF"
npx supabase db push --linked --dry-run

if [[ "$YES_MODE" == false ]]; then
  echo
  read -r -p "Die oben aufgeführten Migrationen jetzt produktiv anwenden? [ja/NEIN] " APPLY_DB
  if [[ "$APPLY_DB" != "ja" ]]; then
    echo "Abbruch vor Datenbankänderung. Es wurde nichts an der Datenbank oder am Frontend deployt." >&2
    exit 1
  fi
fi
npx supabase db push --linked

echo
echo "4/6 Getrennte Zoom Edge Functions deployen"
npx supabase functions deploy zoom-auth --project-ref "$PROJECT_REF" --no-verify-jwt
npx supabase functions deploy zoom-api --project-ref "$PROJECT_REF"
npx supabase functions deploy zoom-webhook --project-ref "$PROJECT_REF" --no-verify-jwt

echo
echo "5/6 Produktionsfähigen Web-Export erstellen"
npx expo export --platform web --output-dir dist

if [[ "$SKIP_FRONTEND" == false ]]; then
  echo
  echo "6/6 CareSuite Web produktiv über Vercel deployen"
  npx vercel --prod --yes
else
  echo
  echo "6/6 Frontend-Deploy wurde mit --skip-frontend übersprungen."
fi

echo
echo "Zoom Live Deployment abgeschlossen."
echo "OAuth Redirect URL: https://${PROJECT_REF}.supabase.co/functions/v1/zoom-auth"
echo "Webhook Endpoint: https://${PROJECT_REF}.supabase.co/functions/v1/zoom-webhook"
echo "CareSuite Bereich: ${PUBLIC_URL%/}/business/connect/zoom"
echo
echo "Zoom Marketplace: Redirect URL und Webhook Endpoint exakt wie oben eintragen."
