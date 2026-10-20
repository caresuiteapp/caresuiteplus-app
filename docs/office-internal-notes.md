# Interne Aufgaben und Notizen

## Bedienung

In Office → Notizen öffnet „Intern weitergeben“ eine bearbeitbare Kopie der ausgewählten Notiz. Der Absender wählt Art, Priorität, Empfänger und bei Bedarf eine Frist. Erst die anschließende Vorschau enthält die Aktion „Jetzt intern senden“. Persönliche Originalnotizen werden weder geteilt noch automatisch gespeichert oder verändert. Handschrift wird nicht übermittelt; die Oberfläche weist darauf hin. Einträge können unter „Weitergegeben“ auch ohne vorhandene persönliche Notiz erstellt werden.

Mögliche Arten: Notiz, Aufgabe, Gesprächsnotiz, Rückrufbitte, Wunsch / Anliegen. Höchstens 25 Mitarbeitende mit aktivem, eindeutig verknüpftem Mitarbeiterportalzugang können dieselbe Übermittlung erhalten. Alle erhalten jeweils einen eigenen Bearbeitungsstand.

Im Mitarbeiterportal Web führt „Aufgaben & Notizen“ zum persönlichen Eingang. Mitarbeitende öffnen einen Eintrag, bestätigen ihn als gelesen und speichern den Status offen, in Bearbeitung oder erledigt mit einer optionalen Rückmeldung. Bestehende Einsatz-, Dokumentations- und Unterschriftsaufgaben bleiben auf der Seite erreichbar. Der Absender sieht unter „Weitergegeben“ die einzelnen Bestätigungen und Rückmeldungen. Eine Frist löst keine E-Mail, SMS oder Push-Erinnerung aus.

## Datenschutz und Fehlerbehandlung

- Nur der Absender sieht seine ausgehenden Einträge; jeder Empfänger sieht ausschließlich die eigene Zustellung. Andere Administratoren erhalten keinen Einblick in diese Inhalte. `office_private_notes` und dessen Zugriffsregeln bleiben unverändert.
- Versand benötigt `office.access` und `communication.send_message`; der eigene Ausgang bleibt mit `office.access` lesbar. Mandant, aktiver Auth-Zugang, Mitarbeiterstatus und eindeutige Portalzuordnung werden serverseitig geprüft. Der geprüfte Absender ist ausdrücklich an `auth.uid()` gebunden.
- Ein Sendevorgang ist durch seine UUID und den unveränderlichen, bestätigten Inhalt idempotent. Ein Verbindungsabbruch kann nach einer erfolgreichen Speicherung auftreten. Die Oberfläche behält in diesem Fall denselben Versanddialog; „Ausgang prüfen“ blendet ihn lediglich aus. „Übermittlung fortsetzen“ verwendet dieselbe Kennung. Ein erneutes Öffnen innerhalb derselben Sitzung kann einen unbestätigten Versuch nach erneuter Autorisierung wieder aufnehmen.
- Sensible Texte werden nicht in Browser-Storage geschrieben. Ein vollständiges Neuladen beendet den lokalen Entwurf; die Oberfläche warnt davor und verweist vor einem neuen Versand auf die Prüfung des Ausgangs. Keine automatische Wiederholung mit neuer UUID.
- Statusänderungen vergleichen die gespeicherte Revision. Bei Konflikt oder unklarer Speicherbestätigung muss der gespeicherte Stand neu geladen werden; ein Rückmeldungsentwurf wird erst nach Bestätigung verworfen.
- Keine automatische E-Mail, kein externer Versand, keine Änderung der Android-Oberfläche.

## Datenbank und Veröffentlichung

`scripts/sql/office-internal-notes.sql` enthält die additive Datenbankänderung: zwei Tabellen im nicht öffentlich exponierten Schema `care_security`, vier öffentliche Invoker-RPCs und autorisierende private Implementierungen. Direkte Tabellenrechte sind entzogen und RLS ist aktiv. Die SQL-Datei wurde am 19.10.2026 um 00:30 UTC auf `caresuiteplus-production` als Migration `20261019003023_office_internal_notes` angewendet. Die vom Server vergebene Version ist unter `supabase/migrations/20261019003023_office_internal_notes.sql` mit identischem SQL gesichert. Tabellenrechte, erzwungene RLS, acht öffentliche/private Funktionssignaturen und feste Suchpfade wurden anschließend im Datenbankkatalog geprüft; der PostgREST-Schemacache wurde neu geladen.

Alle vier RPCs lehnten einen Aufruf ohne Benutzeridentität mit `42501` ab; diese Prüfung lief in einer zurückgerollten, schreibgeschützten Transaktion. Der Sicherheitsberater meldet für die beiden privaten Tabellen erwartungsgemäß [RLS ohne Zeilenrichtlinien](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy): Direkte Tabellenrechte sind vollständig entzogen; der Zugriff erfolgt nur über die autorisierenden Funktionen. Es kamen keine Warnungen oder Fehler hinzu.

Frontend und Datenbank verwenden dieselben vier RPC-Signaturen. Die Frontendveröffentlichung erfolgt über PR #121 und den bestehenden Produktionsbuild auf `main`. Mit freigegebenen Testzugängen bleiben der tatsächliche Versand und Empfang zu prüfen; es wurden keine Testnachrichten an reale Mitarbeitende gesendet.

## Prüfstand

170 lokale Vitest-Prüfungen für bestehende und neue Notizenabläufe bestanden, einschließlich 53 Prüfungen der ursprünglichen privaten Notizen. 18 weitere isolierte PostgreSQL-Szenarien führen die tatsächliche Unternehmensberechtigungs-, private Notizen- und neue Übergabe-SQL aus. Sie prüfen unter anderem fremde Mandanten, andere Administratoren, gesperrte Zugänge, Neuzuordnungen, atomaren Mehrfachempfang, doppelte Requests, Absenderwechsel und konkurrierende Bearbeitung. Diese Prüfungen verwenden ausschließlich isolierte Testdaten.

Die neuen Prüfungen sind in `verify:office-notes:release` eingebunden. Der vollständige Vercel-Vorschaubuild des Hauptprojekts für `3f839306c07477ddff881396a43a37ba1336400e` ist erfolgreich. Der lokale reduzierte Abhängigkeitssatz enthält nicht alle React-Native-/Expo-Typen. Die Browserrichtlinie hat die lokale Komponentenvorschau abgewiesen. Deshalb sind eine bestätigte visuelle Abnahme in breiter und schmaler Darstellung sowie der angemeldete gehostete Ende-zu-Ende-Nachweis weiterhin offen.
