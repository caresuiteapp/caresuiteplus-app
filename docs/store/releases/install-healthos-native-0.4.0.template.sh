#!/usr/bin/env bash
set -Eeuo pipefail

# This template is completed with the exact commit and bundle hash when the
# release ZIP is produced. It imports into a separate worktree, never resets
# or cleans the user's existing checkout, and never publishes to Google Play.
caresuite_release_sha='@@RELEASE_SHA@@'
caresuite_base_sha='e07d24024f6c9e340d9e826c6ee4d3f021a96a6f'
caresuite_release_branch='release/android-0.4.0-20261009'
caresuite_bundle_sha='@@BUNDLE_SHA256@@'
caresuite_package_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
caresuite_bundle="$caresuite_package_dir/CareSuiteHealthOS-0.4.0.bundle"
caresuite_verify_only=false

caresuite_fail() { printf 'ABGEBROCHEN: %s\n' "$1" >&2; exit 1; }
if [[ ${1:-} == --verify-only ]]; then caresuite_verify_only=true; shift; fi
if [[ ${1:-} == --help || $# -gt 1 ]]; then
  printf 'Aufruf: bash %s [--verify-only] "/Pfad/zu/caresuiteplus-app"\n' "$(basename -- "$0")"
  exit 0
fi
[[ $caresuite_release_sha =~ ^[a-f0-9]{40}$ && $caresuite_bundle_sha =~ ^[a-f0-9]{64}$ ]] || caresuite_fail 'Der Installer wurde noch nicht für einen festen Release erzeugt.'
command -v git >/dev/null || caresuite_fail 'Git ist in dieser Shell nicht verfügbar.'
command -v sha256sum >/dev/null || caresuite_fail 'sha256sum ist in dieser Shell nicht verfügbar. Die vorhandene Git-Bash-Shell verwenden.'
[[ -f $caresuite_bundle ]] || caresuite_fail 'Die Bundle-Datei fehlt neben dem Installer. Das gesamte ZIP entpacken.'
caresuite_actual_sha="$(sha256sum -- "$caresuite_bundle")"
[[ ${caresuite_actual_sha%% *} == "$caresuite_bundle_sha" ]] || caresuite_fail 'Die Bundle-Prüfsumme stimmt nicht mit diesem Release überein.'
caresuite_repo="$(git -C "${1:-.}" rev-parse --show-toplevel 2>/dev/null)" || caresuite_fail 'Kein vorhandenes CareSuite-Git-Projekt an diesem Pfad.'
caresuite_origin="$(git -C "$caresuite_repo" remote get-url origin)" || caresuite_fail 'Der Git-Remote origin fehlt.'
case "${caresuite_origin%/}" in
  https://github.com/caresuiteapp/caresuiteplus-app|https://github.com/caresuiteapp/caresuiteplus-app.git|git@github.com:caresuiteapp/caresuiteplus-app|git@github.com:caresuiteapp/caresuiteplus-app.git|ssh://git@github.com/caresuiteapp/caresuiteplus-app|ssh://git@github.com/caresuiteapp/caresuiteplus-app.git) ;;
  *) caresuite_fail 'origin verweist nicht auf das bestätigte CareSuite-Projekt.' ;;
esac

if [[ $caresuite_verify_only == false ]]; then
  git -C "$caresuite_repo" fetch --no-tags origin main
fi
caresuite_main="$(git -C "$caresuite_repo" rev-parse --verify refs/remotes/origin/main 2>/dev/null)" || caresuite_fail 'Der geprüfte Hauptzweig fehlt. origin/main zuerst abrufen.'
[[ $caresuite_main == "$caresuite_base_sha" ]] || caresuite_fail 'Seit dem geprüften Stand gibt es weitere Hauptzweig-Änderungen. Vor dem App-Build muss dieser Release damit abgeglichen werden.'
git -C "$caresuite_repo" cat-file -e "$caresuite_base_sha^{commit}" || caresuite_fail 'Die gemeinsame Basis fehlt.'
git -C "$caresuite_repo" bundle verify "$caresuite_bundle"
git -C "$caresuite_repo" fetch --no-tags "$caresuite_bundle" "refs/heads/$caresuite_release_branch"
caresuite_imported="$(git -C "$caresuite_repo" rev-parse FETCH_HEAD)"
[[ $caresuite_imported == "$caresuite_release_sha" ]] || caresuite_fail 'Der importierte Commit entspricht nicht dem geprüften Release.'
if git -C "$caresuite_repo" show-ref --verify --quiet "refs/heads/$caresuite_release_branch"; then
  [[ $(git -C "$caresuite_repo" rev-parse "refs/heads/$caresuite_release_branch") == "$caresuite_release_sha" ]] || caresuite_fail 'Ein anderer lokaler Stand liegt bereits auf dem Releasezweig. Er wird nicht überschrieben.'
else
  git -C "$caresuite_repo" branch "$caresuite_release_branch" "$caresuite_release_sha"
fi

caresuite_worktree="$(dirname -- "$caresuite_repo")/caresuite-healthos-0.4.0-${caresuite_release_sha:0:8}"
if [[ -e $caresuite_worktree ]]; then
  [[ $(git -C "$caresuite_worktree" rev-parse HEAD 2>/dev/null) == "$caresuite_release_sha" ]] || caresuite_fail 'Der separate Releaseordner enthält einen anderen Stand.'
  [[ -z $(git -C "$caresuite_worktree" status --porcelain) ]] || caresuite_fail 'Im separaten Releaseordner liegen eigene Änderungen. Sie werden nicht überschrieben.'
else
  git -C "$caresuite_repo" -c core.hooksPath=/dev/null worktree add --detach "$caresuite_worktree" "$caresuite_release_sha"
fi
printf '\nGeprüfter nativer Release: %s\nSeparates Arbeitsverzeichnis: %s\n' "$caresuite_release_sha" "$caresuite_worktree"

if [[ $caresuite_verify_only == true ]]; then
  printf 'Lokaler Import geprüft. Kein Remote-Abruf, Push oder Build gestartet.\n'
  exit 0
fi
git -C "$caresuite_repo" push origin "$caresuite_release_sha:refs/heads/$caresuite_release_branch"
printf '\nReleasezweig auf GitHub vorhanden. Build-Status und AAB:\nhttps://github.com/caresuiteapp/caresuiteplus-app/actions/workflows/android-aab.yml\n'
printf 'Der Build benötigt das bestehende EXPO_TOKEN-Repository-Secret und die bisherige Expo-Uploadsignierung. Es wird kein neuer Schlüssel erzeugt.\n'
printf 'Nach erfolgreichem Build das AAB-Artefakt herunterladen und zuerst auf echten Geräten und im internen Play-Test prüfen. Eine Play-Veröffentlichung wird nicht automatisch ausgelöst.\n'
