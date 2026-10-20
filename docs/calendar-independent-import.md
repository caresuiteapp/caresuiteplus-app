# Unabhängige Dienstplan-Erkennung für Web/Desktop

Die Kalenderansicht liest PDFs und Fotos im Browser. Der Web-Import ruft weder
`employee-plan-analyze` noch eine KI-API auf. Dokumentbytes und erkannter Rohtext
werden nicht hochgeladen, protokolliert oder dauerhaft von CareSuite gespeichert.
Erst die bestätigten strukturierten Monatsangaben gehen über den bestehenden
Speicherweg an die Datenbank. Für diese Analyse gibt es keine verbrauchsabhängige
KI-API-Abrechnung. Rechenarbeit erfolgt auf dem Endgerät; normale Kosten für die
Auslieferung der Web-App und Erkennungsdateien bleiben bestehen.

## Funktionsumfang

- PDF-Text wird anhand der Positionen in visuelle Zeilen gebracht. Fotos und
  gescannte Seiten werden mit Tesseract in einem Browser-Worker gelesen.
- PDF.js, Worker, WASM und deutsche/englische Sprachdateien werden beim Build aus
  dem Lockfile bereitgestellt. Alle Laufzeitdateien kommen vom eigenen Ursprung,
  ohne CDN-Fallback. Laden erfolgt erst beim Dateiimport; Sprachmodelle werden
  lokal zwischengespeichert, Dokumentinhalte nicht.
- Der eigene Parser erkennt datierte Zeilen, deutsche Monate, einfache Tages-
  und Zeitraumtabellen, mehrere Zeitfenster, „ab“/„bis“, ausdrücklich ganztägige
  Abwesenheiten sowie über Mitternacht gehende Intervalle.
- Interpretation als Verfügbarkeit, Fremddienst oder gemischter Arbeitgeberplan.
  „Frei“ ist ohne eindeutige Zusage keine zugesicherte Verfügbarkeit. Ein bloßer
  Arbeitgebername oder „Arbeit Tag“ ist keine ganztägige Zusage.
- Fehlende Uhrzeiten bleiben leer. Unklare Zuordnungen müssen gewählt werden.
  Nicht zugeordnete relevante Zeilen bleiben sichtbar. Der gesamte erkannte Text
  kann bearbeitet oder eingefügt und neu ausgewertet werden; das ersetzt nur den
  letzten Import. Bereits vorher vorhandene Einträge bleiben erhalten.
- Sichtbarer Fortschritt, Abbruch, Foto-Drehung und erzwungene Scan-Erkennung bei
  unvollständigen PDF-Textschichten. Maximal 10 MB, 12 PDF-Seiten, 40 Megapixel je
  Foto, 100.000 Textzeichen und 300 Entwürfe; 180 Sekunden Analysezeitlimit.
- Vor dem Speichern sind weiterhin vollständige Prüfung, gültige Zeitfenster
  und gegebenenfalls Konfliktbestätigung erforderlich. Datum und Person müssen
  mit der Vorlage verglichen werden, auch bei technisch guter Texterkennung.

## Bewusste Grenzen

Dies ist eine eigene CareSuite-Auswertung mit offenen PDF-/OCR-Komponenten, kein
neu trainiertes universelles Handschriftmodell. Drucktext und saubere Scans sind
der erste Zielbereich. Handschrift, verzerrte Bilder, komplexe Raster und Legenden
mit Schichtkürzeln sind nicht zuverlässig automatisch auflösbar. Unbekannte
Schichtzeiten werden niemals geraten. Mehrpersonenmatrizen und mehrfach benannte
Personen werden zur Textkorrektur zurückgewiesen; bitte nur die datierten Angaben
der Zielperson übernehmen. Wiederholungsregeln ohne konkrete Daten werden als
nicht zugeordnet angezeigt. Nachtdienste über eine Monatsgrenze brauchen den
jeweiligen Monatsplan. Es gibt keinen kostenpflichtigen Analyse-Fallback.

Die Änderung ist auf Web/Desktop begrenzt. Die native Importimplementierung und
die bestehende Edge Function bleiben für den bisherigen nativen Ablauf erhalten.
Keine Datenbankmigration, Änderung von API-Schlüsseln oder Produktiv-Testdaten
ist für den neuen Web-Import erforderlich.

## Build und Prüfung

Auf ausdrücklichen Nutzerwunsch ergänzt der Web-Dialog fehlende Endzeiten bei
als verfügbar zugeordneten Einträgen mit 24:00 Uhr. Die Ergänzung ist sichtbar
gekennzeichnet und bearbeitbar; erkannte Endzeiten bleiben erhalten. Beginnzeiten
werden nicht erfunden, fremde Dienste und unklare Zuordnungen behalten ihre
Pflichtprüfung. Auch die manuelle Schnellerfassung startet mit Ende 24:00 Uhr.

