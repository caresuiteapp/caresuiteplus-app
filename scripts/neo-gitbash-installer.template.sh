#!/usr/bin/env bash
set -Eeuo pipefail
# CareSuite NEO R1. This installer never pushes or deploys.
NEO_REPO_DIR=""
NEO_PREPARE_VOICE=0
NEO_CHECKS=1
NEO_EXTRACT_DIR=""
while (($#)); do
  case "$1" in
    --repo) [[ $# -ge 2 ]] || { echo "Nach --repo fehlt der Projektordner." >&2; exit 2; }; NEO_REPO_DIR="$2"; shift 2 ;;
    --prepare-voice) NEO_PREPARE_VOICE=1; shift ;;
    --no-check) NEO_CHECKS=0; shift ;;
    --extract-only) [[ $# -ge 2 ]] || { echo "Nach --extract-only fehlt der Zielordner." >&2; exit 2; }; NEO_EXTRACT_DIR="$2"; shift 2 ;;
    --help|-h) echo 'CareSuite NEO R1: bash Datei.sh [--repo ORDNER] [--prepare-voice] [--extract-only ORDNER] [--no-check]'; exit 0 ;;
    *) echo "Unbekannte Option: $1. Dieses Paket hat keine Push-/Deploy-Option." >&2; exit 2 ;;
  esac
done
command -v node >/dev/null || { echo "Das vorhandene Node.js ab 20.19.4 ist erforderlich." >&2; exit 1; }
node -e 'const [a,b,c]=process.versions.node.split(".").map(Number);if(a<20||a===20&&(b<19||b===19&&c<4)){console.error("Node.js ab 20.19.4 erforderlich.");process.exit(1)}'
NEO_TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/caresuite-neo.XXXXXX")"
trap 'rm -rf -- "$NEO_TEMP_DIR"' EXIT
trap 'echo "NEO wurde nicht vollständig vorbereitet. Der bisherige Projektordner bleibt unverändert; kein Push und kein Deployment." >&2' ERR
NEO_PAYLOAD_LINE="$(awk '/^__NEO_PAYLOAD_BELOW__$/ {print NR+1;exit}' "$0")"
[[ -n "$NEO_PAYLOAD_LINE" ]] || { echo "Unvollständiges Download-Paket." >&2; exit 1; }
tail -n +"$NEO_PAYLOAD_LINE" "$0" | base64 --decode > "$NEO_TEMP_DIR/payload.tar.gz"
node - "$NEO_TEMP_DIR/payload.tar.gz" <<'NEO_HASH_JS'
const fs=require('fs'),crypto=require('crypto');
if(crypto.createHash('sha256').update(fs.readFileSync(process.argv[2])).digest('hex')!=='__NEO_PAYLOAD_SHA256__')throw Error('Das Download-Paket ist unvollständig oder verändert.');
NEO_HASH_JS
tar -xzf "$NEO_TEMP_DIR/payload.tar.gz" -C "$NEO_TEMP_DIR"
if [[ -n "$NEO_EXTRACT_DIR" ]]; then
  [[ ! -e "$NEO_EXTRACT_DIR" ]] || { echo "Der Entpackordner existiert bereits. Einen neuen Ordner wählen." >&2; exit 1; }
  mkdir -p -- "$NEO_EXTRACT_DIR"
  cp -- "$NEO_TEMP_DIR/neo.patch" "$NEO_TEMP_DIR/NEO_LIESMICH.md" "$NEO_TEMP_DIR/NEO_PRUEFBERICHT.md" "$NEO_TEMP_DIR/NEO_RECHERCHE.md" "$NEO_TEMP_DIR/manifest.json" "$NEO_EXTRACT_DIR/"
  echo "NEO-Code und Unterlagen entpackt: $NEO_EXTRACT_DIR"
  exit 0
fi
command -v git >/dev/null || { echo "Git Bash mit Git ist erforderlich." >&2; exit 1; }
if [[ -z "$NEO_REPO_DIR" ]]; then
  if git rev-parse --show-toplevel >/dev/null 2>&1; then NEO_REPO_DIR="$(git rev-parse --show-toplevel)"; fi
  for NEO_CANDIDATE in "$HOME/caresuiteplus-app" "$HOME/CareSuite/caresuiteplus-app" "$HOME/Documents/GitHub/caresuiteplus-app" "$HOME/.healthos-gitbash/caresuiteplus-app" "$HOME/CareSuite_NEO_Source"; do
    if [[ -z "$NEO_REPO_DIR" ]] && git -C "$NEO_CANDIDATE" rev-parse --show-toplevel >/dev/null 2>&1; then NEO_REPO_DIR="$(git -C "$NEO_CANDIDATE" rev-parse --show-toplevel)"; fi
  done
fi
if [[ -z "$NEO_REPO_DIR" ]]; then
  NEO_REPO_DIR="$HOME/CareSuite_NEO_Source"
  [[ ! -e "$NEO_REPO_DIR" ]] || { echo "Der NEO-Quellordner existiert ohne passendes Repository. Bitte --repo verwenden." >&2; exit 1; }
  echo "Lade den CareSuite-Quellstand für einen getrennten lokalen NEO-Arbeitsstand."
  git clone --no-tags --single-branch --branch main https://github.com/caresuiteapp/caresuiteplus-app.git "$NEO_REPO_DIR"
