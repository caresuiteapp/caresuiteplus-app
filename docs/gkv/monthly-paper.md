# Monatsbestätigung über Druck und Scan

Stand: 29.10.2026. Entwicklungsstand nach `74d8d36`; keine produktive
Datenbankaktivierung, keine echte Unterschrift und keine Prüfbestätigung.

## Ablauf

1. Die beauftragte Person wählt Patient oder eine gültige dokumentierte
   Vertretungsberechtigung und anschließend den Papierweg. Der Host erzeugt
   die vollständige Druckfassung aus den aktuellen kanonischen Monatsquellen.
   Jede Seite trägt Fassungskennung, Erfassungskennung, Seitenzählung und
   Inhaltsbindung. Fortsetzungsseiten nennen Person, Monat und Leistungsart.
   Ein zusammengehaltenes Feld nimmt die neue persönliche Unterschrift auf;
   Datum und Uhrzeit werden daneben auf dem Papier eingetragen.
2. Die Fachperson öffnet und prüft alle Originalseiten vor der Ausgabe.
   Alle Seiten werden gedruckt, von derselben gewählten Person unterschrieben
   und gemeinsam als PDF eingescannt. Die Druckerbedienung erfolgt im
   PDF-Betrachter; der Server behauptet keinen Nachweis des physischen Druckens.
3. Ein vollständiger Scan wird einmalig hochgeladen. Der Server prüft und
   rendert ihn in einem begrenzten Worker. Die exakten PDF-Bytes, das Manifest
   und sämtliche gerenderten Seiten werden verschlüsselt und unveränderlich
   im vorhandenen Hostarchiv abgelegt und anschließend zurückgelesen.
4. Die angemeldete Fachperson öffnet jede gespeicherte Seite und bestätigt
   den Vergleich von Person, Leistungsart, Fassung, Erfassungskennung und
   sämtlichen Leistungen mit der ausgegebenen PDF. Sie prüft die vollständige
   tatsächliche Unterschrift auf der vorgesehenen Seite, den Ausschnitt und
   den auf dem Papier angegebenen Zeitpunkt. Die Oberfläche verwendet die
   Ortszeit des Geräts und übermittelt einen eindeutigen UTC-Zeitpunkt.
5. Der Server schneidet ausschließlich die bereits archivierten Bildpunkte
   aus. Das neue PNG durchläuft den bestehenden Integritäts-, Leerbild- und
   Wiederverwendungsprüfer. Eine private Quittung bindet Original, vollständigen
   Scan, alle Seiten, Ausschnitt, Unterzeichner, persönliche Prüfung und Zeiten.
6. Erst der separate Abschluss verbraucht diese Quittung atomar. Quellen,
   Revision, Beauftragung, Anmeldung und gegebenenfalls Vertretungsberechtigung
   werden erneut geprüft. Der endgültige Nachweis zeigt den Papierweg und
   ermöglicht den Zugriff auf die ursprüngliche PDF und den vollständigen Scan.
   Nach einer Korrektur bleibt der Vorgänger ausdrücklich ungültig; der
   Nachfolger übernimmt weder Scan noch Unterschrift.

## Verbindliche Grenzen

- Je Scan höchstens 2 MiB und 20 Seiten; exakt so viele wie in der Druckfassung.
  Große oder unleserliche Scans werden nicht heimlich verkleinert oder gekürzt.
  Falsche Dateien können innerhalb derselben Erfassung nicht ersetzt werden.
  Eine neue Erfassung erfordert eine neue zugehörige Papierunterschrift.
- Unterstützt werden passive PDFs ohne Kennwort, Anhänge, Formulare, XFA,
  JavaScript, Anmerkungen oder Gliederung. Renderwarnungen führen zur Ablehnung.
  Der Parser bekommt lokale Bytes und ausschließlich paketinterne Schrift-/
  Decoderressourcen; keine vom Aufrufer gewählte URL oder Dateiadresse.
- Bestehende Lockfile-Abhängigkeiten: PDF.js 5.4.624 und dessen bereits vorhandenes
  `@napi-rs/canvas` 0.1.100. Keine neue Paketversion oder Testinfrastruktur.
  Der Node-Host braucht diese vorhandenen Entwicklungs-/optionalen Abhängigkeiten
  einschließlich der passenden nativen Canvas-Bibliothek. Ein auf reine
  Produktionsabhängigkeiten reduzierter Host ist für diesen Pfad nicht geprüft.
- Renderzeit höchstens 20 Sekunden, V8-Heap 256 MiB plus 32 MiB junge Generation;
  Ausgabe maximal 1200 × 1600 Pixel je Seite, 2 MiB je PNG und insgesamt 32 MiB.
  Interne Canvas-Flächen und einzelne Bilder sind auf 16 Millionen Pixel
  begrenzt. Diese Workergrenzen sind **keine Betriebssystem-Sandbox oder harte
  Begrenzung sämtlicher nativer Speicherbelegungen**. Last-/Ressourcenabnahme
  auf dem vorgesehenen Host bleibt erforderlich.
- Original, Scan, Seiten und Unterschrift zählen zur bestehenden Mandantenquote.
  AES-GCM bindet jede Datei an Mandant, Erfassung, Version bzw. Seitenhash.
  Originaldateien werden weder öffentlich verlinkt noch im Browserspeicher
  persistiert. Blob-Ansichten leben nur in der aktuellen Oberfläche und werden
  beim Wechsel wieder freigegeben.
