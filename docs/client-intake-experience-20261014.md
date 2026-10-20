# Geführte Klientenaufnahme im Web

Ausgangsstand: `0a8e199` / PR #82. Die Rückmeldung vom 14.10.2026 betrifft das Aufnahmefenster, dessen leerer erster Schritt bereits 100 % Fortschritt und die Aktivierungsaktion zeigte.

## Oberfläche und Bedienung

- Web-spezifisches Aufnahmefenster mit gegliederter Navigation, einer räumlichen Aktenvorschau und erklärten Leistungskarten. Die Vorschau verwendet ausschließlich die aktuellen Eingaben. Die vorbereitete Schulungsauswahl behauptet keine Freischaltung.
- Persönliche Angaben, Erreichbarkeit, Versorgung, Finanzierung und Wohnungszugang sind in passende Feldgruppen gegliedert. Bestehende Eingabekomponenten und Speicherfelder bleiben erhalten. Textvorschläge ergänzen geeignete Freitextfelder.
- Der Web-Ablauf verwendet sämtliche Abschnitte, die auch der Abschlussdienst validiert. Später eintreffende Abschnittsvorgaben können dadurch keine erforderlichen Angaben verstecken oder den geöffneten Abschnitt verschieben. Der bisherige Standardpfad anderer Oberflächen bleibt erhalten.
- Fortschritt beruht auf besuchten und aktuell gültigen Abschnitten. Ohne Leistungswahl startet er bei 0 %. Vor dem tatsächlichen Abschluss wird kein vollständiger Abschluss angezeigt.
- Die abschließende Übersicht zeigt lesbare Angaben, Korrekturwege, fehlende Pflichtangaben und den tatsächlichen Stand der Unterlagen. Dateinamen gelten nicht als hochgeladene Dateien; Vorlagen erhalten keine ersatzweise Demo-Akten-ID.
- Der Schließen-Dialog ist mit X, Escape und der Fußleiste verbunden. Fehlgeschlagenes Speichern schließt nicht automatisch. Bewusstes Schließen ohne erneute Sicherung bleibt nach deutlichem Hinweis möglich. Ein neuer Entwurf wird erst nach Bestätigung und erfolgreichem lokalem Zurücksetzen begonnen.
- Scrollbereiche, erreichbare Aktionen bei geringer Fensterhöhe, vergrößerte Schrift und reduzierte Bewegung sind im Layout berücksichtigt. Native Oberflächen werden nicht ersetzt.

## Historischer Stand vor der Nachbesserung

Der aktuelle `submitClientIntake()`-Service sperrt produktive Neuaufnahmen, weil der verifizierte atomare Abschluss von Originaldokumenten, Unterschriften und Aufnahme nicht angebunden ist. Die SQL-Datei `docs/workflow-server-intake-completion-draft.sql` ist ein Review-Entwurf, keine produktiv angebundene Migration. Auch der notwendige vertrauenswürdige Vorbereitungsdienst fehlt.

Die Web-Oberfläche erklärt diese Grenze bereits zu Beginn und bietet im Produktivmodus die Entwurfsicherung an. Sie umgeht weder den Service noch die Dokumentensperren. Der vollständige Entwurf liegt auf dem verwendeten Gerät; die vorhandene Serversicherung schreibt Kernfelder. Signierte oder finale Unterlagen können derzeit nur lokal erhalten werden. Ein lokales Zurücksetzen löscht keinen bereits auf dem Server angelegten Aufnahmeentwurf.

Es wurden keine Datenbankänderungen, produktiven Testaufnahmen, Uploads oder Unterschriften ausgeführt.

## Frühere Prüfung

115 Tests in zehn Suiten erfolgreich; ESLint für alle 13 geänderten TypeScript-Dateien und vollständige TypeScript-Prüfung ohne Befund. Die vorhandenen und neuen Verhaltenstests prüfen die Formularbedienung, Navigation, Berechtigungen, Identitätswechsel sowie Entwurfs-, Schließen- und Fehlerzustände. Sie verwenden gemockte Dienste und belegen keine produktive Persistenz.

Eine tatsächliche optische Abnahme im angemeldeten Browser ist weiterhin offen. Die vorhandene Browser-Vorschau verlangt eine Anmeldung; lokale Browser-Software steht nicht zur Verfügung. DOM-Tests und CSS-Prüfung belegen keine berechnete Browserdarstellung.

## Nachbesserung nach optischer Abnahme

Der Nutzer hat die Oberfläche optisch abgenommen und die Behebung der offenen Funktionen beauftragt. Das bestehende Design bleibt erhalten. Der Aufnahmeabschluss wird durch einen authentifizierten serverseitigen Dienst und eine atomare Datenbanktransaktion ersetzt. Vollständige Entwürfe einschließlich Dokumentstand liegen revisionsgesichert auf dem Server; lokale Kopien bleiben zur Wiederherstellung erhalten. Listen und Akte bieten berechtigten Mitarbeitenden „Aufnahme fortsetzen“ für genau den gewählten Entwurf.

