# Klientenaufnahme: Erstkontakt, sieben Bereiche und löschbare Entwürfe

## Auftrag und Verhalten

Die Web-/Desktop-Aufnahme bietet einen Erstkontakt mit Nachname und Kontaktweg, optionalem ersten Kalendertermin und späterer vollständiger Aufnahme in derselben Akte. Datum, Versicherung und Unterschriften sind für den Erstkontakt nicht nötig. Der Termin bleibt intern, wird bei wiederholtem Speichern nicht dupliziert und öffnet die zugehörige Aufnahme. Kalenderänderungen werden beim erneuten Speichern nicht überschrieben.

Alle sieben Leistungsbereiche haben eigene Hinweise und Anforderungen. Mehrfachauswahl vereinigt die benötigten Angaben und Verträge. Die drei Assist-Bereiche teilen einen Assist-Vertrag; ambulante Pflege, stationäre Pflege und Beratung ergänzen ihre jeweiligen Verträge zum gemeinsamen Dokumentpaket. Akademie bleibt vorbereitet: Interesse kann gespeichert werden, aktiviert aber weder eine Schulungsfunktion noch einen Schulungsvertrag. Die bestehenden gemeinsamen Vorschau-, Unterschrifts- und Originalprüfungen bleiben erhalten.

Entwürfe lassen sich in der Klientenliste und in der Aufnahme mit Löschberechtigung und ausdrücklicher Rückfrage löschen. Die Datenbank prüft den gesehenen Versionsstand und verhindert das Löschen abgeschlossener Aufnahmen oder gespeicherter Originale. Der zugehörige Ersttermin wird archiviert. Veraltete lokale Kopien können den gelöschten Entwurf nicht wieder anlegen. Bestehende Historie bleibt erhalten.

## Prüfungen vor Veröffentlichung

- Aufnahme-Releaseauswahl: alle 348 Tests in 23 Vitest-Dateien bestanden.
- Lokale PostgreSQL-Vertragsprüfung mit vorhandener PGlite-Abhängigkeit: 30 Tests bestanden, einschließlich Mandantentrennung, Berechtigungen, Versionskonflikten, Löschung während Speicherung, Termin-Idempotenz, Zeitumstellung und atomarem Abschluss aller ausgewählten Verträge.
- Kalender-Releaseauswahl: alle 354 Tests in 31 Dateien bestanden. Der vollständige Kalender-Releasecheck wird zusätzlich im bestehenden Produktionsbuild ausgeführt.
- Gezielte TypeScript-Prüfung aller geänderten Dateien und typisierten Wizard-Verbraucher: 34 Dateien, keine Diagnose. Die vollständige Projektprüfung ist Bestandteil des bestehenden Produktionsbuilds.
- Generiertes Edge-Laufzeitmodul stimmt mit den gemeinsamen Quellen überein; `git diff --check` ohne Befund.
- Keine produktiven Testklienten, Termine oder Unterschriften angelegt oder verändert.

## Grenzen der Prüfung

DOM-Tests mit happy-dom belegen Interaktionen, keine visuelle Layoutfreiheit. Der direkte Browseraufruf der produktiven Aufnahme führt zur Geschäftsanmeldung; keine angemeldete Sitzung für den vollständigen Ablauf verfügbar. Breite/schmale Bildschirmdarstellung und der echte Ablauf mit einer angemeldeten berechtigten Person bleiben separat zu prüfen. Das vorhandene Staging hat die grundlegenden Aufnahme-RPCs nicht installiert und konnte deshalb nicht für diesen Ablauf verwendet werden. Es wurde keine neue Testinfrastruktur eingerichtet.

## Veröffentlichung

Reihenfolge: Migration `20261021034849_client_intake_first_contact.sql`, aktualisierte Funktion `complete-client-intake` mit unverändert aktivierter JWT-Prüfung, danach Web-Deployment. Die Änderungen verwenden eine optionale Workflowversion 2. Bestehende Formulare ohne diese Version behalten ihre bisherige Vertragsauswahl; die Android-Oberfläche wird nicht umgestellt.

Nach der Migration Funktionsdefinitionen, Rechte und Trigger ausschließlich lesend prüfen und den Sicherheitsadvisor mit dem vorherigen Zustand vergleichen. Nach dem Git-Deployment den Status des Hauptprojekts `caresuiteplus-app` und die tatsächlich ausgelieferten Webdateien prüfen. Ein erfolgreicher Build ersetzt die oben offen benannte angemeldete Sicht- und Ablaufprüfung nicht.

### Backend-Verifikation am 21.10.2026

Die Migration wurde mit Version `20261021034849` angewendet; der Dateiname entspricht dem tatsächlichen Eintrag der Migrationshistorie. Die drei neuen öffentlichen RPCs prüfen internen Akteur, Mandant und jeweilige Berechtigungen. `anon` besitzt kein Ausführungsrecht; Abschlussfunktion und privater Kalendertrigger sind auch für `authenticated` nicht direkt ausführbar. Alle geprüften Funktionen verwenden `search_path=pg_catalog`, der Kalendertrigger ist aktiv.

`complete-client-intake` wurde als aktive Version 2 veröffentlicht. JWT-Prüfung bleibt aktiv. Alle drei zurückgelesenen Dateien entsprechen exakt den lokalen Dateien; Laufzeit-SHA256: `968e1c5e7743e6f933b93c4f7cc0c1e8de30da7660c563a52029a669c89f8d22`.

Der Sicherheitsadvisor meldet gegenüber dem Ausgangsstand ausschließlich die drei beabsichtigt für angemeldete Rollen erreichbaren neuen `SECURITY DEFINER`-RPCs. Ihre internen Prüfungen sind durch die genannten Datenbanktests abgedeckt. Die vorhandenen übrigen Meldungen blieben unverändert. [Beschreibung des Advisor-Hinweises](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