- Druckerfassungen gelten maximal sieben Tage; der bereits bestehende direkte
  Canvas-Pfad bleibt auf 30 Minuten begrenzt. Die Fortsetzung über die gedruckte
  Erfassungskennung verlangt dieselbe persönliche Auth-Sitzung, unveränderte
  Quellen und gegebenenfalls dieselbe gültige Vertretungsprüfung. Aus- und
  erneutes Einloggen erzeugt gegebenenfalls eine andere Sitzung und sperrt die
  Fortsetzung. Eine erteilte Abschlussquittung bleibt nur 30 Minuten frisch.
- Ein verlorener Upload oder Prüfabschluss wird zunächst lesend geklärt.
  Die exakte Anfrage bleibt nur im Arbeitsspeicher für eine ausdrückliche
  Wiederholung erhalten. Automatische erneute Schreibaufrufe gibt es nicht.
  Bei einem Neuladen werden gespeicherte Dateien gelesen, Seitenfreigaben
  vor einer noch ausstehenden Prüfung müssen erneut persönlich erfolgen.

## Was technisch nachgewiesen wird

Die Anwendung prüft Dateiidentität, vollständige Seitenzahl, Seitenhashes,
Zuordnung zur offenen Erfassung, Ausschnittsgrenzen, nichtleere Bildpunkte,
aktuelle Rechte und die erklärte persönliche Prüfung. Ein vollständiger Scan
wird nach Bytehash und exakt gerenderter Erscheinung gegen Wiederverwendung
geschützt; die SQL-Quittung erzwingt diese Eindeutigkeit auch über verschiedene
Hostarchive hinweg. Die kanonischen Unterschriftsbildpunkte unterliegen weiterhin
derselben Eindeutigkeitsregel wie beim direkten Canvas-Pfad.

Das ist **keine automatische Inhalts-, Handschriften-, Identitäts- oder
Echtheitsprüfung**. Bildskalierung, Fotografieren oder inhaltliche Bearbeitung
können eine andere Bilderscheinung erzeugen; der Hash ist kein forensischer
Fälschungsdetektor. Die Fachperson muss tatsächlich vergleichen und prüfen.
Dateiprüfung ersetzt weder Schadsoftwarebegutachtung noch eine unabhängige
Prüfung des Parserbetriebs. `issuedAt` bezeichnet die serverseitige Ausgabe
der PDF; `signedAt` ist der persönlich bestätigte Papierzeitpunkt, `reviewedAt`
stammt aus dem aktuellen serverseitigen Prüfabschluss.

## Datenbank und Prüfungen

Die bestehenden fünf **Review-SQL-Entwürfe** bleiben unangewendet. Der
Originalverifier-Entwurf ergänzt die private Tabelle
`care_security.gkv_monthly_paper_receipts` und zwei private Hilfsfunktionen.
RLS ist aktiv; PUBLIC, anon, authenticated und service_role erhalten keine
direkten Tabellen-/Funktionsrechte. Die persönliche MAC-/Sitzungsbrücke ist
weiterhin der einzige Hostzugang. Die bestehende Bestätigungsfunktion übernimmt
die optionale Papierbindung in den finalen Nachweis; ältere Canvas-Quittungen
behalten ihren bisherigen Vertrag.

`tests/gkv-exchange/monthly-paper.test.mjs` verarbeitet eine tatsächliche
mehrseitige Original-PDF mit synthetisch hinzugefügter Testtinte durch Rendering,
Archiv, persönliches Review und reale SQL-Funktionen in isoliertem PGlite.
Geprüft werden auch korrigierte Archive, unvollständige/falsche PDFs, aktive
Inhalte, leere Ausschnitte, falsche Zeiten, Rechte-/Quellenwechsel,
Vertretungswiderruf, Antwortverlust, unveränderte Wiederaufnahme, Wiederverwendung
über zwei Archive, manipulierte private Papiermetadaten und atomarer Rollback.
Ein zusätzlicher Hosttest durchläuft den tatsächlichen lokalen mTLS-Gateway.
Die React-Tests prüfen die Seitenfreigaben, Ausschnitts-/Zeitprüfung, den
getrennten Abschluss und das Klären eines verlorenen Uploads.

## Abnahme bleibt offen

Der [amtliche ITSG-Prüfkatalog, Fall 3.9](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf)
verlangt den Papierablauf für getrennte Leistungsarten und die anschließende
signierte XML-Ausgabe. Deshalb bleibt dieser Fall `not_executed`. Erforderlich
sind insbesondere echte Drucke/Scans mit Patienten-/Vertreterprüfung, reale
Anmeldung und Zielrechte, konkurrierende Datenbankzugriffe, visuelle Webabnahme
in breiter/schmaler Darstellung, das normative Fach-XML samt Signatur sowie
die unabhängige Softwareprüfung. Die aktuellen automatisierten Beispiele sind
keine Hardware-, TI-, Identitäts- oder Zulassungsnachweise.

Quellen am 29.10.2026: [PDF.js-Dokumentation](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html),
[Supabase-Funktionsrechte](https://supabase.com/docs/guides/database/functions)
und oben genannter amtlicher Prüfkatalog. Die Verarbeitung richtet sich nach
den im Lockfile vorhandenen APIs; die öffentlichen Grenzwerte sind eigene
Produktgrenzen, keine Behauptung einer GKV-Vorgabe.
