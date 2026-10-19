# Prüfprotokoll: GKV-Datenaustausch

Stand: 19.10.2026. Reine Beispieldaten; keine Übermittlung an eine Pflegekasse.

## Ausgeführt

```bash
node --import ./tests/gkv-exchange/register.mjs --test tests/gkv-exchange/*.test.mjs
```

**27 Prüfungen bestanden** mit der vorhandenen Node-24-Laufzeit.
Es wurde kein zusätzliches Testframework installiert.

| Bereich | Nachweis |
| --- | --- |
| Dateiaufbau | Vollständige erwartete PLGA-/PLAA-Referenzdatei mit einem fiktiven Beratungsfall |
| Auftragsdatei | 348 Bytes, feste Positionen, Byteanzahl, deutsche Ortszeit und getrennte Empfängerrollen |
| Zeichensatz | Latin-1, Umlaute, EDIFACT-Aufhebungszeichen, Ablehnung nicht darstellbarer Zeichen |
| Parser | Abgebrochene Segmente, falsche Zähler, doppelte/falsche Referenzen |
| Fachprüfung | Beträge, Dubletten innerhalb des Pakets, Nachweise, Beschäftigtennummern, Steuer- und Versionsgrenzen |
| Berechnung | Dezimalzahlen, halbe Centbeträge, große ganzzahlige Produkte |
| Routing | Mehrstufige Zuordnung, Ablaufdaten, falscher Übermittlungsweg, Mehrdeutigkeit, UEM-Gültigkeit, VZD-Kennzeichen |
| Rückmeldemodell | Korrelation, wiederholte Zustellmeldung, unzulässige Statussprünge |
| Export-API | Authentifizierung, Berechtigung, kein vom Client eingereichter Dateikörper, Mandant, Revision und parallele Änderung |
| Quellrechnungen | Fremder Mandant, geänderter Stand, Stornierung, abweichende Nummer, Summe oder Person |
| Fehlerausgabe | Keine Nutzdaten bei Fehlern, keine Details aus internen Ausnahmen, kein alternativer Versandpfad |

Die TSX-/TypeScript-Quelldateien der neuen Oberfläche, der Eingabekomponenten,
des Datenzugriffs und der geänderten Rechnungsnavigation wurden mit dem bereits
in Playwright enthaltenen Babel-Parser und Transform geprüft. Das belegt
syntaktische Verarbeitbarkeit, **keinen vollständigen TypeScript-Typcheck**.

Die vorhandenen Tabellenfelder und die Office-Berechtigungsfunktion wurden
über reine Metadatenabfragen geprüft. Die Migration enthält Vorbedingungen
für die vorhandene Berechtigungs- und Rechnungsstruktur.

## Nicht ausgeführt / noch erforderlich

- **Visuelle Prüfung und Browserinteraktionen:** Der lokale Start des vorhandenen
  Playwright-Werkzeugs scheiterte an einer fehlenden Chromium-/Headless-Laufzeit.
  Gemäß `AGENTS.md` wurde keine zusätzliche Software installiert. Damit liegen
  keine Screenshots oder Layoutfreigabe für die neue Oberfläche vor.
- **Vollständiger Projektbuild und Typcheck:** Die Projektabhängigkeiten sind in
  dieser Arbeitsumgebung nicht vollständig vorhanden. Die zusätzliche Babel-
  Prüfung ersetzt weder Metro/Expo-Build noch `tsc`.
- **Datenbankmigration:** Nicht remote angewendet und nicht in einer lokalen
  PostgreSQL-Instanz ausgeführt. Die RLS-/RPC-Logik ist daher noch durch reale
  SQL-Integrationstests zu belegen. Das vorhandene Stagingprojekt benötigt zuvor
  die aktuelle Office-Rechnungsstruktur.
- **Echte Dienstintegration:** Kein DTA-/KIM-Transport, keine SMC-B-Signatur,
  keine Annahmestellenvalidierung und kein Ende-zu-Ende-Nachweis. Die erzeugte
  Referenzdatei ist ein Entwicklungstest, keine amtliche Prüffreigabe.

## Verbindliche Abnahme vor dem Zusammenführen

1. Bestehenden Web-Build und Typcheck ausführen.
2. Migration im vorgesehenen Test-/Releaseablauf prüfen. Owner, berechtigter
   Office-Leser, Office-Ersteller, Benutzer ohne Recht und Portalzugang testen.
   Mandantenwechsel, Null-Mandant und fremde Rechnungsreferenzen einschließen.
3. Derselbe Auftrag muss dasselbe Ergebnis ohne zweite Mutation liefern;
   abweichender Inhalt unter derselben Auftragskennung muss scheitern. Parallele
   Speicherungen mit gleicher Revision dürfen höchstens einmal erfolgreich sein.
4. Oberfläche bei breitem Fenster, geöffneter Navigation, schmalem Bereich und
   vergrößerter Schrift prüfen. Keine horizontalen Überläufe oder überdeckten
   Aktionen; Speicher-, Fehler-, Leer- und Ladezustände sowie Tastaturbedienung prüfen.
5. Paket anlegen, Profil speichern, Rechnung übernehmen, Positionen ergänzen,
   speichern, Prüfdateien erzeugen/herunterladen und nach Neuladen wieder öffnen.
   Unvollständige Zahlen, veraltete Rechnungen und fehlende Nachweise müssen
   die vorgesehenen Aktionen blockieren.
6. Rollen-/Mandantenwechsel während laufender Requests darf keine fremden Daten
   anzeigen oder Downloads aus dem alten Arbeitsbereich auslösen. Ungespeicherte
   Änderungen und ein unklarer Speicherausgang müssen erkennbar bleiben.
7. Freigegebene amtliche Testfälle gegen einen unabhängigen Validator und die
   Annahmestelle prüfen. Die verbleibenden Fachprofile und Versandanschlüsse aus
   `implementation.md` sind weiterhin gesondert umzusetzen.

**Freigabeentscheidung:** Draft-Review geeignet; produktiver Echtbetrieb und
vollständige Ende-zu-Ende-Funktion derzeit nicht belegt.
