# Unternehmen und Konten deaktivieren und löschen

Stand: 07.10.2026. Ausgangspunkt: main 906746e7d11ce1eb4607adde0543658d740c743e.

Die Web-Mandantenakte bietet getrennte Aktionen für Sperren, Deaktivieren und
Löschen. Deaktivierte Unternehmen können reaktiviert werden. Gelöschte
Unternehmen erscheinen nur im entsprechenden Filter; Wiederherstellen holt
sie zunächst deaktiviert zurück. Die Löschung ist eine nachvollziehbare,
wiederherstellbare Entfernung aus der Verwaltung, keine endgültige Vernichtung
von Unternehmensdaten oder Nachweisen.

Einzelne Verwaltungskonten erhalten Deaktivieren, Reaktivieren, Löschen und
Wiederherstellen. Der vorherige Zustand bleibt erhalten. Ein gesonderter Filter
zeigt gelöschte Konten. Diese Vorgänge betreffen nur den Zugang zum gewählten
Unternehmen; Auth-Identitäten anderer Unternehmen werden nicht gelöscht oder
global gesperrt. Das letzte aktive Geschäftsführungskonto eines aktiven
Unternehmens wird geschützt. Plattformrollen ohne Schreibrecht erhalten keine
entsprechenden Schaltflächen und werden serverseitig abgewiesen.

Jede Änderung benötigt eine Begründung und den tatsächlich angezeigten
Datenstand. Deaktivieren und Löschen haben eine zusätzliche Texteingabe zur
Bestätigung. Laufende oder ungeklärte Kontoänderungen und laufender Mailversand
verhindern konkurrierende Änderungen. Ausstehende Willkommensmails des
deaktivierten/gelöschten Zugangs werden abgebrochen; der Versanddienst wird nicht
neu eingerichtet. Alle Änderungen werden mit Vorher/Nachher im Audit erfasst.

## Prüfstand

- 14 neue ausführbare Prüfungen der tatsächlichen TypeScript-Modelle,
  Verwaltungsdienste und Web-Anmeldeprüfung: bestanden.
- 10 bestehende Prüfungen der kostenlosen Plattform: bestanden.
- 51 weitere bestehende Vitest-Prüfungen im Git-Bash-Lauf des Nutzers am
  07.10.2026: bestanden. Die fünf verfügbaren Gruppen decken Plattformgrundlagen,
  Konsolenaktionen, Seitenlisten und Kontovorgänge ab.
- 22 PostgreSQL-Szenarien der engeren Datenbankfassung: bestanden. Originale
  Funktionskörper und die tatsächlichen Ergänzungen an Mandantenprüfungen wurden
  gegen ausschließlich temporäre Tabellen ausgeführt und vollständig
  zurückgerollt. Es wurden keine produktiven Kunden- oder Kontodaten verändert.
- TSX-Syntaxprüfung mit vorhandener Babel-Umgebung: bestanden.
- DOM-Interaktionen und echte Layoutprüfung in breiten/schmalen angemeldeten
  Ansichten: offen; die benötigten React-/DOM-Werkzeuge sind lokal nicht vorhanden.
  Vier zusätzliche Interaktionsfälle sind zur Ausführung mit den vorhandenen
  Projektabhängigkeiten ergänzt. Es wird nichts installiert.

## Produktiver Serverstand: bereitgestellt

Der Nutzer hat am 07.10.2026 um 13:24 Uhr (Europe/Berlin) mit „deploy“ die zuvor
beschriebene produktive Bereitstellung ausdrücklich freigegeben. Die eingegrenzte
SQL-Fassung wurde erfolgreich in `caresuiteplus-production` angewandt. Die vom
Server tatsächlich vergebene Migrationsversion lautet `20261007112708`; dieselbe
SQL-Datei wird unter
`supabase/migrations/20261007112708_platform_tenant_access_controls.sql` geführt.
SHA-256: `c10058832a65d2947d28f414ad9e21a75a6ba2b55d6955f60e48e4b9d31e6b6e`.

Die Ergänzungen erhalten die bisherigen Auflösungen und Ausführungsrechte der
bestehenden Mandantenprüfungen. Es werden keine flächendeckenden Tabellenregeln
hinzugefügt. Die neue Zugriffstabelle hat Zeilenschutz und keine unmittelbaren
Lese-/Schreibrechte für reguläre oder anonyme Benutzer. Die Verwaltungsfunktionen
prüfen Plattformrecht, Begründung, Bestätigung, Unternehmen, Konto, Zustand und
Änderungszeitpunkt im selben Datenbankvorgang.

Nach der produktiven Bereitstellung wurden rein lesend bestätigt:

- Alle neuen Funktionen und die erwartete Versionskennung sind vorhanden.
- Drei Zugriffsversuche ohne Anmeldung auf Verwaltungs- und Kontolistenfunktionen
  wurden mit fehlenden Rechten abgewiesen; die Prüfsitzung wurde zurückgerollt.
- Vier weitere Aufrufe mit der regulären Benutzerrolle, aber ohne angemeldete
  Identität, wurden ebenfalls abgewiesen. Die reine Versionskennung ist für die
  anonyme Rolle lesbar; es wurden keine Kundeninformationen zurückgegeben.
- Die bisherigen Funktionsrechte und alle fünf eingebetteten Auflösungen der
  vorhandenen Mandantenprüfungen sind unverändert erhalten.
- Die neue Zugriffstabelle ist leer. Die vor/nach der Bereitstellung gebildeten
  Prüfsummen aller Unternehmens-, Verwaltungskonto- und Willkommensmail-Zeilen
  sind identisch. Die Bereitstellung hat keine vorhandenen Konten oder Unternehmen
  deaktiviert/gelöscht und keine vorhandenen Mailaufträge verändert.
- Die Sicherheitsberatung zeigt die erwarteten Hinweise zur absichtlich nicht
  direkt zugänglichen Zugriffstabelle und zu den berechtigungsgesteuerten
  privilegierten Funktionen. Ausführungsrechte und Begründungs-/Plattformprüfungen
  sind für diese Funktionen ausdrücklich überprüft; allgemeine Altbefunde werden
  nicht mit dieser Änderung bearbeitet.

Die öffentliche REST-Prüfung und die endgültige Web-Veröffentlichung erfolgen
im Git-Bash-Lauf: dieser Arbeitsbereich kann die Produktions-API nicht direkt
erreichen und die verbundene GitHub-Anwendung hat keine Schreibrechte. Das
Veröffentlichungsskript prüft den Servernachweis vor dem Upload und erneut vor
der Zusammenführung sowie alle vier Web-Erstellungen und die ausgelieferten
JavaScript-Kennungen. Vor Abschluss dieses Laufs ist die Oberfläche nicht als
live bestätigt. Das Paket enthält keinen SQL-Ausführungsbefehl. Android wird
nicht gebaut oder veröffentlicht. CareSuite bleibt kostenlos.
