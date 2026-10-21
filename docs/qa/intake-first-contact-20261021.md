# Klientenaufnahme: Erstkontakt, sieben Bereiche und löschbare Entwürfe

## Auftrag und Verhalten

Die Web-/Desktop-Aufnahme bietet einen Erstkontakt mit Nachname und Kontaktweg, optionalem ersten Kalendertermin und späterer vollständiger Aufnahme in derselben Akte. Datum, Versicherung und Unterschriften sind für den Erstkontakt nicht nötig. Der Termin bleibt intern, wird bei wiederholtem Speichern nicht dupliziert und öffnet die zugehörige Aufnahme. Kalenderänderungen werden beim erneuten Speichern nicht überschrieben.

Alle sieben Leistungsbereiche haben eigene Hinweise und Anforderungen. Mehrfachauswahl vereinigt die benötigten Angaben und Verträge. Die drei Assist-Bereiche teilen einen Assist-Vertrag; ambulante Pflege, stationäre Pflege und Beratung ergänzen ihre jeweiligen Verträge zum gemeinsamen Dokumentpaket. Akademie bleibt vorbereitet: Interesse kann gespeichert werden, aktiviert aber weder eine Schulungsfunktion noch einen Schulungsvertrag. Die bestehenden gemeinsamen Vorschau-, Unterschrifts- und Originalprüfungen bleiben erhalten.

Entwürfe lassen sich in der Klientenliste und in der Aufnahme mit Löschberechtigung und ausdrücklicher Rückfrage löschen. Die Datenbank prüft den gesehenen Versionsstand und verhindert das Löschen abgeschlossener Aufnahmen oder gespeicherter Originale. Der zugehörige Ersttermin wird archiviert. Veraltete lokale Kopien können den gelöschten Entwurf nicht wieder anlegen. Bestehende Historie bleibt erhalten.

## Prüfungen vor Veröffentlichung

- Aufnahme-Releaseauswahl: 23 Vitest-Dateien, 347 Tests bestanden; nach der abschließenden Berechtigungskorrektur umfasst sie 348 Tests. Die betroffene Datei wurde mit 24 bestandenen Tests erneut geprüft.
- Lokale PostgreSQL-Vertragsprüfung mit vorhandener PGlite-Abhängigkeit: 30 Tests bestanden, einschließlich Mandantentrennung, Berechtigungen, Versionskonflikten, Löschung während Speicherung, Termin-Idempotenz, Zeitumstellung und atomarem Abschluss aller ausgewählten Verträge.
- Kalender-Releaseauswahl: 31 Dateien; nach Korrektur der abwärtskompatiblen Archivierungsargumente besteht auch die betroffene Dialogprüfung (19 Tests). Der vollständige Kalender-Releasecheck wird zusätzlich im bestehenden Produktionsbuild ausgeführt.
- Gezielte TypeScript-Prüfung aller geänderten Dateien und typisierten Wizard-Verbraucher: 34 Dateien, keine Diagnose. Die vollständige Projektprüfung ist Bestandteil des bestehenden Produktionsbuilds.
- Generiertes Edge-Laufzeitmodul stimmt mit den gemeinsamen Quellen überein; `git diff --check` ohne Befund.
- Keine produktiven Testklienten, Termine oder Unterschriften angelegt oder verändert.

## Grenzen der Prüfung

DOM-Tests mit happy-dom belegen Interaktionen, keine visuelle Layoutfreiheit. Der direkte Browseraufruf der produktiven Aufnahme führt zur Geschäftsanmeldung; keine angemeldete Sitzung für den vollständigen Ablauf verfügbar. Breite/schmale Bildschirmdarstellung und der echte Ablauf mit einer angemeldeten berechtigten Person bleiben separat zu prüfen. Das vorhandene Staging hat die grundlegenden Aufnahme-RPCs nicht installiert und konnte deshalb nicht für diesen Ablauf verwendet werden. Es wurde keine neue Testinfrastruktur eingerichtet.

## Veröffentlichung

Reihenfolge: Migration `20261021060000_client_intake_first_contact.sql`, aktualisierte Funktion `complete-client-intake` mit unverändert aktivierter JWT-Prüfung, danach Web-Deployment. Die Änderungen verwenden eine optionale Workflowversion 2. Bestehende Formulare ohne diese Version behalten ihre bisherige Vertragsauswahl; die Android-Oberfläche wird nicht umgestellt.

Nach der Migration Funktionsdefinitionen, Rechte und Trigger ausschließlich lesend prüfen und den Sicherheitsadvisor mit dem vorherigen Zustand vergleichen. Nach dem Git-Deployment den Status des Hauptprojekts `caresuiteplus-app` und die tatsächlich ausgelieferten Webdateien prüfen. Ein erfolgreicher Build ersetzt die oben offen benannte angemeldete Sicht- und Ablaufprüfung nicht.
