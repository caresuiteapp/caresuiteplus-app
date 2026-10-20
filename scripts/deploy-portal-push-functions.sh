#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
trap 'echo "Serverinstallation angehalten. Bitte die Fehlermeldung darüber prüfen." >&2' ERR
echo 'Voraussetzung: Migrationen 20260906160000, 20261002132149 und 20261002134559 wurden im Projekt euagyyztvmemuaiumvxm erfolgreich ausgeführt.'
echo 'Installiert ausschließlich die drei Funktionen dieses Portal-Updates.'
for portal_function in portal-push-dispatch portal-push-register office-push-send; do
  npx --yes supabase@2.116.0 functions deploy "$portal_function" --project-ref euagyyztvmemuaiumvxm --use-api
done
echo 'Funktionen installiert. Produktive Aktivierung erst nach ausdrücklicher Zustimmung zum dokumentierten Freigabevorschlag.'
echo 'Freigabevorschlag: docs/store/releases/20261002-automatic-push-activation-review.md'
echo 'Danach aktiviert scripts/sql/enable_portal_push_dispatch.sql den Dienst im SQL-Editor.'
echo 'Erst die Aktivierung startet den automatischen Versand an registrierte Geräte.'
