# Plattform: Wartung, Firmenregistrierung und Hinweise verbinden

Die bisherige Meldung in der Systemübersicht beschrieb eine echte Lücke: Einstellungen wurden gespeichert, aber von den betroffenen Abläufen nicht ausgewertet. Diese Änderung verbindet die drei Betriebseinstellungen mit Website, Websoftware und dem Registrierungsdienst. Die zuvor freigegebene Live-Erfassung bleibt enthalten. CareSuite bleibt kostenlos.

## Tatsächliche Wirkung

| Einstellung | Wirkung |
| --- | --- |
| Wartungsmodus | Website und Websoftware zeigen eine Wartungsansicht und sperren die dahinterliegenden Bedienelemente. Die bestehende Anmeldung und bereits dargestellte Formularinhalte werden nicht automatisch gelöscht. Neue Firmenregistrierungen werden zusätzlich auf dem Server verweigert. |
| Firmenregistrierung | Eine Pause verhindert neue Registrierungen im Webablauf und beim direkten Aufruf des Registrierungsdienstes, bevor ein Unternehmen, Konto oder Mailvorgang angelegt wird. Bestehende Unternehmenszugänge werden dadurch nicht deaktiviert. |
| Plattformhinweis | Ein leerer Wert blendet den Hinweis aus. Ein Text mit höchstens 2.000 Zeichen erscheint auf Website und Websoftware als normaler Text; HTML wird nicht ausgeführt. |

Die Plattformverwaltung einschließlich ihrer Anmeldung, Hilfe, rechtliche Informationen und Passwortwiederherstellung bleiben bei Wartung erreichbar. Geöffnete, sichtbare Webfenster prüfen den aktuellen Stand alle 30 Sekunden und beim erneuten Aktivieren des Fensters. Ein fehlgeschlagener erneuter Abruf hebt eine zuvor bestätigte Sperre nicht auf. Bei einer unbekannten Verfügbarkeit bleibt die Firmenregistrierung gesperrt; bestehende Webzugänge werden nach einer fehlgeschlagenen ersten Statusabfrage weiter angeboten.

Eine vorgesehene Wartung oder Registrierungspause wird im Registrierungsablauf erklärt und nicht als unerwarteter Serverfehler gezählt. Andere tatsächliche Registrierungsfehler werden weiterhin erfasst.

Der vorhandene Registrierungsschalter wurde unter seinem bisherigen Datenbankschlüssel erhalten und in der Oberfläche als „Firmenregistrierung“ benannt. Es wurde kein zweiter konkurrierender Schalter angelegt. „Ja“ und „Nein“ ersetzen technische Wahrheitswerte in der Auswahl. Ein neuer, leerer Plattformhinweis ist jetzt vorhanden und mit Begründung bearbeitbar. Schreibrechte und Änderungsprotokoll bleiben durch die vorhandene Plattformberechtigung geschützt.

## Produktiver Serverstand

- Datenbankänderung `20261007172746_platform_runtime_controls` angewendet.
- Erfassungs-/Statusfunktion Version 2 und Registrierungsdienst Version 22 aktiv.
- Unverändert bestätigt: Wartungsmodus aus, Firmenregistrierung freigegeben, Plattformhinweis leer.
- Der Versanddienst Version 4 bleibt unverändert. Bestehende Empfängerprüfung, Versandkennung und Versanddateien wurden exakt übernommen.
- Öffentliche Statusantwort liefert ausschließlich Versionskennung, Wartungsstatus, Registrierungsfreigabe und Hinweistext. Sie enthält keine Akten, Konten, Passwörter, privaten Einstellungen oder Besuchskennungen.
- Die begrenzte Datenbankabfrage ist ausschließlich für die Dienstrolle freigegeben, prüft diese Rolle zusätzlich und hat eine leere Namensauflösung. Direkte Tabellenrechte wurden nicht erweitert; öffentliche und normal angemeldete Benutzer können diese Datenbankfunktion nicht aufrufen.

Die Webveröffentlichung bleibt erforderlich, damit die bisherigen öffentlichen Seiten und die Websoftware die neue Anbindung verwenden. Das Veröffentlichungspaket prüft beide tatsächlichen öffentlichen Hilfsdateien, deren Einbindung sowie die neue Websoftware. Es bestätigt nicht bereits aufgrund einer erfolgreichen Erstellung die Live-Wirkung.

## Prüfung und Grenzen

Die zusätzlichen Prüfungen führen die tatsächlichen TypeScript-Dienste und die beiden Server-Einstiegspunkte mit ersetzten Netzwerk- und Kontoanlagegrenzen aus. Geprüft werden unter anderem Wartung, Registrierungspause, unbestätigte Konfiguration, unveränderter freigegebener Registrierungsablauf, Geheimnisfreiheit, wörtliche Hinweistexte und Wiederfreigabe. Die öffentlichen Seiten wurden in einem DOM-Verhaltensmodell geprüft; dieses Modell berechnet kein Layout und ist keine optische Freigabe.

Die Datenbankprüfung nutzte ausschließlich neue temporäre Tabellen und eine temporäre Kopie der begrenzten Abfrage. Sie bestätigte Wartungs- und Registrierungswerte, den Hinweistext, drei verweigerte ungültige Werte und eine Rollenverweigerung. Anschließend wurden alle temporären Prüfobjekte zurückgerollt. Die tatsächliche produktive Abfrage wurde separat mit der Dienstrolle ausgeführt. Anonyme direkte Aufrufe werden mit HTTP 401 und Datenbankcode 42501 verweigert. Ungültige Registrierungs- und Erfassungsanfragen bleiben HTTP 400. Keine Kundenakte geändert, kein echtes Konto für die Prüfung angelegt und keine Testmail versandt.

Alle bereitgestellten Funktionsdateien wurden exakt zurückgelesen: vier Status-/Erfassungsdateien und zehn Registrierungsdateien. Sicherheitsprüfungen zeigen dieselben bisherigen Hinweiszahlen: 27 Tabellen mit Zeilenschutz ohne Richtlinie, acht veränderliche Namensauflösungen, 95 öffentlich und 280 angemeldet ausführbare Funktionen mit erhöhten Rechten sowie ein Hinweis zur Passwortschutzkonfiguration. Diese bestehenden Hinweise wurden durch die Änderung nicht als behoben behauptet.

Die Wartung ist eine Zugangssperre für die aktuellen Weboberflächen. Sie widerruft keine bestehenden Anmeldetoken und schaltet nicht sämtliche Datenbank- und Hintergrundschnittstellen ab. Bereits laufende Vorgänge werden nicht automatisch rückgängig gemacht. Die Android-Oberfläche wird nicht geändert; die serverseitige Firmenregistrierungsfreigabe gilt für alle Aufrufe dieses Registrierungsdienstes. Allgemeine Funktionsfreigaben und Website-Inhaltsverwaltung sind separate offene Punkte.

Eine vollständige lokale Web-Erstellung sowie die angemeldete optische Prüfung in breiten und schmalen Fenstern konnten ohne die fehlenden Projektabhängigkeiten und Browserumgebung hier nicht ausgeführt werden. Es wird nichts nachinstalliert. Die vier vorhandenen Web-Erstellungen bleiben vor der Veröffentlichung verpflichtend.

Bestehende Sicherheitshinweise: [Zeilenschutz ohne Richtlinien](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [veränderliche Namensauflösung](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [öffentlich ausführbare Funktionen mit erhöhten Rechten](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [angemeldet ausführbare Funktionen mit erhöhten Rechten](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
