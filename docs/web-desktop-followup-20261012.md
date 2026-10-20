# Web-Desktop: Abgleich mit dem Screenshot vom 12. Oktober 2026

Produktivbasis: `f2956207507fc139a55c6bf8a812989239d23e8e`, Vercel-Deployment `dpl_HA94WC6p5y7QWGKipYu6ozYZzfVV`. Der Screenshot zeigt den angemeldeten Verwaltungsdesktop, nicht die Android-App.

## Verbindlicher Aufbau und Korrektur

Die spätere Nutzeranweisung vom 11. Oktober entfernt Bodymap und Modulauswahl. Der gemeinsame Office-/Assist-Desktop und die gespeicherten Widgets bleiben bestehen. Die frühere Variante mit Modul-Tabs ist deshalb keine Grundlage für diese Korrektur.

Eine konkrete Layoutabweichung ist bestätigt: Das Web-Logo steht im Quellcode und im Screenshot unter der Informationszeile. Nach dem verbindlichen Oberflächenmaßstab stehen die linke Uhr-/Wetteranzeige und die rechte Bedienleiste unter dem Logo auf derselben Höhe. Der Web-Header rendert das Logo jetzt vor dieser gemeinsamen Zeile. Die veraltete, unbenutzte Modul-Tab-Stildefinition entfällt.

Die Kopfzeilen-Höhenmessung, das responsive Raster, das linke einklappbare Menü, die gespeicherte Auswahl und alle bestehenden Seitenziele verwenden weiterhin dieselben Komponenten. Es wird kein älterer Desktop importiert. Der native Android-Code ist nicht Teil der Änderung.

## Bestätigte Funktionslücke

Der neue zentrale Dokumentenkatalog aus PR #52 ist im aktuellen Produktionsfrontend noch nicht integriert. Am 12. Oktober wurden ausschließlich die Schema- und Dienstmetadaten der bestätigten Staging- und Produktionsprojekte gelesen:

- `public.central_document_catalog`: in beiden Projekten nicht vorhanden.
- `public.central_document_records`: in beiden Projekten nicht vorhanden.
- Edge Function `central-document-record`: in Produktion nicht vorhanden.

Damit sind die neue Aktenablage und der neue Katalog bislang keine aktivierte Funktion. Ein vorhandener Entwurfs-PR und frühere lokale Katalogtests belegen keine Veröffentlichung. Die ausstehende Integration benötigt den Abgleich mit dem aktuellen Webstand, registrierte Migrationen, Rechteprüfung und den tatsächlichen Dienstabschluss. Diese Untersuchung legt keine Tabellen an und verändert keine Geschäftsdaten.

## Prüfungen und Grenzen

- `git diff --check` bestanden.
- Die 13 bestehenden Prüfungen des zuletzt veröffentlichten Produktionshelpers für überlappende Ladefenster bestehen erneut. Sie belegen die Sperrlogik und sind ausdrücklich keine Desktop-Layoutprüfung.
- React-Prüfung des Web-Headers: keine neuen Hooks oder Schreiboperationen; dieselben Elemente, Größenvorgaben, Umbruchregeln und Höhenmessungen.
- Es wurden keine zusätzlichen Pakete oder Testwerkzeuge installiert. Der Checkout enthält keine installierten Projektabhängigkeiten; ein lokaler kompletter TypeScript-/React-/Expo-Lauf wird nicht behauptet.
- Die tatsächliche angemeldete Desktop-Sichtprüfung und der Web-Build des neuen Commits stehen beim Erstellen dieses Berichts noch aus. Die Anmeldeformulare wurden im vorherigen Hotfix geprüft; das ersetzt die private Desktop-Abnahme nicht.

Der vollständige ursprüngliche Überarbeitungsauftrag ist damit nicht als abgeschlossen bestätigt. Weitere fehlende Fachabläufe und Serverabschlüsse bleiben gesonderte offene Arbeit.
