#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
portal_build_id="${1:-}"
if ! [[ "$portal_build_id" =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]]; then
  echo 'Aufruf: bash scripts/download-portal-update-aab.sh BUILD-ID' >&2
  exit 1
fi
mkdir -p "$HOME/Downloads"
portal_metadata="$HOME/Downloads/CareSuite-${portal_build_id}-build.json"
npx --yes eas-cli@23.2.0 build:view "$portal_build_id" --json > "$portal_metadata"
portal_head=$(git rev-parse HEAD)
portal_download=$(node - "$portal_metadata" "$portal_build_id" "$portal_head" <<'NODE'
const fs = require('fs');
try {
  const build = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (build.status !== 'FINISHED') {
    console.error('Noch kein Download möglich. Buildstatus: ' + build.status + '. Bei einem laufenden Build denselben Befehl später wiederholen.');
    process.exit(2);
  }
  if (build.id !== process.argv[3] || build.platform !== 'ANDROID' || build.buildProfile !== 'portal-only-aab' || build.gitCommitHash !== process.argv[4]) throw new Error('Build passt nicht zum aktuellen Portal-Commit.');
  const url = build.artifacts?.applicationArchiveUrl || build.artifacts?.buildUrl;
  if (!url || new URL(url).protocol !== 'https:' || !new URL(url).pathname.endsWith('.aab')) throw new Error('Kein gültiger AAB-Link vorhanden.');
  if (!/^\d+\.\d+\.\d+$/.test(build.appVersion) || !/^\d+$/.test(String(build.appBuildVersion))) throw new Error('Versionsangaben ungültig.');
  console.log(url);
  console.log(`CareSuite-HealthOS-${build.appVersion}-v${build.appBuildVersion}.aab`);
} catch (error) { console.error(error.message); process.exit(1); }
NODE
)
portal_aab_url=$(printf '%s\n' "$portal_download" | head -1)
portal_aab_name=$(printf '%s\n' "$portal_download" | tail -1)
portal_aab_path="$HOME/Downloads/$portal_aab_name"
curl --fail --location --compressed --retry 3 "$portal_aab_url" --output "$portal_aab_path.part"
mv -- "$portal_aab_path.part" "$portal_aab_path"
sha256sum "$portal_aab_path"
echo "FERTIG: $portal_aab_name liegt in Downloads. Es wurde nichts veröffentlicht."
