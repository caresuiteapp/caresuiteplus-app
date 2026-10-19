# Prüfprotokoll: GKV-Datenaustausch

Stand: 19.10.2026. Reine Beispieldaten; keine Übermittlung an eine Pflegekasse.

## Ausgeführt

```bash
node --import ./tests/gkv-exchange/register.mjs --test tests/gkv-exchange/*.test.mjs
```

**54 Fach-/API-Prüfungen bestanden** mit der vorhandenen Node-24-Laufzeit.
Es wurde kein zusätzliches Testframework installiert.

| Bereich | Nachweis |
| --- | --- |
| Dateiaufbau | Vollständige erwartete PLGA-/PLAA-Referenzdatei mit einem fiktiven Beratungsfall |
| Auftragsdatei | 348 Bytes, feste Positionen, Byteanzahl, deutsche Ortszeit und getrennte Empfängerrollen |
| Zeichensatz | Latin-1, Umlaute, EDIFACT-Aufhebungszeichen, Ablehnung nicht darstellbarer Zeichen |
| Parser | Abgebrochene Segmente, falsche Zähler, doppelte/falsche Referenzen |
| Fachprüfung | Beträge, Dubletten innerhalb des Pakets, Nachweise, Beschäftigtennummern, Steuer- und Versionsgrenzen |
| Berechnung | Sechs Zeit-Einheiten, anteilige/angefangene Einheiten, Kilometergrenzen, fünfstellige Punktwerte, halbe Centbeträge und Überlaufablehnung |
| Zuschläge/Abzüge | Prozent/fester Betrag, unveränderter Basisbetrag, einzelne Cent-Rundung, Vorzeichen, ZUS-Feldpositionen und Ende-Kennzeichen, fünf Dezimalstellen, Tarifbereiche, Pflichtangaben, negative Summen, Feldgrenzen und weiterhin genauer Quellrechnungsabgleich |
| Routing | Mehrstufige Zuordnung, Ablaufdaten, falscher Übermittlungsweg, Mehrdeutigkeit, UEM-Gültigkeit, VZD-Kennzeichen |
| Rückmeldemodell | Korrelation, wiederholte Zustellmeldung, unzulässige Statussprünge |
| Export-API | Authentifizierung, Berechtigung, kein vom Client eingereichter Dateikörper, Mandant, Revision und parallele Änderung |
| Quellen | Rechnung und vollständige Positionen, Steuer, Datum, Person, Revisionen, Leistungsdauer, Nachweisauswahl und Hash |
| Original-PDF | Tatsächliche Byteprüfung, geänderte/fehlende PDF, Größenlimit, fremde Pfade, Traversal und URL-Ablehnung |
| Fehlerausgabe | Keine Nutzdaten bei Fehlern, keine Details aus internen Ausnahmen, kein alternativer Versandpfad |

Zusätzlich wurden **19 Datenbankfälle (20 Testeinträge einschließlich Suite)** mit der bereits vorhandenen PGlite-Laufzeit auf PostgreSQL 17.5 ausgeführt:

```bash
node --import ./tests/gkv-exchange/register.mjs tests/gkv-exchange/database.mjs /pfad/zur/vorhandenen/pglite/dist/index.js
```

Alle drei tatsächlichen GKV-Migrationen werden im Arbeitsspeicher ausgeführt. Geprüft sind RLS, Mandanten-/Portal-/Rollenwechsel, entzogenes Direkt-Schreibrecht, private Wiederholungsquittungen, idempotente Aufträge, Inhaltskonflikte, Revisionen, Fremdrechnungen, Profilrevisionen, Abbruch bei ungültigen Quellen und fehlende Berechtigung öffentlicher RPCs. Die Revisionsmigration wird im Test nach dem ersten Paket angewendet: Übernahme des vorhandenen Stands, spätere unveränderte Historie, Datenstand-Hashes, Herkunftsverknüpfung, neue Entwurfskennung, zurückgesetzte Bestätigungen, wiederholte Kopieraufträge und Seiten über 20 Revisionen werden tatsächlich in PostgreSQL geprüft. Authentifizierte Benutzer können die Historie weder ändern noch löschen oder ergänzen; Portal-, Fremdmandanten- und anonyme Zugriffe scheitern. Die Tests für veraltete Revisionen verwenden aufeinanderfolgende Konflikte; ein Lasttest konkurrierender Datenbankverbindungen ist damit nicht belegt.

Die vorhandenen Office-Helfer und Auth-Claims sind ausdrücklich Vertragsdoubles; echte Supabase-Authentifizierung und die vollständigen Office-Nachweisprüfer sind damit nicht integriert getestet. Es wurden keine produktiven Daten verändert.

Die echten Komponenten `CaseEditor` und `RevisionHistory` wurden zusätzlich mit den vorhandenen React-/happy-dom-/esbuild-Paketen bedient (`editor-check.mjs`): Zeitberechnung, ungültiger Geldwert und Korrektur, Kilometer, Rückkehr zur Wegepauschale, Punktwerte und Entfernen der Punktregel, erneute Quellübernahme, Zuschlag/Abzug mit ungültiger Eingabe/Korrektur/Entfernen bestanden. Historie: Nachladeaktion, schreibgeschützter Stand, Auswahl einzelner Fälle, erforderliche Übernahmebegründung, Leser ohne Kopieraktion, Ladefehler/Wiederholung und Schließen bestanden. Transportcallbacks der Historienoberfläche sind ausdrücklich Doubles. **Dies sind DOM-Funktionsprüfungen, keine visuellen oder vollständigen Ende-zu-Ende-Prüfungen.**

Ein gezielter strenger TypeScript-Check für Fachkern, Quellprüfung, Export-API, `GkvEditors.web.tsx` und `GkvRevisionHistory.web.tsx` mit den vorhandenen echten Node-/React-Typen besteht. Er umfasst nicht den gesamten Expo-Abhängigkeitsbaum. Die beiden im Vercel-Log gemeldeten Fehler wurden mit Commit `a1e122d` korrigiert: explizite Env-Felder und ein ausdrücklich als `string` deklarierter Request-Identifier. GitHub meldet für den darauf aufbauenden Stand `9bac3f7` erfolgreiche Vercel-Deployments von `caresuiteplus-app`, `caresuiteplusapp` und `repository`; diese Statusmeldungen belegen nicht den Build der hier neu ergänzten Zuschläge und Historie.

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
- **Supabase-Integration:** Migrationen lokal in PostgreSQL/PGlite getestet, nicht remote angewendet. Tests mit der tatsächlichen Office-Autorisierung, den vorhandenen Nachweisprüfern, PostgREST und Storage bleiben erforderlich. Das vorhandene Stagingprojekt benötigt zuvor die aktuelle Office-Rechnungsstruktur.
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
   Zuschläge anhand vertraglich freigegebener Referenzfälle prüfen. Frühere
   Paketstände ansehen, nachladen und mit Begründung in einen neuen Prüfentwurf
   übernehmen; Original, Herkunft und zurückgesetzte Nachweisbestätigung prüfen.
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
