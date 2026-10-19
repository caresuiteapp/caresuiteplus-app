# Office-Kataloge: Web-Überarbeitung

Stand: 19.10.2026. Der Auftrag betrifft Web/Desktop; native Katalogbildschirme bleiben unverändert.

## Verhalten

- `/office/catalogs`: kompakte helle Übersicht, Suche auch nach enthaltenen Leistungen, Statusfilter, Sortierung, Karten-/Tabellenansicht und sichtbare Aktualisierung.
- Detail: Suche nach Bezeichnung, Kürzel, Beschreibung und Einheit; Kategorie-/Statusfilter; direkte Positionsbearbeitung; aktive und inaktive Positionen bleiben nachvollziehbar.
- Anlegen verwendet `tenant_service_catalog` und denselben Editor wie Unternehmen/Leistungen. Keine separaten Legacy-Kataloge, automatisch angelegten Beispieldaten oder erfundenen Nutzungszahlen.
- Alte Web-Links zum ungespeicherten Workflow-Prototyp und zur statischen Portalvorschau führen zur Katalogübersicht.
- Geldbeträge werden deutsch als Nettopreise, Prozentzuschläge als Prozent angezeigt. Null Euro ist ein gültiger Preis. Fehlende, zukünftige und abgelaufene Preise sind getrennt erkennbar. Gültigkeit einschließlich Start-/Endtag nach Europe/Berlin.
- Der Positionseditor bewahrt und bearbeitet den Gültigkeitszeitraum des Standardpreises. Änderungen ersetzen den gespeicherten Standardpreis; frühere Werte bleiben in der Preishistorie. Es wird keine automatische Tarifwechselplanung behauptet. Mehrdeutige Standardpreise blockieren die Bearbeitung, statt zufällig einen Preis zu ändern.
- Nicht freigegebene Fachmodule bleiben gesperrt. Lesen erfordert Katalogfreigabe, Office-/Fachmodulzugang und unbeschränkten Unternehmenszugriff. Schreiben erfordert die effektive Unternehmensverwaltungsberechtigung; die bestehenden serverseitigen Regeln gelten weiter.
- Mandanten-/Profilwechsel verwerfen alte Abfrageergebnisse. Nach Aktualisierungsfehlern bleibt der letzte geladene Stand ausdrücklich als solcher sichtbar.

## Korrektur der Mitarbeitendenauswahl

Die Empfängerauswahl der internen Weitergabe wurde durch die Differenz zwischen der vorhandenen älteren Nachrichtenfreigabe `messages.can_create` und dem neuen Schlüssel `communication.send_message` blockiert. Die inkrementelle Korrektur liegt in `scripts/sql/office-internal-notes-access.sql`.

Die Prüfung bleibt auf interne Notizen begrenzt. Aktive Identität, Office-Zugriff, Mandanten-/Bereichsgrenzen und ausdrücklich entzogene Versandberechtigungen bleiben erhalten. Kein produktiver Testversand erfolgt.

Die SQL-Korrektur wurde am 19.10.2026 auf `caresuiteplus-production` als Migration `20261019014202_office_internal_notes_access` angewendet. Die archivierte Migration entspricht dem geprüften SQL-Skript. Bestehende Migrationen bleiben unverändert.

## Verifikation

Die vorhandene `verify:company:release`-Prüfung enthält die neuen Katalogmodell-, Service- und Interaktionstests sowie die erweiterten Editor-/Persistenztests. `verify:office-notes:release` enthält den Empfänger-Servicetest und 20 isolierte PostgreSQL-Szenarien einschließlich der inkrementellen Berechtigungskorrektur. Die Produktionsbuild-Kette führt TypeScript und beide Prüfungen aus.

Lokal bestanden: 13 direkte Modellprüfungen mit vorhandenem Node, JavaScript-Syntaxprüfung der Prüfskripte, Diff-Prüfung und 670 Web-Routenmuster. Vitest, TypeScript, Expo und PGlite sind in dieser Sitzung lokal nicht installiert; keine zusätzliche Installation vorgenommen. Der Vercel-Hauptbuild für `d34442e` wurde am 19.10.2026 um 01:33 UTC erfolgreich abgeschlossen. Der Security-Advisor zeigt nach der Datenbankkorrektur keine neuen Befunde gegenüber dem unmittelbar vorher erhobenen Stand.

Produktiv lesend geprüft: exakte Funktionskörper, Sicherheitsmodus, fester Suchpfad und Ausführungsrechte aller fünf betroffenen Funktionen stimmen mit dem geprüften Stand überein. Kein Identitätswechsel und kein Testversand wurden verwendet.

Offen: tatsächliche Sichtprüfung in breitem und schmalem angemeldetem Desktopfenster sowie ein authentifizierter Ablauf mit vorgesehenen Testkonten. DOM-Interaktionstests gelten nicht als visuelle Abnahme. Produktive Daten wurden für die Prüfung nicht verändert.