Gleichzeitige Änderungen werden erkannt. Die ausdrücklich ausgelöste Übernahme aktueller Aktenangaben erhält den vollständigen Entwurf und ältere Dokumentoriginale. Originale und Unterschriften werden beim bloßen Öffnen einer Akte nicht mehr automatisch nachgeschrieben. Vor dem Abschluss werden Dokumentinhalt, verwendete Vorlagen, Unterzeichnende und PNG-Unterschriften geprüft; Wiederholungen nach einer verlorenen Antwort erzeugen keine zweite Aufnahme. Der Abschluss schreibt die bestehenden Fachprojektionen, Budgetzuordnungen und nachvollziehbare Belege zusammen mit der Aktivierung.

Es werden keine Portalzugänge, Einladungen oder Testklienten erzeugt. Vorhandene Bestandsakten behalten ihre Statusabläufe. Android-Binärdateien werden nicht veröffentlicht.

### Nachweis und verbleibende Grenze

Vor einem Neustart der lokalen Arbeitsumgebung bestanden 289 Verhaltenstests in 17 Suiten, die vollständige TypeScript-Prüfung, ESLint für die betroffenen Dateien und 22 SQL-Vertragstests. Der SQL-Test verwendete ausschließlich gelesene Produktions-Schemametadaten und isolierte lokale Testdaten. Nach dem Neustart wurden kritische Quelldateien bytegenau anhand bereits gesicherter Git-Blobs wiederhergestellt; einige kleinere Dateien wurden aus den dokumentierten Änderungen rekonstruiert. Die bestehende Web-Buildpipeline führt deshalb die Prüfungen vor einer Veröffentlichung erneut aus.

Die Staging-Edge-Function weist nicht authentifizierte Anfragen mit HTTP 401 ab. Die SQL-Migration konnte in Staging wegen fehlender bestehender Produktionsvoraussetzungen (unter anderem care_level und interne Berechtigungsfunktionen) nicht angewandt werden; die Transaktion wurde vollständig zurückgerollt. Dieser Versuch ist kein erfolgreicher Ende-zu-Ende-Nachweis. Ein echter angemeldeter HTTP-Durchlauf mit anschließendem Lesen aller Daten bleibt offen. Produktive Testdatensätze werden dafür nicht angelegt. Veröffentlichungsstatus und tatsächliche Migrationsversion werden gesondert dokumentiert.


## Freigabestand der technischen Nachbesserung

Nach Wiederherstellung der exakt bestehenden Projektabhängigkeiten aus dem lokalen Cache bestanden erneut **291 Tests in 17 Suiten**, die vollständige TypeScript-Prüfung, ESLint für 42 Dateien, der gemeinsame Edge/App-Prüfcode-Abgleich und **22 SQL-Vertragstests**. Es wurde keine zusätzliche Software und keine neue Testinfrastruktur eingeführt. Die bestehenden Prüfungen sind zusätzlich vor den vorhandenen Web-Build geschaltet.

Die geprüfte SQL-Fassung wurde auf Produktion als `20261014225620_client_intake_server_completion_v1` erfolgreich angewandt. Die Datei liegt unter `supabase/migrations/20261014225620_client_intake_server_completion_v1.sql`; SHA-256 `8732a4de6e61b52a6499c860ee75c0388904db7b6312035a7b19b524774dd539`. Der Dienst `complete-client-intake` ist dort ACTIVE, Version 1, mit JWT-Prüfung. Ein POST ohne Anmeldung wurde mit HTTP 401 abgewiesen.

Die anschließend direkt abgefragten Produktionsrechte entsprechen dem vorgesehenen Modell: Drei Entwurfs-RPCs sind nur für angemeldete Benutzer ausführbar und prüfen intern Mandant, Identität und aktuelle Verwaltungsrechte. Die Abschluss-RPC ist ausschließlich für service_role ausführbar. Alle fünf neuen Tabellen haben RLS; anon und authenticated haben keine direkten Tabellenrechte. Der private Namensraum ist gesperrt. Der Advisor meldet dafür erwartete Hinweise: fünf Tabellen ohne direkte RLS-Freigabepolicies und drei bewusst authentifiziert erreichbare SECURITY-DEFINER-RPCs. Bestehende unabhängige Hinweise wurden durch diesen Auftrag nicht pauschal behoben.

Der Web-Quellstand hat den bestehenden Vercel-Previewbuild für das Hauptprojekt caresuiteplus-app bestanden. Die Web-Veröffentlichung erfolgt über main; den konkreten Abschluss dokumentiert Pull Request #84. Die bekannte Grenze bleibt unverändert: kein echter angemeldeter HTTP-Ende-zu-Ende-Durchlauf, keine produktiven Testklienten. Die optische Abnahme stammt ausdrücklich vom Nutzer.

Einordnung der erwarteten Advisor-Hinweise: [RLS ohne direkte Freigabepolicy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [authentifiziert erreichbare SECURITY-DEFINER-Funktionen](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
