#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
trap 'echo "AAB-Schritt angehalten. Die Meldung darüber enthält die Ursache. Git Bash bleibt geöffnet." >&2' ERR
git diff --quiet && git diff --cached --quiet || {
  echo 'Bitte Änderungen zuerst sichern/committen; der Build soll einem eindeutigen Commit entsprechen.' >&2
  exit 1
}
if test -n "$(git ls-files --others --exclude-standard)"; then
  echo 'Nicht versionierte Dateien vorhanden. Vor dem Build prüfen und sichern oder außerhalb des Projektordners ablegen.' >&2
  git ls-files --others --exclude-standard
  exit 1
fi
git merge-base --is-ancestor 5dbcecbb55ce43812867db6d73b9d7089b6af364 HEAD
echo 'Portal-Update: lokale Prüfung'
npm run typecheck
npm run audit:portal-update
echo 'Android-Paket inklusive aller sechs lokalen Intro-Videos (Version 1.3) prüfen.'
npm run portal-only:export
npm run portal-only:export:audit
echo 'Produktiver Android-AAB; keine Einreichung bei Google Play.'
git --no-pager log -1 --format='%h %s'
npx --yes eas-cli@23.2.0 build --platform android --profile portal-only-aab --non-interactive --no-wait
echo 'Der Auftrag läuft auf EAS weiter. Die oben angezeigte Build-ID zum Prüfen/Herunterladen verwenden.'
