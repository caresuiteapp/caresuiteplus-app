# Unternehmen: Web-Überarbeitung vom 15.10.2026

Status: Implementiert, noch nicht veröffentlicht. Die gerenderte visuelle Abnahme ist offen.

## Umfang

- Eigene Unternehmensakte auf `/unternehmen`, ohne fremde Dashboard-Abfragen oder die bisherige allgemeine Aktion „Datensatz anlegen“.
- Übersicht, Unternehmensprofil, Recht und Steuer, Abrechnung, Organisation und unternehmensweite Aktivitäten. Bereichssuche, echte Kontaktlinks, Kopieren und gezieltes Aktualisieren.
- Tatsächlich verfügbare Katalogpositionen und konkrete fehlende Angaben statt eines pauschalen Vollständigkeitsprozentsatzes. Eigene Angaben und Kontaktpersonen werden mit durchsucht.
- Neu gestaltete Web-Editoren für Unternehmensdaten, Kontaktpersonen, Vertretung, Konten, Steuer/Register/IK/Aufsicht, Zahlungsbedingungen, Logo und Leistungsbereiche.
- Katalog mit Suche, Preisen, Einheiten, Aktivstatus, Fahrtkostenregeln und gespeicherter Preishistorie.
- Eigene Felder anlegen und bearbeiten, Auswahlmöglichkeiten und Aktivstatus pflegen. Die UI weist darauf hin, dass Felddefinitionen vorhandene Formulare nicht automatisch erweitern.
- Leistungsarten und Budgetvorlagen überarbeitete eigenständige Web-Ziele, getrennte Entwürfe und echte gespeicherte Budgetjahre.
- Bisherige Office-Einstiege führen zur kanonischen Unternehmensseite. Widget, Bild und gespeicherte Widget-Identität bleiben erhalten.

## Speichern und Datenabgrenzung

- Berechtigungen und Mandantenbezug werden vor Änderungen geprüft. Mandanten-/Rollenwechsel verwerfen alte UI-Scopes; verspätete Antworten können keine fremden Entwürfe übernehmen.
- Dialoge schützen ungespeicherte Entwürfe, verhindern doppelte Speicherung und zeigen Lade-, Validierungs- und Speicherfehler.
- Kontaktpersonen werden tatsächlich gespeichert. Bestehende Kontakt-/Vertretungs-/Bank-IDs bleiben erhalten; nur ausdrücklich entfernte IDs werden nach erfolgreichen Schreibvorgängen gelöscht.
- Mehrteilige Speicherung ist weiterhin keine Datenbanktransaktion. Nach bekanntem Teilfehler oder unklarem Netzwerkabbruch bei Listen wird erneutes Speichern gesperrt, bis der gespeicherte Stand bestätigt neu geladen wurde.
- Katalog- und Feld-Wiederholungen verwenden stabile Schlüssel bzw. bestätigte IDs. Erfolgsanzeigen setzen bestätigte Datenbankantworten voraus.
- Administrative Lesevorgänge legen keine Vorlagen an. Keine Migrationen oder Änderungen an produktiven Daten wurden zur Prüfung ausgeführt.
- Native Implementierungen bleiben erhalten; gemeinsame Service-Korrekturen sind auf Web begrenzt. Die zusätzliche Dialogoberfläche ändert den Standard bzw. Android nicht.

## Prüfung

- 229 Tests in 26 Suites: Tenant-Services, Editor-Interaktionen, Unternehmensmodell/-controller, Navigation, Logo und vorhandene Modalverträge – erfolgreich.
- 31 zusätzliche bzw. erneut ausgeführte Tests für CSS-Verträge und Controller nach den Kontrastkorrekturen – erfolgreich. Davon 4 zusätzliche Tests; die übrigen überschneiden sich mit der ersten Runde.
- ESLint für alle geänderten TypeScript-Dateien, anschließend erneut für die zuletzt angepassten Oberflächen – erfolgreich.
- `npm run build:web:production`: erfolgreich, einschließlich vollständiger TypeScript-Prüfung und 291 verpflichtender Release-Tests. Nach der letzten CSS-Korrektur Expo-Webexport erneut erfolgreich erstellt. Abschließende Web-Navigations-, Kalender- und Sprachasset-Prüfungen erfolgreich; öffentliche Brandingseiten wieder erzeugt. Unternehmens-, Leistungsarten- und Budgetrouten sowie die letzten Editor-/Kontraständerungen im Export nachgewiesen.

## Offene visuelle Abnahme

Ein lokaler Prüfharness wurde mit echten React-Komponenten, React Native Web, PlatformModal, GradientModalHeader und GlassSurface gebaut. Er verwendet ausschließlich fiktive Daten und in-memory Speicherfunktionen, mit Breiten 1400/800/390 sowie Schriftgrößen 100/140 Prozent. Er wurde nicht optisch abgenommen: Die Browser-Sicherheitsrichtlinie lehnt den lokalen `file:`-Aufruf ab und verbietet Umgehungswege. Ein DOM-Test und ein erfolgreicher Bundle-Build ersetzen keine gerenderte Layoutprüfung.

Vor Veröffentlichung bleiben daher tatsächliche breite/schmale Ansichten, vergrößerte Schrift, Logo-Dialog und Einbettung im Desktop-Fenster zu prüfen. Es gab keine authentifizierte Produktions-E2E-Prüfung und keine Veröffentlichung.