Die Web-Monatsplanung zeigt den aktuellen Prüfstand und die Importbestätigung
fest beim Speicherknopf. Fehlende Angaben werden zusätzlich an der jeweiligen
Zeile angezeigt; „Zur ersten offenen Zeile“ führt direkt dorthin. Die ursprüngliche
Anzahl fehlender Uhrzeiten aus der Erkennung wird durch die laufende Validierung
ersetzt. Eine Importbestätigung allein übergeht weder ungültige Angaben noch
offene Zuordnungen. Konflikte mit Terminen erfordern weiterhin eine eigene
Bestätigung. Änderungen, Hinzufügen und Entfernen setzen die Bestätigungen zurück.
Fehler beim Speichern bleiben im festen Prüfbereich sichtbar; die Eingaben bleiben
für einen erneuten Versuch im geöffneten Fenster erhalten.

Regression am tatsächlichen Web-Dialog prüfen: 30 importierte Zeilen korrigieren,
fehlende Zeiten und offene Zuordnung ergänzen, bestätigen und speichern;
Speicherfehler mit erhaltenem Entwurf und Wiederholung; separate Konfliktbestätigung;
manuelle Eingabe ohne Import. Breite und schmale Fenster (1440, 600, 390 Pixel)
einschließlich sichtbarer Bestätigungen und Fehlermeldungen prüfen.

Die Monats-, Wochen- und Tagesansicht verwenden für Ereignisse mit Uhrzeit ein
exklusives Ende. Eine Sperre am 06.10. von 00:00 bis 24:00 erscheint deshalb nur
am 06.10.; echte Nachtdienste reichen weiterhin in den Folgetag. Die Tagesgrenze
ist die nächste örtliche Mitternacht, auch bei 23-/25-Stunden-Tagen. Bestehende
ganztägige Abwesenheiten behalten ihre inklusiven Datumsgrenzen. Die gespeicherten
Monatspläne werden durch diese Darstellungskorrektur nicht verändert.

`npm run web` bereitet die Reader-Dateien über `preweb` vor. Der Produktionsbuild
wird mit `npm run build:web:production` gestartet. Dieser kurze Aufruf steht auch
in `vercel.json`, weil Vercel dort höchstens 256 Zeichen für `buildCommand` erlaubt.
Der vorangestellte Konfigurationscheck prüft diese Grenze auch beim lokalen Build.
Expo verwendet zwei Worker wie bei der Referenzprüfung. Der Vercel-Build führt
`scripts/prepare-calendar-reader.mjs` vor dem Expo-Export aus und prüft anschließend
mit `scripts/audit-calendar-reader-export.mjs dist` alle benötigten Reader-Dateien.
Bei direktem `expo export` vorher `npm run calendar:reader:prepare` ausführen.
Die erzeugten Dateien liegen unter `public/calendar-reader/v1` und sind nicht im
Git-Repository; Bibliotheksversionen stehen in `package-lock.json` und im erzeugten
`versions.json`. Keine Anmeldeinformationen oder neuen Dienste notwendig.

Vorhandene Vitest-Tests:

```sh
npx vitest run src/__tests__/calendar/localPlanParser.test.ts src/__tests__/calendar/employeePlanImportWeb.test.ts src/__tests__/calendar/employeeMonthPlanning.test.ts src/__tests__/calendar/employeePlanAnalysis.test.ts
```

Die Browserprüfung nutzt das vorhandene Playwright:

```sh
npm run calendar:reader:verify
```

Optional `CALENDAR_READER_BROWSER_EXECUTABLE` auf einen bereits verfügbaren
Chromium-Browser setzen. Die Prüfung erzeugt synthetische Testdokumente und prüft
PDF-Text, Scan-OCR, Foto-OCR, Abbruch, ungültige/zu große Dateien und das Ausbleiben
externer Dokumentübertragung. Nutzerunterlagen gehören nicht ins Repository.

Referenzprüfung vom 29.09.2026: beide bereitgestellten Einpersonen-PDFs wurden als
Text und als gerasterte Bilder verarbeitet. Erkannt wurden 12 Startzeit-Einträge
bzw. 30 Zeitfenster/Abwesenheiten. Die Vorlagen enthalten fehlende Anfangs- oder
Endzeiten; diese bleiben auch nach erfolgreicher Erkennung unvollständig.
Bildkopien sind kein Nachweis für beliebige Kamerafotos oder Handschrift.

Die echte Modal-Oberfläche wurde in Chromium bei 1440, 600 und 390 Pixeln geprüft:
Dateiauswahl, Entwurfsanzeige, Textkorrektur, Ersetzen des letzten Imports,
Prüfbestätigung, Rücksetzen nach Änderung und Speicherdaten. Die Datenbank wurde
in dieser Oberflächenprüfung ersetzt; ein angemeldeter Produktionstest bleibt
nach Veröffentlichung offen. Der vollständige Typecheck hat die gleichen 39
bereits bestehenden Fehler wie der unveränderte Ausgangsstand, keine zusätzlichen.

Quellen der offenen Bausteine:
[PDF.js](https://github.com/mozilla/pdf.js),
[Tesseract.js](https://github.com/naptha/tesseract.js),
[Sprachdaten](https://github.com/naptha/tessdata).
Die zugehörigen Lizenzdateien und Paketinformationen werden mit bereitgestellt.
