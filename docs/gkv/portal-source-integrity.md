# Was das Portal bei einer Unterschrift prüft

Aktualisierung vom 05.11.2026: Originalabruf und Bytebestätigung, Monatsnachweis und Rechnungsentwurf wurden inzwischen mit vier echten Staging-Anmeldungen durchgespielt. Die zwei fehlenden Quellfunktionen und die zehn Monatspakete sind installiert; ein zusätzlicher Fremdzugriff auf Tabellenzeilen wurde geschlossen. Der [aktuelle Prüfbericht](staging-original-invoice-flow.md) beschreibt den belegten Umfang und die weiter offene Browser-/Hardware-/TI-Abnahme. Der folgende Abschnitt dokumentiert den früheren Stand vom 04.11.

Stand: 04.11.2026, `caresuiteplus-staging`. Eine aktive persönliche Sitzung und der Bezug zum konkreten Klienten waren Gegenstand eigener Datenbankprüfungen. Die folgenden Ergebnisse betreffen den Tagesbeleg. Sie bestätigen keine GKV-Monatsabrechnung und keinen Versand.

## Inhalt und PDF

Auf Staging nahm die Mitarbeiterfreigabe einen synthetischen Beleg mit einer absichtlich falschen SHA-256-Prüfsumme an. Der Versuch lief in einer zurückgerollten Transaktion. Der eingespielte [SQL-Code](sql/portal-source-integrity.sql) berechnet die Prüfsumme selbst. Besuch, Klient und Mitarbeiter müssen zum Auftrag passen. Beim ersten Klientenabschluss vergleicht PostgreSQL die gespeicherte Vorschau mit dem bei der Unterschrift gebundenen Originalhash und prüft den signierten Inhalt (Einsatz, geplante Zeiten, Aufgabenstatus und Dokumentation). Dann berechnet es die endgültige Fassung aus dem gespeicherten Beleg und den Daten der gültigen Unterschrift. Eine abweichende Prüfsumme wird vor Änderungen an Beleg, Portal-Dokument und Audit abgewiesen. Wiederholungen für eine andere Fassung werden ebenfalls abgewiesen. Eine bereits zugeordnete, gültige Altunterschrift kann nur unter den im SQL festgelegten Inhaltsprüfungen wiederaufgenommen werden.

Das Webportal liest eine frisch hochgeladene PDF unter der Klientensitzung zurück. Dateipfad, PDF-Kennung, Größe und SHA-256 müssen passen. Erst danach ruft es den Datenbankabschluss auf. Auch bei einer bereits als abgeschlossen angezeigten Fassung prüft es das gespeicherte PDF und die Antwort der Datenbank erneut. Ein beschädigter oder fehlender Upload lässt die erfasste Unterschrift für einen neuen Versuch erhalten. Der App-Hash beruht auf dem tatsächlich übertragenen JSON, einschließlich der Behandlung nicht gesetzter optionaler Felder.

Die SQL-Funktion selbst liest keine Storage-Dateibytes. Für den serverseitigen Nachweis prüft der [Abschlussdienst](../../supabase/functions/complete-assist-service-record/handler.ts) zusätzlich die [Quellfassung](../../supabase/functions/complete-assist-service-record/proofSource.ts): Stimmen Besuch, Klient, Mitarbeiter, Unterschrift, tatsächliche Zeiten, Nettoleistungsdauer und signierter Inhalt überein? Gehört der Bildpfad zur konkreten Unterschrifts-ID? Der Dienst liest das Originalbild, erzeugt eine PDF und vergleicht die zurückgelesenen Bytes. Vor der privaten Bytebestätigung liest er Auftrag, Berechtigung und Quellfassung erneut unter der Sitzung des Aufrufers. Die beiden Lesevorgänge und der anschließende Datenbankvergleich bleiben getrennte Schritte. Bei entzogenem Zugriff im zweiten Lesevorgang wird keine Bestätigung geschrieben. Ein bereits hochgeladenes Objekt ist dadurch kein freigegebener Beleg.

Auf Staging steht der Dienst auf Version **2**, JWT-Prüfung aktiv. Alle fünf bereitgestellten Quelldateien wurden mit dem Arbeitszweig verglichen. Ein HTTP-POST ohne Anmeldedaten wurde mit 401 abgewiesen. Der reguläre serverseitige Abschluss mit privatem Bucket und angemeldetem Testkonto wurde dort nicht durchgespielt: Seine Datenbankfunktionen zur Wahl und verbindlichen Bestätigung der Originalquelle fehlen weiterhin.

## Zugriff auf gespeicherte Originale

