# Schnellauswahlen im Dokumentenkatalog

Alle 450 Katalogvorlagen verwenden dieselbe Eingabekomponente. Für 5.764 Formular-Feldpositionen, 520 Textabschnitte, 763 Tabellen-Spaltenpositionen und 450 Zusatztextfelder gibt es passende Auswahlmöglichkeiten. Die Auswahl ist optional; freie Eingaben bleiben möglich.

Fachbereichsbezogene Textbausteine stehen als direkte Schaltflächen und in einer aufklappbaren Auswahl bereit. Mehrere Bausteine lassen sich kombinieren. Ergänzen erhält vorhandenen Text; Ersetzen tauscht den Feldinhalt aus. Die letzte Auswahl kann im jeweiligen Feld rückgängig gemacht werden. Textabschnitte bieten ihre ursprüngliche Vorlagenfassung zum Wiederherstellen an. Arbeitsverträge, Softwarevereinbarungen und Widerrufserklärungen erhalten entsprechend ihrem Gegenstand eigene Vorschläge.

Personen, Anschriften und Nummern werden ausschließlich aus dem geladenen Aktenkontext angeboten. Fehlende Angaben bleiben als Quelle nicht auswählbar. Bei Datumsfeldern ist auch der Kalender erreichbar. Relative Datums- und Uhrzeitauswahlen werden beim Anklicken neu berechnet, damit ein über Nacht geöffnetes Dokument kein veraltetes „Heute“ verwendet. Mengen, Messwerte und Medikamentendosierungen werden nicht erzeugt; Einheiten und tatsächlich vorhandene Quellen können ausgewählt werden.

Tabellen bieten nach eigenen Zeilenänderungen keine möglicherweise verschobene Originalzeile als Quelle an. Die bestehende Personen- und Aktenzuordnung bleibt erhalten. Ausgewählte Bausteine werden als bearbeitbare Dokumentwerte gespeichert; sie bleiben bei einer Stammdatenaktualisierung erhalten. Änderungen einer bereits gespeicherten Fassung benutzen weiterhin die vorhandene Versionslogik.

Die Vorschlagsdaten gehören zur Bedienung des Editors. Die registrierten Vorlagendefinitionen und die Datenbankstruktur werden nicht geändert. Vorlage, Bearbeitungsrechte und Freigabestatus werden durch die Schnellauswahl nicht aktiviert oder geändert.

## Prüfung

- 50 passende Tests erfolgreich, einschließlich vollständiger Abdeckung der 450 Definitionen, Quellenabgrenzung, Berlin-Datumswechsel, Tabellenzuordnung, Textkombination, Rückgängig und Speicherung.
- Lint der geänderten TypeScript-Dateien ohne Meldungen; featurebezogener TypeScript-Check mit tatsächlichen Abhängigkeiten ohne Fehler.
- `node scripts/qa/centralDocumentCatalogPdf.mjs --quick-choices`: 450 PDFs mit ausgewählten Bausteinen erzeugt und Dateiprüfwerte geprüft. Sechs unterschiedliche Dokumentarten dienen als zusätzliche Text- und Seitengrenzenprüfung.
- Die DOM-Interaktionsprüfungen belegen das Verhalten, keine optische Fehlerfreiheit. Eine visuelle Prüfung der angemeldeten Browseroberfläche in breiter und schmaler Ansicht steht noch aus. Der zuvor verfügbare Browser erforderte eine Anmeldung und konnte lokale HTML-Dateien nicht öffnen; zusätzliche Browser- oder Testinfrastruktur wurde nicht eingerichtet.

Keine Testdokumente wurden in produktiven Akten angelegt.