fi
NEO_REPO_DIR="$(git -C "$NEO_REPO_DIR" rev-parse --show-toplevel)"
[[ -f "$NEO_REPO_DIR/package.json" && -f "$NEO_REPO_DIR/scripts/port-native-workspaces.mjs" ]] || { echo "Dieses Repository ist kein passender CareSuite-Quellstand." >&2; exit 1; }
NEO_STAMP="$(date +%Y%m%d-%H%M%S)-$$"
NEO_BRANCH="neo/r1-$NEO_STAMP"
NEO_WORK_DIR="$(dirname "$NEO_REPO_DIR")/CareSuite_NEO_R1_$NEO_STAMP"
echo "Erstelle den getrennten NEO-Arbeitsstand. Lokale Änderungen bleiben im bisherigen Ordner."
git -C "$NEO_REPO_DIR" worktree add -b "$NEO_BRANCH" "$NEO_WORK_DIR" HEAD
cd "$NEO_WORK_DIR"
if git apply --reverse --check "$NEO_TEMP_DIR/neo.patch" >/dev/null 2>&1; then
  echo "Der NEO-Paketstand ist bereits enthalten."
elif git apply --check "$NEO_TEMP_DIR/neo.patch" >/dev/null 2>&1; then
  git apply --index "$NEO_TEMP_DIR/neo.patch"
else
  echo "Gleiche den NEO-Patch mit dem vorhandenen Quellstand ab."
  if ! git apply --3way --index "$NEO_TEMP_DIR/neo.patch"; then
    echo "Abgleich benötigt eine Konfliktauflösung im neuen Ordner: $NEO_WORK_DIR" >&2
    echo "Der ursprüngliche Ordner wurde nicht verändert. Es wurde nichts veröffentlicht." >&2
    exit 1
  fi
fi
mkdir -p .neo-runtime
cp -- "$NEO_TEMP_DIR/NEO_LIESMICH.md" "$NEO_TEMP_DIR/NEO_PRUEFBERICHT.md" "$NEO_TEMP_DIR/NEO_RECHERCHE.md" "$NEO_TEMP_DIR/manifest.json" .neo-runtime/
node - "$NEO_REPO_DIR" "$NEO_WORK_DIR" <<'NEO_DEPS_JS'
const fs=require('fs'),path=require('path'),[source,target]=process.argv.slice(2);
if(!fs.existsSync(path.join(target,'node_modules'))&&fs.existsSync(path.join(source,'node_modules','typescript','bin','tsc'))&&fs.existsSync(path.join(source,'node_modules','vitest','vitest.mjs'))&&fs.readFileSync(path.join(source,'package-lock.json'),'utf8')===fs.readFileSync(path.join(target,'package-lock.json'),'utf8')){
  try{fs.symlinkSync(path.join(source,'node_modules'),path.join(target,'node_modules'),process.platform==='win32'?'junction':'dir');console.log('Vorhandene Projektabhängigkeiten lokal verbunden.')}catch{}
}
for(const name of ['.env.local','.env']){
  const original=path.join(source,name),destination=path.join(target,name);
  if(fs.existsSync(original)&&!fs.existsSync(destination)){
    const lines=fs.readFileSync(original,'utf8').split(/\r?\n/).filter(line=>/^EXPO_PUBLIC_(?:SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY|APP_EDITION|DEMO_MODE|BUSINESS_ID)=/.test(line));
    if(lines.length)fs.writeFileSync(destination,lines.join('\n')+'\n',{mode:0o600});
  }
}
NEO_DEPS_JS
if [[ ! -f node_modules/typescript/bin/tsc || ! -f node_modules/vitest/vitest.mjs ]]; then npm ci --no-audit --no-fund; fi
if [[ "$NEO_CHECKS" == 1 ]]; then node scripts/verify-neo.mjs; else node scripts/build-neo-service.mjs; echo "Prüfungen auf ausdrücklichen Parameter übersprungen."; fi
if [[ "$NEO_PREPARE_VOICE" == 1 ]]; then
  node - "$NEO_REPO_DIR" <<'NEO_ASSET_CACHE_JS'
const fs=require('fs'),path=require('path'),source=process.argv[2],manifest=JSON.parse(fs.readFileSync('scripts/neo-voice-assets.json','utf8'));
for(const asset of [...manifest.runtime,...manifest.model.parts]){
  const original=path.join(source,'public','neo-voice','v1',asset.file),destination=path.join('public','neo-voice','v1',asset.file);
  if(fs.existsSync(original)&&!fs.existsSync(destination)){fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(original,destination);}
}
NEO_ASSET_CACHE_JS
  node scripts/prepare-neo-voice.mjs
  node scripts/prepare-neo-local.mjs
fi
echo "NEO-Code vorbereitet."
echo "Arbeitsordner: $NEO_WORK_DIR"
echo "Lokaler Branch: $NEO_BRANCH"
echo "Anleitung: $NEO_WORK_DIR/.neo-runtime/NEO_LIESMICH.md"
echo "Quelländerungen prüfen: git diff --cached"
echo "Kein Git-Push, keine produktive Datenbankänderung, kein Vercel-Deploy."
exit 0
__NEO_PAYLOAD_BELOW__