Eine vorhandene permissive Storage-Regel gab Lese- und Änderungszugriff auf Mandantenebene. Ein ebenfalls permissives Portalrecht für den eigenen Beleg kann das in PostgreSQL nicht einschränken. Die [separate Migration](../../supabase/migrations/20261104141643_guard_portal_assist_original_storage.sql) ergänzt deshalb restriktive Regeln für Signaturbilder, Beleg-PDFs und Serveroriginale unter `office-documents/tenant/<Mandant>/assist/visits/<Besuch>/`. In einer Klientensitzung entscheiden das aktive zugeordnete Konto, der eigene Besuch und der Freigabestand. Fremde oder widerrufene Belege bleiben unsichtbar. Klienten können die geschützten Objekte nicht per UPDATE, Umbenennen oder DELETE verändern. Für einen neuen Upload gelten engere Bedingungen als für das Lesen eines schon veröffentlichten Belegs. Ein Familiencode allein berechtigt nicht zum Zugriff auf diese Dateien. Andere Dateiverzeichnisse, institutionelle Bürorechte und der Dienstschlüssel sind mit diesem Paket nicht vollständig geprüft.

Auf demselben PostgreSQL-Server liefen die [effektiven Regeln](checks/staging-portal-storage-replay.sql) vor und nach der Änderung mit realer Rolle und Sitzungsauflösung. Die Abfrage wertet die installierten Rollen-, Tabellen- und RLS-Bedingungen gegen synthetische Storage-Tupel aus. Sie sucht keine realen Objektzeilen oder Dateien. Alle 14 Fälle wurden nach dem Einbau mit ihren Erwartungswerten verglichen.

| Test unter einer Klientensitzung | Vorher | Nachher |
| --- | --- | --- |
| Eigenes erfasstes Signaturbild und dazugehörige PDF lesen | erlaubt | erlaubt |
| Signaturbild und Nachweis eines zweiten Klienten im selben Mandanten lesen | erlaubt | gesperrt |
| Eigenes oder fremdes Signaturbild per UPDATE ändern | erlaubt | gesperrt |
| Zu fremdem Beleg oder im Serververzeichnis eine PDF einfügen | erlaubt | gesperrt |
| Neue Signatur und zugeordnete PDF für den eigenen offenen Auftrag einfügen | erlaubt | erlaubt |

Im isolierten PostgreSQL-Test wurden außerdem echte SELECT-, INSERT-, UPDATE- und DELETE-Anweisungen auf synthetischen Objektzeilen ausgeführt. Die gehostete Wiederholung verwendete zwei synthetische Klienten, eine persönliche Mitarbeiter- und eine persönliche Klientensitzung; alle angelegten Datensätze wurden zurückgerollt. Es wurden keine Benachrichtigungen oder Rechnungen versendet.

## Pakete und Wiederholung

| Staging-Migration | SHA-256 des gespeicherten SQL-Pakets |
| --- | --- |
| `20261104140126_gkv_staging_bind_portal_original_hashes` | `6bb249a43181b4f3d55037008a62d7d84f422838ac8d81e2f5f766631842cc3d` |
| `20261104141643_gkv_staging_scope_portal_original_storage` | `e2f3ac46b8abbf4be7d9b81274868026d2e14a78ba706b8d228b40c498603e97` |

`npm run verify:gkv:portal-integrity` prüft Datenbank, Dateidienst und Webverhalten mit Testdaten. Der PDF-Test verwendet dieselbe PDF-Bibliotheksversion wie der Dienst. Die beiden Paketgeneratoren [Portalinhalt](../../scripts/gkv-portal-integrity-package.mjs) und [Dateirechte](../../scripts/gkv-portal-storage-package.mjs) geben mit `--migration-body` das jeweilige SQL und mit `--native-replay` den vollständigen Test einschließlich ROLLBACK aus. Die Zielabgleiche beziehen sich auf den Stand **vor** der jeweils einmaligen Staging-Installation. Nicht umgehen oder auf Produktion übertragen.

Die [Kontosperre in PR #174](https://github.com/caresuiteapp/caresuiteplus-app/pull/174) und die [Dateirechte in PR #175](https://github.com/caresuiteapp/caresuiteplus-app/pull/175) können unabhängig vom gesamten GKV-Zweig geprüft werden. Auf Produktion wurden nur Systemkataloge gelesen. Dort existieren die allgemeinen Mandantenregeln sowie weitere Restriktionen; ein Fremdzugriff wurde dort weder getestet noch beobachtet. Keine Produktivmigration und keine Aussage über einen tatsächlichen Datenabfluss.

Auf Staging bleiben **36 von 38 direkten Voraussetzungen** und **0 von 11 Markern** für die zehn Monatsentwürfe vorhanden. Offen sind der verbindliche Abruf des signierten Originals und die Prüfung der Rechnungsquelle. Die neue Portalprüfung ersetzt weder diese Datenbankfunktionen noch einen angemeldeten Browser-/Storage-Abnahmelauf, Hardware-/TI-Nachweise oder eine externe Prüfung.
