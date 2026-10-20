#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
repo='caresuiteapp/caresuiteplus-app'
workflow='android-aab.yml'
url="https://github.com/$repo/actions/workflows/$workflow"

if ! command -v gh >/dev/null 2>&1; then
  echo "Den AAB ab jetzt auf GitHub starten: $url"
  echo 'Dort Run workflow anklicken und den aktuellen veröffentlichten Branch auswählen.'
  echo 'Einrichtung und Download: GITHUB-ACTIONS.md. Es wurde noch kein Build gestartet.'
  exit 1
fi
gh auth status --hostname github.com
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Bitte lokale Änderungen zuerst prüfen und committen. GitHub baut nur veröffentlichte Commits.' >&2
  exit 1
fi
branch="$(git symbolic-ref --quiet --short HEAD)" || {
  echo 'Bitte zuerst den zu bauenden Branch auschecken.' >&2
  exit 1
}
local_sha="$(git rev-parse HEAD)"
remote_sha="$(gh api "repos/$repo/git/ref/heads/$branch" --jq '.object.sha')" || {
  echo "Branch fehlt auf GitHub. Zuerst diesen geprüften Branch nach $repo pushen." >&2
  exit 1
}
if [[ "$local_sha" != "$remote_sha" ]]; then
  echo 'Lokaler Commit und GitHub-Branch unterscheiden sich. Bitte zuerst sicher synchronisieren.' >&2
  exit 1
fi
gh workflow run "$workflow" --repo "$repo" --ref "$branch"
echo "GitHub-Build angefordert für $branch ($local_sha)."
echo "Fortschritt und AAB-Download: $url"
